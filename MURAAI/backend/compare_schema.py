import sys
sys.path.insert(0, '.')
from sqlalchemy import inspect, create_engine
from alembic.config import Config

config = Config('alembic.ini')
url = config.get_main_option('sqlalchemy.url')
engine = create_engine(url)
inspector = inspect(engine)

# Model definitions (from SQLAlchemy models)
models = {
    'user': [
        ('id', 'INTEGER', False, "nextval('user_id_seq'::regclass)"),
        ('username', 'VARCHAR(80)', False, None),
        ('email', 'VARCHAR(120)', False, None),
        ('password_hash', 'VARCHAR(255)', False, None),
        ('name', 'VARCHAR(200)', True, None),
        ('phone', 'VARCHAR(50)', True, None),
        ('department', 'VARCHAR(100)', True, None),
        ('avatar_url', 'VARCHAR(500)', True, None),
        ('role', 'VARCHAR(30)', False, "'VIEWER'::character varying"),
        ('status', 'VARCHAR(20)', False, "'active'::character varying"),
        ('last_login', 'TIMESTAMP', True, None),
        ('created_at', 'TIMESTAMP', False, None),
        ('updated_at', 'TIMESTAMP', False, None),
    ],
    'organization': [
        ('id', 'INTEGER', False, "nextval('organization_id_seq'::regclass)"),
        ('user_id', 'INTEGER', False, None),
        ('company_name', 'VARCHAR(200)', True, None),
        ('address', 'TEXT', True, None),
        ('logo_url', 'VARCHAR(500)', True, None),
        ('default_currency', 'VARCHAR(10)', True, None),  # model has default='USD'
        ('timezone', 'VARCHAR(50)', True, None),  # model has default='UTC'
        ('fiscal_year', 'VARCHAR(20)', True, None),
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
    ],
    'user_preference': [
        ('id', 'INTEGER', False, "nextval('user_preference_id_seq'::regclass)"),
        ('user_id', 'INTEGER', False, None),
        ('notification_email', 'BOOLEAN', True, None),  # model has default=True
        ('notification_push', 'BOOLEAN', True, None),  # model has default=True
        ('reminder_days', 'INTEGER', True, None),  # model has default=7
        ('invoice_reminder_days', 'INTEGER', True, None),  # model has default=7
        ('approval_notifications', 'BOOLEAN', True, None),  # model has default=True
        ('default_contract_type_id', 'INTEGER', True, None),
        ('default_renewal_period_days', 'INTEGER', True, None),  # model has default=365
        ('default_payment_terms', 'VARCHAR(100)', True, None),  # model has default='Net 30'
        ('theme', 'VARCHAR(20)', True, None),  # model has default='system'
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
    ],
    'integration_config': [
        ('id', 'INTEGER', False, "nextval('integration_config_id_seq'::regclass)"),
        ('user_id', 'INTEGER', False, None),
        ('provider', 'VARCHAR(50)', False, None),
        ('config_json', 'TEXT', True, None),
        ('enabled', 'BOOLEAN', True, None),  # model has default=False
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
    ],
    'role': [
        ('id', 'INTEGER', False, "nextval('role_id_seq'::regclass)"),
        ('name', 'VARCHAR(80)', False, None),
        ('description', 'VARCHAR(255)', True, None),
        ('permissions', 'TEXT', True, None),
        ('created_at', 'TIMESTAMP', True, None),
    ],
    'login_history': [
        ('id', 'INTEGER', False, "nextval('login_history_id_seq'::regclass)"),
        ('user_id', 'INTEGER', False, None),
        ('ip_address', 'VARCHAR(50)', True, None),
        ('user_agent', 'VARCHAR(500)', True, None),
        ('created_at', 'TIMESTAMP', True, None),
    ],
    'role_assignment': [
        ('id', 'INTEGER', False, "nextval('role_assignment_id_seq'::regclass)"),
        ('user_id', 'INTEGER', False, None),
        ('role_id', 'INTEGER', False, None),
        ('created_at', 'TIMESTAMP', True, None),
    ],
    'contract_type': [
        ('id', 'INTEGER', False, "nextval('contract_type_id_seq'::regclass)"),
        ('name', 'VARCHAR(200)', False, None),
        ('description', 'TEXT', True, None),
        ('status', 'VARCHAR(50)', True, None),  # model has default='active'
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
    ],
    'customer': [
        ('id', 'INTEGER', False, "nextval('customer_id_seq'::regclass)"),
        ('name', 'VARCHAR(200)', False, None),
        ('customer_code', 'VARCHAR(80)', True, None),
        ('phone', 'VARCHAR(50)', True, None),
        ('email', 'VARCHAR(120)', True, None),
        ('address', 'TEXT', True, None),
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
        ('user_id', 'INTEGER', False, None),
    ],
    'contact_person': [
        ('id', 'INTEGER', False, "nextval('contact_person_id_seq'::regclass)"),
        ('customer_id', 'INTEGER', False, None),
        ('contact_name', 'VARCHAR(200)', False, None),
        ('contact_number', 'VARCHAR(50)', False, None),
        ('email', 'VARCHAR(120)', True, None),
        ('designation', 'VARCHAR(120)', True, None),
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
        ('user_id', 'INTEGER', False, None),
    ],
    'contract': [
        ('id', 'INTEGER', False, "nextval('contract_id_seq'::regclass)"),
        ('company_name', 'VARCHAR(200)', False, None),
        ('contract_name', 'VARCHAR(200)', False, None),
        ('start_date', 'DATE', False, None),
        ('end_date', 'DATE', False, None),
        ('renewal_date', 'DATE', False, None),
        ('notification_enabled', 'BOOLEAN', True, None),  # model has default=True
        ('notification_email', 'VARCHAR(120)', True, None),
        ('notification_mobile', 'BOOLEAN', True, None),  # model has default=False
        ('notes', 'TEXT', True, None),
        ('contract_number', 'VARCHAR(80)', True, None),
        ('customer_id', 'INTEGER', True, None),
        ('contact_person_id', 'INTEGER', True, None),
        ('contract_type_id', 'INTEGER', True, None),
        ('contract_date', 'DATE', True, None),
        ('status', 'VARCHAR(50)', True, "'Active'::character varying"),  # model default='Active'
        ('currency', 'VARCHAR(10)', True, "'INR'::character varying"),  # model default='INR'
        ('payment_terms', 'TEXT', True, None),
        ('remarks', 'TEXT', True, None),
        ('total_contract_value', 'NUMERIC(14, 2)', True, '0'),  # model default=0
        ('contract_version', 'INTEGER', True, '1'),  # model default=1
        ('parent_contract_id', 'INTEGER', True, None),
        ('previous_contract_id', 'INTEGER', True, None),
        ('created_by_id', 'INTEGER', True, None),
        ('last_modified_by_id', 'INTEGER', True, None),
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
        ('user_id', 'INTEGER', False, None),
    ],
    'contract_line_item': [
        ('id', 'INTEGER', False, "nextval('contract_line_item_id_seq'::regclass)"),
        ('contract_id', 'INTEGER', False, None),
        ('product_id', 'INTEGER', True, None),
        ('sku', 'VARCHAR(100)', True, None),
        ('product_name', 'VARCHAR(200)', False, None),
        ('quantity', 'NUMERIC(14, 2)', False, None),  # model default=0
        ('rate', 'NUMERIC(14, 2)', False, None),  # model default=0
        ('discount', 'NUMERIC(5, 2)', False, '0'),  # model default=0
        ('tax', 'NUMERIC(5, 2)', False, '0'),  # model default=0
        ('amount', 'NUMERIC(14, 2)', False, '0'),  # model default=0
        ('line_total', 'NUMERIC(14, 2)', False, '0'),  # model default=0
        ('remarks', 'TEXT', True, None),
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
    ],
    'contract_document': [
        ('id', 'INTEGER', False, "nextval('contract_document_id_seq'::regclass)"),
        ('contract_id', 'INTEGER', False, None),  # model nullable=True
        ('invoice_id', 'INTEGER', True, None),
        ('po_id', 'INTEGER', True, None),
        ('file_name', 'VARCHAR(255)', False, None),
        ('stored_file_name', 'VARCHAR(255)', False, None),
        ('file_path', 'VARCHAR(500)', False, None),
        ('content_type', 'VARCHAR(120)', True, None),
        ('file_size', 'BIGINT', True, None),  # model default=0
        ('file_type', 'VARCHAR(20)', True, None),
        ('category', 'VARCHAR(100)', True, None),
        ('storage_provider', 'VARCHAR(50)', True, None),  # model default='local'
        ('storage_reference', 'VARCHAR(500)', True, None),
        ('version_group_id', 'VARCHAR(36)', True, None),
        ('version', 'INTEGER', True, None),  # model default=1
        ('is_latest_version', 'BOOLEAN', True, None),  # model default=True
        ('uploaded_at', 'TIMESTAMP', True, None),
        ('uploaded_by_id', 'INTEGER', True, None),
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
    ],
    'contract_renewal': [
        ('id', 'INTEGER', False, "nextval('contract_renewal_id_seq'::regclass)"),
        ('original_contract_id', 'INTEGER', False, None),
        ('parent_contract_id', 'INTEGER', False, None),
        ('previous_contract_id', 'INTEGER', False, None),
        ('new_contract_id', 'INTEGER', False, None),
        ('created_at', 'TIMESTAMP', True, None),
        ('created_by_id', 'INTEGER', True, None),
    ],
    'notification': [
        ('id', 'INTEGER', False, "nextval('notification_id_seq'::regclass)"),
        ('contract_id', 'INTEGER', False, None),
        ('notification_type', 'VARCHAR(50)', False, None),
        ('send_date', 'TIMESTAMP', True, None),  # model default=datetime.utcnow
        ('status', 'VARCHAR(50)', True, None),  # model default='pending'
        ('message', 'TEXT', True, None),
    ],
    'product': [
        ('id', 'INTEGER', False, "nextval('product_id_seq'::regclass)"),
        ('name', 'VARCHAR(200)', False, None),
        ('code', 'VARCHAR(80)', True, None),
        ('sku', 'VARCHAR(100)', False, None),
        ('category', 'VARCHAR(100)', True, None),
        ('rate', 'NUMERIC(10, 2)', False, None),
        ('price', 'NUMERIC(10, 2)', True, None),
        ('description', 'TEXT', True, None),
        ('status', 'VARCHAR(50)', True, None),  # model default='active'
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
        ('user_id', 'INTEGER', False, None),
    ],
    'contract_approval': [
        ('id', 'INTEGER', False, "nextval('contract_approval_id_seq'::regclass)"),
        ('contract_id', 'INTEGER', False, None),
        ('approver_id', 'INTEGER', True, None),
        ('requested_by', 'INTEGER', True, None),
        ('status', 'VARCHAR(50)', False, "'Pending'::character varying"),  # model default='Pending'
        ('comments', 'TEXT', True, None),
        ('approval_level', 'INTEGER', True, None),  # model default=1
        ('workflow_assignment_id', 'INTEGER', True, None),
        ('submitted_at', 'TIMESTAMP', True, None),  # model default=datetime.utcnow
        ('approved_at', 'TIMESTAMP', True, None),
        ('rejected_at', 'TIMESTAMP', True, None),
        ('cancelled_at', 'TIMESTAMP', True, None),
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
    ],
    'purchase_order': [
        ('id', 'INTEGER', False, "nextval('purchase_order_id_seq'::regclass)"),
        ('po_number', 'VARCHAR(80)', False, None),
        ('po_date', 'DATE', False, None),  # model default=date.today
        ('vendor', 'VARCHAR(200)', False, None),
        ('customer_id', 'INTEGER', True, None),
        ('amount', 'NUMERIC(14, 2)', False, '0'),  # model default=0
        ('status', 'VARCHAR(50)', False, "'Draft'::character varying"),  # model default='Draft'
        ('issue_date', 'DATE', True, None),
        ('expected_delivery', 'DATE', True, None),
        ('currency', 'VARCHAR(10)', True, None),  # model default='INR'
        ('remarks', 'TEXT', True, None),
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
        ('user_id', 'INTEGER', False, None),
    ],
    'purchase_order_contract': [
        ('id', 'INTEGER', False, "nextval('purchase_order_contract_id_seq'::regclass)"),
        ('purchase_order_id', 'INTEGER', False, None),
        ('contract_id', 'INTEGER', False, None),
        ('created_at', 'TIMESTAMP', True, None),
    ],
    'invoice': [
        ('id', 'INTEGER', False, "nextval('invoice_id_seq'::regclass)"),
        ('invoice_number', 'VARCHAR(80)', False, None),
        ('contract_id', 'INTEGER', True, None),
        ('customer_id', 'INTEGER', True, None),
        ('purchase_order_id', 'INTEGER', True, None),
        ('amount', 'NUMERIC(14, 2)', False, '0'),  # model default=0
        ('tax', 'NUMERIC(14, 2)', True, '0'),  # model default=0
        ('discount', 'NUMERIC(14, 2)', True, '0'),  # model default=0
        ('total', 'NUMERIC(14, 2)', True, '0'),  # model default=0
        ('currency', 'VARCHAR(10)', True, "'INR'::character varying"),  # model default='INR'
        ('invoice_date', 'DATE', False, None),  # model default=date.today
        ('due_date', 'DATE', True, None),
        ('paid_date', 'DATE', True, None),
        ('status', 'VARCHAR(50)', False, "'DRAFT'::character varying"),  # model default='DRAFT'
        ('remarks', 'TEXT', True, None),
        ('created_by', 'INTEGER', True, None),
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
        ('user_id', 'INTEGER', False, None),
    ],
    'invoice_line_item': [
        ('id', 'INTEGER', False, "nextval('invoice_line_item_id_seq'::regclass)"),
        ('invoice_id', 'INTEGER', False, None),
        ('product_id', 'INTEGER', True, None),
        ('product_name', 'VARCHAR(200)', False, None),
        ('sku', 'VARCHAR(80)', True, None),
        ('quantity', 'NUMERIC(14, 2)', False, '1'),  # model default=1
        ('rate', 'NUMERIC(14, 2)', False, '0'),  # model default=0
        ('discount', 'NUMERIC(14, 2)', True, '0'),  # model default=0
        ('tax', 'NUMERIC(14, 2)', True, '0'),  # model default=0
        ('amount', 'NUMERIC(14, 2)', False, '0'),  # model default=0
        ('created_at', 'TIMESTAMP', True, None),
    ],
    'activity_log': [
        ('id', 'INTEGER', False, "nextval('activity_log_id_seq'::regclass)"),
        ('user_id', 'INTEGER', False, None),
        ('contract_id', 'INTEGER', True, None),
        ('activity_type', 'VARCHAR(50)', False, None),
        ('title', 'VARCHAR(200)', False, None),
        ('description', 'TEXT', True, None),
        ('entity_type', 'VARCHAR(50)', True, None),
        ('entity_id', 'INTEGER', True, None),
        ('is_read', 'BOOLEAN', True, None),  # model default=False
        ('created_at', 'TIMESTAMP', True, None),  # model default=datetime.utcnow
    ],
    'sku_counter': [
        ('prefix', 'VARCHAR(100)', False, None),
        ('next_value', 'INTEGER', False, '1'),  # model default=1
    ],
    'calendar_event': [
        ('id', 'INTEGER', False, "nextval('calendar_event_id_seq'::regclass)"),
        ('user_id', 'INTEGER', False, None),
        ('title', 'VARCHAR(200)', False, None),
        ('description', 'TEXT', True, None),
        ('event_type', 'VARCHAR(50)', False, None),
        ('start', 'TIMESTAMP', False, None),
        ('end', 'TIMESTAMP', True, None),
        ('all_day', 'BOOLEAN', True, None),  # model default=False
        ('color', 'VARCHAR(20)', True, None),
        ('entity_type', 'VARCHAR(50)', True, None),
        ('entity_id', 'INTEGER', True, None),
        ('priority', 'VARCHAR(20)', True, None),  # model default='medium'
        ('status', 'VARCHAR(20)', True, None),  # model default='pending'
        ('reminder_sent', 'BOOLEAN', True, None),  # model default=False
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
    ],
    'reminder_config': [
        ('id', 'INTEGER', False, "nextval('reminder_config_id_seq'::regclass)"),
        ('user_id', 'INTEGER', False, None),
        ('event_type', 'VARCHAR(50)', False, None),
        ('days_before', 'INTEGER', False, None),
        ('enabled', 'BOOLEAN', True, None),  # model default=True
        ('notification_method', 'VARCHAR(20)', True, None),  # model default='email'
        ('last_triggered_at', 'TIMESTAMP', True, None),
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
    ],
    'task': [
        ('id', 'INTEGER', False, "nextval('task_id_seq'::regclass)"),
        ('user_id', 'INTEGER', False, None),
        ('title', 'VARCHAR(200)', False, None),
        ('description', 'TEXT', True, None),
        ('due_date', 'DATE', True, None),
        ('priority', 'VARCHAR(20)', True, None),  # model default='MEDIUM'
        ('status', 'VARCHAR(20)', True, None),  # model default='TODO'
        ('assigned_to', 'INTEGER', True, None),
        ('assigned_by', 'INTEGER', True, None),
        ('related_module', 'VARCHAR(50)', True, None),
        ('related_record_id', 'INTEGER', True, None),
        ('completed_at', 'TIMESTAMP', True, None),
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
    ],
    'task_comment': [
        ('id', 'INTEGER', False, "nextval('task_comment_id_seq'::regclass)"),
        ('task_id', 'INTEGER', False, None),
        ('user_id', 'INTEGER', False, None),
        ('content', 'TEXT', False, None),
        ('created_at', 'TIMESTAMP', True, None),
    ],
    'task_attachment': [
        ('id', 'INTEGER', False, "nextval('task_attachment_id_seq'::regclass)"),
        ('task_id', 'INTEGER', False, None),
        ('user_id', 'INTEGER', False, None),
        ('filename', 'VARCHAR(255)', False, None),
        ('file_path', 'VARCHAR(500)', False, None),
        ('file_size', 'BIGINT', True, None),
        ('created_at', 'TIMESTAMP', True, None),
    ],
    'task_history': [
        ('id', 'INTEGER', False, "nextval('task_history_id_seq'::regclass)"),
        ('task_id', 'INTEGER', False, None),
        ('user_id', 'INTEGER', False, None),
        ('field', 'VARCHAR(50)', False, None),
        ('old_value', 'TEXT', True, None),
        ('new_value', 'TEXT', True, None),
        ('created_at', 'TIMESTAMP', True, None),
    ],
    'workflow': [
        ('id', 'INTEGER', False, "nextval('workflow_id_seq'::regclass)"),
        ('name', 'VARCHAR(200)', False, None),
        ('description', 'TEXT', True, None),
        ('workflow_type', 'VARCHAR(50)', False, "'contract_approval'::character varying"),  # model default
        ('is_active', 'BOOLEAN', True, None),  # model default=True
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
    ],
    'workflow_stage': [
        ('id', 'INTEGER', False, "nextval('workflow_stage_id_seq'::regclass)"),
        ('workflow_id', 'INTEGER', False, None),
        ('name', 'VARCHAR(100)', False, None),
        ('stage_order', 'INTEGER', False, None),
        ('role_required', 'VARCHAR(30)', False, None),
        ('created_at', 'TIMESTAMP', True, None),
    ],
    'workflow_rule': [
        ('id', 'INTEGER', False, "nextval('workflow_rule_id_seq'::regclass)"),
        ('workflow_id', 'INTEGER', False, None),
        ('field', 'VARCHAR(50)', False, None),
        ('operator', 'VARCHAR(20)', False, None),
        ('value', 'VARCHAR(200)', False, None),
        ('priority', 'INTEGER', True, None),  # model default=0
        ('created_at', 'TIMESTAMP', True, None),
    ],
    'workflow_assignment': [
        ('id', 'INTEGER', False, "nextval('workflow_assignment_id_seq'::regclass)"),
        ('workflow_id', 'INTEGER', False, None),
        ('entity_type', 'VARCHAR(50)', False, None),
        ('entity_id', 'INTEGER', False, None),
        ('current_stage_order', 'INTEGER', True, None),  # model default=1
        ('status', 'VARCHAR(20)', True, None),  # model default='active'
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
    ],
    'workflow_assignment_stage': [
        ('id', 'INTEGER', False, "nextval('workflow_assignment_stage_id_seq'::regclass)"),
        ('assignment_id', 'INTEGER', False, None),
        ('stage_id', 'INTEGER', False, None),
        ('stage_order', 'INTEGER', False, None),
        ('role_required', 'VARCHAR(30)', False, None),
        ('status', 'VARCHAR(20)', True, None),  # model default='pending'
        ('approved_by', 'INTEGER', True, None),
        ('comments', 'TEXT', True, None),
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
    ],
    'customer_portal_user': [
        ('id', 'INTEGER', False, "nextval('customer_portal_user_id_seq'::regclass)"),
        ('customer_id', 'INTEGER', False, None),
        ('email', 'VARCHAR(120)', False, None),
        ('password_hash', 'VARCHAR(255)', False, None),
        ('created_at', 'TIMESTAMP', True, None),
        ('last_login', 'TIMESTAMP', True, None),
    ],
    'automation_rule': [
        ('id', 'INTEGER', False, "nextval('automation_rule_id_seq'::regclass)"),
        ('name', 'VARCHAR(200)', False, None),
        ('description', 'TEXT', True, None),
        ('trigger_type', 'VARCHAR(50)', False, None),
        ('trigger_config', 'TEXT', True, None),
        ('conditions', 'TEXT', True, None),
        ('actions', 'TEXT', False, None),
        ('is_enabled', 'BOOLEAN', True, None),  # model default=True
        ('last_run_at', 'TIMESTAMP', True, None),
        ('last_error', 'TEXT', True, None),
        ('created_by', 'INTEGER', True, None),
        ('created_at', 'TIMESTAMP', True, None),
        ('updated_at', 'TIMESTAMP', True, None),
    ],
}

