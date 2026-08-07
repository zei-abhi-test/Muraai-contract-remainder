"""add_indexes_to_contract_and_notification_models

Revision ID: 6473aec2da01
Revises: 20260722_0014
Create Date: 2026-08-07 10:00:14.532970
"""

from alembic import op
import sqlalchemy as sa



revision = '6473aec2da01'
down_revision = '20260722_0014'
branch_labels = None
depends_on = None


def upgrade():
    # Indexes on Contract table
    op.create_index(op.f('ix_contract_user_id'), 'contract', ['user_id'], unique=False)
    op.create_index(op.f('ix_contract_status'), 'contract', ['status'], unique=False)
    op.create_index(op.f('ix_contract_end_date'), 'contract', ['end_date'], unique=False)
    op.create_index(op.f('ix_contract_start_date'), 'contract', ['start_date'], unique=False)
    op.create_index(op.f('ix_contract_renewal_date'), 'contract', ['renewal_date'], unique=False)

    # Indexes on Notification table
    op.create_index(op.f('ix_notification_contract_id'), 'notification', ['contract_id'], unique=False)
    op.create_index(op.f('ix_notification_status'), 'notification', ['status'], unique=False)
    op.create_index(op.f('ix_notification_send_date'), 'notification', ['send_date'], unique=False)

    # Indexes on Contract sub-entities
    op.create_index(op.f('ix_contract_line_item_contract_id'), 'contract_line_item', ['contract_id'], unique=False)
    op.create_index(op.f('ix_contract_document_contract_id'), 'contract_document', ['contract_id'], unique=False)
    op.create_index(op.f('ix_contract_approval_contract_id'), 'contract_approval', ['contract_id'], unique=False)
    op.create_index(op.f('ix_contract_approval_status'), 'contract_approval', ['status'], unique=False)

    # Indexes on related user-scoped domain models
    op.create_index(op.f('ix_activity_log_user_id'), 'activity_log', ['user_id'], unique=False)
    op.create_index(op.f('ix_activity_log_contract_id'), 'activity_log', ['contract_id'], unique=False)
    op.create_index(op.f('ix_invoice_user_id'), 'invoice', ['user_id'], unique=False)
    op.create_index(op.f('ix_invoice_contract_id'), 'invoice', ['contract_id'], unique=False)
    op.create_index(op.f('ix_invoice_status'), 'invoice', ['status'], unique=False)
    op.create_index(op.f('ix_purchase_order_user_id'), 'purchase_order', ['user_id'], unique=False)
    op.create_index(op.f('ix_purchase_order_status'), 'purchase_order', ['status'], unique=False)
    op.create_index(op.f('ix_customer_user_id'), 'customer', ['user_id'], unique=False)
    op.create_index(op.f('ix_product_user_id'), 'product', ['user_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_product_user_id'), table_name='product')
    op.drop_index(op.f('ix_customer_user_id'), table_name='customer')
    op.drop_index(op.f('ix_purchase_order_status'), table_name='purchase_order')
    op.drop_index(op.f('ix_purchase_order_user_id'), table_name='purchase_order')
    op.drop_index(op.f('ix_invoice_status'), table_name='invoice')
    op.drop_index(op.f('ix_invoice_contract_id'), table_name='invoice')
    op.drop_index(op.f('ix_invoice_user_id'), table_name='invoice')
    op.drop_index(op.f('ix_activity_log_contract_id'), table_name='activity_log')
    op.drop_index(op.f('ix_activity_log_user_id'), table_name='activity_log')
    op.drop_index(op.f('ix_contract_approval_status'), table_name='contract_approval')
    op.drop_index(op.f('ix_contract_approval_contract_id'), table_name='contract_approval')
    op.drop_index(op.f('ix_contract_document_contract_id'), table_name='contract_document')
    op.drop_index(op.f('ix_contract_line_item_contract_id'), table_name='contract_line_item')
    op.drop_index(op.f('ix_notification_send_date'), table_name='notification')
    op.drop_index(op.f('ix_notification_status'), table_name='notification')
    op.drop_index(op.f('ix_notification_contract_id'), table_name='notification')
    op.drop_index(op.f('ix_contract_renewal_date'), table_name='contract')
    op.drop_index(op.f('ix_contract_start_date'), table_name='contract')
    op.drop_index(op.f('ix_contract_end_date'), table_name='contract')
    op.drop_index(op.f('ix_contract_status'), table_name='contract')
    op.drop_index(op.f('ix_contract_user_id'), table_name='contract')
