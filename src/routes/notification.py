from flask import Blueprint, jsonify, request
from src.services.notification_service import notification_service
from src.services.auth import token_required
from src.services.logging_config import get_structured_logger
from src.models.contract import Contract, Notification, db

notification_bp = Blueprint("notification", __name__)
logger = get_structured_logger(__name__)


def get_owned_contract(contract_id: int, user_id: int):
    return Contract.query.filter_by(id=contract_id, user_id=user_id).first()


@notification_bp.route("/notifications/send-test", methods=["POST"])
@token_required
def send_test_notification(current_user):
    """Send a test notification for a specific contract"""
    try:
        data = request.get_json() or {}
        contract_id = data.get("contract_id")
        notification_type = data.get("type", "email")  # 'email' or 'mobile'

        if not isinstance(contract_id, int) or contract_id <= 0:
            return jsonify({"success": False, "message": "Valid contract_id is required"}), 400

        contract = get_owned_contract(contract_id, current_user.id)
        if not contract:
            return jsonify({"success": False, "message": "Contract not found"}), 404

        logger.info(
            "Test notification requested",
            context={
                "contract_id": contract_id,
                "notification_type": notification_type,
                "contract_name": contract.contract_name,
            },
        )

        if notification_type == "email" and contract.notification_email:
            subject = f"Test Notification - {contract.contract_name}"
            body = notification_service.create_email_template(contract, 7)  # Test with 7 days

            success, message = notification_service.send_email_notification(
                contract.notification_email, subject, body, contract.id
            )

            return jsonify({"success": success, "message": message, "type": "email"})

        elif notification_type == "mobile":
            # For demo purposes, we'll simulate a push notification
            title = "Test Contract Renewal Reminder"
            body_text = f"This is a test notification for {contract.contract_name}"

            # In a real implementation, you would use actual device tokens
            notification = Notification(
                contract_id=contract.id,
                notification_type="mobile",
                status="sent",
                message=f"Test push notification: {body_text}",
            )
            db.session.add(notification)
            db.session.commit()

            logger.info(
                "Test push notification created",
                context={"contract_id": contract_id, "contract_name": contract.contract_name},
            )

            return jsonify(
                {
                    "success": True,
                    "message": "Test push notification sent successfully",
                    "type": "mobile",
                }
            )

        else:
            logger.warning(
                "Invalid notification type or missing configuration",
                context={"contract_id": contract_id, "notification_type": notification_type},
            )
            return (
                jsonify(
                    {
                        "success": False,
                        "message": "Invalid notification type or missing configuration",
                    }
                ),
                400,
            )

    except Exception as e:
        logger.error(
            "Failed to send test notification",
            context={
                "contract_id": contract_id if "contract_id" in locals() else None,
                "error": str(e),
                "exception_type": type(e).__name__,
            },
        )
        return jsonify({"success": False, "message": str(e)}), 500


@notification_bp.route("/notifications/check-renewals", methods=["POST"])
@token_required
def check_renewals(current_user):
    """Manually trigger the renewal check and notification process"""
    try:
        logger.info("Manual renewal check initiated", context={"user_id": current_user.id})
        results = notification_service.check_and_send_notifications(user_id=current_user.id)

        logger.info(
            "Manual renewal check completed",
            context={
                "emails_sent": results["emails_sent"],
                "push_notifications_sent": results["push_notifications_sent"],
                "error_count": len(results.get("errors", [])),
            },
        )

        return jsonify({"success": True, "results": results})

    except Exception as e:
        logger.error(
            "Failed to check renewals",
            context={"error": str(e), "exception_type": type(e).__name__},
        )
        return jsonify({"success": False, "message": str(e)}), 500


@notification_bp.route("/notifications/history/<int:contract_id>", methods=["GET"])
@token_required
def get_notification_history(current_user, contract_id):
    """Get notification history for a specific contract"""
    try:
        contract = get_owned_contract(contract_id, current_user.id)
        if not contract:
            return jsonify({"success": False, "message": "Contract not found"}), 404

        notifications = (
            Notification.query.filter_by(contract_id=contract_id)
            .order_by(Notification.send_date.desc())
            .all()
        )

        logger.info(
            "Notification history retrieved",
            context={"contract_id": contract_id, "notification_count": len(notifications)},
        )

        return jsonify([notification.to_dict() for notification in notifications])

    except Exception as e:
        logger.error(
            "Failed to retrieve notification history",
            context={"contract_id": contract_id, "error": str(e)},
        )
        return jsonify({"success": False, "message": str(e)}), 500


@notification_bp.route("/notifications/settings/<int:contract_id>", methods=["PUT"])
@token_required
def update_notification_settings(current_user, contract_id):
    """Update notification settings for a specific contract"""
    try:
        contract = get_owned_contract(contract_id, current_user.id)
        if not contract:
            return jsonify({"success": False, "message": "Contract not found"}), 404

        data = request.get_json() or {}

        if "notification_enabled" in data:
            contract.notification_enabled = data["notification_enabled"]
        if "notification_email" in data:
            contract.notification_email = data["notification_email"]
        if "notification_mobile" in data:
            contract.notification_mobile = data["notification_mobile"]

        db.session.commit()

        logger.info(
            "Notification settings updated",
            context={
                "contract_id": contract_id,
                "notification_enabled": contract.notification_enabled,
                "has_email": bool(contract.notification_email),
                "notification_mobile": contract.notification_mobile,
            },
        )

        return jsonify(
            {
                "success": True,
                "message": "Notification settings updated successfully",
                "contract": contract.to_dict(),
            }
        )

    except Exception as e:
        logger.error(
            "Failed to update notification settings",
            context={"contract_id": contract_id, "error": str(e)},
        )
        return jsonify({"success": False, "message": str(e)}), 500


@notification_bp.route("/notifications/configure", methods=["POST"])
@token_required
def configure_notifications(current_user):
    """Configure global notification settings"""
    try:
        data = request.get_json() or {}

        # This would typically update application configuration
        # For demo purposes, we'll just return success

        logger.info(
            "Notification configuration updated",
            context={"user_id": current_user.id, "config_keys": list(data.keys()) if data else []},
        )

        return jsonify(
            {"success": True, "message": "Notification configuration updated", "config": data}
        )

    except Exception as e:
        logger.error(
            "Failed to configure notifications",
            context={"error": str(e), "exception_type": type(e).__name__},
        )
        return jsonify({"success": False, "message": str(e)}), 500
