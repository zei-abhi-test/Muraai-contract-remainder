# Failure Mode Analysis — Contract Aggregate

**Status:** Draft (Sprint 1)
**Date:** 2026-07-20
**Purpose:** Systematic analysis of every failure mode in the Contract Aggregate system, with detection, impact assessment, recovery strategy, and prevention.

---

## 1. Database Failures

### FM-01: Database Connection Lost

| Aspect | Detail |
|---|---|
| **When** | Any API call during database outage |
| **Impact** | All contract operations fail. Existing connections hang until timeout. |
| **Detection** | SQLAlchemy raises `OperationalError`. Health check endpoint returns 503. |
| **Recovery** | Connection pool retry (3 attempts, exponential backoff 1s/2s/4s). Pool recycles connections every 3600s. If all retries fail, return 503 to client with `retry-after` header. |
| **Prevention** | Connection pool (min 2, max 10 connections). PGBouncer for production. Read replicas for read operations. |

### FM-02: Query Timeout

| Aspect | Detail |
|---|---|
| **When** | Slow query on list endpoints with complex filters, or dashboard query on large dataset |
| **Impact** | HTTP timeout (30s default). Partial page load. |
| **Detection** | SQLAlchemy `statement_timeout` triggers `OperationalError: query timed out`. |
| **Recovery** | Client retries with pagination. Server logs slow query for DBA review. |
| **Prevention** | Pagination (max 100 per page). Indexed columns for all filterable fields. `EXPLAIN ANALYZE` in CI for queries above threshold. Dashboard queries use materialized aggregation tables, not live scans. |

### FM-03: Deadlock

| Aspect | Detail |
|---|---|
| **When** | Concurrent updates to same contract (e.g., two users edit line items simultaneously) |
| **Impact** | One of the transactions is rolled back. User sees an error. |
| **Detection** | PostgreSQL `40P01` deadlock detected. Transaction rolled back automatically. |
| **Recovery** | Client retries with exponential backoff. Optimistic locking (see FM-04) prevents most deadlocks. |
| **Prevention** | Optimistic locking via `contract_version` (see Concurrency section). Short transactions. Consistent lock ordering. |

---

## 2. Concurrency Failures

### FM-04: Optimistic Locking Conflict

| Aspect | Detail |
|---|---|
| **When** | Two users read the same contract (version 3), both modify and save. Second save fails because version 3 is now version 4. |
| **Impact** | Second user gets `409 Conflict` — their changes are rejected. |
| **Detection** | `UPDATE contract SET ... WHERE id=X AND contract_version=3` affects 0 rows. Server checks row count and returns conflict. |
| **Recovery** | User re-reads the contract (now at version 4), re-applies their changes, and re-submits. UI should assist by showing diff between their changes and current state. |
| **Prevention** | Each contract has a `contract_version` counter incremented on every write. All updates include `WHERE contract_version = :read_version`. |

### FM-05: Phantom Read on Line Items

| Aspect | Detail |
|---|---|
| **When** | User A reads line items, User B adds a line item, User A saves changes — User A's save doesn't include User B's addition. |
| **Impact** | User B's line item is lost if not handled properly. |
| **Detection** | Contract aggregate re-reads all line items within the transaction. If new items appeared since read, the aggregate re-evaluates. |
| **Recovery** | The aggregate merges both sets of changes. New items from User B are retained, User A's edits on existing items are applied. |
| **Prevention** | Contract version covers the aggregate root only. Line item changes use their own optimistic locking or upsert semantics. |

### FM-06: Concurrent Activation Race

| Aspect | Detail |
|---|---|
| **When** | Two users click "Activate" simultaneously on the same DRAFT contract. |
| **Impact** | Both calls pass the status check (both read DRAFT), first succeeds, second hits optimistic lock failure. |
| **Detection** | Version check fails on second update. |
| **Recovery** | Second user sees `409 Conflict` with message "Contract was already activated by another user." |
| **Prevention** | Optimistic locking on `contract_version`. UI disables action button after first click. |

