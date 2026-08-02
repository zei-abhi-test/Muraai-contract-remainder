# Business Rules Catalog

## Document Control

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-07-20 | Enterprise Business Rules Architect | Initial complete catalog |

---

## 1. Rule Classification Framework

### 1.1 Classification Dimensions

Every rule is classified along three dimensions:

**Dimension 1: Mutability**
- **Mandatory (M)** — Invariant. Cannot be overridden. Hard-coded in service layer.
- **Configurable (C)** — Default value exists. Can be modified via PolicyEngine or Admin settings.

**Dimension 2: Enforcement Level**
- **Hard** — Enforced by database constraints (UNIQUE, FK, CHECK, NOT NULL). Cannot be bypassed.
- **Soft** — Enforced by application logic. Can be bypassed with escalated privileges (logged when bypassed).
- **Advisory** — Warns user but does not block. Used for recommendations and best practices.

**Dimension 3: Scope**
- **Global** — Applies to all tenants and all entities.
- **Entity** — Applies to a specific entity type (e.g., all Renewals).
- **Instance** — Applies to a specific instance based on its attributes (e.g., renewals above $100K).

### 1.2 Rule ID Format

```
{Category}-{Mutability}-{Sequence}
```

Categories:
- CTR = Contract
- RNW = Renewal
- PRD = Product
- VEN = Vendor
- CST = Customer
- PO  = Purchase Order
- INV = Invoice
- APR = Approval
- TSK = Task
- NTF = Notification
- DOC = Document
- GEN = General (cross-cutting)

Examples: `CTR-M-001`, `RNW-C-012`, `APR-M-004`

### 1.3 Rule Template

Each rule is defined with these fields:

| Field | Description |
|---|---|
| **ID** | Unique rule identifier |
| **Title** | Short, descriptive name |
| **Description** | What the rule enforces |
| **Priority** | Critical / High / Medium / Low |
| **Classification** | Mutability Category + Enforcement Level + Scope |
| **Validation** | When and how the rule is evaluated |
| **Exception** | Conditions under which the rule can be overridden (if any) |
| **Dependencies** | Other rules, entities, or external systems this rule depends on |
| **Business Reason** | Why this rule exists — the business problem it prevents |
| **System Behaviour** | What happens when the rule is triggered: pass, fail, warn, override |
| **Example** | A concrete scenario illustrating the rule |

---

## 2. Contract Rules

### 2.1 Mandatory Contract Rules

#### CTR-M-001: Contract End Date After Start Date

| Field | Value |
|---|---|
| **ID** | CTR-M-001 |
| **Title** | Contract end date must be after start date |
| **Description** | The `end_date` of a contract must be strictly after its `start_date`. Zero-day contracts are not permitted. |
| **Priority** | Critical |
| **Classification** | Mandatory + Hard (DB CHECK) + Global |
| **Validation** | Evaluated at contract creation and update. Checked by application layer before commit and enforced by DB CHECK constraint. |
| **Exception** | None. This is an invariant. |
| **Dependencies** | None |
| **Business Reason** | A contract with end_date <= start_date is logically impossible. Prevents data corruption that would break renewal identification, forecasting, and reporting. |
| **System Behaviour** | On violation: return HTTP 400 with error `"end_date must be after start_date"`. No record is created or updated. |
| **Example** | User enters start_date = 2026-01-01, end_date = 2025-12-31. System rejects with error. |

#### CTR-M-002: Contract Total Value Equals Sum of Line Items

| Field | Value |
|---|---|
| **ID** | CTR-M-002 |
| **Title** | Contract total value must equal sum of line item totals |
| **Description** | `total_contract_value` must equal the sum of all `ContractLineItem.line_total` values for the contract. |
| **Priority** | High |
| **Classification** | Mandatory + Soft (application validation) + Entity |
| **Validation** | Evaluated at contract creation and whenever line items are added, updated, or removed. |
| **Exception** | Manual override allowed with Business Owner approval (logged). Override flag `total_value_overridden = true` with `total_value_override_reason`. |
| **Dependencies** | CTR-M-006 (line total computation), ContractLineItem entities |
| **Business Reason** | Financial integrity. Prevents contracts with arbitrary total values that don't match the underlying products and quantities. |
| **System Behaviour** | On violation: if no override flag, return HTTP 400. If override flag present, proceed but log the override with reason and approving user. |
| **Example** | Contract has two line items: $10,000 + $15,000 = $25,000. User enters total_contract_value = $30,000. System rejects unless override is provided with justification. |

#### CTR-M-003: Notification Email Required When Enabled

| Field | Value |
|---|---|
| **ID** | CTR-M-003 |
| **Title** | Notification email must be provided when notifications are enabled |
| **Description** | If `notification_enabled = true`, the `notification_email` field must be a valid email address. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated when `notification_enabled` is set to `true` or when the contract is saved with `notification_enabled = true`. |
| **Exception** | None. If notifications are required, a delivery address must be provided. |
| **Dependencies** | NTF-M-001 (notification must have recipient) |
| **Business Reason** | Prevents silent failures where notifications are enabled but undeliverable. Avoids missed renewal alerts. |
| **System Behaviour** | On violation: return HTTP 400 with "notification_email is required when notifications are enabled." |
| **Example** | User toggles notification_enabled to true without entering an email. System blocks the save. |

#### CTR-M-004: Auto-Renewal Notice Period Required

| Field | Value |
|---|---|
| **ID** | CTR-M-004 |
| **Title** | Auto-renewal notice period must be specified when auto-renewal is enabled |
| **Description** | If `auto_renewal = true`, the `auto_renewal_notice_period` field must be a positive integer representing the days before end_date by which notice of non-renewal must be given. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated when `auto_renewal` is set to `true`. |
| **Exception** | None. |
| **Dependencies** | CTR-C-002 (default notice period, but this is the concrete value) |
| **Business Reason** | Auto-renewal contracts have legal notice deadlines. If no notice period is recorded, the system cannot warn users before the auto-renewal deadline passes. |
| **System Behaviour** | On violation: return HTTP 400 with "auto_renewal_notice_period is required when auto-renewal is enabled." |
| **Example** | User sets auto_renewal = true but leaves notice period blank. System rejects. |

#### CTR-M-005: Contract Deletion Restricted

| Field | Value |
|---|---|
| **ID** | CTR-M-005 |
| **Title** | Contract with active renewals cannot be hard-deleted |
| **Description** | A Contract cannot be permanently deleted if it has any Renewal records. Soft-deletion (status = 'terminated' or deleted_at set) is permitted instead. |
| **Priority** | Critical |
| **Classification** | Mandatory + Hard (application + FK constraint) + Entity |
| **Validation** | Evaluated on delete/terminate request. Query checks for existing Renewals linked to the Contract. |
| **Exception** | None. Hard deletion is prohibited. Soft deletion (termination) is the only option. |
| **Dependencies** | RNW entity existence check, CTR-M-009 (termination rules) |
| **Business Reason** | Renewal records reference contracts. Deleting the contract would orphan renewal records, breaking audit trail and financial reporting. |
| **System Behaviour** | On hard delete attempt: return HTTP 409 with "Contract cannot be deleted as it has associated renewal records. Use 'terminate' status instead." On terminate: set status = 'terminated', set deleted_at timestamp. |
| **Example** | User attempts to DELETE /contracts/123 where contract has 3 renewals. System returns 409. User uses PATCH to set status = 'terminated' instead. |

#### CTR-M-006: Line Total Computation

| Field | Value |
|---|---|
| **ID** | CTR-M-006 |
| **Title** | Line item total must equal quantity multiplied by unit rate |
| **Description** | `ContractLineItem.line_total` must equal `quantity × unit_rate`. Manual override is permitted with an explicit reason. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Entity |
| **Validation** | Evaluated on line item creation and update. Auto-computed by default. |
| **Exception** | Manual override allowed: `line_total_override = true` with `line_total_override_reason` field. Audit logged. |
| **Dependencies** | None |
| **Business Reason** | Financial integrity. Prevents arithmetic errors. Override exists for negotiated pricing where total doesn't equal simple multiplication (e.g., volume discount applied at line level). |
| **System Behaviour** | Default: auto-compute line_total and warn if user-entered value differs. If override: use user value, log the reason. |
| **Example** | Product rate = $100, quantity = 50. line_total auto-computes to $5,000. User overrides to $4,500 with reason "Volume discount of 10% applied at line level." |

#### CTR-M-007: Unique Contract Number Per Vendor

| Field | Value |
|---|---|
| **ID** | CTR-M-007 |
| **Title** | Contract number is unique within a vendor |
| **Description** | The combination of `vendor_id` + `contract_number` must be unique. A vendor cannot have two contracts with the same reference number. |
| **Priority** | High |
| **Classification** | Mandatory + Hard (unique constraint) + Instance |
| **Validation** | Evaluated on contract creation and when `contract_number` or `vendor_id` is updated. |
| **Exception** | None. |
| **Dependencies** | VEN entity existence check |
| **Business Reason** | Contract numbers are vendor-assigned references. Duplicate references within the same vendor indicate data entry errors or duplicate contracts. |
| **System Behaviour** | On violation: return HTTP 409 with "A contract with number {contract_number} already exists for vendor {vendor_name}." |
| **Example** | User creates a contract for Vendor "Oracle" with contract_number "LNX-1234". Another contract for Oracle with the same number is rejected. |

#### CTR-M-008: Contract Type Is Required

| Field | Value |
|---|---|
| **ID** | CTR-M-008 |
| **Title** | Contract type is mandatory |
| **Description** | Every contract must have a `contract_type` value from the defined enum (MAINTENANCE, SUPPORT, SUBSCRIPTION, SAAS, LICENSE, OTHER). |
| **Priority** | Medium |
| **Classification** | Mandatory + Hard (NOT NULL) + Entity |
| **Validation** | Evaluated on contract creation. |
| **Exception** | None. |
| **Dependencies** | None |
| **Business Reason** | Contract type drives downstream behavior: renewal workflow, legal review requirements, approval chains, and reporting classifications. |
| **System Behaviour** | On violation: return HTTP 400 with "contract_type is required." |
| **Example** | User attempts to create a contract without specifying type. System rejects. |

#### CTR-M-009: Contract Renewal Date Must Be On or Before End Date

| Field | Value |
|---|---|
| **ID** | CTR-M-009 |
| **Title** | Renewal date must precede or equal end date |
| **Description** | `renewal_date` (when renewal process must begin) must be on or before `end_date` (when current term ends). |
| **Priority** | Critical |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on contract creation and update of either field. |
| **Exception** | None. |
| **Dependencies** | RNW-M-001 (renewal state machine — renewal cannot begin after end_date) |
| **Business Reason** | If renewal_date is after end_date, the contract term would expire before the renewal process begins, creating a gap in coverage. |
| **System Behaviour** | On violation: return HTTP 400 with "renewal_date must be on or before end_date." |
| **Example** | Contract end_date = 2026-12-31, renewal_date = 2027-01-15. System rejects. User corrects to 2026-10-01 (90 days before end_date). |

### 2.2 Configurable Contract Rules

#### CTR-C-001: Renewal Window Duration

| Field | Value |
|---|---|
| **ID** | CTR-C-001 |
| **Title** | Renewal identification window duration |
| **Description** | The number of days before a contract's end_date at which the system automatically creates a Renewal entity. |
| **Priority** | Medium |
| **Classification** | Configurable + Soft + Global/Entity |
| **Validation** | Must be an integer between 30 and 365. Evaluated when the scheduled job runs. |
| **Exception** | Can be overridden at the contract level via `renewal_window_days` field. |
| **Dependencies** | RNW-M-001 (renewal lifecycle), RenewalIdentificationService |
| **Business Reason** | Different contract types and business units require different lead times for renewal processing. |
| **System Behaviour** | Default: 90 days. When a contract's end_date is within this window and no Renewal exists, the system creates one with status PENDING_REVIEW. |
| **Example** | Global default = 90 days. A contract with end_date = 2026-12-31 has a renewal created on 2026-10-02. An ERP maintenance contract overrides to 120 days. |

