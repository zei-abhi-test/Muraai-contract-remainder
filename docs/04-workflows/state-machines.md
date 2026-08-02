# Enterprise State Machines

## Document Control

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-07-20 | Enterprise Architect | Complete state machine specification for 7 entities |

---

## 1. State Machine Conventions

### 1.1 Notation

```
State A ──[event/action]──► State B
                ↑               │
                │   [event]     │
                └───────────────┘
```

- `[event]` = trigger that causes the transition
- `(/action)` = system action performed during the transition
- `{condition}` = guard condition that must be true for the transition

### 1.2 State Categories

| Category | Colour | Meaning |
|---|---|---|
| **Initial** | Green | Entity creation state |
| **Active** | Blue | Normal operational states |
| **Terminal** | Gray | Final state — no outgoing transitions |
| **Error** | Red | Anomaly detected — requires intervention |
| **Recovery** | Amber | Transition path from error back to normal |

### 1.3 Transition Types

| Type | Description |
|---|---|
| **Automatic** | Triggered by the system without human intervention |
| **Manual** | Triggered by a user action |
| **Conditional** | Triggered by a business rule evaluation |
| **Scheduled** | Triggered by a time-based job |
| **Event-driven** | Triggered by a domain event from another aggregate |

### 1.4 Entry and Exit Actions

Every transition consists of three phases:

```
1. Exit Action:   Run on the source state before leaving
2. Transition:    Validate, execute, log
3. Entry Action:  Run on the target state after arriving
```

---

## 2. Contract State Machine

### 2.1 Purpose

Track the lifecycle of a software maintenance agreement from creation through termination or expiry. The Contract state machine drives renewal identification — when a Contract enters ACTIVE, the system begins monitoring its `end_date` for renewal window detection.

### 2.2 Diagram

```
        ┌─────────────────────────────────────────────────────────────────────┐
        │                      CONTRACT STATE MACHINE                        │
        └─────────────────────────────────────────────────────────────────────┘

        [User creates contract]
                 │
                 ▼
          ┌─────────────┐
     ┌────│   DRAFT     │◄──── (edit/reopen)
     │    └──────┬──────┘
     │           │ [User activates]
     │           ▼
     │    ┌─────────────┐
     │    │   ACTIVE    │──────────────────────────────────────────────┐
     │    └──────┬──────┘                                              │
     │           │                                                     │
     │           ├── [end_date reached without renewal]                │
     │           │         ▼                                           │
     │           │    ┌─────────────┐                                  │
     │           │    │  EXPIRED    │                                  │
     │           │    └──────┬──────┘                                  │
     │           │           │ [User manually extends / renews]        │
     │           │           ▼                                         │
     │           │    ┌─────────────┐                                  │
     │           │    │   ACTIVE    │  (re-entry via renewal)          │
     │           │    └─────────────┘                                  │
     │           │                                                     │
     │           ├── [User terminates]                                 │
     │           │         ▼                                           │
     │           │    ┌─────────────┐                                  │
     │           │    │ TERMINATED  │──────────────────────────────────┤
     │           │    └──────┬──────┘                                  │
     │           │           │                                         │
     │           │           └── (can be reversed if terminated in error)
     │           │                  ▼                                  │
     │           │              ┌─────────────┐                        │
     │           │              │   ACTIVE    │                        │
     │           │              └─────────────┘                        │
     │           │                                                     │
     │           └── [Data integrity error detected]                   │
     │                        ▼                                        │
     │                   ┌─────────────┐                               │
     │                   │ INCONSISTENT│                               │
     │                   └──────┬──────┘                               │
     │                          │ [Data corrected]                     │
     │                          ▼                                       │
     │                     ┌─────────────┐                             │
     │                     │   ACTIVE    │                             │
     │                     └─────────────┘                             │
     │                                                                  │
     └────────────────── [User discards draft] ─────────────────────────┘
                                    │
                                    ▼
                             ┌─────────────┐
                             │  DELETED    │  (only from DRAFT)
                             └─────────────┘
```

### 2.3 State Table

| State | Category | Description | Entry Action | Exit Action |
|---|---|---|---|---|
| **DRAFT** | Initial | Contract is being created. Not yet governing any renewals. | Auto-save initial data. Notify creator of incomplete fields. | Validate mandatory fields. |
| **ACTIVE** | Active | Contract is in effect. Renewal monitoring is active. | Schedule renewal window check. Set `start_date` if not already set. Notify stakeholders. | Clear any active integrity warnings. |
| **EXPIRED** | Terminal | Contract end date has passed without renewal. | Notify contract owner. Archive renewal data. Stop renewal monitoring. | — |
| **TERMINATED** | Terminal | Contract was ended early by user action. | Set `terminated_at`. Notify stakeholders. Cancel any active renewals. | — |
| **INCONSISTENT** | Error | Data integrity issue detected (e.g., total != sum of line items, end_date < start_date after update). | Notify contract owner and S10. Flag in admin dashboard. | — |
| **DELETED** | Terminal | Contract was permanently removed (only from DRAFT). | Hard delete record. Irreversible. | — |

### 2.4 Transition Table

| From | To | Trigger | Automation | Conditions | Validation |
|---|---|---|---|---|---|
| DRAFT | ACTIVE | User activates contract | Manual | All mandatory fields populated | CTR-M-001, CTR-M-002, CTR-M-008, CTR-M-009 |
| DRAFT | DELETED | User deletes draft | Manual | No renewals linked to contract | CTR-M-005 |
| ACTIVE | EXPIRED | Scheduled job detects end_date passed and no active renewal | Automatic | `end_date < today` AND no Renewal with status in (PO_CREATED, COMPLETE) | — |
| ACTIVE | TERMINATED | User terminates contract | Manual | Reason required | Reason required |
| ACTIVE | INCONSISTENT | Scheduled job or post-update validation detects inconsistency | Automatic | Data integrity check fails | CTR-M-002, CTR-M-001 |
| ACTIVE | ACTIVE | User updates contract fields | Manual | No changes to immutable fields | — |
| EXPIRED | ACTIVE | User reactivates (e.g., renewal processed late) | Manual | New end_date must be > today | CTR-M-001, CTR-M-009 |
| TERMINATED | ACTIVE | User reverses termination | Manual | Admin privilege required | — |
| INCONSISTENT | ACTIVE | Data corrected by user or system | Manual/Auto | All integrity checks pass | CTR-M-001, CTR-M-002 |

