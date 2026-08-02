"""add user profile fields: name, phone, avatar_url, role, status, last_login

Revision ID: 20260714_0008
Revises: 20260713_0007
Create Date: 2026-07-14
"""

from alembic import op
import sqlalchemy as sa


revision = "20260714_0008"
down_revision = "20260713_0007"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Add name (nullable) — backfill with username for existing rows
    op.add_column("user", sa.Column("name", sa.String(length=200), nullable=True))
    conn.execute(sa.text("UPDATE \"user\" SET name = username WHERE name IS NULL"))
    op.alter_column("user", "name", nullable=True)

    # Add phone (nullable)
    op.add_column("user", sa.Column("phone", sa.String(length=50), nullable=True))

    # Add avatar_url (nullable)
    op.add_column("user", sa.Column("avatar_url", sa.String(length=500), nullable=True))

    # Add role (VARCHAR(30), default VIEWER) — backfill existing as CONTRACT_MANAGER
    op.add_column("user", sa.Column("role", sa.String(length=30), nullable=True))
    conn.execute(sa.text("UPDATE \"user\" SET role = 'CONTRACT_MANAGER' WHERE role IS NULL"))
    op.alter_column("user", "role", nullable=False, server_default=sa.text("'VIEWER'"))

    # Add status (VARCHAR(20), default active)
    op.add_column("user", sa.Column("status", sa.String(length=20), nullable=True))
    conn.execute(sa.text("UPDATE \"user\" SET status = 'active' WHERE status IS NULL"))
    op.alter_column("user", "status", nullable=False, server_default=sa.text("'active'"))

    # Add last_login (nullable)
    op.add_column("user", sa.Column("last_login", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("user", "last_login")
    op.drop_column("user", "status")
    op.drop_column("user", "role")
    op.drop_column("user", "avatar_url")
    op.drop_column("user", "phone")
    op.drop_column("user", "name")
