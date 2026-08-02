# Domain Model — Complete DDD Specification

## Document Control

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-07-20 | Principal Domain Architect | Initial complete DDD specification |

---

## 1. Strategic Design

### 1.1 Domain Classification

| Domain | Type | Rationale |
|---|---|---|
| **Renewal Operations** | Core | Primary source of business value. The reason Muraai exists. Competitive differentiator. |
| **Contract Management** | Supporting | Necessary for renewals but not differentiating. Could be outsourced or integrated from a CLM. |
| **Vendor Management** | Supporting | Required context for renewals. Simple CRUD with scoring. |
| **Product Catalog** | Supporting | Reference data for contract line items. |
| **Procurement** | Supporting | PO generation is a consequence of renewal approval. Not a full procurement system. |
| **Financial** | Supporting | Invoice reconciliation is required but not differentiating. |
| **Identity & Access** | Generic | Standard enterprise cross-cutting concern. Off-the-shelf patterns. |
| **Compliance** | Generic | Audit logging is required but not differentiating. |
| **Notification** | Generic | Standard notification delivery. Configurable but not novel. |
| **Policy Engine** | Generic | Rules engine for configurable business logic. Standard patterns. |

### 1.2 Bounded Context Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RENEWAL OPERATIONS (Core)                            │
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   Renewal    │◄───│  Approval    │◄───│   Policy     │                   │
│  │  Aggregate   │    │  Record      │    │   Engine     │                   │
│  │              │    │  (within     │    │  (external)  │                   │
│  │  AR: Renewal │    │   aggregate) │    │               │                   │
│  └──────┬───────┘    └──────────────┘    └──────────────┘                   │
│         │                                                                   │
│         │  references                    ┌──────────────┐                   │
│         ├───────────────────────────────►│  Contract    │                   │
│         │                                │  (external)  │                   │
│         │                                └──────────────┘                   │
│         │                                ┌──────────────┐                   │
│         ├───────────────────────────────►│  Vendor      │                   │
│         │                                │  (external)  │                   │
│         │                                └──────────────┘                   │
│         │                                ┌──────────────┐                   │
│         └───────────────────────────────►│  Product     │                   │
│                                          │  (external)  │                   │
│                                          └──────────────┘                   │
└─────────────────────┬───────────────────────────────────────────────────────┘
                      │
                      │  creates
                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PROCUREMENT (Supporting)                            │
│                                                                             │
│  ┌──────────────┐                    ┌──────────────┐                      │
│  │  Purchase    │───────────────────►│  Invoice     │                      │
│  │  Order       │                    │  (external)  │                      │
│  │              │                    │              │                      │
│  │  AR: PO      │                    │  AR: Invoice │                      │
│  └──────────────┘                    └──────────────┘                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      CROSS-CUTTING (Generic)                                │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │    User      │  │ ActivityLog  │  │ Notification │  │  PolicyRule  │   │
│  │              │  │              │  │              │  │              │   │
│  │  AR: User    │  │ AR: Entry    │  │ AR: Notif.   │  │ AR: Rule     │   │
│  │              │  │ (immutable)  │  │              │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Bounded Contexts — Detailed Definitions

### BC-01: RenewalOperations (Core Domain)

**Purpose:** Orchestrate every contract renewal from identification through to PO delivery. This is the heart of Muraai — without this context, the platform does not exist.

**Ubiquitous Language:**
- *Renewal* — A single instance of a contract renewal cycle
- *Approval Record* — One approval decision in the renewal's approval chain
- *Usage Attestation* — Business Owner's confirmation that the software is still needed
- *Timeline Entry* — A state transition record within a renewal's lifecycle

**Domain Events Produced:**
- RenewalCreated, RenewalAssigned, QuoteReceived, BudgetApproved, BudgetRejected, LegalApproved, LegalRejected, BusinessApproved, BusinessRejected, RenewalCancelled, RenewalOnHold, RenewalEscalated, UsageAttestationSubmitted, ApprovalSLABreached

**External Dependencies:**
- ContractManagement (read contract data)
- VendorManagement (read vendor data)
- ProductCatalog (read product data)
- PolicyEngine (evaluate approval rules)
- IdentityAccess (user lookup for assignment)

---

### BC-02: ContractManagement (Supporting Domain)

**Purpose:** Maintain the contract repository. Provide contract data to the renewal process. Track contract line items, documents, and clauses.

**Ubiquitous Language:**
- *Contract* — A software maintenance agreement between the enterprise and a vendor
- *Line Item* — A product covered under the contract with quantity and rate
- *Product Snapshot* — Immutable copy of product data at the time the contract was created

**Domain Events Produced:**
- ContractCreated, ContractUpdated, ContractEndDateApproaching

**External Dependencies:**
- VendorManagement (vendor reference)
- ProductCatalog (product reference for line items)

---

### BC-03: VendorManagement (Supporting Domain)

**Purpose:** Maintain vendor master data, contacts, risk ratings, and performance scorecards.

**Ubiquitous Language:**
- *Vendor* — A software company that provides maintenance services
- *Vendor Contact* — A person at the vendor responsible for renewals
- *Scorecard* — Performance evaluation of the vendor

**Domain Events Produced:**
- VendorCreated, VendorUpdated, VendorRiskRatingChanged

---

### BC-04: ProductCatalog (Supporting Domain)

**Purpose:** Manage products and SKUs that appear in contract line items.

**Ubiquitous Language:**
- *Product* — A software product covered by a maintenance contract
- *SKU* — Stock Keeping Unit, globally unique identifier

**Domain Events Produced:**
- ProductCreated, ProductUpdated, ProductDeactivated

---

### BC-05: Procurement (Supporting Domain)

**Purpose:** Generate and manage Purchase Orders derived from approved renewals.

**Ubiquitous Language:**
- *Purchase Order* — A formal document sent to the vendor to initiate the renewal purchase
- *PO Line Item* — A line within the PO, derived from the renewal's contract line items

**Domain Events Produced:**
- POCreated, POSent, POAcknowledged, PORejected, POCancelled

---

### BC-06: Financial (Supporting Domain)

**Purpose:** Manage invoice receipt, PO-invoice matching, exception resolution, and payment scheduling.

**Ubiquitous Language:**
- *Invoice* — A billing document from the vendor for the renewal
- *Invoice Exception* — A mismatch between the invoice and its matched PO
- *Forecast* — A projection of future renewal cash outflow

**Domain Events Produced:**
- InvoiceReceived, InvoiceMatched, InvoiceExceptionCreated, InvoiceExceptionResolved, PaymentScheduled, PaymentRecorded

---

### BC-07: IdentityAccess (Generic Domain)

**Purpose:** User management, authentication, authorization, and role-based access control.

**Ubiquitous Language:**
- *User* — A person who accesses the platform
- *Role* — A named collection of permissions
- *Permission* — A granular access right

---

### BC-08: Compliance (Generic Domain)

**Purpose:** Immutable audit trail of all state-changing operations.

**Ubiquitous Language:**
- *Activity Log Entry* — A single auditable event recording who did what, when, and what changed

---

### BC-09: Notification (Generic Domain)

**Purpose:** Deliver in-app and email notifications to stakeholders based on domain events.

**Ubiquitous Language:**
- *Notification* — A message delivered to a user about an event they need to act on

---

### BC-10: PolicyEngine (Generic Domain)

**Purpose:** Evaluate configurable business rules to determine approval chains, escalation paths, mandatory actions, and validation constraints.

**Ubiquitous Language:**
- *Policy Rule* — A configurable if-then rule that governs a business process

---

## 3. Entities — Full Specification

### 3.1 Renewal (AR — Aggregate Root of RenewalOperations)

#### Purpose
A Renewal represents a single contract renewal cycle. It is the central entity of Muraai. Everything else exists to serve the renewal workflow. A Renewal is created when a Contract approaches its end date and progresses through a deterministic 10-state machine until a Purchase Order is issued or the renewal is terminated.

#### Attributes

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| id | UUID | Yes | Auto-generated | Primary identifier |
| contract_id | UUID | Yes | — | FK to Contract being renewed |
| year | Integer | Yes | Current year | The renewal year (e.g., 2026) |
| status | RenewalStatus | Yes | `pending_review` | Current position in state machine |
| priority | Priority | Yes | `normal` | Business priority for triage |
| assigned_to | UUID | No | Null | FK to User (Procurement Specialist) |
| assigned_at | DateTime | No | Null | When the renewal was assigned |
| vendor_quote_ref | String(100) | No | Null | Vendor's quote or proposal reference |
| vendor_quote_amount | Money | No | Null | Amount quoted by vendor |
| vendor_quote_currency | CurrencyCode | No | Null | ISO 4217 currency code |
| vendor_quote_received_at | DateTime | No | Null | When quote was received |
| vendor_quote_document_url | String(500) | No | Null | URL to uploaded quote document |
| negotiated_amount | Money | No | Null | After negotiation (if applicable) |
| negotiated_at | DateTime | No | Null | When negotiation concluded |
| budget_code | String(50) | No | Null | Accounting budget code |
| budget_approved_amount | Money | No | Null | Amount approved by Business Owner/CFO |
| budget_checked_at | DateTime | No | Null | When budget validation occurred |
| legal_approval_status | ApprovalStatus | No | Null | Result of legal review |
| legal_reviewed_at | DateTime | No | Null | When legal review completed |
| usage_attestation_id | UUID | No | Null | FK to UsageAttestation |
| business_approved_at | DateTime | No | Null | When Business Owner approved |
| po_id | UUID | No | Null | FK to PurchaseOrder (after creation) |
| invoice_id | UUID | No | Null | FK to Invoice (after matching) |
| cancellation_reason | Text | No | Null | Why the renewal was cancelled |
| hold_reason | Text | No | Null | Why the renewal was put on hold |
| hold_until | Date | No | Null | Expected resolution date |
| escalation_level | Integer | No | 0 | Current escalation level (0-4) |
| escalation_escalated_at | DateTime | No | Null | When last escalation occurred |
| notes | Text | No | Null | Freeform operational notes |
| tags | String(100)[] | No | [] | Categorization tags |
| created_at | DateTime | Yes | Now() | Record creation timestamp |
| updated_at | DateTime | Yes | Now() | Record update timestamp |
| deleted_at | DateTime | No | Null | Soft delete timestamp |

