# Domain Stabilization — Aggregate Boundaries & Invariants

**Sprint:** 0.5
**Status:** Draft
**Date:** 2026-07-20

---

## 1. Aggregate Boundaries (Final)

```
┌──────────────────────────────────────────────────────────────────┐
│                     CONTRACT AGGREGATE                           │
│                                                                  │
│  Contract (AR)                                                   │
│  ├── ContractLineItem (child, composition)                       │
│  ├── ContractDocument (child, composition)                       │
│  ├── ContractClause (child, composition)                         │
│  ├── ContractVersionHistory (child, composition)                 │
│  │                                                                │
│  └── References out:                                              │
│       ├── Product (via product_id on line items)                  │
│       ├── Vendor (via vendor_id)                                  │
│       ├── User (via created_by, last_modified_by)                 │
│                                                                    │
│  Conceptually owns Renewals (1:N) — but NOT transactionally.      │
│  Renewal references Contract; Contract does NOT own Renewal       │
│  in the aggregate sense. Renewal has its own transaction boundary.│
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     RENEWAL AGGREGATE                             │
│                                                                  │
│  Renewal (AR)                                                    │
│  ├── ApprovalRecord (child, composition)                         │
│  ├── UsageAttestation (child, composition)                       │
│  ├── RenewalTimelineEntry (child, composition)                   │
│  ├── RenewalDocument (child, composition — docs scoped to        │
│  │   this renewal, not the contract)                             │
│  ├── RenewalEmail (child, composition — vendor communication)    │
│  ├── RenewalNote (child, composition)                            │
│  ├── RenewalTask (child, composition — tasks scoped to renewal)  │
│  │                                                                │
│  │  Mandatory: cannot exist without a Contract.                    │
│  │  Contract = long-lived agreement; Renewal = one operational    │
│  │  cycle. Different things, different lifetimes, different txns. │
│  │                                                                │
│  └── References out:                                              │
│       ├── Contract (via contract_id — MANDATORY)                  │
│       ├── PurchaseOrder (0..1 — PO created from this renewal)    │
│       ├── Invoice (0..1 — invoice matched to this renewal)       │
│       ├── User (via assigned_to, created_by, etc.)               │
│       └── Product (via line items)                               │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     VENDOR AGGREGATE                              │
│                                                                  │
│  Vendor (AR)                                                     │
│  ├── VendorContact (child, composition)                          │
│  ├── VendorScorecard (child, composition — 0..1 per period)      │
│  └── References out: Contract (1:N), PO (1:N), Invoice (1:N)    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     PRODUCT AGGREGATE                             │
│                                                                  │
│  Product (AR)                                                    │
│  └── References out: ContractLineItem (1:N — read-only ref)     │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     PURCHASE ORDER AGGREGATE                      │
│                                                                  │
│  PurchaseOrder (AR)                                              │
│  ├── POLineItem (child, composition)                             │
│  └── References out: Vendor, Renewal, Contract, Invoice          │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     INVOICE AGGREGATE                             │
│                                                                  │
│  Invoice (AR)                                                    │
│  ├── InvoiceLineItem (child, composition)                        │
│  └── References out: Vendor, PurchaseOrder, Renewal, Contract    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     USER AGGREGATE                                │
│                                                                  │
│  User (AR)                                                       │
│  ├── Organization (child, composition — 0..1)                   │
│  ├── UserPreference (child, composition — 0..1)                 │
│  └── References out: Role (via RoleAssignment)                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     ACTIVITY LOG (Standalone Table)               │
│                                                                  │
│  Not an aggregate. Append-only store.                            │
│  Written by domain events emitted from all aggregates.           │
│  No FK constraints — activity_log.entity_id is generic.          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1b. Timeline Architecture: Per-Aggregate + Projection

Timelines are owned per aggregate. There is no single global timeline table that aggregates write to directly.

```
Renewal Timeline       Contract Timeline       PO Timeline       Invoice Timeline
      │                       │                      │                   │
      └───────────────────────┴──────────────────────┴───────────────────┘
                                      │
                                      ▼
                              Global Timeline
                              (read-only projection)
                                      │
                                      ▼
                               Mission Control
