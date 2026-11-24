"""add_performance_indexes_to_models

Revision ID: 426978620218
Revises: 3561e53325e5
Create Date: 2026-08-07 12:50:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = '426978620218'
down_revision = '3561e53325e5'
branch_labels = None
depends_on = None


def safe_create_index(name, table, columns, unique=False):
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    if not inspector.has_table(table):
        return
    table_cols = [c['name'] for c in inspector.get_columns(table)]
    for col in columns:
        if col not in table_cols:
            return
    existing_indexes = [idx['name'] for idx in inspector.get_indexes(table)]
    if name not in existing_indexes:
        op.create_index(name, table, columns, unique=unique)


def safe_drop_index(name, table):
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    if not inspector.has_table(table):
        return
    existing_indexes = [idx['name'] for idx in inspector.get_indexes(table)]
    if name in existing_indexes:
        op.drop_index(name, table_name=table)


def upgrade():
    # Contract indexes
    safe_create_index(op.f('ix_contract_customer_id'), 'contract', ['customer_id'], unique=False)
    safe_create_index(op.f('ix_contract_contract_type_id'), 'contract', ['contract_type_id'], unique=False)
    safe_create_index(op.f('ix_contract_parent_contract_id'), 'contract', ['parent_contract_id'], unique=False)
    safe_create_index(op.f('ix_contract_created_at'), 'contract', ['created_at'], unique=False)

    # ContactPerson indexes
    safe_create_index(op.f('ix_contact_person_user_id'), 'contact_person', ['user_id'], unique=False)
    safe_create_index(op.f('ix_contact_person_customer_id'), 'contact_person', ['customer_id'], unique=False)

    # ContractLineItem indexes
    safe_create_index(op.f('ix_contract_line_item_product_id'), 'contract_line_item', ['product_id'], unique=False)

    # PurchaseOrder indexes
    safe_create_index(op.f('ix_purchase_order_customer_id'), 'purchase_order', ['customer_id'], unique=False)
    safe_create_index(op.f('ix_purchase_order_created_at'), 'purchase_order', ['created_at'], unique=False)
    safe_create_index(op.f('ix_purchase_order_po_date'), 'purchase_order', ['po_date'], unique=False)

    # Invoice indexes
    safe_create_index(op.f('ix_invoice_customer_id'), 'invoice', ['customer_id'], unique=False)
    safe_create_index(op.f('ix_invoice_due_date'), 'invoice', ['due_date'], unique=False)
    safe_create_index(op.f('ix_invoice_created_at'), 'invoice', ['created_at'], unique=False)

    # InvoiceLineItem indexes
    safe_create_index(op.f('ix_invoice_line_item_invoice_id'), 'invoice_line_item', ['invoice_id'], unique=False)

    # Task indexes
    safe_create_index(op.f('ix_task_user_id'), 'task', ['user_id'], unique=False)
    safe_create_index(op.f('ix_task_assigned_to'), 'task', ['assigned_to'], unique=False)
    safe_create_index(op.f('ix_task_status'), 'task', ['status'], unique=False)
    safe_create_index(op.f('ix_task_due_date'), 'task', ['due_date'], unique=False)

    # Task sub-entity indexes
    safe_create_index(op.f('ix_task_comment_task_id'), 'task_comment', ['task_id'], unique=False)
    safe_create_index(op.f('ix_task_attachment_task_id'), 'task_attachment', ['task_id'], unique=False)
    safe_create_index(op.f('ix_task_history_task_id'), 'task_history', ['task_id'], unique=False)

    # CalendarEvent indexes
    safe_create_index(op.f('ix_calendar_event_user_id'), 'calendar_event', ['user_id'], unique=False)
    safe_create_index(op.f('ix_calendar_event_start'), 'calendar_event', ['start'], unique=False)

    # Workflow sub-entity indexes
    safe_create_index(op.f('ix_workflow_stage_workflow_id'), 'workflow_stage', ['workflow_id'], unique=False)
    safe_create_index(op.f('ix_workflow_rule_workflow_id'), 'workflow_rule', ['workflow_id'], unique=False)

    # ContractApproval indexes
    safe_create_index(op.f('ix_contract_approval_requested_by'), 'contract_approval', ['requested_by'], unique=False)
    safe_create_index(op.f('ix_contract_approval_approver_id'), 'contract_approval', ['approver_id'], unique=False)


def downgrade():
    safe_drop_index(op.f('ix_contract_approval_approver_id'), 'contract_approval')
    safe_drop_index(op.f('ix_contract_approval_requested_by'), 'contract_approval')
    safe_drop_index(op.f('ix_workflow_rule_workflow_id'), 'workflow_rule')
    safe_drop_index(op.f('ix_workflow_stage_workflow_id'), 'workflow_stage')
    safe_drop_index(op.f('ix_calendar_event_start'), 'calendar_event')
    safe_drop_index(op.f('ix_calendar_event_user_id'), 'calendar_event')
    safe_drop_index(op.f('ix_task_history_task_id'), 'task_history')
    safe_drop_index(op.f('ix_task_attachment_task_id'), 'task_attachment')
    safe_drop_index(op.f('ix_task_comment_task_id'), 'task_comment')
    safe_drop_index(op.f('ix_task_due_date'), 'task')
    safe_drop_index(op.f('ix_task_status'), 'task')
    safe_drop_index(op.f('ix_task_assigned_to'), 'task')
    safe_drop_index(op.f('ix_task_user_id'), 'task')
    safe_drop_index(op.f('ix_invoice_line_item_invoice_id'), 'invoice_line_item')
    safe_drop_index(op.f('ix_invoice_created_at'), 'invoice')
    safe_drop_index(op.f('ix_invoice_due_date'), 'invoice')
    safe_drop_index(op.f('ix_invoice_customer_id'), 'invoice')
    safe_drop_index(op.f('ix_purchase_order_po_date'), 'purchase_order')
    safe_drop_index(op.f('ix_purchase_order_created_at'), 'purchase_order')
    safe_drop_index(op.f('ix_purchase_order_customer_id'), 'purchase_order')
    safe_drop_index(op.f('ix_contract_line_item_product_id'), 'contract_line_item')
    safe_drop_index(op.f('ix_contact_person_customer_id'), 'contact_person')
    safe_drop_index(op.f('ix_contact_person_user_id'), 'contact_person')
    safe_drop_index(op.f('ix_contract_created_at'), 'contract')
    safe_drop_index(op.f('ix_contract_parent_contract_id'), 'contract')
    safe_drop_index(op.f('ix_contract_contract_type_id'), 'contract')
    safe_drop_index(op.f('ix_contract_customer_id'), 'contract')
