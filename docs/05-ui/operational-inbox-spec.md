# Atlas Operational Inbox

**Status:** Draft (Sprint 2)
**Date:** 2026-07-20
**Purpose:** The system assigns work to users. Users do not hunt for work.

---

## Design Philosophy

Mission Control tells you what's happening. The Operational Inbox tells you what you need to do.

**Key distinction:**
- **Dashboard / Mission Control** — passive awareness. Shows state of the world.
- **Operational Inbox** — active assignment. Shows what you, specifically, must act on.

The Inbox is the default landing page for all users. It replaces the notion of "dashboard as homepage."

---

## How Items Enter the Inbox

Items are created by **policies reacting to events**:

```
Domain Event
  └── Policy (detects action needed)
        └── CreateInboxItem command
              ├── assignee_id (user or role)
              ├── priority (critical, high, medium, low)
              ├── due_at (deadline)
              ├── source (contract_id, renewal_id, etc.)
              └── action (what the user must do)
```

No code ever writes directly to the Inbox. It is always a policy decision.

### Example: Renewal Stalled

```
Event: renewal.stalled
  └── StalledEscalationPolicy
        └── CreateInboxItem
              ├── assignee: renewal.assignee
              ├── priority: high
              ├── due_at: NOW + 24h
              ├── title: "Renewal RC-224 is stalled"
              ├── description: "No progress in 7 days. Vendor waiting."
              └── action: { type: "open_renewal", renewal_id: 224 }
```

### Example: Approval Overdue

```
Event: renewal.sla.breached
  └── SLABreachPolicy
        └── CreateInboxItem
              ├── assignee: approval.approver
              ├── priority: critical
              ├── due_at: NOW
              ├── title: "Contract 5532 approval overdue"
              └── action: { type: "approve_renewal", renewal_id: 89 }
```

### Example: Invoice Needs Review

```
Event: invoice.exception.created
  └── InvoiceExceptionPolicy
        └── CreateInboxItem
              ├── assignee: finance_manager role
              ├── priority: medium
              ├── title: "Invoice 8391 — price variance detected"
              └── action: { type: "review_invoice", invoice_id: 8391 }
```

### Example: PO Missing Acknowledgement

```
Event: po.ack_overdue
  └── POFollowUpPolicy
        └── CreateInboxItem
              ├── assignee: procurement role
              ├── priority: high
              ├── title: "PO-2026-001 not acknowledged by vendor"
              └── action: { type: "follow_up_po", po_id: 42, vendor_id: 5 }
```

---

## Inbox Item Schema

```json
{
  "inbox_item_id": "ii_abc123",
  "title": "Renewal RC-224 is stalled",
  "description": "No progress in 7 days. Vendor is waiting for quote response.",
  "priority": "high",
  "status": "open",
  "created_at": "2026-07-20T08:00:00Z",
  "due_at": "2026-07-21T08:00:00Z",
  "completed_at": null,
  "source": {
    "type": "renewal",
    "id": 224,
    "label": "RC-224 — Microsoft EA Renewal"
  },
  "assignee": {
    "user_id": 7,
    "name": "Alice Chen"
  },
  "action": {
    "type": "open_renewal",
    "label": "Open Renewal",
    "url": "/renewals/224"
  },
  "category": "action_required",
  "policy_name": "StalledEscalationPolicy",
  "event_id": "evt_renewal.stalled_42"
}
```

### Statuses

| Status | Meaning | Available Actions |
|---|---|---|
| `open` | New, unacknowledged | acknowledge, dismiss |
| `acknowledged` | User has seen it | start, snooze, dismiss |
| `in_progress` | User is working on it | complete, dismiss |
| `completed` | Action has been taken (auto or manual) | reopen |
| `dismissed` | User chose to ignore | reopen |
| `expired` | Due date passed without action | reopen |

### Priority Levels

| Priority | Color | SLA |
|---|---|---|
| `critical` | Red | Act within 2 hours |
| `high` | Orange | Act within 24 hours |
| `medium` | Yellow | Act within 3 days |
| `low` | Blue | Act within 7 days |

---

## Inbox UI (User's View)

```
┌────────────────────────────────────────────────────────────────────┐
│  📥 My Operational Inbox          [Filter ▼] [Sort ▼] [⚙ Settings] │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 🔴 Expired │ PO-2026-001 not acknowledged by vendor         │  │
│  │            │ ⏰ Due 2h ago • Vendor: Microsoft Corp          │  │
│  │            │ [Acknowledge] [Open PO] [Dismiss]              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 🟠 High    │ Renewal RC-224 stalled — vendor waiting        │  │
│  │            │ ⏰ Due in 22h • Alice Chen (you)                │  │
│  │            │ [Acknowledge] [Open Renewal] [Dismiss]         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 🟡 Medium  │ Invoice 8391 — price variance detected         │  │
│  │            │ ⏰ Due in 3d • Finance Review Required          │  │
│  │            │ [Acknowledge] [Review Invoice] [Dismiss]       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 🔵 Low     │ Contract 5532 — renewal approaching (60 days)  │  │
│  │            │ ⏰ Due in 7d • Plan renewal strategy            │  │
│  │            │ [Acknowledge] [View Contract] [Dismiss]        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  [Show 12 more...]                                                  │
└────────────────────────────────────────────────────────────────────┘
```

### Grouping

User can group items by:
- Priority (default)
- Category (action_required, approval, review, info)
- Source aggregate (contract, renewal, po, invoice)
- Due date (today, this week, this month, overdue)

### Filtering

