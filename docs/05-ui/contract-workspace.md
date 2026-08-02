# Contract Workspace

## Document Control

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-07-20 | Principal UX Architect | Complete Contract Workspace specification |

---

## 1. Workspace Philosophy

The Contract Workspace is the central repository for a single software maintenance agreement. Every renewal, document, approval, and communication traces back to a Contract. The workspace is designed as a **multi-section detail view** — the user arrives here from a list, a search result, a notification, or a related entity (vendor, renewal, PO), and finds everything they need without navigating away.

### Design Rules

1. **Read-optimized by default.** The workspace is primarily a consumption view. Edits are inline or via slide-over forms, never a separate edit mode.
2. **Section navigation is persistent.** The user's current section (Products, Documents, etc.) is remembered across visits.
3. **State-dependent actions.** The header action bar shows only transitions valid for the Contract's current status. Invalid actions are not hidden — they are visible but disabled with a tooltip explaining why.
4. **Role-adaptive visibility.** Sections render differently based on the user's role. S3 (Financial Analyst) sees financial data highlighted. S4 (Legal Counsel) sees clauses first. S2 (Procurement) sees renewal data first.
5. **Inline relationships.** PO, renewal, vendor, and invoice data are viewable through slide-over panels — never a full page navigation away.

---

## 2. Layout Anatomy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER ZONE (64px)                                                           │
│ ┌────────────────────────────────────────────────────────────────────────────┐│
│ │ Contract Name                      ● Active   ▼ Health   ⚡ Priority      ││
│ │ Contract #MCR-2026-00142   Vendor: Oracle Corporation                     ││
│ └────────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│ ACTION BAR (48px)                                                             │
│ ┌────────────────────────────────────────────────────────────────────────────┐│
│ │ [Edit] [Renew] [Terminate] [Add Note]  ⋮ [Export] [Delete Draft]         ││
│ └────────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│ SECTION NAV (40px)                                                            │
│ ┌────────────────────────────────────────────────────────────────────────────┐│
│ │ │ Summary │ Products │ Documents │ Renewals │ Approvals │ Tasks │ ... │   ││
│ └────────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│ CONTENT AREA (scrollable)                                                     │
│ ┌────────────────────────────────────────────────────────────────────────────┐│
│ │                                                                             ││
│ │  [Selected section content — see §4-16 below]                              ││
│ │                                                                             ││
│ └────────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│ DETAIL PANEL (slide-over, 480-640px) — opened on demand                       │
│ ┌────────────────────────────────────────────────────────────────────────────┐│
│ │  [Related entity shown here without page navigation]                       ││
│ └────────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Header Zone

### 3.1 Elements

| Element | Content | Behavior |
|---|---|---|
| **Contract Name** | `contract_name` (H2, semibold) | Truncates at 60ch with ellipsis. Full name on hover tooltip. |
| **Status Badge** | ContractStatus: DRAFT / ACTIVE / EXPIRED / TERMINATED / INCONSISTENT | Color-coded per design system: DRAFT=neutral, ACTIVE=success, EXPIRED=danger, TERMINATED=warning, INCONSISTENT=danger. Clicking badge opens status history modal (see §7). |
| **Health Indicator** | Derived value based on data integrity, approaching end_date, and active renewal status | Green = all good, Amber = end_date approaching with no active renewal, Red = INCONSISTENT or end_date passed with no renewal. Auto-refreshes daily. |
| **Priority Badge** | From linked renewals — highest priority of any active renewal, or a manually set contract priority | Shown only when HIGH or CRITICAL. Click to see which renewal triggered it. |
| **Contract Number** | `contract_number` (monospace, secondary text) | Copy-to-clipboard on click. Shows "Copied!" toast. |
| **Vendor Link** | Vendor name | Click opens Vendor slide-over panel with vendor summary, contacts, scorecard. |
| **Key Metadata Row** | Start date – End date, Total Value, Auto-renewal indicator | Compact row below the name. Dates shown as "Mar 15, 2026 – Mar 14, 2027." Value formatted per currency. Auto-renewal shows a small icon with tooltip showing notice period and term. |

### 3.2 Role-Adaptive Header

| Role | Header Variation |
|---|---|
| **S3 (Financial)** | Total Value field is bold and largest element. Payment terms shown. |
| **S4 (Legal)** | Status badge enlarged. Contract Type shown. Auto-renewal details emphasized. |
| **S7/S8 (Executive)** | Health indicator is the primary visual element. Value shown with YoY comparison. |
| **S9 (Auditor)** | Header is read-only. A small padlock icon appears. Status history link prominent. |

---

## 4. Action Bar

### 4.1 Actions by Contract Status

Actions are state-machine governed. Only transitions valid from the current state are enabled.

| Contract Status | Primary Action | Secondary Actions | Overflow Menu (⋮) |
|---|---|---|---|
| **DRAFT** | [Activate] | [Edit] [Delete Draft] | [Export Draft] [Duplicate] |
| **ACTIVE** | [Edit] | [Renew] [Terminate] | [Add Note] [Export] [Duplicate] [Request Amendment] |
| **EXPIRED** | [Reactivate] | [View Renewal History] [Export] | [Terminate] [Add Note] |
| **TERMINATED** | [Reactivate] (admin only) | [View Renewal History] [Export] | [Add Note] |
| **INCONSISTENT** | [Fix Data] (opens edit form with invalid fields highlighted) | [Force Terminate] (admin only) | [Export] [Add Note] |

### 4.2 Interaction Details

