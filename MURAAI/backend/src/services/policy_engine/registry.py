"""Thread-safe registry for policy instances."""

import threading
from typing import Dict, List, Optional

from src.services.policy_engine.base import Policy


class PolicyRegistry:
    """Stores and indexes ``Policy`` instances.

    Thread-safe (reentrant lock) so it can be accessed from scheduler threads
    or worker processes without external synchronisation.
    """

    def __init__(self) -> None:
        self._policies: Dict[str, Policy] = {}
        self._lock = threading.RLock()

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(self, policy: Policy) -> None:
        """Register a policy.  Raises ``ValueError`` if already registered."""
        with self._lock:
            if policy.name in self._policies:
                raise ValueError(
                    f"Policy '{policy.name}' is already registered. "
                    f"Unregister it first before replacing."
                )
            self._policies[policy.name] = policy

    def unregister(self, name: str) -> None:
        """Remove a policy by name.  No-op if not found."""
        with self._lock:
            self._policies.pop(name, None)

    # ------------------------------------------------------------------
    # Lookup
    # ------------------------------------------------------------------

    def get(self, name: str) -> Optional[Policy]:
        """Look up a policy by its unique name."""
        with self._lock:
            return self._policies.get(name)

    def get_for_event(self, event_type: str) -> List[Policy]:
        """Return all policies that handle *event_type*.

        Policies that declare ``"*"`` in ``handles()`` receive **every**
        event — a convenient catch-all for projection policies like the
        timeline.
        """
        with self._lock:
            return [
                p
                for p in self._policies.values()
                if event_type in p.handles() or "*" in p.handles()
            ]

    # ------------------------------------------------------------------
    # Introspection
    # ------------------------------------------------------------------

    def list(self) -> List[Policy]:
        """Return a snapshot of all registered policies."""
        with self._lock:
            return list(self._policies.values())

    def count(self) -> int:
        """Number of registered policies."""
        with self._lock:
            return len(self._policies)
