from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import atexit
from datetime import datetime, timedelta
from src.services.notification_service import notification_service
from src.services.logging_config import get_structured_logger


class SchedulerService:
    def __init__(self, app=None):
        self.scheduler = None
        self.app = app
        self.logger = get_structured_logger(__name__)
        if app:
            self.init_app(app)

    def init_app(self, app):
        self.app = app
        self.scheduler = BackgroundScheduler()
        self.logger = get_structured_logger(__name__)

        # Schedule daily notification check at 9:00 AM
        self.scheduler.add_job(
            func=self.check_and_send_notifications,
            trigger=CronTrigger(hour=9, minute=0),  # Daily at 9:00 AM
            id="daily_notification_check",
            name="Daily Contract End Date Notification Check",
            replace_existing=True,
        )

        # Schedule calendar reminder check every 2 hours
        self.scheduler.add_job(
            func=self.check_and_send_calendar_reminders,
            trigger=CronTrigger(hour="*/2", minute=5),
            id="calendar_reminder_check",
            name="Calendar Reminder Check",
            replace_existing=True,
        )

        # Schedule weekly summary on Mondays at 8:00 AM
        self.scheduler.add_job(
            func=self.send_weekly_summary,
            trigger=CronTrigger(day_of_week="mon", hour=8, minute=0),  # Weekly on Monday at 8:00 AM
            id="weekly_summary",
            name="Weekly Contract Summary",
            replace_existing=True,
        )

        # Start the scheduler
        self.scheduler.start()
        self.check_and_send_notifications()
        self.logger.info(
            "Scheduler started successfully",
            context={"scheduled_jobs": len(self.scheduler.get_jobs())},
        )

        # Shut down the scheduler when exiting the app
        atexit.register(lambda: self.scheduler.shutdown())

    def check_and_send_calendar_reminders(self):
        """Check calendar reminder configs and send notifications for upcoming events."""
        try:
            with self.app.app_context():
                from src.models.calendar import ReminderConfig, CalendarEvent as CalendarEventModel
                from src.models.contract import ActivityLog, Contract, Invoice, PurchaseOrder, ContractApproval, ContractDocument, db
                from datetime import datetime, date, timedelta

                self.logger.info("Starting calendar reminder check")
                configs = ReminderConfig.query.filter(ReminderConfig.enabled.is_(True)).all()
                today = date.today()
                reminders_sent = 0

                for cfg in configs:
                    trigger_date = today + timedelta(days=cfg.days_before)

                    if cfg.event_type == "renewal":
                        events = CalendarEventModel.query.filter(
                            CalendarEventModel.event_type == "renewal",
                        ).all()
                        contracts = Contract.query.filter(
                            Contract.user_id == cfg.user_id,
                            Contract.renewal_date == trigger_date,
                            Contract.renewal_date.isnot(None),
                            Contract.status.in_(["Active", "On Hold"]),
                        ).all()
                        for c in contracts:
                            if self._send_calendar_reminder(cfg, c.id, "contract", c.contract_name,
                                                             f"Renewal due for contract \"{c.contract_name}\" in {cfg.days_before} days",
                                                             c.renewal_date.isoformat()):
                                reminders_sent += 1

                    elif cfg.event_type == "contract_end":
                        contracts = Contract.query.filter(
                            Contract.user_id == cfg.user_id,
                            Contract.end_date == trigger_date,
                            Contract.end_date.isnot(None),
                            Contract.status.in_(["Active", "On Hold"]),
                        ).all()
                        for c in contracts:
                            if self._send_calendar_reminder(cfg, c.id, "contract", c.contract_name,
                                                             f"Contract \"{c.contract_name}\" ends in {cfg.days_before} days",
                                                             c.end_date.isoformat()):
                                reminders_sent += 1

                    elif cfg.event_type == "invoice_due":
                        invoices = Invoice.query.filter(
                            Invoice.user_id == cfg.user_id,
                            Invoice.due_date == trigger_date,
                            Invoice.due_date.isnot(None),
                            Invoice.status.in_(["DRAFT", "ISSUED"]),
                        ).all()
                        for inv in invoices:
                            if self._send_calendar_reminder(cfg, inv.id, "invoice", inv.invoice_number,
                                                             f"Invoice {inv.invoice_number} of ${float(inv.amount or 0):.2f} due in {cfg.days_before} days",
                                                             inv.due_date.isoformat()):
                                reminders_sent += 1

                    elif cfg.event_type == "approval_deadline":
                        approvals = ContractApproval.query.join(
                            Contract, ContractApproval.contract_id == Contract.id
                        ).filter(
                            Contract.user_id == cfg.user_id,
                            ContractApproval.status == "Pending",
                        ).all()
                        for a in approvals:
                            contract = Contract.query.get(a.contract_id)
                            if contract and self._send_calendar_reminder(cfg, a.id, "approval",
                                contract.contract_name,
                                f"Approval pending for contract \"{contract.contract_name}\"",
                                (a.submitted_at.date().isoformat() if a.submitted_at else "")):
                                reminders_sent += 1

                    elif cfg.event_type == "po_delivery":
                        pos = PurchaseOrder.query.filter(
                            PurchaseOrder.user_id == cfg.user_id,
                            PurchaseOrder.expected_delivery == trigger_date,
                            PurchaseOrder.expected_delivery.isnot(None),
                            PurchaseOrder.status.in_(["Submitted", "Approved"]),
                        ).all()
                        for po in pos:
                            if self._send_calendar_reminder(cfg, po.id, "purchase_order", po.po_number,
                                                             f"PO {po.po_number} delivery expected in {cfg.days_before} days",
                                                             po.expected_delivery.isoformat()):
                                reminders_sent += 1

                    elif cfg.event_type == "contract_start":
                        contracts = Contract.query.filter(
                            Contract.user_id == cfg.user_id,
                            Contract.start_date == trigger_date,
                            Contract.start_date.isnot(None),
                        ).all()
                        for c in contracts:
                            if self._send_calendar_reminder(cfg, c.id, "contract", c.contract_name,
                                                             f"Contract \"{c.contract_name}\" starts in {cfg.days_before} days",
                                                             c.start_date.isoformat()):
                                reminders_sent += 1

                    elif cfg.event_type == "document_expiry":
                        docs = ContractDocument.query.all()
                        for doc in docs:
                            if not doc.uploaded_at:
                                continue
                            contract = Contract.query.get(doc.contract_id) if doc.contract_id else None
                            if contract and contract.user_id != cfg.user_id:
                                continue
                            exp_date = doc.uploaded_at.date() + timedelta(days=365)
                            if exp_date == trigger_date:
                                if self._send_calendar_reminder(cfg, doc.id, "document", doc.file_name,
                                    f"Document \"{doc.file_name}\" expires in {cfg.days_before} days",
                                    exp_date.isoformat()):
                                    reminders_sent += 1

                self.logger.info("Calendar reminder check completed",
                    context={"reminders_sent": reminders_sent})
                return {"reminders_sent": reminders_sent}
        except Exception as e:
            self.logger.error("Error during calendar reminder check",
                context={"error": str(e)})
            return {"error": str(e)}

    def _send_calendar_reminder(self, cfg, entity_id, entity_type, title, message, event_date):
        """Send a calendar reminder via ActivityLog and optionally email."""
        try:
            from src.models.contract import ActivityLog, db
            log = ActivityLog(
                user_id=cfg.user_id,
                activity_type="calendar_reminder",
                title=f"Reminder: {title}",
                description=message,
                entity_type=entity_type,
                entity_id=entity_id,
            )
            db.session.add(log)

            if cfg.notification_method in ("email", "both"):
                from src.models.user import User
                user = User.query.get(cfg.user_id)
                if user and user.email:
                    notification_service.send_email_notification(
                        to_email=user.email,
                        subject=f"Muraai Reminder: {title}",
                        body=f"<h2>Reminder</h2><p>{message}</p><p>Event date: {event_date}</p>",
                    )
            db.session.commit()
            return True
        except Exception as e:
            self.logger.error("Failed to send calendar reminder",
                context={"error": str(e)})
            return False

    def check_and_send_notifications(self):
        """Job function to check contract end-date reminders and send notifications."""
        try:
            with self.app.app_context():
                self.logger.info("Starting daily notification check")
                results = notification_service.check_and_send_notifications()

                self.logger.info(
                    "Notification check completed",
                    context={
                        "emails_sent": results["emails_sent"],
                        "push_notifications_sent": results["push_notifications_sent"],
                        "errors_count": len(results.get("errors", [])),
                    },
                )

                if results.get("errors"):
                    self.logger.error(
                        "Errors during notification check",
                        context={
                            "error_count": len(results["errors"]),
                            "errors": results["errors"],
                        },
                    )

                return results
        except Exception as e:
            self.logger.error(
                "Error during scheduled notification check",
                context={"error": str(e), "exception_type": type(e).__name__},
            )
            return {"error": str(e)}

    def send_weekly_summary(self):
        """Job function to send weekly summary of upcoming contract end dates."""
        try:
            with self.app.app_context():
                from src.models.contract import Contract

                self.logger.info("Starting weekly summary")

                # Get contracts ending in the next 7 days.
                today = datetime.now().date()
                next_week = today + timedelta(days=7)

                upcoming_contracts = Contract.query.filter(
                    Contract.end_date >= today,
                    Contract.end_date <= next_week,
                    Contract.notification_enabled.is_(True),
                ).all()

                if upcoming_contracts:
                    # Group contracts by user email
                    user_contracts = {}
                    for contract in upcoming_contracts:
                        if contract.notification_email:
                            if contract.notification_email not in user_contracts:
                                user_contracts[contract.notification_email] = []
                            user_contracts[contract.notification_email].append(contract)

                    # Send summary emails
                    summary_count = 0
                    failed_count = 0
                    for email, contracts in user_contracts.items():
                        subject = (
                            f"Weekly Contract Expiry Summary - {len(contracts)} contracts ending"
                        )
                        body = self.create_weekly_summary_template(contracts)

                        success, message = notification_service.send_email_notification(
                            email, subject, body
                        )

                        if success:
                            self.logger.info(
                                "Weekly summary sent",
                                context={
                                    "recipient_email": email,
                                    "contract_count": len(contracts),
                                },
                            )
                            summary_count += 1
                        else:
                            self.logger.error(
                                "Failed to send weekly summary",
                                context={"recipient_email": email, "error": message},
                            )
                            failed_count += 1

                    self.logger.info(
                        "Weekly summary completed",
                        context={
                            "summary_count": summary_count,
                            "failed_count": failed_count,
                            "total_contracts": len(upcoming_contracts),
                        },
                    )
                else:
                    self.logger.info("No contracts ending this week")

        except Exception as e:
            self.logger.error(
                "Error during weekly summary",
                context={"error": str(e), "exception_type": type(e).__name__},
            )

    def create_weekly_summary_template(self, contracts):
        """Create HTML template for weekly summary email"""
        contract_rows = ""
        for contract in contracts:
            days_until = (contract.end_date - datetime.now().date()).days
            urgency_color = (
                "#dc2626" if days_until <= 3 else "#f59e0b" if days_until <= 7 else "#3b82f6"
            )

            contract_rows += f"""
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px; font-weight: bold;">{contract.contract_name}</td>
                <td style="padding: 12px;">{contract.company_name}</td>
                <td style="padding: 12px;">{contract.end_date.strftime('%B %d, %Y')}</td>
                <td style="padding: 12px; color: {urgency_color}; font-weight: bold;">{days_until} days</td>
            </tr>
            """

        html_template = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Weekly Contract Summary</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Muraai Contract Manager</h1>
                <p style="color: #e2e8f0; margin: 10px 0 0 0;">Weekly Contract Summary</p>
            </div>
            
            <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
                <h2 style="color: #1f2937; margin: 0 0 20px 0;">Contracts Ending This Week</h2>
                <p style="margin-bottom: 25px;">You have {len(contracts)} contracts ending in the next 7 days:</p>
                
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #e2e8f0;">Contract</th>
                            <th style="padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #e2e8f0;">Company</th>
                            <th style="padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #e2e8f0;">End Date</th>
                            <th style="padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #e2e8f0;">Days Left</th>
                        </tr>
                    </thead>
                    <tbody>
                        {contract_rows}
                    </tbody>
                </table>
                
                <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 25px 0;">
                    <p style="margin: 0; color: #92400e;"><strong>Reminder:</strong> Review these contracts and take necessary action to ensure continuity of your services.</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="#" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Manage Contracts</a>
                </div>
            </div>
            
            <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0; border-top: none;">
                <p style="margin: 0; color: #6b7280; font-size: 14px;">
                    This is an automated weekly summary from Muraai Contract Manager.<br>
                    To stop receiving these notifications, please update your notification settings.
                </p>
            </div>
        </body>
        </html>
        """

        return html_template

    def add_custom_job(self, func, trigger, job_id, name):
        """Add a custom scheduled job"""
        try:
            self.scheduler.add_job(
                func=func, trigger=trigger, id=job_id, name=name, replace_existing=True
            )
            self.logger.info("Custom job added", context={"job_id": job_id, "job_name": name})
            return True
        except Exception as e:
            self.logger.error(
                "Failed to add custom job",
                context={"job_id": job_id, "job_name": name, "error": str(e)},
            )
            return False

    def remove_job(self, job_id):
        """Remove a scheduled job"""
        try:
            self.scheduler.remove_job(job_id)
            self.logger.info("Job removed", context={"job_id": job_id})
            return True
        except Exception as e:
            self.logger.error("Failed to remove job", context={"job_id": job_id, "error": str(e)})
            return False

    def get_jobs(self):
        """Get list of all scheduled jobs"""
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append(
                {
                    "id": job.id,
                    "name": job.name,
                    "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                    "trigger": str(job.trigger),
                }
            )
        return jobs


# Initialize the scheduler service
scheduler_service = SchedulerService()
