"""
================================================================================
SCHEMA SYNC: PostgreSQL → SQLAlchemy Models
================================================================================

Root Cause
----------
Database is at Alembic migration 20260716_0010. The Contract model (and others)
have been extended with lifecycle/soft-delete columns in the Python source but
NO corresponding migration was created or applied.  The AUTO_CREATE_TABLES=true
setting runs CREATE TABLE IF NOT EXISTS on startup, but that NEVER adds columns
to existing tables — hence the "column contract.is_deleted does not exist" error.

Migrations that exist but were NOT applied:
  20260722_0012 — add user_id, correlation_id, version to contract_event_log
  20260722_0013 — create policy_execution + idempotency_key tables
  20260722_0014 — create timeline_item table

Changes below ONLY use ALTER TABLE ADD COLUMN / ADD CONSTRAINT.
No data is dropped. No tables are recreated.

Usage
-----
Run this entire script as a single transaction:
  psql -h localhost -p 5001 -U postgres -d muraai_contracts -f sync_schema.sql

Verification queries are at the end of the file.
================================================================================
"""

print("/*")
print("=" * 70)
print("SCHEMA SYNC SCRIPT — Muraai Contract Reminder")
print("=" * 70)
print("BEGIN;")
print()
print("-- Safety: skip if the column already exists (idempotent)")
print()

# ============================================================================
# 1. CONTRACT — 13 missing lifecycle + soft-delete columns
# ============================================================================
print("-- ============================================================")
print("-- CONTRACT — lifecycle & soft-delete columns")
print("-- ============================================================")

contract_cols = [
    ("is_deleted",       "BOOLEAN",       "NOT NULL DEFAULT FALSE"),
    ("deleted_at",       "TIMESTAMP",     "NULL"),
    ("deleted_by_id",    "INTEGER",       "NULL"),
    ("deletion_reason",  "VARCHAR(500)",  "NULL"),
    ("activated_at",     "TIMESTAMP",     "NULL"),
    ("activated_by_id",  "INTEGER",       "NULL"),
    ("activated_notes",  "VARCHAR(500)",  "NULL"),
    ("terminated_at",    "TIMESTAMP",     "NULL"),
    ("terminated_by_id", "INTEGER",       "NULL"),
    ("termination_reason","VARCHAR(100)", "NULL"),
    ("archived_at",      "TIMESTAMP",     "NULL"),
    ("archived_by_id",   "INTEGER",       "NULL"),
    ("retention_until",  "DATE",          "NULL"),
]

for name, dtype, nullable in contract_cols:
    print(f"ALTER TABLE contract ADD COLUMN IF NOT EXISTS {name} {dtype} {nullable};")

# ============================================================================
# 2. CONTRACT_DOCUMENT — missing is_deleted
# ============================================================================
print()
print("-- ============================================================")
print("-- CONTRACT_DOCUMENT — missing is_deleted")
print("-- ============================================================")
print("ALTER TABLE contract_document ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;")

# ============================================================================
# 3. CONTRACT_LINE_ITEM — missing is_deleted
# ============================================================================
print()
print("-- ============================================================")
print("-- CONTRACT_LINE_ITEM — missing is_deleted")
print("-- ============================================================")
print("ALTER TABLE contract_line_item ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;")

# ============================================================================
# 4. CONTRACT_EVENT_LOG — 3 missing columns
# ============================================================================
print()
print("-- ============================================================")
print("-- CONTRACT_EVENT_LOG — user_id, correlation_id, version")
print("-- ============================================================")
print("ALTER TABLE contract_event_log ADD COLUMN IF NOT EXISTS user_id INTEGER NULL;")
print("ALTER TABLE contract_event_log ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(36) NULL;")
print("ALTER TABLE contract_event_log ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;")

# ============================================================================
# 5. FOREIGN KEYS (skip if already exist)
# ============================================================================
print()
print("-- ============================================================")
print("-- FOREIGN KEYS — add missing FK constraints")
print("-- ============================================================")
print()

