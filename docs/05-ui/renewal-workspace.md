# Renewal Workspace

## Document Control

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-07-20 | Principal UX Architect | Complete Renewal Workspace specification |

---

## 0. Why the Renewal Workspace Is the Flagship

The Renewal is Muraai's core domain entity. Every other entity exists to serve it:

| Entity | Relationship to Renewal |
|---|---|
| **Contract** | Source — the renewal is *of* a contract |
| **Vendor** | Counterparty — the renewal is *with* a vendor |
| **Product** | Contents — the renewal covers *what* |
| **Purchase Order** | Output — the renewal produces a PO |
| **Invoice** | Resolution — the renewal completes when the invoice is matched |
| **ApprovalRecord** | Governance — the renewal requires decisions |
| **Task** | Friction — stalled renewals generate tasks |
| **ActivityLog** | Evidence — every renewal transition is logged |
| **Notification** | Coordination — stakeholders are informed |
| **PolicyRule** | Configuration — the renewal's path is governed by rules |

The Renewal Workspace is the place where **all 12 stakeholder types** converge. A Procurement Specialist executes quotes here. A Legal Counsel reviews terms here. A Business Owner approves spend here. A Financial Analyst matches invoices here. An Auditor verifies controls here.

Every panel exists to answer one question for one stakeholder at one point in the renewal lifecycle.

---

### Layout Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER (64px)                                                                │
│ RNW-4123 · 2026 Renewal                                        ● Active     │
│ Oracle DB EE · Oracle Corporation · $250,000 · Ends Mar 14, 2027            │
│                                                                              │
│ Status: PENDING_REVIEW    |    Priority: HIGH    |    Aging: 12 days        │
├──────────────────────────────────────────────────────────────────────────────┤
│ PROGRESS TRACKER (full-width, 120px)                                         │
│ [● Pending Review] ── [○ Assigned] ── [○ Quote] ── [○ Budget] ── [○ Legal] │
│   ↑ You are here                                          [○ BizApp] ── ○   │
├──────────────────────────────────────────────────────────────────────────────┤
│ QUAD GRID — 4 panels always visible                                           │
│ ┌─────────────────────────┐ ┌─────────────────────────┐                      │
│ │ SLA STATUS (1/4 width)  │ │ RISK SCORE (1/4 width)  │                      │
│ │ ● Legal Review          │ │ ● Overall: Medium      │                      │
│ │   ⏳ 2d 4h remaining    │ │   Price: Low           │                      │
│ │ ● Business Approval     │ │   Terms: High          │                      │
│ │   ⏸ Awaiting step 1     │ │   Budget: Medium       │                      │
│ │ ● Budget Validation     │ │   Vendor: Low          │                      │
│ │   ✓ Complete             │ │                        │                      │
│ └─────────────────────────┘ └─────────────────────────┘                      │
│ ┌─────────────────────────┐ ┌─────────────────────────┐                      │
│ │ ACTIONS (contextual)    │ │ KEY INFO (1/4 width)    │                      │
│ │ [Assign] [Hold] [Cancel]│ │ Contract: MCR-2026-142  │                      │
│ │ [Add Note] [⋮]          │ │ Vendor: Oracle Corp     │                      │
│ │                         │ │ Quote: Awaiting         │                      │
│ │                         │ │ Budget: $250,000 code   │                      │
│ └─────────────────────────┘ └─────────────────────────┘                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ SECTION TABS                                                                    │
│ │ Timeline │ Approvals │ Vendor Resp │ Cust Resp │ Documents │ PO │ ... │   │
├──────────────────────────────────────────────────────────────────────────────┤
│ CONTENT AREA (scrollable, full remaining height)                              │
│ [Active section content]                                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ DETAIL PANEL (slide-over, 480-640px) — opens on demand                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Header Zone

### Elements

| Element | Purpose | Why It Exists |
|---|---|---|
| **Renewal ID + Year** | Primary identity. "RNW-4123" is the canonical reference across all systems, emails, and notifications. | Every stakeholder needs a single unambiguous identifier when referencing the renewal. Monospace for scannability. |
| **Status Badge** | Current position in the 20-state machine. Color-coded per design system. | **State Over Status (Constitution §1).** The badge tells every stakeholder, at a glance, exactly where the renewal is. Clicking opens the full state machine diagram with transition history. |
| **Contract + Vendor + Value + End Date** | Contextual breadcrumb without navigation. | A Renewals Manager processing 50 renewals cannot remember every contract name. This row eliminates "which contract was this again?" without requiring a click. |
| **Aging** | Days since creation. Red if >30. | **Exception-Led Design (IA §1).** Aging is the single best predictor of stalled renewals. Surface it immediately. |

---

## 2. Progress Tracker

### What It Shows

