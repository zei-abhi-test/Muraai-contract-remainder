# Renewal Aggregate Specification

**Status:** Draft (Sprint 0.5)
**Date:** 2026-07-20
**Author:** Domain Architecture

---

## 1. Aggregate Root Responsibilities

The **Renewal** is the central business object in Muraai. It orchestrates a single contract renewal cycle from identification through payment completion.

### Responsibilities

| Responsibility | Description |
|---|---|
| **Lifecycle Management** | Own the 20-state machine. Enforce valid transitions, entry/exit actions, error states, and recovery paths. |
| **Approval Orchestration** | Manage the multi-stage approval chain (Legal → Business → Financial). Track SLA deadlines, escalations, and delegation. |
| **Quote & Budget Tracking** | Record vendor quotes, negotiated amounts, budget validation status, and budget override decisions. |
| **Usage Attestation** | Require Business Owner confirmation that the software is still in use before final approval. |
| **PO & Invoice Linking** | Generate the Purchase Order from approved renewal data. Track invoice matching and payment completion. |
| **Document Management** | Own renewal-scoped documents (vendor quotes, signed approvals, negotiation proposals) separately from contract-scoped documents. |
| **Communication Log** | Record all vendor and internal communications related to this renewal. |
| **Task Management** | Manage renewal-specific tasks (follow-ups, data gathering) separate from global tasks. |
| **Risk & Health Scoring** | Compute and track health score, risk score, and SLA compliance for the renewal. |
| **Audit Trail** | Every state transition, every decision, every change is recorded in the timeline. |

### What the Renewal Aggregate Does NOT Own

| Concern | Owned By | Rationale |
|---|---|---|
| Contract master data | Contract aggregate | Renewal stores a snapshot at creation, references contract_id |
| Vendor master data | Vendor aggregate | Renewal stores vendor_name + vendor_id as reference |
| Product catalog | Product aggregate | Line items include a product snapshot |
| PO lifecycle | PurchaseOrder aggregate | Renewal triggers PO creation but PO manages its own state |
| Invoice lifecycle | Invoice aggregate | Renewal links to invoice but invoice manages its own state |
| Global activity feed | ActivityLog | Written by domain events, not directly by Renewal |
| User management | User aggregate | Renewal references user IDs for assignments/approvals |
| Email delivery | NotificationEngine | Renewal emits events; NotificationEngine sends emails |

---

## 2. Child Entities

### 2.1 ApprovalRecord

Tracks a single approval or rejection decision within the renewal's approval chain.

| Field | Type | Required | Description |
|---|---|---|---|
| id | Integer (UUID in v2) | Yes | PK |
| renewal_id | Integer | Yes | FK to Renewal |
| approver_type | ApprovalType | Yes | legal, business_owner, financial, procurement_manager, cto, cfo |
| approver_id | Integer | Yes | FK to User |
| delegate_id | Integer | No | FK to User who approved on behalf of |
| status | ApprovalStatus | Yes | pending, approved, rejected, deferred, cancelled, escalated |
| comments | Text | No | Reason for decision |
| chain_order | Integer | Yes | Position in sequential chain (1, 2, 3...) |
| sla_deadline | DateTime | Yes | By when this approval must be decided |
| sla_breached | Boolean | Yes | False | Whether SLA was violated |
| reminded_at | DateTime | No | Last reminder sent |
| escalation_count | Integer | Yes | 0 | Number of times escalated |
| decided_at | DateTime | No | When decision was made |
| deferred_until | DateTime | No | If deferred, when to return to pending |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |

#### State Machine
```
PENDING → APPROVED (terminal)
PENDING → REJECTED (terminal)
PENDING → DEFERRED → PENDING
PENDING → CANCELLED (terminal)
PENDING → ESCALATED → APPROVED|REJECTED (terminal for original approver)
```

#### Lifecycle
1. Created when renewal enters a stage requiring this approval type
2. SLA timer starts immediately
3. Approver takes action: approve, reject, defer, or ignore (triggers escalation)
4. SLA breach → auto-escalate to next level (3 levels max)
5. Terminal states: approved, rejected, cancelled

### 2.2 UsageAttestation

Business Owner's confirmation that the software is still in use.

| Field | Type | Required | Description |
|---|---|---|---|
| id | Integer | Yes | PK |
| renewal_id | Integer | Yes | FK to Renewal |
| attested_by | Integer | Yes | FK to User (Business Owner) |
| current_user_count | Integer | Yes | Number of active users |
| planned_changes | Text | No | Expected changes in user count |
| still_required | Boolean | Yes | Is the software still needed? |
| alternative_considered | Boolean | No | Was an alternative evaluated? |
| comments | Text | No | Additional context |
| attested_at | DateTime | Yes | |
| expires_at | DateTime | Yes | Valid for 12 months |

#### Rules
- Immutable after creation (no updates — create new attestation if correction needed)
- Expires 12 months after creation
- If `still_required = false`, renewal must proceed to CANCELLED or right-sizing workflow
- `current_user_count` must be a positive integer

### 2.3 RenewalTimelineEntry

A visual timeline entry for the renewal's state machine history.

| Field | Type | Required | Description |
|---|---|---|---|
| id | Integer | Yes | PK |
| renewal_id | Integer | Yes | FK to Renewal |
| from_status | String(50) | No | Previous status (null for creation) |
| to_status | String(50) | Yes | New status |
| action | String(200) | Yes | Human-readable (e.g., "Assigned to John Doe") |
| performed_by | Integer | Yes | FK to User |
| performed_at | DateTime | Yes | |
| comments | Text | No | Optional context |
| metadata | JSON | No | Structured data (amounts, references, document URLs) |

#### Rules
- One entry per state transition
- Immutable after creation
- Metadata stores transition-specific data (e.g., `{"vendor_quote_amount": 50000, "currency": "USD"}`)
- Timeline is read-optimized for the UI workspace — do not join to other tables

### 2.4 RenewalDocument

A document uploaded during the renewal process (quote PDF, signed approval form, negotiation proposal).

