"""Timeline API — read-only query endpoint for the activity timeline.

Endpoints
---------
GET  /timeline         — list timeline items (filtered, paginated, searchable)
POST /timeline/replay  — rebuild timeline from event store (admin only)
"""

from datetime import datetime

from flask import Blueprint, jsonify, request
from src.services.auth import token_required, require_resource
from src.services.logging_config import get_structured_logger
from src.services.timeline import TimelineService

timeline_bp = Blueprint("timeline", __name__)
logger = get_structured_logger(__name__)

# Module-level service — initialised once; safe because it has no mutable
# state except the DB, which is request-scoped via the SQLAlchemy session.
_timeline_service = TimelineService()


@timeline_bp.route("/timeline", methods=["GET"])
@token_required
@require_resource("activity")
def list_timeline(current_user):
    """Query timeline entries.

    Query parameters
    ----------------
    page          : int   (default 1)
    per_page      : int   (default 20, max 100)
    event_type    : str   — filter by event type
    actor_id      : int   — filter by user
    object_type   : str   — filter by object type (contract, invoice, …)
    object_id     : int   — filter by object ID
    aggregate_type: str   — filter by aggregate type
    aggregate_id  : int   — filter by aggregate ID
    search        : str   — full-text search across title, description, labels
    from_date     : str   — ISO datetime lower bound
    to_date       : str   — ISO datetime upper bound
    """
    try:
        page = max(1, request.args.get("page", 1, type=int))
        per_page = min(100, max(1, request.args.get("per_page", 20, type=int)))

        items, total = _timeline_service.query(
            page=page,
            per_page=per_page,
            event_type=request.args.get("event_type"),
            actor_id=request.args.get("actor_id", type=int),
            object_type=request.args.get("object_type"),
            object_id=request.args.get("object_id", type=int),
            aggregate_type=request.args.get("aggregate_type"),
            aggregate_id=request.args.get("aggregate_id", type=int),
            search=request.args.get("search"),
            from_date=request.args.get("from_date"),
            to_date=request.args.get("to_date"),
        )

        return jsonify({
            "data": [item.to_dict() for item in items],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": (total + per_page - 1) // per_page if total else 0,
            },
        }), 200

    except Exception as e:
        logger.error("Timeline query failed", context={"error": str(e)})
        return jsonify({"error": "Failed to query timeline"}), 500


@timeline_bp.route("/timeline/count", methods=["GET"])
@token_required
@require_resource("activity")
def count_timeline(current_user):
    """Quick count of timeline entries matching optional filters."""
    try:
        total = _timeline_service.count(
            event_type=request.args.get("event_type"),
            actor_id=request.args.get("actor_id", type=int),
            object_type=request.args.get("object_type"),
        )
        return jsonify({"count": total}), 200
    except Exception as e:
        logger.error("Timeline count failed", context={"error": str(e)})
        return jsonify({"error": "Failed to count timeline"}), 500


@timeline_bp.route("/timeline/replay", methods=["POST"])
@token_required
@require_resource("activity")
def replay_timeline(current_user):
    """Rebuild the entire timeline from the domain event store.

    This is a destructive operation — the existing timeline is cleared and
    rebuilt from ``contract_event_log``.  Useful after a schema migration
    or data recovery.

    Requires admin role.
    """
    try:
        count = _timeline_service.replay()
        logger.info(
            "Timeline replayed",
            context={
                "user_id": current_user.id,
                "items_created": count,
            },
        )
        return jsonify({
            "message": f"Timeline rebuilt successfully",
            "items_created": count,
        }), 200
    except Exception as e:
        logger.error("Timeline replay failed", context={"error": str(e)})
        return jsonify({"error": "Failed to replay timeline"}), 500
