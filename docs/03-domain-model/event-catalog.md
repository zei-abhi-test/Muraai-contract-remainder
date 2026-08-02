# Event Catalog

**Status:** Draft (Sprint 1 — expanded)
**Date:** 2026-07-20
**Purpose:** Single source of truth for every domain event. Essential before building the event bus.

---

## Conventions

| Column | Meaning |
|---|---|
| **Event** | Canonical name. Dot-notation for hierarchy (e.g., `renewal.quote.received`) |
| **Trigger** | What causes this event — command, policy, scheduler, or external system |
| **Publisher** | Aggregate that emits the event |
| **Subscribers** | Components that consume the event |
| **Idempotent** | Can the handler safely run twice? (Yes = at-least-once delivery OK) |
| **Retry** | Should the bus retry on failure? |
| **Version** | Schema version for forward/backward compat |
| **Schema** | Key fields in the event payload |

---

## 1. Renewal Events

| Event | Trigger | Publisher | Subscribers | Idempotent | Retry | Version | Schema |
|---|---|---|---|---|---|---|---|
| `renewal.created` | CreateRenewal command | Renewal Aggregate | Timeline, ActivityLog, MissionControl | Yes | Yes | v1 | renewal_id, contract_id, year, created_by, created_at |
| `renewal.assigned` | AssignRenewal command | Renewal Aggregate | Timeline, ActivityLog, Notifications, SLAPolicy | Yes | Yes | v1 | renewal_id, assigned_to, assigned_by, assigned_at |
| `renewal.unassigned` | UnassignRenewal command | Renewal Aggregate | Timeline, ActivityLog, SLAPolicy | Yes | Yes | v1 | renewal_id, previous_assignee, unassigned_by |
| `renewal.quote.received` | RecordQuote command | Renewal Aggregate | Timeline, ActivityLog, Notifications, QuoteAwaitingPolicy | Yes | Yes | v1 | renewal_id, amount, currency, vendor_quote_ref, document_url |
| `renewal.quote.updated` | UpdateQuote command | Renewal Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | renewal_id, previous_amount, new_amount |
| `renewal.negotiation.started` | RequestNegotiation command | Renewal Aggregate | Timeline, ActivityLog, Notifications | Yes | Yes | v1 | renewal_id, current_amount, target_amount |
| `renewal.budget.check` | CheckBudget command | Renewal Aggregate | BudgetService | Yes | Yes | v1 | renewal_id, budget_code, quote_amount |
| `renewal.budget.passed` | Policy evaluation result | BudgetService | Timeline, ActivityLog, Notifications, BudgetApprovalPolicy | Yes | Yes | v1 | renewal_id, budget_code, approved_amount |
| `renewal.budget.review_needed` | BudgetService evaluation | BudgetService | Timeline, ActivityLog, Notifications, SLAPolicy | Yes | Yes | v1 | renewal_id, quote_amount, available_budget |
| `renewal.budget.override.approved` | ApproveBudgetOverride command | Renewal Aggregate | Timeline, ActivityLog, Notifications | Yes | Yes | v1 | renewal_id, overridden_by, override_amount |
| `renewal.legal.review_started` | SendToLegal command | Renewal Aggregate | Timeline, ActivityLog, Notifications, LegalReviewSLAPolicy | Yes | Yes | v1 | renewal_id, legal_approver_id, sla_deadline |
| `renewal.legal.approved` | LegalApprove command | Renewal Aggregate | Timeline, ActivityLog, Notifications, BudgetApprovalPolicy | Yes | Yes | v1 | renewal_id, approved_by, comments, decided_at |
| `renewal.legal.rejected` | LegalReject command | Renewal Aggregate | Timeline, ActivityLog, Notifications | Yes | Yes | v1 | renewal_id, rejected_by, reason |
| `renewal.business.approval_started` | SendToBusinessApproval command (auto) | Renewal Aggregate | Timeline, ActivityLog, Notifications, BusinessApprovalEscalationPolicy | Yes | Yes | v1 | renewal_id, business_owner_id, sla_deadline |
| `renewal.business.approved` | BusinessApprove command | Renewal Aggregate | Timeline, ActivityLog, Notifications, POGenerationPolicy | Yes | Yes | v1 | renewal_id, approved_by, attestation_id, decided_at |
| `renewal.business.rejected` | BusinessReject command | Renewal Aggregate | Timeline, ActivityLog, Notifications | Yes | Yes | v1 | renewal_id, rejected_by, reason |
| `renewal.attestation.submitted` | SubmitAttestation command | Renewal Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | renewal_id, attested_by, still_required, user_count |
| `renewal.attestation.expired` | Scheduler check | Scheduler | Renewal Aggregate, Notifications | Yes | Yes | v1 | renewal_id, previous_attestation_id |
| `renewal.po.draft_created` | GeneratePO command (auto) | Procurement / PO Aggregate | Timeline, ActivityLog, Notifications | Yes | Yes | v1 | renewal_id, po_id, total_amount, po_number |
| `renewal.po.sent` | SendPO command | Procurement / PO Aggregate | Timeline, ActivityLog, Notifications, POFollowUpPolicy | Yes | Yes | v1 | renewal_id, po_id, sent_method, sent_at |
| `renewal.po.acknowledged` | Vendor acknowledgment (recorded) | Procurement / PO Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | renewal_id, po_id, acknowledged_at |
| `renewal.po.rejected` | Vendor rejection (recorded) | Procurement / PO Aggregate | Timeline, ActivityLog, Notifications | Yes | Yes | v1 | renewal_id, po_id, rejection_reason |
| `renewal.invoice.received` | RecordInvoice command | Financial / Invoice Aggregate | Timeline, ActivityLog, Notifications, InvoiceMatchPolicy | Yes | Yes | v1 | renewal_id, invoice_id, invoice_amount, currency |
| `renewal.invoice.matched` | MatchInvoice command (auto) | Financial / Invoice Aggregate | Timeline, ActivityLog, FinancialForecast | Yes | Yes | v1 | renewal_id, invoice_id, variance_amount, variance_pct |
| `renewal.payment.done` | RecordPayment command | Financial / Invoice Aggregate | Timeline, ActivityLog, NotificationEngine | Yes | Yes | v1 | renewal_id, invoice_id, payment_reference, paid_at |
| `renewal.completed` | CompleteRenewal command (auto) | Renewal Aggregate | Timeline, ActivityLog, ContractAggregate, MissionControl, Forecasting | Yes | Yes | v1 | renewal_id, contract_id, year, total_spend, completed_at |
| `renewal.cancelled` | CancelRenewal command | Renewal Aggregate | Timeline, ActivityLog, Notifications, ContractAggregate | Yes | Yes | v1 | renewal_id, reason, cancelled_by, cancelled_at |
| `renewal.on_hold` | HoldRenewal command | Renewal Aggregate | Timeline, ActivityLog, Notifications | Yes | Yes | v1 | renewal_id, hold_reason, hold_until |
| `renewal.resumed` | ResumeRenewal command | Renewal Aggregate | Timeline, ActivityLog, Notifications | Yes | Yes | v1 | renewal_id, resumed_to_status |
| `renewal.escalated` | EscalateRenewal command (manual or auto) | Renewal Aggregate | Timeline, ActivityLog, Notifications, EscalationPolicy | Yes | Yes | v1 | renewal_id, escalation_level, escalated_to, reason |
| `renewal.escalation.resolved` | ResolveEscalation command | Renewal Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | renewal_id, resolved_by |
| `renewal.stalled` | StalledDetectionPolicy (scheduler) | Scheduler / Policy Engine | Timeline, ActivityLog, Notifications, StalledEscalationPolicy | Yes | Yes | v1 | renewal_id, current_status, days_in_status |
| `renewal.sla.breached` | SLA timer expiry | SLA Engine | Timeline, ActivityLog, Notifications, EscalationPolicy | Yes | Yes | v1 | renewal_id, approval_type, sla_deadline, escalation_level |
| `renewal.risk.changed` | Risk score recomputation | Renewal Aggregate | MissionControl, Notifications | Yes | Yes | v1 | renewal_id, previous_score, new_score, level |