| Field | Type | Required | Description |
|---|---|---|---|
| id | Integer | Yes | PK |
| renewal_id | Integer | Yes | FK to Renewal |
| document_type | RenewalDocumentType | Yes | quote, approval_form, negotiation_proposal, signed_po, other |
| file_name | String(255) | Yes | |
| stored_file_name | String(255) | Yes | |
| file_path | String(500) | Yes | |
| content_type | String(120) | Yes | |
| file_size | Integer | Yes | In bytes |
| storage_provider | String(50) | Yes | local, onedrive, s3 |
| storage_reference | String(500) | No | Provider-specific ID |
| uploaded_by | Integer | Yes | FK to User |
| uploaded_at | DateTime | Yes | |

**Note:** This is separate from `ContractDocument`. Contract documents are the master agreement, SOW, amendments. Renewal documents are specific to this renewal cycle.

### 2.5 RenewalEmail

Records a vendor-facing or internal email related to this renewal.

| Field | Type | Required | Description |
|---|---|---|---|
| id | Integer | Yes | PK |
| renewal_id | Integer | Yes | FK to Renewal |
| direction | String(10) | Yes | outbound, inbound |
| recipient | String(255) | Yes | Email address |
| sender | String(255) | Yes | |
| subject | String(500) | Yes | |
| body | Text | Yes | |
| email_type | String(50) | Yes | quote_request, negotiation, po_delivery, follow_up, other |
| vendor_email_ref | String(200) | No | Vendor's email reference if inbound |
| sent_at | DateTime | Yes | |
| created_at | DateTime | Yes | |

### 2.6 RenewalNote

Freeform internal note attached to the renewal.

| Field | Type | Required | Description |
|---|---|---|---|
| id | Integer | Yes | PK |
| renewal_id | Integer | Yes | FK to Renewal |
| author_id | Integer | Yes | FK to User |
| content | Text | Yes | |
| is_pinned | Boolean | No | False | Whether to pin to top |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |

### 2.7 RenewalTask

A task scoped to a specific renewal.

| Field | Type | Required | Description |
|---|---|---|---|
| id | Integer | Yes | PK |
| renewal_id | Integer | Yes | FK to Renewal |
| title | String(200) | Yes | |
| description | Text | No | |
| assigned_to | Integer | No | FK to User |
| priority | String(10) | Yes | low, medium, high, critical |
| status | String(20) | Yes | pending, assigned, in_progress, completed, cancelled |
| due_date | Date | No | |
| completed_at | DateTime | No | |
| created_by | Integer | Yes | FK to User |
| created_at | DateTime | Yes | |

**Note:** These are renewal-scoped tasks. For organization-wide tasks, use a global Task entity (future).

---

## 3. Value Objects

### 3.1 RenewalStatus (20 states)

```python
class RenewalStatus(str, Enum):
    # Initial
    PENDING_REVIEW = "pending_review"       # Created, awaiting assignment
    
    # Procurement
    ASSIGNED = "assigned"                    # Assigned to Procurement Specialist
    QUOTE_RECEIVED = "quote_received"        # Vendor quote recorded
    QUOTE_REVIEW = "quote_review"            # Reviewing quote (negotiation path)
    
    # Budget
    BUDGET_CHECK = "budget_check"            # Budget validation in progress
    BUDGET_PASSED = "budget_passed"          # Budget validated
    BUDGET_REVIEW = "budget_review"          # Budget insufficient, needs decision
    
    # Legal
    LEGAL_REVIEW = "legal_review"            # Sent to Legal
    LEGAL_APPROVED = "legal_approved"        # Legal approved
    LEGAL_REJECTED = "legal_rejected"        # Legal rejected
    
    # Business Approval
    BUSINESS_APPROVAL = "business_approval"   # Business Owner approval
    BUSINESS_APPROVED = "business_approved"   # Business approved
    BUSINESS_REJECTED = "business_rejected"   # Business rejected
    
    # PO
    PO_PENDING = "po_pending"                # PO draft created, awaiting review
    PO_SENT = "po_sent"                      # PO sent to vendor
    
    # Financial
    INVOICE_RECEIVED = "invoice_received"    # Invoice received from vendor
    INVOICE_MATCHED = "invoice_matched"      # Invoice matched to PO
    PAYMENT_DONE = "payment_done"            # Payment recorded
    
    # Terminal
    COMPLETE = "complete"                    # Renewal fully processed
    CANCELLED = "cancelled"                  # Renewal will not proceed
    
    # Interrupt
    ON_HOLD = "on_hold"                      # Paused
    ESCALATED = "escalated"                  # Sent to higher authority
    STALLED = "stalled"                      # No progress for configured period
```

### 3.2 ApprovalType

```python
class ApprovalType(str, Enum):
    LEGAL = "legal"
    BUSINESS_OWNER = "business_owner"
    FINANCIAL = "financial"
    PROCUREMENT_MANAGER = "procurement_manager"
    CTO = "cto"
    CFO = "cfo"
```

### 3.3 ApprovalStatus

```python
class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    DEFERRED = "deferred"
    CANCELLED = "cancelled"
    ESCALATED = "escalated"
```

### 3.4 Priority

```python
class Priority(int, Enum):
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3
```

### 3.5 RenewalDocumentType

```python
class RenewalDocumentType(str, Enum):
    VENDOR_QUOTE = "vendor_quote"
    APPROVAL_FORM = "approval_form"
    NEGOTIATION_PROPOSAL = "negotiation_proposal"
    SIGNED_PO = "signed_po"
    INVOICE = "invoice"
    OTHER = "other"
```

### 3.6 RiskScore

```python
# Computed, not stored directly. Score 0-100.
RiskScore = {
    score: int,           # 0-100
    level: str,           # low (0-30), medium (31-60), high (61-85), critical (86-100)
    factors: [RiskFactor] # What contributes to this score
}

RiskFactor = {
    name: str,            # e.g., "vendor_risk", "budget_risk", "sla_risk"
    weight: float,        # 0.0-1.0
    score: int,           # 0-100
    description: str
}
```