---

## 3. State Machine Failures

### FM-07: Invalid State Transition

| Aspect | Detail |
|---|---|
| **When** | API call attempts to terminate an already-ARCHIVED contract. |
| **Impact** | Transition is rejected. No data is changed. |
| **Detection** | State machine validator checks current status against allowed transitions. Returns `409 Conflict` with `current_status` and `allowed_transitions`. |
| **Recovery** | Client must use a valid transition. UI should only show allowed actions (filtered by `allowed_actions` returned from API). |
| **Prevention** | State machine is the single source of truth for transitions. Allowed actions are computed server-side and returned with every response. Frontend never guesses. |

### FM-08: Double Activation

| Aspect | Detail |
|---|---|
| **When** | Activate command arrives for an already-ACTIVE contract. |
| **Impact** | Rejected by state machine. Contract remains ACTIVE. |
| **Detection** | `POST .../activate` on ACTIVE contract returns `409 Conflict`. |
| **Recovery** | Client treats this as a no-op (the contract is already in the desired state). |
| **Prevention** | Idempotency key on activation request prevents duplicate submissions. |

### FM-09: Orphaned INCONSISTENT State

| Aspect | Detail |
|---|---|
| **When** | Contract enters INCONSISTENT state but no admin resolves it. System continues normally otherwise. |
| **Impact** | Contract is operationally dead — can't be modified or transitioned except to resolve. |
| **Detection** | Daily health check reports contracts in INCONSISTENT state. Dashboard shows alert. |
| **Recovery** | Admin resolves via `POST .../resolve`. Scheduler can auto-resolve if the inconsistency is transient (e.g., date was fixed by subsequent update). |
| **Prevention** | Automated tests validate all state entry/exit actions. Monitoring alerts on INCONSISTENT count > 0. |

---

## 4. Validation Failures

### FM-10: Invalid Date Range

| Aspect | Detail |
|---|---|
| **When** | User sets `end_date` before `start_date` or `renewal_date` after `end_date`. |
| **Impact** | Request rejected with `422 Validation Error`. |  |
| **Detection** | Pydantic `model_validator` checks `end_date > start_date` and `renewal_date < end_date`. Also checked at aggregate level. |
| **Recovery** | Client shows validation error per field. User corrects and resubmits. |
| **Prevention** | Dual validation: Pydantic schema (API layer) + aggregate invariants (domain layer). Both must pass. |

### FM-11: Duplicate Contract Number

| Aspect | Detail |
|---|---|
| **When** | User creates or updates a contract with a `contract_number` that already exists. |
| **Impact** | Request rejected with `422 Validation Error` — `contract_number` field shows uniqueness violation. |
| **Detection** | Database unique constraint on `contract_number` raises `IntegrityError`. Caught and mapped to validation error. |
| **Recovery** | UI suggests next available contract number. User selects a different number. |
| **Prevention** | Check uniqueness at aggregate level before DB insert. Auto-generation of contract numbers prevents duplicates. |

### FM-12: Invalid Vendor Reference

| Aspect | Detail |
|---|---|
| **When** | `vendor_id` references a non-existent or soft-deleted vendor. |
| **Impact** | Request rejected with `422 Validation Error`. |
| **Detection** | Aggregate queries vendor table, confirms existence and `is_deleted = FALSE`. |
| **Recovery** | Client shows `vendor_id` field error. |
| **Prevention** | Frontend populates vendor dropdown from live vendor list. Server validates regardless. |

### FM-13: Missing Required Documents

| Aspect | Detail |
|---|---|
| **When** | User attempts to activate a contract without uploading required documents (per contract type configuration). |
| **Impact** | Activation rejected with `422 Validation Error`. List of missing document categories returned. |
| **Detection** | Aggregate checks `contract_type.required_document_categories` against existing documents. |
| **Recovery** | User uploads missing documents and retries activation. |
| **Prevention** | UI shows required document checklist before activation. Upload button highlights missing categories. |

