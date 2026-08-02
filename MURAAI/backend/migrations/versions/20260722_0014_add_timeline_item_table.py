"""add timeline_item table for timeline projection

Revision ID: 20260722_0014
Revises: 20260722_0013
Create Date: 2026-07-22
"""
from alembic import op
import sqlalchemy as sa


revision = "20260722_0014"
down_revision = "20260722_0013"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "timeline_item" not in tables:
        op.create_table(
            "timeline_item",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("event_id", sa.String(36), nullable=False),
            sa.Column("event_type", sa.String(100), nullable=False),
            sa.Column("actor_id", sa.Integer(), nullable=True),
            sa.Column("actor_name", sa.String(200), nullable=True),
            sa.Column("timestamp", sa.DateTime(), nullable=False),
            sa.Column("title", sa.String(500), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("object_type", sa.String(50), nullable=False),
            sa.Column("object_id", sa.Integer(), nullable=False),
            sa.Column("object_label", sa.String(300), nullable=True),
            sa.Column("aggregate_type", sa.String(50), nullable=False),
            sa.Column("aggregate_id", sa.Integer(), nullable=False),
            sa.Column("payload_json", sa.Text(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("event_id", name="uq_timeline_event_id"),
        )
        op.create_index("ix_timeline_event_type", "timeline_item", ["event_type"])
        op.create_index("ix_timeline_actor", "timeline_item", ["actor_id"])
        op.create_index("ix_timeline_object", "timeline_item", ["object_type", "object_id"])
        op.create_index("ix_timeline_aggregate", "timeline_item", ["aggregate_type", "aggregate_id"])
        # Model has index=True on timestamp (auto index) plus explicit DESC index
        op.create_index("ix_timeline_item_timestamp", "timeline_item", ["timestamp"])
        op.create_index(
            "ix_timeline_timestamp_desc",
            "timeline_item",
            [sa.text('"timestamp" DESC')],
        )


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "timeline_item" in tables:
        for idx in [
            "ix_timeline_timestamp_desc",
            "ix_timeline_item_timestamp",
            "ix_timeline_aggregate",
            "ix_timeline_object",
            "ix_timeline_actor",
            "ix_timeline_event_type",
        ]:
            op.drop_index(idx, table_name="timeline_item")
        op.drop_table("timeline_item")
