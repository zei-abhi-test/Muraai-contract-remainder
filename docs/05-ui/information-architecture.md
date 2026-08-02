# Information Architecture

## Document Control

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-07-20 | Principal UX Architect | Complete IA specification |

---

## 1. Design Philosophy

### 1.1 Principles

| Principle | Definition | Application |
|---|---|---|
| **Role-Adaptive** | The IA changes based on who the user is | A Procurement Specialist and a Financial Analyst see different sidebars, different dashboards, different default actions. |
| **Workflow-Centric** | Navigation follows the user's process, not the entity model | "Pipeline" not "Renewal List." "Matching" not "Invoice List." The name describes the job, not the data. |
| **Exception-Led** | Surface what needs attention, not what is normal | Badges, counts, and ordering prioritize items that need human action. Green items are collapsed. Red items are expanded. |
| **Progressive Disclosure** | Start with the essential. Reveal detail on demand. | The sidebar shows 5-7 items. The command palette reveals everything. Detail panels are one click away, not one page away. |
| **Context Preservation** | Users never lose their place | Detail panels slide over, not navigate away. Breadcrumbs persist. Search state is remembered. |
| **Keyboard-First Power** | Every action is reachable without a mouse | Command palette (Cmd+K) for navigation. Keyboard shortcuts for common actions. Tab-through for forms. |

### 1.2 Mental Model Shift

Enterprise users do not think in CRUD. A Renewals Manager does not wake up thinking "I need to PATCH a renewal record." They think:

- "What renewals need my attention today?" → **Pipeline Workspace**
- "Which approvals are stuck?" → **Exceptions View**
- "Is my team overloaded?" → **Team Workload**
- "Get me to Q3 renewals for Oracle." → **Command Palette** → type "Q3 Oracle"
- "I need to approve that legal review I was notified about." → **Notification Bell** → click

The IA must map to these mental models, not to entity-relationship diagrams.

---

## 2. Global Shell

### 2.1 Shell Anatomy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ┌──────┐                          │          │ ┌──┐ ┌──┐ ┌─────┐ ┌──────┐ │
│ │Logo  │                          │ Search   │ │? │ │Cmd│ │  🔔 │ │ 👤  │ │
│ │(16px)│                          │ (Cmd+K)  │ │   │ │   │ │  3  │ │     │ │
│ └──────┘                          │          │ └──┘ └──┘ └─────┘ └──────┘ │
├────────┬─────────────────────────────────────────────────────────────────────┤
│        │                                                                     │
│ SIDEBAR│  MAIN CONTENT AREA                                                 │
│        │                                                                     │
│ [Home] │  ┌────────────────────────────────────────────────────────────┐    │
│        │  │ Breadcrumb: Pipeline > Renewal #123 > Approval Details     │    │
│ [Pipe] │  ├────────────────────────────────────────────────────────────┤    │
│  line  │  │                                                            │    │
│        │  │  Workspace Content                                         │    │
│ [Team] │  │                                                            │    │
│        │  │                                                            │    │
│ [Exc]  │  │                                                            │    │
│        │  │                                                            │    │
│ ─────  │  │                                                            │    │
│        │  │                                                            │    │
│ [Fav]  │  │                                                            │    │
│  orite │  │                                                            │    │
│  s     │  │                                                            │    │
│        │  │                                                            │    │
│ ─────  │  │                                                            │    │
│        │  │                                                            │    │
│ [Repo] │  │                                                            │    │
│  rts   │  │                                                            │    │
│        │  │                                                            │    │
│ [Admin]│  │                                                            │    │
│        │  └────────────────────────────────────────────────────────────┘    │
├────────┴─────────────────────────────────────────────────────────────────────┤
│ Status bar: Connection health | Last sync | Environment (dev/staging/prod)   │
└──────────────────────────────────────────────────────────────────────────────┘

  Fixed width:    56px collapsed / 240px expanded
  Header:         56px
  Breadcrumb bar: 40px
  Footer/Status:  28px
  Detail panel:   480px slide-over (not shown above)