---

## 2. Contract Events

| Event | Trigger | Publisher | Subscribers | Idempotent | Retry | Version | Schema |
|---|---|---|---|---|---|---|---|
| `contract.drafted` | CreateContract command | Contract Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | contract_id, vendor_id, contract_number, contract_name, start_date, end_date, created_by |
| `contract.activated` | ActivateContract command | Contract Aggregate | Timeline, ActivityLog, RenewalDetectionPolicy | Yes | Yes | v1 | contract_id, activated_at, activated_by, previous_status |
| `contract.updated` | UpdateContract command | Contract Aggregate | Timeline, ActivityLog, RenewalAggregate | Yes | Yes | v1 | contract_id, changed_fields, updated_by, version |
| `contract.amended` | UpdateContract on ACTIVE contract | Contract Aggregate | Timeline, ActivityLog, RenewalAggregate | Yes | Yes | v1 | contract_id, changed_fields, updated_by, previous_version, new_version, amendment_reason |
| `contract.expired` | Scheduler detection | Scheduler | Timeline, ActivityLog, Notifications, RenewalAggregate | Yes | Yes | v1 | contract_id, end_date, days_overdue |
| `contract.terminated` | TerminateContract command | Contract Aggregate | Timeline, ActivityLog, Notifications, RenewalAggregate | Yes | Yes | v1 | contract_id, reason, terminated_by, terminated_at |
| `contract.archived` | ArchiveContract command | Contract Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | contract_id, archived_by, retention_until |
| `contract.marked_inconsistent` | DetectInconsistency command | Contract Aggregate | Timeline, ActivityLog, Notifications | Yes | Yes | v1 | contract_id, reason, detected_by, inconsistent_fields |
| `contract.resolved` | ResolveInconsistency command | Contract Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | contract_id, resolved_by, corrections_applied, returned_status |
| `contract.deleted` | DeleteContract command (soft) | Contract Aggregate | Timeline, ActivityLog, SearchIndex | Yes | Yes | v1 | contract_id, deleted_by, deletion_reason |
| `contract.renewal_window_opened` | Scheduler: end_date within window | Scheduler | RenewalDetectionPolicy | Yes | Yes | v1 | contract_id, end_date, renewal_window_days |
| `contract.renewal_count.incremented` | Renewal completed | Renewal Aggregate | Contract Aggregate | Yes | Yes | v1 | contract_id, new_renewal_count, latest_renewal_id, latest_renewal_year |
| `contract.health.changed` | Health recomputation (scheduler or event) | Scheduler / HealthService | MissionControl, Notifications | Yes | Yes | v1 | contract_id, previous_health, new_health, reason |
| `contract.line_item_added` | AddLineItem command | Contract Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | contract_id, line_item_id, product_id, quantity, line_total |
| `contract.line_item_updated` | UpdateLineItem command | Contract Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | contract_id, line_item_id, changed_fields |
| `contract.line_item_removed` | RemoveLineItem command (soft) | Contract Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | contract_id, line_item_id, product_name, reason |
| `contract.document_added` | AddDocument command | Contract Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | contract_id, document_id, file_name, category, uploaded_by |
| `contract.document_updated` | ReplaceDocument command (versioning) | Contract Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | contract_id, document_id, new_version, previous_version |
| `contract.document_removed` | RemoveDocument command (soft) | Contract Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | contract_id, document_id, file_name |
| `contract.clause_added` | AddClause command | Contract Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | contract_id, clause_id, clause_type |
| `contract.clause_updated` | UpdateClause command | Contract Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | contract_id, clause_id, clause_type, new_version |
| `contract.clause_removed` | RemoveClause command (soft) | Contract Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | contract_id, clause_id, clause_type |