```

### How It Works

1. Each aggregate writes to its own timeline table (`renewal_timeline_entry`, `contract_version_history`, etc.)
2. A **projection** subscribes to domain events and builds the global timeline
3. Mission Control, Audit Explorer, and Notification Feed read from the projection
4. No service writes directly to the global timeline

### Timeline Tables

| Aggregate | Timeline Table | Event Source |
|---|---|---|
| Renewal | `renewal_timeline_entry` | State transitions within renewal |
| Contract | `contract_version_history` | Contract create, update, amend, activate |
| PurchaseOrder | `purchase_order.status` + history | PO state transitions |
| Invoice | `invoice.status` + history | Invoice state transitions |

### 1c. Policies (Process Managers)

Commands and events alone are not enough. A third primitive is needed for long-running business processes.

```
Command → Event → Policy → Command
```

A **Policy** (also called Process Manager or Saga) listens to events and emits commands. It is where business automation lives — not inside services.

### Examples

| Policy | Trigger Event | Commands Emitted |
|---|---|---|
| **RenewalAssignmentSLA** | `RenewalAssigned` | SendReminder (if no quote in 48h), EscalateAfter72h |
| **QuoteAwaitingPolicy** | `QuoteReceived` | StartNegotiationTimer, NotifyProcurementManager |
| **BudgetApprovalPolicy** | `BudgetPassed` | RouteToLegalOrBusiness, NotifyNextApprover |
| **LegalReviewSLAPolicy** | `LegalReviewStarted` | SendReminderAt48h, EscalateToGCAt72h |
| **BusinessApprovalEscalation** | `BusinessApprovalStarted` | EscalateToManagerAt48h, EscalateToDirectorAt72h, EscalateToCTOAt96h |
| **POFollowUpPolicy** | `POSent` | SendReminderAt3Days, EscalateAt7Days |
| **StalledDetectionPolicy** | `RenewalEnteredAssigned` (time-based) | MarkStalledAt14Days, NotifyOpsManager |
| **InvoiceMatchPolicy** | `InvoiceReceived` | TriggerMatching, NotifyIfException |

### Policy Rules

- Policies are **idempotent** — they track what they've already processed
- Policies are **durable** — they survive service restarts
- Policies are **testable** in isolation — pure event → command logic
- Policies are **configurable** — timing, thresholds, escalation chains are data, not code

This keeps services thin: they validate, execute, and emit. Policies handle the "what happens next."

---

## 2. Key Decisions

### 2.1 What is a Contract?

A **Contract** is an agreement between the enterprise (the licensee) and a Vendor for a specific set of Products over a defined term. It is the **source of truth** for:
- What was purchased (line items)
- What was agreed (clauses)
- What documents support it (uploads)
- When renewals happen (end_date, renewal_window_days)
- Who owns the relationship (user_id)

A Contract does **not** track the renewal process itself — that belongs to the Renewal aggregate.

### 2.2 Is a Renewal an Aggregate or a Workflow?

**Aggregate.** A Renewal is a first-class business object with its own identity, lifecycle, child entities, and invariants. It is not merely a transient workflow process. It lives as long as the renewal cycle is active (typically 30-90 days) and its record persists for audit after completion.

### 2.3 Where Does Timeline Belong?

**On the aggregate it traces.** Each aggregate has its own timeline:
- `RenewalTimelineEntry` — state transitions within a renewal (e.g., "Quote Received", "Legal Approved")
- `ContractVersionHistory` — version changes to the contract (e.g., "Contract amended — end_date extended")
- `Invoice` and `PurchaseOrder` — their own state changes via their status fields

A **global ActivityLog** (standalone table) captures cross-aggregate events for the notification feed and audit explorer. It is written to by domain events — it is not a child of any aggregate.

### 2.4 Where Do Documents Belong?

**Documents belong to the aggregate that needs them.**
- `ContractDocument` — child of Contract (original agreement, SOW, amendments)
- `RenewalDocument` — child of Renewal (vendor quote, negotiation proposals, signed approval forms)
- PO and Invoice documents — stored on their respective entities

Each aggregate owns its own documents. Cross-referencing is done via entity_id and entity_type, not shared tables.

### 2.5 Where Do Activities Belong?

**ActivityLog is a standalone append-only store.** It is the system's memory — every domain event writes to it. It is not a child of any aggregate. It has no FK constraints. It is optimized for query (filter by entity, user, date, type).

### 2.6 What Is the Aggregate Root for Renewal?

**Renewal itself.** It does not hang from Contract as a child. Contract references Renewals (1:N), but Renewal is its own aggregate with its own transaction boundary, invariants, and lifecycle.

---

## 3. Aggregate Invariants

### 3.1 Contract Invariants

| ID | Invariant | Enforcement |
|---|---|---|
| CTR-I-001 | `end_date` must be after `start_date` | DB CHECK constraint |
| CTR-I-002 | `total_contract_value` must equal sum of all `line_item.line_total` values | Service layer on save |
| CTR-I-003 | `renewal_date` must be on or before `end_date` | Validation on create/update |
| CTR-I-004 | A Contract cannot be deleted if it has active Renewals | Soft-delete only (set `deleted_at`) |
| CTR-I-005 | At least one ContractLineItem is required when status = ACTIVE | Service layer |
| CTR-I-006 | `vendor_id` must reference a valid Vendor | FK constraint |
| CTR-I-007 | `contract_number` must be unique per vendor | Unique constraint (vendor_id, contract_number) |
| CTR-I-008 | A Contract can only transition to EXPIRED by end_date, not by user action | State machine |
| CTR-I-009 | `notification_email` is required when `notification_enabled = true` | Validation |

### 3.2 Renewal Invariants

| ID | Invariant | Enforcement |
|---|---|---|
| RNW-I-001 | A Renewal can only be in one status at a time | State machine (ENUM + service) |
| RNW-I-002 | Status transitions must follow the allowed transition map | Service layer → HTTP 409 |
| RNW-I-003 | A Renewal cannot be created without a valid Contract | FK + existence check |
| RNW-I-004 | A Renewal cannot transition to PO_CREATED without business approval | Service layer checks approval status |
| RNW-I-005 | A Renewal cannot transition to COMPLETE without a matched invoice | Service layer |
| RNW-I-006 | A Renewal cannot be assigned to the same user who must approve it | Segregation of duties check |
| RNW-I-007 | Duplicate renewals for the same contract_id + year are not allowed | Unique constraint |
| RNW-I-008 | `hold_reason` is required when transitioning to ON_HOLD | Validation |
| RNW-I-009 | `cancellation_reason` is required when transitioning to CANCELLED | Validation |
| RNW-I-010 | `vendor_quote_amount` must be ≥ 0 when set | Validation |
| RNW-I-011 | `negotiated_amount` must be ≤ `vendor_quote_amount` when both are set | Validation |
| RNW-I-012 | All approval records in chain must be decided before renewal can advance | Service layer |
| RNW-I-013 | UsageAttestation expires 12 months after creation — a new one may be required | Service layer check |

### 3.3 PurchaseOrder Invariants

| ID | Invariant | Enforcement |
|---|---|---|
| PO-I-001 | `total_amount` cannot exceed the approved renewal amount | Service layer |
| PO-I-002 | A PO cannot be sent from DRAFT without at least one line item | Validation |
| PO-I-003 | `renewal_id` is unique (one PO per renewal) | Unique constraint |
| PO-I-004 | A rejected PO must record the rejection reason | Validation |
| PO-I-005 | `total_amount` must equal sum of line item totals | Service layer |

### 3.4 Invoice Invariants

| ID | Invariant | Enforcement |
|---|---|---|
| INV-I-001 | An invoice cannot be matched to multiple POs | FK + uniqueness |
| INV-I-002 | An invoice with status = EXCEPTION requires a `variance_reason` | Validation |
| INV-I-003 | An invoice cannot transition to PAID without MATCHED status | State machine |
| INV-I-004 | `variance_amount` = `invoice_amount` - `po_matched_amount` (auto-computed) | Service layer |

### 3.5 Vendor Invariants

| ID | Invariant | Enforcement |
|---|---|---|
| VEN-I-001 | A Vendor cannot be deleted if it has active Contracts | Soft-delete |
| VEN-I-002 | `vendor_code` must be unique | Unique constraint |
| VEN-I-003 | At least one VendorContact with `is_primary = true` is required | Service layer |

### 3.6 Product Invariants

| ID | Invariant | Enforcement |
|---|---|---|
| PRD-I-001 | SKU must be globally unique | DB unique + service layer |
| PRD-I-002 | A Product cannot be hard-deleted if referenced by any ContractLineItem | Soft-deactivate |
| PRD-I-003 | SKU cannot be modified after creation | Immutable field |

---

## 4. Relationship Patterns

| Pattern | Where Used | Rule |
|---|---|---|
| **Composition (child)** | Contract→LineItem, Renewal→ApprovalRecord, PO→POLineItem, Vendor→Contact | Child cannot exist without parent. Cascade delete (soft). Parent controls child lifecycle. |
| **Reference (FK)** | Contract→Vendor, Renewal→Contract, PO→Renewal, Invoice→PO | FK constraint. Cross-aggregate. Never cascade delete. |
| **Event-driven reference** | ActivityLog→any entity | No FK. `entity_type` + `entity_id` are strings. Referential integrity is eventual. |
| **Counter cache** | Vendor.total_contract_count, Vendor.total_spend | Cached computed values. Updated via domain events. Not authoritative — source of truth is the actual query. |

---

## 5. Cross-Aggregate Reference Rules

1. **Never hold a direct object reference to another aggregate's child.** Only reference the aggregate root.
   - Correct: Renewal → contract_id (Contract AR)
   - Incorrect: Renewal → contract_line_item_id (child of Contract)

2. **Cross-aggregate communication is via domain events, not service calls.**
   - Contract Activated → event → RenewalOperations listens → creates Renewal if end_date is within window
   - Renewal Approved → event → Procurement listens → creates PO draft

3. **Eventual consistency across aggregates is acceptable.** Within an aggregate, strong consistency. Between aggregates, events with at-least-once delivery.

4. **Read-only references are copies, not live FKs.** When a Renewal needs contract data (e.g., contract_name, vendor_name), it stores a snapshot at creation time. The canonical data lives in the Contract/Vendor aggregate.

---

## 6. Aggregate Ownership Map

| Aggregate | Bounded Context | Transaction Boundary | Persistence |
|---|---|---|---|
| Contract | ContractManagement | Contract + all children in one tx | `contract` table family |
| Renewal | RenewalOperations | Renewal + all children in one tx | `renewal` table family |
| PurchaseOrder | Procurement | PO + line items in one tx | `purchase_order` table family |
| Invoice | Financial | Invoice + line items in one tx | `invoice` table family |
| Vendor | VendorManagement | Vendor + contacts in one tx | `vendor` table family |
| Product | ProductCatalog | Product alone | `product` table |
| User | IdentityAccess | User + preferences in one tx | `user` table family |
| ActivityLog | Compliance | Single row insert (no tx needed) | `activity_log` table |

---

## 7. Entity Rename Map (Current → Target)

| Current Name | Target Name | Aggregate | Notes |
|---|---|---|---|
| Contract | Contract | Contract | Keep. Add vendor_id FK. |
| ContractLineItem | ContractLineItem | Contract | Keep. Already has product_id, discount, tax, line_total. |
| ContractDocument | ContractDocument | Contract | Keep. Already has storage abstraction, version tracking. |
| ContractClause | ContractClause | Contract | New entity. |
| ContractRenewal | → **Moved to Renewal aggregate** | Renewal | Will be replaced by full Renewal entity. |
| ContractApproval | → **Moved to Renewal aggregate** | Renewal | Will be replaced by ApprovalRecord. |
| Customer | → **Replaced by Vendor** | Vendor | Customer was a misnomer. Vendors sell, customers buy. Muraai is the buyer. |
| ContactPerson | → **Moved to Vendor aggregate** | Vendor | Will be renamed to VendorContact. |
| Product | Product | Product | Keep. Almost matches target. |
| PurchaseOrder | PurchaseOrder | Procurement | Keep. Needs proper state machine. |
| Invoice | Invoice | Financial | Keep. Needs proper state machine. |
| ActivityLog | ActivityLog | Compliance | Keep. Make immutable. |
| Notification | → **Replaced by NotificationEngine** | — | Will be event-driven, not manually created. |
| Workflow | → **Absorbed into Renewal aggregate** | Renewal | Workflow stages become ApprovalRecord chain. |
| AutomationRule | → **Replaced by Event Bus subscribers** | — | Actions become event subscribers. |
| Task | → **Moved to Renewal aggregate** | Renewal | Renamed to RenewalTask. |
| CalendarEvent | → **Moved to NotificationEngine** | — | Will be event-triggered reminders. |
| ReminderConfig | → **Moved to NotificationEngine** | — | Will be event-triggered reminders. |

---

## 8. State Machine Distribution

Each aggregate owns its own state machine. There is no global state machine registry.

| Aggregate | States | Current State | Action |
|---|---|---|---|
| Contract | DRAFT → ACTIVE → EXPIRED / TERMINATED | 11 states (too many) | Simplify to 6 states per target. Current 11 can be reduced. |
| Renewal | 20 states (PENDING_REVIEW → COMPLETE) | Junction table only | New — build from scratch |
| PurchaseOrder | 6 states (DRAFT → SENT → ACKNOWLEDGED → COMPLETE) | Free-text | Implement per target |
| Invoice | 7 states (RECEIVED → MATCHED → PAID) | Free-text | Implement per target |
| Task | 6 states (PENDING → ASSIGNED → IN_PROGRESS → COMPLETED) | Free-text | Implement per target |
| Approval | 5 states (PENDING → APPROVED / REJECTED) | Free-text | Absorbed into Renewal aggregate |
| Document | 7 states (UPLOADING → READY → ARCHIVED) | None | Implement per target |

---

## 9. Bounded Context Communication Map

```
ContractManagement               RenewalOperations
┌──────────────────┐              ┌─────────────────────┐
│ Contract ACTIVE  │──event──────►│ Creates Renewal     │
│ (end_date within │              │ (PENDING_REVIEW)    │
│  renewal window) │              └─────────┬───────────┘
└──────────────────┘                        │
                                            │ Renewal COMPLETE
                                            ▼
                                    ┌──────────────────┐
                                    │ Procurement      │
                                    │ Creates PO Draft │
                                    └────────┬─────────┘
                                             │ PO SENT
                                             ▼
                                     ┌──────────────────┐
                                     │ Financial        │
                                     │ Invoice Matching │
                                     └──────────────────┘

All communication via domain events. No direct service-to-service calls.
```

---

## 10. Migration Strategy

### Phase 1: Sprint 0.5 (This document)
- Lock domain model
- Get stakeholder approval on aggregate boundaries
- Produce Renewal Aggregate Specification

### Phase 2: Sprint 1 — Contract Refactoring
- Add `vendor_id` to Contract
- Create Vendor entity (migrate from Customer + company_name)
- Simplify Contract state machine to 6 states
- Add ContractVersionHistory
- Add ContractClause
- Make ActivityLog immutable (revoke UPDATE/DELETE permissions)
- All within existing integer PKs

### Phase 3: Sprint 2 — Renewal Aggregate
- Create Renewal table family (new tables, new code)
- Keep ContractRenewal table for backward compat during migration
- Wire domain events between Contract→Renewal
- Build full 20-state machine
- Build UI workspace

### Phase 4: Post domain stability
- UUID migration (if still desired)
- Event bus
- API versioning