#### Value Object: Money
```typescript
Money = {
  amount: Decimal(18, 2),  // 18 significant digits, 2 decimal places
  currency: CurrencyCode   // ISO 4217 (e.g., "USD", "EUR", "GBP")
}
```

#### Value Object: Priority
```typescript
Priority = Enum {
  LOW = 0,
  NORMAL = 1,    // Default
  HIGH = 2,
  CRITICAL = 3
}
```

#### Value Object: ApprovalStatus
```typescript
ApprovalStatus = {
  status: Enum { PENDING, APPROVED, REJECTED, NOT_REQUIRED },
  decided_by: UUID | null,       // FK to User
  decided_at: DateTime | null,
  comments: Text | null
}
```

#### Value Object: RenewalStatus
```typescript
RenewalStatus = Enum {
  // Active states
  PENDING_REVIEW,      // Created but not yet assigned
  ASSIGNED,            // Assigned to Procurement Specialist
  QUOTE_RECEIVED,      // Vendor quotation received
  BUDGET_CHECK,        // Budget validation in progress
  BUDGET_REVIEW,       // Budget insufficient — needs renegotiation or escalation
  LEGAL_REVIEW,        // Sent to Legal for terms review
  BUSINESS_APPROVAL,   // Sent to Business Owner for final approval
  
  // Terminal states
  PO_CREATED,          // Purchase Order has been created
  COMPLETE,            // Invoice matched, renewal fully processed
  CANCELLED,           // Renewal will not proceed
  
  // Interrupt states
  ON_HOLD,             // Paused pending resolution
  ESCALATED            // Sent to higher authority for decision
}
```

#### Lifecycle (State Machine)

```
                    ┌──────────────────────────────────────────────────────────┐
                    │                    RENEWAL STATE MACHINE                 │
                    └──────────────────────────────────────────────────────────┘

    [Contract end_date enters renewal window]
              │
              ▼
    ┌─────────────────┐
    │  PENDING_REVIEW │ ← System creates Renewal when contract end_date is within
    └────────┬────────┘   the configured renewal window (default: 90 days).
             │             S1 reviews and assigns.
             │
             ▼
    ┌─────────────────┐
    │    ASSIGNED      │ ← S1 assigns to S2 (Procurement Specialist).
    └────────┬────────┘   S2 contacts vendor for quote.
             │
             ▼
    ┌─────────────────┐
    │  QUOTE_RECEIVED  │ ← S2 uploads vendor quote. Amount, reference, document.
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │   BUDGET_CHECK   │ ← System validates against budget code (auto or manual).
    └────────┬────────┘
             │
     ┌───────┴───────┐
     │               │
     ▼               ▼
┌───────────┐  ┌───────────┐
│  BUDGET   │  │  BUDGET   │ ← Budget insufficient. S2 may negotiate or
│ APPROVED  │  │  REVIEW   │   escalate to S8.
└─────┬─────┘  └─────┬─────┘
      │              │ (negotiate → return to QUOTE_RECEIVED)
      │              │ (escalate → continue if approved)
      │              │
      ▼              ▼
┌─────────────────┐
│  LEGAL_REVIEW    │ ← Only if triggered by policy rules:
└────────┬────────┘   value > threshold, terms changed, or contract type requires it.
         │
  ┌──────┴──────┐
  │             │
  ▼             ▼
APPROVED     REJECTED → QUOTE_RECEIVED (renegotiate) or CANCELLED
  │
  │
  ▼
┌──────────────────────┐
│  BUSINESS_APPROVAL   │ ← Usage attestation required if >12 months since last.
└──────────┬───────────┘   SLA: 48h → escalate to manager, 72h → director, 96h → CTO/CFO
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
APPROVED      REJECTED → CANCELLED
    │
    │
    ▼
┌─────────────────┐
│   PO_CREATED     │ ← System creates PO draft. S2 sends to vendor.
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  COMPLETE        │ ← Invoice received and matched. Renewal fully processed.
└─────────────────┘

Interrupt states (accessible from most active states):
┌───────────┐     ┌────────────┐
│ ON_HOLD   │────►│ Any active  │ ← Resume
└───────────┘     │ state      │
                  └────────────┘
┌───────────┐     ┌────────────┐
│ ESCALATED │────►│ Any active  │ ← Resolve
└───────────┘     │ state      │
                  └────────────┘
┌───────────┐
│ CANCELLED │ ← Terminal. No outgoing transitions.
└───────────┘

Allowed transitions (enforced by service layer):
PENDING_REVIEW    → ASSIGNED, CANCELLED, ON_HOLD
ASSIGNED          → QUOTE_RECEIVED, CANCELLED, ON_HOLD, ESCALATED
QUOTE_RECEIVED    → BUDGET_CHECK, CANCELLED, ON_HOLD, ESCALATED
BUDGET_CHECK      → ASSIGNED(quote), LEGAL_REVIEW, BUSINESS_APPROVAL, CANCELLED
BUDGET_REVIEW     → QUOTE_RECEIVED(negotiate), LEGAL_REVIEW(override), CANCELLED
LEGAL_REVIEW      → QUOTE_RECEIVED(redline), BUSINESS_APPROVAL, CANCELLED
BUSINESS_APPROVAL → PO_CREATED, CANCELLED, ON_HOLD
PO_CREATED        → COMPLETE, CANCELLED
ON_HOLD           → [previous state], CANCELLED
ESCALATED         → [previous state], CANCELLED
CANCELLED         → (no outgoing transitions)
COMPLETE          → (no outgoing transitions)
```

#### Owner
RenewalOperations bounded context. The Renewal aggregate root owns all state transitions.

#### Relationships

| Relationship | Entity | Type | Cardinality | Description |
|---|---|---|---|---|
| Renewal → Contract | Contract | Reference | N:1 | Each renewal is for exactly one contract |
| Renewal → ApprovalRecord | ApprovalRecord | Composition | 1:N | A renewal can have multiple approval records |
| Renewal → UsageAttestation | UsageAttestation | Composition | 0:1 | A renewal has at most one active attestation |
| Renewal → User (assigned_to) | User | Reference | N:1 | A renewal is assigned to one Procurement Specialist |
| Renewal → PurchaseOrder | PurchaseOrder | Reference | 1:0..1 | A renewal may have one PO (generated from it) |
| Renewal → Invoice | Invoice | Reference | 1:0..1 | A renewal may have one matched invoice |
| Renewal → ActivityLog | ActivityLogEntry | Reference | 1:N | All state transitions are logged |
| Renewal → TimelineEntry | TimelineEntry | Composition | 0:N | Visual timeline of state history |

#### Business Rules (Invariants)

| ID | Rule | Consequence |
|---|---|---|
| R-RNW-001 | A Renewal can only be in one status at a time. | State machine enforces single active status. |
| R-RNW-002 | Status transitions must follow the allowed transition map. | Invalid transitions return HTTP 409 Conflict. |
| R-RNW-003 | A Renewal cannot be created without a valid Contract. | FK constraint + existence check. |
| R-RNW-004 | A Renewal cannot transition to PO_CREATED without business approval. | Service layer checks approval status. |
| R-RNW-005 | A Renewal cannot transition to COMPLETE without a matched invoice. | Service layer checks invoice match status. |
| R-RNW-006 | A Renewal cannot be assigned to a user who is also the approver. | Segregation of duties. |
| R-RNW-007 | A Renewal on hold requires a reason and expected resolution date. | Validation on hold transition. |
| R-RNW-008 | A Renewal can only be cancelled from an active state. | State machine enforcement. |
| R-RNW-009 | A Renewal's year must match the contract's renewal year. | Validation on creation. |
| R-RNW-010 | Duplicate renewals for the same contract+year combination are not allowed. | Unique constraint on (contract_id, year). |

#### Validation Rules