#### CTR-C-002: Auto-Renewal Notice Period Default

| Field | Value |
|---|---|
| **ID** | CTR-C-002 |
| **Title** | Default auto-renewal notice period |
| **Description** | The default value for `auto_renewal_notice_period` when a contract has `auto_renewal = true` but no explicit notice period is provided. |
| **Priority** | Medium |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Must be an integer between 30 and 180. |
| **Exception** | Overridden at the contract level by explicitly setting `auto_renewal_notice_period`. |
| **Dependencies** | CTR-M-004 |
| **Business Reason** | Provides a sensible default so users don't have to configure this for every auto-renewal contract. |
| **System Behaviour** | Default: 60 days. Applied when `auto_renewal = true` and `auto_renewal_notice_period` is null. |
| **Example** | Global default = 60 days. User sets auto_renewal = true without notice period. System applies 60 days. |

#### CTR-C-003: Contract Expiry Notification Lead Time

| Field | Value |
|---|---|
| **ID** | CTR-C-003 |
| **Title** | Contract expiry notification lead time |
| **Description** | How many days before a contract's end_date the system sends a blanket notification to the contract owner that the contract is approaching expiry. |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Must be an integer between 7 and 180. |
| **Exception** | Can be overridden per contract. |
| **Dependencies** | NTF rules, Contract entity |
| **Business Reason** | Provides a configurable safety net for contracts that might otherwise be missed by the renewal workflow. |
| **System Behaviour** | Default: 30 days. Sends notification to contract owner via their configured channel. |
| **Example** | Global default = 30 days. Contract end_date = 2026-12-31. Owner receives notification on 2026-12-01. |

#### CTR-C-004: Mandatory Contract Fields

| Field | Value |
|---|---|
| **ID** | CTR-C-004 |
| **Title** | Configurable mandatory contract fields |
| **Description** | Admin can designate additional fields as mandatory for contract creation beyond the system-mandatory fields (name, vendor, type, dates, value). |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Evaluated on contract creation. Configured via Admin interface. |
| **Exception** | Per-user role override (e.g., Admin can bypass, Auditor cannot). |
| **Dependencies** | User roles and permissions |
| **Business Reason** | Different enterprises require different data completeness. One company may require a purchase order reference; another may require a cost center code. |
| **System Behaviour** | Default: no additional fields. Admin can add fields to the mandatory set. On violation, return validation errors for each missing field. |
| **Example** | Admin adds `department` and `cost_center` as mandatory. User cannot create a contract without these fields. |

---

## 3. Renewal Rules

### 3.1 Mandatory Renewal Rules

#### RNW-M-001: Renewal State Machine Enforcement

| Field | Value |
|---|---|
| **ID** | RNW-M-001 |
| **Title** | Renewal status must follow allowed state transitions |
| **Description** | A Renewal's status can only change to a status that is reachable from its current status according to the defined state machine. See `docs/03-domain-model/index.md` §3.1 for the complete transition map. |
| **Priority** | Critical |
| **Classification** | Mandatory + Hard + Entity |
| **Validation** | Evaluated on every status transition request. Transition map is enforced in the service layer. |
| **Exception** | None. State machine is invariant. |
| **Dependencies** | All renewal workflow rules depend on this |
| **Business Reason** | The state machine is the backbone of the renewal workflow. Allowing arbitrary transitions would break process compliance, audit trail integrity, and downstream system dependencies. |
| **System Behaviour** | On invalid transition: return HTTP 409 with "Cannot transition from {current_status} to {requested_status}. Allowed transitions: {list}." |
| **Example** | Renewal is in PENDING_REVIEW. User attempts to transition directly to BUSINESS_APPROVAL. System rejects: must go through ASSIGNED → QUOTE_RECEIVED → BUDGET_CHECK → LEGAL_REVIEW (if required) → BUSINESS_APPROVAL. |

#### RNW-M-002: Unique Contract-Year Combination

| Field | Value |
|---|---|
| **ID** | RNW-M-002 |
| **Title** | Only one renewal per contract per year |
| **Description** | The combination of `contract_id` + `year` must be unique. A contract can have at most one renewal for a given year. |
| **Priority** | Critical |
| **Classification** | Mandatory + Hard (unique constraint) + Instance |
| **Validation** | Evaluated on renewal creation. Enforced by database UNIQUE constraint on (contract_id, year). |
| **Exception** | None. |
| **Dependencies** | CTR entity, RenewalIdentificationService |
| **Business Reason** | Duplicate renewals for the same contract and year would create confusion about which renewal is active, duplicate POs, and incorrect financial reporting. |
| **System Behaviour** | On violation: return HTTP 409 with "A renewal for contract {contract_id} in year {year} already exists." |
| **Example** | Contract ABC-123 has a 2026 renewal. User attempts to create another 2026 renewal for the same contract. System rejects. |

#### RNW-M-003: Cancellation Requires Reason

| Field | Value |
|---|---|
| **ID** | RNW-M-003 |
| **Title** | Renewal cancellation must include a reason |
| **Description** | When a Renewal transitions to CANCELLED status, the `cancellation_reason` field must be populated with a non-empty value. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on any transition to CANCELLED status. |
| **Exception** | None. |
| **Dependencies** | RNW-M-001 |
| **Business Reason** | Cancelling a renewal is a significant business decision. Without a recorded reason, the decision cannot be audited, and future analysis of cancellation patterns is impossible. |
| **System Behaviour** | On violation: return HTTP 400 with "cancellation_reason is required when cancelling a renewal." |
| **Example** | User attempts to cancel a renewal without providing a reason. System blocks. User enters "Vendor non-responsive after 3 quote requests. Contract flagged for replacement evaluation." Transition succeeds. |

#### RNW-M-004: Hold Requires Reason and Resolution Date

| Field | Value |
|---|---|
| **ID** | RNW-M-004 |
| **Title** | Hold must include reason and expected resolution date |
| **Description** | When a Renewal transitions to ON_HOLD status, both `hold_reason` and `hold_until` must be populated. `hold_until` must be a future date. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on any transition to ON_HOLD status. |
| **Exception** | None. |
| **Dependencies** | RNW-M-001 |
| **Business Reason** | A renewal placed on hold without reason or resolution date is effectively lost. The hold_until date enables automated follow-up. |
| **System Behaviour** | On violation: return HTTP 400 with "hold_reason and hold_until are required when putting a renewal on hold. hold_until must be a future date." At hold_until date, system sends notification to S1 reminding them to review the held renewal. |
| **Example** | User holds a renewal with reason "Awaiting vendor revised quote" and hold_until = 2026-08-15. On 2026-08-16, system notifies S1: "Renewal ABC held since 2026-07-15. Expected resolution date was 2026-08-15." |

#### RNW-M-005: Business Approval Required Before PO

| Field | Value |
|---|---|
| **ID** | RNW-M-005 |
| **Title** | Business approval is mandatory before PO creation |
| **Description** | A Renewal cannot transition to PO_CREATED status unless Business Owner approval (or CFO approval, if above threshold) has been recorded. |
| **Priority** | Critical |
| **Classification** | Mandatory + Soft + Entity |
| **Validation** | Evaluated when the system attempts to create a PO from a renewal. Checks that an ApprovalRecord with approver_type = BUSINESS_OWNER (or FINANCIAL) has status = APPROVED. |
| **Exception** | Not required for renewals below the auto-approval threshold (configurable via APR-C-005). |
| **Dependencies** | APR-M-001 through APR-M-005, APR-C-001, APR-C-005 |
| **Business Reason** | Preventing unauthorized spend. No PO should be issued without documented business approval, ensuring budget accountability. |
| **System Behaviour** | On violation: return HTTP 409 with "Renewal cannot proceed to PO creation without approved business approval." |
| **Example** | Renewal is in BUSINESS_APPROVAL status. Business Owner has not yet approved. System attempts to create PO. Blocked. |

#### RNW-M-006: Matched Invoice Required Before Completion

| Field | Value |
|---|---|
| **ID** | RNW-M-006 |
| **Title** | Invoice must be matched before renewal is complete |
| **Description** | A Renewal cannot transition to COMPLETE status unless a linked Invoice has status = MATCHED (or PAID). |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Entity |
| **Validation** | Evaluated on transition to COMPLETE status. Checks Invoice linked via `invoice_id`. |
| **Exception** | None. |
| **Dependencies** | INV-M-001 through INV-M-006, PO-M-001 through PO-M-004 |
| **Business Reason** | A renewal is not truly complete until the financial cycle is closed. Marking it complete without invoice matching creates gaps in financial reconciliation. |
| **System Behaviour** | On violation: return HTTP 409 with "Renewal cannot be marked complete without a matched invoice." |
| **Example** | Renewal has PO created and sent, but invoice has not yet been received. S1 attempts to mark it COMPLETE. System blocks. |

#### RNW-M-007: Assignee-Aoprover Segregation

| Field | Value |
|---|---|
| **ID** | RNW-M-007 |
| **Title** | Assignee cannot be an approver for the same renewal |
| **Description** | The user assigned as the Procurement Specialist (`assigned_to`) cannot also be recorded as an approver on any ApprovalRecord for the same Renewal. |
| **Priority** | Critical |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on two triggers: (1) when assigning a user who is already an approver, and (2) when creating an ApprovalRecord for a user who is already the assignee. |
| **Exception** | None. Segregation of duties violation. |
| **Dependencies** | APR rules |
| **Business Reason** | Fundamental segregation of duties. The person executing the procurement process (creating PO, collecting quotes) should not also be the person approving the spend. Prevents conflict of interest. |
| **System Behaviour** | On violation: return HTTP 400 with "User {name} is already assigned to this renewal and cannot also be an approver." |
| **Example** | S2 user "John" is assigned to a renewal. An approval step is created that requires John's approval. System rejects. John must be re-assigned or a different approver must be configured. |

#### RNW-M-008: Valid Quote Required Before Budget Check

| Field | Value |
|---|---|
| **ID** | RNW-M-008 |
| **Title** | Vendor quote must be received before budget check |
| **Description** | A Renewal cannot transition to BUDGET_CHECK unless a `vendor_quote_amount` has been recorded. The budget cannot be validated without knowing the requested amount. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Entity |
| **Validation** | Evaluated on transition to BUDGET_CHECK. |
| **Exception** | Can be bypassed with admin privilege for fixed-price renewals where quote is not expected. |
| **Dependencies** | None |
| **Business Reason** | Budget validation requires a concrete amount to check against. Proceeding without a quote would validate against zero or null, defeating the purpose. |
| **System Behaviour** | On violation: return HTTP 400 with "vendor_quote_amount must be recorded before budget check can proceed." |
| **Example** | Renewal is in ASSIGNED status. S2 attempts to submit for budget check without entering a quote. System blocks. |

#### RNW-M-009: Usage Attestation Validity Period

| Field | Value |
|---|---|
| **ID** | RNW-M-009 |
| **Title** | Usage attestation expires after 12 months |
| **Description** | A UsageAttestation record is valid for 12 months from `attested_at`. If the most recent attestation is expired, a new one is required before the renewal can proceed to BUSINESS_APPROVAL. |
| **Priority** | Medium |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated when renewal enters BUSINESS_APPROVAL stage. Checks the most recent UsageAttestation's `expires_at`. |
| **Exception** | None. |
| **Dependencies** | UsageAttestation entity, RNW-M-005 |
| **Business Reason** | Usage patterns change over time. An attestation from 18 months ago is stale — the department may have doubled, halved, or eliminated usage. Annual re-attestation ensures renewals reflect current needs. |
| **System Behaviour** | If no valid attestation exists: prompt Business Owner to complete attestation before proceeding. Set renewal status to a substate indicating attestation is pending. |
| **Example** | Renewal for Salesforce (500 seats) was attested 14 months ago. When it reaches BUSINESS_APPROVAL, system requires new attestation. Business Owner confirms they now use 450 seats. Renewal proceeds with reduced scope. |