### 2.5 Forbidden Transitions

| From | To | Why Forbidden |
|---|---|---|
| EXPIRED | DRAFT | Expired contracts cannot return to draft. Only ACTIVE or TERMINATED are valid predecessors. |
| TERMINATED | DRAFT | Same reason as above. |
| ACTIVE | DRAFT | Once activated, a contract cannot return to draft. Use INCONSISTENT if data is wrong. |
| DELETED | ANY | Terminal state. |
| ACTIVE | DELETED | Contract with active renewals cannot be deleted. Use TERMINATED. |

### 2.6 Error States

| Error State | Detection | Cause | Recovery |
|---|---|---|---|
| **INCONSISTENT** | Scheduled job (daily) or post-update hook | Data integrity violation: total != sum(line_totals), end_date < start_date, missing mandatory field | User corrects data → system validates → moves to ACTIVE. Or admin force-override to TERMINATED if contract is un-salvageable. |

### 2.7 Error Recovery Paths

| Path | Action | Responsible | SLA |
|---|---|---|---|
| INCONSISTENT → ACTIVE | Correct data via edit form | Contract owner / S2 | 48 hours |
| INCONSISTENT → TERMINATED | Admin force-terminate | S10 | — |

---

## 3. Renewal State Machine

### 3.1 Purpose

Orchestrate every contract renewal from identification through to payment completion. This is the most complex state machine in Muraai — it is the heart of the platform.

### 3.2 Diagram

```
        ┌─────────────────────────────────────────────────────────────────────┐
        │                      RENEWAL STATE MACHINE                         │
        └─────────────────────────────────────────────────────────────────────┘

[System detects contract in renewal window]
        │
        ▼
 ┌────────────────┐
 │ PENDING_REVIEW │←────────────────────────────────────────────────────┐
 └───────┬────────┘                                                      │
         │ [S1 assigns to S2]                                            │
         ▼                                                               │
 ┌────────────────┐                                                      │
 │   ASSIGNED     │                                                      │
 └───────┬────────┘                                                      │
         │ [S2 records vendor quote]                                     │
         ▼                                                               │
 ┌────────────────┐                                                      │
 │ QUOTE_RECEIVED │◄──── (negotiate: price too high)                     │
 └───────┬────────┘                                                      │
         │ [System or S2 triggers budget check]                          │
         ▼                                                               │
 ┌────────────────┐                                                      │
 │ BUDGET_CHECK   │                                                      │
 └───────┬────────┘                                                      │
         │                                                                │
    ┌────┴────┐                                                          │
    ▼         ▼                                                          │
┌────────┐┌───────────┐                                                  │
│ BUDGET ││ BUDGET    │── (escalate to S8 for override) ──► continue    │
│PASSED  ││ REVIEW    │── (negotiate lower price) ─────────► QUOTE_RECEIVED
└──┬─────┘└───────────┘                                                  │
   │                                                                      │
   ▼                                                                      │
┌──────────────┐                                                          │
│ LEGAL_REVIEW │◄──── (skip if not required by policy)                    │
└──────┬───────┘                                                          │
       │                                                                  │
  ┌────┴────┐                                                            │
  ▼         ▼                                                            │
┌───────┐┌────────┐                                                      │
│LEGAL  ││ LEGAL  │── (request changes) ─────► QUOTE_RECEIVED            │
│APPROVED││REJECTED│                                                    │
└───┬───┘└────────┘                                                      │
    │                                                                      │
    ▼                                                                      │
┌──────────────────┐                                                      │
│ BUSINESS_APPROVAL│                                                      │
│                  │  (requires valid UsageAttestation)                   │
└──────┬───────────┘                                                      │
       │                                                                  │
  ┌────┴────┐                                                            │
  ▼         ▼                                                            │
┌───────┐┌────────┐                                                      │
│  BIZ  ││ BIZ    │── (decline to renew) ─────────────► CANCELLED         │
│APPROVED││REJECTED│                                                      │
└───┬───┘└────────┘                                                      │
    │                                                                      │
    ▼                                                                      │
┌────────────┐                                                            │
│ PO_PENDING │  (system creates PO draft, S2 reviews)                     │
└──────┬─────┘                                                            │
       │ [PO created and sent]                                            │
       ▼                                                                  │
┌────────────┐                                                            │
│ PO_SENT    │                                                            │
└──────┬─────┘                                                            │
       │ [Invoice received and matched]                                   │
       ▼                                                                  │
┌────────────┐                                                            │
│ INVOICE    │                                                            │
│ MATCHED    │                                                            │
└──────┬─────┘                                                            │
       │ [Payment recorded]                                               │
       ▼                                                                  │
┌────────────┐                                                            │
│ COMPLETE   │  Terminal (success)                                        │
└────────────┘                                                            │
                                                                          │
INTERRUPT STATES (accessible from most active states):                    │
                                                                          │
┌───────────┐    ┌────────────┐                                           │
│ ON_HOLD   │───►│  (resume)  │──► (previous state)                       │
└───────────┘    └────────────┘                                           │
                                                                          │
┌───────────┐    ┌────────────┐                                           │
│ ESCALATED │───►│  (resolve) │──► (previous state)                       │
└───────────┘    └────────────┘                                           │
                                                                          │
┌───────────┐                                                             │
│ CANCELLED │  Terminal (no renewal)                                      │
└───────────┘                                                             │
                                                                          │
┌──────────────┐                                                          │
│ STALLED      │  Error (no progress for configured period)               │
└──────┬───────┘                                                          │
       │ [Manual intervention] ──► (previous active state)                │
       │ [Auto-escalation] ──────► ESCALATED                              │
```

### 3.3 State Table

