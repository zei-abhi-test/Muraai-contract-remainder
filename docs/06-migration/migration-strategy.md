# Migration Strategy — Contract Aggregate Modernization

**Status:** Draft (Sprint 1)
**Date:** 2026-07-20
**Scope:** Migration from the current CRUD Contract model to the new DDD-based Contract Aggregate

---

## Pre-Migration State

**Current schema** (`contract` table, 30 columns, string-based status "Active"):

| Aspect | Current (v1) | Target (v2) |
|---|---|---|
| Status | String: "Active", "Expired" | Enum: DRAFT, ACTIVE, EXPIRED, TERMINATED, INCONSISTENT, ARCHIVED |
| Line items | `contract_line_item` table with FKs to `product` | `contract_line_item` with product_snapshot (denormalized at time of creation) |
| Documents | `contract_document` with versioning | `contract_document` with new categorization fields |
| Renewals | `contract_renewal` (thin association table) | Separate Renewal aggregate (full lifecycle) |
| Timeline | `activity_log` (generic) | `contract_version_history` + domain event store |
| Approvals | `contract_approval` | Approval moved to Renewal aggregate |
| POs | `purchase_order_contract` (association) | PO remains separate, linked via Renewal |
| Invoices | FK to contract on `invoice` | Invoice linked via PO → Renewal → Contract |
| Soft deletes | **None** (hard deletes) | Soft delete on all entities |
| Events | **None** | Domain events emitted on every state change |
| ID type | Integer | Integer (UUID postponed — see ADR-007) |

**Current DB:** PostgreSQL (primary), SQLite fallback for local dev
**Current migration infra:** Alembic with 10 existing revisions

---

## Scenario 1: Fresh Install (Greenfield Database)

### When
- New deployment with no existing data
- CI/CD pipeline creating the database for the first time
- Demo/QA environments

### Steps

1. **Squash all migrations into a single baseline revision**
   - Create a new Alembic revision `20260720_0011` that creates all v2 tables
   - Drop the existing 10 revision chain
   - The squashed migration creates both v1-compatible tables AND new v2 tables

2. **Table creation order**
   ```
   1. user (unchanged)
   2. contract_type (unchanged)
   3. customer (unchanged)
   4. contact_person (unchanged)
   5. product (unchanged)
   6. contract (v2 schema — new columns, new status constraint)
   7. contract_line_item (v2 — add product_snapshot columns)
   8. contract_clause (NEW)
   9. contract_document (v2 — add new categorization)
   10. contract_version_history (NEW)
   11. contract_event_log (NEW — domain event store)
   12. renewal (NEW — full Renewal aggregate)
   13. renewal_line_item (NEW)
   14. renewal_email (NEW)
   15. renewal_task (NEW)
   16. renewal_approval (NEW)
   17. renewal_document (NEW)
   18. purchase_order (adapt FK to point to renewal)
   19. invoice (adapt FK to point to purchase_order)
   ```

3. **Seed data**
   - Insert default contract types
   - Insert admin user account
   - Insert system notification templates

4. **Validation queries** (run post-migration)
   ```sql
   -- Check all tables exist
   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

   -- Check constraint integrity
   SELECT conname, contype FROM pg_constraint WHERE conrelid = 'contract'::regclass;

   -- Check status enum (check constraint)
   SELECT conname, consrc FROM pg_constraint WHERE conrelid = 'contract'::regclass AND contype = 'c';
   ```

---

## Scenario 2: Existing Production Database Migration

### Principle
**Phase the migration.** Never migrate everything at once. Each phase is forward-only and reversible within its window.

### Phase 1: Schema Expansion (Compatible)

**Strategy:** Add new columns/tables alongside existing ones. Old code continues to work.

| Step | SQL | Rollback |
|---|---|---|
| 1. Add v2 columns to `contract` table | `ALTER TABLE contract ADD COLUMN status_v2 VARCHAR(20);` | `ALTER TABLE contract DROP COLUMN status_v2;` |
| 2. Add check constraint for v2 statuses | `ALTER TABLE contract ADD CONSTRAINT chk_status_v2 CHECK (status_v2 IN ('DRAFT','ACTIVE','EXPIRED','TERMINATED','INCONSISTENT','ARCHIVED'));` | `ALTER TABLE contract DROP CONSTRAINT chk_status_v2;` |
| 3. Create new tables (`contract_clause`, `contract_version_history`, `contract_event_log`) | `CREATE TABLE contract_clause (...);` etc. | `DROP TABLE contract_clause;` etc. |
| 4. Add missing columns to existing tables | e.g., `contract_line_item.product_snapshot_json TEXT` | `ALTER TABLE contract_line_item DROP COLUMN product_snapshot_json;` |
| 5. Add `is_deleted` column for soft deletes | `ALTER TABLE contract ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;` | `ALTER TABLE contract DROP COLUMN is_deleted;` |

**Validation queries (run after each step):**
```sql
-- Verify new columns exist
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'contract' AND column_name LIKE '%v2%' OR column_name = 'is_deleted';

-- Verify new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('contract_clause','contract_version_history','contract_event_log');

-- Verify no data loss in old columns
SELECT COUNT(*) FROM contract WHERE status IS NULL;
```

