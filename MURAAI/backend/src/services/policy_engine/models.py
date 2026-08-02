"""SQLAlchemy models for the policy engine.

Two tables:

- ``policy_execution`` — persistent log of every execute attempt (including
  retries).  Useful for dashboards, alerting, and debugging.
- ``idempotency_key`` — guarantees that a given (event, policy) pair is
  processed at most once.  Without this, retries or at-least-once delivery
  would cause duplicate side-effects.
"""

from datetime import datetime

from src.models.user import db


class PolicyExecution(db.Model):
    """Log of every policy execution attempt.

    One row per *attempt* (retries produce multiple rows linked by
    ``event_id + policy_name``).
    """

    __tablename__ = "policy_execution"

    id = db.Column(db.Integer, primary_key=True)
    policy_name = db.Column(db.String(200), nullable=False, index=True)
    event_id = db.Column(db.String(36), nullable=False, index=True)
    event_type = db.Column(db.String(100), nullable=False)
    aggregate_type = db.Column(db.String(50), nullable=False)
    aggregate_id = db.Column(db.Integer, nullable=False)
    status = db.Column(
        db.String(20), nullable=False, default="pending", index=True
    )  # pending | running | success | failed
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    duration_ms = db.Column(db.Float, nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    retry_count = db.Column(db.Integer, nullable=False, default=0)

    __table_args__ = (
        db.Index("ix_policy_execution_event_policy", "event_id", "policy_name"),
    )


class IdempotencyKey(db.Model):
    """Guarantees at-most-once semantics for every event–policy pair.

    A row is inserted *after* a policy completes successfully.  If the
    engine encounters the same ``event_id + policy_name`` again (e.g. after
    a restart or duplicate delivery), it skips execution.
    """

    __tablename__ = "idempotency_key"

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.String(36), nullable=False)
    policy_name = db.Column(db.String(200), nullable=False)
    processed_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint(
            "event_id", "policy_name", name="uq_idempotency_event_policy"
        ),
        db.Index("ix_idempotency_event_id", "event_id"),
    )