### 3.7 HealthScore

```python
# Computed, not stored directly. Score 0-100.
HealthScore = {
    score: int,            # 0-100
    level: str,            # healthy (80-100), warning (50-79), critical (0-49)
    metrics: [HealthMetric]
}

HealthMetric = {
    name: str,             # e.g., "days_in_current_stage", "sla_compliance", "documents_complete"
    status: str,           # on_track, at_risk, behind
    value: str             # Human-readable status
}
```

### 3.8 Money

```python
Money = {
    amount: Decimal(18, 2),
    currency: str           # ISO 4217
}
```

---

## 4. Domain Events

Every state transition and significant action emits a domain event. Events are the contract between the Renewal aggregate and the rest of the system.

| Event | When | Payload |
|---|---|---|
| `RenewalCreated` | Renewal enters PENDING_REVIEW | renewal_id, contract_id, year, vendor_id, created_by |
| `RenewalAssigned` | Assigned to Procurement Specialist | renewal_id, assigned_to, assigned_by |
| `RenewalUnassigned` | Unassigned from PS | renewal_id, previous_assignee, unassigned_by |
| `QuoteReceived` | Vendor quote recorded | renewal_id, amount, currency, vendor_quote_ref, document_url |
| `QuoteUpdated` | Quote amount/ref updated | renewal_id, previous_amount, new_amount |
| `NegotiationStarted` | Budget review → negotiate | renewal_id, current_amount, target_amount |
| `BudgetPassed` | Budget validated | renewal_id, budget_code, approved_amount |
| `BudgetReviewNeeded` | Budget insufficient | renewal_id, current_amount, available_budget |
| `BudgetOverrideApproved` | S8 approved budget override | renewal_id, overridden_by, override_amount |
| `LegalReviewStarted` | Sent to Legal | renewal_id, legal_approver_id, sla_deadline |
| `LegalApproved` | Legal approved | renewal_id, approved_by, comments |
| `LegalRejected` | Legal rejected | renewal_id, rejected_by, reason |
| `BusinessApprovalStarted` | Sent to Business Owner | renewal_id, business_owner_id, sla_deadline |
| `BusinessApproved` | Business Owner approved | renewal_id, approved_by, usage_attestation_id |
| `BusinessRejected` | Business Owner declined | renewal_id, rejected_by, reason |
| `UsageAttestationSubmitted` | Attestation recorded | renewal_id, attested_by, still_required, current_user_count |
| `UsageAttestationExpired` | 12-month validity passed | renewal_id, previous_attestation_id |
| `PODraftCreated` | PO draft auto-generated | renewal_id, po_id, total_amount |
| `POSent` | PO sent to vendor | renewal_id, po_id, sent_method |
| `POAcknowledged` | Vendor acknowledged PO | renewal_id, po_id |
| `PORejected` | Vendor rejected PO | renewal_id, po_id, rejection_reason |
| `InvoiceReceived` | Invoice recorded | renewal_id, invoice_id, invoice_amount |
| `InvoiceMatched` | Invoice matched to PO | renewal_id, invoice_id, variance_amount |
| `PaymentDone` | Payment recorded | renewal_id, invoice_id, payment_reference |
| `RenewalCompleted` | Renewal fully processed | renewal_id, contract_id, year, total_spend |
| `RenewalCancelled` | Renewal cancelled | renewal_id, reason, cancelled_by |
| `RenewalOnHold` | Renewal paused | renewal_id, hold_reason, hold_until |
| `RenewalResumed` | Renewal resumed from hold | renewal_id, resumed_to_status |
| `RenewalEscalated` | Sent to higher authority | renewal_id, escalation_level, escalated_to |
| `RenewalStalled` | No progress for configured days | renewal_id, current_status, days_in_status |
| `RenewalSLABreached` | An approval SLA was missed | renewal_id, approval_type, sla_deadline, escalation_level |
| `RenewalRiskScoreChanged` | Risk score materially changed | renewal_id, previous_score, new_score, level |
| `RenewalTaskAssigned` | New task created | renewal_id, task_id, assigned_to |
| `RenewalTaskCompleted` | Task done | renewal_id, task_id, completed_by |
| `RenewalDocumentUploaded` | Document uploaded | renewal_id, document_id, document_type |

---

## 5. Commands

Commands are the explicit API for mutating the Renewal aggregate. Each command maps to a specific state transition.

| Command | Target Status | Required Role | Payload |
|---|---|---|---|
| `CreateRenewal` | PENDING_REVIEW | System (auto) | contract_id, year |
| `AssignRenewal` | ASSIGNED | S1 (Renewals Ops Mgr) | renewal_id, assigned_to |
| `UnassignRenewal` | ASSIGNED | S1 | renewal_id |
| `RecordQuote` | QUOTE_RECEIVED | S2 (Procurement Specialist) | renewal_id, amount, currency, vendor_quote_ref, document |
| `UpdateQuote` | QUOTE_RECEIVED | S2 | renewal_id, amount, document |
| `CheckBudget` | BUDGET_CHECK / BUDGET_PASSED / BUDGET_REVIEW | S2 | renewal_id, budget_code |
| `ApproveBudgetOverride` | BUDGET_PASSED | S8 (Finance Director) | renewal_id, approved_amount |
| `RequestNegotiation` | QUOTE_REVIEW | S2 | renewal_id, target_amount |
| `SendToLegal` | LEGAL_REVIEW | System (auto) | renewal_id |
| `LegalApprove` | LEGAL_APPROVED | S4 (Legal Counsel) | renewal_id, comments |
| `LegalReject` | LEGAL_REJECTED | S4 | renewal_id, reason |
| `SubmitAttestation` | — (no transition) | S5 (Business Owner) | renewal_id, user_count, still_required, comments |
| `SendToBusinessApproval` | BUSINESS_APPROVAL | System (auto) | renewal_id |
| `BusinessApprove` | BUSINESS_APPROVED | S5 | renewal_id, comments |
| `BusinessReject` | BUSINESS_REJECTED | S5 | renewal_id, reason |
| `GeneratePO` | PO_PENDING | System (auto) | renewal_id |
| `SendPO` | PO_SENT | S2 | renewal_id |
| `RecordInvoice` | INVOICE_RECEIVED | S3 (Financial Analyst) | renewal_id, invoice_id |
| `MatchInvoice` | INVOICE_MATCHED | System (auto) | renewal_id |
| `RecordPayment` | PAYMENT_DONE | S3 | renewal_id, payment_reference |
| `CompleteRenewal` | COMPLETE | System (auto) | renewal_id |
| `CancelRenewal` | CANCELLED | S1 / S2 | renewal_id, reason |
| `HoldRenewal` | ON_HOLD | S1 | renewal_id, reason, hold_until |
| `ResumeRenewal` | (previous status) | S1 | renewal_id |
| `EscalateRenewal` | ESCALATED | S1 / System | renewal_id, escalation_level |
| `ResolveEscalation` | (previous status) | S1 | renewal_id |
| `AddNote` | — (no transition) | Any | renewal_id, content |
| `PinNote` | — (no transition) | Any | note_id |
| `CreateTask` | — (no transition) | Any | renewal_id, title, assigned_to, due_date, priority |
| `CompleteTask` | — (no transition) | Any | task_id |
| `UploadDocument` | — (no transition) | Any | renewal_id, file, document_type |

