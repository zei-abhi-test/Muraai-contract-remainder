"""approval workflow, purchase orders, invoices, global sku sequence

Revision ID: 20260713_0007
Revises: 20260712_0006
Create Date: 2026-07-13

Adds the tables required to complete the contract lifecycle workflow:

- contract_approval: backs the Approvals workspace (submit/approve/reject).
- purchase_order / purchase_order_contract: minimal Purchase Order module,
  with a proper many-to-many association table (never comma-separated IDs).
- invoice: minimal Invoice module.
- sku_counter: global, transaction-safe sequence counter used to fix the
  Product SKU collision bug (SKU is globally unique, so the sequence must
  be allocated globally too, not per-user).
"""
from alembic import op
import sqlalchemy as sa


revision = "20260713_0007"
down_revision = "20260712_0006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "contract_approval",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("contract_id", sa.Integer(), nullable=False),
        sa.Column("approver_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="Pending"),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("rejected_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["contract_id"], ["contract.id"]),
        sa.ForeignKeyConstraint(["approver_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "purchase_order",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("po_number", sa.String(length=80), nullable=False),
        sa.Column("po_date", sa.Date(), nullable=False),
        sa.Column("vendor", sa.String(length=200), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="Draft"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customer.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("po_number", name="uq_purchase_order_number"),
    )

    op.create_table(
        "purchase_order_contract",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("purchase_order_id", sa.Integer(), nullable=False),
        sa.Column("contract_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["purchase_order_id"], ["purchase_order.id"]),
        sa.ForeignKeyConstraint(["contract_id"], ["contract.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("purchase_order_id", "contract_id", name="uq_po_contract"),
    )

    op.create_table(
        "invoice",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("invoice_number", sa.String(length=80), nullable=False),
        sa.Column("contract_id", sa.Integer(), nullable=True),
        sa.Column("customer_id", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("invoice_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="DRAFT"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["contract_id"], ["contract.id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["customer.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invoice_number", name="uq_invoice_number"),
    )

    op.create_table(
        "sku_counter",
        sa.Column("prefix", sa.String(length=100), nullable=False),
        sa.Column("next_value", sa.Integer(), nullable=False, server_default="1"),
        sa.PrimaryKeyConstraint("prefix"),
    )


def downgrade():
    op.drop_table("sku_counter")
    op.drop_table("invoice")
    op.drop_table("purchase_order_contract")
    op.drop_table("purchase_order")
    op.drop_table("contract_approval")
