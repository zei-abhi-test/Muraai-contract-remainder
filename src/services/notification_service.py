import requests
import json
import os
from datetime import datetime, timedelta

from src.models.contract import Contract, Notification, db
from src.services.logging_config import get_structured_logger


REMINDER_WINDOW_DAYS = 30
REMINDER_INTERVAL_DAYS = 2
REMINDER_DEDUP_HOURS = 48
END_DATE_REMINDER_PREFIX = "Contract end date reminder"


class NotificationService:
    def __init__(self, app=None):
        self.app = app
        self.logger = get_structured_logger(__name__)
        if app:
            self.init_app(app)

    def init_app(self, app):
        """Initialize app configurations"""
        # Resend Email configuration
        self.resend_api_key = app.config.get("RESEND_API_KEY", os.getenv("RESEND_API_KEY"))

        # Firebase Cloud Messaging configuration
        self.fcm_server_key = app.config.get("FCM_SERVER_KEY", "")
        self.fcm_url = "https://fcm.googleapis.com/fcm/send"

    def send_email_notification(self, to_email, subject, body, contract_id=None, log_message=None):
        """Send email notification using Resend API"""
        try:
            self.logger.info(
                "Sending email notification",
                context={"recipient": to_email, "contract_id": contract_id, "subject": subject},
            )

            response = requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {self.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": "Muraai <onboarding@resend.dev>",  # Update as needed
                    "to": [to_email],
                    "subject": subject,
                    "html": body,
                },
                timeout=30,
            )

            if response.status_code in (200, 201):
                # Log successful notification
                if contract_id:
                    notification = Notification(
                        contract_id=contract_id,
                        notification_type="email",
                        status="sent",
                        message=log_message or f"Email sent to {to_email}",
                    )
                    db.session.add(notification)
                    db.session.commit()

                self.logger.info(
                    "Email notification sent successfully",
                    context={"recipient": to_email, "contract_id": contract_id},
                )
                return True, "Email sent successfully"
            else:
                raise Exception(
                    f"Resend API failed with status {response.status_code}: {response.text}"
                )

        except Exception as e:
            self.logger.error(
                "Failed to send email notification",
                context={
                    "recipient": to_email,
                    "contract_id": contract_id,
                    "error": str(e),
                    "exception_type": type(e).__name__,
                },
            )

            # Log failed notification
            if contract_id:
                notification = Notification(
                    contract_id=contract_id,
                    notification_type="email",
                    status="failed",
                    message=f"Failed to send email: {str(e)}",
                )
                db.session.add(notification)
                db.session.commit()

            return False, str(e)

    def send_push_notification(self, device_token, title, body, contract_id=None, log_message=None):
        """Send mobile push notification via Firebase Cloud Messaging"""
        try:
            self.logger.info(
                "Sending push notification", context={"contract_id": contract_id, "title": title}
            )

            headers = {
                "Authorization": f"key={self.fcm_server_key}",
                "Content-Type": "application/json",
            }

            payload = {
                "to": device_token,
                "notification": {
                    "title": title,
                    "body": body,
                    "icon": "ic_notification",
                    "sound": "default",
                },
                "data": {
                    "contract_id": str(contract_id) if contract_id else "",
                    "type": "contract_end_date",
                },
            }

            response = requests.post(self.fcm_url, headers=headers, data=json.dumps(payload))

            if response.status_code == 200:
                if contract_id:
                    notification = Notification(
                        contract_id=contract_id,
                        notification_type="mobile",
                        status="sent",
                        message=log_message or "Push notification sent to device",
                    )
                    db.session.add(notification)
                    db.session.commit()

                self.logger.info(
                    "Push notification sent successfully", context={"contract_id": contract_id}
                )
                return True, "Push notification sent successfully"
            else:
                raise Exception(
                    f"FCM request failed with status {response.status_code}: {response.text}"
                )

        except Exception as e:
            self.logger.error(
                "Failed to send push notification",
                context={
                    "contract_id": contract_id,
                    "error": str(e),
                    "exception_type": type(e).__name__,
                },
            )

            if contract_id:
                notification = Notification(
                    contract_id=contract_id,
                    notification_type="mobile",
                    status="failed",
                    message=f"Failed to send push notification: {str(e)}",
                )
                db.session.add(notification)
                db.session.commit()

            return False, str(e)

    def should_send_end_date_reminder(self, contract, today=None):
        """Return whether a contract is on an end-date reminder day."""
        today = today or datetime.now().date()
        days_until_end = (contract.end_date - today).days
        return (
            0 <= days_until_end <= REMINDER_WINDOW_DAYS
            and days_until_end % REMINDER_INTERVAL_DAYS == 0
        )

    def has_recent_end_date_reminder(self, contract_id, notification_type):
        """Avoid duplicate scheduler sends within the same 48-hour reminder window."""
        threshold = datetime.utcnow() - timedelta(hours=REMINDER_DEDUP_HOURS)
        return (
            Notification.query.filter(
                Notification.contract_id == contract_id,
                Notification.notification_type == notification_type,
                Notification.status == "sent",
                Notification.send_date >= threshold,
                Notification.message.like(f"{END_DATE_REMINDER_PREFIX}:%"),
            ).first()
            is not None
        )

    def create_email_template(self, contract, days_until_end):
        """Create HTML email template for contract end-date reminder."""
        if days_until_end == 0:
            urgency = "ENDS TODAY"
            urgency_color = "#dc2626"
            message = f"Your contract with {contract.company_name} ends today."
        elif days_until_end <= 7:
            urgency = "URGENT"
            urgency_color = "#dc2626"
            message = f"Your contract with {contract.company_name} ends in {days_until_end} days."
        elif days_until_end <= REMINDER_WINDOW_DAYS:
            urgency = "UPCOMING"
            urgency_color = "#f59e0b"
            message = f"Your contract with {contract.company_name} ends in {days_until_end} days."
        else:
            urgency = "REMINDER"
            urgency_color = "#3b82f6"
            message = f"Your contract with {contract.company_name} ends in {days_until_end} days."

        html_template = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Contract End Date Reminder</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Muraai Contract Manager</h1>
                <p style="color: #e2e8f0; margin: 10px 0 0 0;">Contract End Date Reminder</p>
            </div>
            
            <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
                <div style="background: {urgency_color}; color: white; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 25px;">
                    <h2 style="margin: 0; font-size: 20px;">{urgency} EXPIRY NOTICE</h2>
                </div>
                
                <p style="font-size: 16px; margin-bottom: 20px;">{message}</p>
                
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 15px 0; color: #1f2937;">Contract Details</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; font-weight: bold; width: 40%;">Contract Name:</td>
                            <td style="padding: 8px 0;">{contract.contract_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; font-weight: bold;">Company:</td>
                            <td style="padding: 8px 0;">{contract.company_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; font-weight: bold;">End Date:</td>
                            <td style="padding: 8px 0;">{contract.end_date.strftime('%B %d, %Y')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; font-weight: bold;">Renewal Date Reference:</td>
                            <td style="padding: 8px 0;">{contract.renewal_date.strftime('%B %d, %Y')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; font-weight: bold;">Contract Period:</td>
                            <td style="padding: 8px 0;">{contract.start_date.strftime('%B %d, %Y')} - {contract.end_date.strftime('%B %d, %Y')}</td>
                        </tr>
                    </table>
                </div>
                
                {f'<div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0;"><p style="margin: 0; color: #92400e;"><strong>Notes:</strong> {contract.notes}</p></div>' if contract.notes else ''}
                
                <div style="text-align: center; margin: 30px 0;">
                    <p style="margin-bottom: 15px;">Take action now to ensure continuity of your services.</p>
                    <a href="#" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Manage Contract</a>
                </div>
            </div>
            
            <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0; border-top: none;">
                <p style="margin: 0; color: #6b7280; font-size: 14px;">
                    This is an automated reminder from Muraai Contract Manager.<br>
                    To stop receiving these notifications, please update your notification settings.
                </p>
            </div>
        </body>
        </html>
        """

        return html_template

    def check_and_send_notifications(self, user_id=None):
        """Check for contracts nearing end_date and send reminder notifications."""
        today = datetime.now().date()
        window_end = today + timedelta(days=REMINDER_WINDOW_DAYS)

        results = {"emails_sent": 0, "push_notifications_sent": 0, "errors": []}

        self.logger.info(
            "Starting notification check",
            context={
                "basis": "end_date",
                "window_days": REMINDER_WINDOW_DAYS,
                "interval_days": REMINDER_INTERVAL_DAYS,
                "user_id": user_id,
            },
        )

        contracts_query = Contract.query.filter(
            Contract.end_date >= today,
            Contract.end_date <= window_end,
            Contract.notification_enabled.is_(True),
        )
        if user_id is not None:
            contracts_query = contracts_query.filter(Contract.user_id == user_id)

        contracts = contracts_query.order_by(Contract.end_date.asc()).all()

        for contract in contracts:
            days_until_end = (contract.end_date - today).days
            if not self.should_send_end_date_reminder(contract, today):
                continue

            log_message = f"{END_DATE_REMINDER_PREFIX}: {days_until_end} days until end date"

            try:
                if contract.notification_email and not self.has_recent_end_date_reminder(
                    contract.id, "email"
                ):
                    subject = f"Contract Expiry Reminder - {contract.contract_name}"
                    body = self.create_email_template(contract, days_until_end)

                    success, message = self.send_email_notification(
                        contract.notification_email,
                        subject,
                        body,
                        contract.id,
                        log_message=log_message,
                    )

                    if success:
                        results["emails_sent"] += 1
                    else:
                        results["errors"].append(
                            f"Email failed for contract {contract.id}: {message}"
                        )

                device_token = getattr(contract, "device_token", None)
                if (
                    contract.notification_mobile
                    and device_token
                    and not self.has_recent_end_date_reminder(contract.id, "mobile")
                ):
                    title = "Contract Expiry Reminder"
                    body_text = (
                        f"{contract.contract_name} ends in {days_until_end} days"
                        if days_until_end > 0
                        else f"{contract.contract_name} ends today"
                    )

                    success, message = self.send_push_notification(
                        device_token,
                        title,
                        body_text,
                        contract.id,
                        log_message=log_message,
                    )

                    if success:
                        results["push_notifications_sent"] += 1
                    else:
                        results["errors"].append(
                            f"Push failed for contract {contract.id}: {message}"
                        )

            except Exception as e:
                error_msg = f"Error processing contract {contract.id}: {str(e)}"
                results["errors"].append(error_msg)
                self.logger.error(
                    "Error processing contract for notification",
                    context={
                        "contract_id": contract.id,
                        "days_until_end": days_until_end,
                        "error": str(e),
                        "exception_type": type(e).__name__,
                    },
                )

        db.session.commit()

        self.logger.info(
            "Notification check completed",
            context={
                "emails_sent": results["emails_sent"],
                "push_notifications_sent": results["push_notifications_sent"],
                "error_count": len(results["errors"]),
            },
        )

        return results


# Initialize the notification service
notification_service = NotificationService()