---

## 6. State Machine (Full Specification)

### 6.1 State Transition Map

```
PENDING_REVIEW ──[assign]──► ASSIGNED
PENDING_REVIEW ──[cancel]──► CANCELLED
PENDING_REVIEW ──[hold]────► ON_HOLD

ASSIGNED ──[record_quote]──► QUOTE_RECEIVED
ASSIGNED ──[cancel]────────► CANCELLED
ASSIGNED ──[hold]──────────► ON_HOLD
ASSIGNED ──[escalate]──────► ESCALATED
ASSIGNED ──[stall]─────────► STALLED

QUOTE_RECEIVED ──[check_budget]──► BUDGET_CHECK
QUOTE_RECEIVED ──[update_quote]──► QUOTE_RECEIVED (self-loop)
QUOTE_RECEIVED ──[cancel]────────► CANCELLED
QUOTE_RECEIVED ──[hold]──────────► ON_HOLD

QUOTE_REVIEW ──[record_quote]────► QUOTE_RECEIVED (updated quote)
QUOTE_REVIEW ──[escalate_budget]─► BUDGET_REVIEW

BUDGET_CHECK ──[budget_passed]──► BUDGET_PASSED
BUDGET_CHECK ──[budget_failed]──► BUDGET_REVIEW
BUDGET_CHECK ──[stall]──────────► STALLED

BUDGET_PASSED ──[route_approval]──► LEGAL_REVIEW (if policy requires)
BUDGET_PASSED ──[route_approval]──► BUSINESS_APPROVAL (if legal not required)

BUDGET_REVIEW ──[override]──────► BUDGET_PASSED
BUDGET_REVIEW ──[negotiate]─────► QUOTE_REVIEW
BUDGET_REVIEW ──[cancel]────────► CANCELLED

LEGAL_REVIEW ──[legal_approve]──► LEGAL_APPROVED
LEGAL_REVIEW ──[legal_reject]───► LEGAL_REJECTED
LEGAL_REVIEW ──[stall]──────────► STALLED

LEGAL_APPROVED ──[route_approval]──► BUSINESS_APPROVAL

LEGAL_REJECTED ──[renegotiate]──► QUOTE_RECEIVED
LEGAL_REJECTED ──[cancel]───────► CANCELLED

BUSINESS_APPROVAL ──[business_approve]──► BUSINESS_APPROVED
BUSINESS_APPROVAL ──[business_reject]───► BUSINESS_REJECTED
BUSINESS_APPROVAL ──[cancel]────────────► CANCELLED
BUSINESS_APPROVAL ──[hold]──────────────► ON_HOLD
BUSINESS_APPROVAL ──[stall]─────────────► STALLED

BUSINESS_APPROVED ──[route_cfo]──► (CFO approval if above threshold)
BUSINESS_APPROVED ──[generate_po]──► PO_PENDING

BUSINESS_REJECTED ── (terminal)

PO_PENDING ──[send_po]────► PO_SENT
PO_PENDING ──[cancel]─────► CANCELLED

PO_SENT ──[invoice_received]──► INVOICE_RECEIVED
PO_SENT ──[stall]─────────────► STALLED
PO_SENT ──[cancel]────────────► CANCELLED

INVOICE_RECEIVED ──[match_invoice]──► INVOICE_MATCHED

INVOICE_MATCHED ──[record_payment]──► PAYMENT_DONE

PAYMENT_DONE ──[complete]──► COMPLETE

ON_HOLD ──[resume]──► (previous status)
ON_HOLD ──[cancel]──► CANCELLED

ESCALATED ──[resolve]──► (previous status)
ESCALATED ──[cancel]───► CANCELLED

STALLED ──[intervene]──► (previous active status)
STALLED ──[auto_escalate]──► ESCALATED
```

### 6.2 Entry Actions

