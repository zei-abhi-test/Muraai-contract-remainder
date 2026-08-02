-- Step 1: Add all missing columns (standalone, run first)
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

ALTER TABLE contract_document  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE contract_line_item ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE contract_event_log ADD COLUMN IF NOT EXISTS user_id        INTEGER      NULL;
ALTER TABLE contract_event_log ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(36)  NULL;
ALTER TABLE contract_event_log ADD COLUMN IF NOT EXISTS version        INTEGER      NOT NULL DEFAULT 1;