- **Primary Action** — Blue button, leftmost. Performs the most common next transition.
- **Secondary Actions** — Outline buttons. Any action that creates a related entity (Renewal, Amendment, Task) opens a slide-over form, not a new page.
- **Overflow Menu (⋮)** — Less frequent or destructive actions. Destructive actions (Terminate, Delete) show a confirmation dialog with full context: "Terminate contract MCR-2026-00142? This will affect 2 active renewals. Reason required."

### 4.3 Action Feedback

| Action | Feedback |
|---|---|
| **Success** | Toast: "Contract activated" + optional undo (5-second window for reversible actions) |
| **Failure** | Inline error in the action bar: "Cannot activate: missing required fields. [Fix now →]" links to the Summary section with invalid fields highlighted. |
| **Async action** | Button shows spinner. Disabled until complete. Action bar shows "Processing..." |

---

## 5. Section Navigation

### 5.1 Tabs

The primary navigation within the workspace. Order is role-adaptive.

| # | Section | Default Visibility | Default Order |
|---|---|---|---|
| 1 | Summary | All roles | 1 |
| 2 | Products | All roles | 2 |
| 3 | Documents | All roles | 3 |
| 4 | Renewals | All roles | 4 |
| 5 | Approvals | All roles | 5 |
| 6 | Tasks | All roles | 6 |
| 7 | Activities | S1, S2, S9, S10 | 7 |
| 8 | Clauses | S4, S10 | — |
| 9 | Timeline | S1, S2, S9 | — |
| 10 | Analytics | S1, S3, S6, S7, S8 | — |
| 11 | Communication | S2, S6 | — |
| 12 | History | S9, S10 | — |

### 5.2 Tab Behavior

- **Scrollable** if more tabs fit than available width. Left/right scroll arrows on hover.
- **Badge counts** on tabs with actionable items:
  - Documents: `[3]` if documents awaiting processing
  - Approvals: `[2]` if pending approvals exist on linked renewals
  - Tasks: `[1]` if open tasks exist
  - Activities: `[12]` total activity count for the contract
- **Tab state** is preserved in URL hash (`#products`, `#documents`) for deep linking and browser back/forward.

---

## 6. Summary Section

### 6.1 Layout

Two-column layout:
- **Left column (60%)** — General information, dates, values
- **Right column (40%)** — Related entities, quick links, metadata

### 6.2 Left Column — General Information

```
┌────────────────────────────────────────────────┐
│ GENERAL                                        │
│ ────────────────────────────────────────────── │
│ Contract Name      │ Oracle Database EE        │
│ Contract Number    │ MCR-2026-00142            │
│ Contract Type      │ Maintenance               │
│ Vendor             │ Oracle Corporation    [→] │
│ Start Date         │ Mar 15, 2026              │
│ End Date           │ Mar 14, 2027              │
│ Renewal Window     │ 90 days before end        │
│ Auto-Renewal       │ Yes — 60 day notice, 12mo term │
│ Billing Frequency  │ Annual                    │
│ Currency           │ USD                       │
│ Total Value        │ $250,000.00               │
│ Payment Terms      │ Net 30                    │
│ Budget Code        │ IT-SW-MAINT-2026          │
│ ────────────────────────────────────────────── │
│ OWNER & NOTIFICATIONS                          │
│ Contract Owner     │ Sarah Chen (S2)      [→]  │
│ Notification Email │ s.chen@company.com        │
│ Notifications      │ Enabled — 30 days before  │
│ ────────────────────────────────────────────── │
│ NOTES                                           │
│ [Enterprise license covering 500 users.        │
│  Includes 24/7 support and updates.]           │
│ [+ Add Note]                                   │
└────────────────────────────────────────────────┘
```

### 6.3 Right Column — Quick Links & Metadata