| State | Category | Description | Entry Action | Exit Action |
|---|---|---|---|---|
| **PENDING_REVIEW** | Initial | Renewal created, awaiting S1 assignment | Notify S1. Set `created_at`. Log Activity. | None. |
| **ASSIGNED** | Active | S1 assigned to S2 | Notify S2. Set `assigned_at`. Start assignment SLA timer. | Clear assignment timer. |
| **QUOTE_RECEIVED** | Active | Vendor quote recorded | Validate quote amount. Set `vendor_quote_received_at`. Notify S1. | None. |
| **BUDGET_CHECK** | Active | Budget validation in progress | Call BudgetValidationService. Set `budget_checked_at`. | None. |
| **BUDGET_PASSED** | Active | Budget validated successfully | Set `budget_approved_amount`. Evaluate approval routing policy. Notify S2. | None. |
| **BUDGET_REVIEW** | Active | Budget insufficient, awaiting decision | Notify S2 and S1. Start budget review SLA timer. | Clear review timer. |
| **LEGAL_REVIEW** | Active | Legal terms review pending | Create ApprovalRecord for S4. Start SLA timer. Notify S4. | Clear legal SLA timer. |
| **LEGAL_APPROVED** | Active | Legal approved | Record legal approval. Check next step in chain. | None. |
| **LEGAL_REJECTED** | Active | Legal rejected | Log rejection. Determine action: renegotiate (→ QUOTE_RECEIVED) or cancel. | None. |
| **BUSINESS_APPROVAL** | Active | Business Owner approval pending | Check UsageAttestation validity. Create ApprovalRecord for S5. Start SLA timer. Notify S5. | Clear business SLA timer. |
| **BUSINESS_APPROVED** | Active | Business Owner approved | Record business approval. Check next step (CFO if above threshold). Trigger PO creation. | None. |
| **BUSINESS_REJECTED** | Terminal (fail) | Business Owner declined to renew | Set `cancellation_reason`. Notify stakeholders. Log activity. | — |
| **PO_PENDING** | Active | PO draft created, S2 reviewing | System creates PO draft from renewal data. Notify S2 "PO ready for review." | None. |
| **PO_SENT** | Active | PO sent to vendor | Link PO to renewal. Set `po_sent_at`. Start PO acknowledgment timer. | None. |
| **INVOICE_MATCHED** | Active | Invoice received and matched to PO | Link invoice to renewal. Update financial forecast. | None. |
| **COMPLETE** | Terminal (success) | Renewal fully processed | Set status. Notify all stakeholders. Archive renewal data. | — |
| **ON_HOLD** | Interrupt | Renewal paused | Set `hold_reason`, `hold_until`. Schedule resume notification. Notify S1. | Clear hold data. |
| **ESCALATED** | Interrupt | Renewal sent to higher authority | Increment `escalation_level`. Notify escalation target. Log. | None. |
| **CANCELLED** | Terminal (fail) | Renewal will not proceed | Log cancellation reason. Notify stakeholders. Archive. | — |
| **STALLED** | Error | No progress for configured period | Notify S1. EscalationService evaluates next step. | — |

### 3.4 Transition Table

| From | To | Trigger | Automation | Conditions | Validation |
|---|---|---|---|---|---|
| PENDING_REVIEW | ASSIGNED | S1 assigns to S2 | Manual | S2 must have PROCUREMENT role | RNW-M-007 |
| PENDING_REVIEW | CANCELLED | S1 cancels | Manual | Reason required | RNW-M-003 |
| PENDING_REVIEW | ON_HOLD | S1 puts on hold | Manual | Reason + future hold_until | RNW-M-004 |
| ASSIGNED | QUOTE_RECEIVED | S2 records quote | Manual | Amount > 0 | — |
| ASSIGNED | CANCELLED | S1/S2 cancels | Manual | Reason required | RNW-M-003 |
| ASSIGNED | ON_HOLD | S1 puts on hold | Manual | Reason + hold_until | RNW-M-004 |
| ASSIGNED | ESCALATED | S1 escalates | Manual | Reason required | — |
| ASSIGNED | STALLED | No activity for 14 days | Automatic | — | — |
| QUOTE_RECEIVED | BUDGET_CHECK | S2 triggers budget check | Manual | — | RNW-M-008 |
| QUOTE_RECEIVED | QUOTE_RECEIVED | S2 updates/replaces quote | Manual | | |
| QUOTE_RECEIVED | CANCELLED | S1/S2 cancels | Manual | Reason | RNW-M-003 |
| QUOTE_RECEIVED | ON_HOLD | S1 holds | Manual | Reason + hold_until | RNW-M-004 |
| BUDGET_CHECK | BUDGET_PASSED | BudgetValidationService succeeds | Auto/Manual | Budget check passes | — |
| BUDGET_CHECK | BUDGET_REVIEW | BudgetValidationService fails | Auto/Manual | Budget check fails | — |
| BUDGET_CHECK | STALLED | No result for 48h | Automatic | — | — |
| BUDGET_REVIEW | BUDGET_PASSED | S8 approves override | Manual | | |
| BUDGET_REVIEW | QUOTE_RECEIVED | Renegotiate lower price | Manual | | |
| BUDGET_REVIEW | CANCELLED | Cannot resolve | Manual | Reason | |
| BUDGET_PASSED | LEGAL_REVIEW | Policy requires legal review | Automatic | Value > legal threshold OR terms changed | APR-C-002 |
| BUDGET_PASSED | BUSINESS_APPROVAL | Policy does not require legal | Automatic | Value < legal threshold AND terms unchanged | — |
| LEGAL_REVIEW | LEGAL_APPROVED | S4 approves | Manual | | APR-M-001, APR-M-002, APR-M-004 |
| LEGAL_REVIEW | LEGAL_REJECTED | S4 rejects | Manual | Comments required | APR-M-002 |
| LEGAL_REVIEW | STALLED | SLA breach + no action | Automatic | | |
| LEGAL_APPROVED | BUSINESS_APPROVAL | Next step in chain | Automatic | | |
| LEGAL_REJECTED | QUOTE_RECEIVED | Renegotiate terms | Manual | | |
| LEGAL_REJECTED | CANCELLED | Cannot resolve | Manual | Reason | |
| LEGAL_REJECTED | LEGAL_REVIEW | S4 requests minor changes (re-submit) | Manual | | |
| BUSINESS_APPROVAL | BUSINESS_APPROVED | S5 approves | Manual | Valid attestation (or create) | APR-M-001, APR-M-004 |
| BUSINESS_APPROVAL | BUSINESS_REJECTED | S5 rejects | Manual | Comments required | APR-M-002 |
| BUSINESS_APPROVAL | CANCELLED | S5 declines to renew | Manual | Reason | |
| BUSINESS_APPROVAL | ON_HOLD | S5 needs more time | Manual | Reason + hold_until | RNW-M-004 |
| BUSINESS_APPROVAL | STALLED | SLA breach | Automatic | | |
| BUSINESS_APPROVED | PO_PENDING | System creates PO draft | Automatic | | PO-M-001, PO-M-005 |
| BUSINESS_APPROVED | BUSINESS_APPROVAL | Above CFO threshold — additional approval | Automatic | Value > CFO_THRESHOLD | APR-C-001 |
| PO_PENDING | PO_SENT | S2 sends PO | Manual | | PO-M-003 |
| PO_PENDING | PO_PENDING | S2 edits PO draft | Manual | | |
| PO_PENDING | CANCELLED | Cannot proceed | Manual | Reason | |
| PO_SENT | INVOICE_MATCHED | Invoice received and matched | Event-driven | INV-M-006 | INV-M-001, INV-M-002 |
| PO_SENT | STALLED | No invoice for 30 days | Automatic | | |
| PO_SENT | CANCELLED | PO cancelled | Manual | | |
| INVOICE_MATCHED | COMPLETE | Payment recorded | Event-driven | | |
| ON_HOLD | (previous state) | Resume | Manual | hold_until reached or S1 resumes | |
| ON_HOLD | CANCELLED | Cancel while on hold | Manual | Reason | |
| ESCALATED | (previous state) | Resolve escalation | Manual | | |
| ESCALATED | CANCELLED | Cancel via escalation | Manual | Reason | |
| STALLED | (previous active state) | Manual intervention | Manual | | |
| STALLED | ESCALATED | Auto-escalation | Automatic | | |