A horizontal, multi-stage progress bar mapping to the Renewal state machine:

```
       ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
       │ PENDING  │──▶│ASSIGNED  │──▶│  QUOTE   │──▶│  BUDGET  │──▶│  LEGAL   │──▶⋯
       │ REVIEW   │   │          │   │ RECEIVED │   │  CHECK   │   │  REVIEW  │
       └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
           ●              ○              ○              ○              ○
        Completed      Current        Skipped        Future         Future
         (green)      (blue,         (gray,         (gray)         (gray)
                      pulsing)       strikethrough)
```

### State Encoding

| Visual | Meaning |
|---|---|
| **● Green checkmark** | Completed successfully |
| **● Blue pulsing** | Current position |
| **○ Gray circle** | Future state not yet reached |
| **○ Gray strikethrough** | Skipped (e.g., Legal Review skipped if value < threshold and terms unchanged) |
| **✗ Red X** | Failed — for error states (STALLED, BUDGET_REVIEW with unrecoverable failure) |
| **⏸ Amber pause** | Current state is ON_HOLD |
| **⚠ Amber exclamation** | Current state is ESCALATED |

### Interaction

- **Hover any node** → Tooltip: "ASSIGNED — 14 days in this state. Assigned to Sarah Chen on Jul 6."
- **Click any completed node** → Opens timeline filter to that transition, showing who, when, and what changed.
- **Click any future node** → Tooltip shows entry criteria: "Requires: Quote received + Budget approved."

### Why This Panel Exists

**Primary stakeholder: S1 (Renewals Manager).**

The progress tracker answers the #1 question S1 asks 50 times per day: *"Where is this renewal?"* In 2 seconds, without reading a single word, S1 knows the exact state, how far the renewal has come, and how far it has to go. It also surfaces anomalies: a skipped legal step (strikethrough) tells S1 the value is under threshold; an amber pause tells them the renewal is stuck.

---

## 3. SLA Panel

### What It Shows

A compact list of all approval/action SLAs for this renewal:

```
┌──────────────────────────────────────────────────────────────┐
│ SLA STATUS                                          [∎]    │
│                                                            │
│ ● LEGAL REVIEW                          ⏳ 2d 4h remaining │
│   Jane Smith (S4)                                          │
│                                                            │
│ ● BUSINESS APPROVAL                    ⏸ Awaiting step 1  │
│   Mark Lee (S5)                                            │
│                                                            │
│ ● BUDGET VALIDATION                        ✓ Complete      │
│   Auto-approved Jul 18, 2026                                │
│                                                            │
│ ● QUOTE COLLECTION                         ✓ Complete      │
│   Sarah Chen entered quote Jul 16, 2026                    │
│                                                            │
│ ● ASSIGNMENT                               ✓ Complete      │
│   S1 → Sarah Chen on Jul 6, 2026                           │
└──────────────────────────────────────────────────────────────┘
```

### SLA States

| State | Color | Text |
|---|---|---|
| **On track** | Green | "2d 4h remaining" |
| **At risk (< 24h)** | Amber | "4h 30m remaining" |
| **Breached** | Red | "Overdue by 2h" |
| **Completed** | Green | "✓ Complete" |
| **Waiting (blocked)** | Gray | "⏸ Awaiting step 1" |
| **Skipped** | Gray strikethrough | "— Not required" |

### Interaction

- **Hover an SLA row** → Tooltip shows deadline, creation time, reminder count, escalation level.
- **Click an SLA row** → Opens the Approval detail panel or Task detail.
- **[∎] icon** → Opens SLA configuration: who set it, what policy rule determined it, can it be extended (admin only).

### Why This Panel Exists

**Primary stakeholders: S1 (Renewals Manager), S7/S8 (Executives).**

S1's job is triage. The SLA panel answers: *"What is going to blow up next?"* Without this panel, S1 must click into each approval step to find the deadline. With it, S1 scans in 3 seconds which renewal needs intervention. For S7/S8, the SLA panel is their confidence indicator — if all SLAs are green, the process is under control. Red SLAs mean governance failure.

**SLA visibility is not a feature. It is the control mechanism that makes the platform enterprise-grade.** Without it, SLAs are just database fields that no one monitors.

---

## 4. Risk Score

### What It Shows

Calculated composite risk score with dimension breakdown:

