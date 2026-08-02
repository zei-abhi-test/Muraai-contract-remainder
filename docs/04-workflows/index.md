# Workflows

## Overview

Muraai encodes business processes as deterministic state machines and workflows. Every state transition is governed by permissions, validation rules, and policy configuration. Workflows are not discretionary — the platform enforces process compliance.

## 1. Core Renewal Lifecycle

### Purpose
Guide every renewal from identification through payment completion with zero gaps.

### Trigger
A Contract's `end_date` enters the configurable renewal window (default: 90 days).

### Participants
S1 (Renewals Ops Manager) initiates. S2 (Procurement) executes. S4 (Legal), S5 (Business Owner), S3 (Finance) approve/validate.

### Flow

```
1. IDENTIFY
   │
   ├─ System detects contract within renewal window
   ├─ Creates Renewal entity with status = "pending_review"
   ├─ Notifies S1
   │
   ▼
2. ASSIGN
   │
   ├─ S1 reviews renewal queue, assigns to S2
   ├─ Renewal status → "assigned"
   ├─ Notifies S2
   │
   ▼
3. QUOTE COLLECTION
   │
   ├─ S2 contacts vendor (via Muraai-tagged email or manually)
   ├─ S2 uploads/enters vendor quote into renewal record
   ├─ Renewal status → "quote_received"
   ├─ Domain Event: QuoteReceived
   │
   ▼
4. BUDGET CHECK (automated)
   │
   ├─ System validates quote against:
   │   • Existing contract spend
   │   • Budget code availability (via ERP integration)
   │   • Configurable threshold rules
   ├─ If budget OK → status → "budget_approved"
   ├─ If budget issue → status → "budget_review"
   │   • S2 may negotiate lower price → loop to step 3
   │   • Or escalate to S8 for over-budget approval
   │
   ▼
5. LEGAL REVIEW (conditional)
   │
   ├─ Triggered if:
   │   • Renewal value > threshold (default $100K)
   │   • Vendor terms changed from prior year
   │   • Contract type requires legal review (configurable)
   ├─ S4 reviews vendor terms against clause library
   ├─ S4 approves/rejects at clause level or document level
   ├─ If rejected → loop to step 3 (renegotiate) or step 8 (cancel)
   ├─ Renewal status → "legal_approved"
   │
   ▼
6. BUSINESS OWNER APPROVAL
   │
   ├─ S5 receives approval request with full context:
   │   • Current spend vs. proposed
   │   • Usage attestation (required if >12 months since last)
   │   • Vendor quote and recommendation
   ├─ S5 provides usage attestation
   ├─ S5 approves or rejects
   ├─ SLA timer: 48h → escalation to manager
   ├─ If approved → status → "business_approved"
   ├─ If rejected → status → "cancelled"
   │
   ▼
7. PO CREATION
   │
   ├─ System creates PO draft pre-populated from renewal
   ├─ S2 reviews, adjusts if needed, sends to vendor
   ├─ PO status → "sent"
   ├─ Vendor acknowledges (tracked manually or via integration)
   ├─ PO status → "acknowledged"
   │
   ▼
8. INVOICE RECEIVED
   │
   ├─ S3 receives invoice (email, EDI, or upload)
   ├─ System auto-matches to PO and renewal
   ├─ If match → status → "matched"
   ├─ If mismatch → status → "exception"
   │   • S3 investigates, selects resolution:
   │     - Accept variance (within tolerance)
   │     - Request credit note from vendor
   │     - Escalate to S2 for PO amendment
   │
   ▼
9. PAYMENT
   │
   ├─ Invoice eligible for payment scheduling
   ├─ S3 schedules payment within terms
   ├─ Payment executed via ERP integration
   ├─ Renewal status → "complete"
   │
   ▼
10. ARCHIVE
    │
    ├─ Renewal data frozen
    ├─ Activity log finalized
    ├─ Renewal available for audit and forecasting
```

### Escalation Paths

| Condition | Escalation | Notification |
|---|---|---|
| Quote not received within 14 days of assignment | S1 → S7 | Email + in-app |
| Budget check fails | S2 → S8 | Email + in-app |
| Legal review SLA breached (48h) | S4 → General Counsel | Email + in-app |
| Business Owner approval SLA breached (48h → manager, 72h → director, 96h → CTO/CFO) | S5 chain | Email + in-app |
| PO not sent within 7 days of approval | S2 → S1 | Email + in-app |
| Invoice not matched within 14 days of receipt | S3 → S8 | Email + in-app |

### Alternate Paths

