"""update contract line item with discount, tax, and product reference

Revision ID: 20260712_0005
Revises: 20260712_0004
Create Date: 2026-07-12

"""
from alembic import op
import sqlalchemy as sa


revision = "20260712_0005"
down_revision = "20260712_0004"
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns to contract_line_item
    op.add_column('contract_line_item', sa.Column('product_id', sa.Integer(), nullable=True))
    op.add_column('contract_line_item', sa.Column('sku', sa.String(length=100), nullable=True))
    op.add_column('contract_line_item', sa.Column('product_name', sa.String(length=200), nullable=True))
    op.add_column('contract_line_item', sa.Column('discount', sa.Numeric(5, 2), nullable=False, server_default='0'))
    op.add_column('contract_line_item', sa.Column('tax', sa.Numeric(5, 2), nullable=False, server_default='0'))
    op.add_column('contract_line_item', sa.Column('line_total', sa.Numeric(14, 2), nullable=False, server_default='0'))
    
    # Create foreign key to product
    op.create_foreign_key('fk_contract_line_item_product', 'contract_line_item', 'product', ['product_id'], ['id'])
    
    # Migrate existing data: copy product string to product_name
    from sqlalchemy import text
    connection = op.get_bind()
    
    connection.execute(text("""
        UPDATE contract_line_item 
        SET product_name = product,
            discount = 0,
            tax = 0,
            line_total = amount
        WHERE product_name IS NULL OR product_name = ''
    """))
    
    # Make product_name NOT NULL after migration
    op.alter_column('contract_line_item', 'product_name', nullable=False)


def downgrade():
    # Remove foreign key
    op.drop_constraint('fk_contract_line_item_product', 'contract_line_item', type_='foreignkey')
    
    # Remove columns
    op.drop_column('contract_line_item', 'line_total')
    op.drop_column('contract_line_item', 'tax')
    op.drop_column('contract_line_item', 'discount')
    op.drop_column('contract_line_item', 'product_name')
    op.drop_column('contract_line_item', 'sku')
    op.drop_column('contract_line_item', 'product_id')