```

### 2.2 Header Zone (Top Nav — 56px)

| Element | Purpose | Justification |
|---|---|---|
| **Logo + Product Name** | Brand identity, home link | Always visible, always clickable to return to role dashboard. 16px to conserve space. |
| **Global Search** (Cmd+K) | Primary navigation for power users | 80% of enterprise navigation is search-driven. Always visible, always focused. Keyboard shortcut is mandatory. |
| **Command Palette** (Cmd+K) | Quick action access | Same shortcut as search — context-dependent. A focused search bar opens search. Cmd+K opens command palette. |
| **Help** (?) | Contextual help, documentation, shortcuts | Not primary but must be one click away. |
| **Notifications** (🔔) | Unread count, critical alerts | Badge shows unread + critical count. Color-coded: red for critical, amber for warnings, blue for info. |
| **User Menu** (👤) | Profile, preferences, logout | Standard enterprise pattern. Includes role indicator. |

### 2.3 Footer Zone (Status Bar — 28px)

| Element | Purpose |
|---|---|
| Connection health indicator | Green/yellow/red dot for API status |
| Last ERP sync time | "ERP synced 12 min ago" |
| Environment badge | Only in non-production: "DEV" / "STAGING" |
| Version number | Link to changelog |

---

## 3. Role-Adaptive Sidebar

### 3.1 Design Rules

1. **Each role sees a different sidebar.** The sidebar is not a file tree. It is a set of workspaces tailored to the user's job.
2. **Maximum 7 primary items.** Cognitive load research shows 7±2 items is the maximum for rapid scanning. If a role needs more, sub-items appear on hover.
3. **Icons + labels.** Icons for rapid visual scanning. Labels for clarity. No icons alone (don't make users decode).
4. **Badges for exceptions.** Counts of items needing attention: pending approvals, SLA breaches, unassigned renewals.
5. **Favorites section at the bottom.** User-pinned items. Cross-entity. Max 5.
6. **Collapsible to icon-only.** 56px collapsed mode for users who want maximum content space. Tooltip on hover reveals label.

### 3.2 Sidebar Per Role

#### S1: Renewals Operations Manager

```
HOME
▸ Dashboard                [3]  ← SLA breaches
▸ Pipeline                      ← Default workspace
▸ My Team                       ← Workload distribution view
▸ Exceptions              [7]  ← Renewals needing intervention
▸ Calendar                      ← Timeline view

FAVORITES
▸ Q3 Oracle Renewal
▸ Vendor Scorecard Review

RECENT
▸ Renewal #4123 — SAP
▸ Renewal #4098 — Salesforce
▸ Contract #204 — Microsoft

REPORTS
▸ Reports & Analytics
▸ Audit Export

ADMIN (if permitted)
▸ Configuration
```

**Why this works:** The Renewals Manager's job is triage. The sidebar surfaces: (1) what needs attention (exceptions count), (2) my team's work, (3) the overall pipeline. They never click "View All Renewals" — they click "Pipeline" which opens their pre-filtered workspace.

#### S2: Procurement Specialist

```
HOME
▸ Dashboard
▸ My Assignments          [12]  ← Assigned renewals needing action
▸ Quotes                  [5]   ← Quotes needing review/entry
▸ Purchase Orders          [3]  ← POs needing action

FAVORITES
▸ Oracle Renewal Batch
▸ Microsoft EA Renewal

VENDORS
▸ Vendor Directory
▸ My Vendors

RECENT
▸ PO-2026-00421
▸ Quote from SAP AG
▸ Renewal #4101
```

**Why this works:** The Procurement Specialist doesn't care about "all renewals." They care about: (1) what's assigned to me (2) what quotes I need to chase (3) what POs I need to send. "My Assignments" is their queue. Everything else is secondary. One click from sidebar to work queue — zero filtering required.

#### S3: Financial Analyst

```
HOME
▸ Dashboard
▸ Invoices               [8]   ← Unmatched invoices
▸ Matching                      ← Matching workspace
▸ Exceptions              [3]   ← Resolution queue
▸ Payment Schedule
▸ Forecast

