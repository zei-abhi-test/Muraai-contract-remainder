import sys
sys.path.insert(0, '.')
from sqlalchemy import inspect, create_engine
from alembic.config import Config

config = Config('alembic.ini')
url = config.get_main_option('sqlalchemy.url')
engine = create_engine(url)
inspector = inspect(engine)

# Check User model columns
cols = inspector.get_columns('user')
print('=== USER TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')

print()
# Check organization table
cols = inspector.get_columns('organization')
print('=== ORGANIZATION TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')

print()
# Check user_preference table
cols = inspector.get_columns('user_preference')
print('=== USER_PREFERENCE TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')

print()
# Check role table
cols = inspector.get_columns('role')
print('=== ROLE TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')

print()
# Check contract table
cols = inspector.get_columns('contract')
print('=== CONTRACT TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')

print()
# Check contract_line_item table
cols = inspector.get_columns('contract_line_item')
print('=== CONTRACT_LINE_ITEM TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')

print()
# Check contract_document table
cols = inspector.get_columns('contract_document')
print('=== CONTRACT_DOCUMENT TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')

print()
# Check notification table
cols = inspector.get_columns('notification')
print('=== NOTIFICATION TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')

print()
# Check product table
cols = inspector.get_columns('product')
print('=== PRODUCT TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')

print()
# Check contract_approval table
cols = inspector.get_columns('contract_approval')
print('=== CONTRACT_APPROVAL TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')

print()
# Check purchase_order table
cols = inspector.get_columns('purchase_order')
print('=== PURCHASE_ORDER TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')

print()
# Check invoice table
cols = inspector.get_columns('invoice')
print('=== INVOICE TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')

print()
# Check activity_log table
cols = inspector.get_columns('activity_log')
print('=== ACTIVITY_LOG TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')

print()
# Check calendar_event table
cols = inspector.get_columns('calendar_event')
print('=== CALENDAR_EVENT TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')

print()
# Check reminder_config table
cols = inspector.get_columns('reminder_config')
print('=== REMINDER_CONFIG TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')

print()
# Check task table
cols = inspector.get_columns('task')
print('=== TASK TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')

print()
# Check workflow tables
for t in ['workflow', 'workflow_stage', 'workflow_rule', 'workflow_assignment', 'workflow_assignment_stage']:
    cols = inspector.get_columns(t)
    print(f'=== {t.upper()} TABLE ===')
    for c in cols:
        print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')
    print()

print()
# Check customer_portal_user table
cols = inspector.get_columns('customer_portal_user')
print('=== CUSTOMER_PORTAL_USER TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')

print()
# Check automation_rule table
cols = inspector.get_columns('automation_rule')
print('=== AUTOMATION_RULE TABLE ===')
for c in cols:
    print(f'  {c["name"]}: {c["type"]} nullable={c["nullable"]} default={c["default"]}')