from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from src.models.contract import Contract, Notification, db
from src.routes.contracts.crud import get_owned_contract, handle_validation_error
from src.services.auth import require_resource, token_required
from src.services.logging_config import get_structured_logger
from src.services.validators import NotificationCreate

contract_notifications_bp = Blueprint("contract_notifications", __name__)
logger = get_structured_logger(__name__)


def notification_stats_for_contracts(contract_ids):
    """Return reminder stats keyed by contract id using existing notifications."""
    stats = {
        contract_id: {
            "total_reminders_sent": 0,
            "last_reminder_sent_at": None,
            "last_reminder_type": None,
            "last_reminder_message": None,
        }
        for contract_id in contract_ids
    }
    if not contract_ids:
        return stats

    notifications = (
        Notification.query.filter(Notification.contract_id.in_(contract_ids))
        .order_by(Notification.contract_id.asc(), Notification.send_date.desc())
        .all()
    )
    for notification in notifications:
        contract_stats = stats[notification.contract_id]
        if notification.status == "sent":
            contract_stats["total_reminders_sent"] += 1
            if contract_stats["last_reminder_sent_at"] is None:
                contract_stats["last_reminder_sent_at"] = (
                    notification.send_date.isoformat()
                    if notification.send_date
                    else None
                )
                contract_stats["last_reminder_type"] = notification.notification_type
                contract_stats["last_reminder_message"] = notification.message
    return stats


@contract_notifications_bp.route("/notifications", methods=["GET"])
@token_required
@require_resource("contracts")
def get_notifications(current_user):
    """Get notification history"""
    try:
        contract_id = request.args.get("contract_id", type=int)
        limit = request.args.get("limit", default=100, type=int)

        if limit <= 0 or limit > 1000:
            limit = 100

        query = Notification.query.join(Contract).filter(
            Contract.user_id == current_user.id
        )
        if contract_id:
            if contract_id <= 0:
                return jsonify({"error": "Invalid contract_id"}), 400
            if not get_owned_contract(contract_id, current_user.id):
                return jsonify({"error": "Contract not found"}), 404
            query = query.filter(Notification.contract_id == contract_id)

        notifications = query.order_by(Notification.send_date.desc()).limit(limit).all()
        return jsonify([notification.to_dict() for notification in notifications]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@contract_notifications_bp.route("/notifications", methods=["POST"])
@token_required
@require_resource("contracts")
def create_notification(current_user):
    """Create a new notification record"""
    try:
        data = request.get_json() or {}

        validated_data = NotificationCreate(**data)

        contract = get_owned_contract(validated_data.contract_id, current_user.id)
        if not contract:
            return jsonify({"error": "Contract not found"}), 404

        notification = Notification(
            contract_id=validated_data.contract_id,
            notification_type=validated_data.notification_type.value,
            status=validated_data.status.value,
            message=validated_data.message,
        )

        db.session.add(notification)
        db.session.commit()
        return jsonify(notification.to_dict()), 201

    except ValidationError as e:
        return handle_validation_error(e)
    except Exception as e:
        db.session.rollback()
        return (
            jsonify({"error": "Failed to create notification", "details": str(e)}),
            400,
        )
