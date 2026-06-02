import smtplib
import json
import requests
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from src.models.contract import Contract, Notification, db
from src.services.logging_config import get_structured_logger


class NotificationService:
    def __init__(self, app=None):
        self.app = app
        self.logger = get_structured_logger(__name__)
        if app:
            self.init_app(app)

    def init_app(self, app):
        # Email configuration
        self.smtp_server = app.config.get("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = app.config.get("SMTP_PORT", 587)
        self.email_user = app.config.get("EMAIL_USER", "")
        self.email_password = app.config.get("EMAIL_PASSWORD", "")

        # Firebase Cloud Messaging configuration
        self.fcm_server_key = app.config.get("FCM_SERVER_KEY", "")
        self.fcm_url = "https://fcm.googleapis.com/fcm/send"

    def send_email_notification(self, to_email, subject, body, contract_id=None):
        """Send email notification"""
        try:
            self.logger.info(
                "Sending email notification",
                context={"recipient": to_email, "contract_id": contract_id, "subject": subject},
            )

            # Create message
            msg = MIMEMultipart()
            msg["From"] = self.email_user
            msg["To"] = to_email
            msg["Subject"] = subject

            # Add body to email
            msg.attach(MIMEText(body, "html"))

            # Gmail SMTP configuration
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.email_user, self.email_password)

            # Send email
            text = msg.as_string()
            server.sendmail(self.email_user, to_email, text)
            server.quit()

            # Log notification
            if contract_id:
                notification = Notification(
                    contract_id=contract_id,
                    notification_type="email",
                    status="sent",
                    message=f"Email sent to {to_email}",
                )
                db.session.add(notification)
                db.session.commit()

            self.logger.info(
                "Email notification sent successfully",
                context={"recipient": to_email, "contract_id": contract_id},
            )
            return True, "Email sent successfully"

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

    def send_push_notification(self, device_token, title, body, contract_id=None):
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
                    "type": "contract_renewal",
                },
            }

            response = requests.post(self.fcm_url, headers=headers, data=json.dumps(payload))

            if response.status_code == 200:
                # Log successful notification
                if contract_id:
                    notification = Notification(
                        contract_id=contract_id,
                        notification_type="mobile",
                        status="sent",
                        message="Push notification sent to device",
                    )
                    db.session.add(notification)
                    db.session.commit()

                self.logger.info(
                    "Push notification sent successfully", context={"contract_id": contract_id}
                )
                return True, "Push notification sent successfully"
            else:
                raise Exception(f"FCM request failed with status {response.status_code}")

        except Exception as e:
            self.logger.error(
                "Failed to send push notification",
                context={
                    "contract_id": contract_id,
                    "error": str(e),
                    "exception_type": type(e).__name__,
                },
            )

            # Log failed notification
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

    def create_email_template(self, contract, days_until_renewal):
        """Create HTML email template for contract renewal reminder"""
        if days_until_renewal < 0:
            urgency = "OVERDUE"
            urgency_color = "#dc2626"
            message = f"Your contract with {contract.company_name} was due for renewal {abs(days_until_renewal)} days ago."
        elif days_until_renewal <= 7:
            urgency = "URGENT"
            urgency_color = "#dc2626"
            message = f"Your contract with {contract.company_name} is due for renewal in {days_until_renewal} days."
        elif days_until_renewal <= 30:
            urgency = "UPCOMING"
            urgency_color = "#f59e0b"
            message = f"Your contract with {contract.company_name} is due for renewal in {days_until_renewal} days."
        else:
            urgency = "REMINDER"
            urgency_color = "#3b82f6"
            message = f"Your contract with {contract.company_name} is due for renewal in {days_until_renewal} days."

        html_template = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Contract Renewal Reminder</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Muraai Contract Manager</h1>
                <p style="color: #e2e8f0; margin: 10px 0 0 0;">Contract Renewal Reminder</p>
            </div>
            
            <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
                <div style="background: {urgency_color}; color: white; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 25px;">
                    <h2 style="margin: 0; font-size: 20px;">{urgency} RENEWAL NOTICE</h2>
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
                            <td style="padding: 8px 0; font-weight: bold;">Renewal Date:</td>
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
        """Check for contracts due for renewal and send notifications"""
        today = datetime.now().date()
        notification_days = [30, 14, 7, 3, 1, 0]  # Days before renewal to send notifications

        results = {"emails_sent": 0, "push_notifications_sent": 0, "errors": []}

        self.logger.info(
            "Starting notification check",
            context={"notification_days": notification_days, "user_id": user_id},
        )

        for days in notification_days:
            target_date = today + timedelta(days=days)

            # Find contracts due for renewal on target date
            contracts_query = Contract.query.filter(
                Contract.renewal_date == target_date,
                Contract.notification_enabled.is_(True),
            )
            if user_id is not None:
                contracts_query = contracts_query.filter(Contract.user_id == user_id)
            contracts = contracts_query.all()

            if contracts:
                self.logger.info(
                    "Found contracts for notification",
                    context={
                        "days_until_renewal": days,
                        "target_date": str(target_date),
                        "contract_count": len(contracts),
                    },
                )

            for contract in contracts:
                try:
                    # Send email notification
                    if contract.notification_email:
                        subject = f"Contract Renewal Reminder - {contract.contract_name}"
                        body = self.create_email_template(contract, days)

                        success, message = self.send_email_notification(
                            contract.notification_email, subject, body, contract.id
                        )

                        if success:
                            results["emails_sent"] += 1
                        else:
                            error_msg = f"Email failed for contract {contract.id}: {message}"
                            results["errors"].append(error_msg)

                    # Send push notification (if mobile notifications are enabled)
                    if contract.notification_mobile:
                        # Note: In a real implementation, you would need to store device tokens
                        # For now, we'll just log that a push notification would be sent
                        body_text = (
                            f"{contract.contract_name} renewal due in {days} days"
                            if days > 0
                            else f"{contract.contract_name} renewal is due today"
                        )

                        # This would require actual device tokens in a real implementation
                        # success, message = self.send_push_notification(device_token, title, body_text, contract.id)

                        # For demo purposes, we'll create a notification record
                        notification = Notification(
                            contract_id=contract.id,
                            notification_type="mobile",
                            status="sent",
                            message=f"Push notification scheduled: {body_text}",
                        )
                        db.session.add(notification)
                        results["push_notifications_sent"] += 1

                        self.logger.info(
                            "Push notification scheduled",
                            context={"contract_id": contract.id, "days_until_renewal": days},
                        )

                except Exception as e:
                    error_msg = f"Error processing contract {contract.id}: {str(e)}"
                    results["errors"].append(error_msg)
                    self.logger.error(
                        "Error processing contract for notification",
                        context={
                            "contract_id": contract.id,
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