#### RNW-M-010: Escalation Level Cap

| Field | Value |
|---|---|
| **ID** | RNW-M-010 |
| **Title** | Escalation level is capped at 4 |
| **Description** | The `escalation_level` field on a Renewal cannot exceed 4. After level 4 escalation, the renewal must be resolved by executive decision. Further escalation is routed to Board-level notification only. |
| **Priority** | Medium |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on each escalation attempt. |
| **Exception** | None. |
| **Dependencies** | APR-C-004 (escalation timing) |
| **Business Reason** | Prevents infinite escalation loops. After reaching the highest escalation level, a different resolution path must be taken (executive decision, cancellation, or manual intervention). |
| **System Behaviour** | At escalation_level = 4: system prevents further escalation, notifies CTO/CFO with "Final escalation level reached. Executive decision required." |
| **Example** | Renewal has been escalated 4 times (48h, 72h, 96h, 120h past SLA). S1 attempts to escalate again. System blocks and notifies CTO. |

### 3.2 Configurable Renewal Rules

#### RNW-C-001: Renewal Priority Assignment Rules

| Field | Value |
|---|---|
| **ID** | RNW-C-001 |
| **Title** | Automatic priority assignment based on contract attributes |
| **Description** | Rules that automatically set a Renewal's `priority` based on contract value, vendor risk rating, contract type, or days remaining until end_date. |
| **Priority** | Medium |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Configured via PolicyEngine. Conditions evaluated on renewal creation. |
| **Exception** | Priority can be manually overridden by S1. |
| **Dependencies** | None |
| **Business Reason** | Ensures high-risk, high-value, and urgent renewals are visually distinguished in queues without manual triage. |
| **System Behaviour** | Default: all renewals NORMAL. Example configuration: value > $250K → HIGH. Risk rating = CRITICAL → HIGH. Days remaining < 30 → CRITICAL. |
| **Example** | Contract value = $500K. On renewal creation, priority auto-sets to HIGH. S1 sees it at the top of the queue. |

#### RNW-C-002: Auto-Escalation Timing

| Field | Value |
|---|---|
| **ID** | RNW-C-002 |
| **Title** | SLA duration per approval stage |
| **Description** | The maximum time allowed for each approval stage before automatic escalation is triggered. |
| **Priority** | High |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Configured via PolicyEngine. Each ApprovalRecord's `sla_deadline` is calculated as `created_at + sla_duration`. |
| **Exception** | Can be overridden at the individual renewal level by S1. |
| **Dependencies** | APR-R-004, RNW-M-010 |
| **Business Reason** | Different approval types require different SLA durations. Legal review may need 48h; CFO approval may need 72h. Flexibility prevents unrealistic deadlines. |
| **System Behaviour** | Default: all approval types = 48 hours. Configurable per approval_type. On breach, triggers escalation workflow. |
| **Example** | Legal review SLA = 48h. Renewal enters legal review on Monday 9:00 AM. SLA deadline = Wednesday 9:00 AM. If no decision by Wednesday 9:01 AM, approval is escalated to General Counsel. |

#### RNW-C-003: Usage Attestation Frequency

| Field | Value |
|---|---|
| **ID** | RNW-C-003 |
| **Title** | Usage attestation frequency |
| **Description** | How often a Business Owner must re-attest to license usage. |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Configured via Admin. Must be between 3 and 36 months. |
| **Exception** | Can be disabled entirely for specific contract types (e.g., perpetual licenses with no usage tracking). |
| **Dependencies** | RNW-M-009, UsageAttestation entity |
| **Business Reason** | Some enterprises require more frequent attestation (quarterly) for cost optimization; others find annual sufficient. |
| **System Behaviour** | Default: 12 months. Controls the `expires_at` calculation on UsageAttestation. |
| **Example** | Enterprise with aggressive cost optimization sets attestation frequency to 6 months. Business Owners must re-attest every 6 months. |

#### RNW-C-004: Renewal Identification Schedule

| Field | Value |
|---|---|
| **ID** | RNW-C-004 |
| **Title** | Renewal identification job schedule |
| **Description** | How frequently the system scans contracts for upcoming renewals and creates Renewal entities. |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Must be a valid cron expression or interval. |
| **Exception** | None. |
| **Dependencies** | CTR-R-001 (renewal window), RenewalIdentificationService |
| **Business Reason** | Daily scanning catches new contracts entered late. Hourly scanning provides faster detection for time-sensitive renewals. |
| **System Behaviour** | Default: daily at 00:00 UTC. |
| **Example** | During month-end close, new contracts are backdated. Daily scan picks them up within 24 hours. |

---

## 4. Product Rules

### 4.1 Mandatory Product Rules

#### PRD-M-001: Globally Unique SKU

| Field | Value |
|---|---|
| **ID** | PRD-M-001 |
| **Title** | SKU must be globally unique |
| **Description** | Every Product must have a `sku` value that is unique across all products in the system, regardless of user or tenant. SKU is auto-generated by the system. |
| **Priority** | Critical |
| **Classification** | Mandatory + Hard (DB UNIQUE + application check) + Entity |
| **Validation** | Evaluated on product creation. Enforced at database level via UNIQUE constraint. Also checked at application level before SKU generation to prevent race conditions. |
| **Exception** | None. SKU uniqueness is invariant. |
| **Dependencies** | SKUGenerationService, SkuCounter entity |
| **Business Reason** | SKU is used as a canonical product identifier across contracts, POs, invoices, and integrations. Duplicate SKUs would cause incorrect line item references, reporting errors, and integration mismatches. |
| **System Behaviour** | Auto-generates SKU on creation. If generation produces a duplicate (race condition), retry with next sequence. Returns generated SKU in creation response. |
| **Example** | Product "Oracle Database Enterprise Edition" created → SKU = "SKU-DAT-MUR-2026-000042". Product "Oracle Database Standard Edition" created → SKU = "SKU-DAT-MUR-2026-000043". |

#### PRD-M-002: Rate Must Be Non-Negative

| Field | Value |
|---|---|
| **ID** | PRD-M-002 |
| **Title** | Product rate must be >= 0 |
| **Description** | The `rate` field on a Product must be zero or positive. Negative rates are not permitted. |
| **Priority** | High |
| **Classification** | Mandatory + Hard (DB CHECK) + Entity |
| **Validation** | Evaluated on product creation and update. |
| **Exception** | None. |
| **Dependencies** | None |
| **Business Reason** | A negative rate would produce negative line item totals, breaking contract total value calculations and financial reporting. |
| **System Behaviour** | On violation: return HTTP 400 with "rate must be a non-negative value." |
| **Example** | User enters rate = -100. System rejects. |

#### PRD-M-003: SKU Is Immutable After Creation

| Field | Value |
|---|---|
| **ID** | PRD-M-003 |
| **Title** | SKU cannot be modified after product creation |
| **Description** | Once a Product is created, its `sku` field cannot be changed. All update operations on the Product must exclude the SKU field. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on product update. The SKU field is explicitly excluded from the updateable fields set. |
| **Exception** | None. |
| **Dependencies** | PRD-M-001 |
| **Business Reason** | SKU is used as a stable reference across contracts, POs, and invoices. Changing it would break existing references and make historical audit trails inconsistent. |
| **System Behaviour** | On update request containing `sku`: silently ignore the field (no error, no update). Return the original SKU in the response. |
| **Example** | Product SKU = "SKU-DAT-MUR-2026-000042". User attempts PUT with sku = "NEW-SKU-123". System ignores the field and returns the original SKU. |

#### PRD-M-004: Deletion Restricted When Referenced

| Field | Value |
|---|---|
| **ID** | PRD-M-004 |
| **Title** | Referenced products cannot be hard-deleted |
| **Description** | A Product cannot be hard-deleted if it is referenced by any ContractLineItem. Soft-deactivation (status = INACTIVE) is used instead. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on delete request. Checks for any ContractLineItem referencing the Product's ID. |
| **Exception** | Hard deletion is never permitted for referenced products. |
| **Dependencies** | ContractLineItem entity, PRD-M-005 (reactivation) |
| **Business Reason** | Hard deletion would orphan ContractLineItem records, breaking contract integrity and historical audit trails. |
| **System Behaviour** | On hard delete attempt: return HTTP 409 with "Product is referenced by contract line items and cannot be deleted. Use status = INACTIVE to deactivate." On deactivation: set status = INACTIVE. Product is excluded from new contract creation dropdowns. |
| **Example** | Product "Oracle DB EE" is used in 15 contract line items. User attempts to delete it. System rejects with 409. User sets status = INACTIVE instead. Product disappears from new contract forms but existing contracts remain intact. |

#### PRD-M-005: Inactive Product Reactivation

| Field | Value |
|---|---|
| **ID** | PRD-M-005 |
| **Title** | Inactive products can be reactivated |
| **Description** | A Product with status = INACTIVE can be reactivated to ACTIVE at any time. No data loss occurs. |
| **Priority** | Low |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on status change from INACTIVE to ACTIVE. |
| **Exception** | None. |
| **Dependencies** | PRD-M-004 |
| **Business Reason** | Products may be temporarily unavailable (vendor EOL, replacement product pending). Reactivation allows them to re-enter the catalog without re-entering all data. |
| **System Behaviour** | On reactivation: set status = ACTIVE. Product reappears in contract creation dropdowns. |
| **Example** | Product "Oracle DB 12c" was deactivated when EOL was announced. Oracle extends support. Product is reactivated. |

### 4.2 Configurable Product Rules

#### PRD-C-001: Product Category Taxonomy

| Field | Value |
|---|---|
| **ID** | PRD-C-001 |
| **Title** | Product category list |
| **Description** | The list of valid values for the `category` field on a Product. |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Evaluated on product creation and update. Values must be from the configured list (or allow custom values if configured). |
| **Exception** | Admin can add, remove, or rename categories. |
| **Dependencies** | None |
| **Business Reason** | Consistent categorization enables portfolio analytics, reporting, and inventory management. |
| **System Behaviour** | Default: free-text entry. Admin can enable a fixed category list via Admin interface. |
| **Example** | Admin configures categories: ["ERP", "CRM", "Infrastructure", "Security", "Productivity", "Other"]. User must select from these values. |

#### PRD-C-002: Rate Decimal Precision

| Field | Value |
|---|---|
| **ID** | PRD-C-002 |
| **Title** | Product rate decimal precision |
| **Description** | The number of decimal places allowed for the `rate` field. |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Evaluated on product creation and update. |
| **Exception** | Can be changed globally (affects new products; existing values are truncated or rounded based on policy). |
| **Dependencies** | None |
| **Business Reason** | Different enterprises have different precision requirements. Infrastructure products may be priced to 6 decimal places; SaaS products to 2. |
| **System Behaviour** | Default: 2 decimal places. Configurable from 0 to 6. Values exceeding precision are rounded (configurable: round / truncate). |
| **Example** | Precision = 4. User enters rate = 0.12345. System rounds to 0.1235. |

---

## 5. Vendor Rules

### 5.1 Mandatory Vendor Rules

#### VEN-M-001: Unique Vendor Code