### 3.5 Forbidden Transitions

| From | To | Why Forbidden |
|---|---|---|
| PENDING_REVIEW | BUSINESS_APPROVAL | Skips entire procurement workflow |
| PENDING_REVIEW | PO_PENDING | No quote, no approval |
| ASSIGNED | BUDGET_CHECK | No quote received |
| QUOTE_RECEIVED | BUSINESS_APPROVAL | Skips budget and legal checks |
| BUDGET_PASSED | PO_PENDING | Skips approvals |
| LEGAL_APPROVED | QUOTE_RECEIVED | Cannot renegotiate after legal approval |
| BUSINESS_APPROVED | QUOTE_RECEIVED | Cannot renegotiate after final approval |
| COMPLETE | ANY | Terminal state |
| CANCELLED | ANY | Terminal state |
| COMPLETE | CANCELLED | Cannot cancel a completed renewal |

### 3.6 Error States

| Error State | Detection | Cause | Recovery |
|---|---|---|---|
| **STALLED** | Scheduled job checks renewal with no status change for configured period (default 14 days) | Approver inactive, vendor unresponsive, data missing | Auto-escalation after SLA breach OR S1 manually intervenes OR system moves to ESCALATED |
| **BUDGET_FAILED** | BudgetValidationService returns unrecoverable error | ERP unavailable, budget code invalid | Manual retry by S2 after ERP is restored. Or S8 override. |

### 3.7 Recovery Paths

| Path | Action | Responsible | SLA |
|---|---|---|---|
| STALLED → previous state | S1 reviews, resolves blocker, manually transitions | S1 | 24h after notification |
| STALLED → ESCALATED | Auto-escalation after 48h in STALLED | System | 48h |
| BUDGET_CHECK failure | Retry budget check after ERP restored | System (auto) / S2 (manual) | 4h |
| Legal SLA breach → LEGAL_REVIEW | Escalation to General Counsel | System | 48h original SLA |
| Business SLA breach → BUSINESS_APPROVAL | Escalation chain (manager → director → CTO) | System | Per APR-C-004 |

---

## 4. Purchase Order State Machine

### 4.1 Purpose

Manage the lifecycle of a purchase order from creation through vendor acknowledgment. The PO bridges the renewal workflow (approval) and the financial workflow (invoice matching).

### 4.2 Diagram

```
        ┌─────────────────────────────────────────────────────────────────────┐
        │                     PURCHASE ORDER STATE MACHINE                   │
        └─────────────────────────────────────────────────────────────────────┘

[System creates PO draft from approved renewal]
        │
        ▼
  ┌──────────┐
  │  DRAFT   │◄──── (user edits and re-saves)
  └────┬─────┘
       │ [S2 reviews and sends]
       ▼
  ┌──────────┐
  │  SENT    │
  └────┬─────┘
       │
  ┌────┴────┐
  ▼         ▼
┌──────┐┌──────────┐
│ ACK. ││ REJECTED │── (vendor rejected)
└──┬───┘└────┬─────┘
   │         │ [S2 resolves]
   │         │
   │    ┌────┴─────┐
   │    │ AMENDED  │── (S2 creates new version)
   │    └────┬─────┘
   │         │ [resend]
   │         ▼
   │    ┌──────────┐
   │    │  SENT    │  (new version)
   │    └──────────┘
   │
   │ [Invoice matched]
   ▼
┌──────────┐
│ COMPLETE │  Terminal (success)
└──────────┘

   INTERRUPT / ERROR:

┌──────────┐
│ CANCELLED│  Terminal — manually cancelled
└──────────┘

┌─────────────┐
│ SEND_FAILED │  Error — delivery failure
└──────┬──────┘
       │ [Retry]
       ▼
  ┌──────────┐
  │  SENT    │
  └──────────┘

┌─────────────┐
│ ACK_OVERDUE │  Warning — no acknowledgment for 7+ days
└──────┬──────┘
       │ [Follow-up action]
       ▼
  ┌──────────┐  (remains in SENT, but flagged)
  │  SENT    │  (flagged as overdue)
  └──────────┘
```

### 4.3 State Table