| Filter | Options |
|---|---|
| Status | open, acknowledged, in_progress, completed, dismissed, expired |
| Priority | critical, high, medium, low |
| Category | action_required, approval, review, info |
| Source | contract, renewal, po, invoice, document |
| Date range | custom |

### Notifications

- Browser push notification on new critical/high items
- Daily email digest of all open items
- Slack/Teams webhook for critical items (configurable)

---

## Inbox by Role

| Role | Typical Items |
|---|---|
| S1 — Contract Owner | Renewals starting, contracts expiring, approval requests |
| S2 — Procurement | PO acknowledgments, vendor follow-ups, quote reviews |
| S3 — Finance | Invoice exceptions, payment approvals, budget reviews |
| S4 — Legal | Contract reviews, legal approvals, clause requests |
| S5 — Business Owner | Approval requests, escalation notices |
| S6 — Vendor Manager | Vendor risk changes, negotiation items |
| Admin | System health items, inconsistency resolutions |

---

## Inbox Item Lifecycle

```
Event occurs
  └── Policy detects action needed
        └── CreateInboxItem (status: open)
              ├── User acknowledges → acknowledged
              ├── User starts working → in_progress
              ├── User completes → completed (see below)
              ├── User dismisses → dismissed
              ├── Due date passes → expired
              └── Related event resolves item → completed (auto)

Auto-completion triggers:
- renewal.legal.approved → closes "Legal review needed" items
- po.acknowledged → closes "PO not acknowledged" items
- invoice.exception.resolved → closes "Invoice exception" items
- renewal.resumed → closes "Renewal stalled" items
```

### Snooze

User can snooze an item for a specific duration:
- 1 hour
- 4 hours
- Tomorrow
- Next week
- Custom date

Snoozed items reappear at the specified time with an "overdue" indicator if past the original due_at.

---

## Inbox vs. Other Interfaces

| Interface | Purpose | Audience |
|---|---|---|
| **Operational Inbox** | "What do I need to do?" | All users (default homepage) |
| **Mission Control** | "What is happening?" | Managers, directors |
| **Contract Workspace** | "Tell me about this contract" | Anyone viewing a contract |
| **Renewal Workspace** | "Tell me about this renewal" | Anyone viewing a renewal |
| **Reports & Analytics** | "What are the trends?" | Directors, executives |

---

## Inbox Items Per Aggregate

### Contract-Generated Items

| Trigger Event | Policy | Inbox Item |
|---|---|---|
| `contract.expired` | ExpiryNotificationPolicy | "Contract {name} has expired. Review and archive." |
| `contract.renewal_window_opened` | RenewalDetectionPolicy | "Contract {name} renewal window is open." |
| `contract.health.changed` → Warning | HealthWarningPolicy | "Contract {name} needs attention ({reason})." |
| `contract.health.changed` → Critical | HealthCriticalPolicy | "Contract {name} is critical — expiring within 7 days." |

### Renewal-Generated Items

| Trigger Event | Policy | Inbox Item |
|---|---|---|
| `renewal.stalled` | StalledEscalationPolicy | "Renewal {id} is stalled — vendor waiting." |
| `renewal.sla.breached` | SLABreachPolicy | "Approval overdue for renewal {id}." |
| `renewal.legal.review_started` | LegalReviewPolicy | "Legal review needed for renewal {id}." |
| `renewal.budget.review_needed` | BudgetReviewPolicy | "Budget review needed for renewal {id}." |
| `renewal.attestation.expired` | AttestationPolicy | "Attestation expired for renewal {id}. Please re-attest." |
| `renewal.risk.changed` → high | RiskAlertPolicy | "Risk level increased for renewal {id}." |

### PO-Generated Items

| Trigger Event | Policy | Inbox Item |
|---|---|---|
| `po.send_failed` | POSendFailurePolicy | "PO {number} failed to send. Retry or contact vendor." |
| `po.ack_overdue` | POFollowUpPolicy | "PO {number} not acknowledged by vendor." |
| `po.rejected` | PORejectionPolicy | "PO {number} rejected by vendor. Review and respond." |

### Invoice-Generated Items

| Trigger Event | Policy | Inbox Item |
|---|---|---|
| `invoice.exception.created` | InvoiceExceptionPolicy | "Invoice {number} has an exception: {reason}." |
| `invoice.payment.done` | PaymentConfirmationPolicy | "Payment confirmed for invoice {number}." |

### System-Generated Items

| Trigger Event | Policy | Inbox Item |
|---|---|---|
| `system.health.failed` | HealthAlertPolicy | "System health check failed: {service}." |
| `system.integration.sync.failed` | SyncFailurePolicy | "ERP sync failed. Manual intervention required." |
| `contract.marked_inconsistent` | InconsistencyPolicy | "Contract {name} has data integrity issues." |

---

## Inbox Metrics (for dashboards)

| Metric | What It Measures |
|---|---|
| Items created per day | Work volume |
| Items completed per day | Work throughput |
| Average time to acknowledge | User responsiveness |
| Average time to complete | Cycle time |
| Items past due | Backlog health |
| Auto-completed vs. manual | Policy effectiveness |
| Snooze rate | Item relevance |
| Dismiss rate | False positive rate |

---

## Technical Notes

- Inbox is a **projection** of the event store, filtered by policies
- Each policy registers which events it creates inbox items for
- Inbox items are **immutable** once created (except status)
- Deleting an inbox item is not allowed — only dismiss (soft)
- Inbox supports **real-time updates** via WebSocket/SSE
- Backend: dedicated `inbox_item` table, indexed by `assignee_id + status`
- Volume estimate: ~10 inbox items per user per day, ~300 per month
- Retention: items auto-archive 30 days after completion/dismissal
