"""add event metadata columns (user_id, correlation_id, version)

Revision ID: 20260722_0012
Revises: 20260720_0011
Create Date: 2026-07-22
"""
from alembic import op
import sqlalchemy as sa


revision = "20260722_0012"
down_revision = "20260720_0011"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = {c["name"] for c in inspector.get_columns("contract_event_log")}

    if "user_id" not in cols:
        op.add_column("contract_event_log", sa.Column("user_id", sa.Integer(), nullable=True))
    if "correlation_id" not in cols:
        op.add_column("contract_event_log", sa.Column("correlation_id", sa.String(36), nullable=True))
    if "version" not in cols:
        op.add_column("contract_event_log", sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")))

    fks = {fk["constrained_columns"][0] for fk in inspector.get_foreign_keys("contract_event_log") if fk["constrained_columns"]}
    if "user_id" not in fks:
        op.create_foreign_key(
            "fk_contract_event_log_user",
            "contract_event_log", "user",
            ["user_id"], ["id"],
        )


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = {c["name"] for c in inspector.get_columns("contract_event_log")}

    fks = {fk["name"] for fk in inspector.get_foreign_keys("contract_event_log")}
    if "fk_contract_event_log_user" in fks:
        op.drop_constraint("fk_contract_event_log_user", "contract_event_log", type_="foreignkey")

    if "version" in cols:
        op.drop_column("contract_event_log", "version")
    if "correlation_id" in cols:
        op.drop_column("contract_event_log", "correlation_id")
    if "user_id" in cols:
        op.drop_column("contract_event_log", "user_id")
