from datetime import datetime

from flask import Blueprint, jsonify, request

from src.models.contract import ActivityLog, Contract, db
from src.services.auth import token_required, require_resource
from src.services.logging_config import get_structured_logger

activity_bp = Blueprint("activity", __name__)
logger = get_structured_logger(__name__)

ACTIVITY_TYPES = {
    "contract_created", "contract_updated", "contract_submitted",
    "contract_approved", "contract_rejected",
    "contract_activated", "contract_completed", "contract_renewed",
    "contract_expiring", "renewal_due",
    "approval_requested", "approval_cancelled",
    "customer_created", "contact_created",
    "product_created", "product_added",
    "po_created", "po_updated", "po_deleted", "po_submitted",
    "po_approved", "po_cancelled", "po_completed", "po_mark_received",
    "invoice_created", "invoice_updated", "invoice_deleted",
    "invoice_issued", "invoice_paid", "invoice_cancelled",
    "invoice_sent", "invoice_due", "invoice_overdue",
    "document_uploaded", "document_downloaded", "document_deleted",
    "document_replaced", "document_viewed",
}


def log_activity(user_id, activity_type, title, description=None,
                 contract_id=None, entity_type=None, entity_id=None):
    """Create an activity log entry.  Returns the new ActivityLog instance."""
    entry = ActivityLog(
        user_id=user_id,
        contract_id=contract_id,
        activity_type=activity_type,
        title=title,
        description=description,
        entity_type=entity_type,
        entity_id=entity_id,
        created_at=datetime.utcnow(),
    )
    db.session.add(entry)
    return entry


@activity_bp.route("/activity", methods=["GET"])
@token_required
@require_resource("activity")
def list_activities(current_user):
    """List the current user's activity feed, newest first."""
    limit = request.args.get("limit", 50, type=int)
    unread_first = request.args.get("unread_first", "true").lower() == "true"

    query = ActivityLog.query.filter_by(user_id=current_user.id)

    if unread_first:
        from sqlalchemy import desc, literal
        query = query.order_by(
            desc(ActivityLog.is_read == literal(False)),
            desc(ActivityLog.created_at),
        )
    else:
        query = query.order_by(ActivityLog.created_at.desc())

    activities = query.limit(limit).all()
    return jsonify([a.to_dict() for a in activities]), 200


@activity_bp.route("/activity/unread-count", methods=["GET"])
@token_required
@require_resource("activity")
def unread_count(current_user):
    count = ActivityLog.query.filter_by(
        user_id=current_user.id, is_read=False
    ).count()
    return jsonify({"count": count}), 200


@activity_bp.route("/activity/<int:activity_id>/read", methods=["POST"])
@token_required
@require_resource("activity")
def mark_read(current_user, activity_id):
    entry = ActivityLog.query.filter_by(
        id=activity_id, user_id=current_user.id
    ).first()
    if not entry:
        return jsonify({"error": "Activity not found"}), 404
    entry.is_read = True
    db.session.commit()
    return jsonify(entry.to_dict()), 200


@activity_bp.route("/activity/mark-all-read", methods=["POST"])
@token_required
@require_resource("activity")
def mark_all_read(current_user):
    ActivityLog.query.filter_by(
        user_id=current_user.id, is_read=False
    ).update({"is_read": True})
    db.session.commit()
    return jsonify({"success": True}), 200


@activity_bp.route("/activity/contract/<int:contract_id>", methods=["GET"])
@token_required
@require_resource("activity")
def contract_activity(current_user, contract_id):
    """Activity feed for a specific contract (used by the Contract Workspace Activity tab)."""
    contract = Contract.query.filter_by(id=contract_id, user_id=current_user.id).first()
    if not contract:
        return jsonify({"error": "Contract not found"}), 404

    activities = (
        ActivityLog.query
        .filter_by(contract_id=contract_id)
        .order_by(ActivityLog.created_at.desc())
        .limit(100)
        .all()
    )
    return jsonify([a.to_dict() for a in activities]), 200