---

## 5. Event Bus / Async Failures

### FM-14: Event Emission Failure

| Aspect | Detail |
|---|---|
| **When** | Aggregate successfully writes to DB but fails to emit event (event bus unavailable). |
| **Impact** | Contract is updated in DB but no downstream effects occur (no timeline update, no notifications, no policy triggers). |
| **Detection** | Event emission returns error. Transaction has already committed. |
| **Recovery** | Event is written to `contract_event_log` table in the same transaction as the aggregate write. A background worker polls the event log for unprocessed events and emits them. If the event bus remains down, the worker retries with backoff. |
| **Prevention** | Outbox pattern: event is written to DB in same transaction as aggregate. Event bus consumption is a separate concern. |

### FM-15: Duplicate Event Delivery

| Aspect | Detail |
|---|---|
| **When** | Event bus delivers the same event twice (at-least-once delivery). |
| **Impact** | Subscriber runs handler twice. Could cause duplicate notifications, duplicate timeline entries. |
| **Detection** | Event idempotency key check. |
| **Recovery** | All event handlers check idempotency before processing. If event already processed, skip. |
| **Prevention** | Each event has a unique `event_id`. Subscribers store processed event IDs. See Event Catalog §10 for per-event idempotency. |

### FM-16: Event Processing Order Violation

| Aspect | Detail |
|---|---|
| **When** | `contract.terminated` arrives at subscriber before `contract.activated` (out of order delivery). |
| **Impact** | Subscriber tries to cancel renewals for a contract that doesn't yet have any (because activation hasn't been processed). |
| **Detection** | Subscriber checks aggregate status. If status is not yet ACTIVE, it cannot process TERMINATED. |
| **Recovery** | Subscriber rejects the event (re-queue with delayed retry). Once ACTIVATED is processed, retry succeeds. |
| **Prevention** | Event bus preserves per-aggregate ordering. If full ordering is not guaranteed, subscribers must be idempotent and state-checking. |

### FM-17: Stale Policy State

| Aspect | Detail |
|---|---|
| **When** | Policy reads aggregate state that is stale (another event modified it between policy read and policy write). |
| **Impact** | Policy makes decision based on stale data. |
| **Detection** | Optimistic lock failure on policy's write to aggregate. |
| **Recovery** | Policy re-reads state and re-evaluates. |
| **Prevention** | Policies are stateless — they only emit commands. The aggregate is the source of truth. Optimistic locking on aggregate writes protects against races. |

---

## 6. Scheduler Failures

### FM-18: Missed Expiry Check