| Field | Rule |
|---|---|
| contract_id | Must reference an existing Contract |
| year | Must be ≥ 2020 and ≤ current year + 5 |
| assigned_to | Must be a User with the Procurement Specialist role |
| vendor_quote_amount | Must be ≥ 0 |
| negotiated_amount | Must be ≥ 0, must be ≤ vendor_quote_amount if set |
| budget_approved_amount | Must be ≥ 0 |
| cancellation_reason | Required when status = CANCELLED |
| hold_reason | Required when status = ON_HOLD |
| hold_until | Required when status = ON_HOLD, must be in the future |
| escalation_level | Must be 0-4 |
| budget_code | Must match configured budget code pattern (configurable) |
| tags | Max 10 tags, each ≤ 50 characters |

#### Future Scalability

| Consideration | Evolution Path |
|---|---|
| **Multi-year renewals** | Add `term_months` field; extend year to `term_start_year` / `term_end_year` |
| **Partial renewals** | Add `renewal_scope` (full / partial / line-items-only); link specific line items |
| **Renewal bundles** | Allow a single Renewal to reference multiple Contracts (portfolio renewal) |
| **Automated renewals** | Add `auto_renew` flag with configurable auto-approval rules for low-risk renewals |
| **Vendor counter-signatures** | Add `vendor_acceptance_status` and `vendor_acceptance_at` fields |
| **Renewal templates** | Allow saving renewal configurations as templates for recurring patterns |
| **Historical comparison** | Store prior year's renewal data in the Renewal for trend analysis |

---

### 3.2 ApprovalRecord (Entity within Renewal Aggregate)

#### Purpose
Record a single approval or rejection decision within a renewal's approval chain. Multiple ApprovalRecords may exist for a single renewal (Legal approval, Business Owner approval, CFO approval).

#### Attributes

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| id | UUID | Yes | Auto-generated | Primary identifier |
| renewal_id | UUID | Yes | — | FK to Renewal |
| approver_type | ApprovalType | Yes | — | Which role is approving (Legal, Business, Financial) |
| approver_id | UUID | Yes | — | FK to User who must approve |
| delegate_id | UUID | No | Null | FK to User who approved on behalf of the approver |
| status | ApprovalStatus | Yes | `pending` | Pending, Approved, Rejected, Cancelled |
| comments | Text | No | Null | Reason for approval/rejection |
| approval_chain_order | Integer | Yes | 1 | Position in sequential approval chain |
| sla_deadline | DateTime | Yes | — | By when the approval must be decided |
| sla_breached | Boolean | Yes | False | Whether the SLA was violated |
| reminded_at | DateTime | No | Null | Last reminder sent timestamp |
| escalation_count | Integer | Yes | 0 | Number of escalation levels triggered |
| decided_at | DateTime | No | Null | When the decision was made |
| created_at | DateTime | Yes | Now() | |

#### Value Object: ApprovalType
```typescript
ApprovalType = Enum {
  LEGAL = "legal",
  BUSINESS_OWNER = "business_owner",
  FINANCIAL = "financial",
  PROCUREMENT_MANAGER = "procurement_manager",
  CTO = "cto",
  CFO = "cfo"
}
```

#### Lifecycle
```
Pending → Approved (terminal)
Pending → Rejected (terminal)
Pending → Cancelled (terminal — approval chain changed)
```

#### Owner
RenewalOperations bounded context. Part of the Renewal aggregate.

#### Relationships

| Relationship | Entity | Type | Cardinality |
|---|---|---|---|
| ApprovalRecord → Renewal | Renewal | Composition | N:1 |
| ApprovalRecord → User (approver) | User | Reference | N:1 |
| ApprovalRecord → User (delegate) | User | Reference | N:0..1 |

#### Business Rules

| ID | Rule |
|---|---|
| R-APR-001 | An ApprovalRecord cannot transition from a terminal state. |
| R-APR-002 | The approver and the user who created the renewal request must not be the same user. |
| R-APR-003 | Comments are required when rejecting. |
| R-APR-004 | Only one pending ApprovalRecord per approver_type per renewal is allowed. |
| R-APR-005 | ApprovalRecords must be decided in chain_order sequence. |

---

### 3.3 UsageAttestation (Entity within Renewal Aggregate)

#### Purpose
Captures the Business Owner's confirmation that the software covered by the renewal is still in use and required. Prevents renewal of unused licenses.

#### Attributes

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| id | UUID | Yes | Auto-generated | |
| renewal_id | UUID | Yes | — | FK to Renewal |
| attested_by | UUID | Yes | — | FK to User (Business Owner) |
| current_user_count | Integer | Yes | — | Number of current active users |
| planned_changes | Text | No | Null | Expected changes in user count |
| still_required | Boolean | Yes | — | Is the software still needed? |
| alternative_considered | Boolean | No | Null | Was an alternative evaluated? |
| comments | Text | No | Null | Additional context |
| attested_at | DateTime | Yes | Now() | |
| expires_at | DateTime | Yes | — | Valid for 12 months from attestation |

#### Lifecycle
```
Created (immutable after creation — no updates, only new attestation)
```

#### Business Rules

| ID | Rule |
|---|---|
| R-ATT-001 | UsageAttestation expires 12 months after creation. A new one is required for the next renewal cycle. |
| R-ATT-002 | If `still_required` is false, the renewal must proceed to cancellation or right-sizing workflow. |
| R-ATT-003 | The attestor must be a User with the Business Owner role for the relevant contract. |
| R-ATT-004 | `current_user_count` must be a positive integer. |

---

### 3.4 RenewalTimelineEntry (Entity within Renewal Aggregate)

#### Purpose
Record a visual timeline entry for the renewal's state machine history. Each state transition generates one timeline entry. Separate from ActivityLog — this is optimized for the renewal detail view.

#### Attributes

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | |
| renewal_id | UUID | Yes | FK to Renewal |
| from_status | RenewalStatus | No | Previous status (null for initial creation) |
| to_status | RenewalStatus | Yes | New status |
| action | String(100) | Yes | Human-readable action name (e.g., "Assigned to John Doe") |
| performed_by | UUID | Yes | FK to User |
| performed_at | DateTime | Yes | |
| comments | Text | No | Optional context |
| metadata | JSONB | No | Additional structured data (amounts, references, etc.) |

---

### 3.5 Contract (AR — Aggregate Root of ContractManagement)

#### Purpose
Represents a software maintenance agreement between the enterprise and a vendor. The Contract is the source of truth for renewal identification — when `end_date` approaches, a Renewal is created.

#### Attributes

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| id | UUID | Yes | Auto-generated | |
| vendor_id | UUID | Yes | — | FK to Vendor |
| contract_name | String(200) | Yes | — | |
| contract_number | String(100) | Yes | — | Vendor's contract reference |
| contract_type | ContractType | Yes | — | Maintenance, Support, Subscription, SaaS |
| description | Text | No | Null | |
| start_date | Date | Yes | — | |
| end_date | Date | Yes | — | Current term end |
| renewal_date | Date | No | Null | When renewal must be initiated (usually 90 days before end_date) |
| renewal_window_days | Integer | No | 90 | How many days before end_date renewal process begins |
| total_contract_value | Money | Yes | — | Current term value |
| currency | CurrencyCode | Yes | "USD" | |
| status | ContractStatus | Yes | "active" | Active, Expired, Terminated |
| auto_renewal | Boolean | Yes | False | Does the contract auto-renew if no action is taken? |
| auto_renewal_notice_period | Integer | No | Null | Days before end date to provide notice of non-renewal |
| auto_renewal_term_months | Integer | No | 12 | If auto-renewal, the term length |
| billing_frequency | BillingFrequency | No | "annual" | Annual, Quarterly, Monthly, One-time |
| budget_code_default | String(50) | No | Null | Default budget code for renewals |
| notification_email | String(200) | No | Null | Email for renewal notifications |
| notification_enabled | Boolean | Yes | False | |
| user_id | UUID | Yes | — | FK to User (owner/internal responsible person) |
| renewal_count | Integer | Yes | 0 | Number of times this contract has been renewed |
| latest_renewal_id | UUID | No | Null | FK to the most recent Renewal |
| created_at | DateTime | Yes | Now() | |
| updated_at | DateTime | Yes | Now() | |
| deleted_at | DateTime | No | Null | Soft delete |

#### Value Object: ContractType
```typescript
ContractType = Enum {
  MAINTENANCE = "maintenance",    // Bug fixes, support, updates
  SUPPORT = "support",            // Technical support only
  SUBSCRIPTION = "subscription",  // Time-based access
  SAAS = "saas",                  // Cloud-hosted software
  LICENSE = "license",            // Perpetual license (no renewal, but maintenance)
  OTHER = "other"
}
```

#### Value Object: ContractStatus
```typescript
ContractStatus = Enum {
  ACTIVE = "active",
  EXPIRED = "expired",
  TERMINATED = "terminated",
  DRAFT = "draft"
}
```

#### Value Object: BillingFrequency
```typescript
BillingFrequency = Enum {
  ANNUAL = "annual",
  QUARTERLY = "quarterly",
  MONTHLY = "monthly",
  ONE_TIME = "one_time"
}
```

#### Lifecycle
```
Draft → Active → Expired (by end_date)
Draft → Active → Terminated (by user action)
Draft → Terminated (directly)
Active → Expired (end_date reached without renewal)
Active → Active (renewed — new end_date, incremented renewal_count)
```

#### Relationships