| Field | Value |
|---|---|
| **ID** | VEN-M-001 |
| **Title** | Vendor code must be unique |
| **Description** | The `vendor_code` field must be unique across all vendors. It serves as the internal identifier for the vendor. |
| **Priority** | High |
| **Classification** | Mandatory + Hard (DB UNIQUE) + Entity |
| **Validation** | Evaluated on vendor creation and update of `vendor_code`. |
| **Exception** | None. |
| **Dependencies** | None |
| **Business Reason** | Vendor codes are used in integrations, reports, and cross-references. Duplicate codes would cause data ambiguity and integration failures. |
| **System Behaviour** | On violation: return HTTP 409 with "Vendor code {code} is already in use." |
| **Example** | User creates vendor "Oracle" with code "ORCL". Another user attempts to create "Oracle Cloud" with the same code "ORCL". Rejected. |

#### VEN-M-002: At Least One Primary Contact

| Field | Value |
|---|---|
| **ID** | VEN-M-002 |
| **Title** | At least one primary vendor contact is required |
| **Description** | Every vendor must have at least one VendorContact with `is_primary = true`. The primary contact is used for automated renewal communications. |
| **Priority** | Medium |
| **Classification** | Mandatory + Soft + Entity |
| **Validation** | Evaluated on vendor creation (after contact creation) and when changing primary contact status. |
| **Exception** | None. |
| **Dependencies** | VendorContact entity |
| **Business Reason** | Without a primary contact, the system does not know where to send PO notifications, quote requests, or renewal correspondence. |
| **System Behaviour** | On violation: return HTTP 400 with "Vendor must have at least one primary contact." |
| **Example** | User creates vendor without adding any contacts. System allows creation but prompts: "Add at least one primary contact." If user tries to mark the only primary contact as non-primary, system blocks. |

#### VEN-M-003: Deletion Restricted With Active Contracts

| Field | Value |
|---|---|
| **ID** | VEN-M-003 |
| **Title** | Vendor with active contracts cannot be deleted |
| **Description** | A Vendor cannot be hard-deleted if it has any Contract with status = ACTIVE. Soft-delete (status change) is permitted. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on delete request. Queries for active contracts linked to the vendor. |
| **Exception** | Hard deletion permitted only if zero contracts exist (active or inactive). |
| **Dependencies** | Contract entity, CTR-M-005 |
| **Business Reason** | Deleting a vendor with active contracts would orphan those contracts, breaking the renewal workflow and financial reporting. |
| **System Behaviour** | On hard delete attempt with active contracts: return HTTP 409 with "Vendor has active contracts and cannot be deleted. Deactivate the vendor instead." |
| **Example** | Vendor "Acme Software" has 3 active contracts. User attempts to delete. System returns 409. User sets vendor to inactive status. |

#### VEN-M-004: Risk Rating Review

| Field | Value |
|---|---|
| **ID** | VEN-M-004 |
| **Title** | Vendor risk rating must be reviewed periodically |
| **Description** | The `risk_rating` field on a Vendor must be reviewed within the configured review period (default 12 months). If the review period expires, the vendor is flagged and a notification is sent to the Vendor Manager. |
| **Priority** | Medium |
| **Classification** | Mandatory + Advisory + Instance |
| **Validation** | Evaluated by scheduled job. Checks `updated_at` of the `risk_rating` field. |
| **Exception** | Review requirement can be waived for vendors with zero contracts (no active relationship). |
| **Dependencies** | VEN-C-001 (review period) |
| **Business Reason** | Vendor risk profiles change over time. A vendor that was low risk 18 months ago may now be high risk due to financial instability, security incidents, or support degradation. Regular review ensures risk data remains current. |
| **System Behaviour** | Default review period: 12 months. After expiry: set `risk_review_overdue = true`, notify Vendor Manager. On review: clear flag, update timestamp. |
| **Example** | Vendor "SmallVendor Inc" was rated LOW risk 14 months ago. System flags as review overdue. Vendor Manager reviews, notes they were acquired by a competitor, changes risk to MEDIUM. |

### 5.2 Configurable Vendor Rules

#### VEN-C-001: Risk Rating Review Frequency

| Field | Value |
|---|---|
| **ID** | VEN-C-001 |
| **Title** | Risk rating review frequency |
| **Description** | How often vendor risk ratings must be reviewed. |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Must be between 3 and 36 months. |
| **Exception** | Can be overridden per vendor tier (strategic vendors reviewed more frequently). |
| **Dependencies** | VEN-M-004 |
| **Business Reason** | High-risk industries or regulated environments may require more frequent vendor risk reviews. |
| **System Behaviour** | Default: 12 months. |
| **Example** | Financial services enterprise sets review period to 6 months for all vendors. Strategic vendors reviewed quarterly. |

#### VEN-C-002: Vendor Tier Classification Criteria

| Field | Value |
|---|---|
| **ID** | VEN-C-002 |
| **Title** | Automatic vendor tier classification |
| **Description** | Rules that automatically assign or suggest a vendor's tier based on total spend, contract count, or relationship duration. |
| **Priority** | Low |
| **Classification** | Configurable + Advisory + Global |
| **Validation** | Evaluated by scheduled job or on-demand. Generates recommendations only — tier is set manually. |
| **Exception** | Tier can always be manually overridden by Vendor Manager. |
| **Dependencies** | None |
| **Business Reason** | Helps Vendor Managers identify which vendors should receive strategic attention based on objective criteria. |
| **System Behaviour** | Default: no auto-classification. System can suggest tier changes: total_spend > $1M → STRATEGIC suggestion, >$250K → PREFERRED suggestion. |
| **Example** | Vendor's total spend crosses $1M due to new contract. System notifies Vendor Manager: "Total spend now $1.2M. Consider upgrading tier to STRATEGIC." |

---

## 6. Customer Rules

### 6.1 Mandatory Customer Rules

*Note: In Muraai's domain model, "Customer" refers to the internal business unit or external client that benefits from the contract. Customers are distinct from Vendors (who provide the software) and Users (who operate the platform).*

#### CST-M-001: Customer Name Is Required

| Field | Value |
|---|---|
| **ID** | CST-M-001 |
| **Title** | Customer name is mandatory |
| **Description** | Every customer record must have a non-empty `name` field. |
| **Priority** | High |
| **Classification** | Mandatory + Hard (NOT NULL) + Entity |
| **Validation** | Evaluated on customer creation. |
| **Exception** | None. |
| **Dependencies** | None |
| **Business Reason** | Without a name, the customer record is unidentifiable and cannot be linked to contracts. |
| **System Behaviour** | On violation: return HTTP 400 with "Customer name is required." |
| **Example** | User attempts to create customer with empty name. Rejected. |

#### CST-M-002: Customer Deletion Restricted With Active Contracts

| Field | Value |
|---|---|
| **ID** | CST-M-002 |
| **Title** | Customer with active contracts cannot be deleted |
| **Description** | A Customer cannot be hard-deleted if it has any Contracts referencing it. Soft-deletion via status change is permitted. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on delete request. |
| **Exception** | None. |
| **Dependencies** | Contract entity |
| **Business Reason** | Deleting a customer with active contracts would orphan those contracts. |
| **System Behaviour** | On violation: return HTTP 409 with "Customer has active contracts and cannot be deleted." |
| **Example** | Customer "Acme Corp" has 2 active contracts. User attempts to delete. System returns 409. |

#### CST-M-003: Unique Customer Per Business Unit

| Field | Value |
|---|---|
| **ID** | CST-M-003 |
| **Title** | Customer name must be unique within a business unit |
| **Description** | Duplicate customer names are not allowed within the same business unit. Cross-business-unit duplicates are permitted (different departments may have different customers with the same name). |
| **Priority** | Medium |
| **Classification** | Mandatory + Hard (unique constraint on name + business_unit) + Instance |
| **Validation** | Evaluated on customer creation and name update. |
| **Exception** | None. |
| **Dependencies** | None |
| **Business Reason** | Prevents confusion and data duplication within a business unit. |
| **System Behaviour** | On violation: return HTTP 409 with "Customer name {name} already exists in this business unit." |
| **Example** | Business unit "Engineering" has customer "Acme Corp". Engineering tries to create another "Acme Corp". Rejected. Business unit "Marketing" can create "Acme Corp" independently. |

### 6.2 Configurable Customer Rules

#### CST-C-001: Customer Classification Taxonomy

| Field | Value |
|---|---|
| **ID** | CST-C-001 |
| **Title** | Customer classification types |
| **Description** | Configurable list of customer classification values (e.g., Enterprise, SMB, Government, Internal). |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Evaluated on customer creation. |
| **Exception** | Admin can modify the classification list. |
| **Dependencies** | None |
| **Business Reason** | Different enterprises categorize customers differently for reporting and analysis. |
| **System Behaviour** | Default: no classification. Admin can enable and configure. |
| **Example** | Admin creates classifications: ["Enterprise", "SMB", "Government", "Education", "Non-Profit"]. |

#### CST-C-002: Customer Portal Access Policy

| Field | Value |
|---|---|
| **ID** | CST-C-002 |
| **Title** | Customer portal access configuration |
| **Description** | Rules governing whether customers have portal access to view their contract and renewal status. |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Instance |
| **Validation** | Evaluated on portal access enable/disable request. |
| **Exception** | Per-customer override. |
| **Dependencies** | User entity (portal user creation) |
| **Business Reason** | Some customers require self-service visibility into renewal status; others should not have direct access. |
| **System Behaviour** | Default: portal access disabled. Admin can enable per customer. When enabled, creates limited portal user with read-only access to that customer's contracts and renewals. |
| **Example** | Customer "Acme Corp" requests portal access. Admin enables. Acme receives login credentials. They can view their contracts and upcoming renewal dates but cannot modify anything. |

---

## 7. Purchase Order Rules

### 7.1 Mandatory Purchase Order Rules

#### PO-M-001: PO Amount Cannot Exceed Approved Renewal Amount

| Field | Value |
|---|---|
| **ID** | PO-M-001 |
| **Title** | PO total must not exceed approved renewal amount |
| **Description** | The `total_amount` on a PurchaseOrder must be less than or equal to the approved amount on the source Renewal (`budget_approved_amount` or `negotiated_amount`). |
| **Priority** | Critical |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on PO creation (from renewal) and on PO amount updates. |
| **Exception** | CFO-level override permitted. Override is logged and requires reason. |
| **Dependencies** | RNW entity, RNW-M-005 |
| **Business Reason** | Prevents procurement from exceeding the approved budget without re-escalation to financial authority. |
| **System Behaviour** | On violation: return HTTP 400 with "PO amount ${po_amount} exceeds approved renewal amount ${approved_amount}. Reduce amount or obtain CFO override." On CFO override: proceed, log override with CFO user ID and reason. |
| **Example** | Renewal approved at $50,000. S2 attempts to create PO for $52,000. System blocks. S2 enters $50,000 or obtains CFO override for the $2,000 difference. |

#### PO-M-002: PO Total Must Equal Sum of Line Items

| Field | Value |
|---|---|
| **ID** | PO-M-002 |
| **Title** | PO total must equal sum of line item totals |
| **Description** | The `total_amount` on a PurchaseOrder must equal the sum of its POLineItem.`line_total` values. |
| **Priority** | High |
| **Classification** | Mandatory + Hard (application computed) + Entity |
| **Validation** | Auto-computed by system. Cannot be manually set — derived from line items. |
| **Exception** | None. |
| **Dependencies** | POLineItem entity |
| **Business Reason** | Financial integrity. A PO total that doesn't match its line items would cause reconciliation failures and incorrect vendor payments. |
| **System Behaviour** | System auto-computes total_amount from line items. User adds/removes/modifies line items; total updates automatically. |
| **Example** | PO has 2 line items: $30,000 + $20,000. system auto-computes total = $50,000. User cannot manually overtype the total. |

#### PO-M-003: PO Requires Line Items Before Sending