missing_fks = [
    ("contract",            "deleted_by_id",    "user", "id",      "fk_contract_deleted_by"),
    ("contract",            "activated_by_id",  "user", "id",      "fk_contract_activated_by"),
    ("contract",            "terminated_by_id", "user", "id",      "fk_contract_terminated_by"),
    ("contract",            "archived_by_id",   "user", "id",      "fk_contract_archived_by"),
    ("contract_event_log",  "user_id",          "user", "id",      "fk_contract_event_log_user"),
]

for table, column, ref_table, ref_col, fk_name in missing_fks:
    print(f"DO $$")
    print(f"BEGIN")
    print(f"  IF NOT EXISTS (")
    print(f"    SELECT 1 FROM information_schema.table_constraints")
    print(f"    WHERE constraint_name = '{fk_name}'")
    print(f"      AND table_name = '{table}'")
    print(f"  ) THEN")
    print(f"    ALTER TABLE {table}")
    print(f"      ADD CONSTRAINT {fk_name}")
    print(f"      FOREIGN KEY ({column}) REFERENCES {ref_table}({ref_col});")
    print(f"  END IF;")
    print(f"END $$;")
    print()

# ============================================================================
# 6. VERIFICATION QUERIES
# ============================================================================
print("-- ============================================================")
print("-- VERIFICATION — confirm the schema now matches the models")
print("-- ============================================================")
print()
print("-- 1. Contract columns (expect 41 columns, 13 new)")
print("SELECT count(*) AS contract_column_count")
print("FROM information_schema.columns")
print("WHERE table_name = 'contract'")
print("  AND table_schema = 'public';")
print()
print("-- 2. Verify all 13 lifecycle columns exist on contract")
for name, _, _ in contract_cols:
    print(f"SELECT '{name}' AS column_name, EXISTS (")
    print(f"  SELECT 1 FROM information_schema.columns")
    print(f"  WHERE table_name = 'contract' AND column_name = '{name}'")
    print(f"  AND table_schema = 'public') AS exists;")

print()
print("-- 3. Verify is_deleted on contract_document")
print("SELECT 'contract_document.is_deleted' AS check,")
print("  EXISTS (SELECT 1 FROM information_schema.columns")
print("    WHERE table_name = 'contract_document'")
print("    AND column_name = 'is_deleted'")
print("    AND table_schema = 'public') AS exists;")
print()
print("-- 4. Verify is_deleted on contract_line_item")
print("SELECT 'contract_line_item.is_deleted' AS check,")
print("  EXISTS (SELECT 1 FROM information_schema.columns")
print("    WHERE table_name = 'contract_line_item'")
print("    AND column_name = 'is_deleted'")
print("    AND table_schema = 'public') AS exists;")
print()
print("-- 5. Verify contract_event_log columns")
for col in ["user_id", "correlation_id", "version"]:
    print(f"SELECT 'contract_event_log.{col}' AS check,")
    print(f"  EXISTS (SELECT 1 FROM information_schema.columns")
    print(f"    WHERE table_name = 'contract_event_log'")
    print(f"    AND column_name = '{col}'")
    print(f"    AND table_schema = 'public') AS exists;")

print("""
-- 6. Verify missing FK constraints exist
SELECT constraint_name, constraint_type, table_name
FROM information_schema.table_constraints
WHERE constraint_name IN (
  'fk_contract_deleted_by',
  'fk_contract_activated_by',
  'fk_contract_terminated_by',
  'fk_contract_archived_by',
  'fk_contract_event_log_user'
);

-- 7. Row count sanity (no lost data)
SELECT 'contract' AS tbl, count(*) FROM contract
UNION ALL
SELECT 'contract_document', count(*) FROM contract_document
UNION ALL
SELECT 'contract_line_item', count(*) FROM contract_line_item
UNION ALL
SELECT 'contract_event_log', count(*) FROM contract_event_log;
""")

print("COMMIT;")
