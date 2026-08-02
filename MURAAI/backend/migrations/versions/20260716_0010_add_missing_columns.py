"""add missing columns to align with SQLAlchemy models

Revision ID: 20260716_0010
Revises: 20260715_0009
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa


revision = "20260716_0010"
down_revision = "20260715_0009"
branch_labels = None
depends_on = None


def upgrade():
    # contract_document - add missing columns
    op.add_column("contract_document", sa.Column("invoice_id", sa.Integer(), nullable=True))
    op.add_column("contract_document", sa.Column("po_id", sa.Integer(), nullable=True))
    op.add_column("contract_document", sa.Column("file_size", sa.BigInteger(), nullable=True, default=0))
    op.add_column("contract_document", sa.Column("file_type", sa.String(length=20), nullable=True))
    op.add_column("contract_document", sa.Column("category", sa.String(length=100), nullable=True))
    op.add_column("contract_document", sa.Column("storage_provider", sa.String(length=50), nullable=True, default="local"))
    op.add_column("contract_document", sa.Column("storage_reference", sa.String(length=500), nullable=True))
    op.add_column("contract_document", sa.Column("version_group_id", sa.String(length=36), nullable=True))
    op.add_column("contract_document", sa.Column("version", sa.Integer(), nullable=True, default=1))
    op.add_column("contract_document", sa.Column("is_latest_version", sa.Boolean(), nullable=True, default=True))
    op.add_column("contract_document", sa.Column("created_at", sa.DateTime(), nullable=True))
    op.add_column("contract_document", sa.Column("updated_at", sa.DateTime(), nullable=True))

    # Add foreign keys for invoice_id and po_id
    op.create_foreign_key(
        "fk_contract_document_invoice", "contract_document", "invoice",
        ["invoice_id"], ["id"]
    )
    op.create_foreign_key(
        "fk_contract_document_purchase_order", "contract_document", "purchase_order",
        ["po_id"], ["id"]
    )

    # contract_approval - add missing columns
    op.add_column("contract_approval", sa.Column("requested_by", sa.Integer(), nullable=True))
    op.add_column("contract_approval", sa.Column("approval_level", sa.Integer(), nullable=True, default=1))
    op.add_column("contract_approval", sa.Column("workflow_assignment_id", sa.Integer(), nullable=True))
    op.add_column("contract_approval", sa.Column("cancelled_at", sa.DateTime(), nullable=True))

    # Add foreign key for requested_by and workflow_assignment_id
    op.create_foreign_key(
        "fk_contract_approval_requested_by", "contract_approval", "user",
        ["requested_by"], ["id"]
    )
    op.create_foreign_key(
        "fk_contract_approval_workflow_assignment", "contract_approval", "workflow_assignment",
        ["workflow_assignment_id"], ["id"]
    )

    # purchase_order - add missing columns
    op.add_column("purchase_order", sa.Column("issue_date", sa.Date(), nullable=True))
    op.add_column("purchase_order", sa.Column("expected_delivery", sa.Date(), nullable=True))
    op.add_column("purchase_order", sa.Column("currency", sa.String(length=10), nullable=True, default="INR"))
    op.add_column("purchase_order", sa.Column("remarks", sa.Text(), nullable=True))

    # invoice - add missing columns
    op.add_column("invoice", sa.Column("purchase_order_id", sa.Integer(), nullable=True))
    op.add_column("invoice", sa.Column("tax", sa.Numeric(14, 2), nullable=True, default=0))
    op.add_column("invoice", sa.Column("discount", sa.Numeric(14, 2), nullable=True, default=0))
    op.add_column("invoice", sa.Column("total", sa.Numeric(14, 2), nullable=True, default=0))
    op.add_column("invoice", sa.Column("currency", sa.String(length=10), nullable=True, default="INR"))
    op.add_column("invoice", sa.Column("paid_date", sa.Date(), nullable=True))
    op.add_column("invoice", sa.Column("remarks", sa.Text(), nullable=True))
    op.add_column("invoice", sa.Column("created_by", sa.Integer(), nullable=True))

    # Add foreign key for purchase_order_id and created_by
    op.create_foreign_key(
        "fk_invoice_purchase_order", "invoice", "purchase_order",
        ["purchase_order_id"], ["id"]
    )
    op.create_foreign_key(
        "fk_invoice_created_by", "invoice", "user",
        ["created_by"], ["id"]
    )

    # task - add missing columns
    op.add_column("task", sa.Column("assigned_to", sa.Integer(), nullable=True))
    op.add_column("task", sa.Column("assigned_by", sa.Integer(), nullable=True))
    op.add_column("task", sa.Column("related_module", sa.String(length=50), nullable=True))
    op.add_column("task", sa.Column("related_record_id", sa.Integer(), nullable=True))

    # Add foreign keys for task
    op.create_foreign_key(
        "fk_task_assigned_to", "task", "user",
        ["assigned_to"], ["id"]
    )
    op.create_foreign_key(
        "fk_task_assigned_by", "task", "user",
        ["assigned_by"], ["id"]
    )

    # task_attachment - fix file_size type from INTEGER to BIGINT
    op.alter_column("task_attachment", "file_size",
                    existing_type=sa.Integer(),
                    type_=sa.BigInteger(),
                    existing_nullable=True)


def downgrade():
    # task_attachment - revert file_size
    op.alter_column("task_attachment", "file_size",
                    existing_type=sa.BigInteger(),
                    type_=sa.Integer(),
                    existing_nullable=True)

    # task - drop foreign keys and columns
    op.drop_constraint("fk_task_assigned_by", "task", type_="foreignkey")
    op.drop_constraint("fk_task_assigned_to", "task", type_="foreignkey")
    op.drop_column("task", "related_record_id")
    op.drop_column("task", "related_module")
    op.drop_column("task", "assigned_by")
    op.drop_column("task", "assigned_to")

    # invoice - drop foreign keys and columns
    op.drop_constraint("fk_invoice_created_by", "invoice", type_="foreignkey")
    op.drop_constraint("fk_invoice_purchase_order", "invoice", type_="foreignkey")
    op.drop_column("invoice", "created_by")
    op.drop_column("invoice", "remarks")
    op.drop_column("invoice", "paid_date")
    op.drop_column("invoice", "currency")
    op.drop_column("invoice", "total")
    op.drop_column("invoice", "discount")
    op.drop_column("invoice", "tax")
    op.drop_column("invoice", "purchase_order_id")

    # purchase_order - drop columns
    op.drop_column("purchase_order", "remarks")
    op.drop_column("purchase_order", "currency")
    op.drop_column("purchase_order", "expected_delivery")
    op.drop_column("purchase_order", "issue_date")

    # contract_approval - drop foreign keys and columns
    op.drop_constraint("fk_contract_approval_workflow_assignment", "contract_approval", type_="foreignkey")
    op.drop_constraint("fk_contract_approval_requested_by", "contract_approval", type_="foreignkey")
    op.drop_column("contract_approval", "cancelled_at")
    op.drop_column("contract_approval", "workflow_assignment_id")
    op.drop_column("contract_approval", "approval_level")
    op.drop_column("contract_approval", "requested_by")

    # contract_document - drop foreign keys and columns
    op.drop_constraint("fk_contract_document_purchase_order", "contract_document", type_="foreignkey")
    op.drop_constraint("fk_contract_document_invoice", "contract_document", type_="foreignkey")
    op.drop_column("contract_document", "updated_at")
    op.drop_column("contract_document", "created_at")
    op.drop_column("contract_document", "is_latest_version")
    op.drop_column("contract_document", "version")
    op.drop_column("contract_document", "version_group_id")
    op.drop_column("contract_document", "storage_reference")
    op.drop_column("contract_document", "storage_provider")
    op.drop_column("contract_document", "category")
    op.drop_column("contract_document", "file_type")
    op.drop_column("contract_document", "file_size")
    op.drop_column("contract_document", "po_id")
    op.drop_column("contract_document", "invoice_id")