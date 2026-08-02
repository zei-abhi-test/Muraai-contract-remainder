"""Timeline — read-only projection of domain events.

Every domain event is projected into a ``TimelineItem`` that can be queried
with filtering, pagination, and full-text search.

Responsibilities
----------------
- Subscribe to all domain events via the ``TimelineProjection`` policy
- Store each event as a human-readable timeline entry
- Provide query API: filter by type/actor/object, paginate, search
- Support full replay from the event store for rebuilds

Usage
-----
    timeline_service = TimelineService()
    timeline_service.record_event(event)
    items, total = timeline_service.query(page=1, per_page=20, event_type="ContractCreated")
"""

from src.services.timeline.models import TimelineItem
from src.services.timeline.service import TimelineService
from src.services.timeline.policy import TimelineProjection

__all__ = ["TimelineItem", "TimelineService", "TimelineProjection"]