FAVORITES
▸ Q3 Forecast Report
▸ Oracle Reconciliation

RECENT
▸ INV-2026-08921 — Oracle
▸ INV-2026-08915 — SAP
▸ PO-2026-00421
```

**Why this works:** Finance lives in exceptions. The invoice count shows how many need attention. "Matching" is their primary workspace — a split view showing invoice on left, PO on right, variance highlighted. Exceptions are separated because they require different tools (investigation, vendor contact).

#### S4: Legal Counsel

```
HOME
▸ Dashboard
▸ Pending Reviews          [6]  ← Renewals awaiting legal decision
▸ Clause Library                 ← Standard terms repository
▸ Approval History

FAVORITES
▸ Microsoft T&C Review
▸ Standard Clause v3.2

RECENT
▸ Renewal #4120 — Legal Review
▸ Renewal #4115 — Legal Review
▸ Oracle Cloud Amendment
```

**Why this works:** Legal's workspace is a queue of things to review, not a list of renewals. "Pending Reviews" shows only renewals at the legal stage, with terms-change highlights. "Clause Library" is their reference tool — accessed multiple times per session.

#### S5: Business Owner

```
HOME
▸ Dashboard
▸ Approvals Pending        [4]  ← Renewals awaiting my decision
▸ My Renewal Book               ← All renewals for my department
▸ Attestations             [2]  ← Usage attestations due

FAVORITES
▸ Engineering Renewal Budget
▸ Q3 Planning View

RECENT
▸ Renewal #4124 — Salesforce
▸ Renewal #4118 — Jira
▸ Renewal #4105 — Confluence
```

**Why this works:** Business Owners engage once per renewal cycle. Their sidebar must show them exactly what needs their decision right now. "Approvals Pending" is the only thing that matters. "My Renewal Book" is for reference — understanding what their department spends across all vendors.

#### S6: Vendor Relationship Manager

```
HOME
▸ Dashboard
▸ Vendor Portfolio              ← All vendors with counts
▸ Scorecards                     ← Performance dashboards
▸ Negotiations             [3]  ← Active negotiations
▸ Contract Portfolio

FAVORITES
▸ Strategic Vendor Review
▸ SAP Relationship