### Phase 2: Backfill Data

**Strategy:** Migrate existing data into new columns/tables. Can be run incrementally.

| Step | Operation | Rollback |
|---|---|---|
| 1. Map v1 status to v2 | `UPDATE contract SET status_v2 = CASE WHEN status = 'Expired' THEN 'ACTIVE' WHEN ... END;` | `UPDATE contract SET status_v2 = NULL;` |
| 2. Build contract_version_history from activity_log | INSERT INTO contract_version_history SELECT ... FROM activity_log WHERE entity_type = 'contract'; | `DELETE FROM contract_version_history;` |
| 3. Populate contract_event_log from activity_log | INSERT INTO contract_event_log SELECT ... FROM activity_log; | `DELETE FROM contract_event_log;` |

**Validation queries:**
```sql
-- Verify status mapping is complete
SELECT status, status_v2, COUNT(*) FROM contract GROUP BY status, status_v2;

-- Verify version history count matches activity log
SELECT COUNT(*) FROM contract_version_history;
SELECT COUNT(*) FROM activity_log WHERE entity_type = 'contract';

-- Verify no null v2 statuses after mapping
SELECT COUNT(*) FROM contract WHERE status_v2 IS NULL;
```

### Phase 3: Cutover

**Strategy:** Flip the application to use v2 columns/tables. Old code path is retired.

| Step | Operation | Rollback |
|---|---|---|
| 1. Deploy new application code | Reads/writes `status_v2`, uses new tables | Re-deploy old application code |
| 2. Enable write-guard on old columns | Application stops writing to `status` column | Disable write-guard |
| 3. Drop old columns (post-cutover) | `ALTER TABLE contract DROP COLUMN status;` AND `ALTER TABLE contract RENAME COLUMN status_v2 TO status;` | Cannot restore dropped columns without restore from backup |

**Validation queries:**
```sql
-- Verify all contracts have valid v2 status
SELECT DISTINCT status FROM contract;

-- Verify event log captures all recent changes
SELECT COUNT(*) FROM contract_event_log WHERE created_at > NOW() - INTERVAL '1 hour';

-- Verify soft-delete works
UPDATE contract SET is_deleted = TRUE WHERE id = <test_id>;
SELECT is_deleted FROM contract WHERE id = <test_id>;
```

### Phase 4: Data Cleanup

**Strategy:** Remove duplicate data, backfill missing data, optimize indexes.

| Step | Operation | Validation |
|---|---|---|
| 1. Remove duplicate `activity_log` entries for contracts | `DELETE FROM activity_log WHERE entity_type = 'contract' AND id IN (SELECT duplicate_ids ...);` | Count before/after |
| 2. Add indexes on new tables | `CREATE INDEX idx_contract_event_log_contract_id ON contract_event_log(contract_id);` | `EXPLAIN ANALYZE` query plans |
| 3. Update materialized aggregates | Recompute `total_contract_value` across all contracts | Compare old vs new values |
| 4. Refresh statistics | `ANALYZE;` | Query performance check |

---

## Scenario 3: Rollback After Partial Migration

### When
- Phase 1 (schema expansion) fails validation
- Phase 2 (backfill) corrupts data
- Application deployment in Phase 3 has critical bugs

### Rollback Protocol

#### For Phases 1 & 2 (Data-level rollback)
```sql
-- Rollback Phase 2: Remove backfilled data
DELETE FROM contract_version_history;
DELETE FROM contract_event_log;
DELETE FROM contract_clause;
UPDATE contract SET status_v2 = NULL;

-- Rollback Phase 1: Drop new columns and tables
ALTER TABLE contract DROP COLUMN IF EXISTS status_v2;
ALTER TABLE contract DROP COLUMN IF EXISTS is_deleted;
ALTER TABLE contract_line_item DROP COLUMN IF EXISTS product_snapshot_json;
ALTER TABLE contract_document DROP COLUMN IF EXISTS <new_columns>;
DROP TABLE IF EXISTS contract_clause;
DROP TABLE IF EXISTS contract_version_history;
DROP TABLE IF EXISTS contract_event_log;
```

**Time estimate for rollback:** ~2 minutes per 10,000 contracts (Phase 1+2 combined)

#### For Phase 3 (Application-level rollback)
```yaml
rollback:
  database:
    - Run Phase 1+2 rollback SQL above
    - Restore old schema from backup if columns were dropped
  application:
    - Revert to previous application deployment (container/artifact)
    - Re-enable old code path (feature flag: USE_V2_CONTRACT=false)
  validation:
    - Verify all API endpoints return correct data
    - Verify CRUD operations on Contract model still work
    - Verify notification/reminder scheduler runs correctly
```

**Rollback decision criteria:**
| Signal | Action |
|---|---|
| >1% of queries fail in Phase 3 | Immediate rollback |
| Data corruption detected in Phase 2 | Rollback Phase 2, fix migration, retry |
| Validation query fails in Phase 1 | Do not proceed to Phase 2. Fix and retry. |
| Performance regression >20% | Rollback Phase 3, investigate query plans |