| Field | Value |
|---|---|
| **ID** | PO-M-003 |
| **Title** | PO must have at least one line item before sending |
| **Description** | A PurchaseOrder cannot transition from DRAFT to SENT status unless it has at least one POLineItem. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on send request. |
| **Exception** | None. |
| **Dependencies** | POLineItem entity |
| **Business Reason** | Sending a PO with zero line items would be meaningless and confusing to the vendor. |
| **System Behaviour** | On violation: return HTTP 400 with "PO must have at least one line item before sending." |
| **Example** | User creates PO draft but hasn't added line items. Attempts to send. System blocks. |

#### PO-M-004: Completion Requires Vendor Acknowledgment

| Field | Value |
|---|---|
| **ID** | PO-M-004 |
| **Title** | PO must be acknowledged before marked complete |
| **Description** | A PurchaseOrder cannot transition to COMPLETE status without `acknowledged_at` being set (vendor acknowledgment recorded). |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on transition to COMPLETE. |
| **Exception** | Manual override by S1 with reason. Override logged. |
| **Dependencies** | None |
| **Business Reason** | A PO is not fully processed until the vendor confirms receipt and acceptance. Marking it complete without acknowledgment creates a gap in the procurement audit trail. |
| **System Behaviour** | On violation: return HTTP 400 with "PO must be acknowledged by vendor before it can be marked complete." On override: proceed, log reason and user. |
| **Example** | PO was sent 3 weeks ago. Vendor has not acknowledged. S2 attempts to mark complete. System blocks. S2 follows up with vendor, obtains verbal confirmation, records acknowledgment, then marks complete. |

#### PO-M-005: One PO Per Renewal

| Field | Value |
|---|---|
| **ID** | PO-M-005 |
| **Title** | A renewal can have at most one PO |
| **Description** | The `renewal_id` field on PurchaseOrder is unique. At most one PurchaseOrder can be created from a given Renewal. |
| **Priority** | Critical |
| **Classification** | Mandatory + Hard (DB UNIQUE) + Instance |
| **Validation** | Evaluated on PO creation. |
| **Exception** | None. If a PO must be reissued, the existing PO is cancelled and a new one is created (new PO, same renewal reference). |
| **Dependencies** | RNW entity |
| **Business Reason** | Multiple POs for the same renewal would cause duplicate payments and reconciliation confusion. |
| **System Behaviour** | On violation: return HTTP 409 with "A purchase order already exists for this renewal (PO #{po_number}). Cancel existing PO before creating a replacement." |
| **Example** | Renewal ABC has PO-001. User attempts to create PO-002 for the same renewal. System blocks. User cancels PO-001, creates PO-002 as replacement. |

#### PO-M-006: Rejection Reason Required

| Field | Value |
|---|---|
| **ID** | PO-M-006 |
| **Title** | PO rejection must include reason |
| **Description** | When a PurchaseOrder transitions to REJECTED status, the `rejection_reason` field must be populated. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on transition to REJECTED. |
| **Exception** | None. |
| **Dependencies** | None |
| **Business Reason** | Vendor rejection is an exception that requires investigation and resolution. Without a recorded reason, the procurement team cannot determine whether to amend, renegotiate, or escalate. |
| **System Behaviour** | On violation: return HTTP 400 with "rejection_reason is required when rejecting a PO." |
| **Example** | Vendor emails that PO-001 is rejected because the pricing is outdated. S2 records PO as REJECTED with reason "Vendor states pricing has changed. Requesting updated quote." |

### 7.2 Configurable Purchase Order Rules

#### PO-C-001: PO Number Format

| Field | Value |
|---|---|
| **ID** | PO-C-001 |
| **Title** | Purchase order number format |
| **Description** | The auto-generated PO number format. |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Must be a valid format string with supported variables ({year}, {sequence}, {prefix}). |
| **Exception** | None. |
| **Dependencies** | None |
| **Business Reason** | Different enterprises use different PO numbering conventions. Some use PO-{year}-{sequence}; others use {vendor_code}-{year}-{sequence}. |
| **System Behaviour** | Default: "PO-{sequence}" (e.g., PO-00001). Configurable via Admin. |
| **Example** | Enterprise renames to "{year}-PO-{sequence}" → "2026-PO-00042". |

#### PO-C-002: Acknowledgment Follow-Up

| Field | Value |
|---|---|
| **ID** | PO-C-002 |
| **Title** | PO acknowledgment follow-up delay |
| **Description** | How many days after a PO is sent the system waits before notifying S2 that vendor acknowledgment is overdue. |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Must be between 1 and 30 days. |
| **Exception** | Per-PO override. |
| **Dependencies** | NTF rules |
| **Business Reason** | Different vendors have different acknowledgment practices. Large vendors may take 7 days; smaller vendors may respond within 24 hours. |
| **System Behaviour** | Default: 7 days. After configured days without acknowledgment, send notification to S2 and S1. |
| **Example** | PO sent on July 1. Default follow-up = 7 days. On July 8, S2 receives notification: "PO-001 sent to Oracle on July 1. No acknowledgment received." |

---

## 8. Invoice Rules

### 8.1 Mandatory Invoice Rules

#### INV-M-001: Single PO Assignment

| Field | Value |
|---|---|
| **ID** | INV-M-001 |
| **Title** | Invoice can be matched to at most one PO |
| **Description** | An Invoice can reference at most one PurchaseOrder via `po_id`. Matching an invoice to a second PO requires creating a separate invoice record. |
| **Priority** | Critical |
| **Classification** | Mandatory + Hard (application constraint) + Entity |
| **Validation** | Evaluated on invoice creation and PO assignment. |
| **Exception** | None. |
| **Dependencies** | PO entity |
| **Business Reason** | An invoice that spans multiple POs should be split into multiple invoice records, one per PO. This enables accurate per-PO reconciliation. |
| **System Behaviour** | On violation: return HTTP 400 with "An invoice can be matched to at most one PO. Create separate invoice records for multiple POs." |
| **Example** | Vendor sends one invoice covering two POs. User must record two separate invoices in Muraai, each linked to its respective PO. |

#### INV-M-002: Matched Amount Cannot Exceed PO Amount

| Field | Value |
|---|---|
| **ID** | INV-M-002 |
| **Title** | Matched invoice amount cannot exceed PO total |
| **Description** | The `po_matched_amount` on an Invoice cannot exceed the `total_amount` of the linked PurchaseOrder. |
| **Priority** | Critical |
| **Classification** | Mandatory + Hard + Instance |
| **Validation** | Evaluated on invoice matching. |
| **Exception** | CFO override permitted. Override logged with reason. |
| **Dependencies** | PO entity |
| **Business Reason** | An invoice amount exceeding the PO indicates either a pricing error, unauthorized charges, or a PO that needs amendment. Paying above PO value without authorization breaks budgetary control. |
| **System Behaviour** | On violation with override: return HTTP 400 with "Invoice amount ${invoice_amount} exceeds PO total ${po_total}. Obtain CFO override or request PO amendment." On CFO override: proceed, log override. |
| **Example** | PO total = $50,000. Invoice amount = $52,000. System blocks matching. CFO reviews, approves override due to agreed price increase, logs reason. |

#### INV-M-003: Exception Requires Variance Reason

| Field | Value |
|---|---|
| **ID** | INV-M-003 |
| **Title** | Invoice exception must include variance reason |
| **Description** | When an Invoice is set to EXCEPTION status, the `variance_reason` field must be populated with a value from the enum. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on status transition to EXCEPTION. |
| **Exception** | None. |
| **Dependencies** | INV-M-006 (auto-match tolerances) |
| **Business Reason** | Without a classified reason for the variance, the resolution workflow cannot suggest appropriate actions, and trend analysis is impossible. |
| **System Behaviour** | On violation: return HTTP 400 with "variance_reason is required when setting invoice status to EXCEPTION." |
| **Example** | Invoice amount = $52,000, PO amount = $50,000. Variance = $2,000. User selects variance_reason = "PRICE_DIFFERENCE" with note "Vendor increased standard rate by 4% since PO was issued." |

#### INV-M-004: Payment Requires Matched Status

| Field | Value |
|---|---|
| **ID** | INV-M-004 |
| **Title** | Invoice must be matched before payment |
| **Description** | An Invoice cannot transition to PAID status unless its status is MATCHED (or the exception has been explicitly overridden for payment). |
| **Priority** | Critical |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on payment recording. |
| **Exception** | CFO override permitted for urgent payments where matching is in progress. Override logged. |
| **Dependencies** | INV-M-002, INV-M-003 |
| **Business Reason** | Paying an invoice before it is matched to a PO creates a gap in financial controls. The PO-invoice match is the control point that ensures payment accuracy. |
| **System Behaviour** | On violation: return HTTP 400 with "Invoice must be in MATCHED status before payment can be recorded." On CFO override: proceed, log override. |
| **Example** | Invoice is in RECEIVED status, matching is pending. S3 attempts to record payment. System blocks. S3 completes matching, then records payment. |

#### INV-M-005: Unique Invoice Per Vendor

| Field | Value |
|---|---|
| **ID** | INV-M-005 |
| **Title** | Invoice number must be unique per vendor |
| **Description** | The combination of `vendor_id` + `invoice_number` must be unique. Duplicate invoice recording is prevented. |
| **Priority** | High |
| **Classification** | Mandatory + Hard (DB UNIQUE) + Instance |
| **Validation** | Evaluated on invoice creation. |
| **Exception** | System administrator override for data correction (logged). |
| **Dependencies** | Vendor entity |
| **Business Reason** | Vendors assign unique invoice numbers. A duplicate invoice number from the same vendor means the invoice has already been recorded. Prevents double payment. |
| **System Behaviour** | On violation: return HTTP 409 with "Invoice {invoice_number} from vendor {vendor_name} has already been recorded (Invoice #{existing_id})." |
| **Example** | User attempts to record invoice "INV-2026-789" from Oracle. System already has this invoice number for Oracle. Rejected. User verifies it's a duplicate and discards. |

#### INV-M-006: Auto-Match Within Tolerance

| Field | Value |
|---|---|
| **ID** | INV-M-006 |
| **Title** | Automatic invoice matching within configurable tolerance |
| **Description** | When an invoice amount differs from the PO amount within the configured tolerance thresholds (percentage and absolute), the system automatically matches the invoice without human intervention. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Global |
| **Validation** | Evaluated on invoice matching attempt. |
| **Exception** | Manual override always available (S3 can force-match or force-exception regardless of tolerance). |
| **Dependencies** | INV-C-001, INV-C-002 (tolerance values) |
| **Business Reason** | Small variances (currency fluctuations, minor price changes) are common and do not warrant manual investigation. Auto-matching reduces manual effort while maintaining control. |
| **System Behaviour** | On receipt: if variance_pct <= configurable_pct AND abs(variance) <= configurable_amount: auto-match. Else: set status = EXCEPTION, alert S3. |
| **Example** | PO amount = $50,000. Invoice amount = $50,250. Variance = $250 (0.5%). Tolerance = 2% or $500. Auto-matches. S3 sees it in "Auto-Matched" queue for review. |

### 8.2 Configurable Invoice Rules

#### INV-C-001: Match Tolerance Percentage

| Field | Value |
|---|---|
| **ID** | INV-C-001 |
| **Title** | Invoice matching tolerance percentage |
| **Description** | The maximum percentage difference between invoice amount and PO amount that triggers automatic matching. Variances above this threshold require manual resolution. |
| **Priority** | Medium |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Must be between 0.0 and 100.0. |
| **Exception** | Can be overridden per vendor (for vendors with volatile pricing). |
| **Dependencies** | INV-M-006 |
| **Business Reason** | Different enterprises have different tolerance requirements. Some tolerate 1%; others tolerate 5% for specific vendors. |
| **System Behaviour** | Default: 2.0 (percent). |
| **Example** | Tolerance set to 1%. Invoice is 2.5% above PO. Does not auto-match. Requires manual exception handling. |