```
┌──────────────────────────────────────────────────────────────┐
│ RISK SCORE                                           [∎]   │
│                                                            │
│          ┌──────────────────────────────────────┐          │
│          │              ●                        │          │
│          │         MEDIUM                        │          │
│          │          6.2 / 10                     │          │
│          └──────────────────────────────────────┘          │
│                                                            │
│ Dimensions:                                                 │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Price Risk     │ ●●○○○ Low    │ Quote $250K vs avg    │ │
│ │ Terms Risk     │ ●●●●○ High   │ Clause deviation: 2   │ │
│ │ Budget Risk    │ ●●●○○ Med    │ Code has $180K avail  │ │
│ │ Vendor Risk    │ ●●○○○ Low    │ Tier: Strategic       │ │
│ │ Timing Risk    │ ●●●○○ Med    │ 45d to end_date      │ │
│ │ Attestation    │ ●●●○○ Med    │ Expired 13mo ago      │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ Risk factors: [View details →]                             │
└──────────────────────────────────────────────────────────────┘
```

### Score Calculation

Composite score (1-10) weighted from dimensions. Configurable via PolicyRules.

| Dimension | Weight (default) | Data Source |
|---|---|---|
| Price Risk | 25% | Quote vs. prior year + market benchmark |
| Terms Risk | 20% | Clause deviation count from standard library |
| Budget Risk | 20% | Budget availability / requested amount |
| Vendor Risk | 15% | Vendor risk_rating + scorecard trend |
| Timing Risk | 10% | Days remaining to end_date |
| Attestation Risk | 10% | Attestation age (>12 months = higher risk) |

### Why This Panel Exists

**Primary stakeholders: S1 (Triage), S7/S8 (Portfolio oversight), S9 (Audit).**

Without risk scoring, every renewal looks the same to an overworked S1. **The renewal with high terms risk and medium budget risk needs more attention than the low-risk renewal, but without scoring, both sit in the same queue.** S1 triages by gut feel — and gut feel misses 30% of at-risk renewals (industry data).

For S7/S8, the risk score aggregates to portfolio-level: "How many renewals are HIGH risk this quarter?" For S9, the scoring methodology is auditable — "was this renewal correctly scored as MEDIUM when it had two clause deviations?"

---

## 5. Timeline

### What It Shows

A chronological, vertical timeline of every state transition the renewal has undergone:

```
┌──────────────────────────────────────────────────────────────┐
│ TIMELINE                                    [Filter ▾]     │
│                                                            │
│ TODAY                                                       │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ ⊙ QUOTE RECEIVED                          10:23 AM    │ │
│ │   Sarah Chen uploaded quote from Oracle Corp           │ │
│ │   Amount: $250,000 | Ref: Q-2026-ORACLE-042           │ │
│ │   [View Quote] [Undo → send back to ASSIGNED]          │ │
│ └────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ ⊙ ASSIGNED                                 Jul 19     │ │
│ │   Sarah Chen assigned by John Doe (S1)                │ │
│ │   [View Assignment]                                    │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ JUL 18, 2026                                                │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ ⊙ PENDING REVIEW → ASSIGNED                  2:30 PM │ │
│ │   John Doe (S1) reviewed and initiated assignment      │ │
│ └────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ ⊙ RENEWAL CREATED                             8:00 AM │ │
│ │   System auto-created from contract MCR-2026-00142     │ │
│ │   End date: Mar 14, 2027 (90-day window triggered)     │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ [Load More]                                                │
└──────────────────────────────────────────────────────────────┘
```

### Interaction

| Element | Behavior |
|---|---|
| **Each transition** | Shows from→to status, who performed it, when, and key metadata (amounts, references). |
| **[View Quote/Assignment]** | Opens the relevant detail panel. |
| **[Undo]** | Only for the most recent transition, only if permitted by state machine. Confirmation: "Return renewal to ASSIGNED? The quote will be retained but marked as historical." |
| **Filter** | By transition type: Status Changes, Approvals, Document Uploads, Notes, All. |

### Why This Panel Exists

**Primary stakeholders: S1 (Process audit), S9 (Compliance), S2 (Context).**

The timeline is the **narrative** of the renewal. It answers: *"How did we get here?"* For S1 and S9, it is the audit trail made readable — no need to cross-reference the activity log. For S2, it provides context when picking up a renewal mid-cycle: "Oh, the quote was already entered on Jul 16 — I just need to trigger budget check."

The timeline *is* the state machine made visible. Without it, the state machine is an abstract concept that only exists in code.

---

## 6. Approvals Section

### What It Shows

Full approval chain with current status per step:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPROVALS (chain: 3 steps)                        [View All Approvals →]    │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ Step │ Type         │ Approver          │ Status   │ SLA           │ Actions │
│ ──────────────────────────────────────────────────────────────────────────── │
│ 1    │ Legal Review │ Jane Smith (S4)   │ ⏳ PEND  │ 2d 4h left    │ [Remind]│
│      │              │                   │          │               │ [⋯]     │
│ 2    │ Business     │ Mark Lee (S5)     │ ⏸ WAIT   │ —             │         │
│      │ Owner        │                   │          │ (step 1 req)  │         │
│ 3    │ CFO          │ If >$200K         │ ⏸ COND   │ —             │         │
│      │              │ (value: $250K)    │          │ (conditional)  │         │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ APPROVAL HISTORY                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Budget Check  │ ✓ Auto-approved │ Jul 18, 2026 │ Amount: $250,000       │ │
│ │ Quote Review  │ ✓ Accepted      │ Jul 16, 2026 │ Vendor: Oracle Corp    │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Why This Panel Exists

