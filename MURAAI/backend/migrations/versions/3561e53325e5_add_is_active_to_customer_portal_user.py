"""add_is_active_to_customer_portal_user

Revision ID: 3561e53325e5
Revises: 6473aec2da01
Create Date: 2026-08-07 11:10:53.367528
"""

from alembic import op
import sqlalchemy as sa


revision = '3561e53325e5'
down_revision = '6473aec2da01'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'customer_portal_user',
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1')
    )


def downgrade():
    op.drop_column('customer_portal_user', 'is_active')