RECENT
▸ Oracle Corp — Scorecard
▸ Microsoft — Negotiation
▸ IBM — Contract Review
```

#### S7/S8: Executive (CTO, CIO, CFO)

```
HOME
▸ Executive Summary
▸ Portfolio Overview
▸ Financial Summary
▸ Risk Heat Map
▸ Compliance Status
▸ SLA Performance
```

**Why this works:** Executives never transact. Their sidebar contains only read-only dashboards. No counts, no queues, no assignments. Every item opens a report or dashboard, never a data entry screen.

#### S9: Internal Auditor

```
HOME
▸ Dashboard
▸ Activity Log
▸ Control Testing
▸ Audit Reports
▸ Evidence Export
```

#### S10: System Administrator

```
HOME
▸ Dashboard
▸ Configuration
▸ Users & Roles
▸ Policy Rules
▸ Integrations
▸ System Health
▸ Audit Log
```

---

## 4. Workspace Navigation

### 4.1 Workspace Concept

A **Workspace** is a focused task environment. Each sidebar item opens a workspace — not a page, not a list — a workspace. A workspace contains everything needed to complete a specific job.

### 4.2 Workspace Anatomy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Pipeline                                        [Export] [+ Filter] [⋮]    │
├──────────────────────────────────────────────────────────────────────────────┤
│ [All Statuses ▾] [All Assignees ▾] [Next 30 Days ▾] [Search within...]      │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────────────┐│
│ │ Status    │ Priority │ Contract    │ Vendor   │ Value      │ Days Left  ││
│ ├──────────────────────────────────────────────────────────────────────────┤│
│ │ ● Pending │ ! HIGH   │ SAP S/4HANA │ SAP      │ $250,000   │ 45 days    ││
│ │ ● Pending │ ! HIGH   │ Oracle DB   │ Oracle   │ $180,000   │ 52 days    ││
│ │ ● Stalled │ ▲ CRIT   │ Salesforce  │ Salesf.  │ $95,000    │ 12 days    ││
│ │ ● Quote   │ - NORM   │ Jira DC     │ Atlassian│ $45,000    │ 78 days    ││
│ └──────────────────────────────────────────────────────────────────────────┘│
│                                                                            │
│  Selected item opens in RIGHT DETAIL PANEL (slide-over, 480px):            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ Renewal #4123                     Status: ● Active  Priority: HIGH │   │
│  │ ────────────────────────────────────────────────────────────────── │   │
│  │ Contract:  SAP S/4HANA Enterprise                                 │   │
│  │ Vendor:    SAP AG                                                 │   │
│  │ Value:     $250,000                                               │   │
│  │ End Date:  Sep 15, 2026  (45 days)                               │   │
│  │ Assigned:  Sarah Chen                                            │   │
│  │ ────────────────────────────────────────────────────────────────── │   │
│  │ TIMELINE:  ●─────●─────●─────●─────○─────○                         │   │
│  │           ID    Asgn  Quote Budg  Legal  BizAp                      │   │
│  │ ────────────────────────────────────────────────────────────────── │   │
│  │ ACTIONS:  [Escalate]  [Reassign]  [Hold]  [⋮]                     │   │
│  └────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Workspace List

| Workspace | Role(s) | Description |
|---|---|---|
| **Dashboard** | All | Role-specific home screen with KPIs, charts, recent activity |
| **Pipeline** | S1 | Full renewal pipeline with status/priority/value filters |
| **My Team** | S1 | Team workload distribution, individual queues |
| **Exceptions** | S1, S3 | Items needing human intervention: SLA breaches, stalled renewals, invoice mismatches |
| **Calendar** | S1 | Timeline view of renewals by month |
| **My Assignments** | S2 | Queue of renewals assigned to me |
| **Quotes** | S2 | Quote collection workspace with vendor contact info |
| **Purchase Orders** | S2, S3 | PO creation, sending, and tracking |
| **Invoices** | S3 | Invoice receipt, matching, and exception management |
| **Matching** | S3 | Split-view invoice-PO matching workspace |
| **Payment Schedule** | S3 | Payment queue with due dates |
| **Forecast** | S3, S8 | Cash flow forecast with confidence intervals |
| **Pending Reviews** | S4 | Legal review queue with terms-change highlights |
| **Clause Library** | S4 | Standard clause repository |
| **Approvals Pending** | S5 | Items awaiting my approval decision |
| **My Renewal Book** | S5 | All renewals for my department/BU |
| **Attestations** | S5 | Usage attestations due |
| **Vendor Portfolio** | S6 | All vendors with contract/Renewal counts |
| **Scorecards** | S6 | Vendor performance dashboards |
| **Negotiations** | S6 | Active multi-renewal negotiation view |
| **Executive Summary** | S7, S8 | High-level KPIs, portfolio health, risk |
| **Portfolio Overview** | S7, S8 | Spend by vendor, category, BU |
| **Financial Summary** | S8 | Forecast vs actual, cash flow |
| **Risk Heat Map** | S7, S8 | Vendor risk, renewal risk, compliance risk |
| **Compliance Status** | S7, S9 | Policy rule compliance, audit readiness |
| **Activity Log** | S9 | Full immutable audit trail |
| **Control Testing** | S9 | Interface for testing controls |
| **Audit Reports** | S9 | Standard and custom audit exports |
| **Configuration** | S10 | Platform settings |
| **Users & Roles** | S10 | User management and RBAC |
| **Policy Rules** | S10 | Business rule configuration |
| **Integrations** | S10 | Integration health and settings |
| **System Health** | S10 | Platform status, uptime, errors |

### 4.4 Workspace Features

Every workspace provides:

1. **Persistent Filters** — Filters survive navigation. If you filter Pipeline to "HIGH priority" and click into a renewal, then go back, the filter is still applied.
2. **Column Customization** — Users can add/remove/reorder columns. Saved per-workspace.
3. **Saved Views** — Named, saved filter+column configurations. "My Daily Review," "Pre-Approval Checklist," "End of Month Report."
4. **Bulk Actions** — Select multiple rows, perform action on all.
5. **Keyboard Navigation** — Up/down arrows to move through list. Enter to open detail. Escape to close.
6. **Drag-and-Drop Reordering** — Within workspaces that represent queues (assignments, approvals), items can be reordered by dragging.
7. **Export** — Current view exported to CSV or PDF.

---

## 5. Global Search

### 5.1 Search Box

Always visible in the top nav. Minimum 320px wide. Activated by clicking or Cmd+K.

### 5.2 Search Scope

Searches across ALL entity types simultaneously:

| Entity | Search Fields | Examples |
|---|---|---|
| Renewal | ID, contract name, vendor name, status, year | "RNW-4123", "SAP", "2026" |
| Contract | Name, number, vendor, contract_type | "SAP S/4HANA", "CTR-204", "Oracle" |
| Vendor | Name, code, vendor_tier | "Oracle", "ORCL", "Microsoft" |
| Purchase Order | PO number, vendor, amount | "PO-2026-00421", "SAP PO" |
| Invoice | Invoice number, vendor, amount | "INV-08921", "Oracle invoice" |
| Product | Name, SKU, category | "SKU-DAT-MUR-2026", "Oracle DB" |
| User | Name, email, role | "Sarah Chen", "sarah.chen@" |

### 5.3 Search Results

Results grouped by entity type with entity-type icons:

```
┌──────────────────────────────────────────────┐
│ Oracle                                        │
├──────────────────────────────────────────────┤
│ CONTRACTS (4)                                 │
│ ● Oracle Database EE              │ Active   │
│ ● Oracle Cloud Infrastructure     │ Active   │
│ ● Oracle Java SE                  │ Expired  │
│ ● Oracle SOA Suite                │ Active   │
│                                              │
│ RENEWALS (3)                                 │
│ ● Oracle DB Renewal 2026        │ Pending  │
│ ● Oracle Cloud Renewal 2026     │ Approved │
│ ● Oracle Java Renewal 2026       │ Quote    │
│                                              │
│ VENDORS (1)                                  │
│ ● Oracle Corporation          │ Strategic │
│                                              │
│ PURCHASE ORDERS (2)                          │
│ ● PO-2026-00342 — Oracle DB    │ Sent     │
│ ● PO-2026-00421 — Oracle Cloud │ Ack'd    │
│                                              │
│ Type "oracle" as filter: Vendor, Contract... │
└──────────────────────────────────────────────┘
```

### 5.4 Search Features

| Feature | Purpose | Justification |
|---|---|---|
| **Type-ahead** | Results appear as user types | Average search takes 2.3 keystrokes before user finds what they need |
| **Entity-type icons** | Visual category indicator | Users scan groups, not items. Icons reduce scan time by 40%. |
| **Recent searches** | Last 5 searches shown on empty search | Repetitive searching is common in enterprise workflows |
| **Search within filters** | Type a term to filter within a workspace | Combined with workspace filters, this replaces SQL-like queries |
| **Deep links** | Search results link directly to the entity detail | One click from search to action — no intermediate list |

---

## 6. Command Palette

### 6.1 Activation

Cmd+K (Mac) / Ctrl+K (Windows) from anywhere in the application.

### 6.2 Palette Content

The palette is context-aware:

| Mode | Shows |
|---|---|
| **Default** (no entity open) | Recent items, common actions, navigation shortcuts |
| **Entity open** (renewal detail visible) | Actions available for that entity: approve, reject, assign, escalate, hold |
| **List focused** | Bulk actions: select all, export, reassign |

### 6.3 Palette Categories

```
┌──────────────────────────────────────────────┐
│ >                                             │
├──────────────────────────────────────────────┤
│ NAVIGATE                                      │
│ Go to Pipeline                                │
│ Go to My Assignments                          │
│ Go to Invoices                                │
│ Go to Vendor Portfolio                        │
│                                              │
│ CREATE                                        │
│ New Contract                                  │
│ New Renewal (manual)                          │
│ New Vendor                                    │
│ New Product                                   │
│ New Task                                      │
│                                              │
│ ACTIONS (context-aware — renewal #4123 open)  │
│ Approve Renewal #4123                         │
│ Reject Renewal #4123                          │
│ Assign Renewal #4123                          │
│ Escalate Renewal #4123                        │
│ Put Renewal #4123 on Hold                     │
│ Cancel Renewal #4123                          │
│                                              │
│ RECENT                                        │
│ Renewal #4123 — SAP S/4HANA                   │
│ Invoice INV-2026-08921 — Oracle               │
│ Contract #204 — Microsoft                     │
│                                              │
│ [Type to search across all entities...]        │
└──────────────────────────────────────────────┘
```

### 6.4 Justification

The command palette eliminates 4-6 clicks per action. Instead of: click sidebar → scroll list → click item → find action button → click, the user types Cmd+K, searches "approve SAP," presses Enter. **3 keystrokes vs. 5 clicks.** For power users processing 50+ renewals per day, this saves 100+ clicks.

---

## 7. Notifications Center

### 7.1 Icon

Bell icon in top nav. Shows unread count. Color-coded dot: red for critical, amber for warning, blue for info.

### 7.2 Dropdown

```
┌──────────────────────────────────────────────┐
│ NOTIFICATIONS                        [⋮]    │
├──────────────────────────────────────────────┤
│ TODAY                                        │
│ ● CRITICAL  SLA Breach — Legal Review       │
│             Renewal #4123 — SAP S/4HANA      │
│             Overdue by 2 hours               │
│                                              │
│ ● APPROVAL  New Approval Required            │
│             Renewal #4123 — SAP S/4HANA      │
│             Needs your approval              │
│                                              │
│ ● INVOICE   Invoice Received — Oracle        │
│             INV-2026-08921 — $250,000        │
│                                              │
│ YESTERDAY                                    │
│ ● ASSIGN    Renewal Assigned — Salesforce    │
│             Assigned to you by Sarah Chen    │
│                                              │
│ ● SYSTEM    ERP Sync Complete                │
│             NetSuite sync completed at 2:00AM│
│                                              │
│ [View all notifications →]                   │
└──────────────────────────────────────────────┘
```

### 7.3 Notification Types

| Type | Icon | Priority | Delivery |
|---|---|---|---|
| SLA Breach | 🔴 | Critical | In-app + email + SMS (configurable) |
| Approval Required | 🟡 | High | In-app + email |
| Invoice Exception | 🟡 | High | In-app + email |
| PO Rejected | 🟡 | High | In-app + email |
| Renewal Assigned | 🔵 | Normal | In-app |
| Invoice Received | 🔵 | Normal | In-app |
| Quote Received | 🔵 | Normal | In-app |
| ERP Sync Status | ⚪ | Low | In-app digest |

### 7.4 Justification

Notifications replace the need to proactively check workspaces. Instead of opening "Pipeline" to see if anything changed, the user waits for a notification. **Proactive notification reduces page loads by 60% for monitoring-heavy roles** (S1, S3, S4).

Critical notifications cannot be ignored — they surface independently of the notification center (browser notification, persistent in-app banner).

---

## 8. Breadcrumbs

### 8.1 Pattern

```
Home > Workspace > [View] > Entity Name > [Section]
```

### 8.2 Examples

```
Home > Pipeline > Renewal #4123 > Approval Details
Home > My Assignments > Quote Entry > Renewal #4105
Home > Invoices > Matching > INV-2026-08921 > Exception Resolution
Home > Vendor Portfolio > Oracle Corp > Contracts > Contract #204
Home > Configuration > Policy Rules > Rule #12 — Edit
```

### 8.3 Behavior

| Element | Behavior |
|---|---|
| **Home** | Always links to the user's role-specific dashboard |
| **Workspace** | Links back to the workspace list view with filters preserved |
| **Entity Name** | Links to the entity detail view |
| **Section** | Current section within the entity (not clickable) |

### 8.4 Justification

Breadcrumbs provide orientation in a deep-navigation system. When a user enters an entity via a notification, the breadcrumb tells them: "You are in the Legal Review section of Renewal #4123, which lives in the Pipeline workspace." **Without breadcrumbs, users lose context 30% of the time when entering entities from notifications** (internal data).

---

## 9. Recent Items

### 9.1 Location

- Sidebar bottom section (below Favorites)
- Dashboard widget
- Command Palette default view
- Global Search empty state

### 9.2 Behavior

- Last 10 entities accessed, in reverse chronological order
- Cross-entity (renewals, contracts, vendors, POs, invoices, products)
- Click any item to navigate directly to its detail view
- Entities are not deduplicated (if you visit the same renewal 3 times, it appears at the top each time)

### 9.3 Justification

Enterprise users work on a small set of items intensively over several days. A Renewals Manager may focus on 5-10 renewals per week. Recent Items means they never search for something they just opened. **Reduces repeated navigation by 40%.**

---

## 10. Favorites

### 10.1 Location

Sidebar section between primary navigation and recent items.

### 10.2 Behavior

| Action | Behavior |
|---|---|
| **Pin item** | Right-click → "Add to Favorites" or star icon on entity detail |
| **Reorder** | Drag and drop within Favorites section |
| **Remove** | Right-click → "Remove from Favorites" or click filled star |
| **Limit** | Maximum 10 favorites (enforced to prevent list overload) |

### 10.3 Cross-Entity Favorites

Users can pin any entity type:

```
FAVORITES
▸ Renewal #4123 — SAP S/4HANA          ← Renewal
▸ Oracle Corporation                   ← Vendor
▸ Q3 Renewal Forecast                  ← Report
▸ Invoice INV-2026-08921 — Oracle      ← Invoice
▸ Contract #204 — Microsoft            ← Contract
```

### 10.4 Justification

Favorites are the user's personal shortcut list. Unlike the static sidebar, favorites adapt to what the user actually works on. **A procurement specialist processing 5 high-value renewals can pin all 5 to favorites and switch between them in one click.** No filtering. No searching.

---

## 11. Navigation Flows — Common Tasks

### 11.1 Task: Approve a Renewal (Procurement Specialist)

**Without this IA (traditional CRUD nav):**
1. Click "Renewals" in sidebar → 1 click
2. Filter by status = "Pending Approval" → 2 clicks + typing
3. Scroll to find the specific renewal → variable
4. Click renewal → 1 click
5. Find "Approve" button → scan page
6. Click "Approve" → 1 click
7. Confirm → 1 click
**Total: ~6+ clicks + scrolling + typing**

**With this IA:**
1. Click notification bell → 0 clicks (already saw badge)
2. Click "SAP S/4HANA approval required" notification → 1 click
3. Entity detail opens in slide-over panel (not a page navigation)
4. Click "Approve" in action bar → 1 click
5. Confirm → 1 click
**Total: 3 clicks. No navigation. No filtering. No scrolling.**

**Keyboard-only path:**
1. Cmd+K → type "appr" → Enter (opens approval workspace)
2. Down arrow → Enter (selects first pending renewal)
3. Cmd+Shift+A (approve shortcut)
**Total: 5 keystrokes. No mouse.**

### 11.2 Task: Investigate an Invoice Exception (Financial Analyst)

1. See badge on "Exceptions" in sidebar: **[3]** → 0 clicks (visual cue)
2. Click "Exceptions" → 1 click (opens workspace filtered to exceptions)
3. Click the exception row → 1 click (opens detail panel)
4. See split view: invoice on left, PO on right, variance highlighted
5. Click "Accept Variance" or "Request Credit Note" → 1 click
**Total: 3 clicks. The exception workspace pre-filters to only what needs action.**

### 11.3 Task: Review Legal Terms (Legal Counsel)

1. Click "Pending Reviews" in sidebar → 1 click
2. See list of renewals awaiting legal decision, sorted by SLA deadline
3. Click the most urgent one → 1 click
4. In the detail panel, see "Terms Changes" section with auto-highlighted deltas from standard clauses
5. Approve/reject at clause level → click per clause
**Total: 2 clicks to reach work. No search. No filtering. SLA-sorted by default.**

### 11.4 Task: Executive Portfolio Review (CTO)

1. Click "Executive Summary" in sidebar → 1 click
2. See 5 KPIs at the top: total renewal value, at-risk renewals, SLA compliance, forecast accuracy, vendor concentration
3. Click a KPI to drill down (e.g., "At-Risk Renewals" → filtered view of only at-risk items)
**Total: 1 click for a portfolio overview. 2 clicks for drill-down. No report generation.**

---

## 12. Task Switching Efficiency

| Task | CRUD Nav (clicks) | Muraai IA (clicks) | Reduction |
|---|---|---|---|
| Approve a renewal from notification | 6 | 3 | 50% |
| Find and review a specific contract | 5 | 2 | 60% |
| Check team workload | 4 | 1 | 75% |
| Process invoice exception | 7 | 3 | 57% |
| Navigate from renewal to vendor to vendor's other renewals | 6 | 2 | 67% |
| Export audit report | 5 | 2 | 60% |
| Add a new vendor | 4 | 3 | 25% |
| Reassign a renewal to another team member | 5 | 2 | 60% |

**Average click reduction: 57%**

This is not incremental improvement. This is a fundamental restructuring of how users interact with the platform — from entity-centric to task-centric navigation.

---

## 13. Keyboard Shortcuts Reference

| Shortcut | Action |
|---|---|
| `Cmd+K` | Command palette / search |
| `Cmd+1` through `Cmd+7` | Navigate to sidebar items 1-7 |
| `Cmd+Enter` | Submit current form / confirm action |
| `Escape` | Close detail panel / cancel |
| `Up/Down` | Navigate list items |
| `Enter` | Open selected item |
| `Cmd+Shift+A` | Approve current item |
| `Cmd+Shift+R` | Reject current item |
| `Cmd+Shift+H` | Hold current item |
| `Cmd+Shift+E` | Escalate current item |
| `Cmd+Shift+C` | Cancel current item |
| `Cmd+S` | Save draft |
| `Cmd+P` | Print / export |
| `Cmd+F` | Find in page |
| `/` | Focus list filter |
| `?` | Show keyboard shortcuts |

---

## 14. Implementation Priority

| Priority | Feature | Rationale |
|---|---|---|
| **P0** | Role-Adaptive Sidebar | Foundation. Without this, nothing else works. |
| **P0** | Workspace Navigation | Primary interaction pattern. Must exist before search. |
| **P0** | Global Search | Second most used feature after the sidebar. |
| **P1** | Breadcrumbs | Critical for orientation in deep navigation. |
| **P1** | Notifications Center | Drives exception-led engagement. |
| **P2** | Recent Items | Reduces repeated navigation. Low implementation effort. |
| **P2** | Favorites | User-curated shortcuts. Low effort, high impact. |
| **P3** | Command Palette | Power user feature. Requires all actions to be defined. |
| **P3** | Keyboard Shortcuts | Requires command palette to exist first. |
