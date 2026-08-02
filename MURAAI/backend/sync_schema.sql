-- =============================================================================
-- SCHEMA SYNC: PostgreSQL -> SQLAlchemy Models
-- Muraai Contract Reminder
-- =============================================================================
-- Root Cause:
--   Database is at migration 20260716_0010. SQLAlchemy models have evolved
--   with new lifecycle/soft-delete columns but no migration was created.
--   AUTO_CREATE_TABLES does NOT add columns to existing tables.
--
-- Migrations that exist but were never applied:
--   20260722_0012 — add user_id, correlation_id, version to contract_event_log
--   20260722_0013 — create policy_execution + idempotency_key tables
--   20260722_0014 — create timeline_item table
--
-- This script only uses ALTER TABLE ADD COLUMN / ADD CONSTRAINT.
-- No data is dropped. No tables are recreated.
--
-- Usage:
--   psql -h localhost -p 5001 -U postgres -d muraai_contracts -f sync_schema.sql
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. CONTRACT — 13 missing lifecycle & soft-delete columns
-- =============================================================================

ALTER TABLE contract ADD COLUMN IF NOT EXISTS is_deleted       BOOLEAN      NOT NULL DEFAULT FALSE;
ALTER TABLE contract ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMP    NULL;
ALTER TABLE contract ADD COLUMN IF NOT EXISTS deleted_by_id    INTEGER      NULL;
ALTER TABLE contract ADD COLUMN IF NOT EXISTS deletion_reason  VARCHAR(500) NULL;
ALTER TABLE contract ADD COLUMN IF NOT EXISTS activated_at     TIMESTAMP    NULL;
ALTER TABLE contract ADD COLUMN IF NOT EXISTS activated_by_id  INTEGER      NULL;
ALTER TABLE contract ADD COLUMN IF NOT EXISTS activated_notes  VARCHAR(500) NULL;
ALTER TABLE contract ADD COLUMN IF NOT EXISTS terminated_at    TIMESTAMP    NULL;
ALTER TABLE contract ADD COLUMN IF NOT EXISTS terminated_by_id INTEGER      NULL;
ALTER TABLE contract ADD COLUMN IF NOT EXISTS termination_reason VARCHAR(100) NULL;
ALTER TABLE contract ADD COLUMN IF NOT EXISTS archived_at      TIMESTAMP    NULL;
ALTER TABLE contract ADD COLUMN IF NOT EXISTS archived_by_id   INTEGER      NULL;
ALTER TABLE contract ADD COLUMN IF NOT EXISTS retention_until  DATE         NULL;

-- =============================================================================
-- 2. CONTRACT_DOCUMENT — missing is_deleted
-- =============================================================================

ALTER TABLE contract_document ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- =============================================================================
-- 3. CONTRACT_LINE_ITEM — missing is_deleted
-- =============================================================================

ALTER TABLE contract_line_item ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- =============================================================================
-- 4. CONTRACT_EVENT_LOG — 3 missing columns
-- =============================================================================

ALTER TABLE contract_event_log ADD COLUMN IF NOT EXISTS user_id        INTEGER      NULL;
ALTER TABLE contract_event_log ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(36)  NULL;
ALTER TABLE contract_event_log ADD COLUMN IF NOT EXISTS version        INTEGER      NOT NULL DEFAULT 1;

-- =============================================================================
-- 5. FOREIGN KEYS — add missing FK constraints (idempotent via DO block)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_contract_deleted_by' AND table_name = 'contract'
  ) THEN
    ALTER TABLE contract ADD CONSTRAINT fk_contract_deleted_by
      FOREIGN KEY (deleted_by_id) REFERENCES user(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_contract_activated_by' AND table_name = 'contract'
  ) THEN
    ALTER TABLE contract ADD CONSTRAINT fk_contract_activated_by
      FOREIGN KEY (activated_by_id) REFERENCES user(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_contract_terminated_by' AND table_name = 'contract'
  ) THEN
    ALTER TABLE contract ADD CONSTRAINT fk_contract_terminated_by
      FOREIGN KEY (terminated_by_id) REFERENCES user(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_contract_archived_by' AND table_name = 'contract'
  ) THEN
    ALTER TABLE contract ADD CONSTRAINT fk_contract_archived_by
      FOREIGN KEY (archived_by_id) REFERENCES user(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_contract_event_log_user' AND table_name = 'contract_event_log'
  ) THEN
    ALTER TABLE contract_event_log ADD CONSTRAINT fk_contract_event_log_user
      FOREIGN KEY (user_id) REFERENCES user(id);
  END IF;
END $$;

-- =============================================================================
-- 6. VERIFICATION — confirm the schema now matches the models
-- =============================================================================

-- 6a. Column count
SELECT '6a. contract column count' AS verification,
       count(*)::text AS result
FROM information_schema.columns
WHERE table_name = 'contract' AND table_schema = 'public';

-- 6b. All 13 lifecycle columns present
SELECT '6b. columns present' AS verification,
       string_agg(column_name, ', ' ORDER BY column_name) AS result
FROM information_schema.columns
WHERE table_name = 'contract' AND table_schema = 'public'
  AND column_name IN (
    'is_deleted', 'deleted_at', 'deleted_by_id', 'deletion_reason',
    'activated_at', 'activated_by_id', 'activated_notes',
    'terminated_at', 'terminated_by_id', 'termination_reason',
    'archived_at', 'archived_by_id', 'retention_until'
  );

-- 6c. contract_document has is_deleted
SELECT '6c. contract_document.is_deleted' AS verification,
       CASE WHEN count(*) = 1 THEN 'EXISTS' ELSE 'MISSING' END AS result
FROM information_schema.columns
WHERE table_name = 'contract_document' AND column_name = 'is_deleted' AND table_schema = 'public';

-- 6d. contract_line_item has is_deleted
SELECT '6d. contract_line_item.is_deleted' AS verification,
       CASE WHEN count(*) = 1 THEN 'EXISTS' ELSE 'MISSING' END AS result
FROM information_schema.columns
WHERE table_name = 'contract_line_item' AND column_name = 'is_deleted' AND table_schema = 'public';

-- 6e. contract_event_log has new columns
SELECT '6e. contract_event_log columns' AS verification,
       string_agg(column_name, ', ' ORDER BY column_name) AS result
FROM information_schema.columns
WHERE table_name = 'contract_event_log' AND table_schema = 'public'
  AND column_name IN ('user_id', 'correlation_id', 'version');

-- 6f. All new FK constraints present
SELECT '6f. new FK constraints' AS verification,
       string_agg(constraint_name, ', ' ORDER BY constraint_name) AS result
FROM information_schema.table_constraints
WHERE constraint_name IN (
  'fk_contract_deleted_by', 'fk_contract_activated_by',
  'fk_contract_terminated_by', 'fk_contract_archived_by',
  'fk_contract_event_log_user'
) AND table_schema = 'public';

-- 6g. Row count sanity (no data lost)
SELECT '6g. row counts' AS verification,
       string_agg(tbl || ': ' || cnt::text, ', ' ORDER BY tbl) AS result
FROM (
  SELECT 'contract' AS tbl, count(*) AS cnt FROM contract
  UNION ALL SELECT 'contract_document', count(*) FROM contract_document
  UNION ALL SELECT 'contract_line_item', count(*) FROM contract_line_item
  UNION ALL SELECT 'contract_event_log', count(*) FROM contract_event_log
) counts;

COMMIT;