| Path | Trigger | Action |
|---|---|---|
| **Cancel** | Business Owner rejects, or vendor unable to quote | Renewal → "cancelled". Activity logged. Stakeholders notified. |
| **Hold** | Business Owner needs more time, or pending vendor negotiation | Renewal → "on_hold". Requires reason and expected resolution date. |
| **Renegotiate** | Price too high, terms unacceptable, budget insufficient | Renewal → "quote_received" (back to step 3). Counter-quote tracked as revision. |
| **Auto-Renewal Bypass** | Contract has auto-renewal clause | System flags before auto-renewal deadline. If no action by deadline, contract auto-renews — logged as exception. |

## 2. Purchase Order Workflow

### Purpose
Create, send, and track POs linked to approved renewals.

### State Machine

```
Draft ──► Sent ──► Acknowledged ──► Complete
  │                  │
  ▼                  ▼
Cancelled         Rejected ──► Amend ──► Sent (new version)
```

### Rules
- PO cannot exceed approved renewal amount (system-enforced).
- PO requires budget code validation before sending.
- PO sent via email or ERP integration.
- Vendor acknowledgment tracked; if not received within 7 days, S2 follows up.
- PO amendments create a new version; original retained in history.

## 3. Invoice Matching Workflow

### Purpose
Match incoming invoices to POs and renewals, resolve exceptions.

### Process

```
Invoice Received
    │
    ▼
Auto-Match Attempt
    │
    ├── Full Match ──► Invoice Matched ──► Ready for Payment
    │
    └── Mismatch Detected
        │
        ├── Amount Only (±2% or $500) → Auto-Match with tolerance
        ├── Amount Variance > Tolerance → Manual Review
        ├── PO Reference Missing → Search manually or Hold
        └── Vendor Mismatch → Escalate to S2
```

### Exception Resolutions
| Scenario | Action |
|---|---|
| Amount variance within tolerance | Accept. Log variance with reason. |
| Amount variance exceeds tolerance | Hold invoice. Notify S2. Request PO amendment or credit note. |
| Invoice references wrong PO | Re-match to correct PO or return to vendor. |
| No PO found | Hold. Investigate. May be non-renewal charge. |
| Quantity mismatch | Verify with S5 (usage attestation) before approving. |

## 4. Approval Chain Workflow

### Purpose
Route renewal decisions through the correct approval hierarchy based on value, risk, and policy.

### Rule Engine

```
Input: Renewal { value, vendor, contract_type, terms_changed }
Output: [Approval steps]

Rules (evaluated in priority order):
1. If value > CFO_THRESHOLD → [Legal, Business Owner, CFO]
2. If value > BU_THRESHOLD → [Legal, Business Owner]
3. If terms_changed → [Legal, Business Owner]
4. If contract_type in HIGH_RISK_TYPES → [Legal, Business Owner]
5. Default → [Business Owner]
```

### SLA Enforcement
- Each approval step has a configurable SLA (default: 48h).
- After SLA expires: notification to approver + manager.
- After SLA + grace period: automatic escalation to next authority level.
- SLA breach logged as audit event.

## 5. Usage Attestation Workflow

### Purpose
Ensure renewals only proceed when license usage is confirmed and still required.

### Trigger
Renewal enters Business Owner approval step AND 12 months have passed since last attestation.

### Process
1. System presents current usage data (from integration or manual entry).
2. Business Owner confirms: current user count, planned changes, still required.
3. If not required → Renewal proceeds to cancellation or right-sizing workflow.
4. Attestation valid for 12 months.

## 6. Notification Workflow

### Purpose
Keep stakeholders informed of renewal events without adding noise.

### Rules
- Each stakeholder has configurable notification preferences (in-app, email, both).
- Notifications are event-driven, not polling-based.
- Digest mode available for low-priority notifications (configurable threshold).
- SLA breach notifications always send in real-time regardless of preferences.

### Notification Types

| Type | Priority | Recipients | Delivery |
|---|---|---|---|
| Renewal assigned | Normal | S2 | In-app + email |
| Quote received | Normal | S1 | In-app |
| Approval required | High | S4/S5/S8 | In-app + email |
| SLA breached | Critical | Approver + manager + S1 | In-app + email + SMS (configurable) |
| Invoice received | Normal | S3 | In-app + email |
| Invoice exception | High | S3 + S2 | In-app + email |
| PO rejected | High | S2 + S1 | In-app + email |
| Forecast deviation | Normal | S8 | Email digest |

## 7. Escalation Workflow

### Purpose
Ensure stalled renewals are systematically escalated through management chain.

### Escalation Levels

| Level | Time Since Breach | Notified Party | Authority |
|---|---|---|---|
| L1 | 0h (immediate) | Task owner | Must respond |
| L2 | 48h | Task owner's manager | Can reassign or override |
| L3 | 72h | Director | Can make decision |
| L4 | 96h | CTO / CFO | Final authority |

### Configuration
- Escalation timing is configurable per policy rule.
- Each escalation level can have different notification methods.
- Escalation history is logged in the activity log.