| State | Category | Description | Entry Action | Exit Action |
|---|---|---|---|---|
| **DRAFT** | Initial | PO created, editable, not yet sent | Pre-populate from renewal data. Validate against approved amounts. | Validate mandatory fields. |
| **SENT** | Active | PO transmitted to vendor | Set `sent_at`, `sent_by`, `sent_method`. Generate PO document. Start acknowledgment timer (PO-C-002). | Clear acknowledgment timer. |
| **ACKNOWLEDGED** | Active | Vendor confirmed receipt | Set `acknowledged_at`. Notify S2. | None. |
| **REJECTED** | Active | Vendor rejected the PO | Set `rejected_at`, `rejection_reason`. Notify S2. | None. |
| **AMENDED** | Active | New version created after rejection | Create new PO version (new ID, same renewal_id). Increment version number. Cancel old PO. | None. |
| **COMPLETE** | Terminal (success) | Invoice matched, PO lifecycle ends | Link to invoice. Notify S2. | — |
| **CANCELLED** | Terminal | PO manually cancelled | Log reason. Notify stakeholders. | — |
| **SEND_FAILED** | Error | Transmission failed (email bounced, EDI error) | Log error. Notify S2. | — |
| **ACK_OVERDUE** | Warning | No acknowledgment within configured period | Flag as overdue. Notify S2. (Entity remains in SENT state.) | — |

### 4.4 Transition Table

| From | To | Trigger | Automation | Conditions | Validation |
|---|---|---|---|---|---|
| DRAFT | DRAFT | S2 edits/saves | Manual | | PO-M-001, PO-M-002 |
| DRAFT | SENT | S2 sends | Manual | At least 1 line item | PO-M-003 |
| DRAFT | CANCELLED | S2 cancels | Manual | Reason | |
| SENT | ACKNOWLEDGED | S2 records vendor ack | Manual | | |
| SENT | REJECTED | S2 records vendor rejection | Manual | Reason required | PO-M-006 |
| SENT | SEND_FAILED | Delivery system reports failure | Automatic | | |
| SENT | ACK_OVERDUE | Scheduled job: 7+ days no ack | Automatic | Configurable via PO-C-002 | |
| REJECTED | AMENDED | S2 creates amended version | Manual | | |
| REJECTED | CANCELLED | S2/S1 decides not to reissue | Manual | Reason | |
| AMENDED | SENT | S2 sends amended PO | Manual | | PO-M-003 |
| SEND_FAILED | SENT | S2 or system retries | Manual/Auto | | |
| ACKNOWLEDGED | COMPLETE | Invoice matched | Event-driven | | INV-M-001, INV-M-002 |
| ACKNOWLEDGED | CANCELLED | Cancelled after ack (rare) | Manual | Reason, high-level approval | |

### 4.5 Forbidden Transitions

| From | To | Why Forbidden |
|---|---|---|
| DRAFT | COMPLETE | Skips send and acknowledgment |
| SENT | DRAFT | Cannot return to draft after sending — cancel and re-create |
| REJECTED | ACKNOWLEDGED | Vendor rejected, cannot skip to acknowledged |
| CANCELLED | ANY | Terminal state |
| COMPLETE | ANY | Terminal state |

### 4.6 Error States and Recovery

| Error | Detection | Cause | Recovery |
|---|---|---|---|
| **SEND_FAILED** | Email delivery failure or EDI error | Invalid vendor email, EDI connection down | Auto-retry (3 attempts, 15-min interval). After 3 failures, notify S2 for manual send. |
| **ACK_OVERDUE** | Scheduled daily job | Vendor did not respond | Notify S2. S2 follows up with vendor via alternate channel. S2 can manually acknowledge. |

---

## 5. Invoice State Machine

### 5.1 Purpose

Manage the lifecycle of an invoice from receipt through payment, with PO matching as the critical control point.

### 5.2 Diagram

```
        ┌─────────────────────────────────────────────────────────────────────┐
        │                       INVOICE STATE MACHINE                        │
        └─────────────────────────────────────────────────────────────────────┘

[Invoice arrives: email parse, EDI, upload]
        │
        ▼
  ┌───────────┐
  │ RECEIVED  │
  └─────┬─────┘
        │ [System attempts auto-match]
        ▼
  ┌───────────┐
  │ MATCHING  │  (system processing — not a stable state)
  └─────┬─────┘
        │
   ┌────┴────┐
   ▼         ▼
┌───────┐┌───────────┐
│MATCHED││ EXCEPTION │
└───┬───┘└─────┬─────┘
    │          │
    │          ├── (variance resolved via PO amendment)
    │          │         ▼
    │          │    ┌───────────┐
    │          │    │  MATCHED  │
    │          │    └─────┬─────┘
    │          │          │
    │          ├── (variance accepted within override)
    │          │         ▼
    │          │    ┌───────────┐
    │          │    │  MATCHED  │
    │          │    └─────┬─────┘
    │          │          │
    │          └── (credit note requested — rare)
    │                 ▼
    │            ┌───────────┐
    │            │ CANCELLED │  (original invoice cancelled, new one expected)
    │            └───────────┘
    │
    │ [S3 schedules payment]
    ▼
  ┌────────────────┐
  │ PENDING_PAYMENT│
  └───────┬────────┘
          │ [Payment executed]
          ▼
    ┌──────────┐
    │  PAID    │  Terminal (success)
    └──────────┘

    ERROR:
    ┌──────────────┐
    │ MATCH_FAILED │  System error during matching
    └──────┬───────┘
           │ [Retry]
           ▼
    ┌───────────┐
    │  MATCHING │
    └───────────┘

    ┌───────────┐
    │ CANCELLED │  Terminal — manually cancelled
    └───────────┘
```

### 5.3 State Table