---

## 3. Purchase Order Events

| Event | Trigger | Publisher | Subscribers | Idempotent | Retry | Version | Schema |
|---|---|---|---|---|---|---|---|
| `po.created` | GeneratePO command | PO Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | po_id, renewal_id, total_amount, po_number |
| `po.sent` | SendPO command | PO Aggregate | Timeline, ActivityLog, POFollowUpPolicy | Yes | Yes | v1 | po_id, renewal_id, sent_method, sent_at |
| `po.acknowledged` | RecordPOAck command | PO Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | po_id, renewal_id, acknowledged_at |
| `po.rejected` | RecordPORejection command | PO Aggregate | Timeline, ActivityLog, Notifications | Yes | Yes | v1 | po_id, renewal_id, rejection_reason |
| `po.cancelled` | CancelPO command | PO Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | po_id, renewal_id, reason |
| `po.send_failed` | Email delivery failure | NotificationEngine | Timeline, ActivityLog, Notifications | Yes | Yes | v1 | po_id, renewal_id, error, retry_count |
| `po.ack_overdue` | POFollowUpPolicy (scheduler) | POFollowUpPolicy | Notifications, SLAPolicy | Yes | Yes | v1 | po_id, renewal_id, days_since_sent |

---

## 4. Invoice Events

| Event | Trigger | Publisher | Subscribers | Idempotent | Retry | Version | Schema |
|---|---|---|---|---|---|---|---|
| `invoice.received` | RecordInvoice command | Invoice Aggregate | Timeline, ActivityLog, InvoiceMatchPolicy | Yes | Yes | v1 | invoice_id, po_id, renewal_id, amount, currency |
| `invoice.matched` | MatchInvoice command (auto) | Invoice Aggregate | Timeline, ActivityLog, Forecasting | Yes | Yes | v1 | invoice_id, po_id, variance_amount, variance_pct |
| `invoice.exception.created` | Variance outside tolerance | InvoiceMatchPolicy | Timeline, ActivityLog, Notifications | Yes | Yes | v1 | invoice_id, po_id, variance_reason, variance_amount |
| `invoice.exception.resolved` | ResolveException command | Invoice Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | invoice_id, resolved_by, resolution_type |
| `invoice.payment.scheduled` | SchedulePayment command | Invoice Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | invoice_id, scheduled_date |
| `invoice.payment.done` | RecordPayment command | Invoice Aggregate | Timeline, ActivityLog, Forecasting, RenewalAggregate | Yes | Yes | v1 | invoice_id, payment_reference, paid_at |
| `invoice.cancelled` | CancelInvoice command | Invoice Aggregate | Timeline, ActivityLog | Yes | Yes | v1 | invoice_id, reason |

