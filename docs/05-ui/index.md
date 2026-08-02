# User Experience

## UX Principles

### 1. Role-First Design
Every screen is designed for a specific role performing a specific job. A Renewals Ops Manager and a Financial Analyst see different interfaces. Do not build generic screens.

### 2. The Renewal Is the Unit of Work
Every stakeholder interacts with renewals. The renewal record is the central artifact. All workflows, approvals, documents, and communications revolve around it.

### 3. Defaults Reduce Friction
Pre-populate everything. The renewal form should require zero data entry — all fields derived from the contract, prior renewal, and vendor master. The user's job is to confirm, correct, or override.

### 4. Exceptions Are First-Class
The happy path is automated. The interface optimizes for exceptions — mismatches, SLA breaches, missing data, policy violations. Surface problems, not routine status.

### 5. Action Over Observation
Every screen should offer the next logical action, not just information. If a renewal needs approval, show the approve button. If an invoice has an exception, show the resolution options.

### 6. Context Is Continuous
Never make the user navigate away to see related information. PO details are viewable within the renewal. Contract history is accessible from the renewal. Inline panels, not new pages.

### 7. Cumulative Search
Search across all entities — renewals, contracts, vendors, POs, invoices — from a single search bar. Results organized by entity type with contextual actions.

## Screen Map

```
DASHBOARD (Role-Specific)
  │
  ├─ Renewals Ops Mgr: Pipeline View, SLA Heat Map, Queue Management
  ├─ Procurement: My Assignments, PO Status, Quote Tracker
  ├─ Finance: Invoice Queue, Matching Dashboard, Forecast vs. Actual
  ├─ Legal: Pending Reviews, Clause Deviation Report
  ├─ Business Owner: Approvals Pending, My Renewal Book
  ├─ Vendor Manager: Vendor Portfolio, Scorecards, Negotiation View
  ├─ CTO/CIO: Executive Summary, Risk Heat Map, Portfolio Spend
  ├─ CFO: Financial Overview, Forecast Accuracy, Approval Queue
  ├─ Audit: Activity Log, Control Testing, Evidence Export
  └─ Admin: Configuration, Users, Integrations, Health
        │
        ▼
RENEWAL MANAGEMENT
  ├─ Renewal List (filterable, sortable, searchable)
  │   ├─ Filters: status, vendor, assignee, priority, date range, aging
  │   └─ Bulk actions: assign, export, escalate
  │
  └─ Renewal Detail
      ├─ Header: Status, Priority, Vendor, Contract, Value
      ├─ Timeline: Visual state machine with transition history
      ├─ Details: Quote, Budget, Terms, Attestation
      ├─ Approvals: Current and historical approval records
      ├─ Documents: Quote PDF, contracts, correspondence
      ├─ PO/Invoice: Embedded PO and invoice details
      ├─ Activity Log: Filterable event stream
      └─ Actions: What can be done right now (state-dependent)
            │
            ▼
CONTRACT MANAGEMENT
  ├─ Contract List
  └─ Contract Detail
      ├─ Overview: Terms, dates, value, vendor
      ├─ Line Items: Products covered
      ├─ Renewal History: Past renewals with outcomes
      ├─ Documents: Contract PDF, SOW, amendments
      └─ Clauses: Standard and negotiated terms
            │
            ▼
VENDOR MANAGEMENT
  ├─ Vendor List
  └─ Vendor Detail
      ├─ Profile: Contacts, payment terms, risk rating
      ├─ Contracts: All contracts with this vendor
      ├─ Renewals: Current and historical renewals
      ├─ POs: PO history
      ├─ Invoices: Invoice history
      └─ Scorecard: Performance metrics
            │
            ▼
FINANCIAL
  ├─ Invoice Queue
  ├─ PO Management
  ├─ Forecast Dashboard
  └─ Reconciliation Reports
            │
            ▼
REPORTS & ANALYTICS
  ├─ Renewal Pipeline Report
  ├─ SLA Compliance Report
  ├─ Vendor Performance Report
  ├─ Forecast Accuracy Report
  ├─ Audit Export
  └─ Custom Report Builder
            │
            ▼
ADMINISTRATION
  ├─ Users & Roles
  ├─ Policy Rules
  ├─ Approval Thresholds
  ├─ Notification Configuration
  ├─ Integration Management
  ├─ Reference Data (Vendors, Products)
  └─ Platform Health
```