| State | Category | Description | Entry Action | Exit Action |
|---|---|---|---|---|
| **RECEIVED** | Initial | Invoice recorded, awaiting matching | Store invoice data. Validate required fields. Trigger auto-match. | None. |
| **MATCHING** | Processing (transient) | Auto-match in progress | Call InvoiceMatchingService. | None. |
| **MATCHED** | Active | Successfully matched to PO | Set `po_matched_amount`. Calculate variance. If within tolerance, notify S3. Update renewal forecast. | None. |
| **EXCEPTION** | Active | Variance detected outside tolerance | Set `variance_reason`. Notify S3. Notify S2 if PO amendment may be needed. | None. |
| **PENDING_PAYMENT** | Active | Matched and awaiting payment scheduling | Add to payment queue. Notify S3 if payment due date is approaching. | None. |
| **PAID** | Terminal (success) | Payment completed | Set `paid_date`, `payment_reference`. Notify stakeholders. Update financial records. | — |
| **CANCELLED** | Terminal | Invoice cancelled (duplicate, incorrect, credit note issued) | Log reason. Notify S3. | — |
| **MATCH_FAILED** | Error | System error during matching | Log error details. Notify S3. | — |

### 5.4 Transition Table

| From | To | Trigger | Automation | Conditions | Validation |
|---|---|---|---|---|---|
| RECEIVED | MATCHING | Invoice recorded | Automatic | | INV-M-005 |
| RECEIVED | CANCELLED | S3 cancels (duplicate) | Manual | Reason | |
| MATCHING | MATCHED | InvoiceMatchingService succeeds | Automatic | Variance within tolerances | INV-M-001, INV-M-002, INV-M-006 |
| MATCHING | EXCEPTION | InvoiceMatchingService finds variance | Automatic | Variance exceeds tolerance | INV-M-003 |
| MATCHING | MATCH_FAILED | Service error | Automatic | | |
| MATCHING | RECEIVED | Return to received for manual processing | Manual | | |
| EXCEPTION | MATCHED | S3 resolves exception (accept variance, PO amended) | Manual | Reason required for acceptance | |
| EXCEPTION | CANCELLED | S3 cancels (wrong invoice, credit note) | Manual | Reason | |
| EXCEPTION | EXCEPTION | S3 updates exception details | Manual | | |
| MATCHED | PENDING_PAYMENT | S3 schedules payment | Manual | | INV-M-004 |
| PENDING_PAYMENT | PAID | S3 records payment OR ERP sync | Manual/Auto | Payment reference required | |
| PENDING_PAYMENT | PENDING_PAYMENT | S3 reschedule payment | Manual | | |
| CANCELLED | — | Terminal | | | |
| MATCH_FAILED | MATCHING | S3 or system retries | Manual/Auto | | |

### 5.5 Forbidden Transitions

| From | To | Why Forbidden |
|---|---|---|
| RECEIVED | PAID | Skips matching entirely — financial control breach |
| RECEIVED | PENDING_PAYMENT | Must be matched first |
| EXCEPTION | PENDING_PAYMENT | Exception must be resolved to MATCHED first |
| EXCEPTION | PAID | Must be matched then scheduled |
| PAID | ANY | Terminal state. Reversal handled by credit note (new invoice) |
| CANCELLED | ANY | Terminal state |

### 5.6 Error States and Recovery

| Error | Detection | Cause | Recovery |
|---|---|---|---|
| **MATCH_FAILED** | InvoiceMatchingService exception | ERP unavailable, PO data corrupted, system error | Auto-retry (3 attempts). After 3 failures, notify S3 for manual matching. |

---

## 6. Task State Machine

### 6.1 Purpose

Manage manual work items assigned to users. Tasks are used for ad-hoc activities outside the main renewal workflow (e.g., "Follow up with Oracle on revised quote," "Verify license usage with department head").

### 6.2 Diagram

```
[User or system creates task]
        │
        ▼
  ┌──────────┐
  │ PENDING  │  (unassigned — only for system-created tasks)
  └────┬─────┘
       │ [S1 assigns]
       ▼
  ┌───────────┐
  │ ASSIGNED  │◄──── (reassign)
  └─────┬─────┘
        │ [Assignee starts work]
        ▼
  ┌────────────┐
  │ IN_PROGRESS│◄──── (reopen)
  └─────┬──────┘
        │ [Assignee marks complete]
        ▼
  ┌───────────┐
  │ COMPLETED │  Terminal (success)
  └───────────┘

  INTERRUPT / ERROR:

  ┌───────────┐
  │ CANCELLED │  Terminal — abandoned
  └───────────┘

  ┌──────────┐
  │ OVERDUE  │  Warning — past due_date without completion
  └─────┬────┘
        │ [Entity remains in current state, flagged]
        ▼
  ┌──────────────┐  (same state, overdue flag = true)
  │ IN_PROGRESS  │
  │ (overdue)    │
  └──────────────┘
```

### 6.3 State Table

| State | Category | Description | Entry Action | Exit Action |
|---|---|---|---|---|
| **PENDING** | Initial | Task created, not yet assigned | Set `created_at`. If system-created, check auto-assignment rules. | None. |
| **ASSIGNED** | Active | Task assigned to user | Set `assigned_at`. Notify assignee. Start SLA timer if due_date set. | Clear assignment timer. |
| **IN_PROGRESS** | Active | Assignee has started work | Set `started_at`. | None. |
| **COMPLETED** | Terminal (success) | Work finished | Set `completed_at`. Log completion. Notify creator. | — |
| **CANCELLED** | Terminal | Task abandoned | Log reason. Notify stakeholders. | — |
| **OVERDUE** | Warning | Past due_date (flag on ASSIGNED or IN_PROGRESS) | Set `overdue_flag = true`. Notify assignee and S1. Flag clears on completion. | — |

### 6.4 Transition Table

| From | To | Trigger | Automation | Conditions | Validation |
|---|---|---|---|---|---|
| PENDING | ASSIGNED | S1 assigns OR auto-assign rule matches | Manual/Auto | | TSK-M-001 |
| PENDING | CANCELLED | S1 cancels | Manual | Reason | |
| ASSIGNED | IN_PROGRESS | Assignee starts | Manual | | |
| ASSIGNED | ASSIGNED | Reassign to different user | Manual | | |
| ASSIGNED | CANCELLED | S1 cancels | Manual | Reason | |
| ASSIGNED | OVERDUE | due_date passed | Automatic | | |
| IN_PROGRESS | COMPLETED | Assignee completes | Manual | | TSK-M-003 |
| IN_PROGRESS | ASSIGNED | Return to assigned (not ready) | Manual | | |
| IN_PROGRESS | CANCELLED | S1/assignee cancels | Manual | Reason | |
| IN_PROGRESS | OVERDUE | due_date passed | Automatic | | |
| OVERDUE (any state) | (same state) | due_date extended | Manual | New due_date must be future | |
| COMPLETED | IN_PROGRESS | Re-open | Manual | Reason for re-opening | TSK-M-003 override |

