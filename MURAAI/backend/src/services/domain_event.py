"""Domain event emission service.

The single source of truth for emitting domain events across all aggregates.
Events are written to the event log table in the same transaction as the
aggregate write (outbox pattern), ensuring atomicity.
"""

import json
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from src.models.contract import ContractEventLog, db
from src.services.logging_config import get_structured_logger

logger = get_structured_logger(__name__)


# ---------------------------------------------------------------------------
# Domain event value object
# ---------------------------------------------------------------------------

@dataclass
class DomainEvent:
    event_id: str
    event_type: str
    aggregate_id: int
    aggregate_type: str
    timestamp: str
    user_id: Optional[int]
    correlation_id: Optional[str]
    payload: Dict[str, Any]
    version: int = 1


# ---------------------------------------------------------------------------
# Dispatcher abstraction
# ---------------------------------------------------------------------------

class EventDispatcher:
    """Writes domain events to the event store.

    The dispatcher is intentionally stateless and contains no business logic.
    It serialises the provided metadata into a persistence record and appends
    it to the current database transaction.

    Observers (``on_emit``) are called after the record is added to the session
    but before commit.  They receive a ``DomainEvent`` value object and MUST
    NOT commit the transaction — the caller owns the commit boundary.

    Policies, projections, and side-effect handlers are NOT hardcoded here;
    they attach via ``on_emit``.
    """

    def __init__(self) -> None:
        self._on_emit: List[Callable[[DomainEvent], None]] = []

    def on_emit(self, callback: Callable[[DomainEvent], None]) -> None:
        """Register a callback invoked after every ``dispatch()``.

        The callback receives the ``DomainEvent`` value object.  It runs
        inside the same database transaction as ``dispatch()``.
        """
        self._on_emit.append(callback)

    def dispatch(
        self,
        event_type: str,
        aggregate_type: str,
        aggregate_id: int,
        payload: Optional[Dict[str, Any]] = None,
        user_id: Optional[int] = None,
        correlation_id: Optional[str] = None,
    ) -> ContractEventLog:
        """Emit a single domain event.

        Must be called within an active database session.  The record is not
        committed — the caller owns the transaction boundary, which guarantees
        the outbox invariant: aggregate write + event emission are atomic.

        After adding the record to the session, registered ``on_emit``
        callbacks are invoked with a ``DomainEvent`` value object.
        """
        now = datetime.utcnow()
        event_id = str(uuid.uuid4())

        record = ContractEventLog(
            event_id=event_id,
            event_type=event_type,
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            user_id=user_id,
            correlation_id=correlation_id,
            version=1,
            payload_json=json.dumps(payload, default=str) if payload else "{}",
            created_at=now,
        )
        db.session.add(record)

        logger.info(
            "Domain event emitted",
            context={
                "event_id": event_id,
                "event_type": event_type,
                "aggregate_type": aggregate_type,
                "aggregate_id": aggregate_id,
                "user_id": user_id,
                "correlation_id": correlation_id,
            },
        )

        event = DomainEvent(
            event_id=event_id,
            event_type=event_type,
            aggregate_id=aggregate_id,
            aggregate_type=aggregate_type,
            timestamp=now.isoformat(),
            user_id=user_id,
            correlation_id=correlation_id,
            payload=payload or {},
            version=1,
        )
        for cb in self._on_emit:
            cb(event)

        return record

    def to_domain_event(self, record: ContractEventLog) -> DomainEvent:
        """Rehydrate a stored record into a DomainEvent value object."""
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


# ---------------------------------------------------------------------------
# Module-level singleton for convenience
# ---------------------------------------------------------------------------

dispatcher = EventDispatcher()


# ---------------------------------------------------------------------------
# Backward-compatible aliases (legacy callers)
# ---------------------------------------------------------------------------

def emit_event(
    event_type: str,
    aggregate_type: str,
    aggregate_id: int,
    payload: Optional[Dict[str, Any]] = None,
    user_id: Optional[int] = None,
    correlation_id: Optional[str] = None,
) -> ContractEventLog:
    """Legacy alias — delegates to EventDispatcher.dispatch()."""
    return dispatcher.dispatch(
        event_type=event_type,
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
        payload=payload,
        user_id=user_id,
        correlation_id=correlation_id,
    )


def list_events(
    aggregate_type: str,
    aggregate_id: int,
    event_types: Optional[list[str]] = None,
    limit: int = 20,
    offset: int = 0,
) -> list[ContractEventLog]:
    """Return domain events for an aggregate, ordered by creation time."""
    query = ContractEventLog.query.filter_by(
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
    )

    if event_types:
        query = query.filter(ContractEventLog.event_type.in_(event_types))

    return (
        query.order_by(ContractEventLog.created_at.asc())
        .limit(min(limit, 100))
        .offset(offset)
        .all()
    )


def count_events(
    aggregate_type: str,
    aggregate_id: int,
    event_types: Optional[list[str]] = None,
) -> int:
    """Return the total number of events for an aggregate."""
    query = ContractEventLog.query.filter_by(
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
    )

    if event_types:
        query = query.filter(ContractEventLog.event_type.in_(event_types))

    return query.count()