```
┌────────────────────────────────────────────────┐
│ RENEWAL STATUS                                  │
│ ┌────────────────────────────────────────────┐  │
│ │ Next Renewal: Q1 2027                      │  │
│ │ Active Renewal: RNW-4123      [● Pending] │  │
│ │ Prior Renewals: 3                          │  │
│ │ Last Renewed: Mar 2025                     │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ FINANCIAL SNAPSHOT                               │
│ ┌────────────────────────────────────────────┐  │
│ │ Current Term:   $250,000                   │  │
│ │ Previous Term:  $235,000 (+6.4%)           │  │
│ │ YoY Change:     ▲ $15,000                  │  │
│ │ └─ Show trend →                            │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ QUICK LINKS                                      │
│ ┌────────────────────────────────────────────┐  │
│ │ [→ View Vendor Profile]                    │  │
│ │ [→ All Contracts by Oracle]                │  │
│ │ [→ View POs for this Contract]             │  │
│ │ [→ View Invoices for this Contract]        │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ METADATA                                        │
│ ┌────────────────────────────────────────────┐  │
│ │ Created:      Jan 15, 2026 by John Doe    │  │
│ │ Last Updated: Jun 20, 2026 by Sarah Chen  │  │
│ │ Contract ID:  550e8400-e29b-41d4-a716-... │  │
│ │ Version:      1 (original)                 │  │
│ └────────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

### 6.4 Interactions

| Element | Interaction |
|---|---|
| **Field values** | Click any field to inline-edit. Opens a small popover with the current value, edit input, save/cancel buttons. Changed fields show a small blue dot until saved. |
| **Vendor link [→]** | Opens Vendor detail panel (slide-over, 480px) — no page navigation. |
| **Owner link [→]** | Opens User detail panel: role, department, contact info, current assignments. |
| **[+ Add Note]** | Inlines a text area below existing notes. Saves on blur. |
| **Renewal Status card** | Click the renewal link (RNW-4123) to open Renewal detail panel. |
| **Financial Snapshot** | "Show trend" expands to a mini inline chart showing value over the last 5 terms. |
| **Quick Links** | Each opens the respective workspace or list filtered to this contract. |
| **Contract ID** | Click to copy full UUID. Shows "Copied!" toast. |

### 6.5 Role-Adaptive Summary

| Role | Changes |
|---|---|
| **S1 (Renewals Manager)** | Sees the Renewal Status card at the top. Assignee workload indicator. |
| **S2 (Procurement)** | Notes field editable by default (not read-only). Quick links to POs prominent. |
| **S3 (Financial)** | Financial Snapshot card expanded by default. Budget code field is validated against ERP. Shows "Budget Validated ✓" or "Budget Code Not Found ✗" inline. |
| **S4 (Legal)** | Contract Type and auto-renewal details at the top. Clause deviations count shown. |
| **S5 (Business Owner)** | Total Value is prominent. Shows "Approval Required" banner if renewal needs their decision. |
| **S7/S8 (Executive)** | YoY change highlighted. Shows aggregate: "3 contracts with this vendor, total $750K." |

---

## 7. Products (Line Items) Section

### 7.1 Layout

Data table of `ContractLineItem` entities with computed totals.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Products (4)                           [Add Product] [Import from Template]  │
│ ──────────────────────────────────────────────────────────────────────────── │
│ │ Product Name │ SKU              │ Qty │ Rate    │ Disc │ Tax  │ Total    │
│ ├────────────────────────────────────────────────────────────────────────────┤
│ │ Oracle DB EE │ SKU-DAT-MUR-2026 │ 500 │ $450.00 │ 10%  │ 18%  │ $240,300 │
│ │ │  000456                        │     │         │      │      │          │
│ │ Oracle ASM   │ SKU-DAT-MUR-2026 │ 100 │ $100.00 │ —    │ 18%  │ $11,800  │
│ │ │  000457                        │     │         │      │      │          │
│ │ Oracle RAC   │ SKU-DAT-MUR-2026 │ 50  │ $200.00 │ 5%   │ 18%  │ $19,000  │
│ │ │  000458                        │     │         │      │      │          │
│ ──────────────────────────────────────────────────────────────────────────── │
│ │                                                                           ││
│ │ Subtotal: $271,100  │ Discount: $14,050 │ Tax: $46,269 │ Total: $250,000 ││
│ ──────────────────────────────────────────────────────────────────────────── │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Column Details

| Column | Type | Behavior |
|---|---|---|
| **Product Name** | Link | Click opens Product detail panel (SKU, description, current rate, status). Product name is from the immutable `product_snapshot` — if the Product has been renamed since, a small icon indicates "snapshot differs from current." |
| **SKU** | Monospace text | Click to copy. Tooltip shows full SKU format. |
| **Qty** | Integer | Inline editable. Changing qty recalculates total. Requires reason for override of standard rate. |
| **Rate** | Currency | Inline editable. If different from Product's standard rate, a small "≠" icon appears with tooltip "Negotiated rate: $450 vs standard $475." |
| **Disc** | Percentage | Inline editable (0-100%). |
| **Tax** | Percentage | Inline editable (0-100%). |
| **Total** | Currency | Read-only computed field. Override allowed with reason. Overrides shown with a pencil icon and hover showing the computed value vs. overridden value. |
| **Actions** | Icon buttons | [Edit row] [Duplicate row] [Remove] |

### 7.3 Row States

| State | Visual |
|---|---|
| **Default** | White background |
| **Hover** | --color-surface-alt |
| **Edited (unsaved)** | Blue left border + small "Unsaved" pill |
| **Override active** | Amber left border + "!" icon on the overridden field |
| **Error** | Red left border + inline error message (e.g., "Qty must be ≥ 1") |

### 7.4 Interactions

| Action | Behavior |
|---|---|
| **Add Product** | Opens a product selector (searchable dropdown with type-ahead, showing name + SKU + current rate). Select a product → pre-fills rate, creates line item. Auto-populates quantity = 1. |
| **Import from Template** | Opens a modal showing saved product templates (commonly bundled products). Select a template → all line items added at once. |
| **Edit Row** | Row becomes editable inline. Tab moves between editable fields. Enter or Tab on last field saves. Escape cancels. |
| **Remove** | Confirmation dialog: "Remove Oracle RAC from line items? This does not affect the contract total until saved." |
| **Bulk Actions** | Checkbox per row + header checkbox. Selected rows: [Delete Selected] [Apply Discount] [Apply Tax]. |

### 7.5 Computations

All calculations happen in the backend but with instant optimistic UI:

```
base_amount = quantity × unit_rate
discount_amount = base_amount × (discount_percent / 100)
taxable_amount = base_amount - discount_amount
tax_amount = taxable_amount × (tax_percent / 100)
line_total = taxable_amount + tax_amount
contract_total = sum(line_totals)
```

If `contract_total` does not match the Contract's `total_contract_value`, a warning banner appears: "Line item total ($271,100) does not match contract total ($250,000). [Sync values]" The "Sync values" button offers: (a) Update contract total from line items, or (b) Distribute variance proportionally across line items.

---

## 8. Documents Section

### 8.1 Layout

Card grid, 3 columns. Each card represents a `ContractDocument`.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Documents (7)                    [Upload] [Request from Vendor] [Manage]     │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                          │
│ │ 📄           │ │ 📄           │ │ ⬆             │                          │
│ │ Contract.pdf │ │ SOW.pdf      │ │ Amendment    │                          │
│ │ 1.2 MB       │ │ 890 KB       │ │ Pending...   │                          │
│ │ [C]ontract   │ │ [S]OW        │ │              │                          │
│ │ Uploaded:    │ │ Uploaded:    │ │              │                          │
│ │ Jan 15, 2026 │ │ Jan 15, 2026 │ │              │                          │
│ │ [↓] [⋯]      │ │ [↓] [⋯]      │ │ [⋯]          │                          │
│ └──────────────┘ └──────────────┘ └──────────────┘                          │
│                                                                               │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                          │
│ │ 📄           │ │ 📄           │ │ 📄           │                          │
│ │ License.pdf  │ │ Invoice      │ │ Support      │                          │
│ │ 340 KB       │ │ Q1-2026.pdf  │ │ SLA.pdf      │                          │
│ │ [A]ttachment │ │ 2.1 MB       │ │ 180 KB       │                          │
│ │              │ │ [A]ttachment │ │ [A]ttachment  │                          │
│ │              │ │              │ │              │                          │
│ │ [↓] [⋯]      │ │ [↓] [⋯]      │ │ [↓] [⋯]      │                          │
│ └──────────────┘ └──────────────┘ └──────────────┘                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Card Elements

| Element | Behavior |
|---|---|
| **File icon** | File type icon based on mime_type (PDF, DOCX, XLSX, image). |
| **File name** | Truncated at 30ch with ellipsis. Full name on hover. |
| **File size** | Human-readable (KB, MB). |
| **Document type badge** | Compact pill: [C]ontract, [S]OW, [A]mendment, [A]ttachment, [O]ther. Color-coded. |
| **Upload metadata** | "Uploaded by Sarah Chen on Jan 15, 2026" |
| **[↓] Download** | Downloads the file. For large files (>50MB), shows progress bar. |
| **[⋯] Overflow** | Options: Rename, Replace, Move to Folder, Delete, Copy Link, View Details. |

### 8.3 Interactions

| Action | Behavior |
|---|---|
| **Upload** | Opens file picker (single or multi). Supports drag-and-drop onto the section. Shows upload progress per file. On completion, card appears with document type selector. |
| **Request from Vendor** | Opens a slide-over: "Request document from vendor." Pre-fills vendor email. Sends an email with a secure upload link. Status tracked: "Sent" → "Uploaded" → "Ready." |
| **Manage** | Opens full document management view: folder tree, filters by type, bulk operations. |
| **View Details** | Slide-over panel showing: file name, type, size, uploader, upload date, document type, description, version, external storage reference (OneDrive URL if synced). |
| **Replace** | Upload new file. Old file is versioned (not deleted). Version history accessible from Details. |
| **Delete** | Confirmation: "Delete Contract.pdf? This action is logged. The file will be moved to a 30-day recovery bin." |
| **Rename** | Inline text edit on the card title. |

### 8.4 Document States

| State | Visual |
|---|---|
| **Uploading** | Progress bar overlay on card. Cancel button. |
| **Uploaded (processing)** | Spinner. "Processing..." |
| **Ready** | Normal card. |
| **Processing Failed** | Red border. "Virus detected" or "OCR failed." [Retry] or [Delete] buttons. |
| **Archived** | Card grayed out. "Archived" badge. |

---

## 9. Renewals Section

### 9.1 Layout

Timeline-style list showing all `Renewal` entities for this contract, past and present.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Renewals (4)                                        [Create Manual Renewal]  │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ ACTIVE (1)                                                                   │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ RNW-4123 │ 2026 Renewal                     ● PENDING_REVIEW    [45d]  │ │
│ │ ──────────────────────────────────────────────────────────────────────── │ │
│ │ Vendor: Oracle Corp  │ Value: $250,000  │ Assigned: Sarah Chen  [→]     │ │
│ │ Created: Jun 1, 2026 │ Priority: HIGH   │ SLA: Legal Review (3d left)   │ │
│ │ ──────────────────────────────────────────────────────────────────────── │ │
│ │ Actions: [Assign] [Record Quote] [Escalate] [Hold] [Cancel]             │ │
│ │ Progress: ● Pending ──○──○──○──○──○──○──○──○                            │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ PAST (3)                                                                      │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ RNW-3891 │ 2025 Renewal                           ✓ COMPLETED            │ │
│ │ Values: $235,000 │ PO: PO-2025-00312 │ Completed: Mar 10, 2025          │ │
│ │ [View Details] [View PO]                                                   │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ RNW-3547 │ 2024 Renewal                           ✓ COMPLETED            │ │
│ │ Values: $220,000 │ PO: PO-2024-00289 │ Completed: Mar 12, 2024          │ │
│ │ [View Details] [View PO]                                                   │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ RNW-3122 │ 2023 Renewal                           ✓ COMPLETED            │ │
│ │ Values: $200,000 │ PO: PO-2023-00201 │ Completed: Mar 8, 2023           │ │
│ │ [View Details] [View PO]                                                   │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Active Renewal Card

| Element | Behavior |
|---|---|
| **Header** | Renewal ID (monospace, link to detail panel). Year label. Status badge. Days remaining badge (red if < 30). |
| **Metadata row** | Vendor, value, assignee. Assignee clickable → opens User detail panel. |
| **SLA timer** | Shows the most critical SLA deadline. Red if breached. Amber if < 24 hours. |
| **Actions** | State-dependent buttons (per Renewal state machine). Actions affect the renewal, not the contract. |
| **Progress bar** | Mini horizontal timeline showing the renewal's state machine. Completed stages have green dots. Current stage has a pulsing blue dot. Future stages are gray. Hovering a dot shows the transition details. |

### 9.3 Past Renewal Cards

Compact. Key data and links. No actions. Clicking opens the renewal's detail panel in read-only mode.

### 9.4 Interactions

| Action | Behavior |
|---|---|
| **Create Manual Renewal** | Opens form: pre-fills current contract data. Sets year = current year. Status = PENDING_REVIEW. Requires reason for manual creation (vs. system-detected). |
| **Click any Renewal ID** | Opens Renewal detail panel (slide-over, 640px — the Renewal is complex). Panel has its own section navigation (Renewal-specific: Timeline, Quote, Approvals, PO, Invoice, Activity). |
| **Assign button** | Opens assignee selector. Filters to S2 (Procurement) role users. Shows current workload count per user. |
| **Record Quote** | Opens quote form within the renewal detail panel. Fields: amount, reference, document upload, notes. |
| **View PO link** | Opens PO detail panel. |

### 9.5 Empty State

If no renewals exist (DRAFT contracts or newly created):
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ No renewals yet                                                               │
│ Renewals are created automatically when this contract approaches its          │
│ end date. You can also create one manually.                                   │
│                                                                               │
│ [Create Manual Renewal]                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Approvals Section

### 10.1 Layout

Shows all `ApprovalRecord` entities across all renewals for this contract. Approvals are grouped by renewal.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Approvals (3 pending)                                                         │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ RENEWAL #4123 — 2026 Renewal                                                  │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Chain Step │ Approver        │ Status    │ SLA          │ Actions         │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ 1. Legal   │ Jane Smith (S4) │ ⏳ Pending │ 2d 4h left  │ [Remind] [⋯]   │ │
│ │ 2. Bus.Own │ Mark Lee (S5)   │ ⏸ Waiting  │ —           │ (awaiting step 1)│
│ │ 3. CFO     │ Required if     │ ⏸ Waiting  │ —           │ (conditional)   │ │
│ │            │ > $200K         │            │             │                 │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ RENEWAL #3891 — 2025 Renewal                                                  │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Step │ Approver        │ Status          │ Completed        │ Notes      │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ 1.   │ Jane Smith (S4) │ ✓ Approved      │ Mar 1, 2025      │ "Standard  │ │
│ │ 2.   │ Mark Lee (S5)   │ ✓ Approved      │ Mar 3, 2025      │ terms."    │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Interactions

| Element | Behavior |
|---|---|
| **Pending status** | Click the status badge to see the full ApprovalRecord detail: submitted at, SLA deadline, reminder history, escalation level. |
| **[Remind]** | Sends an in-app notification + email to the approver. Tracked: "Reminded 2 times." Cooldown: 4 hours between reminders. |
| **[⋯] Overflow** | [Escalate], [Cancel Approval Step], [Reassign Approver]. Escalate increments `escalation_level` and notifies the next-level authority. |
| **Waiting steps** | Show "awaiting step N" with a tooltip showing the chain dependency. Grayed out. |
| **History rows** | Expandable: click to see the approver's comments and the full decision context (quote amount, budget, prior year comparison). |

### 10.3 SLA Visual

| State | Visual |
|---|---|
| **On track** | "2d 4h left" — green text |
| **< 24 hours** | "4h 30m left" — amber text, small alert icon |
| **Breached** | "Overdue by 2h" — red text, alert icon. Cell background is danger-soft. |

---

## 11. Tasks Section

### 11.1 Layout

Kanban-style board or list (toggleable). Shows `Task` entities associated with this contract.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Tasks (2 open)                              [Add Task] [View: Board ▾]       │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐                │
│ │ TODO         │  │ IN PROGRESS      │  │ COMPLETED        │                │
│ │              │  │                  │  │                  │                │
│ │ [1]          │  │ [1]              │  │ [5]              │                │
│ │ ┌──────────┐ │  │ ┌──────────────┐ │  │ Collapsed        │                │
│ │ │ Follow   │ │  │ │ Verify      │ │  │                  │                │
│ │ │ up on    │ │  │ │ license     │ │  │                  │                │
│ │ │ revised  │ │  │ │ counts with │ │  │                  │                │
│ │ │ quote    │ │  │ │ department  │ │  │                  │                │
│ │ │          │ │  │ │ heads       │ │  │                  │                │
│ │ │ Due: Jul │ │  │ │             │ │  │                  │                │
│ │ │ 25       │ │  │ │ Due: Jul 20 │ │  │                  │                │
│ │ │ S2: Me   │ │  │ │ S5: Mark L │ │  │                  │                │
│ │ └──────────┘ │  │ └────────────┘ │  │                  │                │
│ └──────────────┘  └──────────────────┘  └──────────────────┘                │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Card Elements

| Element | Behavior |
|---|---|
| **Title** | Task name. Click to open Task detail panel (slide-over). |
| **Due date** | Red if overdue. Amber if due within 24h. |
| **Assignee** | User avatar (small) + name. Click to reassign. |
| **Priority** | Color-coded left border: red=HIGH, amber=NORMAL, gray=LOW. |

### 11.3 Interactions

| Action | Behavior |
|---|---|
| **Add Task** | Opens quick-create form: Title, assignee, due date, priority, description. Pre-fills contract context in description. |
| **Drag card** | Move between columns to change status (TODO → IN_PROGRESS → COMPLETED). Optimistic UI update with sync indicator. |
| **Click card** | Opens Task detail panel: full description, comments, activity log for the task. |
| **Complete task** | Checkbox on card. Card animates to COMPLETED column with a strike-through effect before transitioning. |
| **Reassign** | Click assignee name → user selector. Shows current workload. |

### 11.4 Auto-Created Tasks

Tasks are automatically created by the system for certain conditions:

| Trigger | Task | Assignee | Due |
|---|---|---|---|
| Budget check fails | "Review budget for RNW-4123" | S1 (Renewals Manager) | 48h |
| Invoice exception created | "Resolve invoice exception INV-08921" | S3 (Financial Analyst) | 72h |
| Document processing failed | "Review quarantined document: invoice.pdf" | S10 (Admin) | 24h |
| Vendor PO rejected | "Follow up with Oracle on PO rejection" | S2 (Procurement) | 24h |

Auto-created tasks show a small "🤖 Auto" icon on the card with hover tooltip showing the trigger reason.

---

## 12. Activities Section

### 12.1 Layout

Filterable, paginated stream of `ActivityLogEntry` records for this contract.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Activities                            [Filter ▾] [Date Range ▾] [Export]    │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ TODAY                                                                      │
│ │ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ │ ● Sarah Chen updated End Date from Mar 14, 2027 to Jun 30, 2027    │  │
│ │ │   10:23 AM — Contract #MCR-2026-00142                               │  │
│ │ │   [View Change]                                                     │  │
│ │ └──────────────────────────────────────────────────────────────────────┘  │
│ │ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ │ ● System created Renewal #RNW-4123                                   │  │
│ │ │   8:00 AM — Contract entered renewal window (45 days before end)    │  │
│ │ │   [View Renewal]                                                    │  │
│ │ └──────────────────────────────────────────────────────────────────────┘  │
│ │                                                                           │
│ │ YESTERDAY                                                                 │
│ │ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ │ ● Jane Smith approved Legal Review for Renewal #RNW-4123           │  │
│ │ │   3:15 PM — Comments: "Standard terms, approved."                   │  │
│ │ │   [View Approval]                                                   │  │
│ │ └──────────────────────────────────────────────────────────────────────┘  │
│ │ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ │ ● John Doe added document Contract_v2.pdf                            │  │
│ │ │   2:00 PM — Document type: Contract (2.1 MB)                        │  │
│ │ │   [View Document]                                                   │  │
│ │ └──────────────────────────────────────────────────────────────────────┘  │
│ │                                                                           │
│ │ JUL 15, 2026                                                              │
│ │ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ │ ● Sarah Chen created Contract #MCR-2026-00142                       │  │
│ │ │   9:30 AM — DRAFT status                                            │  │
│ │ └──────────────────────────────────────────────────────────────────────┘  │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ [Load More]                                             Showing 8 of 142     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Interactions

| Element | Behavior |
|---|---|
| **Filter** | Dropdown: All Activities, Status Changes, Document Uploads, Approvals, Renewal Events, Notes. Multi-select. |
| **Date Range** | Presets: Today, Last 7 Days, Last 30 Days, Custom Range. |
| **[View Change]** | Opens a diff modal showing the `changed_fields` from the activity log entry. Formatted as a side-by-side or inline diff: "End Date: Mar 14, 2027 → Jun 30, 2027." |
| **[View Renewal/Approval/Document]** | Opens the related entity detail panel. |
| **Group headers** | "Today," "Yesterday," "Jul 15, 2026" — sticky while scrolling. |
| **Export** | Downloads current filtered view as CSV or PDF. |

### 12.3 Role Adaptation

| Role | Behavior |
|---|---|
| **S1 (Renewals Manager)** | Default filter = "Renewal Events + Status Changes." Sees assignment history prominently. |
| **S2 (Procurement)** | Default filter = "Document Uploads + Status Changes." |
| **S9 (Auditor)** | No filter by default — sees everything. Every entry has a full detail expand: IP address, user agent, correlation ID. Export is full JSON, not CSV. |
| **All others** | Default filter = "All Activities." Simplified view — no raw metadata. |

---

## 13. Clauses Section (S4, S10 only)

### 13.1 Layout

List of `ContractClause` entities with visual comparison to standard clauses.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Clauses (12)                                 [Edit Clause Library ▾]         │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ ▸ 1. Limitation of Liability                                ✓ Standard  │ │
│ │ ▸ 2. Term and Termination                                    ⚠ Modified │ │
│ │ ▸ 3. Service Level Agreement                                 ✓ Standard  │ │
│ │ ▸ 4. Indemnification                                         ✗ Deviated │ │
│ │ ▸ 5. Data Protection                                         ✓ Standard  │ │
│ │ ▸ 6. Payment Terms                                           ✓ Standard  │ │
│ │ ...                                                                      │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 13.2 Interactions

| Element | Behavior |
|---|---|
| **Expand clause** | Click title → clause content shown below with syntax-highlighted legal text. Standard clauses shown in a subdued style. Deviated clauses highlighted with a yellow left border. |
| **✓ Standard** | No deviation from the standard clause library. |
| **⚠ Modified** | Minor changes. Hover shows a tooltip: "Changed: notice period from 30 to 60 days." Expand shows the standard vs. modified side-by-side. |
| **✗ Deviated** | Material deviation. Red badge. Expand shows a warning banner: "This clause deviates significantly from the standard. Legal review recommended." Shows side-by-side diff with deletions in red and additions in green. |
| **Approve clause** | Per-clause approve/reject buttons (for S4 during legal review). Approve logs the clause-level decision. Reject requires a comment. |

---

## 14. Timeline Section (S1, S2, S9 only)

### 14.1 Layout

A visual, horizontal timeline showing the contract's lifecycle position, similar to the Renewal Timeline but at contract level.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Timeline                                                                      │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│   ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐                      │
│   │ DRAFT│──▶│ACTIVE│──▶│      │──▶│      │──▶│      │                      │
│   │      │   │      │   │      │   │      │   │      │                      │
│   │ Jan  │   │Jan 15│   │      │   │      │   │      │                      │
│   │ 15   │   │      │   │      │   │      │   │      │                      │
│   └──────┘   └──────┘   └──────┘   └──────┘   └──────┘                      │
│   Completed   Current                                                        │
│                                                                               │
│   Transition details for ACTIVE → (current state):                            │
│   ● Activated by Sarah Chen on Jan 15, 2026 at 9:30 AM                       │
│   ● All mandatory fields validated                                           │
│   ● Renewal monitoring scheduled (daily check starting Jan 16)               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 14.2 Interactions

| Element | Behavior |
|---|---|
| **State node** | Completed = green checkmark. Current = pulsing blue dot. Future = gray circle. Error (INCONSISTENT) = red X. |
| **Click a node** | Shows transition details below the timeline: who, when, what changed, any comments. |
| **Hover a node** | Tooltip: "ACTIVE — Jan 15, 2026 → Present (1 year, 6 months)" |

---

## 15. Analytics Section (S1, S3, S6, S7, S8)

### 15.1 Layout

Embedded analytics widgets specific to this contract.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Analytics                                                           [⋮]      │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│ │   VALUE      │  │  YOY CHANGE  │  │  DISCOUNT    │  │  RENEWAL     │     │
│ │   TREND      │  │              │  │  HISTORY     │  │  CADENCE     │     │
│ │ ┌──────────┐ │  │  +6.4%      │  │              │  │              │     │
│ │ │📈        │ │  │  $235K→$250K │  │  2023: 0%    │  │  2023: Mar 8 │     │
│ │ │ mini     │ │  │  ▲ $15,000  │  │  2024: 3%    │  │  2024: Mar 12│     │
│ │ │ chart    │ │  │              │  │  2025: 8%    │  │  2025: Mar 10│     │
│ │ │          │ │  │  Industry    │  │  2026: 10%   │  │              │     │
│ │ └──────────┘ │  │  avg: +4.2% │  │              │  │  Avg: 370d   │     │
│ └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │                             VALUE TREND (5 years)                       │ │
│ │   $300K ┤                                                               │ │
│ │         │                    ●──●                                        │ │
│ │   $250K ┤              ●──●         ●                                   │ │
│ │         │         ●──●                                                   │ │
│ │   $200K ┤    ●──●                                                        │ │
│ │         │ ●                                                              │ │
│ │   $150K ┤                                                                │ │
│ │         └─────┬──────┬──────┬──────┬──────┬──────                       │ │
│ │              2022   2023   2024   2025   2026   2027                     │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ [View Full Report →]                   [Export Analytics →]                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 15.2 Widgets

| Widget | Data Source | Interaction |
|---|---|---|
| **Value Trend** | Aggregated from past renewals' PO amounts | Hover shows exact values per year. |
| **YoY Change** | Computed from current vs. prior term value | Click drills into a breakdown: rate increase, qty change, discount change. |
| **Discount History** | From past renewals' negotiated discount rates | Trend line showing discount improvement/erosion. |
| **Renewal Cadence** | Past renewal completion dates | Shows if renewals are consistently completed before end date. |

### 15.3 Full Report

Clicking "View Full Report" opens a slide-over with:
- Full 5-year value trend with annotations (contract type changes, vendor changes)
- Price per unit trend (split by product)
- Discount trend with negotiation outcomes
- SLA compliance trend (if scorecard data available)

---

## 16. Communication Section (S2, S6)

### 16.1 Layout

Threaded communication log between internal users and vendor contacts regarding this contract.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Communication (12 messages)                    [New Message] [Log Call]     │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ [Filter: All ▾] [Search messages...]                                     │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ TODAY                                                                      │
│ │ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ │ Sarah Chen → John (Oracle)    Re: Quote for 2026 Renewal           │  │
│ │ │ ┌────────────────────────────────────────────────────────────────┐ │  │
│ │ │ │ Hi John, following up on the revised quote. Can you confirm    │ │  │
│ │ │ │ the new pricing for Oracle DB EE (500 users)?                  │ │  │
│ │ │ │ — Sarah                                                        │ │  │
│ │ │ └────────────────────────────────────────────────────────────────┘ │  │
│ │ │ [Reply] [Forward] 10:23 AM                                        │  │
│ │ └──────────────────────────────────────────────────────────────────────┘  │
│ │ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ │ John (Oracle) → Sarah Chen    Re: Quote for 2026 Renewal           │  │
│ │ │ ┌────────────────────────────────────────────────────────────────┐ │  │
│ │ │ │ Hi Sarah, yes — attaching the revised quote. New rate is $475  │ │  │
│ │ │ │ per user (was $450). Volume discount remains at 10%.           │ │  │
│ │ │ │ — John                                                         │ │  │
│ │ │ │ [📎 Revised Quote Q1-2026.pdf]                                 │ │  │
│ │ │ └────────────────────────────────────────────────────────────────┘ │  │
│ │ │ [Reply] [Forward] 11:45 AM                                        │  │
│ │ └──────────────────────────────────────────────────────────────────────┘  │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ [Load More]                                               Showing 2 of 12    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 16.2 Interactions

| Action | Behavior |
|---|---|
| **New Message** | Opens compose form: To (vendor contact selector), CC, Subject (pre-filled with contract name), Body. Option to attach files from the Documents section or upload new ones. Message is logged in the activity log. |
| **Log Call** | Opens a form: Contact, Date/Time (defaults to now), Duration, Notes, Follow-up items. Creates an activity log entry. |
| **[Reply]** | Opens inline reply box below the original message. Thread is visually indented. |
| **Search** | Searches message body, subject, and sender name. |
| **Filter** | All, Sent (outbound), Received (inbound), Call Logs, System Notifications. |

### 16.3 Integration

Email integration can be enabled per-vendor. When active:
- Emails sent to `vendorname@contracts.muraai.com` are automatically threaded into this section.
- Vendor replies are captured via a reply-to header and threaded automatically.
- Status: "Email integration: ✅ Connected (vendor@oracle.com)" or "⚠️ Not configured."

---

## 17. History Section (S9, S10)

### 17.1 Layout

Full audit-trail view of all changes to this contract, with raw data access.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Change History                                     [Export as JSON] [Filter] │
│ ──────────────────────────────────────────────────────────────────────────── │
│                                                                               │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Timestamp ▾    │ User          │ Action         │ Field      │ Details │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ Jul 19 10:23AM │ Sarah Chen    │ Field Update    │ end_date   │ [view] │ │
│ │ Jul 19 8:00AM  │ System        │ Renewal Created │ —          │ [view] │ │
│ │ Jul 18 3:15PM  │ Jane Smith    │ Approval        │ legal      │ [view] │ │
│ │ Jul 18 2:00PM  │ John Doe      │ Document Upload │ contract   │ [view] │ │
│ │ Jul 15 9:30AM  │ Sarah Chen    │ Contract Created│ —          │ [view] │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ [Load More]                                               Showing 5 of 142   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 17.2 Interactions

| Element | Behavior |
|---|---|
| **Table columns** | Sortable. Default: reverse chronological. |
| **[view] Details** | Expands inline: `previous_state` → `new_state` JSON diff. Changed fields highlighted. Shows `correlation_id` for linking to related events. |
| **Export as JSON** | Downloads full activity log for this contract as a JSON array. Includes all metadata fields (IP, user agent, correlation ID). |
| **Filter** | By action type, user, date range. Multi-select. |

---

## 18. Empty States & Error States

### 18.1 Contract Not Found

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Contract not found                                                            │
│ The contract you're looking for doesn't exist or has been deleted.           │
│                                                                               │
│ [← Back to Contract List]     [Search for another contract]                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 18.2 Loading State

Skeleton layout matching the full workspace structure:
- Header zone: two skeleton lines (60% width, 40% width)
- Action bar: three skeleton buttons
- Section nav: six skeleton tabs
- Content area: skeleton cards matching the Summary section layout

### 18.3 Error State — Data Inconsistency

When contract status = INCONSISTENT, a persistent banner appears below the header:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚠ Data integrity issue detected                                              │
│ The contract's total value ($250,000) does not match the sum of line items   │
│ ($271,100). This may affect renewal processing and financial reporting.      │
│                                                                               │
│ [Fix Now →]  [Dismiss]                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 18.4 Error State — Integration Down

When a related integration is unavailable (ERP for budget check, storage for documents):

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚠ ERP integration unavailable                                                │
│ Budget validation is temporarily unavailable. You can proceed with manual     │
│ budget entry. Data will sync when the ERP connection is restored.            │
│                                                                               │
│ [Continue Manually]  [Dismiss]  [Check Status]                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 19. Keyboard Navigation

| Shortcut | Action |
|---|---|
| `Escape` | Close detail panel / return to list |
| `Cmd+E` | Edit contract (opens inline edit mode) |
| `Cmd+R` | Create renewal from this contract |
| `Cmd+D` | Download current section as PDF |
| `Cmd+Shift+T` | Focus tasks section |
| `Cmd+Shift+D` | Focus documents section |
| `Cmd+Shift+P` | Focus products section |
| `Cmd+Shift+A` | Focus approvals section |
| `Tab` / `Shift+Tab` | Navigate between sections |
| `↑` / `↓` | Navigate items within a section (tables, lists) |
| `Enter` | Open selected item's detail panel |
| `Cmd+F` | Find in page (search within current section content) |

---

## 20. Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| **>1280px** | Full layout as designed. Detail panel slides over without shrinking content. |
| **1024-1280px** | Detail panel width = 480px. Content area adjusts. |
| **768-1024px** | Sidebar collapses to icon-only. Detail panel is 480px or full-width overlay (user preference). Section tabs collapse to a hamburger dropdown if >5 tabs. |
| **<768px** | Sidebar becomes bottom nav. Detail panel is full-screen overlay. Two-column layout in Summary becomes single column. Data tables become card lists. Analytics widgets stack vertically. |

---

## 21. Accessibility

| Requirement | Implementation |
|---|---|
| **Section navigation** | ARIA role `tablist` with `tab` and `tabpanel`. Keyboard arrow keys navigate between tabs. |
| **Inline edits** | Focus is trapped within the edit popover. Escape cancels. Enter saves. |
| **Status changes** | Live region (`aria-live="polite"`) announces status transitions: "Contract activated," "Renewal created." |
| **Data tables** | `role="grid"` with `aria-sort` on sortable columns. Row actions announced by screen readers. |
| **Color-independent states** | Status uses icons + text + color, never color alone. SLA status shows text ("Overdue by 2h") in addition to red coloring. |
| **Error states** | Inline error messages have `role="alert"`. Form validation errors are associated with fields via `aria-describedby`. |
| **Keyboard navigation** | All actions reachable via keyboard. Focus indicators visible at all times (2px outline, not just a color change). |