| State | Entry Action |
|---|---|
| PENDING_REVIEW | Notify S1. Set `created_at`. Emit `RenewalCreated`. Write timeline entry. |
| ASSIGNED | Set `assigned_at`. Notify S2. Start assignment SLA timer (48h to get quote). Write timeline. Emit `RenewalAssigned`. |
| QUOTE_RECEIVED | Set `vendor_quote_received_at`. Validate quote amount ≥ 0. Notify S1. Write timeline. Emit `QuoteReceived`. |
| QUOTE_REVIEW | Notify S2. Start negotiation timer. |
| BUDGET_CHECK | Call BudgetValidationService. Set `budget_checked_at`. |
| BUDGET_PASSED | Set `budget_approved_amount`. Evaluate approval routing policy (Legal needed? CFO threshold?). Notify S2. Emit `BudgetPassed`. |
| BUDGET_REVIEW | Notify S2 and S1. Start budget review SLA timer (48h). Emit `BudgetReviewNeeded`. |
| LEGAL_REVIEW | Create ApprovalRecord for S4. Set SLA deadline (72h). Notify S4. Emit `LegalReviewStarted`. |
| LEGAL_APPROVED | Record approval. Check next step in chain. Emit `LegalApproved`. |
| LEGAL_REJECTED | Log rejection. Determine action: renegotiate → QUOTE_RECEIVED or cancel → CANCELLED. Emit `LegalRejected`. |
| BUSINESS_APPROVAL | Check UsageAttestation validity. Create new attestation request if expired. Create ApprovalRecord for S5. Set SLA deadline (48h → escalate, 72h → director, 96h → CTO/CFO). Notify S5. Emit `BusinessApprovalStarted`. |
| BUSINESS_APPROVED | Record approval. Check CFO threshold. Trigger PO draft creation. Emit `BusinessApproved`. |
| BUSINESS_REJECTED | Set `cancellation_reason`. Notify stakeholders. Emit `BusinessRejected`. |
| PO_PENDING | System creates PO draft from renewal data. Notify S2 "PO ready for review." Emit `PODraftCreated`. |
| PO_SENT | Set `po_sent_at`. Link PO to renewal. Start PO acknowledgment timer (7 days). Emit `POSent`. |
| INVOICE_RECEIVED | Link invoice. Start invoice matching. Emit `InvoiceReceived`. |
| INVOICE_MATCHED | Set variance. Update financial forecast. Emit `InvoiceMatched`. |
| PAYMENT_DONE | Record payment reference. Emit `PaymentDone`. |
| COMPLETE | Set status. Notify all stakeholders. Emit `RenewalCompleted`. Update contract.renewal_count. |
| CANCELLED | Set `cancellation_reason`. Notify stakeholders. Emit `RenewalCancelled`. |
| ON_HOLD | Set `hold_reason`, `hold_until`. Schedule resume notification. Notify S1. Emit `RenewalOnHold`. |
| ESCALATED | Increment `escalation_level`. Notify escalation target. Emit `RenewalEscalated`. |
| STALLED | Notify S1. Evaluate auto-escalation. Emit `RenewalStalled`. |

### 6.3 Exit Actions

| State | Exit Action |
|---|---|
| ASSIGNED | Clear assignment timer. |
| ON_HOLD | Clear hold data. |
| ESCALATED | Reset escalation timer. |
| BUDGET_REVIEW | Clear budget review timer. |
| LEGAL_REVIEW | Clear legal SLA timer. |
| BUSINESS_APPROVAL | Clear business SLA timer. |
| STALLED | Reset stalled timer. |

### 6.4 SLA Timers

| Timer | Duration | Action on Breach |
|---|---|---|
| Assignment → Quote | 48h | Notify S1. Flag renewal. |
| Budget Review | 48h | Notify S1 and S8. |
| Legal Review | 72h | Notify S1. Escalate to GC. |
| Business Approval (Level 1) | 48h | Escalate to manager. |
| Business Approval (Level 2) | 72h | Escalate to director. |
| Business Approval (Level 3) | 96h | Escalate to CTO/CFO. |
| PO Acknowledgment | 7 days | Notify S2. Flag PO as overdue. |
| Stalled Detection | 14 days | Move to STALLED. |

---

## 7. Permissions

Each action is gated by the user's role. The renewal's `allowed_actions` endpoint returns only the actions the current user can perform from the current status.

| Action | S1 (Ops Mgr) | S2 (Procurement) | S3 (Finance) | S4 (Legal) | S5 (Biz Owner) | S8 (Finance Dir) | S9 (Admin) |
|---|---|---|---|---|---|---|---|
| assign | ✓ | | | | | | ✓ |
| unassign | ✓ | | | | | | ✓ |
| record_quote | | ✓ | | | | | ✓ |
| update_quote | | ✓ | | | | | ✓ |
| check_budget | | ✓ | ✓ | | | | ✓ |
| override_budget | | | | | | ✓ | ✓ |
| legal_approve | | | | ✓ | | | ✓ |
| legal_reject | | | | ✓ | | | ✓ |
| submit_attestation | | | | | ✓ | | ✓ |
| business_approve | | | | | ✓ | | ✓ |
| business_reject | | | | | ✓ | | ✓ |
| generate_po | | ✓ | | | | | ✓ |
| send_po | | ✓ | | | | | ✓ |
| record_invoice | | | ✓ | | | | ✓ |
| match_invoice | | | ✓ | | | | ✓ |
| record_payment | | | ✓ | | | | ✓ |
| cancel | ✓ | ✓ | | | | | ✓ |
| hold | ✓ | | | | | | ✓ |
| resume | ✓ | | | | | | ✓ |
| escalate | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| resolve_escalation | ✓ | | | | | | ✓ |
| add_note | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| create_task | ✓ | ✓ | ✓ | | | | ✓ |
| upload_doc | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| edit | ✓ | ✓ | | | | | ✓ |

---

## 8. Timeline Integration

Every state transition writes to two places:

```
1. RenewalTimelineEntry (within the aggregate)
   ── Optimized for the Renewal Workspace timeline widget
   ── Read directly from the renewal detail page
   ── Immutable after creation

2. ActivityLog (standalone table)
   ── Written by domain event handler
   ── Includes cross-aggregate context (contract name, vendor name)
   ── Used for global notification feed, audit export, reporting
   ── Also immutable
```

### Timeline Entry Generation Rules

| Transition | Action Text | Metadata |
|---|---|---|
| PENDING_REVIEW → ASSIGNED | "Assigned to {user_name}" | `{assigned_to, assigned_by, assigned_at}` |
| ASSIGNED → QUOTE_RECEIVED | "Quote received: {amount} {currency}" | `{amount, currency, vendor_quote_ref, document_url}` |
| BUDGET_CHECK → BUDGET_PASSED | "Budget validated: {amount} approved" | `{budget_code, approved_amount}` |
| LEGAL_REVIEW → LEGAL_APPROVED | "Legal approved" | `{approved_by, comments}` |
| BUSINESS_APPROVAL → BUSINESS_APPROVED | "Business approved" | `{approved_by, usage_attestation_id}` |
| PO_PENDING → PO_SENT | "PO {po_number} sent to vendor" | `{po_id, po_number, sent_method}` |
| → COMPLETE | "Renewal completed" | `{total_spend, invoice_id, payment_reference}` |
| → CANCELLED | "Cancelled: {reason}" | `{reason, cancelled_by}` |
| → ON_HOLD | "On hold until {date}: {reason}" | `{reason, hold_until}` |