#### INV-C-002: Match Tolerance Absolute Amount

| Field | Value |
|---|---|
| **ID** | INV-C-002 |
| **Title** | Invoice matching tolerance absolute amount |
| **Description** | The maximum absolute dollar difference between invoice amount and PO amount that triggers automatic matching. Applied in addition to the percentage tolerance — whichever is more permissive. |
| **Priority** | Medium |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Must be >= 0. |
| **Exception** | Can be overridden per vendor. |
| **Dependencies** | INV-M-006, INV-C-001 |
| **Business Reason** | For large-value POs, a 1% variance may be $10,000. For small-value POs, a $5 variance exceeds 2%. Using both tolerances ensures appropriate handling across all values. |
| **System Behaviour** | Default: $500. An invoice passes auto-match if EITHER the percentage tolerance OR the absolute tolerance is satisfied. |
| **Example** | PO = $1,000. Invoice = $1,015. Variance = 1.5% ($15). Percentage tolerance = 2% (fails — 1.5% < 2%). Absolute tolerance = $500 (passes — $15 < $500). Auto-matches. |

#### INV-C-003: Payment Terms Tracking

| Field | Value |
|---|---|
| **ID** | INV-C-003 |
| **Title** | Payment terms enforcement |
| **Description** | Whether the system enforces matching vendor payment terms or allows flexible payment scheduling. |
| **Priority** | Low |
| **Classification** | Configurable + Advisory + Global |
| **Validation** | Evaluated when scheduling payment. |
| **Exception** | Per-invoice override. |
| **Dependencies** | Vendor payment_terms field |
| **Business Reason** | Some enterprises require strict adherence to negotiated payment terms; others prioritize vendor relationships over term compliance. |
| **System Behaviour** | Default: advisory mode (warns if payment is scheduled after due date but does not block). Can be set to "strict" (blocks scheduling after due date without override). |
| **Example** | Vendor terms: Net 30. Due date = Aug 15. S3 attempts to schedule payment for Aug 20. In advisory mode: warning shown, payment allowed. In strict mode: requires manager override. |

---

## 9. Approval Rules

### 9.1 Mandatory Approval Rules

#### APR-M-001: Self-Approval Prohibition

| Field | Value |
|---|---|
| **ID** | APR-M-001 |
| **Title** | No user can approve their own request |
| **Description** | The user who is assigned as the Procurement Specialist (`assigned_to`) on a Renewal cannot be recorded as the approver on any ApprovalRecord for the same Renewal. Additionally, the user who created the renewal cannot be the sole approver. |
| **Priority** | Critical |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on two triggers: (1) when assigning a user who is already an approver (or vice versa), (2) when recording an approval decision. |
| **Exception** | None. Segregation of duties is fundamental. |
| **Dependencies** | RNW-M-007 (overlaps but this is the approval-specific rule) |
| **Business Reason**** | No single individual should control both the execution and the authorization of a financial commitment. This is a core segregation of duties control. |
| **System Behaviour** | On violation: return HTTP 400 with "{user} is assigned to this renewal and cannot also approve it." |
| **Example** | S2 "John" is the assigned procurement specialist. The system-generated approval chain includes John as a required approver (config error). System rejects at chain creation time. |

#### APR-M-002: Rejection Requires Comments

| Field | Value |
|---|---|
| **ID** | APR-M-002 |
| **Title** | Rejection must include comments |
| **Description** | When an ApprovalRecord transitions to REJECTED status, the `comments` field must be populated with a non-empty value explaining the reason for rejection. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on rejection. |
| **Exception** | None. |
| **Dependencies** | None |
| **Business Reason** | A rejection without explanation provides no actionable information. The requesting party cannot correct the issue or understand the decision. |
| **System Behaviour** | On violation: return HTTP 400 with "Comments are required when rejecting an approval request." |
| **Example** | Legal Counsel rejects renewal terms. System prompts for comments. S4 enters "Liability cap reduced from $5M to $1M — below minimum acceptable threshold of $3M. Request vendor to restore." |

#### APR-M-003: Single Pending Approval Per Type

| Field | Value |
|---|---|
| **ID** | APR-M-003 |
| **Title** | Only one pending approval per type per renewal |
| **Description** | At any time, there can be at most one pending ApprovalRecord for a given `approver_type` on a given Renewal. This prevents duplicate approval requests for the same stage. |
| **Priority** | Medium |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated when creating a new ApprovalRecord. |
| **Exception** | None. If re-approval is needed after changes, the existing pending record is cancelled first. |
| **Dependencies** | RNW-M-001 (state machine) |
| **Business Reason** | Duplicate pending approvals for the same type would cause confusion (which one takes effect?) and race conditions. |
| **System Behaviour** | On violation: return HTTP 409 with "An approval request for {approver_type} is already pending for this renewal. Cancel the existing request before creating a new one." |
| **Example** | Legal Counsel has a pending approval. The system attempts to send another legal approval for the same renewal (due to a workflow re-evaluation). System blocks. Existing pending record is cancelled, new one created. |

#### APR-M-004: Sequential Chain Order Enforcement

| Field | Value |
|---|---|
| **ID** | APR-M-004 |
| **Title** | Approval chain must be processed in order |
| **Description** | When multiple approval steps exist in a chain, each step's `chain_order` determines sequence. Step N+1 cannot be decided (approved or rejected) until Step N has been decided. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated when an approval decision is recorded. Checks that all prior chain_order steps have been decided. |
| **Exception** | Escalation can skip chain order when higher authority intervenes. |
| **Dependencies** | APR-M-003 |
| **Business Reason** | Sequential approval chains ensure that decisions are made in the correct hierarchy. A Business Owner should not approve before Legal has reviewed the terms. |
| **System Behaviour** | On violation: return HTTP 400 with "Approval step {chain_order} ({approver_type}) cannot be decided before prior step {prior_chain_order} ({prior_type}) is completed." |
| **Example** | Approval chain: 1 = Legal, 2 = Business Owner. Business Owner attempts to approve before Legal has decided. System blocks. Legal must approve first. |

#### APR-M-005: Delegate Authority Must Not Exceed Original

| Field | Value |
|---|---|
| **ID** | APR-M-005 |
| **Title** | Delegated approver must have equal or higher authority |
| **Description** | When an approver delegates their approval responsibility to another user, the delegate must have a role with equal or higher authority than the original approver. A Business Owner's approval cannot be delegated to a Viewer. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated when setting `delegate_id` on an ApprovalRecord. |
| **Exception** | Admin override permitted (logged). |
| **Dependencies** | User role hierarchy |
| **Business Reason** | Delegation should not weaken the approval control. If a manager delegates to a subordinate, the approval authority level is maintained. |
| **System Behaviour** | On violation: return HTTP 400 with "{delegate_name} ({delegate_role}) does not have sufficient authority to replace {approver_name} ({approver_role})." |
| **Example** | CFO delegate action to a Financial Analyst. System checks role hierarchy: CFO > Financial Analyst. Rejected. CFO delegates to Deputy CFO instead. |

### 9.2 Configurable Approval Rules

#### APR-C-001: Approval Thresholds by Value

| Field | Value |
|---|---|
| **ID** | APR-C-001 |
| **Title** | Financial approval thresholds |
| **Description** | Rules that determine which approval chain is triggered based on the renewal's total value. Higher values require additional approval steps. |
| **Priority** | High |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Configured via PolicyEngine. Values must be positive and non-overlapping. |
| **Exception** | CTO/CFO can override threshold configuration. |
| **Dependencies** | PolicyEngine, ApprovalRoutingService |
| **Business Reason** | Enterprises need different approval chains for different spend levels. A $5,000 renewal should not require CFO approval; a $500,000 renewal should. |
| **System Behaviour** | Default: <$50K = Business Owner only. $50K-$250K = Legal + Business Owner. >$250K = Legal + Business Owner + CFO. Configurable via PolicyEngine rules. |
| **Example** | Renewal value = $300,000. System evaluates policy rules: matches ">$250K" rule. Creates approval chain: Legal → Business Owner → CFO. |

#### APR-C-002: Legal Review Threshold

| Field | Value |
|---|---|
| **ID** | APR-C-002 |
| **Title** | Mandatory legal review threshold |
| **Description** | Renewals above this value automatically trigger a Legal review step in the approval chain. Below this value, Legal review is not required unless terms have changed. |
| **Priority** | Medium |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Must be >= 0. Set to 0 to require legal review for all renewals. |
| **Exception** | Can be overridden by contract type (e.g., SaaS contracts always require legal review regardless of value). |
| **Dependencies** | APR-C-001, Contract entity |
| **Business Reason** | Low-value renewals may not justify the legal review overhead. High-value renewals always require legal protection. |
| **System Behaviour** | Default: $100,000. For renewals below threshold: legal review is optional (skipped unless terms have changed from prior year). For renewals above threshold: legal review is mandatory. |
| **Example** | Threshold = $100K. Renewal = $75K with same terms as prior year → no legal review. Renewal = $150K → legal review mandatory. |

#### APR-C-003: Approval SLA Duration

| Field | Value |
|---|---|
| **ID** | APR-C-003 |
| **Title** | Approval SLA per type |
| **Description** | The maximum allowed time for each approval type before escalation triggers. Configurable per approval type. |
| **Priority** | Medium |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Must be between 1 and 720 hours. |
| **Exception** | Per-renewal SLA override by S1. |
| **Dependencies** | EscalationService, NTF rules |
| **Business Reason** | Different approval types need different response times. Legal may need 48 hours; Business Owner may need 24 hours. |
| **System Behaviour** | Default: 48 hours for all types. Configurable in hours. On creation, ApprovalRecord.sla_deadline = now + configured_duration. |
| **Example** | Legal SLA = 48h, Business SLA = 24h. Renewal enters legal review Monday 9AM → SLA deadline Wednesday 9AM. After legal approves, enters Business Owner queue → SLA deadline Thursday 9AM. |

#### APR-C-004: Escalation Timing

| Field | Value |
|---|---|
| **ID** | APR-C-004 |
| **Title** | Escalation interval per level |
| **Description** | The time between escalation levels. After an SLA breach at level 1, how long before escalation to level 2? |
| **Priority** | Medium |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Must be between 1 and 720 hours. |
| **Exception** | Per-renewal override. |
| **Dependencies** | RNW-M-010 (cap), RNW-C-002 |
| **Business Reason** | Different urgency levels require different escalation speeds. A high-priority renewal may escalate every 24 hours; a normal-priority may escalate every 48 hours. |
| **System Behaviour** | Default: 24 hours between levels. Level 1: approver's manager. Level 2: department director. Level 3: CTO/CFO. Level 4: Board notification. |
| **Example** | SLA breached on Wednesday 9AM. Level 1 escalation Thursday 9AM (24h). Level 2 escalation Friday 9AM (24h). Level 3 escalation Saturday 9AM (24h). Level 4 escalation Sunday 9AM. |

#### APR-C-005: Approval Bypass for Low-Risk Renewals

| Field | Value |
|---|---|
| **ID** | APR-C-005 |
| **Title** | Auto-approval for low-risk renewals |
| **Description** | Renewals below a configurable value threshold with no terms changes and positive prior history can be auto-approved without human intervention. |
| **Priority** | Medium |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Evaluated when renewal reaches approval stage. Must meet ALL conditions: value < threshold, no terms changes, prior year same vendor same product, no prior exceptions. |
| **Exception** | Can be disabled entirely (require human approval for all renewals). |
| **Dependencies** | APR-C-002, RNW-M-005, NTF rules |
| **Business Reason** | Low-value, no-change renewals consume disproportionate approval overhead. Auto-approval reduces cycle time while maintaining audit trail. |
| **System Behaviour** | Default: disabled (all renewals require human approval). When enabled with threshold = $10K, renewals below $10K with no changes are auto-approved. An ActivityLog entry is created recording the auto-approval and the policy rule that triggered it. |
| **Example** | Threshold = $10K. Renewal for $8,500, same terms as prior year, same vendor/product. Auto-approved. S5 receives notification: "Renewal ABC was auto-approved per low-risk policy. Review in dashboard." |