---

## Data Integrity Validation Queries

### Pre-Migration Baseline
```sql
-- Record counts before migration
SELECT 'contract' AS entity, COUNT(*) FROM contract
UNION ALL
SELECT 'contract_line_item', COUNT(*) FROM contract_line_item
UNION ALL
SELECT 'contract_document', COUNT(*) FROM contract_document
UNION ALL
SELECT 'contract_approval', COUNT(*) FROM contract_approval
UNION ALL
SELECT 'activity_log', COUNT(*) FROM activity_log;

-- Check for orphaned records
SELECT COUNT(*) FROM contract_line_item cli
WHERE cli.contract_id NOT IN (SELECT id FROM contract);

-- Check for duplicate contract numbers
SELECT contract_number, COUNT(*) FROM contract
WHERE contract_number IS NOT NULL
GROUP BY contract_number HAVING COUNT(*) > 1;
```

### Post-Migration Validation
```sql
-- Record count parity
SELECT 'pre_contract' AS phase, COUNT(*) FROM contract
UNION ALL
SELECT 'post_contract', COUNT(*) FROM contract;

-- Status mapping completeness
SELECT status, COUNT(*) FROM contract GROUP BY status;

-- Check event log has entries for every contract
SELECT c.id, c.contract_name,
  CASE WHEN el.id IS NULL THEN 'MISSING' ELSE 'OK' END AS event_log_status
FROM contract c
LEFT JOIN (
  SELECT DISTINCT contract_id, id FROM contract_event_log
) el ON c.id = el.contract_id
WHERE el.id IS NULL;
```

### Continuous Validation (Cron)
```sql
-- Hourly check: event log should grow as contracts change
SELECT 'event_log_growth' AS check_name, COUNT(*) AS current_count
FROM contract_event_log
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Daily check: no contracts in invalid state
SELECT 'invalid_states' AS check_name, COUNT(*) AS count
FROM contract
WHERE status NOT IN ('DRAFT','ACTIVE','EXPIRED','TERMINATED','INCONSISTENT','ARCHIVED');

-- Daily check: soft delete consistency
SELECT 'soft_delete_orphans' AS check_name, COUNT(*) AS count
FROM contract_line_item cli
JOIN contract c ON cli.contract_id = c.id
WHERE c.is_deleted = TRUE AND cli.is_deleted = FALSE;
```

---

## Backward Compatibility During Migration

| Old code path | New code path | Coexistence strategy |
|---|---|---|
| Reads `contract.status` | Reads `contract.status_v2` | Feature flag: `USE_V2_CONTRACT_STATUS` |
| Writes `contract.status` | Writes `contract.status_v2` | Sync trigger keeps both in sync during Phase 1-2 |
| Creates `contract_line_item` | Creates with `product_snapshot_json` | New code populates both old FK + snapshot |
| Reads `activity_log` for timeline | Reads `contract_version_history` | Old UI reads `activity_log`, new UI reads v2 table |
| Hard deletes (`DELETE FROM`) | Soft deletes (`UPDATE is_deleted = TRUE`) | Migration adds DB trigger to convert DELETEs to UPDATEs |

### DB Trigger for Status Sync (Phase 1-2 only)
```sql
CREATE OR REPLACE FUNCTION sync_contract_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status_v2 IS DISTINCT FROM OLD.status_v2 THEN
    NEW.status := CASE NEW.status_v2
      WHEN 'DRAFT' THEN 'Draft'
      WHEN 'ACTIVE' THEN 'Active'
      WHEN 'EXPIRED' THEN 'Expired'
      WHEN 'TERMINATED' THEN 'Terminated'
      WHEN 'INCONSISTENT' THEN 'Active'  -- best approximation
      WHEN 'ARCHIVED' THEN 'Expired'     -- best approximation
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contract_status_sync
  BEFORE UPDATE ON contract
  FOR EACH ROW
  WHEN (NEW.status_v2 IS DISTINCT FROM OLD.status_v2)
  EXECUTE FUNCTION sync_contract_status();
```

---

## Migration Tooling

| Tool | Purpose | When |
|---|---|---|
| Alembic | Schema migrations (Phase 1, 3) | Deployment |
| Custom Python script | Data backfill (Phase 2) | Off-peak hours |
| psql / pgAdmin | Validation queries, rollback | Manual intervention |
| Feature flags | Toggle old/new code paths | Phase 3 cutover |
| DB triggers | Status sync during coexistence | Phase 1-2 |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Data loss during column rename | Low | Critical | Back up before Phase 3. Rename in single transaction. |
| Performance regression from new indexes | Medium | Medium | Run `EXPLAIN ANALYZE` before and after. |
| Orphaned records in new tables | Medium | High | Foreign keys with `ON DELETE CASCADE` or soft delete checks. |
| Application crashes on schema mismatch | Medium | Critical | Feature flags. Old code never touches new columns. |
| Migration script timeout on large DB | Low | Medium | Batch processing (1000 records per batch). |
| Status mapping ambiguity | Medium | High | Map `INCONSISTENT` and `ARCHIVED` via business rules, not simple mapping. |