| Relationship | Entity | Type | Cardinality |
|---|---|---|---|
| Contract → Vendor | Vendor | Reference | N:1 |
| Contract → ContractLineItem | ContractLineItem | Composition | 1:N |
| Contract → ContractDocument | ContractDocument | Composition | 0:N |
| Contract → ContractClause | ContractClause | Composition | 0:N |
| Contract → Renewal | Renewal | Reference | 1:N |
| Contract → User (owner) | User | Reference | N:1 |

#### Business Rules

| ID | Rule |
|---|---|
| R-CTR-001 | `end_date` must be after `start_date`. |
| R-CTR-002 | `renewal_date` must be on or before `end_date`. |
| R-CTR-003 | `total_contract_value` must equal the sum of all line item totals. |
| R-CTR-004 | A Contract cannot be deleted if it has active Renewals (soft-deactivate instead). |
| R-CTR-005 | A Contract can only transition to `renewed` status via a Renewal, not by direct update. |
| R-CTR-006 | `notification_email` is required when `notification_enabled` is true. |
| R-CTR-007 | `auto_renewal_notice_period` is required when `auto_renewal` is true. |

#### Validation Rules

| Field | Rule |
|---|---|
| contract_name | 1-200 characters |
| contract_number | 1-100 characters, unique per vendor |
| start_date | Must be in the past or today |
| end_date | Must be after start_date |
| renewal_window_days | Must be 30-365 |
| total_contract_value | Must be ≥ 0 |

#### Future Scalability

| Consideration | Evolution Path |
|---|---|
| **Contract hierarchy** | Add parent_contract_id for master agreements with subordinate contracts |
| **Contract amendments** | Create Amendment entity with effective date, linked to parent Contract |
| **Multi-currency** | Add fx_rate fields for contracts in non-base currency |
| **Contract templates** | Allow contract creation from templates with pre-populated clauses and line items |
| **Versioning** | Add contract version number with prior version reference for amendment tracking |

---

### 3.6 ContractLineItem (Entity within Contract Aggregate)

#### Purpose
Represents a product covered under the contract. Captures quantity, rate, and total. Uses an immutable ProductSnapshot to preserve the product's details at contract time, protecting against later changes to the Product entity.

#### Attributes

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | |
| contract_id | UUID | Yes | FK to Contract |
| product_id | UUID | Yes | FK to Product (at creation time) |
| product_snapshot | JSONB | Yes | Immutable copy: {name, code, sku, category, rate, description} |
| description | String(500) | No | Line-specific description override |
| quantity | Integer | Yes | Number of units/licenses |
| unit_rate | Decimal(18,2) | Yes | Per-unit rate |
| line_total | Decimal(18,2) | Yes | quantity × unit_rate (may be overridden) |
| negotiated_rate | Decimal(18,2) | No | If different from standard product rate |
| discount_percent | Decimal(5,2) | No | Discount percentage |
| discount_amount | Decimal(18,2) | No | Discount amount (computed or manual) |
| tax_percent | Decimal(5,2) | No | Tax percentage |
| tax_amount | Decimal(18,2) | No | Computed tax amount |
| line_total_with_tax | Decimal(18,2) | No | line_total + tax_amount - discount_amount |
| sort_order | Integer | Yes | Display order |

#### Business Rules

| ID | Rule |
|---|---|
| R-CLI-001 | `line_total` must equal `quantity × unit_rate` unless manually overridden (with reason). |
| R-CLI-002 | `quantity` must be ≥ 1. |
| R-CLI-003 | `unit_rate` must be ≥ 0. |
| R-CLI-004 | `discount_percent` must be 0-100. |
| R-CLI-005 | `tax_percent` must be 0-100. |
| R-CLI-006 | Product snapshot is immutable after creation. If the Product changes, the snapshot retains the original values. |

---

### 3.7 ContractDocument (Entity within Contract Aggregate)

#### Attributes

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | |
| contract_id | UUID | Yes | FK to Contract |
| document_type | DocumentType | Yes | Contract, SOW, Amendment, Attachment |
| file_name | String(255) | Yes | |
| file_url | String(500) | Yes | S3 or storage URL |
| file_size_bytes | Integer | Yes | |
| mime_type | String(100) | Yes | |
| uploaded_by | UUID | Yes | FK to User |
| uploaded_at | DateTime | Yes | |

```typescript
DocumentType = Enum { CONTRACT, SOW, AMENDMENT, ATTACHMENT, OTHER }
```

---

### 3.8 ContractClause (Entity within Contract Aggregate)

#### Attributes

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | |
| contract_id | UUID | Yes | FK to Contract |
| clause_type | String(100) | Yes | e.g., "liability_cap", "termination", "indemnification" |
| title | String(200) | Yes | |
| content | Text | Yes | Full clause text |
| is_standard | Boolean | Yes | Is this from the standard clause library? |
| standard_clause_id | UUID | No | If standard, link to library version |
| deviation | Text | No | Description of deviation from standard |
| created_at | DateTime | Yes | |

---

### 3.9 Vendor (AR — Aggregate Root of VendorManagement)

#### Purpose
Represents a software vendor that the enterprise has maintenance contracts with. Central repository for all vendor-related data.

#### Attributes

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| id | UUID | Yes | Auto-generated | |
| name | String(200) | Yes | — | Legal entity name |
| vendor_code | String(50) | Yes | — | Internal vendor identifier |
| website | String(500) | No | Null | |
| vendor_tier | VendorTier | Yes | "standard" | Strategic, Preferred, Standard, Non-preferred |
| risk_rating | RiskRating | Yes | "low" | Low, Medium, High, Critical |
| payment_terms | String(100) | No | "Net 30" | Standard payment terms |
| tax_id | String(50) | No | Null | Tax/VAT registration |
| billing_address | Address | No | Null | |
| currency_default | CurrencyCode | No | "USD" | Default currency for quotes |
| preferred | Boolean | Yes | False | Is this a preferred vendor? |
| notes | Text | No | Null | |
| total_contract_count | Integer | Yes | 0 | Computed via counter cache |
| total_spend | Decimal(18,2) | Yes | 0 | Computed via counter cache |
| average_discount_rate | Decimal(5,2) | No | Null | Computed from renewal history |
| relationship_start_date | Date | No | Null | When relationship began |
| relationship_manager_id | UUID | No | Null | FK to User (internal relationship manager) |
| created_at | DateTime | Yes | Now() | |
| updated_at | DateTime | Yes | Now() | |
| deleted_at | DateTime | No | Null | Soft delete |

#### Value Objects

```typescript
VendorTier = Enum {
  STRATEGIC = "strategic",
  PREFERRED = "preferred",
  STANDARD = "standard",
  NON_PREFERRED = "non_preferred"
}

RiskRating = Enum {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical"
}

Address = {
  line1: String(200),
  line2: String(200) | null,
  city: String(100),
  state: String(100),
  postal_code: String(20),
  country: String(100)
}
```

#### Lifecycle
```
Created → Active (default)
Active → Inactive (soft delete, only if no active contracts)
```

#### Relationships

| Relationship | Entity | Type | Cardinality |
|---|---|---|---|
| Vendor → VendorContact | VendorContact | Composition | 1:N |
| Vendor → VendorScorecard | VendorScorecard | Composition | 0:1 |
| Vendor → Contract | Contract | Reference | 1:N |
| Vendor → PurchaseOrder | PurchaseOrder | Reference | 1:N |
| Vendor → Invoice | Invoice | Reference | 1:N |

#### Business Rules

| ID | Rule |
|---|---|
| R-VEN-001 | A Vendor cannot be deleted if it has active Contracts (soft-deactivate instead). |
| R-VEN-002 | `vendor_code` must be unique. |
| R-VEN-003 | At least one VendorContact with `is_primary = true` is required. |
| R-VEN-004 | `risk_rating` must be reviewed annually (configurable policy). |

---

### 3.10 VendorContact (Entity within Vendor Aggregate)

#### Attributes

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | |
| vendor_id | UUID | Yes | FK to Vendor |
| name | String(200) | Yes | |
| email | String(200) | Yes | |
| phone | String(50) | No | |
| role | String(100) | No | e.g., "Account Manager", "Renewals Specialist" |
| is_primary | Boolean | Yes | Is this the primary contact for renewals? |
| notes | Text | No | |

---

### 3.11 VendorScorecard (Entity within Vendor Aggregate)

#### Attributes

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | |
| vendor_id | UUID | Yes | FK to Vendor (1:1) |
| scorecard_period | String(20) | Yes | e.g., "2026-Q2", "2026" |
| overall_score | Decimal(3,1) | No | 0.0 - 10.0 |
| dimensions | JSONB | Yes | Configurable dimensions: {pricing_trend, sla_compliance, support_quality, responsiveness, contract_flexibility} |
| calculated_at | DateTime | Yes | |
| calculated_by | String(50) | Yes | "system" or "manual" |

---

### 3.12 Product (AR — Aggregate Root of ProductCatalog)

#### Purpose
Represents a software product that can appear in contract line items. SKU is auto-generated and globally unique.