---

## 9. Document Relationships

### Document Lifecycle Per State

| State | Actionable Documents |
|---|---|
| QUOTE_RECEIVED | Vendor quote (required) |
| QUOTE_REVIEW | Negotiation proposal (optional) |
| LEGAL_REVIEW | Approval form (optional if system-generated) |
| BUSINESS_APPROVAL | Usage attestation (required), approval form (optional) |
| PO_PENDING | PO draft (auto-generated) |
| PO_SENT | Signed PO (optional — vendor may return signed copy) |
| INVOICE_RECEIVED | Invoice document (required) |

### Document Storage Path Convention

```
{storage_root}/{environment}/renewals/{renewal_id}/{document_type}_{id}.{ext}
```

Example:
```
uploads/prod/renewals/42/vendor_quote_101.pdf
```

---

## 10. API Contract

### Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/renewals | List renewals (paginated, filterable by status, assignee, date range) |
| GET | /api/v1/renewals/:id | Get renewal detail including all children |
| POST | /api/v1/renewals | Create renewal (auto, from contract) |
| PATCH | /api/v1/renewals/:id | Update renewal fields (notes, tags, etc.) |
| POST | /api/v1/renewals/:id/assign | Assign to user |
| POST | /api/v1/renewals/:id/unassign | Unassign |
| POST | /api/v1/renewals/:id/record-quote | Record vendor quote |
| POST | /api/v1/renewals/:id/update-quote | Update existing quote |
| POST | /api/v1/renewals/:id/check-budget | Trigger budget validation |
| POST | /api/v1/renewals/:id/override-budget | Budget override (S8) |
| POST | /api/v1/renewals/:id/send-to-legal | Send to Legal |
| POST | /api/v1/renewals/:id/legal-approve | Legal approve |
| POST | /api/v1/renewals/:id/legal-reject | Legal reject |
| POST | /api/v1/renewals/:id/submit-attestation | Submit usage attestation |
| POST | /api/v1/renewals/:id/business-approve | Business approve |
| POST | /api/v1/renewals/:id/business-reject | Business reject |
| POST | /api/v1/renewals/:id/generate-po | Generate PO draft |
| POST | /api/v1/renewals/:id/send-po | Send PO to vendor |
| POST | /api/v1/renewals/:id/record-invoice | Record invoice received |
| POST | /api/v1/renewals/:id/match-invoice | Match invoice to PO |
| POST | /api/v1/renewals/:id/record-payment | Record payment |
| POST | /api/v1/renewals/:id/cancel | Cancel renewal |
| POST | /api/v1/renewals/:id/hold | Put on hold |
| POST | /api/v1/renewals/:id/resume | Resume from hold |
| POST | /api/v1/renewals/:id/escalate | Escalate |
| POST | /api/v1/renewals/:id/resolve-escalation | Resolve escalation |
| POST | /api/v1/renewals/:id/notes | Add note |
| PATCH | /api/v1/renewals/:id/notes/:noteId/pin | Pin/unpin note |
| POST | /api/v1/renewals/:id/tasks | Create task |
| PATCH | /api/v1/renewals/:id/tasks/:taskId | Update task |
| POST | /api/v1/renewals/:id/documents | Upload document |
| DELETE | /api/v1/renewals/:id/documents/:docId | Delete document |
| GET | /api/v1/renewals/:id/timeline | Get timeline entries |
| GET | /api/v1/renewals/:id/activity | Get activity log entries for this renewal |

### Standard Response Shape

```json
{
  "id": 42,
  "contract_id": 17,
  "year": 2026,
  "status": "quote_received",
  "priority": "normal",
  "assigned_to": { "id": 5, "name": "Jane Doe", "role": "procurement_specialist" },
  "vendor_quote_amount": 50000.00,
  "vendor_quote_currency": "USD",
  "vendor_quote_ref": "Q-2026-0842",
  "negotiated_amount": null,
  "budget_code": "IT-SOFT-2026",
  "budget_approved_amount": null,
  "health_score": { "score": 72, "level": "warning", "metrics": [...] },
  "risk_score": { "score": 35, "level": "medium", "factors": [...] },
  "sla": {
    "days_in_current_stage": 3,
    "sla_deadline": "2026-07-25T12:00:00Z",
    "sla_breached": false
  },
  "allowed_actions": ["view", "edit", "check_budget", "cancel", "hold"],
  "approvals": [...],
  "attestation": {...},
  "tasks": [...],
  "documents": [...],
  "emails": [...],
  "notes": [...],
  "timeline": [...],
  "created_at": "2026-07-18T10:00:00Z",
  "updated_at": "2026-07-20T14:30:00Z"
}
```

### State Transition Response

```json
{
  "success": true,
  "new_status": "legal_review",
  "transition": {
    "from": "budget_passed",
    "to": "legal_review",
    "action": "send_to_legal",
    "performed_by": { "id": 5, "name": "Jane Doe" },
    "performed_at": "2026-07-20T15:00:00Z"
  },
  "allowed_actions": ["view", "legal_approve", "legal_reject", "cancel", "hold"]
}
```

---

## 11. Database Schema

