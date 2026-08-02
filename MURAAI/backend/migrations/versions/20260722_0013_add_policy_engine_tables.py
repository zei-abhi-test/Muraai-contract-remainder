"""add policy engine tables (policy_execution, idempotency_key)

Revision ID: 20260722_0013
Revises: 20260722_0012
Create Date: 2026-07-22
"""
from alembic import op
import sqlalchemy as sa


revision = "20260722_0013"
down_revision = "20260722_0012"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "policy_execution" not in tables:
        op.create_table(
            "policy_execution",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("policy_name", sa.String(200), nullable=False),
            sa.Column("event_id", sa.String(36), nullable=False),
            sa.Column("event_type", sa.String(100), nullable=False),
            sa.Column("aggregate_type", sa.String(50), nullable=False),
            sa.Column("aggregate_id", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'pending'")),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
            sa.Column("duration_ms", sa.Float(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("retry_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_policy_execution_policy_name", "policy_execution", ["policy_name"])
        op.create_index("ix_policy_execution_event_id", "policy_execution", ["event_id"])
        op.create_index("ix_policy_execution_status", "policy_execution", ["status"])
        op.create_index("ix_policy_execution_event_policy", "policy_execution", ["event_id", "policy_name"])

    if "idempotency_key" not in tables:
        op.create_table(
            "idempotency_key",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("event_id", sa.String(36), nullable=False),
            sa.Column("policy_name", sa.String(200), nullable=False),
            sa.Column("processed_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("event_id", "policy_name", name="uq_idempotency_event_policy"),
        )
        op.create_index("ix_idempotency_event_id", "idempotency_key", ["event_id"])


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "idempotency_key" in tables:
        op.drop_index("ix_idempotency_event_id", table_name="idempotency_key")
        op.drop_table("idempotency_key")

    if "policy_execution" in tables:
        op.drop_index("ix_policy_execution_policy_name", table_name="policy_execution")
        op.drop_index("ix_policy_execution_event_id", table_name="policy_execution")
        op.drop_index("ix_policy_execution_status", table_name="policy_execution")
        op.drop_index("ix_policy_execution_event_policy", table_name="policy_execution")
        op.drop_table("policy_execution")
