"""add sku and description to product

Revision ID: 20260712_0003
Revises: 20260706_0002
Create Date: 2026-07-12

"""
from alembic import op
import sqlalchemy as sa


revision = "20260712_0003"
down_revision = "20260706_0002"
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns to product table
    op.add_column('product', sa.Column('sku', sa.String(length=100), nullable=False))
    op.add_column('product', sa.Column('price', sa.Numeric(10, 2), nullable=True))
    op.add_column('product', sa.Column('description', sa.Text(), nullable=True))
    
    # Create unique constraint on sku
    op.create_unique_constraint('uq_product_sku', 'product', ['sku'])
    
    # Generate SKU for existing products
    # Note: This is a simple migration - in production, you might want to generate proper SKUs
    from sqlalchemy import text
    connection = op.get_bind()
    
    # For existing products, generate SKU in format SKU-GEN-MUR-2026-{sequence}
    connection.execute(text("""
        UPDATE product 
        SET sku = 'SKU-GEN-MUR-2026-' || LPAD(id::text, 6, '0')
        WHERE sku IS NULL OR sku = ''
    """))
    
    # Make sku NOT NULL after populating
    op.alter_column('product', 'sku', nullable=False)


def downgrade():
    # Remove unique constraint
    op.drop_constraint('uq_product_sku', 'product', type_='unique')
    
    # Remove columns
    op.drop_column('product', 'description')
    op.drop_column('product', 'price')
    op.drop_column('product', 'sku')