#### Attributes

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| id | UUID | Yes | Auto-generated | |
| name | String(200) | Yes | — | |
| code | String(80) | No | Null | Vendor product code |
| sku | String(100) | Yes | Auto-generated | Format: SKU-{CAT3}-MUR-{YEAR}-{SEQUENCE} |
| category | String(100) | No | Null | e.g., "ERP", "CRM", "Infrastructure" |
| rate | Decimal(18,2) | Yes | — | Standard per-unit rate |
| price | Decimal(18,2) | No | Null | List price (may differ from rate) |
| description | Text | No | Null | |
| status | ProductStatus | Yes | "active" | Active, Inactive |
| user_id | UUID | Yes | — | FK to User (owner) |
| created_at | DateTime | Yes | Now() | |
| updated_at | DateTime | Yes | Now() | |
| deleted_at | DateTime | No | Null | Soft delete |

```typescript
ProductStatus = Enum { ACTIVE = "active", INACTIVE = "inactive" }
```

#### Lifecycle
```
Active → Inactive (soft deactivation when referenced by contracts)
Inactive → Active (restore)
Active → Deleted (hard delete only if never referenced)
```

#### Relationships

| Relationship | Entity | Type | Cardinality |
|---|---|---|---|
| Product → SKU | — | Value Object | 1:1 |
| Product → ContractLineItem | ContractLineItem | Reference | 1:N |

#### Business Rules

| ID | Rule |
|---|---|
| R-PRD-001 | SKU must be globally unique (database + application-level enforcement). |
| R-PRD-002 | A Product cannot be hard-deleted if it is referenced by any ContractLineItem (soft-deactivate instead). |
| R-PRD-003 | `rate` must be ≥ 0. |
| R-PRD-004 | `sku` is auto-generated and cannot be modified after creation. |

#### SKU Generation

See `10-decisions/index.md` → ADR-001 for the complete specification.

```python
# Format: SKU-{category_code_3chars}-MUR-{year}-{sequence_6digits}
# Example: SKU-ERP-MUR-2026-000001
# Sequence allocated atomically via sku_counter table.
```

---

### 3.13 PurchaseOrder (AR — Aggregate Root of Procurement)

#### Purpose
Represents a purchase order sent to a vendor for an approved renewal. Links the renewal workflow to financial execution.

#### Attributes

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| id | UUID | Yes | Auto-generated | |
| po_number | String(50) | Yes | Auto-generated | System-generated PO reference |
| renewal_id | UUID | Yes | — | FK to Renewal (source) |
| vendor_id | UUID | Yes | — | FK to Vendor |
| status | POStatus | Yes | "draft" | Draft, Sent, Acknowledged, Rejected, Cancelled, Complete |
| total_amount | Money | Yes | — | |
| currency | CurrencyCode | Yes | "USD" | |
| budget_code | String(50) | No | Null | |
| budget_approved_amount | Decimal(18,2) | No | Null | |
| line_items | POLineItem[] | Yes | — | |
| notes | Text | No | Null | Internal notes |
| vendor_po_reference | String(100) | No | Null | Vendor's PO reference (if different) |
| sent_at | DateTime | No | Null | When PO was sent to vendor |
| sent_by | UUID | No | Null | FK to User who sent |
| sent_method | String(50) | No | Null | email, edi, portal |
| acknowledged_at | DateTime | No | Null | When vendor acknowledged |
| rejected_at | DateTime | No | Null | When vendor rejected |
| rejection_reason | Text | No | Null | |
| document_url | String(500) | No | Null | Generated PO document |
| erp_sync_status | ERPSyncStatus | Yes | "pending" | Pending, Synced, Failed |
| erp_synced_at | DateTime | No | Null | |
| erp_reference | String(100) | No | Null | ERP's PO identifier |
| created_by | UUID | Yes | — | FK to User who created |
| created_at | DateTime | Yes | Now() | |
| updated_at | DateTime | Yes | Now() | |

```typescript
POStatus = Enum {
  DRAFT = "draft",
  SENT = "sent",
  ACKNOWLEDGED = "acknowledged",
  REJECTED = "rejected",
  CANCELLED = "cancelled",
  COMPLETE = "complete"
}

ERPSyncStatus = Enum {
  PENDING = "pending",
  SYNCED = "synced",
  FAILED = "failed"
}
```

#### Lifecycle

```
Draft ──► Sent ──► Acknowledged ──► Complete
  │       │            │
  │       ▼            │
  └──► Cancelled   Rejected ──► (re-enter as new PO version)
```

#### Relationships

| Relationship | Entity | Type | Cardinality |
|---|---|---|---|
| PO → Renewal | Renewal | Reference | N:1 |
| PO → Vendor | Vendor | Reference | N:1 |
| PO → POLineItem | POLineItem | Composition | 1:N |
| PO → Invoice | Invoice | Reference | 0:N |

#### Business Rules

| ID | Rule |
|---|---|
| R-PO-001 | `total_amount` cannot exceed the approved renewal amount. |
| R-PO-002 | `total_amount` must equal the sum of all line item totals. |
| R-PO-003 | A PO cannot be sent from Draft status without at least one line item. |
| R-PO-004 | A PO cannot transition to Complete without an acknowledged status. |
| R-PO-005 | `renewal_id` is unique (one PO per renewal). |
| R-PO-006 | A rejected PO must record the rejection reason. |

---

### 3.14 POLineItem (Entity within PurchaseOrder Aggregate)

#### Attributes

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | |
| po_id | UUID | Yes | FK to PurchaseOrder |
| line_item_id | UUID | No | FK to source ContractLineItem (optional) |
| description | String(500) | Yes | |
| quantity | Integer | Yes | |
| unit_rate | Decimal(18,2) | Yes | |
| line_total | Decimal(18,2) | Yes | quantity × unit_rate |
| sort_order | Integer | Yes | |

---

### 3.15 Invoice (AR — Aggregate Root of Financial)

#### Purpose
Represents an invoice received from a vendor for a renewal. Manages PO-invoice matching, exception handling, and payment status.

#### Attributes

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| id | UUID | Yes | Auto-generated | |
| invoice_number | String(100) | Yes | — | Vendor's invoice number |
| vendor_id | UUID | Yes | — | FK to Vendor |
| po_id | UUID | Yes | — | FK to PurchaseOrder |
| renewal_id | UUID | No | Null | FK to Renewal (derived from PO) |
| status | InvoiceStatus | Yes | "received" | Received, Matched, Exception, Paid, Cancelled |
| invoice_amount | Money | Yes | — | Amount on the invoice |
| invoice_currency | CurrencyCode | Yes | "USD" | |
| po_matched_amount | Money | No | Null | Amount from PO that matches |
| variance_amount | Money | No | Null | Difference (invoice_amount - po_matched_amount) |
| variance_pct | Decimal(5,2) | No | Null | variance_amount / po_matched_amount × 100 |
| variance_reason | VarianceReason | No | Null | None, PriceDifference, QuantityDifference, Currency, Other |
| payment_status | PaymentStatus | Yes | "pending" | Pending, Scheduled, Paid |
| payment_due_date | Date | No | Null | |
| paid_date | Date | No | Null | |
| payment_reference | String(100) | No | Null | ERP or bank reference |
| invoice_date | Date | No | Null | Date on the invoice |
| received_date | Date | Yes | Today() | When Muraai received the invoice |
| document_url | String(500) | No | Null | Uploaded invoice document |
| erp_sync_status | ERPSyncStatus | Yes | "pending" | |
| erp_synced_at | DateTime | No | Null | |
| notes | Text | No | Null | |
| created_at | DateTime | Yes | Now() | |
| updated_at | DateTime | Yes | Now() | |

```typescript
InvoiceStatus = Enum {
  RECEIVED = "received",
  MATCHED = "matched",
  EXCEPTION = "exception",
  PAID = "paid",
  CANCELLED = "cancelled"
}

VarianceReason = Enum {
  NONE = "none",
  PRICE_DIFFERENCE = "price_difference",
  QUANTITY_DIFFERENCE = "quantity_difference",
  CURRENCY_MISMATCH = "currency_mismatch",
  DISCOUNT_MISMATCH = "discount_mismatch",
  TAX_MISMATCH = "tax_mismatch",
  OTHER = "other"
}

PaymentStatus = Enum {
  PENDING = "pending",
  SCHEDULED = "scheduled",
  PAID = "paid"
}
```

#### Lifecycle

```
Received ──► Matched (auto or manual) ──► Paid
  │               │
  ▼               ▼
Exception ◄── Received (mismatch detected)
Exception ──► Matched (resolved)
Received ──► Cancelled
```

#### Relationships

| Relationship | Entity | Type | Cardinality |
|---|---|---|---|
| Invoice → PurchaseOrder | PurchaseOrder | Reference | N:1 |
| Invoice → Vendor | Vendor | Reference | N:1 |
| Invoice → Renewal | Renewal | Reference | N:0..1 |

#### Business Rules

| ID | Rule |
|---|---|
| R-INV-001 | An invoice cannot be matched to multiple POs. |
| R-INV-002 | `po_matched_amount` cannot exceed the PO's `total_amount`. |
| R-INV-003 | An invoice with status = Exception requires a `variance_reason`. |
| R-INV-004 | An invoice cannot transition to Paid without a Matched status. |
| R-INV-005 | `variance_amount` is automatically computed as `invoice_amount - po_matched_amount`. |
| R-INV-006 | Auto-match if variance is within tolerance (±2% or $500, whichever is lower). |
| R-INV-007 | `invoice_number` + `vendor_id` must be unique (prevent duplicate invoice recording). |