---

## 10. Task Rules

### 10.1 Mandatory Task Rules

#### TSK-M-001: Task Requires Assignee

| Field | Value |
|---|---|
| **ID** | TSK-M-001 |
| **Title** | Task must have an assignee |
| **Description** | A Task (manual work item) cannot be created without a designated assignee. The `assigned_to` field is mandatory. |
| **Priority** | High |
| **Classification** | Mandatory + Hard (NOT NULL) + Entity |
| **Validation** | Evaluated on task creation. |
| **Exception** | System-created tasks may be unassigned (assigned_to = null) until an assignment rule resolves the assignee. |
| **Dependencies** | User entity |
| **Business Reason** | A task without an assignee will never be completed. It is effectively lost. |
| **System Behaviour** | On violation: return HTTP 400 with "Task must have an assignee." For system tasks: creation allowed without assignee, but task is flagged as unassigned and visible in "Unassigned Tasks" queue for S1. |
| **Example** | User creates a manual task "Follow up with Oracle on revised quote" without assigning it. System blocks. User assigns to S2 "John". Task created. |

#### TSK-M-002: Task Requires Due Date

| Field | Value |
|---|---|
| **ID** | TSK-M-002 |
| **Title** | Task must have a due date |
| **Description** | A Task cannot be created without a `due_date`. |
| **Priority** | High |
| **Classification** | Mandatory + Hard (NOT NULL) + Entity |
| **Validation** | Evaluated on task creation. |
| **Exception** | System-generated tasks inherit the due date from the source renewal's SLA timeline. |
| **Dependencies** | None |
| **Business Reason** | A task without a due date has no urgency and will be deprioritized indefinitely. |
| **System Behaviour** | On violation: return HTTP 400 with "Task must have a due date." |
| **Example** | User creates task without due date. System rejects. User sets due_date = 2026-08-01. Task created. |

#### TSK-M-003: Completed Tasks Are Immutable

| Field | Value |
|---|---|
| **ID** | TSK-M-003 |
| **Title** | Completed tasks cannot be modified |
| **Description** | Once a Task's status is set to COMPLETED, its core fields (title, description, assignee, due_date) cannot be modified. Only comments and status (to re-open) can be changed. |
| **Priority** | Medium |
| **Classification** | Mandatory + Soft + Instance |
| **Validation** | Evaluated on task update. |
| **Exception** | Admin override permitted for data correction (logged). |
| **Dependencies** | None |
| **Business Reason** | Completed tasks serve as an audit record of work performed. Allowing edits would undermine the reliability of task completion data. |
| **System Behaviour** | On violation: return HTTP 400 with "Completed tasks cannot be modified. Re-open the task to make changes." |
| **Example** | Task "Get quote from Oracle" is completed. User tries to change the due date. System rejects. User re-opens the task, makes changes, re-completes it. |

### 10.2 Configurable Task Rules

#### TSK-C-001: Task Priority Defaults

| Field | Value |
|---|---|
| **ID** | TSK-C-001 |
| **Title** | Default task priority |
| **Description** | The default priority assigned to new tasks when not explicitly specified. |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Must be a valid Priority value. |
| **Exception** | Per-task override. |
| **Dependencies** | None |
| **Business Reason** | Different teams may prefer different default priorities based on their workload and urgency culture. |
| **System Behaviour** | Default: NORMAL. |
| **Example** | High-velocity team sets default to HIGH. All new tasks start at HIGH priority. |

#### TSK-C-002: Task Reminder Timing

| Field | Value |
|---|---|
| **ID** | TSK-C-002 |
| **Title** | Task reminder timing |
| **Description** | How many days before a task's due date the system sends a reminder notification to the assignee. |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Must be between 0 and 30 days. |
| **Exception** | Per-task override. |
| **Dependencies** | NTF rules |
| **Business Reason** | Different tasks need different reminder lead times. A 1-day reminder is sufficient for a simple quote follow-up; a 7-day reminder may be needed for a complex legal review. |
| **System Behaviour** | Default: 2 days before due date. Sends in-app notification. |
| **Example** | Task due in 5 days. Reminder configured at 2 days. On day 3 (2 days before due), assignee receives notification. |

---

## 11. Notification Rules

### 11.1 Mandatory Notification Rules

#### NTF-M-001: SLA Breach Notifications Cannot Be Suppressed

| Field | Value |
|---|---|
| **ID** | NTF-M-001 |
| **Title** | SLA breach notifications are mandatory |
| **Description** | SLA breach notifications are always sent regardless of the recipient's notification preferences. They bypass digest mode, quiet hours, and opt-out settings. |
| **Priority** | Critical |
| **Classification** | Mandatory + Hard + Global |
| **Validation** | Evaluated at notification dispatch time. Notification preference settings are checked but overridden for SLA breach type. |
| **Exception** | None. |
| **Dependencies** | APR-M-004, RNW-M-010 |
| **Business Reason** | SLA breaches represent process failures that require immediate attention. Suppressing them would allow renewals to stall indefinitely without anyone being held accountable. |
| **System Behaviour** | SLA breach notifications are sent via all configured channels (in-app + email + SMS if configured) immediately upon detection. Recipient cannot disable this notification type. |
| **Example** | Approver Jane has notifications set to "digest only" (weekly summary). An approval SLA is breached. Jane receives the breach notification immediately via in-app + email, bypassing her digest preference. |

#### NTF-M-002: Notification Must Have Recipient

| Field | Value |
|---|---|
| **ID** | NTF-M-002 |
| **Title** | Notification must have a valid recipient |
| **Description** | Every notification must be addressed to an existing, active User. Notifications to deleted, inactive, or non-existent users are silently dropped and logged. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Global |
| **Validation** | Evaluated at notification creation time. |
| **Exception** | None. |
| **Dependencies** | User entity |
| **Business Reason** | Sending notifications to invalid recipients is wasteful and creates security concerns (sensitive information sent to wrong person). |
| **System Behaviour** | On invalid recipient: notification is not created. An error is logged. No notification is sent. |
| **Example** | Approval is assigned to User "John" who was deactivated yesterday. System detects inactive user, logs "Notification not sent: user John is inactive", assigns approval to the backup approver or S1 for reassignment. |

#### NTF-M-003: Critical Notifications Cannot Be Suppressed

| Field | Value |
|---|---|
| **ID** | NTF-M-003 |
| **Title** | Critical priority notifications are mandatory |
| **Description** | Notifications with priority = CRITICAL are always sent immediately, bypassing all user preferences, digest modes, and quiet hours. |
| **Priority** | Critical |
| **Classification** | Mandatory + Hard + Global |
| **Validation** | Evaluated at notification dispatch. |
| **Exception** | None. |
| **Dependencies** | NTF-M-001 (SLA breach is a subset of critical) |
| **Business Reason** | Critical notifications (license expiry risk, unauthorized payment attempt, data integrity alert) require immediate human attention. |
| **System Behaviour** | Sent via all available channels. Cannot be disabled. System logs delivery confirmation. |
| **Example** | A vendor reports that a license will expire in 3 days without immediate PO. System generates CRITICAL notification. Sent to S1, S2, S7 simultaneously via in-app + email + SMS. |

### 11.2 Configurable Notification Rules

#### NTF-C-001: Notification Channel Preferences

| Field | Value |
|---|---|
| **ID** | NTF-C-001 |
| **Title** | Per-user notification channel preferences |
| **Description** | Each user can configure which channels they receive notifications on, per notification type. |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Instance |
| **Validation** | Evaluated at notification dispatch. |
| **Exception** | Overridden for CRITICAL and SLA breach types. |
| **Dependencies** | User entity notification_preferences |
| **Business Reason** | Different users have different communication preferences. An approver who checks email constantly may prefer email; a procurement specialist who lives in the platform may prefer in-app only. |
| **System Behaviour** | Default: in-app + email for all types. Configurable: in-app only, email only, both, or digest. |
| **Example** | User sets "renewal_assigned" to "email only" and "approval_required" to "in-app + email". They receive assignment notifications by email and approval notifications in both channels. |

#### NTF-C-002: Digest Frequency

| Field | Value |
|---|---|
| **ID** | NTF-C-002 |
| **Title** | Notification digest frequency |
| **Description** | How often users who have selected "digest" mode receive a summary of their non-urgent notifications. |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Must be daily or weekly. Digest day configurable. |
| **Exception** | Individual users can override their own digest frequency. |
| **Dependencies** | NTF-C-001 |
| **Business Reason** | High-volume users may prefer a single daily or weekly summary rather than real-time notifications for every low-priority event. |
| **System Behaviour** | Default: daily at 08:00 local time. Digest groups all non-critical, non-urgent notifications into a single email with a summary count and links. |
| **Example** | S7 (CTO) sets notifications to weekly digest. Each Monday, they receive one email: "Your weekly Muraai digest: 15 renewals approved, 3 pending your approval, 2 SLA breaches (sent separately)." |

#### NTF-C-003: Reminder Frequency for Pending Approvals

| Field | Value |
|---|---|
| **ID** | NTF-C-003 |
| **Title** | Pending approval reminder frequency |
| **Description** | How often the system sends reminder notifications for pending (non-breached) approvals before the SLA deadline. |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Must be between 1 and 168 hours. |
| **Exception** | Overridden for users with "do not disturb" settings. |
| **Dependencies** | ApprovalRecord entity |
| **Business Reason** | Gentle reminders prevent SLA breaches by prompting approvers before the deadline. |
| **System Behaviour** | Default: first reminder at 50% of SLA duration, second reminder at 75%. Configurable to fixed intervals (e.g., every 24 hours). |
| **Example** | SLA = 48 hours. Reminder at 50% (24h) sends first reminder. Reminder at 75% (36h) sends second reminder. At 48h, SLA breach notification fires. |

---

## 12. Document Rules

### 12.1 Mandatory Document Rules

#### DOC-M-001: Document Must Have Valid Entity Reference

| Field | Value |
|---|---|
| **ID** | DOC-M-001 |
| **Title** | Document must reference a valid parent entity |
| **Description** | Every document must be linked to a valid, existing parent entity (Contract, Renewal, PO, Invoice). The `entity_type` and `entity_id` combination must correspond to an existing record. |
| **Priority** | High |
| **Classification** | Mandatory + Soft + Entity |
| **Validation** | Evaluated on document upload. Queries the referenced entity. |
| **Exception** | Orphan documents can be uploaded to a "general" bucket without an entity reference (e.g., reference documents). |
| **Dependencies** | Contract, Renewal, PO, Invoice entities |
| **Business Reason** | Documents without a parent entity are effectively lost — users cannot find them through normal navigation. |
| **System Behaviour** | On violation: return HTTP 400 with "Referenced entity {type} {id} not found." For general uploads: allow without entity reference, store in "Unfiled" section. |
| **Example** | User uploads a contract PDF and references entity_type = "contract", entity_id = UUID that doesn't exist. System rejects. |

#### DOC-M-002: File Type Validation

