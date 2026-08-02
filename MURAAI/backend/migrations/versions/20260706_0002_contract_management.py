"""contract management entities

Revision ID: 20260706_0002
Revises: 20260527_0001
Create Date: 2026-07-06
"""

from alembic import op
import sqlalchemy as sa


revision = "20260706_0002"
down_revision = "20260527_0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "customer",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("customer_code", sa.String(length=80), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=120), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "contact_person",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("contact_name", sa.String(length=200), nullable=False),
        sa.Column("contact_number", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=120), nullable=True),
        sa.Column("designation", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customer.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("contract") as batch_op:
        batch_op.add_column(sa.Column("contract_number", sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column("customer_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("contact_person_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("contract_date", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("status", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("currency", sa.String(length=10), nullable=True))
        batch_op.add_column(sa.Column("payment_terms", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("remarks", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("total_contract_value", sa.Numeric(14, 2), nullable=True))
        batch_op.add_column(sa.Column("contract_version", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("parent_contract_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("previous_contract_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("created_by_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("last_modified_by_id", sa.Integer(), nullable=True))
        batch_op.create_unique_constraint("uq_contract_contract_number", ["contract_number"])
        batch_op.create_foreign_key("fk_contract_customer", "customer", ["customer_id"], ["id"])
        batch_op.create_foreign_key(
            "fk_contract_contact_person",
            "contact_person",
            ["contact_person_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "fk_contract_parent",
            "contract",
            ["parent_contract_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "fk_contract_previous",
            "contract",
            ["previous_contract_id"],
            ["id"],
        )
        batch_op.create_foreign_key("fk_contract_created_by", "user", ["created_by_id"], ["id"])
        batch_op.create_foreign_key(
            "fk_contract_modified_by",
            "user",
            ["last_modified_by_id"],
            ["id"],
        )

    op.create_table(
        "contract_line_item",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("contract_id", sa.Integer(), nullable=False),
        sa.Column("product", sa.String(length=200), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 2), nullable=False),
        sa.Column("rate", sa.Numeric(14, 2), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["contract_id"], ["contract.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "contract_document",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("contract_id", sa.Integer(), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("stored_file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(), nullable=True),
        sa.Column("uploaded_by_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["contract_id"], ["contract.id"]),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "contract_renewal",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("original_contract_id", sa.Integer(), nullable=False),
        sa.Column("parent_contract_id", sa.Integer(), nullable=False),
        sa.Column("previous_contract_id", sa.Integer(), nullable=False),
        sa.Column("new_contract_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["original_contract_id"], ["contract.id"]),
        sa.ForeignKeyConstraint(["parent_contract_id"], ["contract.id"]),
        sa.ForeignKeyConstraint(["previous_contract_id"], ["contract.id"]),
        sa.ForeignKeyConstraint(["new_contract_id"], ["contract.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    op.drop_table("contract_renewal")
    op.drop_table("contract_document")
    op.drop_table("contract_line_item")
    with op.batch_alter_table("contract") as batch_op:
        batch_op.drop_constraint("fk_contract_modified_by", type_="foreignkey")
        batch_op.drop_constraint("fk_contract_created_by", type_="foreignkey")
        batch_op.drop_constraint("fk_contract_previous", type_="foreignkey")
        batch_op.drop_constraint("fk_contract_parent", type_="foreignkey")
        batch_op.drop_constraint("fk_contract_contact_person", type_="foreignkey")
        batch_op.drop_constraint("fk_contract_customer", type_="foreignkey")
        batch_op.drop_constraint("uq_contract_contract_number", type_="unique")
        for column in [
            "last_modified_by_id",
            "created_by_id",
            "previous_contract_id",
            "parent_contract_id",
            "contract_version",
            "total_contract_value",
            "remarks",
            "payment_terms",
            "currency",
            "status",
            "contract_date",
            "contact_person_id",
            "customer_id",
            "contract_number",
        ]:
            batch_op.drop_column(column)
    op.drop_table("contact_person")
    op.drop_table("customer")
