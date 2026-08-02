"""Timeline read-model — a denormalised projection of domain events.

This table is **read-only for business logic**.  It is written exclusively by
the ``TimelineProjection`` policy and can be rebuilt at any time via
``TimelineService.replay()``.
"""

from datetime import datetime

from src.models.user import db


class TimelineItem(db.Model):
    """A single entry in the activity timeline.

    Every domain event maps to exactly one ``TimelineItem`` (idempotent via
    ``event_id`` unique constraint).  The table is optimised for query:
    filtered by ``event_type``, ``actor_id``, or ``object_type``, sorted by
    ``timestamp``, and searchable via LIKE on ``title`` and ``description``.
    """

    __tablename__ = "timeline_item"

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.String(36), unique=True, nullable=False)
    event_type = db.Column(db.String(100), nullable=False)

    # Actor — who did it
    actor_id = db.Column(db.Integer, nullable=True)
    actor_name = db.Column(db.String(200), nullable=True)

    # When it happened
    timestamp = db.Column(db.DateTime, nullable=False, index=True)

    # Human-readable summary
    title = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text, nullable=True)

    # Business object this event refers to
    object_type = db.Column(db.String(50), nullable=False, index=True)
    object_id = db.Column(db.Integer, nullable=False)
    object_label = db.Column(db.String(300), nullable=True)

    # Original aggregate reference
    aggregate_type = db.Column(db.String(50), nullable=False)
    aggregate_id = db.Column(db.Integer, nullable=False)

    # Raw payload for future introspection
    payload_json = db.Column(db.Text, nullable=True)

    __table_args__ = (
        db.Index("ix_timeline_event_type", "event_type"),
        db.Index("ix_timeline_actor", "actor_id"),
        db.Index("ix_timeline_object", "object_type", "object_id"),
        db.Index("ix_timeline_aggregate", "aggregate_type", "aggregate_id"),
        db.Index("ix_timeline_timestamp_desc", db.desc("timestamp")),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "event_id": self.event_id,
            "event_type": self.event_type,
            "actor": {
                "id": self.actor_id,
                "name": self.actor_name,
            } if self.actor_id else None,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "title": self.title,
            "description": self.description,
            "object": {
                "type": self.object_type,
                "id": self.object_id,
                "label": self.object_label,
            },
            "aggregate_type": self.aggregate_type,
            "aggregate_id": self.aggregate_id,
        }
