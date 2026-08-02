"""Policy engine — orchestrates policy execution for domain events.

Responsibilities
----------------
1. Match each incoming domain event to registered policies
2. Execute each policy with **error isolation** (a failure in one policy
   does not affect others)
3. **Retry** failed executions with progressive backoff
4. Enforce **idempotency** (at-most-once per event–policy pair)
5. Log every execution attempt to the ``policy_execution`` table

The engine is **synchronous** by default.  When a Redis / Celery / Kafka
backend is added, ``dispatch()`` will enqueue the event instead of executing
inline — the ``AsyncPolicyDispatcher`` interface in ``interfaces.py`` is the
contract for that migration.
"""

import time
import uuid
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional

from src.models.user import db
from src.services.logging_config import get_structured_logger
from src.services.domain_event import DomainEvent
from src.services.policy_engine.registry import PolicyRegistry
from src.services.policy_engine.base import Policy, PolicyResult
from src.services.policy_engine.models import PolicyExecution, IdempotencyKey

logger = get_structured_logger(__name__)


#: Progressive back-off delays (in milliseconds) per retry attempt.
RETRY_DELAY_MS = [100, 500, 2_000, 5_000]

#: Maximum number of retry attempts before giving up.
MAX_RETRIES = 3


class PolicyEngine:
    """Synchronous policy engine.

    Usage::

        engine = PolicyEngine(registry)
        results = engine.dispatch(event)
    """

    def __init__(self, registry: PolicyRegistry) -> None:
        self.registry = registry

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def dispatch(self, event: DomainEvent) -> List[PolicyResult]:
        """Dispatch *event* to every registered policy that handles it.

        Each policy runs in isolation — a failure never blocks other
        policies.  Returns one ``PolicyResult`` per matching policy.
        """
        policies = self.registry.get_for_event(event.event_type)
        if not policies:
            return []

        logger.info(
            "Dispatching event to policies",
            context={
                "event_id": event.event_id,
                "event_type": event.event_type,
                "policy_count": len(policies),
                "policies": [p.name for p in policies],
            },
        )

        results: List[PolicyResult] = []
        for policy in policies:
            result = self._safe_execute(policy, event)
            results.append(result)

        return results

    def dispatch_by_params(
        self,
        event_type: str,
        aggregate_type: str,
        aggregate_id: int,
        user_id: Optional[int] = None,
        correlation_id: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
    ) -> List[PolicyResult]:
        """Convenience helper — build a ``DomainEvent`` and dispatch."""
        event = DomainEvent(
            event_id=str(uuid.uuid4()),
            event_type=event_type,
            aggregate_id=aggregate_id,
            aggregate_type=aggregate_type,
            timestamp=datetime.utcnow().isoformat(),
            user_id=user_id,
            correlation_id=correlation_id,
            payload=payload or {},
        )
        return self.dispatch(event)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _safe_execute(self, policy: Policy, event: DomainEvent) -> PolicyResult:
        """Execute *policy* for *event* with idempotency, retry, and isolation.

        The method is intentionally non-static so subclasses or future async
        wrappers can override it without duplicating the orchestration logic.
        """
        # --- Idempotency --------------------------------------------------
        if self._already_processed(event.event_id, policy.name):
            logger.info(
                "Policy skipped (already processed)",
                context={"policy": policy.name, "event_id": event.event_id},
            )
            return PolicyResult(
                success=True,
                policy_name=policy.name,
                event_id=event.event_id,
                duration_ms=0.0,
                skipped=True,
            )

        # --- Execute with retry -------------------------------------------
        execution: Optional[PolicyExecution] = None
        last_error: Optional[str] = None

        for attempt in range(MAX_RETRIES + 1):
            # Create or re-use the execution record
            if execution is None:
                execution = self._init_execution(policy.name, event, attempt)
            else:
                execution.retry_count = attempt
                execution.status = "pending"
                db.session.commit()

            started = time.monotonic()
            execution.status = "running"
            execution.started_at = datetime.utcnow()
            db.session.commit()

            try:
                result = policy.execute(event)
                elapsed_ms = (time.monotonic() - started) * 1000
                execution.duration_ms = round(elapsed_ms, 2)

                if result.success:
                    execution.status = "success"
                    execution.completed_at = datetime.utcnow()
                    db.session.commit()
                    self._record_idempotency(event.event_id, policy.name)
                    return result

                # Policy returned a non-success result
                last_error = result.error
                execution.status = "failed"
                execution.error_message = last_error
                execution.completed_at = datetime.utcnow()
                db.session.commit()

                logger.warning(
                    "Policy execution returned failure",
                    context={
                        "policy": policy.name,
                        "event_id": event.event_id,
                        "attempt": attempt + 1,
                        "error": last_error,
                    },
                )

            except Exception as exc:
                elapsed_ms = (time.monotonic() - started) * 1000
                execution.duration_ms = round(elapsed_ms, 2)
                last_error = f"{type(exc).__name__}: {exc}"
                execution.status = "failed"
                execution.error_message = last_error + "\n" + traceback.format_exc()
                execution.completed_at = datetime.utcnow()
                db.session.commit()

                logger.error(
                    "Policy execution raised exception",
                    context={
                        "policy": policy.name,
                        "event_id": event.event_id,
                        "attempt": attempt + 1,
                        "error": str(exc),
                    },
                )

            # Retry? -------------------------------------------------------
            if attempt < MAX_RETRIES:
                delay_s = RETRY_DELAY_MS[attempt] / 1000.0
                logger.info(
                    "Retrying policy",
                    context={
                        "policy": policy.name,
                        "event_id": event.event_id,
                        "attempt": attempt + 1,
                        "next_delay_s": delay_s,
                    },
                )
                time.sleep(delay_s)

        # All attempts exhausted
        return PolicyResult(
            success=False,
            policy_name=policy.name,
            event_id=event.event_id,
            duration_ms=execution.duration_ms if execution else 0.0,
            error=last_error or "Max retries exceeded",
        )

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _already_processed(event_id: str, policy_name: str) -> bool:
        return bool(
            IdempotencyKey.query.filter_by(
                event_id=event_id, policy_name=policy_name
            ).first()
        )

    @staticmethod
    def _record_idempotency(event_id: str, policy_name: str) -> None:
        db.session.add(
            IdempotencyKey(event_id=event_id, policy_name=policy_name)
        )
        db.session.commit()

    @staticmethod
    def _init_execution(
        policy_name: str, event: DomainEvent, retry_count: int
    ) -> PolicyExecution:
        record = PolicyExecution(
            policy_name=policy_name,
            event_id=event.event_id,
            event_type=event.event_type,
            aggregate_type=event.aggregate_type,
            aggregate_id=event.aggregate_id,
            status="pending",
            retry_count=retry_count,
        )
        db.session.add(record)
        db.session.commit()
        return record