**Primary stakeholders: S2 (Needs to know who to chase), S1 (Needs to unblock), S5 (Needs their queue).**

The approval chain is the renewal's **critical path**. Without this panel, the question *"Who is this renewal waiting on?"* requires navigating to each approver's inbox. This panel surfaces the answer instantly — and with SLA timers, tells you *who is about to breach* before they actually breach.

---

## 7. Vendor Response Section

### What It Shows

`┌──────────────────────────────────────────────────────────────────────────────┐
│ VENDOR RESPONSE                                     [Contact Vendor →]      │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ ✅ Quote Received                                    Jul 16, 2026       │ │
│ │ Amount: $250,000 | Ref: Q-2026-ORACLE-042                               │ │
│ │ Document: Oracle_2026_Renewal_Quote.pdf                    [View] [↓]   │ │
│ │ Notes: "Volume discount unchanged at 10% for 500 users."                │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ ⏳ PO Response Pending                                Sent Jul 19, 2026 │ │
│ │ PO-2026-00421 sent to john@oracle.com                                    │ │
│ │ Aging: 3 days without acknowledgment                                     │ │
│ │ [Resend] [Follow Up]                                                     │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ ✓ PO Acknowledged                                    Jul 15, 2026       │ │
│ │ (from prior renewal - reference only)                                    │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ VENDOR CONTACTS                                                               │
│ John Smith — Account Manager                                 [Contact →]    │
│ john.smith@oracle.com | +1-650-555-0123                                      │
│                                                                               │
│ Quote History: [View prior year quotes →]                                    │
└──────────────────────────────────────────────────────────────────────────────┘

### Why This Panel Exists

**Primary stakeholders: S2 (Procurement), S6 (Vendor Manager).**

The vendor response panel answers: *"Has the vendor done their part?"* Without this panel, S2 tracks vendor interactions in their email inbox — completely disconnected from the renewal record. Every vendor touchpoint (quote, PO acknowledgment, follow-up) lives here so the renewal record is the **single source of truth for vendor interaction**, not the specialist's email.

For S6, this panel provides the data for vendor scorecards: "How fast did Oracle respond to the quote request? How quickly did they acknowledge the PO?"

---

## 8. Customer Response Section

### What It Shows

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ CUSTOMER RESPONSE                                    [View All Responses →] │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Usage Attestation                                   ⏳ Pending           │ │
│ │                                                                           │ │
│ │ Mark Lee (S5) — VP Engineering                                           │ │
│ │ SLA: 48h remaining                                                       │ │
│ │ Last attestation: Jun 2025 (expired — 13 months ago)                    │ │
│ │                                                                           │ │
│ │ ╔═══════════════════════════════════════════════════════════╗            │ │
│ │ ║ Is this software still required?      [Yes] [No]         ║            │ │
│ │ ║ Current user count:                   [____] users       ║            │ │
│ │ ║ Planned user changes:                 [____]             ║            │ │
│ │ ║ Alternative considered?               [Yes] [No]         ║            │ │
│ │ ║ Comments:                             [____]             ║            │ │
│ │ ╚═══════════════════════════════════════════════════════════╝            │ │
│ │                                                                           │ │
│ │ [Submit Attestation] [Defer → Hold Renewal]                              │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ ✓ Previous Attestation                                   Mar 2025       │ │
│ │ Mark Lee confirmed 480 users, still required.                            │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Why This Panel Exists

**Primary stakeholder: S5 (Business Owner).**

This is the one panel that S5 cares about — and they care about it exactly once per renewal cycle. Without it, S5 receives an email notification, clicks a link, lands on a generic renewal page, and must hunt for where to attest. **This panel IS the attestation experience.** It presents the form inline, in context, with no navigation required. S5 completes their job in 30 seconds and leaves.

For S1/S2, this panel shows whether the customer (internal Business Owner) has done their part. A pending attestation with 48h remaining is fine. A pending attestation overdue by 2 days needs escalation.

---

## 9. Required Documents Section

### What It Shows

Checklist of documents needed vs. received for this renewal:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ REQUIRED DOCUMENTS                                        [Upload] [Request]│
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ DOCUMENT             │ STATUS      │ SOURCE      │ RECEIVED   │ ACTIONS  │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ Vendor Quote         │ ✅ Received  │ S2 upload   │ Jul 16     │ [View]  │ │
│ │ Contract Signed Copy │ ⏳ Pending   │ Vendor      │ —          │ [Reqst] │ │
│ │ Budget Approval Doc  │ ✓ Not Needed │ —           │ —          │ —       │ │
│ │ Legal Review Doc     │ ⏳ Pending   │ S4 upload   │ —          │ —       │ │
│ │ Usage Attestation    │ ⏳ Pending   │ S5 form     │ —          │ —       │ │
│ │ Purchase Order       │ ⏳ Pending   │ System gen  │ —          │ —       │ │
│ │ Invoice              │ ⏳ Pending   │ Vendor      │ —          │ —       │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ STATUS: 1/7 documents received                                                 │
│ ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │
│ 14% complete                                                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Document Status Legend

| Status | Meaning |
|---|---|
| ✅ Received | Document uploaded and processed |
| ⏳ Pending | Required but not yet received |
| ✓ Not Needed | Skipped by policy (e.g., Budget Approval Doc not needed for auto-approved budgets) |
| ✗ Missing Overdue | Required, past expected receipt date, not received |
| ⚠ Processing | Uploaded but virus scan / OCR in progress |

### Interaction

- **[Request]** → Sends an email to the source (vendor for signed copy, S4 for legal doc) with a secure upload link. Status updates to "⏳ Pending" with tracking.
- **[Upload]** → File picker for manual upload. Document type auto-detected.
- **[View]** → Opens document in slide-over viewer (PDF, image) — no download required for quick review.

### Why This Panel Exists

**Primary stakeholders: S2 (Needs to track what's missing), S1 (Needs to see flow).**

The question this panel answers is: *"What's blocking the renewal?"* Most renewals stall not because of a single decision, but because documents are missing. The vendor hasn't sent the signed contract copy. The legal review document hasn't been uploaded. **Without this panel, S2 tracks document status in their head or in a spreadsheet — both unreliable at scale.** With it, S2 knows exactly what to chase, and the document checklist becomes a progress bar for the non-automatable parts of the renewal.

---

## 10. PO Section

### What It Shows

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ PURCHASE ORDER                           [View All POs →]                   │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Current PO: PO-2026-00421                              Status: ● DRAFT   │ │
│ │ ──────────────────────────────────────────────────────────────────────── │ │
│ │ Vendor: Oracle Corporation                                           │ │
│ │ Total: $250,000                                                       │ │
│ │ Budget Code: IT-SW-MAINT-2026                                         │ │
│ │ Created: Jul 19, 2026 by Sarah Chen                                   │ │
│ │                                                                       │ │
│ │ Line Items:                                                           │ │
│ │ │ Product              │ Qty │ Rate    │ Total                        │ │
│ │ │ Oracle DB EE         │ 500 │ $450.00 │ $225,000                    │ │
│ │ │ Oracle ASM           │ 100 │ $100.00 │ $10,000                     │ │
│ │ │ Oracle RAC           │ 50  │ $200.00 │ $10,000                     │ │
│ │                              Total:    │ $245,000                    │ │
│ │                                                                       │ │
│ │ Actions: [Edit Draft] [Send to Vendor] [Cancel PO]                    │ │
│ │                                                                       │ │
│ │ PO Timeline:                                                          │ │
│ │ ● Draft ──○ Sent ──○ Acknowledged ──○ Complete                       │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ Prior POs (reference):                                                        │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ PO-2025-00312 │ $235,000 │ ✓ Acknowledged │ Mar 5, 2025    [View]       │ │
│ │ PO-2024-00289 │ $220,000 │ ✓ Complete      │ Mar 10, 2024   [View]      │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Why This Panel Exists

**Primary stakeholders: S2 (PO creation), S3 (PO reference for invoice matching).**

The PO is the **output** of the renewal process. This panel answers: *"Has the PO been created, sent, and acknowledged?"* Without it embedded in the renewal workspace, S2 must navigate to a separate PO screen to check status. S3 must open the PO to verify amounts during invoice matching. **Embedding the PO here eliminates cross-navigation for the two most frequent PO interactions.**

---

## 11. Invoice Section

### What It Shows

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ INVOICE                                                    [View All →]     │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Status: ⏳ Awaiting Invoice                                               │ │
│ │                                                                           │ │
│ │ PO Sent: Jul 19, 2026                                                     │ │
│ │ Expected Invoice: Within 30 days of PO acknowledgment                    │ │
│ │ Aging: 3 days since PO sent                                              │ │
│ │                                                                           │ │
│ │ ┌────────────────────────────────────────────────────────────────────┐   │ │
│ │ │ When invoice arrives, it will be auto-matched to PO-2026-00421    │   │ │
│ │ │ Expected amount: $250,000 (±2% tolerance = $5,000)                │   │ │
│ │ └────────────────────────────────────────────────────────────────────┘   │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ Prior Invoices (reference):                                                   │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ INV-2025-04512 │ $235,000 │ ✓ Matched │ Paid Mar 20, 2025  [View]       │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Invoice States Shown

| State | Panel Shows |
|---|---|
| **Awaiting Invoice** | "⏳ Awaiting Invoice" with expected amount and aging since PO sent |
| **Invoice Received (unmatched)** | Invoice details, "🔄 Auto-matching in progress" |
| **Matched** | Match details: variance, matched amount, "✓ Ready for Payment" |
| **Exception** | Variance highlighted, resolution actions: Accept / Request Credit Note / Escalate |
| **Paid** | Payment reference, paid date, "✓ Complete" |

### Why This Panel Exists

**Primary stakeholders: S3 (Invoice matching), S2 (Needs to know PO was invoiced).**

The invoice is the **resolution** of the renewal. Without this panel, S3 must know that a PO exists and proactively look for it. **Embedding the invoice here means S3 can match without ever leaving the renewal context.** For S2, seeing the invoice status tells them the renewal is progressing toward completion.

---

## 12. Tasks Section

### What It Shows

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TASKS (2 open)                                   [Add Task] [View All →]    │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ ○ Follow up on revised quote with Oracle               Due: Jul 25      │ │
│ │   Assigned to: Me (S2)                                Priority: HIGH    │ │
│ │   Created: Jul 19 by System (budget review triggered)  [Complete] [⋯]   │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ ○ Verify license counts with department heads            Due: Jul 20    │ │
│ │   Assigned to: Mark Lee (S5)                            Priority: NORM  │ │
│ │   Created: Jul 18 by Sarah Chen (manual)                 [Complete] [⋯] │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ ✓ Collect usage data from IT Ops                         Completed Jul 17│ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Task Sources

| Source | Trigger | Example |
|---|---|---|
| **Auto-created by system** | Budget review needed | "Follow up on revised quote" |
| **Auto-created by system** | Document processing failed | "Review quarantined document" |
| **Auto-created by system** | Invoice exception | "Resolve invoice variance" |
| **Manually created** | S1/S2 adds ad-hoc work | "Verify license counts" |
| **Derived from SLA** | Approval SLA breached | "Escalate legal review" |

### Why This Panel Exists

**Primary stakeholder: S2 (Execution), S1 (Delegation).**

Tasks are the **friction points** in the renewal process. The ideal state is zero tasks — everything is automated and progresses through the state machine. But in reality, renewals hit exceptions: budget needs review, documents fail processing, vendor contacts need chasing. **Tasks capture these exceptions as actionable items.** Without this panel, exceptions are invisible — they exist only as edge cases in a state that looks like "stuck with no next step."

---

## 13. Emails Section

### What It Shows

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ EMAILS (8)                                              [Compose] [Log Call] │
│ ──────────────────────────────────────────────────────────────────────────── │
│ ┌────────────────────────────────────────────────────────────────────────┐   │
│ │ TODAY                                                                 │   │
│ │ ┌──────────────────────────────────────────────────────────────────┐  │   │
│ │ │ → Sent to John Smith (Oracle)              Re: Quote Request    │  │   │
│ │ │   Hi John, following up on the revised quote for Oracle DB...   │  │   │
│ │ │   10:23 AM                                  [View Thread]       │  │   │
│ │ └──────────────────────────────────────────────────────────────────┘  │   │
│ │ ┌──────────────────────────────────────────────────────────────────┐  │   │
│ │ │ ← From John Smith (Oracle)              Re: Quote Request       │  │   │
│ │ │   Attached: Oracle_2026_Renewal_Quote.pdf                       │  │   │
│ │ │   Hi Sarah, here's the revised quote. Rate is $475/user...      │  │   │
│ │ │   11:45 AM                                  [View Thread]       │  │   │
│ │ └──────────────────────────────────────────────────────────────────┘  │   │
│ └────────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│ ┌────────────────────────────────────────────────────────────────────────┐   │
│ │ YESTERDAY                                                              │   │
│ │ ┌──────────────────────────────────────────────────────────────────┐  │   │
│ │ │ → Sent to John Smith (Oracle)              Re: PO-2026-00421    │  │   │
│ │ │   PO attached. Please review and acknowledge.                   │  │   │
│ │ │   2:00 PM                                  [View Thread]       │  │   │
│ │ └──────────────────────────────────────────────────────────────────┘  │   │
│ └────────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│ Email Integration: ● Connected (vendor@oracle.com)                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Why This Panel Exists

**Primary stakeholders: S2 (Vendor communication), S6 (Relationship history).**

Email is the **medium** through which renewals happen. The quote arrives by email. PO acknowledgment comes by email. Rejection comes by email. **Without this panel, email history is in the specialist's Outlook inbox — invisible to everyone else, lost when the specialist changes roles.** With it, every vendor communication is attached to the renewal record, creating an audit trail and enabling knowledge transfer.

For S6, this panel provides the raw data for relationship analysis: "How many emails did it take to get the quote? Was there a pattern of delays?"

---

## 14. Automation Section

### What It Shows

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ AUTOMATION                                                   [Configure →]  │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ AUTOMATION STATUS                                      RULES APPLIED: 3  │ │
│ │ ──────────────────────────────────────────────────────────────────────── │ │
│ │                                                                           │ │
│ │ ✓ Renewal Auto-Created                    Jul 18, 2026 8:00 AM           │ │
│ │   Rule: Contract entered 90-day renewal window                           │ │
│ │   Result: Renewal created with status PENDING_REVIEW                     │ │
│ │                                                                           │ │
│ │ ✓ Budget Check Triggered                   Jul 18, 2026 2:00 PM          │ │
│ │   Rule: Quote received → auto-trigger budget validation                  │ │
│ │   Result: Budget check initiated (pending ERP response)                  │ │
│ │                                                                           │ │
│ │ ⏳ PO Auto-Creation Pending                Awaiting: Business Approval   │ │
│ │   Rule: Business approval → auto-create PO draft                        │ │
│ │   Prerequisites: □ Legal approved, □ Business approved                   │ │
│ │                                                                           │ │
│ │ ⏸ Legal Review (conditional)               Will auto-route if:          │ │
│ │   Rule: Value > $100K OR terms changed                                  │ │
│ │   Current value: $250,000 → Legal review WILL be required               │ │
│ │                                                                           │ │
│ │ ⏸ CFO Approval (conditional)               Will auto-route if:          │ │
│ │   Rule: Value > $200K → CFO approval required                           │ │
│ │   Current value: $250,000 → CFO approval WILL be required               │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ The following steps are handled automatically:                                │
│ • Renewal creation from contract end date                                    │
│ • Budget validation against ERP (when connected)                             │
│ • Approval routing (chain determined by PolicyRule)                          │
│ • PO draft creation from approved renewal                                    │
│ • Invoice-PO matching (within tolerance)                                     │
│ • SLA breach detection and escalation                                        │
│ • Notification dispatch                                                       │
│                                                                               │
│ Remaining manual steps:                                                       │
│ • S1: Assign renewal                                                          │
│ • S2: Record vendor quote                                                     │
│ • S4: Review and approve/reject legal terms                                  │
│ • S5: Submit usage attestation                                               │
│ • S2: Review and send PO                                                     │
│ • S3: Resolve invoice exceptions                                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Why This Panel Exists

**Primary stakeholder: All roles, especially S1 (Process owner) and S10 (Configuration).**

The automation panel answers two critical questions:
1. *"What is the system doing for me?"* — Renewals Managers need confidence that the platform is working in the background, not just storing data.
2. *"What do I still need to do?"* — Every stakeholder needs clear demarcation between automated and manual steps.

**Without this panel, automation is invisible.** Users wonder: "Did the system check the budget?" "Will the PO be created automatically?" "Why didn't legal review trigger?" The automation panel makes the platform's behavior **transparent and predictable**. For S10, it provides a direct link to the PolicyRule configuration — "oh, the CFO threshold is $200K, that's why this step appeared."

---

## 15. Action Bar (Contextual)

### Actions by Renewal Status

The action bar sits below the header and above the quad grid. Available actions are derived from the Renewal state machine's allowed transitions.

| Current Status | Primary Action | Secondary | Overflow |
|---|---|---|---|
| PENDING_REVIEW | [Assign] | [Hold] [Cancel] | [Add Note] [Edit Priority] [Change Tags] |
| ASSIGNED | [Record Quote] | [Escalate] [Hold] [Cancel] | [Reassign] [Add Note] |
| QUOTE_RECEIVED | [Submit for Budget Check] | [Update Quote] [Hold] [Cancel] | [Request Revised Quote] [Add Note] |
| BUDGET_CHECK | (waiting — auto or manual) | [Manual Budget OK] [Hold] | [Re-check Budget] [Add Note] |
| BUDGET_REVIEW | [Escalate for Override] | [Renegotiate] [Cancel] | [Hold] [Add Note] |
| LEGAL_REVIEW | (waiting for S4) | — | [Remind Approver] [Add Note] |
| BUSINESS_APPROVAL | (waiting for S5) | — | [Remind Approver] [Add Note] |
| PO_CREATED | [Send PO to Vendor] | [Edit Draft] [Cancel PO] | [Download PDF] [Add Note] |
| ON_HOLD | [Resume] | [Cancel] | [Edit Hold] [Add Note] |
| ESCALATED | [Resolve Escalation] | [Cancel] | [View Escalation History] [Add Note] |
| CANCELLED | (no actions) | — | [View History] [Add Note] |

---

## 16. Empty States

### No Quote Yet (ASSIGNED state)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ No quote received yet                                                         │
│ Contact Oracle Corporation to request a renewal quote. You can record the     │
│ quote here once received.                                                     │
│                                                                               │
│ [Record Quote Manually]  [Email Vendor]  [Mark as No Quote Needed]            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### No Documents Yet

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ No documents required                                                         │
│ Documents to collect will appear here once the renewal progresses.            │
│ Typically: vendor quote, signed contract, legal review document.              │
│                                                                               │
│ [Upload Document Now]                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### No Tasks Yet

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ No open tasks                                                                 │
│ Tasks are automatically created when the renewal needs manual intervention    │
│ (e.g., budget review, document failure). You can also create ad-hoc tasks.    │
│                                                                               │
│ [Create Task]                                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 17. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Escape` | Close detail panel / return to list |
| `Cmd+K` | Command palette (context-aware: shows renewal actions) |
| `Cmd+Shift+S` | Show/hide SLA panel |
| `Cmd+Shift+R` | Show/hide Risk Score panel |
| `Space` | Expand/collapse current section |
| `Cmd+Enter` | Submit current action (approve, assign, etc.) |
| `↑` / `↓` | Navigate items within a section |
| `Enter` | Open selected item |
| `Cmd+1`-`Cmd+9` | Quick-switch between section tabs |
| `Cmd+Shift+A` | Approve current renewal (when eligible) |
| `Cmd+Shift+H` | Hold current renewal (when eligible) |
| `Cmd+Shift+E` | Escalate current renewal (when eligible) |
| `Cmd+Shift+C` | Cancel current renewal (with confirmation) |