---

## 5. Vendor Events

| Event | Trigger | Publisher | Subscribers | Idempotent | Retry | Version | Schema |
|---|---|---|---|---|---|---|---|
| `vendor.created` | CreateVendor command | Vendor Aggregate | ActivityLog | Yes | Yes | v1 | vendor_id, name, vendor_code |
| `vendor.updated` | UpdateVendor command | Vendor Aggregate | ActivityLog | Yes | Yes | v1 | vendor_id, changed_fields |
| `vendor.risk.rating.changed` | RiskRatingUpdate command | Vendor Aggregate | MissionControl | Yes | Yes | v1 | vendor_id, previous_rating, new_rating |

---

## 6. User & Auth Events

| Event | Trigger | Publisher | Subscribers | Idempotent | Retry | Version | Schema |
|---|---|---|---|---|---|---|---|
| `user.created` | CreateUser command | User Aggregate | ActivityLog | Yes | Yes | v1 | user_id, email, role |
| `user.login` | Login success | Auth Service | ActivityLog, LoginHistory | Yes | Yes | v1 | user_id, ip_address, timestamp |
| `user.role.changed` | UpdateUserRole command | User Aggregate | ActivityLog, AllAggregates | Yes | Yes | v1 | user_id, previous_role, new_role |

---

## 7. System Events

| Event | Trigger | Publisher | Subscribers | Idempotent | Retry | Version | Schema |
|---|---|---|---|---|---|---|---|
| `system.health.ok` | Health check pass | HealthService | Monitoring | Yes | No | v1 | service, timestamp |
| `system.health.failed` | Health check fail | HealthService | Monitoring, Notifications | Yes | Yes | v1 | service, error, timestamp |
| `system.integration.sync.completed` | ERP/CLM sync job | IntegrationService | ActivityLog | Yes | No | v1 | integration_type, records_synced, duration |
| `system.integration.sync.failed` | Sync job failure | IntegrationService | ActivityLog, Notifications | Yes | Yes | v1 | integration_type, error, retry_count |

