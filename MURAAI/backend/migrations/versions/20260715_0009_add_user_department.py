"""add department column to user table

Revision ID: 20260715_0009
Revises: 20260714_0008
Create Date: 2026-07-15
"""
from alembic import op
import sqlalchemy as sa


revision = "20260715_0009"
down_revision = "20260714_0008"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("user", sa.Column("department", sa.String(length=100), nullable=True))


def downgrade():
    op.drop_column("user", "department")