---

## 18. Section Visibility by Role

Some panels are only relevant to specific stakeholders. The Renewal Workspace adapts.

| Panel | S1 | S2 | S3 | S4 | S5 | S6 | S7/S8 | S9 | S10 |
|---|---|---|---|---|---|---|---|---|---|
| Progress Tracker | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SLA | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | — |
| Risk Score | ✓ | — | — | — | — | — | ✓ | ✓ | — |
| Timeline | ✓ | ✓ | — | — | — | — | — | ✓ | — |
| Approvals | ✓ | ✓ | — | ✓ | ✓ | — | — | ✓ | — |
| Vendor Response | — | ✓ | — | — | — | ✓ | — | — | — |
| Customer Response | ✓ | — | — | — | ✓ | — | — | — | — |
| Required Documents | ✓ | ✓ | — | — | — | — | — | — | — |
| PO | — | ✓ | ✓ | — | — | — | — | — | — |
| Invoice | — | — | ✓ | — | — | — | — | — | — |
| Tasks | ✓ | ✓ | — | — | — | — | — | — | — |
| Emails | — | ✓ | — | — | — | ✓ | — | — | — |
| Automation | ✓ | — | — | — | — | — | — | — | ✓ |

✓ = Visible by default. — = Hidden (can be enabled in user preferences if desired).