---

## 8. Event Versioning Policy

### When to bump the version

| Change | Version Bump | Migration Required |
|---|---|---|
| Add optional field | Minor (v1 → v1.1) | No — consumers ignore unknown fields |
| Add required field | Major (v1 → v2) | Yes — all consumers must update |
| Remove field | Major (v1 → v2) | Yes — all consumers must update |
| Rename field | Major (v1 → v2) | Yes |
| Change field type | Major (v1 → v2) | Yes |

### Backward Compatibility

- Consumers should ignore unknown fields
- Consumers should provide defaults for new optional fields
- The event bus may run multiple versions simultaneously during migration
- Deprecated versions are supported for minimum 6 months

---

## 9. Event Flow Diagram

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Command    │────►│   Aggregate      │────►│     Event        │
│              │     │  (validate +     │     │                  │
│              │     │   execute + emit) │     │                  │
└──────────────┘     └──────────────────┘     └────────┬─────────┘
                                                        │
                                          ┌─────────────┼─────────────┐
                                          ▼             ▼             ▼
                                   ┌──────────┐ ┌──────────┐ ┌──────────┐
                                   │ Timeline │ │Policy    │ │Activity  │
                                   │ (write)  │ │(process) │ │Log (write)
                                   └──────────┘ └────┬─────┘ └──────────┘
                                                      │
                                                      ▼
                                             ┌──────────────────┐
                                             │    Command(s)    │
                                             │  (next step)     │
                                              └──────────────────┘