```sql
-- ============================================================
-- RENEWAL AGGREGATE
-- ============================================================

CREATE TABLE renewal (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id     INTEGER NOT NULL REFERENCES contract(id),
    year            INTEGER NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'pending_review',
    priority        INTEGER NOT NULL DEFAULT 1,  -- 0=low, 1=normal, 2=high, 3=critical

    -- Assignment
    assigned_to     INTEGER REFERENCES user(id),
    assigned_at     TIMESTAMP,

    -- Quote & negotiation
    vendor_quote_amount     DECIMAL(18,2),
    vendor_quote_currency   VARCHAR(3),
    vendor_quote_ref        VARCHAR(100),
    vendor_quote_received_at TIMESTAMP,
    vendor_quote_doc_id     INTEGER REFERENCES renewal_document(id),
    negotiated_amount       DECIMAL(18,2),
    negotiated_at           TIMESTAMP,

    -- Budget
    budget_code             VARCHAR(50),
    budget_approved_amount  DECIMAL(18,2),
    budget_checked_at       TIMESTAMP,

    -- Legal
    legal_approval_status   VARCHAR(20),  -- approved, rejected, not_required
    legal_reviewed_at       TIMESTAMP,

    -- Business approval
    business_approved_at    TIMESTAMP,

    -- PO & Invoice links
    po_id           INTEGER REFERENCES purchase_order(id),
    invoice_id      INTEGER REFERENCES invoice(id),

    -- Cancellation / Hold
    cancellation_reason     TEXT,
    hold_reason             TEXT,
    hold_until              DATE,
    escalation_level        INTEGER NOT NULL DEFAULT 0,
    escalated_at            TIMESTAMP,

    -- Metadata
    notes                   TEXT,
    tags                    TEXT,  -- JSON array

    -- Audit
    created_by      INTEGER NOT NULL REFERENCES user(id),
    updated_by      INTEGER REFERENCES user(id),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP,

    -- Constraints
    UNIQUE(contract_id, year),       -- one renewal per contract per year
    CHECK(vendor_quote_amount >= 0),
    CHECK(negotiated_amount >= 0 OR negotiated_amount IS NULL),
    CHECK(budget_approved_amount >= 0 OR budget_approved_amount IS NULL),
    CHECK(year >= 2020),
    CHECK(escalation_level BETWEEN 0 AND 4)
);

CREATE INDEX idx_renewal_contract_id ON renewal(contract_id);
CREATE INDEX idx_renewal_status ON renewal(status);
CREATE INDEX idx_renewal_assigned_to ON renewal(assigned_to);
CREATE INDEX idx_renewal_year ON renewal(year);
CREATE INDEX idx_renewal_deleted_at ON renewal(deleted_at)
    WHERE deleted_at IS NOT NULL;

-- ============================================================
-- APPROVAL RECORD
-- ============================================================

CREATE TABLE approval_record (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    renewal_id      INTEGER NOT NULL REFERENCES renewal(id),
    approver_type   VARCHAR(30) NOT NULL,
    approver_id     INTEGER NOT NULL REFERENCES user(id),
    delegate_id     INTEGER REFERENCES user(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    comments        TEXT,
    chain_order     INTEGER NOT NULL,
    sla_deadline    TIMESTAMP NOT NULL,
    sla_breached    BOOLEAN NOT NULL DEFAULT 0,
    reminded_at     TIMESTAMP,
    escalation_count INTEGER NOT NULL DEFAULT 0,
    decided_at      TIMESTAMP,
    deferred_until  TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(renewal_id, approver_type, status)
        -- Only one pending approval per type per renewal
        -- (use partial unique index in PostgreSQL)
);

CREATE INDEX idx_approval_renewal ON approval_record(renewal_id);
CREATE INDEX idx_approval_approver ON approval_record(approver_id);
CREATE INDEX idx_approval_status ON approval_record(status);

-- ============================================================
-- USAGE ATTESTATION
-- ============================================================

CREATE TABLE usage_attestation (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    renewal_id      INTEGER NOT NULL REFERENCES renewal(id),
    attested_by     INTEGER NOT NULL REFERENCES user(id),
    current_user_count  INTEGER NOT NULL,
    planned_changes     TEXT,
    still_required      BOOLEAN NOT NULL,
    alternative_considered  BOOLEAN,
    comments            TEXT,
    attested_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at          TIMESTAMP NOT NULL,

    CHECK(current_user_count > 0)
);

CREATE INDEX idx_attestation_renewal ON usage_attestation(renewal_id);

-- ============================================================
-- RENEWAL TIMELINE ENTRY
-- ============================================================

CREATE TABLE renewal_timeline_entry (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    renewal_id      INTEGER NOT NULL REFERENCES renewal(id),
    from_status     VARCHAR(50),
    to_status       VARCHAR(50) NOT NULL,
    action          VARCHAR(200) NOT NULL,
    performed_by    INTEGER NOT NULL REFERENCES user(id),
    performed_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    comments        TEXT,
    metadata        TEXT  -- JSON

    -- Immutable: no UPDATE allowed, only INSERT
);

CREATE INDEX idx_timeline_renewal ON renewal_timeline_entry(renewal_id);
CREATE INDEX idx_timeline_performed_at ON renewal_timeline_entry(performed_at);

-- ============================================================
-- RENEWAL DOCUMENT
-- ============================================================

CREATE TABLE renewal_document (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    renewal_id      INTEGER NOT NULL REFERENCES renewal(id),
    document_type   VARCHAR(30) NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    stored_file_name VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    content_type    VARCHAR(120) NOT NULL,
    file_size       INTEGER NOT NULL,
    storage_provider VARCHAR(50) NOT NULL DEFAULT 'local',
    storage_reference VARCHAR(500),
    uploaded_by     INTEGER NOT NULL REFERENCES user(id),
    uploaded_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rnwdoc_renewal ON renewal_document(renewal_id);

-- ============================================================
-- RENEWAL EMAIL
-- ============================================================

CREATE TABLE renewal_email (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    renewal_id      INTEGER NOT NULL REFERENCES renewal(id),
    direction       VARCHAR(10) NOT NULL,  -- outbound, inbound
    recipient       VARCHAR(255) NOT NULL,
    sender          VARCHAR(255) NOT NULL,
    subject         VARCHAR(500) NOT NULL,
    body            TEXT NOT NULL,
    email_type      VARCHAR(50) NOT NULL,
    vendor_email_ref VARCHAR(200),
    sent_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rnemail_renewal ON renewal_email(renewal_id);

-- ============================================================
-- RENEWAL NOTE
-- ============================================================

CREATE TABLE renewal_note (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    renewal_id      INTEGER NOT NULL REFERENCES renewal(id),
    author_id       INTEGER NOT NULL REFERENCES user(id),
    content         TEXT NOT NULL,
    is_pinned       BOOLEAN NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rnnote_renewal ON renewal_note(renewal_id);

-- ============================================================
-- RENEWAL TASK
-- ============================================================

CREATE TABLE renewal_task (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    renewal_id      INTEGER NOT NULL REFERENCES renewal(id),
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    assigned_to     INTEGER REFERENCES user(id),
    priority        VARCHAR(10) NOT NULL DEFAULT 'medium',
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    due_date        DATE,
    completed_at    TIMESTAMP,
    created_by      INTEGER NOT NULL REFERENCES user(id),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rntask_renewal ON renewal_task(renewal_id);
CREATE INDEX idx_rntask_assigned ON renewal_task(assigned_to);
CREATE INDEX idx_rntask_status ON renewal_task(status);
```