| Aspect | Detail |
|---|---|
| **When** | Scheduler fails to run (downtime, restart) on the day a contract expires. |
| **Impact** | Contract remains ACTIVE past its end_date. Renewal window may not be detected. |
| **Detection** | Scheduler logs show gap in execution. Health check reports scheduler last-run timestamp. |
| **Recovery** | On next scheduler run, it processes all past-due contracts (not just today's). Query: `SELECT * FROM contract WHERE end_date < NOW() AND status='ACTIVE'`. |
| **Prevention** | Scheduler runs daily. Missed runs catch up on next cycle. Monitoring alerts if scheduler hasn't run in >36 hours. |

### FM-19: Duplicate Expiry Processing

| Aspect | Detail |
|---|---|
| **When** | Scheduler runs twice in one day (e.g., manual trigger + cron). |
| **Impact** | Expired contracts are processed twice. `contract.expired` events emitted twice. |
| **Detection** | Event idempotency check at contract aggregate level. |
| **Recovery** | Second `ExpireContract` command checks status. If already EXPIRED, skips and returns success (no-op). |
| **Prevention** | Scheduler idempotency: check `status != 'ACTIVE'` before processing. Lock file to prevent concurrent runs. |

### FM-20: Scheduler Overlap

| Aspect | Detail |
|---|---|
| **When** | Previous scheduler run still in progress when next run starts (dataset too large). |
| **Impact** | Both runs process overlapping contracts. Duplicate events. |
| **Detection** | Scheduler tracks `started_at` in a lock table. New run checks if previous is still running. |
| **Recovery** | New run skips if previous is still active. Overlap is logged for monitoring. |
| **Prevention** | Lock record in DB (`SELECT ... FOR UPDATE`). Batch processing with pagination. |

---

## 7. External Service Failures

### FM-21: Storage Provider Unavailable (Document Upload)

| Aspect | Detail |
|---|---|
| **When** | Document upload to S3/OneDrive/Blob Storage fails. |
| **Impact** | Document metadata is created in DB but file is not stored. Document is inaccessible. |
| **Detection** | Storage provider returns error during upload. |
| **Recovery** | Retry upload (3 attempts). If all fail, return 502 to client. Document record is not created (transaction rollback). |
| **Prevention** | Storage abstraction layer supports multiple providers. Health check monitors storage availability. |

### FM-22: Email Service Failure (Notifications)

| Aspect | Detail |
|---|---|
| **When** | Resend/SendGrid API returns error during notification dispatch. |
| **Impact** | Notification status set to `FAILED`. User doesn't receive email. |
| **Detection** | Email API returns non-200 response. |
| **Recovery** | Retry queue with exponential backoff (5 attempts). After exhaustion, notification status remains `FAILED` and is surfaced in dashboard. |
| **Prevention** | Multiple email providers configured. Fallback to SMS for critical notifications. |

### FM-23: ERP/CLM Sync Failure

| Aspect | Detail |
|---|---|
| **When** | Integration with external ERP system fails during sync. |
| **Impact** | Contract data out of sync between systems. |
| **Detection** | `system.integration.sync.failed` event emitted. |
| **Recovery** | Scheduled retry with full data diff. Manual trigger available for admin. |
| **Prevention** | Idempotent sync operations. Checksum verification. Audit log for sync status. |

---

## 8. Data Integrity Failures

### FM-24: Soft-Delete Orphans

| Aspect | Detail |
|---|---|
| **When** | Contract is soft-deleted but line items or documents are not (bug or race condition). |
| **Impact** | Orphaned records with no parent. Reporting produces incorrect counts. |
| **Detection** | Daily validation query: `SELECT COUNT(*) FROM contract_line_item cli JOIN contract c ON cli.contract_id = c.id WHERE c.is_deleted=TRUE AND cli.is_deleted=FALSE`. |
| **Recovery** | Background job cascades soft delete to orphans. |
| **Prevention** | Application code always cascades soft deletes in the same transaction. DB-level trigger for defense in depth. |

### FM-25: Negative Financial Values

| Aspect | Detail |
|---|---|
| **When** | Bug in line item calculation produces negative `line_total` or `total_contract_value`. |
| **Impact** | Financial reports show negative values. Dashboard displays incorrect data. |
| **Detection** | Aggregate invariant rejects negative values. If it passes, health check detects anomaly. |
| **Recovery** | Contract is marked INCONSISTENT. Admin corrects values via resolve flow. |
| **Prevention** | Pydantic schema validates `rate >= 0`, `quantity > 0`, `discount_percent >= 0 AND <= 100`. Aggregate enforces `total_contract_value >= 0`. |

### FM-26: Contract Version Desync

| Aspect | Detail |
|---|---|
| **When** | `contract_version` counter is updated but version history entry is not created (or vice versa). |
| **Impact** | Version history is incomplete. Audit trail breaks. |
| **Detection** | Validation query: `SELECT c.id, c.contract_version, COUNT(cvh.id) FROM contract c LEFT JOIN contract_version_history cvh ON c.id = cvh.contract_id GROUP BY c.id HAVING c.contract_version != COUNT(cvh.id)`. |
| **Recovery** | Background job recreates missing version history entries from event log. |
| **Prevention** | Version history and version counter are updated in the same transaction. |

---

## 9. API / Client Failures

### FM-27: Client Sends Invalid JSON

| Aspect | Detail |
|---|---|
| **When** | Malformed request body (syntax error, wrong types, extra fields). |
| **Impact** | Request rejected at API layer. |
| **Detection** | Pydantic validation error. Caught by `@handle_validation_error` decorator. |
| **Recovery** | Client receives `422` with field-level error details. |
| **Prevention** | Frontend validates before sending. TypeScript types match Pydantic schemas. |

### FM-28: Token Expired Mid-Request

| Aspect | Detail |
|---|---|
| **When** | JWT token expires while user is filling out a contract form. |
| **Impact** | API call returns `401 Unauthorized`. |
| **Detection** | `@token_required` decorator checks JWT expiry before processing. |
| **Recovery** | Client refreshes token using refresh token. User loses unsaved form data (UX concern). |
| **Prevention** | Token refresh interceptor in frontend. Auto-save draft every 30 seconds. |

### FM-29: Large Payload Exceeds Limit

| Aspect | Detail |
|---|---|
| **When** | Upload of a file >50MB, or contract with 1000+ line items. |
| **Impact** | Request rejected with `413 Payload Too Large` or timeout. |
| **Detection** | Flask `MAX_CONTENT_LENGTH` check (50MB for uploads). |
| **Recovery** | Client splits into batches (for line items) or compresses (for files). |
| **Prevention** | Frontend enforces file size limits. Line item bulk import via CSV for large datasets. |

---

## 10. Recovery Summary

### Recovery Priority Matrix

| Impact | High Frequency | Low Frequency |
|---|---|---|
| **Critical** | FM-01 (DB connection lost) — auto-reconnect + 503 | FM-17 (stale policy) — optimistic lock retry |
| **High** | FM-04 (optimistic lock) — user re-applies | FM-09 (orphaned INCONSISTENT) — admin resolve |
| **Medium** | FM-10 (invalid dates) — client re-input | FM-14 (event emission failure) — outbox worker |
| **Low** | FM-27 (invalid JSON) — client re-sends | FM-20 (scheduler overlap) — auto-skip |

### Automatic Recovery (No Human Intervention)

| Failure | Recovery Mechanism | Time |
|---|---|---|
| DB connection lost | Connection pool retry (3x) | <10s |
| Query timeout | Client retry with backoff | <30s |
| Deadlock | PostgreSQL auto-rollback + retry | <5s |
| Optimistic lock conflict | Client re-read + re-apply | User-driven |
| Invalid state transition | Rejected with `allowed_actions` | Instant |
| Event emission failure | Outbox worker | <60s |
| Duplicate event delivery | Idempotency check in handler | Instant |
| Missed scheduler run | Catch-up on next run | <24h |
| Duplicate scheduler processing | Status check before action | Instant |

### Manual Recovery (Admin Required)

| Failure | Recovery Action | Priority |
|---|---|---|
| Orphaned INCONSISTENT state | `POST .../resolve` with corrections | High |
| Soft-delete orphans | Run background cleanup job | Medium |
| Contract version desync | Run version history rebuild from event log | Medium |
| ERP sync failure | Manual trigger full sync | Low |
| Negative financial values | Mark INCONSISTENT, correct data, resolve | High |

### Prevention by Layer

| Layer | Primary Prevention | Secondary Prevention |
|---|---|---|
| API (Pydantic) | Request validation | TypeScript type matching |
| Aggregate (Domain) | Invariant enforcement | State machine guards |
| Database | Constraints (UNIQUE, CHECK, FK) | Triggers for cross-table consistency |
| Event Bus | Outbox pattern | Idempotency handlers |
| Scheduler | Idempotent operation | Lock files, catch-up logic |
| Storage | Multi-provider fallback | Retry with backoff |
| Monitoring | Health checks | Alert on anomaly |
