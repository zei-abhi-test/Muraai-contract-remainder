"""add v2 contract models: soft-delete, lifecycle columns, clause, version history, event log

Revision ID: 20260720_0011
Revises: 20260716_0010
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa


revision = "20260720_0011"
down_revision = "20260716_0010"
branch_labels = None
depends_on = None


def upgrade():
    # contract — soft delete columns
    op.add_column("contract", sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("contract", sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.add_column("contract", sa.Column("deleted_by_id", sa.Integer(), nullable=True))
    op.add_column("contract", sa.Column("deletion_reason", sa.String(length=500), nullable=True))
    op.create_foreign_key("fk_contract_deleted_by", "contract", "user", ["deleted_by_id"], ["id"])

    # contract — v2 lifecycle metadata
    op.add_column("contract", sa.Column("activated_at", sa.DateTime(), nullable=True))
    op.add_column("contract", sa.Column("activated_by_id", sa.Integer(), nullable=True))
    op.add_column("contract", sa.Column("activated_notes", sa.String(length=500), nullable=True))
    op.add_column("contract", sa.Column("terminated_at", sa.DateTime(), nullable=True))
    op.add_column("contract", sa.Column("terminated_by_id", sa.Integer(), nullable=True))
    op.add_column("contract", sa.Column("termination_reason", sa.String(length=100), nullable=True))
    op.add_column("contract", sa.Column("archived_at", sa.DateTime(), nullable=True))
    op.add_column("contract", sa.Column("archived_by_id", sa.Integer(), nullable=True))
    op.add_column("contract", sa.Column("retention_until", sa.Date(), nullable=True))
    op.create_foreign_key("fk_contract_activated_by", "contract", "user", ["activated_by_id"], ["id"])
    op.create_foreign_key("fk_contract_terminated_by", "contract", "user", ["terminated_by_id"], ["id"])
    op.create_foreign_key("fk_contract_archived_by", "contract", "user", ["archived_by_id"], ["id"])

    # contract_line_item — soft delete
    op.add_column("contract_line_item", sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    # contract_document — soft delete
    op.add_column("contract_document", sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    # contract_clause — new table
    op.create_table(
        "contract_clause",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("contract_id", sa.Integer(), nullable=False),
        sa.Column("clause_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["contract_id"], ["contract.id"], name="fk_contract_clause_contract"),
        sa.PrimaryKeyConstraint("id"),
    )

    # contract_version_history — new table
    op.create_table(
        "contract_version_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("contract_id", sa.Integer(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("previous_version", sa.Integer(), nullable=True),
        sa.Column("changed_by_id", sa.Integer(), nullable=True),
        sa.Column("change_reason", sa.String(length=500), nullable=True),
        sa.Column("changes_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["contract_id"], ["contract.id"], name="fk_cvh_contract"),
        sa.ForeignKeyConstraint(["changed_by_id"], ["user.id"], name="fk_cvh_changed_by"),
        sa.PrimaryKeyConstraint("id"),
    )

    # contract_event_log — new table
    op.create_table(
        "contract_event_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.String(length=36), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("aggregate_type", sa.String(length=50), nullable=False),
        sa.Column("aggregate_id", sa.Integer(), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", name="uq_event_log_event_id"),
    )

    # indexes for event log queries
    op.create_index("ix_contract_event_log_aggregate", "contract_event_log", ["aggregate_type", "aggregate_id"])
    op.create_index("ix_contract_clause_contract_id", "contract_clause", ["contract_id"])


def downgrade():
    op.drop_index("ix_contract_clause_contract_id", table_name="contract_clause")
    op.drop_index("ix_contract_event_log_aggregate", table_name="contract_event_log")
    op.drop_table("contract_event_log")
    op.drop_table("contract_version_history")
    op.drop_table("contract_clause")
    op.drop_column("contract_document", "is_deleted")
    op.drop_column("contract_line_item", "is_deleted")
    op.drop_column("contract", "retention_until")
    op.drop_column("contract", "archived_by_id")
    op.drop_column("contract", "archived_at")
    op.drop_column("contract", "termination_reason")
    op.drop_column("contract", "terminated_by_id")
    op.drop_column("contract", "terminated_at")
    op.drop_column("contract", "activated_notes")
    op.drop_column("contract", "activated_by_id")
    op.drop_column("contract", "activated_at")
    op.drop_column("contract", "deletion_reason")
    op.drop_column("contract", "deleted_by_id")
    op.drop_column("contract", "deleted_at")
    op.drop_column("contract", "is_deleted")
    op.drop_foreign_key("fk_contract_deleted_by", "contract")
    op.drop_foreign_key("fk_contract_activated_by", "contract")
    op.drop_foreign_key("fk_contract_terminated_by", "contract")
    op.drop_foreign_key("fk_contract_archived_by", "contract")