| Field | Value |
|---|---|
| **ID** | DOC-M-002 |
| **Title** | Document file type must be allowed |
| **Description** | Uploaded documents must have a MIME type that is in the allowed list. |
| **Priority** | Medium |
| **Classification** | Mandatory + Soft + Global |
| **Validation** | Evaluated on upload. Checks MIME type against allowed list. |
| **Exception** | Admin can extend the allowed list. |
| **Dependencies** | DOC-C-001 (allowed types configuration) |
| **Business Reason** | Prevents upload of malicious files (executables, scripts) and ensures documents are viewable within the platform. |
| **System Behaviour** | On violation: return HTTP 400 with "File type {mime_type} is not allowed. Allowed types: {list}." |
| **Example** | User uploads a .exe file named "quote.exe". System rejects with "File type application/x-msdownload is not allowed." |

#### DOC-M-003: File Size Limit

| Field | Value |
|---|---|
| **ID** | DOC-M-003 |
| **Title** | Document file size must be within limit |
| **Description** | Uploaded documents must be below the maximum file size threshold. |
| **Priority** | Medium |
| **Classification** | Mandatory + Soft + Global |
| **Validation** | Evaluated on upload. Checks Content-Length header. |
| **Exception** | Admin can increase the limit (with performance consideration). |
| **Dependencies** | DOC-C-002 (size limit configuration) |
| **Business Reason** | Prevents storage exhaustion and upload timeout issues. |
| **System Behaviour** | On violation: return HTTP 413 with "File size exceeds maximum allowed size of {limit}." |
| **Example** | User uploads a 50MB contract PDF. Limit = 25MB. System rejects with 413. User compresses the PDF to 20MB and uploads successfully. |

### 12.2 Configurable Document Rules

#### DOC-C-001: Allowed File Types

| Field | Value |
|---|---|
| **ID** | DOC-C-001 |
| **Title** | Allowed document file types |
| **Description** | The list of MIME types permitted for document uploads. |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Evaluated on upload. |
| **Exception** | Admin can modify the list. |
| **Dependencies** | DOC-M-002 |
| **Business Reason** | Enterprise security policies may require restricting to specific file types. |
| **System Behaviour** | Default: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, TIFF. Admin can add or remove types. |
| **Example** | Security policy requires blocking all Microsoft Office documents. Admin removes DOC, DOCX, XLS, XLSX. Only PDF and images remain allowed. |

#### DOC-C-002: Maximum File Size

| Field | Value |
|---|---|
| **ID** | DOC-C-002 |
| **Title** | Maximum document file size |
| **Description** | The maximum allowed file size for document uploads, in megabytes. |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Must be between 1 and 100 MB. |
| **Exception** | Admin per-tenant override. |
| **Dependencies** | DOC-M-003 |
| **Business Reason** | Storage capacity and upload performance considerations vary by enterprise. |
| **System Behaviour** | Default: 25 MB. |
| **Example** | Enterprise with limited storage reduces limit to 10 MB. Enterprise with high-resolution contract scans increases to 50 MB. |

#### DOC-C-003: Document Retention Period

| Field | Value |
|---|---|
| **ID** | DOC-C-003 |
| **Title** | Document retention period |
| **Description** | How long documents are retained before automatic archiving or deletion. |
| **Priority** | Low |
| **Classification** | Configurable + Soft + Global |
| **Validation** | Must be between 1 and 255 months (21 years). |
| **Exception** | Per-document legal hold can override retention. |
| **Dependencies** | None |
| **Business Reason** | Regulatory requirements dictate minimum retention periods for contract documents (e.g., 7 years for tax purposes). |
| **System Behaviour** | Default: 84 months (7 years). After retention period, document is moved to cold storage (archive). After additional grace period (configurable, default 12 months), hard deletion. |
| **Example** | Contract document uploaded January 2026. Retention = 84 months. Archived January 2033. Grace period = 12 months. Hard deleted January 2034 (unless legal hold active). |

---

## 13. Rule Interaction Matrix

This matrix documents interactions between rules where one rule's behavior affects another.

| Rule A | Rule B | Interaction |
|---|---|---|
| CTR-M-001 (end_date > start_date) | RNW-M-001 (state machine) | If end_date is modified after renewal creation, the renewal state machine must reassess whether the renewal is still valid. |
| CTR-M-005 (contract deletion) | RNW-M-002 (unique contract-year) | A deleted contract cannot have new renewals. Existing renewals remain for audit but cannot transition forward. |
| RNW-M-005 (business approval before PO) | PO-M-001 (PO <= approved amount) | PO-M-001 depends on amount set during RNW-M-005 approval. If unapproved, amount is null and PO creation is blocked. |
| RNW-M-009 (attestation expiry) | NTF-M-001 (SLA breach notification) | If attestation is expired and renewal is blocked, SLA on the approval stage may breach, triggering NTF-M-001. |
| APR-M-004 (sequential chain) | APR-C-003 (SLA duration) | Each sequential step's SLA is independently calculated. A delay in step 1 cascades to step 2's start time. |
| APR-C-001 (approval thresholds) | APR-C-002 (legal review threshold) | APR-C-002 is evaluated as a sub-condition of APR-C-001. If both thresholds are exceeded, the chain includes both legal and additional approval steps. |
| INV-M-006 (auto-match tolerance) | INV-C-001 (tolerance %) + INV-C-002 (tolerance $) | INV-M-006 delegates its thresholds to INV-C-001 and INV-C-002. If both tolerances are configured, the more permissive one applies. |
| NTF-M-001 (SLA breach mandatory) | NTF-C-001 (user preferences) | NTF-M-001 overrides NTF-C-001. The user's preference to suppress or digest is ignored for SLA breach notifications. |
| DOC-M-002 (file type validation) | DOC-C-001 (allowed types) | DOC-M-002 enforces the list defined in DOC-C-001. If no types are configured (empty list), all types are blocked. |
| CST-M-003 (unique name per BU) | CST-C-002 (portal access) | Portal access creates a limited user tied to the customer. If customer name changes, portal user display name should reflect the change. |

## 14. Default Configuration Values

| Rule ID | Config Key | Default | Unit |
|---|---|---|---|
| CTR-C-001 | renewal.window_days | 90 | days |
| CTR-C-002 | auto_renewal.notice_period_default | 60 | days |
| CTR-C-003 | contract.expiry_notification_lead_days | 30 | days |
| RNW-C-001 | renewal.priority_rules | empty (all NORMAL) | — |
| RNW-C-002 | approval.sla_duration | 48 | hours |
| RNW-C-003 | attestation.frequency_months | 12 | months |
| RNW-C-004 | renewal.identification_schedule | "0 0 * * *" (daily) | cron |
| VEN-C-001 | vendor.risk_review_frequency_months | 12 | months |
| PO-C-001 | po.number_format | "PO-{sequence}" | format |
| PO-C-002 | po.acknowledgment_follow_up_days | 7 | days |
| INV-C-001 | invoice.match_tolerance_percent | 2.0 | percent |
| INV-C-002 | invoice.match_tolerance_amount | 500 | dollars |
| INV-C-003 | invoice.enforce_payment_terms | false | boolean |
| APR-C-001 | approval.thresholds | [{"max": 50000, "steps": ["business_owner"]}, {"max": 250000, "steps": ["legal", "business_owner"]}, {"max": null, "steps": ["legal", "business_owner", "cfo"]}] | — |
| APR-C-002 | approval.legal_review_threshold | 100000 | dollars |
| APR-C-003 | approval.sla_per_type | {"legal": 48, "business_owner": 48, "cfo": 72, "financial": 48} | hours |
| APR-C-004 | approval.escalation_interval | 24 | hours |
| APR-C-005 | approval.auto_approval_enabled | false | boolean |
| APR-C-005 | approval.auto_approval_threshold | 10000 | dollars |
| TSK-C-001 | task.default_priority | "normal" | enum |
| TSK-C-002 | task.reminder_days_before_due | 2 | days |
| NTF-C-001 | notification.default_channels | ["in_app", "email"] | array |
| NTF-C-002 | notification.digest_frequency | "daily" | daily/weekly |
| NTF-C-003 | notification.reminder_interval_hours | 24 | hours |
| DOC-C-001 | document.allowed_mime_types | ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/png", "image/jpeg", "image/tiff"] | array |
| DOC-C-002 | document.max_file_size_mb | 25 | MB |
| DOC-C-003 | document.retention_months | 84 | months |

## 15. Rule Violation Matrix

| Condition | Rule ID | HTTP Code | Error Message Template |
|---|---|---|---|
| end_date <= start_date | CTR-M-001 | 400 | "end_date must be after start_date" |
| total_value != sum(line_totals) | CTR-M-002 | 400 | "total_contract_value must equal sum of line item totals" |
| notification_enabled without email | CTR-M-003 | 400 | "notification_email is required when notifications are enabled" |
| auto_renewal without notice period | CTR-M-004 | 400 | "auto_renewal_notice_period is required when auto-renewal is enabled" |
| hard delete with active renewals | CTR-M-005 | 409 | "Contract cannot be deleted as it has associated renewal records" |
| duplicate contract_number per vendor | CTR-M-007 | 409 | "A contract with number {number} already exists for vendor {vendor}" |
| renewal_date after end_date | CTR-M-009 | 400 | "renewal_date must be on or before end_date" |
| invalid status transition | RNW-M-001 | 409 | "Cannot transition from {current} to {requested}" |
| duplicate renewal per contract-year | RNW-M-002 | 409 | "A renewal for contract {id} in year {year} already exists" |
| cancel without reason | RNW-M-003 | 400 | "cancellation_reason is required when cancelling a renewal" |
| hold without reason/date | RNW-M-004 | 400 | "hold_reason and hold_until are required" |
| no approval before PO | RNW-M-005 | 409 | "Renewal cannot proceed to PO creation without approved business approval" |
| no invoice match before complete | RNW-M-006 | 409 | "Renewal cannot be marked complete without a matched invoice" |
| assignee = approver | RNW-M-007 | 400 | "{user} is assigned to this renewal and cannot also be an approver" |
| no quote before budget check | RNW-M-008 | 400 | "vendor_quote_amount must be recorded before budget check" |
| duplicate vendor code | VEN-M-001 | 409 | "Vendor code {code} is already in use" |
| no primary contact | VEN-M-002 | 400 | "Vendor must have at least one primary contact" |
| vendor delete with active contracts | VEN-M-003 | 409 | "Vendor has active contracts and cannot be deleted" |
| PO exceeds approved amount | PO-M-001 | 400 | "PO amount {po} exceeds approved renewal amount {approved}" |
| PO without line items | PO-M-003 | 400 | "PO must have at least one line item before sending" |
| PO complete without ack | PO-M-004 | 400 | "PO must be acknowledged before it can be marked complete" |
| duplicate PO per renewal | PO-M-005 | 409 | "A purchase order already exists for this renewal" |
| invoice exceeds PO | INV-M-002 | 400 | "Invoice amount {inv} exceeds PO total {po}" |
| exception without reason | INV-M-003 | 400 | "variance_reason is required when setting invoice status to EXCEPTION" |
| pay without match | INV-M-004 | 400 | "Invoice must be in MATCHED status before payment" |
| duplicate invoice per vendor | INV-M-005 | 409 | "Invoice {number} from {vendor} has already been recorded" |
| self-approval | APR-M-001 | 400 | "{user} is assigned to this renewal and cannot also approve it" |
| reject without comments | APR-M-002 | 400 | "Comments are required when rejecting an approval request" |
| duplicate pending approval | APR-M-003 | 409 | "An approval request for {type} is already pending" |
| out-of-order approval | APR-M-004 | 400 | "Approval step {order} cannot be decided before prior step {prior}" |
| delegate insufficient authority | APR-M-005 | 400 | "{delegate} does not have sufficient authority to replace {approver}" |
| completed task modification | TSK-M-003 | 400 | "Completed tasks cannot be modified" |
| invalid file type | DOC-M-002 | 400 | "File type {type} is not allowed" |
| file too large | DOC-M-003 | 413 | "File size exceeds maximum allowed size of {size}" |