---

### 3.16 User (AR — Aggregate Root of IdentityAccess)

#### Purpose
Represents a person who accesses the Muraai platform. Each User has a role that determines their permissions and interface.

#### Attributes

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| id | UUID | Yes | Auto-generated | |
| username | String(80) | Yes | — | Unique login name |
| email | String(200) | Yes | — | Unique email |
| password_hash | String(255) | Yes | — | BCrypt hash |
| role | UserRole | Yes | "viewer" | Defines base permissions |
| status | UserStatus | Yes | "active" | Active, Inactive, Suspended |
| department | String(100) | No | Null | |
| business_unit | String(100) | No | Null | |
| manager_id | UUID | No | Null | FK to User (manager for escalation) |
| notification_preferences | JSONB | No | — | Per-type notification preferences |
| last_login_at | DateTime | No | Null | |
| created_at | DateTime | Yes | Now() | |
| updated_at | DateTime | Yes | Now() | |
| deleted_at | DateTime | No | Null | Soft delete |

```typescript
UserRole = Enum {
  ADMIN = "admin",                       // S10 — Platform administrator
  RENEWALS_MANAGER = "renewals_manager", // S1 — Renewals Ops Manager
  PROCUREMENT = "procurement",           // S2 — Procurement Specialist
  FINANCIAL_ANALYST = "financial_analyst", // S3 — Financial Analyst
  LEGAL_COUNSEL = "legal_counsel",       // S4 — Legal Counsel
  BUSINESS_OWNER = "business_owner",     // S5 — Business Owner
  VENDOR_MANAGER = "vendor_manager",     // S6 — Vendor Relationship Manager
  EXECUTIVE = "executive",               // S7/S8 — CTO, CFO (read-only dashboard)
  AUDITOR = "auditor",                   // S9 — Internal Audit (read-only)
  VIEWER = "viewer"                      // Read-only base role
}

UserStatus = Enum {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended"
}
```

#### Business Rules

| ID | Rule |
|---|---|
| R-USR-001 | Email must be unique across all users. |
| R-USR-002 | Username must be unique across all users. |
| R-USR-003 | A user cannot be deleted if they have active responsibilities (assigned renewals, pending approvals). |
| R-USR-004 | Password must meet minimum complexity requirements (configurable via policy). |
| R-USR-005 | Role assignments are logged in the ActivityLog. |

---

### 3.17 ActivityLogEntry (AR — Immutable Aggregate of Compliance)

#### Purpose
Immutably record every state-changing operation in the platform. This is the audit trail.

#### Attributes

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | |
| tenant_id | UUID | Yes | For multi-tenant isolation |
| entity_type | String(50) | Yes | e.g., "renewal", "purchase_order", "invoice" |
| entity_id | UUID | Yes | |
| action | String(50) | Yes | e.g., "status_changed", "approved", "created" |
| previous_state | JSONB | No | Snapshot of entity before the change |
| new_state | JSONB | No | Snapshot of entity after the change |
| changed_fields | JSONB | No | { field_name: { from: value, to: value } } |
| performed_by | UUID | Yes | FK to User |
| performed_at | DateTime | Yes | |
| ip_address | String(45) | No | |
| user_agent | String(500) | No | |
| correlation_id | UUID | No | For linking related events across entities |

#### Business Rules

| ID | Rule |
|---|---|
| R-ACT-001 | ActivityLogEntry is insert-only. No UPDATE or DELETE operations are permitted. |
| R-ACT-002 | No user, including Admin, can modify or delete an ActivityLogEntry. |

---

### 3.18 Notification (AR — Aggregate Root of Notification)

#### Attributes

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| id | UUID | Yes | Auto-generated | |
| user_id | UUID | Yes | — | FK to User (recipient) |
| notification_type | String(50) | Yes | — | Map to domain event type |
| title | String(200) | Yes | — | |
| body | Text | No | Null | |
| entity_type | String(50) | No | Null | Related entity (for deep linking) |
| entity_id | UUID | No | Null | |
| priority | String(20) | Yes | "normal" | low, normal, high, critical |
| read | Boolean | Yes | False | |
| read_at | DateTime | No | Null | |
| email_sent | Boolean | Yes | False | |
| email_sent_at | DateTime | No | Null | |
| created_at | DateTime | Yes | Now() | |

---

### 3.19 PolicyRule (AR — Aggregate Root of PolicyEngine)

#### Purpose
Configurable business rules that govern approval chains, escalation paths, mandatory reviews, and validation constraints. Rules are evaluated in priority order — first match wins.

#### Attributes

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| id | UUID | Yes | Auto-generated | |
| rule_type | RuleType | Yes | — | approval_threshold, escalation, mandatory_review, validation |
| name | String(200) | Yes | — | Human-readable rule name |
| description | Text | No | Null | |
| entity_type | String(50) | Yes | — | Which entity this rule applies to |
| conditions | JSONB | Yes | — | Rule evaluation criteria (see below) |
| actions | JSONB | Yes | — | Actions to execute when conditions match |
| priority | Integer | Yes | 100 | Lower number = evaluated first |
| enabled | Boolean | Yes | True | |
| effective_from | Date | No | Null | |
| effective_to | Date | No | Null | |
| created_by | UUID | Yes | — | FK to User who created |
| updated_by | UUID | No | Null | |
| created_at | DateTime | Yes | Now() | |
| updated_at | DateTime | Yes | Now() | |

```typescript
RuleType = Enum {
  APPROVAL_THRESHOLD = "approval_threshold",  // Who must approve based on value
  ESCALATION = "escalation",                  // When to escalate and to whom
  MANDATORY_REVIEW = "mandatory_review",      // Which reviews are mandatory
  VALIDATION = "validation",                  // Additional validation rules
  NOTIFICATION = "notification"               // Who gets notified and how
}

// Example conditions (JSONB):
{
  "all": [
    { "field": "total_amount", "operator": "gte", "value": 100000 },
    { "field": "contract_type", "operator": "in", "value": ["maintenance", "support"] }
  ]
}

// Example actions (JSONB):
{
  "add_approval_step": {
    "approver_type": "cfo",
    "chain_order": 3
  }
}
```

#### Business Rules

| ID | Rule |
|---|---|
| R-POL-001 | Rules are evaluated in `priority` order. First match wins. |
| R-POL-002 | If no rule matches, the default behavior applies. |
| R-POL-003 | Rule changes are logged in the ActivityLog. |
| R-POL-004 | A rule cannot reference itself (circular reference prevention). |

---

## 4. Value Objects — Complete Catalog

| Value Object | Fields | Used By | Purpose |
|---|---|---|---|
| **Money** | amount: Decimal(18,2), currency: CurrencyCode | Renewal, PO, Invoice, Product, Contract | Unified monetary representation with currency |
| **CurrencyCode** | ISO 4217 string | All financial entities | "USD", "EUR", "GBP" |
| **DateRange** | start: Date, end: Date | Contract | Contract term boundaries |
| **SKU** | prefix: String, sequence: Integer, formatted: String | Product | Auto-generated unique identifier |
| **ProductSnapshot** | name, code, sku, category, rate, description | ContractLineItem | Immutable product copy at contract time |
| **Address** | line1, line2, city, state, postal_code, country | Vendor | Vendor billing address |
| **ApprovalStatus** | status, decided_by, decided_at, comments | Renewal, ApprovalRecord | Approval decision state |
| **Priority** | LOW(0), NORMAL(1), HIGH(2), CRITICAL(3) | Renewal | Triage priority |
| **RenewalStatus** | 12-state enum | Renewal | State machine position |
| **ContractType** | 6-value enum | Contract | Classification |
| **ContractStatus** | 4-value enum | Contract | Lifecycle position |
| **POStatus** | 6-value enum | PurchaseOrder | Lifecycle position |
| **InvoiceStatus** | 5-value enum | Invoice | Lifecycle position |
| **VendorTier** | 4-value enum | Vendor | Classification |
| **RiskRating** | 4-value enum | Vendor | Risk classification |
| **UserRole** | 9-value enum | User | Authorization |
| **UserStatus** | 3-value enum | User | Account state |
| **VarianceReason** | 7-value enum | Invoice | Why invoice differs from PO |
| **PaymentStatus** | 3-value enum | Invoice | Payment lifecycle |
| **BillingFrequency** | 4-value enum | Contract | Billing schedule |
| **ERPSyncStatus** | 3-value enum | PO, Invoice | Integration state |
| **EntityRef** | entity_type: String, entity_id: UUID, label: String | ActivityLog, Notification | Lightweight cross-entity reference |

---

## 5. Domain Events — Complete Specification

### 5.1 RenewalCreated

| Dimension | Detail |
|---|---|
| **Trigger** | Contract enters renewal window (end_date - renewal_window_days) OR manual creation by S1 |
| **Producer** | RenewalOperations (RenewalIdentificationService) |
| **Consumer(s)** | Notification (alert S1), ActivityLog |
| **Payload** | `{ renewal_id, contract_id, vendor_id, year, end_date, contract_name }` |
| **Business Impact** | Creates a new work item. If not consumed, the renewal would not be visible in any queue. |