---

## 19. Design Rationale Summary

### Why a Quad Grid Layout?

The top of the workspace uses a 2×2 fixed grid (SLA, Risk Score, Actions, Key Info) rather than a single-column scroll. **This is intentional.** These four panels contain the decision-critical information that every stakeholder needs at a glance. Putting them in a grid means they are **all visible above the fold without scrolling** — no panel is "below" another. The user's eye can flick between them in under a second.

### Why Panels Instead of Tabs for the Top Section?

The quad grid panels are **always visible**. Tabs would hide SLA behind Risk Score or vice versa. **The renewal workspace is a command center, not a document.** Command centers show all critical instruments simultaneously.

### Why Sections Below Are Tabbed?

Below the fold, the content is **deep** (timeline entries, document lists, approval history). Tabbed sections let users navigate without losing their position in the quad grid above. The quad grid is persistent; the section content changes.

### Why Every Panel Justifies Its Existence

Every panel traces to a specific stakeholder question:

| Panel | Stakeholder Question |
|---|---|
| Progress Tracker | *Where is this renewal?* |
| SLA | *What's about to breach?* |
| Risk Score | *Should I worry about this one?* |
| Timeline | *How did we get here?* |
| Approvals | *Who is it waiting on?* |
| Vendor Response | *Has the vendor done their part?* |
| Customer Response | *Has the Business Owner responded?* |
| Required Documents | *What's missing?* |
| PO | *Was the PO created and sent?* |
| Invoice | *Was the invoice matched and paid?* |
| Tasks | *What needs manual action?* |
| Emails | *What did we send to the vendor?* |
| Automation | *What is the system doing automatically?* |

**A panel that does not answer a specific stakeholder's specific question has no place in the flagship workspace.**