```

---

## 10. Event Replayability

Defines for every domain event whether it can be safely replayed, what happens on replay, and whether replay is destructive or idempotent-safe.

### Replayability Categories

| Category | Label | Behavior |
|---|---|---|
| **Safe** | Idempotent | Replaying produces the same result. No side effects. |
| **Conditional** | State-dependent | Safe only if the aggregate is in the correct state. May skip if already applied. |
| **Destructive** | Not idempotent | Replaying would produce incorrect state. Must NOT be replayed. |
| **Skip** | No-op | Replay handler checks if event already applied and skips. |

### Contract Events

| Event | Category | Replay Behavior | What It Rebuilds |
|---|---|---|---|
| `contract.drafted` | Conditional | Skips if contract_id already exists (checked by draft detection). Creates contract in DRAFT. | Contract record |
| `contract.activated` | Conditional | Only applies if contract status is DRAFT. Rebuilds activation timestamp. | Contract status + activation metadata |
| `contract.updated` | Safe | Applies changed_fields. Later events may overwrite. Rebuilds field values at point in time. | Contract field values |
| `contract.amended` | Safe | Applies amendment fields. Non-destructive — creates new version entry. | Amendment record + version history |
| `contract.expired` | Conditional | Only applies if contract is ACTIVE. Rebuilds expiry detection. | Expiry status + notification trigger |
| `contract.terminated` | Destructive | MUST not replay if contract has been reactivated. Only safe if contract is still ACTIVE. | Termination status |
| `contract.archived` | Conditional | Only applies if contract is EXPIRED or TERMINATED. | Archive status + retention metadata |
| `contract.marked_inconsistent` | Conditional | Only applies if contract is in valid state. Rebuilds inconsistency flag. | Inconsistency record |
| `contract.resolved` | Conditional | Only applies if contract is INCONSISTENT. Rebuilds corrected state. | Correction record + restored status |
| `contract.deleted` | Destructive | MUST not replay unless contract was restored. Un-delete after replay is dangerous. | Soft-delete flag |
| `contract.renewal_window_opened` | Safe | Re-checking the renewal window is idempotent. May trigger duplicate RenewalDetectionPolicy (handled by policy idempotency). | Renewal window detection |
| `contract.renewal_count.incremented` | Destructive | MUST not replay — counter would double. The count is only meaningful once. | Renewal count |
| `contract.health.changed` | Safe | Health is always recomputed from current data. Replay produces correct health. | Health status |
| `contract.line_item_added` | Conditional | Skips if line_item_id already exists (deduplication by line_item_id). | Line item record |
| `contract.line_item_updated` | Safe | Overwrites line item fields. Non-destructive — latest value wins. | Line item field values |
| `contract.line_item_removed` | Conditional | Skips if line item is already deleted. Sets is_deleted flag. | Deletion flag on line item |
| `contract.document_added` | Conditional | Skips if document_id already exists. Rebuilds document metadata. | Document record |
| `contract.document_updated` | Safe | Creates new version entry. Previous version retained. | Document version history |
| `contract.document_removed` | Conditional | Skips if already deleted. Sets is_deleted flag. | Deletion flag on document |
| `contract.clause_added` | Conditional | Skips if clause_id already exists. | Clause record |
| `contract.clause_updated` | Safe | Overwrites clause content. Version incremented. | Clause content + version |
| `contract.clause_removed` | Conditional | Skips if already deleted. Sets is_deleted flag. | Deletion flag on clause |

### Renewal Events

| Event | Category | Replay Behavior | What It Rebuilds |
|---|---|---|---|
| `renewal.created` | Conditional | Skips if renewal_id exists. Creates renewal in initial status. | Renewal record |
| `renewal.assigned` | Safe | Overwrites assignee. Latest assignment wins. | Assignee field |
| `renewal.unassigned` | Safe | Clears assignee. Safe to replay multiple times. | Assignee cleared |
| `renewal.quote.received` | Conditional | Only applies if renewal is in quote-awaiting state. Skips if quote already recorded. | Quote record |
| `renewal.quote.updated` | Safe | Overwrites quote values. Latest wins. | Quote values |
| `renewal.negotiation.started` | Conditional | Only applies in valid negotiation-entry state. | Negotiation status |
| `renewal.budget.check` | Safe | Re-runs budget check. Produces same or updated result. | Budget check request (triggers policy) |
| `renewal.budget.passed` | Safe | Rebuilds budget approval. Non-destructive. | Budget approval record |
| `renewal.budget.review_needed` | Safe | Rebuilds budget review requirement. May trigger notification again (handled by dedup). | Review request |
| `renewal.budget.override.approved` | Conditional | Only applies if budget review is pending. | Override record |
| `renewal.legal.review_started` | Conditional | Only applies in valid entry state. | Legal review status |
| `renewal.legal.approved` | Conditional | Only applies if legal review is pending. | Legal approval record |
| `renewal.legal.rejected` | Conditional | Only applies if legal review is pending. | Legal rejection record |
| `renewal.business.approval_started` | Conditional | Only applies in valid entry state. | Business approval status |
| `renewal.business.approved` | Conditional | Only applies if business approval is pending. | Business approval record |
| `renewal.business.rejected` | Conditional | Only applies if business approval is pending. | Business rejection record |
| `renewal.attestation.submitted` | Safe | Overwrites attestation. Latest wins. | Attestation record |
| `renewal.attestation.expired` | Conditional | Only applies if current attestation exists and is not expired. | Attestation expiration |
| `renewal.po.draft_created` | Conditional | Skips if PO already exists for this renewal+year. | PO draft record |
| `renewal.po.sent` | Safe | Updates PO sent status. Safe to replay — same sent_method and timestamp. | PO sent status |
| `renewal.po.acknowledged` | Safe | Overwrites acknowledgment. Latest wins. | PO acknowledgment |
| `renewal.po.rejected` | Destructive | MUST not replay — would overwrite a subsequent acknowledgment. | PO rejection status |
| `renewal.invoice.received` | Conditional | Skips if invoice_id already exists. | Invoice record |
| `renewal.invoice.matched` | Safe | Re-runs matching logic. May produce different variance if amounts changed. | Match result |
| `renewal.payment.done` | Destructive | MUST not replay — payment is an external action. Replay could double-count. | Payment record |
| `renewal.completed` | Destructive | MUST not replay — would re-trigger downstream effects (renewal count increment, forecasting). | Completion status |
| `renewal.cancelled` | Destructive | MUST not replay — contract may have a later active renewal. | Cancellation status |
| `renewal.on_hold` | Safe | Overwrites hold status. Safe to replay. | Hold status |
| `renewal.resumed` | Conditional | Only applies if renewal is ON_HOLD. | Resume status |
| `renewal.escalated` | Safe | Overwrites escalation level. Latest wins. | Escalation record |
| `renewal.escalation.resolved` | Safe | Clears escalation. Safe to replay. | Escalation resolved |
| `renewal.stalled` | Safe | Overwrites stall detection. Safe to replay. | Stall detection record |
| `renewal.sla.breached` | Conditional | Only applies if SLA is active and not already breached. | SLA breach record |
| `renewal.risk.changed` | Safe | Overwrites risk score. Latest computed value wins. | Risk score |

### PO Events

| Event | Category | Replay Behavior | What It Rebuilds |
|---|---|---|---|
| `po.created` | Conditional | Skips if po_id exists. | PO record |
| `po.sent` | Safe | Updates sent status. | PO sent status |
| `po.acknowledged` | Safe | Overwrites acknowledgment. | PO acknowledgment |
| `po.rejected` | Destructive | MUST not replay — would overwrite subsequent ack. | PO rejection |
| `po.cancelled` | Destructive | MUST not replay — PO may have been re-issued. | PO cancellation |
| `po.send_failed` | Safe | Appends failure record. | Failure record |
| `po.ack_overdue` | Safe | Re-detects overdue. Safe to replay. | Overdue detection |

### Invoice Events

| Event | Category | Replay Behavior | What It Rebuilds |
|---|---|---|---|
| `invoice.received` | Conditional | Skips if invoice_id exists. | Invoice record |
| `invoice.matched` | Safe | Re-runs match. May produce different variance. | Match result |
| `invoice.exception.created` | Conditional | Skips if exception already exists. | Exception record |
| `invoice.exception.resolved` | Conditional | Only applies if exception is open. | Exception resolution |
| `invoice.payment.scheduled` | Safe | Overwrites schedule. Latest wins. | Payment schedule |
| `invoice.payment.done` | Destructive | MUST not replay — external payment. Double-count risk. | Payment record |
| `invoice.cancelled` | Destructive | MUST not replay — invoice may have been reinstated. | Cancellation |

### Vendor Events

| Event | Category | Replay Behavior | What It Rebuilds |
|---|---|---|---|
| `vendor.created` | Conditional | Skips if vendor_id exists. | Vendor record |
| `vendor.updated` | Safe | Overwrites fields. Latest wins. | Vendor field values |
| `vendor.risk.rating.changed` | Safe | Overwrites rating. Latest wins. | Risk rating |

### User & Auth Events

| Event | Category | Replay Behavior | What It Rebuilds |
|---|---|---|---|
| `user.created` | Conditional | Skips if user_id exists. | User record |
| `user.login` | Safe | Appends login record. Safe — each event is unique by timestamp. | Login history |
| `user.role.changed` | Safe | Overwrites role. Latest wins. | User role |

### System Events

| Event | Category | Replay Behavior | What It Rebuilds |
|---|---|---|---|
| `system.health.ok` | Safe | No-op on replay. Just updates timestamp. | Health check |
| `system.health.failed` | Safe | No-op on replay. Just updates timestamp. | Health check |
| `system.integration.sync.completed` | Safe | No-op on replay. Sync log is append-only. | Sync log |
| `system.integration.sync.failed` | Safe | No-op on replay. Sync log is append-only. | Sync log |

### Replay Orchestration Rules

1. **Contract events must be replayed in order** — later events depend on earlier status changes.
2. **Renewal events must be replayed per-renewal** — each renewal has its own event stream.
3. **Cross-aggregate replay** is not supported. Events that reference other aggregates (e.g., `renewal.po.draft_created`) assume the referenced aggregate already exists.
4. **Destructive events** are excluded from bulk replay. They can only be replayed individually with manual verification.
5. **Replay safety check**: Before bulk replay, run `SELECT event_type, COUNT(*) FROM contract_event_log GROUP BY event_type` to identify any destructive events in the stream.
6. **Replay window**: Bulk replay should only cover events within a specific time range, not the entire history, to avoid replaying already-compensated events.