---

## 12. UI Workspace Mapping

Each of the 13 panels in the Renewal Workspace maps to specific aggregate data:

| Panel | Data Source | Widget Type | Stakeholder Question |
|---|---|---|---|
| **Progress Tracker** | `renewal.status` + state machine | Stepper (20-step) | "Where is this renewal right now?" |
| **SLA Timer** | `approval_record.sla_deadline` + `renewal.updated_at` | Countdown + warning | "Are we on track or behind?" |
| **Risk Score** | Computed from `RenewalRiskScoreChanged` event | Gauge + factors | "Should I worry about this renewal?" |
| **Timeline** | `renewal_timeline_entry` | Vertical timeline | "What happened and who did it?" |
| **Approvals** | `approval_record` | Approval chain cards | "Who needs to approve and have they?" |
| **Vendor Response** | `renewal_email` (inbound, vendor) + `renewal.status` | Status + last contact | "Has the vendor responded?" |
| **Customer Response** | `usage_attestation` + internal notes | Status + countdown | "Has the Business Owner responded?" |
| **Required Documents** | `renewal_document` grouped by `document_type` | Checklist | "What documents are still missing?" |
| **Purchase Order** | `purchase_order` (via `renewal.po_id`) | Card with status | "Has the PO been created and sent?" |
| **Invoice** | `invoice` (via `renewal.invoice_id`) | Card with status | "Has the invoice been matched?" |
| **Tasks** | `renewal_task` | Task list | "What still needs to be done?" |
| **Emails** | `renewal_email` | Email thread | "What did we say to the vendor?" |
| **Automation** | Automation rules + scheduled actions | Rule cards | "What is the system doing automatically?" |

### Widget Visibility Per State

| Widget | PENDING_REVIEW | ASSIGNED | QUOTE_RECEIVED | BUDGET_* | LEGAL_* | BUSINESS_* | PO_* | INVOICE_* | COMPLETE |
|---|---|---|---|---|---|---|---|---|---|
| Progress Tracker | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SLA Timer | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Risk Score | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Timeline | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Approvals | | | | | ✓ | ✓ | ✓ | ✓ | ✓ |
| Vendor Response | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Customer Response | | | | | | ✓ | ✓ | ✓ | |
| Required Documents | | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Purchase Order | | | | | | | ✓ | ✓ | ✓ |
| Invoice | | | | | | | | ✓ | ✓ |
| Tasks | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Emails | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Automation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 13. Commands to Implementation

When implementing, each command follows this pattern:

```python
# Pseudocode for a typical state transition command
def execute_record_quote(renewal_id: int, user: User, payload: RecordQuotePayload) -> Renewal:
    renewal = Renewal.query.get_or_404(renewal_id)
    
    # 1. Authorize
    authorize(user, "record_quote", renewal)
    
    # 2. Validate state machine transition
    if not can_transition(renewal.status, "record_quote"):
        raise InvalidTransition(f"Cannot record quote from {renewal.status}")
    
    # 3. Apply business rules
    if payload.amount < 0:
        raise ValidationError("Quote amount must be >= 0")
    
    # 4. Execute within transaction
    with db.transaction():
        renewal.vendor_quote_amount = payload.amount
        renewal.vendor_quote_currency = payload.currency
        renewal.vendor_quote_ref = payload.vendor_quote_ref
        renewal.status = "quote_received"
        renewal.updated_at = now()
        
        # 5. Create timeline entry
        timeline = RenewalTimelineEntry(
            renewal_id=renewal.id,
            from_status=renewal.status,  # snapshot before reassignment
            to_status="quote_received",
            action=f"Quote received: {payload.amount} {payload.currency}",
            performed_by=user.id,
            metadata={"amount": payload.amount, "currency": payload.currency}
        )
        db.session.add(timeline)
        
        # 6. Save
        db.session.commit()
    
    # 7. Emit domain event (after commit)
    event_bus.emit(QuoteReceived(
        renewal_id=renewal.id,
        amount=payload.amount,
        currency=payload.currency
    ))
    
    return reload(renewal)
```

---

## 14. Acceptance Criteria

The Renewal Aggregate is complete when:

1. **All 20 states** are implemented with correct transitions
2. **All 30+ domain events** are emitted on state changes
3. **All commands** enforce role-based authorization
4. **All invariants** are enforced (validation errors return 422, transition errors return 409)
5. **Timeline** is written for every state transition
6. **ActivityLog** is updated via domain events
7. **SLA timers** are started on entry and stopped on exit for relevant states
8. **Stalled detection** moves renewal to STALLED after 14 days of inactivity
9. **Escalation** auto-triggers on SLA breach (max 3 levels)
10. **Permissions** are enforced per the role table
11. **All child entities** (approvals, attestations, documents, tasks, notes, emails) are CRUD-capable within the aggregate
12. **Renewal Workspace** (13 panels) renders correctly for each state
