"""Timeline projection service.

Translates domain events into human-readable timeline entries and provides
a query API with filtering, pagination, and full-text search.
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import or_

from src.models.user import User, db
from src.models.contract import ContractEventLog
from src.services.logging_config import get_structured_logger
from src.services.domain_event import DomainEvent

from src.services.timeline.models import TimelineItem

logger = get_structured_logger(__name__)

# ---------------------------------------------------------------------------
# Event-type → human-readable title templates
# ---------------------------------------------------------------------------
# {obj} — the object label extracted from payload
# {actor} — the actor name
# ---------------------------------------------------------------------------

EVENT_TITLES: Dict[str, str] = {
    # Contracts
    "ContractCreated": "{actor} created contract {obj}",
    "ContractUpdated": "{actor} updated contract {obj}",
    "ContractDeleted": "{actor} deleted contract {obj}",
    "ContractSubmitted": "{actor} submitted contract {obj} for approval",
    "ContractActivated": "{actor} activated contract {obj}",
    "ContractHeld": "{actor} put contract {obj} on hold",
    "ContractResumed": "{actor} resumed contract {obj}",
    "ContractCompleted": "{actor} completed contract {obj}",
    "ContractRevertedToDraft": "{actor} reverted contract {obj} to draft",
    "ContractRenewalMarkedDue": "{actor} marked renewal due for {obj}",
    "ContractExpired": "Contract {obj} expired",
    # Invoices
    "InvoiceCreated": "{actor} created invoice {obj}",
    "InvoiceUpdated": "{actor} updated invoice {obj}",
    "InvoiceDeleted": "{actor} deleted invoice {obj}",
    "InvoiceIssued": "{actor} issued invoice {obj}",
    "InvoicePaid": "{actor} marked invoice {obj} as paid",
    "InvoiceCancelled": "{actor} cancelled invoice {obj}",
    "InvoiceDuplicated": "{actor} duplicated invoice {obj}",
    # Purchase orders
    "PurchaseOrderCreated": "{actor} created purchase order {obj}",
    "PurchaseOrderUpdated": "{actor} updated purchase order {obj}",
    "PurchaseOrderDeleted": "{actor} deleted purchase order {obj}",
    "PurchaseOrderSubmitted": "{actor} submitted purchase order {obj}",
    "PurchaseOrderCancelled": "{actor} cancelled purchase order {obj}",
    "PurchaseOrderReceived": "{actor} marked purchase order {obj} as received",
    "PurchaseOrderDuplicated": "{actor} duplicated purchase order {obj}",
    # Approvals
    "ApprovalRequested": "{actor} requested approval for {obj}",
    "ApprovalGranted": "{actor} granted approval for {obj}",
    "ApprovalRejected": "{actor} rejected approval for {obj}",
    "ApprovalCancelled": "{actor} cancelled approval for {obj}",
    # Documents
    "DocumentUploaded": "{actor} uploaded document {obj}",
    "DocumentReplaced": "{actor} replaced document {obj}",
    "DocumentDeleted": "{actor} deleted document {obj}",
    # Renewals
    "RenewalCreated": "{actor} created renewal for {obj}",
    "RenewalCompleted": "{actor} completed renewal for {obj}",
    # Customers
    "CustomerCreated": "{actor} created customer {obj}",
}

# Default fallback — used when event_type is not in the mapping above
FALLBACK_TITLE = "{actor} triggered {event_type} on {obj}"

# ---------------------------------------------------------------------------
# Payload field extractors — each returns (object_label, description)
# ---------------------------------------------------------------------------

def _extract_label(payload: Dict[str, Any], event_type: str) -> str:
    """Extract a human-readable object label from the event payload."""
    for key in ("contract_name", "invoice_number", "po_number", "file_name", "name"):
        val = payload.get(key)
        if val:
            return str(val)
    return f"{event_type.replace('_', ' ').title()}"


def _extract_description(payload: Dict[str, Any], event_type: str) -> Optional[str]:
    """Extract a longer description from the payload."""
    for key in ("description", "title", "message"):
        val = payload.get(key)
        if val:
            return str(val)
    return None


# ---------------------------------------------------------------------------
# Object-type resolver
# ---------------------------------------------------------------------------

def _object_type_for(event_type: str, aggregate_type: str) -> str:
    """Map an event type or aggregate type to a canonical object type name."""
    # Known aggregate types
    type_map = {
        "contract": "contract",
        "invoice": "invoice",
        "purchase_order": "purchase_order",
        "document": "document",
        "customer": "customer",
    }
    if aggregate_type in type_map:
        return type_map[aggregate_type]

    # Derive from event type prefix
    event_lower = event_type.lower()
    for prefix, obj_type in [
        ("contract", "contract"),
        ("invoice", "invoice"),
        ("purchaseorder", "purchase_order"),
        ("approval", "approval"),
        ("document", "document"),
        ("renewal", "renewal"),
        ("customer", "customer"),
    ]:
        if event_lower.startswith(prefix):
            return obj_type

    return aggregate_type or "unknown"


def _format_title(template: str, actor: str, obj: str, event_type: str) -> str:
    """Interpolate template with actor, object, and event_type."""
    return template.format(actor=actor, obj=obj, event_type=event_type)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class TimelineService:
    """Projects domain events into a queryable timeline."""

    # ------------------------------------------------------------------
    # Record
    # ------------------------------------------------------------------

    def record_event(
        self, event: DomainEvent, commit: bool = False
    ) -> TimelineItem:
        """Project a single domain event into a timeline entry.

        Idempotent — if an item for ``event.event_id`` already exists, it is
        returned without creating a duplicate.

        Args:
            event: The domain event to project.
            commit: If True, flush + commit the current session.  Should be
                False (default) when called from an ``on_emit`` observer so
                the caller owns the transaction boundary.
        """
        existing = TimelineItem.query.filter_by(event_id=event.event_id).first()
        if existing:
            return existing

        actor_name = self._resolve_actor_name(event.user_id, event.payload)
        label = _extract_label(event.payload, event.event_type)
        description = _extract_description(event.payload, event.event_type)

        template = EVENT_TITLES.get(event.event_type, FALLBACK_TITLE)
        title = _format_title(template, actor_name, label, event.event_type)

        item = TimelineItem(
            event_id=event.event_id,
            event_type=event.event_type,
            actor_id=event.user_id,
            actor_name=actor_name,
            timestamp=self._parse_timestamp(event.timestamp),
            title=title,
            description=description,
            object_type=_object_type_for(event.event_type, event.aggregate_type),
            object_id=event.aggregate_id,
            object_label=label,
            aggregate_type=event.aggregate_type,
            aggregate_id=event.aggregate_id,
            payload_json=json.dumps(event.payload, default=str),
        )
        db.session.add(item)
        if commit:
            db.session.commit()
        return item

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------

    def query(
        self,
        page: int = 1,
        per_page: int = 20,
        event_type: Optional[str] = None,
        actor_id: Optional[int] = None,
        object_type: Optional[str] = None,
        object_id: Optional[int] = None,
        aggregate_type: Optional[str] = None,
        aggregate_id: Optional[int] = None,
        search: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> Tuple[List[TimelineItem], int]:
        """Query timeline entries with filtering, pagination, and search.

        Returns:
            Tuple of (items, total_count).
        """
        q = TimelineItem.query

        if event_type:
            q = q.filter(TimelineItem.event_type == event_type)
        if actor_id:
            q = q.filter(TimelineItem.actor_id == actor_id)
        if object_type:
            q = q.filter(TimelineItem.object_type == object_type)
        if object_id:
            q = q.filter(TimelineItem.object_id == object_id)
        if aggregate_type:
            q = q.filter(TimelineItem.aggregate_type == aggregate_type)
        if aggregate_id:
            q = q.filter(TimelineItem.aggregate_id == aggregate_id)
        if from_date:
            q = q.filter(TimelineItem.timestamp >= self._parse_timestamp(from_date))
        if to_date:
            q = q.filter(TimelineItem.timestamp <= self._parse_timestamp(to_date))
        if search:
            like = f"%{search}%"
            q = q.filter(
                or_(
                    TimelineItem.title.ilike(like),
                    TimelineItem.description.ilike(like),
                    TimelineItem.object_label.ilike(like),
                    TimelineItem.actor_name.ilike(like),
                    TimelineItem.event_type.ilike(like),
                )
            )

        total = q.count()
        items = (
            q.order_by(TimelineItem.timestamp.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    # ------------------------------------------------------------------
    # Replay
    # ------------------------------------------------------------------

    def replay(self) -> int:
        """Rebuild the entire timeline from the domain event store.

        This is the **future replay capability**.  It clears the timeline
        table and re-projects every event from ``contract_event_log``.
        Useful for schema migrations or data recovery.

        Returns:
            Number of timeline items created.
        """
        logger.info("Starting timeline replay — clearing existing items")
        TimelineItem.query.delete()

        records: List[ContractEventLog] = (
            ContractEventLog.query.order_by(ContractEventLog.created_at.asc()).all()
        )
        count = 0
        for record in records:
            event = self._record_to_event(record)
            self.record_event(event)
            count += 1

        logger.info("Timeline replay complete", context={"items_created": count})
        return count

    # ------------------------------------------------------------------
    # Count
    # ------------------------------------------------------------------

    def count(
        self,
        event_type: Optional[str] = None,
        actor_id: Optional[int] = None,
        object_type: Optional[str] = None,
    ) -> int:
        """Quick count of matching timeline entries (no pagination)."""
        q = TimelineItem.query
        if event_type:
            q = q.filter(TimelineItem.event_type == event_type)
        if actor_id:
            q = q.filter(TimelineItem.actor_id == actor_id)
        if object_type:
            q = q.filter(TimelineItem.object_type == object_type)
        return q.count()

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    @staticmethod
    def _resolve_actor_name(
        user_id: Optional[int], payload: Dict[str, Any]
    ) -> str:
        """Best-effort resolution of a human-readable actor name."""
        # Some event payloads include names directly
        for key in ("user_name", "approver", "owner", "actor"):
            val = payload.get(key)
            if val:
                return str(val)

        if user_id:
            user = db.session.get(User, user_id)
            if user:
                return user.name or user.username or user.email or f"User {user.id}"

        return "System"

    @staticmethod
    def _parse_timestamp(ts: Any) -> datetime:
        """Parse various timestamp formats into a datetime."""
        if isinstance(ts, datetime):
            return ts
        if isinstance(ts, str):
            try:
                return datetime.fromisoformat(ts)
            except (ValueError, TypeError):
                pass
        return datetime.utcnow()

    @staticmethod
    def _record_to_event(record: ContractEventLog) -> DomainEvent:
        """Rehydrate a stored ContractEventLog into a DomainEvent."""
        import json
        return DomainEvent(
            event_id=record.event_id,
            event_type=record.event_type,
            aggregate_id=record.aggregate_id,
            aggregate_type=record.aggregate_type,
            timestamp=record.created_at.isoformat() if record.created_at else "",
            user_id=record.user_id,
            correlation_id=record.correlation_id,
            payload=json.loads(record.payload_json) if record.payload_json else {},
            version=record.version,
        )
