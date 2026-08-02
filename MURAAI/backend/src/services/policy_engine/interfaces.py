"""Abstract interfaces for future async backends.

These contracts let the policy engine switch from the default synchronous
executor to a distributed backend without changing any policy code.

Backend matrix
--------------
+------------------+---------------------+---------------------------+
| Backend          | Dispatch mechanism   | Worker                    |
+------------------+---------------------+---------------------------+
| Redis Streams    | XADD to stream      | asyncio consumer group    |
| Celery           | apply_async()       | Celery worker             |
| Kafka            | produce()           | Kafka consumer group      |
+------------------+---------------------+---------------------------+
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from src.services.domain_event import DomainEvent
from src.services.policy_engine.base import PolicyResult


class AsyncPolicyDispatcher(ABC):
    """Pluggable backend for dispatching events to remote workers.

    When a distributed backend is plugged in, ``PolicyEngine.dispatch()``
    will call ``AsyncPolicyDispatcher.dispatch()`` instead of executing
    policies inline.
    """

    @abstractmethod
    def dispatch(self, event: DomainEvent) -> None:
        """Enqueue *event* for asynchronous policy execution.

        Implementations MUST be non-blocking (or at least very fast).
        Actual policy execution happens in a worker process.
        """

    @abstractmethod
    def dispatch_batch(self, events: List[DomainEvent]) -> None:
        """Enqueue multiple events in one operation (e.g. pipeline)."""

    @abstractmethod
    def count_pending(self) -> int:
        """Return the number of events waiting to be processed."""


class AsyncResultStore(ABC):
    """Pluggable backend for storing execution results.

    The default implementation writes to ``policy_execution`` via SQLAlchemy.
    A Redis implementation could store results with a TTL for fast lookup.
    """

    @abstractmethod
    def store_result(self, result: PolicyResult) -> None: ...

    @abstractmethod
    def get_result(
        self, event_id: str, policy_name: str
    ) -> Optional[PolicyResult]: ...

    @abstractmethod
    def list_failed(
        self, limit: int = 100, offset: int = 0
    ) -> List[PolicyResult]: ...


class EventSerializer(ABC):
    """Serialisation contract for events crossing process boundaries.

    JSON is the default; Avro or Protobuf implementations could be swapped
    in later for schema enforcement and compact encoding.
    """

    @abstractmethod
    def serialize(self, event: DomainEvent) -> str: ...

    @abstractmethod
    def deserialize(self, data: str) -> DomainEvent: ...