### 5.2 RenewalAssigned

| Trigger | S1 assigns renewal to S2 |
|---|---|
| **Producer** | RenewalOperations |
| **Consumer(s)** | Notification (alert S2), ActivityLog |
| **Payload** | `{ renewal_id, assigned_to_user_id, assigned_by_user_id, contract_name, vendor_name }` |
| **Business Impact** | S2 receives a task. If not consumed, S2 would not know they have work. |

### 5.3 QuoteReceived

| Trigger | S2 uploads or enters vendor quote |
|---|---|
| **Producer** | RenewalOperations |
| **Consumer(s)** | Notification (alert S1), ActivityLog, (trigger budget check) |
| **Payload** | `{ renewal_id, amount, currency, quote_ref, vendor_name }` |
| **Business Impact** | Moves renewal forward. Begins automated budget validation. If not consumed, renewal stalls. |

### 5.4 BudgetApproved

| Trigger | Budget check completes successfully (auto or manual) |
|---|---|
| **Producer** | RenewalOperations (BudgetValidationService) |
| **Consumer(s)** | PolicyEngine (determine next step), ActivityLog |
| **Payload** | `{ renewal_id, approved_amount, budget_code, checked_by }` |
| **Business Impact** | Renewal can proceed to Legal or Business Owner. If not consumed, renewal stalls at budget stage. |

### 5.5 BudgetRejected

| Trigger | Budget check fails (insufficient funds, invalid code) |
|---|---|
| **Producer** | RenewalOperations (BudgetValidationService) |
| **Consumer(s)** | Notification (alert S2, S1), ActivityLog |
| **Payload** | `{ renewal_id, requested_amount, available_amount, reason }` |
| **Business Impact** | Triggers budget review workflow. May require renegotiation or escalation to S8. |

### 5.6 LegalApproved

| Trigger | Legal Counsel (S4) approves terms |
|---|---|
| **Producer** | RenewalOperations |
| **Consumer(s)** | Notification (trigger next approval step), ActivityLog |
| **Payload** | `{ renewal_id, approved_by, clause_decisions: [...], comments }` |
| **Business Impact** | Renewal proceeds to Business Owner. If not consumed, renewal stalls at legal. |

### 5.7 LegalRejected

| Trigger | Legal Counsel (S4) rejects or requests changes |
|---|---|
| **Producer** | RenewalOperations |
| **Consumer(s)** | Notification (alert S2, S1), ActivityLog |
| **Payload** | `{ renewal_id, rejected_by, reason, required_changes }` |
| **Business Impact** | Sends renewal back to S2 for vendor renegotiation. |

### 5.8 BusinessApproved

| Trigger | Business Owner (S5) approves |
|---|---|
| **Producer** | RenewalOperations |
| **Consumer(s)** | Procurement (create PO draft), Notification (alert S2), ActivityLog |
| **Payload** | `{ renewal_id, approved_by, approved_amount, usage_attestation_id }` |
| **Business Impact** | Critical milestone. Triggers PO creation. If not consumed, the approved renewal never converts to a PO. |

### 5.9 BusinessRejected

| Trigger | Business Owner (S5) rejects |
|---|---|
| **Producer** | RenewalOperations |
| **Consumer(s)** | Notification (alert S2, S1), ActivityLog |
| **Payload** | `{ renewal_id, rejected_by, reason }` |
| **Business Impact** | Renewal moves to CANCELLED. Stakeholders notified. |

### 5.10 RenewalCancelled

| Trigger | Renewal status moves to CANCELLED |
|---|---|
| **Producer** | RenewalOperations |
| **Consumer(s)** | Notification (alert all involved stakeholders), ActivityLog |
| **Payload** | `{ renewal_id, cancelled_by, reason, contract_id }` |
| **Business Impact** | Terminal state. All pending activities cancelled. Contract flagged for manual monitoring. |

### 5.11 RenewalOnHold

| Trigger | Renewal status moves to ON_HOLD |
|---|---|
| **Producer** | RenewalOperations |
| **Consumer(s)** | Notification (alert S1, relevant approvers), ActivityLog |
| **Payload** | `{ renewal_id, hold_reason, hold_until, held_by }` |
| **Business Impact** | Renewal paused. Scheduled reminder at hold_until date. |

### 5.12 RenewalEscalated

| Trigger | SLA breach or manual escalation by S1 |
|---|---|
| **Producer** | RenewalOperations (EscalationService) |
| **Consumer(s)** | Notification (alert escalated approver + S1), ActivityLog |
| **Payload** | `{ renewal_id, escalation_level, reason, escalated_by, current_approver }` |
| **Business Impact** | Higher authority notified. Decision expected within escalation SLA. |

### 5.13 UsageAttestationSubmitted

| Trigger | Business Owner submits usage attestation |
|---|---|
| **Producer** | RenewalOperations |
| **Consumer(s)** | ActivityLog, (triggers business approval if attestation was the only gate) |
| **Payload** | `{ renewal_id, attested_by, current_user_count, still_required }` |
| **Business Impact** | Removes a blocker on the renewal. If `still_required = false`, triggers cancellation workflow. |

### 5.14 ApprovalSLABreached

| Trigger | Approval deadline passed without decision |
|---|---|
| **Producer** | RenewalOperations (SLA monitoring job) |
| **Consumer(s)** | Notification (alert approver + manager), ActivityLog, EscalationService |
| **Payload** | `{ approval_record_id, renewal_id, approver_id, approver_type, sla_deadline, escalation_level }` |
| **Business Impact** | Approver receives escalation notification. If repeated, renewal escalated to CTO/CFO. |

### 5.15 POCreated

| Trigger | PO draft created from approved renewal |
|---|---|
| **Producer** | Procurement |
| **Consumer(s)** | Notification (alert S2), ActivityLog, RenewalOperations (update renewal.status) |
| **Payload** | `{ po_id, renewal_id, total_amount, vendor_id }` |
| **Business Impact** | PO ready for review and sending. Links renewal to procurement. |

### 5.16 POSent

| Trigger | PO sent to vendor (email or EDI) |
|---|---|
| **Producer** | Procurement |
| **Consumer(s)** | Notification (alert S2), ActivityLog |
| **Payload** | `{ po_id, sent_at, sent_method, vendor_email }` |
| **Business Impact** | Countdown to vendor acknowledgment begins. |

### 5.17 InvoiceReceived

| Trigger | Invoice recorded (upload, email parse, EDI) |
|---|---|
| **Producer** | Financial |
| **Consumer(s)** | Notification (alert S3), ActivityLog, InvoiceMatchingService (trigger auto-match) |
| **Payload** | `{ invoice_id, vendor_id, po_id, invoice_amount, invoice_number }` |
| **Business Impact** | Begins invoice matching process. If not consumed, invoice sits unmatched. |

### 5.18 InvoiceMatched

| Trigger | Invoice successfully matched to PO |
|---|---|
| **Producer** | Financial (InvoiceMatchingService) |
| **Consumer(s)** | Notification (alert S3), ActivityLog, RenewalOperations (update renewal.status), Forecasting |
| **Payload** | `{ invoice_id, po_id, renewal_id, matched_amount, variance_amount }` |
| **Business Impact** | Renewal moves toward COMPLETE. Financial forecasting updated. |

### 5.19 InvoiceExceptionCreated

| Trigger | Invoice matching detects variance outside tolerance |
|---|---|
| **Producer** | Financial (InvoiceMatchingService) |
| **Consumer(s)** | Notification (alert S3 + S2), ActivityLog |
| **Payload** | `{ invoice_id, po_id, invoice_amount, po_amount, variance_amount, variance_reason }` |
| **Business Impact** | Manual investigation required. Renewal cannot complete until resolved. |

### 5.20 ContractEndDateApproaching

| Trigger | System periodic job detects contracts entering renewal window |
|---|---|
| **Producer** | ContractManagement (RenewalIdentificationService) |
| **Consumer(s)** | RenewalOperations (create Renewal), ActivityLog |
| **Payload** | `{ contract_id, contract_name, end_date, days_until_end, vendor_id }` |
| **Business Impact** | Starts the renewal process. If not consumed, contracts may auto-renew without review. |

---

## 6. Commands — Complete Catalog