print("=" * 80)
print("SCHEMA COMPARISON: SQLAlchemy Models vs PostgreSQL Database")
print("=" * 80)

issues = []

for table_name, expected_cols in models.items():
    if table_name not in inspector.get_table_names():
        issues.append(f"MISSING TABLE: {table_name}")
        continue
    
    actual_cols = {c['name']: c for c in inspector.get_columns(table_name)}
    
    for exp_name, exp_type, exp_nullable, exp_default in expected_cols:
        if exp_name not in actual_cols:
            issues.append(f"MISSING COLUMN: {table_name}.{exp_name} (expected {exp_type} nullable={exp_nullable})")
            continue
        
        actual = actual_cols[exp_name]
        actual_type = str(actual['type'])
        actual_nullable = actual['nullable']
        
        # Check nullable
        if exp_nullable != actual_nullable:
            issues.append(f"NULLABLE MISMATCH: {table_name}.{exp_name} - model nullable={exp_nullable}, db nullable={actual_nullable}")
        
        # Check default (rough comparison)
        actual_default = actual['default']
        if exp_default is not None and actual_default is not None:
            exp_str = str(exp_default).strip("'")
            act_str = str(actual_default).strip("'")
            if exp_str != act_str and not (exp_str in act_str or act_str in exp_str):
                issues.append(f"DEFAULT MISMATCH: {table_name}.{exp_name} - model default={exp_default}, db default={actual_default}")
        
        # Type check (rough)
        exp_type_simple = exp_type.split('(')[0].upper()
        act_type_simple = actual_type.split('(')[0].upper()
        # Normalize some types
        type_map = {
            'VARCHAR': 'CHARACTER VARYING',
            'TEXT': 'TEXT',
            'BIGINT': 'BIGINT',
            'INTEGER': 'INTEGER',
            'BOOLEAN': 'BOOLEAN',
            'DATE': 'DATE',
            'TIMESTAMP': 'TIMESTAMP WITHOUT TIME ZONE',
            'NUMERIC': 'NUMERIC',
        }
        exp_norm = type_map.get(exp_type_simple, exp_type_simple)
        act_norm = type_map.get(act_type_simple, act_type_simple)
        if exp_norm != act_norm:
            issues.append(f"TYPE MISMATCH: {table_name}.{exp_name} - model {exp_type}, db {actual_type}")

    # Check for extra columns in DB
    for act_name in actual_cols:
        if not any(act_name == exp[0] for exp in expected_cols):
            issues.append(f"EXTRA COLUMN IN DB: {table_name}.{act_name} (not in model)")

print(f"\nTotal issues found: {len(issues)}")
for issue in issues:
    print(f"  - {issue}")

print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)

# Group by table
by_table = {}
for issue in issues:
    table = issue.split(':')[0].split('.')[-1] if '.' in issue else 'UNKNOWN'
    if table not in by_table:
        by_table[table] = []
    by_table[table].append(issue)

for table, table_issues in sorted(by_table.items()):
    print(f"\n{table}: {len(table_issues)} issues")
    for issue in table_issues:
        print(f"  - {issue}")