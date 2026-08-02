"""Timeline projection policy.

Subscribes to **all** domain events and projects each one into the
``timeline_item`` read model.  This policy is registered with the
``PolicyEngine`` so that every event automatically appears in the
timeline without modifying any route handler.
"""

from src.services.policy_engine.base import Policy, PolicyResult
from src.services.domain_event import DomainEvent
from src.services.timeline.service import TimelineService
from src.services.logging_config import get_structured_logger

logger = get_structured_logger(__name__)


class TimelineProjection(Policy):
    """Project every domain event into the timeline.

    Because it handles ``"*"``, the policy engine dispatches every event to
    this policy.  The underlying ``TimelineService.record_event()`` is
    idempotent — replaying the same event multiple times is safe.
    """

    @property
    def name(self) -> str:
        return "timeline_projection"

    @property
    def description(self) -> str:
        return "Project all domain events into the queryable timeline"

    _service: TimelineService

    def __init__(self, service: TimelineService) -> None:
        self._service = service

    def handles(self) -> list[str]:
        """Subscribe to every event type via the wildcard sentinel.

        The policy engine (*not* this method) expands ``"*"`` to mean "all
        events".  If the engine does not support wildcards natively, this
        policy can be registered as a catch-all by the caller.
        """
        return ["*"]

    def execute(self, event: DomainEvent) -> PolicyResult:
        try:
            self._service.record_event(event)
            return PolicyResult(
                success=True,
                policy_name=self.name,
                event_id=event.event_id,
            )
        except Exception as exc:
            logger.error(
                "Timeline projection failed",
                context={"event_id": event.event_id, "error": str(exc)},
            )
            return PolicyResult(
                success=False,
                policy_name=self.name,
                event_id=event.event_id,
                error=str(exc),
            )