| Command | Description | Target Aggregate | Triggered By |
|---|---|---|---|
| **CreateRenewal** | Create a new Renewal for a Contract | Renewal | System (auto-detect) or S1 (manual) |
| **AssignRenewal** | Assign a Renewal to a Procurement Specialist | Renewal | S1 |
| **RecordQuoteReceived** | Record vendor quote details | Renewal | S2 |
| **SubmitForBudgetCheck** | Trigger budget validation | Renewal | S2 (auto or manual) |
| **ApproveBudget** | Approve budget (auto or manual override) | Renewal | System or S8 |
| **SubmitForLegalReview** | Send renewal to Legal for terms review | Renewal | System (auto, based on policy) |
| **ApproveLegal** | Approve terms at clause level | Renewal | S4 |
| **RejectLegal** | Reject terms with required changes | Renewal | S4 |
| **SubmitUsageAttestation** | Record usage attestation from Business Owner | Renewal | S5 |
| **ApproveBusiness** | Business Owner approves renewal | Renewal | S5 |
| **RejectBusiness** | Business Owner rejects renewal | Renewal | S5 |
| **CancelRenewal** | Cancel the renewal process | Renewal | S1, S5, S7 |
| **HoldRenewal** | Pause the renewal process | Renewal | S1, S5 |
| **ResumeRenewal** | Resume a held renewal | Renewal | S1 |
| **EscalateRenewal** | Escalate to higher authority | Renewal | S1 (manual) or System (SLA) |
| **CreatePurchaseOrder** | Generate PO draft from approved renewal | PurchaseOrder | System (auto, on approval) |
| **SendPO** | Send PO to vendor | PurchaseOrder | S2 |
| **AcknowledgePO** | Record vendor acknowledgment | PurchaseOrder | S2 |
| **RejectPO** | Record vendor rejection | PurchaseOrder | S2 |
| **CancelPO** | Cancel a PO | PurchaseOrder | S2 |
| **RecordInvoice** | Record invoice received from vendor | Invoice | S3 (manual) or System (auto-parse) |
| **MatchInvoice** | Match invoice to PO (auto or manual) | Invoice | System or S3 |
| **ResolveInvoiceException** | Resolve an invoice exception with action | Invoice | S3 |
| **SchedulePayment** | Schedule invoice for payment | Invoice | S3 |
| **RecordPayment** | Record payment completion | Invoice | S3 or ERP sync |
| **CreateContract** | Add a new contract to the repository | Contract | S1, S2, or CLM integration |
| **UpdateContractEndDate** | Update contract end date (after renewal confirmation) | Contract | System (on renewal completion) |

---

## 7. Domain Services — Complete Specification

### 7.1 RenewalIdentificationService

**Context:** ContractManagement → RenewalOperations  
**Purpose:** Periodically scan contracts approaching their end date and create Renewal entities.  
**Trigger:** Scheduled job (daily)  
**Algorithm:**
1. Query contracts where `end_date` is within `renewal_window_days` AND `end_date > today`
2. For each match, check if a Renewal already exists for (contract_id, year)
3. If no existing renewal, create Renewal with status = `pending_review`
4. Emit `RenewalCreated` domain event
5. If contract has `auto_renewal = true` AND is within `auto_renewal_notice_period`, flag as high priority

### 7.2 ApprovalRoutingService

**Context:** RenewalOperations + PolicyEngine  
**Purpose:** Determine the required approval chain for a renewal based on configurable policy rules.  
**Algorithm:**
1. Evaluate all `approval_threshold` PolicyRules in priority order
2. First matching rule determines the approval chain (sequence of ApprovalType + User role)
3. If no rule matches, use default chain: `[Business Owner]`
4. Create ApprovalRecord entities for each step in the chain
5. Each ApprovalRecord has a calculated `sla_deadline` based on config

### 7.3 BudgetValidationService

**Context:** Financial → RenewalOperations  
**Purpose:** Validate budget availability against a renewal's requested amount.  
**Integration:** Calls ERP via API for real-time budget check, or uses cached budget data.  
**Algorithm:**
1. Receive `{ budget_code, requested_amount }` from Renewal
2. If ERP integration active: call ERP budget API
3. If no integration: manual entry by S2 or S8
4. Return `{ approved: boolean, available_amount: number, reason: string }`
5. If approved, emit `BudgetApproved`
6. If rejected, emit `BudgetRejected`

### 7.4 InvoiceMatchingService

**Context:** Financial  
**Purpose:** Automatically match received invoices to POs and renewals.  
**Algorithm:**
1. Extract `{ vendor_id, po_reference, invoice_amount }` from invoice (via OCR, EDI, or manual entry)
2. Find PO by `vendor_id` + `po_reference` (or `po_id` if explicit)
3. If no PO found → flag as unmatched, require manual intervention
4. Calculate variance = `invoice_amount - po.total_amount`
5. Calculate variance_pct = `abs(variance) / po.total_amount * 100`
6. If `variance_pct <= tolerance` (default 2%) AND `abs(variance) <= max_tolerance_amount` (default $500):
   - Auto-match: set `po_matched_amount = invoice_amount`, status = `Matched`
   - Emit `InvoiceMatched`
7. Else:
   - Set status = `Exception`, compute variance fields
   - Emit `InvoiceExceptionCreated`

### 7.5 EscalationService

**Context:** RenewalOperations  
**Purpose:** Monitor approval SLAs and escalate when breached.  
**Trigger:** Scheduled job (hourly) or event-driven (on ApprovalSLABreached)  
**Algorithm:**
1. Query ApprovalRecords where `status = pending` AND `sla_deadline < now()` AND `escalation_count < 4`
2. For each breach:
   - Increment `escalation_count`
   - Determine escalation target based on level:
     - L1 (0→1): Approver's manager
     - L2 (1→2): Department director
     - L3 (2→3): CTO/CFO
     - L4 (3→4): CEO/Board (notification only)
   - Emit `RenewalEscalated`
   - Create Notification for escalation target
3. If `escalation_count >= 4`, flag renewal for executive attention

### 7.6 ForecastCalculationService

**Context:** Financial  
**Purpose:** Compute renewal cash outflow forecast for configurable time horizons.  
**Algorithm:**
1. Query Renewals with status in pipeline (not complete, not cancelled)
2. For each renewal:
   - If PO exists and amount known → use PO amount with configurable confidence (default 95%)
   - If budget approved but no PO → use approved amount with medium confidence (default 75%)
   - If quote received but not approved → use quote amount with low confidence (default 50%)
   - If only identified (pending review) → use prior year's actual with trend adjustment
3. Aggregate by month, quarter, year
4. Calculate: total pipeline value, weighted forecast, confidence intervals

### 7.7 VendorScorecardService

**Context:** VendorManagement  
**Purpose:** Compute vendor performance scores from historical data.  
**Frequency:** Monthly (auto) or on-demand  
**Dimensions:**
- Pricing Trend (weight: 25%): YoY price increase rate (lower = better)
- SLA Compliance (weight: 25%): Quote response time, PO acknowledgment time
- Support Quality (weight: 20%): Manual entry from relationship manager
- Responsiveness (weight: 15%): Average response time to inquiries
- Contract Flexibility (weight: 15%): Willingness to negotiate terms

### 7.8 SKUGenerationService

**Context:** ProductCatalog  
**Purpose:** Generate globally unique, sequential, human-readable SKUs for products.  
**Implementation:** See ADR-001 (10-decisions/index.md).  
**Output Format:** `SKU-{category_3chars}-MUR-{year}-{sequence_6digits}`

### 7.9 NotificationDispatchService

**Context:** Notification  
**Purpose:** Route domain events to stakeholders via their configured channels.  
**Algorithm:**
1. Receive domain event with payload
2. Determine affected stakeholders (based on event type + entity data)
3. For each stakeholder:
   - Check notification preferences (in-app, email, both, or digest)
   - Create Notification entity (in-app)
   - If email enabled: dispatch email via SMTP or API
   - If digest mode: queue for digest delivery

---

## 8. Aggregate Integrity Rules

| Aggregate Root | Invariant | Enforced By |
|---|---|---|
| **Renewal** | Status must follow allowed transitions. | Service layer + ENUM validation |
| **Renewal** | Only one pending approval per approval type. | Application validation |
| **Renewal** | Cannot have duplicate (contract_id, year). | Unique constraint |
| **Contract** | `end_date > start_date`. | Application validation + DB CHECK |
| **Contract** | `total_contract_value = sum(line_totals)`. | Application validation |
| **PurchaseOrder** | `total_amount <= renewal.approved_amount`. | Application validation |
| **PurchaseOrder** | `renewal_id` is unique. | Unique constraint |
| **Invoice** | `po_matched_amount <= po.total_amount`. | Application validation |
| **Invoice** | `invoice_number + vendor_id` is unique. | Unique constraint |
| **Product** | SKU is globally unique. | DB UNIQUE + application check |
| **ActivityLog** | No updates or deletes. | DB permissions + application layer |
| **User** | Unique email and username. | DB UNIQUE |
| **Vendor** | Unique vendor_code. | DB UNIQUE |

---

## 9. Future Domain Evolution

| Evolution | Description | Phase |
|---|---|---|
| **Multi-currency support** | Money value object gains fx_rate. Contracts can be in non-base currency with automatic conversion. | Phase 2 |
| **Contract amendments** | Amendment entity with effective date. Linked to parent Contract. Renewal can reference amendment version. | Phase 3 |
| **Contract hierarchy** | Master agreement with subordinate contracts. Renewal may apply to entire hierarchy. | Phase 3 |
| **Renewal bundles** | Single Renewal entity referencing multiple Contracts for portfolio-level renewal. | Phase 3 |
| **Automated renewals** | `auto_renew` flag on Renewal with configurable approval bypass for low-risk, low-value renewals. | Phase 4 |
| **ML-driven predictions** | ForecastCalculationService enhanced with ML models for renewal risk scoring and price prediction. | Phase 5 |
| **Real-time collaboration** | Multi-user editing of renewal entities with conflict resolution. | Phase 5 |
| **Integration marketplace** | Plugin architecture for custom domain services (custom approval logic, custom validators). | Phase 5 |