## User Journeys

### Journey 1: Renewals Ops Manager — Morning Review

1. **Login** → Dashboard shows:
   - Renewals due in next 30/60/90 days (counts with trend)
   - SLA heat map (green/yellow/red by stage)
   - My team's workload (assignments per specialist)
   - Escalations requiring attention
   - Late renewals (past end date without decision)
2. **Click "30 Day Pipeline"** → Filtered renewal list
   - Sort by: end date, value, assignee, priority
   - See at a glance: which renewals are stuck, which are on track
3. **Click renewal with red SLA** → Renewal detail
   - See it's stuck at "Legal Review" — SLA breached 2 days ago
   - See escalation has already been triggered
   - Can reassign, add note, or escalate further
4. **Perform bulk assignment** → Select 10 unassigned renewals
   - Assign to S2 team members based on workload balancing
   - System sends notifications

### Journey 2: Procurement Specialist — PO Creation

1. **Login** → Dashboard shows assigned renewals
   - "Ready for PO" count (renewals approved, awaiting PO)
   - "Quote Needed" count (assigned but no quote yet)
   - "Pending Vendor" count (PO sent, awaiting acknowledgment)
2. **Click "Ready for PO"** → Renewal detail pre-populated
   - Vendor: auto-filled
   - Amount: from approved renewal
   - Budget code: from renewal
   - PO line items: derived from contract line items
3. **Review and adjust** if needed → One click "Create PO"
   - PO created in Draft status
   - Option to download PDF or send via email
4. **Send PO** → Status updates to "Sent"
   - Vendor notified via email with PO attachment
   - System tracks acknowledgment (click tracking on email)

### Journey 3: Financial Analyst — Invoice Matching

1. **Login** → Dashboard shows unmatched invoices
   - Count of new invoices received
   - Count of invoices in exception
   - Count of invoices ready for payment
2. **Click invoice** → Invoice detail with tri-match view
   - Left panel: Invoice details from vendor
   - Center panel: Matched PO details
   - Right panel: Renewal details
   - Variance highlighted in red/green
3. **If full match** → One click "Match & Approve"
   - Invoice status → "Matched"
   - Ready for payment scheduling
4. **If mismatch** → Exception view
   - System suggests possible resolutions
   - S3 selects action: accept (within tolerance), hold, escalate
   - If held: notification sent to S2

## UI Patterns

| Pattern | Implementation |
|---|---|
| **Detail Panel** | Right-side slide-over panel for viewing related entities without leaving the current page |
| **State Timeline** | Visual horizontal timeline showing current position in renewal lifecycle |
| **Bulk Actions** | Select multiple items from list view and perform an action on all (assign, export, escalate) |
| **Inline Edit** | Edit fields directly in detail view without entering a separate edit mode |
| **Smart Search** | Single search bar that searches across all entity types, with type-ahead and category results |
| **Notification Center** | Bell icon in header with unread count, categorized by priority |
| **Empty States** | Contextual guidance when no data exists, with next action button |
| **Loading Skeletons** | Skeleton screens during data fetch, never spinners for list/detail views |
| **Confirmation Dialogs** | For destructive or financial actions, with full context displayed |
| **Audit Trail Table** | Filterable, paginated table of all changes to an entity |

## Page Design Principles

- **Header zone:** Entity name, status badge, priority badge, key identifiers
- **Navigation zone:** Tabs or sections within the entity (Details, Timeline, Approvals, Documents, Activity)
- **Content zone:** Primary content for the selected tab
- **Actions zone:** Floating or persistent action bar with state-dependent buttons
- **Related zone:** Side panel or bottom section showing linked entities

## Accessibility

- WCAG 2.1 AA minimum
- Keyboard navigable for all workflows
- Screen reader support for state changes and notifications
- Color is never the sole indicator of status (icons + text + color)
