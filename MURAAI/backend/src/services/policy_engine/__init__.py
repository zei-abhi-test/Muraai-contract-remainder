"""Policy Engine — infrastructure for registering and executing domain policies.

Responsibilities
----------------
- Register policies
- Dispatch domain events to matching policies
- Execute policies with error isolation, retry, and backoff
- Guarantee idempotency (each event–policy pair processed at most once)
- Log every execution attempt for observability
- Provide abstract interfaces for future async backends (Redis, Celery, Kafka)

Usage
-----
    engine = PolicyEngine(registry)
    engine.dispatch(event)

Policies are registered before dispatch:
    registry.register(MyPolicy())
"""

from src.services.policy_engine.base import Policy, PolicyResult
from src.services.policy_engine.registry import PolicyRegistry
from src.services.policy_engine.engine import PolicyEngine
from src.services.policy_engine.models import PolicyExecution, IdempotencyKey
from src.services.policy_engine.interfaces import (
    AsyncPolicyDispatcher,
    AsyncResultStore,
    EventSerializer,
)

__all__ = [
    "Policy",
    "PolicyResult",
    "PolicyRegistry",
    "PolicyEngine",
    "PolicyExecution",
    "IdempotencyKey",
    "AsyncPolicyDispatcher",
    "AsyncResultStore",
    "EventSerializer",
]