### 6.5 Forbidden Transitions

| From | To | Why Forbidden |
|---|---|---|
| PENDING | IN_PROGRESS | Must be assigned first |
| PENDING | COMPLETED | Cannot complete an unassigned task |
| COMPLETED | ASSIGNED | Re-open goes to IN_PROGRESS, not ASSIGNED |
| CANCELLED | ANY | Terminal state |

---

## 7. Approval State Machine

### 7.1 Purpose

Track a single approval decision within a renewal's approval chain. Each approval step in the chain is an independent ApprovalRecord with its own lifecycle.

### 7.2 Diagram

```
[Approval step created by ApprovalRoutingService]
        │
        ▼
  ┌──────────┐
  │ PENDING  │◄──── (reminder sent)
  └─────┬────┘
        │
   ┌────┴──────┐
   ▼           ▼
┌────────┐┌──────────┐
│APPROVED││ REJECTED │  Terminal (decision made)
└────────┘└──────────┘

  INTERRUPT / ERROR:

┌───────────┐
│ DEFERRED  │  Approver needs more time/info
└─────┬─────┘
      │ [Approver returns]
      ▼
┌──────────┐
│ PENDING  │
└──────────┘

┌────────────┐
│ CANCELLED  │  Approval chain changed — step no longer needed
└────────────┘

┌────────────┐
│ ESCALATED  │  Step moved to higher authority
└──────┬─────┘
       │ [Escalation target decides]
       ▼
┌────────┐┌──────────┐
│APPROVED││ REJECTED │
└────────┘└──────────┘
```

### 7.3 State Table

| State | Category | Description | Entry Action | Exit Action |
|---|---|---|---|---|
| **PENDING** | Initial | Awaiting approver's decision | Notify approver. Start SLA timer. Set `sla_deadline`. | Clear SLA timer. |
| **APPROVED** | Terminal (success) | Approver approved | Set `decided_at`. Log decision. Check chain completion. Trigger next step or domain event. | — |
| **REJECTED** | Terminal (fail) | Approver rejected | Set `decided_at`. Log reason. Trigger rejection workflow. | — |
| **DEFERRED** | Interrupt | Approver postponed decision | Set `deferred_at`, `deferred_reason`, `deferred_until`. Pause SLA timer. Notify S1. | Resume SLA timer. |
| **CANCELLED** | Terminal | Approval step removed | Log reason and who cancelled. | — |
| **ESCALATED** | Terminal | Step escalated to higher authority | Log escalation. Notify escalation target. Original approver's responsibility ends. | — |

### 7.4 Transition Table

| From | To | Trigger | Automation | Conditions | Validation |
|---|---|---|---|---|---|
| PENDING | APPROVED | Approver approves | Manual | | APR-M-001, APR-M-004 |
| PENDING | REJECTED | Approver rejects | Manual | Comments required | APR-M-002 |
| PENDING | DEFERRED | Approver defers | Manual | Reason + future date | |
| PENDING | CANCELLED | S1 or system cancels step | Manual/Auto | | |
| PENDING | ESCALATED | SLA breach + escalation rule | Automatic | escalation_count < 4 | RNW-M-010 |
| DEFERRED | PENDING | Deferral period ends OR approver returns early | Manual/Auto | | |
| DEFERRED | CANCELLED | S1 cancels | Manual | | |
| ESCALATED | APPROVED | Escalation target approves | Manual | | |
| ESCALATED | REJECTED | Escalation target rejects | Manual | Comments | |

### 7.5 Forbidden Transitions

| From | To | Why Forbidden |
|---|---|---|
| PENDING | PENDING | (No self-loop — state change requires action) |
| APPROVED | ANY | Terminal state |
| REJECTED | ANY | Terminal state |
| APPROVED | REJECTED | Cannot reverse an approval |
| REJECTED | APPROVED | Cannot reverse a rejection (must create new approval) |
| ESCALATED | PENDING | Escalation is terminal for the original approver |

---

## 8. Document State Machine

### 8.1 Purpose

Manage the lifecycle of an uploaded document from upload through processing to availability, with error handling for failed uploads or processing.

### 8.2 Diagram

```
[User uploads file]
        │
        ▼
  ┌────────────┐
  │ UPLOADING  │  (transient — file transfer in progress)
  └─────┬──────┘
        │ [Upload completes]
        ▼
  ┌────────────┐
  │ UPLOADED   │  (file stored, awaiting processing)
  └─────┬──────┘
        │ [System processes: virus scan, OCR, indexing]
        ▼
  ┌────────────┐
  │ PROCESSING │  (transient)
  └─────┬──────┘
        │ [Processing succeeds]
        ▼
  ┌──────────┐
  │  READY   │  (available for viewing/download)
  └─────┬────┘
        │ [Retention period expires]
        ▼
  ┌───────────┐
  │ ARCHIVED  │  (cold storage)
  └─────┬─────┘
        │ [Retention + grace period expires]
        ▼
  ┌───────────┐
  │  DELETED  │  Terminal
  └───────────┘

  ERROR STATES:

  ┌──────────────┐
  │ UPLOAD_FAILED│  Network error, file too large, invalid type
  └──────┬───────┘
         │ [User retries]
         ▼
  ┌────────────┐
  │ UPLOADING  │
  └────────────┘

  ┌──────────────────┐
  │ PROCESS_FAILED   │  Virus detected, OCR failed, corrupt file
  └────────┬─────────┘
           │ [Admin reviews]
           ▼
  ┌──────────┐  ┌───────────┐
  │  READY   │  │  DELETED  │  (quarantine)
  └──────────┘  └───────────┘
```

### 8.3 State Table

