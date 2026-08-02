"""add contract type and contract_type_id to contract

Revision ID: 20260712_0004
Revises: 20260712_0003
Create Date: 2026-07-12

"""
from alembic import op
import sqlalchemy as sa


revision = "20260712_0004"
down_revision = "20260712_0003"
branch_labels = None
depends_on = None


def upgrade():
    # Create contract_type table
    op.create_table(
        "contract_type",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    
    # Add contract_type_id to contract table
    op.add_column('contract', sa.Column('contract_type_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_contract_contract_type', 'contract', 'contract_type', ['contract_type_id'], ['id'])
    
    # Insert default contract types
    from sqlalchemy import text
    connection = op.get_bind()
    
    default_types = [
        ('New Contract', 'Standard new contract', 'active'),
        ('Renewal Contract', 'Contract renewal', 'active'),
        ('AMC', 'Annual Maintenance Contract', 'active'),
        ('Support Contract', 'Technical support contract', 'active'),
        ('Subscription', 'Subscription-based contract', 'active'),
        ('License', 'Software license contract', 'active'),
        ('Service Contract', 'Service-based contract', 'active'),
        ('Purchase Contract', 'Purchase agreement', 'active'),
        ('Custom', 'Custom contract type', 'active'),
    ]
    
    for name, description, status in default_types:
        connection.execute(text("""
            INSERT INTO contract_type (name, description, status, created_at, updated_at)
            VALUES (:name, :description, :status, NOW(), NOW())
        """), {"name": name, "description": description, "status": status})


def downgrade():
    # Remove foreign key and column
    op.drop_constraint('fk_contract_contract_type', 'contract', type_='foreignkey')
    op.drop_column('contract', 'contract_type_id')
    
    # Drop contract_type table
    op.drop_table('contract_type')
