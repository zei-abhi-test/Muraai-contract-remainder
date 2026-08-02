"""Policy base class and result type.

Every policy is a subclass of ``Policy``.  Subclasses must define:
- ``name``  — unique identifier (used for idempotency, logging, registry)
- ``handles()`` — list of event types the policy subscribes to
- ``execute(event)`` — the policy logic itself

Policies MUST be idempotent: the engine may call ``execute()`` more than
once for the same event (e.g. after a crash or during retry).
"""

from dataclasses import dataclass, field
from typing import Any, Dict, Optional
from abc import ABC, abstractmethod

from src.services.domain_event import DomainEvent


@dataclass
class PolicyResult:
    """Returned by every ``Policy.execute()`` call.

    ``success`` and ``policy_name`` are required; all other fields have
    sensible defaults.
    """

    success: bool
    policy_name: str
    event_id: str
    duration_ms: float = 0.0
    error: Optional[str] = None
    skipped: bool = False
    data: Optional[Dict[str, Any]] = None


class Policy(ABC):
    """Abstract base for all domain policies.

    Example concrete policy::

        class SendContractCreatedEmail(Policy):
            name = "send_contract_created_email"
            description = "Email stakeholders when a contract is created"

            def handles(self) -> list[str]:
                return ["ContractCreated"]

            def execute(self, event: DomainEvent) -> PolicyResult:
                # ... send email logic ...
                return PolicyResult(success=True, policy_name=self.name, event_id=event.event_id)
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique policy identifier (used for idempotency and dedup)."""

    @property
    def description(self) -> str:
        """Human-readable description of what this policy does."""
        return ""

    @abstractmethod
    def handles(self) -> list[str]:
        """Event types this policy subscribes to.

        Return the canonical event type strings (e.g. ``"ContractCreated"``,
        ``"InvoicePaid"``).  The policy engine matches these against the
        ``event_type`` of each dispatched domain event.
        """

    @abstractmethod
    def execute(self, event: DomainEvent) -> PolicyResult:
        """Execute this policy for the given domain event.

        Must be idempotent — the engine guarantees at-most-once semantics
        but retries may produce duplicate calls after a crash or timeout.
        """