| State | Category | Description | Entry Action | Exit Action |
|---|---|---|---|---|
| **UPLOADING** | Processing (transient) | File transfer in progress | Create temporary storage. Track progress. | Clean up temp storage if not completed. |
| **UPLOADED** | Initial | File stored, pending processing | Store file metadata. Trigger processing pipeline. | None. |
| **PROCESSING** | Processing (transient) | System processing (virus scan, OCR, indexing) | Run processing pipeline. | None. |
| **READY** | Active | Document available for use | Notify uploader. Make available in UI. | None. |
| **ARCHIVED** | Terminal (cold) | Document moved to cold storage per retention policy | Move to archive storage. Update URL. Log archival. | — |
| **DELETED** | Terminal | Document permanently removed | Hard delete file and metadata. Log deletion. | — |
| **UPLOAD_FAILED** | Error | Upload did not complete | Log error reason. Notify uploader. | — |
| **PROCESS_FAILED** | Error | Processing pipeline failed | Log error. Notify admin. Quarantine file. | — |

### 8.4 Transition Table

| From | To | Trigger | Automation | Conditions | Validation |
|---|---|---|---|---|---|
| UPLOADING | UPLOADED | Upload completes | Automatic | File size, type valid | DOC-M-002, DOC-M-003 |
| UPLOADING | UPLOAD_FAILED | Upload error (timeout, connection lost) | Automatic | | |
| UPLOADED | PROCESSING | Upload verified | Automatic | | |
| UPLOADED | UPLOAD_FAILED | File corrupt after storage | Automatic | | |
| PROCESSING | READY | Processing succeeds | Automatic | | |
| PROCESSING | PROCESS_FAILED | Processing error | Automatic | | |
| READY | ARCHIVED | Retention period expires | Scheduled | | DOC-C-003 |
| READY | READY | Document metadata updated | Manual | | |
| READY | DELETED | User or admin deletes | Manual | Reason, confirmation | |
| ARCHIVED | DELETED | Retention + grace period expires | Scheduled | | |
| UPLOAD_FAILED | UPLOADING | User retries | Manual | | |
| PROCESS_FAILED | READY | Admin overrides (e.g., false virus positive) | Manual | | |
| PROCESS_FAILED | DELETED | Admin deletes quarantined file | Manual | Reason | |

### 8.5 Forbidden Transitions

| From | To | Why Forbidden |
|---|---|---|
| UPLOADING | READY | Must go through PROCESSING |
| UPLOADED | READY | Processing not completed |
| DELETED | ANY | Terminal state |
| PROCESS_FAILED | ARCHIVED | File not ready for archive |

### 8.6 Error States and Recovery

| Error | Detection | Cause | Recovery |
|---|---|---|---|
| **UPLOAD_FAILED** | Upload handler timeout or error callback | Network interruption, file too large, invalid MIME type, storage full | User retries via upload form. Previous partial upload is cleaned up. |
| **PROCESS_FAILED** | Processing pipeline exception | Virus detected, corrupt file, OCR timeout, out of memory | Admin reviews in "Quarantine" queue. Can force-approve to READY (e.g., false positive) or delete. |

---

## 9. Cross-Entity State Dependencies

| Source Entity | Source State | Target Entity | Target State | Dependency Type |
|---|---|---|---|---|
| Contract | ACTIVE | Renewal | PENDING_REVIEW | Creates Renewal when end_date enters window |
| Renewal | BUSINESS_APPROVED | PurchaseOrder | DRAFT | System creates PO draft |
| Renewal | INVOICE_MATCHED | — | COMPLETE | Renewal completes when invoice matched |
| PurchaseOrder | ACKNOWLEDGED | Invoice | MATCHED | Invoice can only match against acknowledged PO |
| ApprovalRecord | APPROVED (all steps) | Renewal | BUSINESS_APPROVED | All approval steps must be approved for renewal to advance |
| ApprovalRecord | APPROVED | Renewal | (next state) | Each approval advances renewal to next state |
| UsageAttestation | valid (not expired) | Renewal | BUSINESS_APPROVAL | Renewal cannot enter BUSINESS_APPROVAL without valid attestation |
| Contract | TERMINATED | Renewal (active) | CANCELLED | Active renewals are cancelled when contract is terminated |
| Task | COMPLETED | Renewal | — | Task completion may trigger renewal action (advisory, not enforced) |

---

## 10. State Machine Governance

### 10.1 Audit Requirements

Every state transition across all seven entities MUST:
1. Record an ActivityLog entry with: entity_type, entity_id, from_state, to_state, action, performed_by, performed_at, changed_fields
2. Include a human-readable reason for manual transitions
3. Include the system context (job name, API endpoint) for automatic transitions

### 10.2 Idempotency

State transition endpoints (POST `/renewals/:id/approve`, etc.) must be idempotent:
- First call: performs the transition, returns 200
- Subsequent calls: return 200 with current state (no transition performed)
- Different transition from same endpoint: return 409 (invalid transition)

### 10.3 Concurrency

- State transitions use optimistic locking (`updated_at` or version column)
- If two users attempt to transition the same entity simultaneously, the second receives a 409 Conflict and must retry
- Automatic transitions (scheduled jobs) use `SELECT ... FOR UPDATE` to prevent double-processing

### 10.4 Override Protocol

When a mandatory rule prevents a transition that must proceed:
1. The override must be performed by a user with sufficient authority (per Decision Authority Matrix in `docs/02-business/stakeholders.md`)
2. The override reason must be documented
3. The override is logged in the ActivityLog as a distinct event type (`state_transition_override`)
4. The override is reported in the compliance dashboard

---

## 11. Complete State Transition Inventory

| Entity | States | Transitions | Error States |
|---|---|---|---|
| Contract | 6 | 12 | 1 (INCONSISTENT) |
| Renewal | 20 | 58 | 1 (STALLED) + substates |
| Purchase Order | 9 | 16 | 2 (SEND_FAILED, ACK_OVERDUE) |
| Invoice | 8 | 17 | 1 (MATCH_FAILED) |
| Task | 6 | 14 | 1 (OVERDUE) |
| Approval | 6 | 12 | — |
| Document | 8 | 14 | 2 (UPLOAD_FAILED, PROCESS_FAILED) |
| **Total** | **63** | **143** | **8** |

