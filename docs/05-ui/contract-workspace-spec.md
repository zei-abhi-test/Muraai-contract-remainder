# Contract Workspace Specification

**Status:** Draft (Sprint 1)
**Date:** 2026-07-20
**Purpose:** Business specification for the Contract Workspace — the operational cockpit for managing a single contract. Not an implementation spec.

---

## Design Philosophy

The Contract Workspace is an **operational cockpit**, not a form. It answers every question a stakeholder might have about a contract without requiring navigation to other pages. Every section must justify its existence by answering a specific stakeholder question.

### The 30-Second Rule

A stakeholder should be able to look at the workspace and answer "Is this contract healthy?" within 30 seconds. All critical information must be visible above the fold. Less critical information lives in expandable sections or slide-over panels.

---

## Section 1: Header

### Purpose
Identify the contract at a glance. Establish identity, status, and urgency.

### Stakeholder Question
"What contract is this and how urgent is it?"

### Content
| Element | Data Source | Justification |
|---|---|---|
| Contract name | `contract.contract_name` | Primary identifier |
| Contract number | `contract.contract_number` | Official reference for communication |
| Vendor name | `vendor.name` (via vendor_id) | Who the contract is with |
| Status badge | `contract.status` | Current lifecycle position |
| Health indicator | Computed health status | Urgency at a glance (green/yellow/red) |
| Action button | Based on `allowed_actions` | Next logical action for current user |

### Business Rules
- Status badge colors: DRAFT=gray, ACTIVE=green, EXPIRED=red, TERMINATED=orange, INCONSISTENT=yellow (flashing), ARCHIVED=silver
- Health indicator only shown for ACTIVE contracts
- Action button text changes per status: "Activate" (DRAFT), "Edit" (ACTIVE), "Terminate" (ACTIVE), "Restore" (EXPIRED/TERMINATED for admins)

---

## Section 2: Overview

### Purpose
The first thing a stakeholder sees. A summary card that answers "Should I care about this contract right now?"

### Stakeholder Question
"What do I need to know about this contract in 5 seconds?"

### Content
| Element | Justification |
|---|---|
| Contract value (`total_contract_value`) | Financial materiality |
| Line item count | Scope of coverage |
| Days until end / Days expired | Temporal urgency |
| Last modified date | Is the data current? |
| Next renewal date | Forward-looking action trigger |
| Current assignee (user_id → name) | Who owns this? |

### Business Rules
- For EXPIRED contracts, show "X days ago" in red
- For DRAFT contracts, show "Not yet activated"
- Line item count is a link → scrolls to Products section

---

## Section 3: Current Status

### Purpose
Show where the contract is in its lifecycle and what actions are available to the current user.

### Stakeholder Question
"What can I do with this contract right now?"

### Content
| Element | Justification |
|---|---|
| Lifecycle stepper (6 states) | Visual position in DRAFT→ACTIVE→EXPIRED/TERMINATED |
| Current state description | Business-readable explanation |
| Allowed actions (role-filtered) | What this user can do |
| Last transition info | When and who moved it here |

### Business Rules
- Actions are rendered as buttons, grayed out with tooltip if not permitted
- Stepper is clickable: clicking a past state opens the version history snapshot
- Transitions that emit events show the event name as a tooltip

---

## Section 4: Health

### Purpose
Operational health assessment. Only shown for ACTIVE contracts.

### Stakeholder Question
"Is this contract at risk of causing problems?"

### Content
| Element | Justification |
|---|---|
| Days until end (with color) | Temporal urgency — is renewal coming? |
| Health status label | Healthy / Attention / Warning / Critical / Expired |
| Renewal window indicator | Is the contract in its renewal window? |
| Notification status | Is the owner being notified? |
| Last health check timestamp | When was this last evaluated? |

### Business Rules
- Health is computed, not stored (see Contract Aggregate Spec §8)
- Renewal window indicator shows: "Not yet" / "Open for renewal" / "Past due"
- Notification status links to notification preferences

---

## Section 5: Products (Line Items)

### Purpose
The products covered under this contract, their quantities, rates, and totals.

### Stakeholder Questions (by role)
- S2 (Procurement): "What products are covered and at what rates?"
- S3 (Finance): "What is the financial breakdown?"
- S4 (Legal): "What scope does this agreement cover?"

### Content
| Element | Justification |
|---|---|
| Product table | Core data: product name, SKU, quantity, rate, discount, tax, line total |
| Column totals | Financial totals for each column |
| Add/Edit/Remove actions | Maintain line items (role-gated) |
| Product snapshot indicator | Shows whether product data is current or outdated |

### Business Rules
- Read-only for non-editors (Legal, Business Owner)
- Adding a product auto-populates rate from Product catalog, allows override
- Editing a product creates a new product_snapshot (old snapshot preserved for audit)
- Removing a line item with renewal history shows a warning

---

## Section 6: Renewals

### Purpose
Renewal history and current renewal status. Connects the Contract workspace to the Renewal aggregate.

### Stakeholder Questions
- S1: "When was the last renewal? Is there one in progress?"
- S2: "What was the previous renewal value?"

### Content
| Element | Justification |
|---|---|
| Renewal count | How many times has this been renewed? |
| Latest renewal status | Is a renewal currently in progress? |
| Renewal history list | Past renewals with year, value, status |
| Link to Renewal Workspace | Deep-link to active renewal |
| "Create Renewal" button (auto or manual) | Trigger new renewal |

### Business Rules
- Renewal creation is normally automatic (triggered by renewal window)
- Manual creation available for off-cycle renewals (admin only)
- Clicking a past renewal opens its read-only snapshot
- Active renewal is shown with a progress indicator (percent complete)

---

## Section 7: Timeline

### Purpose
Chronological history of all state changes. Audit trail for the contract.

### Stakeholder Questions
- S10 (Compliance): "What happened to this contract and when?"
- S11 (Auditor): "Who changed what and why?"

### Content
| Element | Justification |
|---|---|
| Vertical timeline | Chronological list of events |
| Event type icon | Visual distinction (create=plus, activate=play, etc.) |
| Performed by | User who made the change |
| Timestamp | When it happened |
| Metadata expand | Click to see full event payload |

### Business Rules
- Timeline is read-only and immutable
- Data source: contract_version_history + domain events
- Filterable by event type
- Paginated (20 per page, infinite scroll)

---

## Section 8: Documents

### Purpose
All documents attached to this contract.

### Stakeholder Questions
- S4 (Legal): "Is the signed SOW attached?"
- S2 (Procurement): "Can I upload the vendor's latest quote?"
- S11 (Auditor): "Are all required documents present?"

### Content
| Element | Justification |
|---|---|
| Document list | File name, type, size, upload date, uploader |
| Upload button | Add new document (role-gated) |
| Delete button | Remove document (role-gated) |
| Version indicator | For versioned documents |
| Preview link | Open document in new tab |
| Required document checklist | Configurable list of must-have docs per contract type |

### Business Rules
- Documents are per-contract (not per-renewal)
- Required document checklist is configured by contract type
- Upload validates file type and size
- Document deletion is soft (document.mark deleted, not hard delete)

---

## Section 9: Communications

### Purpose
Record of all vendor-facing communications related to this contract and its renewals.

### Stakeholder Question
"What has been communicated to the vendor about this contract?"

### Content
| Element | Justification |
|---|---|
| Email list | Subject, sender, recipient, date |
| Email type filter | Quote request, negotiation, PO delivery, follow-up |
| Direction indicator | Inbound vs. outbound |
| Expand to read | Full email body |
| Links to Renewal | Each email links to its source renewal |

### Business Rules
- Data source: RenewalEmail from Renewal aggregate
- Displayed here for cross-contract visibility
- Read-only outside the Renewal workspace

---

## Section 10: Financial Summary

### Purpose
Financial overview of the contract. Shown to users with financial data access.

### Stakeholder Questions
- S3 (Finance): "What is the total value? What has been spent and what remains?"
- S8 (Finance Director): "How does this compare to budget?"

### Content
| Element | Justification |
|---|---|
| Total contract value | Sum of all line item totals |
| Spend to date | Sum of all approved renewals |
| Remaining value | Contract value minus spend to date |
| Currency | Display currency |
| Billing frequency | Annual, quarterly, monthly |
| Related POs | Links to purchase orders from renewals |
| Related Invoices | Links to invoices from renewals |

### Business Rules
- Financial data is hidden from roles without financial permission
- Spend to date is computed from completed renewals, not directly stored
- Clicking a PO or Invoice opens its respective workspace

---

## Section 11: Tasks

### Purpose
Tasks associated with this contract or its renewals.

### Stakeholder Question
"What still needs to be done for this contract?"

### Content
| Element | Justification |
|---|---|
| Open tasks list | Title, assignee, due date, priority |
| Create task button | Add new task (role-gated) |
| Complete task | Mark task done |
| Task count | Badge showing number of open tasks |

### Business Rules
- Data source: RenewalTask from Renewal aggregate
- Tasks are shown for all renewals under this contract
- Completed tasks are hidden by default (toggle to show)

---

## Section 12: Approvals

### Purpose
Current and past approval chains for renewals under this contract.

### Stakeholder Questions
- S1: "What approvals are pending?"
- S5 (Business Owner): "What do I need to approve?"

### Content
| Element | Justification |
|---|---|
| Active approval chain | Current renewals in approval with status per approver |
| SLA deadline indicators | Countdown or overdue per approval |
| Past approvals | Historical approval records |
| Approve/Reject buttons | For pending items this user can act on |

### Business Rules
- Data source: ApprovalRecord from Renewal aggregate
- This section is read-only if the user has no pending approvals
- Approve/Reject buttons open a confirmation dialog

---

## Section 13: Analytics

### Purpose
Trend data and insights for this contract.

### Stakeholder Questions
- S6 (Vendor Manager): "Is pricing trending up or down for this vendor?"
- S8 (Finance Director): "What is the value trend over renewals?"

### Content
| Element | Justification |
|---|---|
| Value trend chart | Contract value per renewal year |
| Discount trend | Discount percentage per renewal |
| Renewal cycle time | Days from start to completion per renewal |
| Vendor comparison | This contract vs. other contracts with same vendor |

### Business Rules
- Data source: Renewal history + computed metrics
- Charts are SVG — exportable to PNG
- This section is expandable/collapsible (advanced users)

---

## Section 14: Related Organizations

### Purpose
All organizations associated with this contract.

### Stakeholder Question
"Who is involved in this contract?"

### Content
| Element | Justification |
|---|---|
| Vendor card | Vendor name, code, tier, risk rating |
| Vendor contacts list | Name, email, phone, role |
| Link to Vendor Workspace | Deep-link to vendor profile |
| Internal contacts | Users with roles on this contract |

---

## Section 15: Quick Actions

### Purpose
The most common actions for this contract, accessible without scrolling.

### Stakeholder Question
"What can I do right now?"

### Content
| Element | Justification |
|---|---|
| Action buttons | Role-filtered: edit, activate, terminate, upload doc, add line item, create renewal |
| Keyboard shortcuts | Power user efficiency |
| Context-dependent | Only show actions valid for current status |

---

## Section Visibility by Status

| Section | DRAFT | ACTIVE | EXPIRED | TERMINATED | INCONSISTENT | ARCHIVED |
|---|---|---|---|---|---|---|
| Header | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Overview | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Current Status | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Health | | ✓ | ✓ | | | |
| Products | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Renewals | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Timeline | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Documents | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Communications | | ✓ | ✓ | ✓ | | |
| Financial Summary | | ✓ | ✓ | ✓ | | |
| Tasks | | ✓ | ✓ | ✓ | | |
| Approvals | | ✓ | ✓ | ✓ | | |
| Analytics | | ✓ | ✓ | | | |
| Related Organizations | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Quick Actions | ✓ | ✓ | ✓ | ✓ | ✓ | |

---

## Accessibility Requirements

- All sections are keyboard-navigable
- Health indicators use both color and text labels (not color alone)
- Timeline entries have `aria-label` with full event description
- Action buttons have descriptive text, not just icons
- Skip-to-content link at top
- Focus management on modals and slide-over panels

---

## Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| ≥1280px (desktop) | 2-column grid: main content (left) + sidebar (right). Timeline full width at bottom. |
| 768-1279px (tablet) | Single column. Sections stack vertically. Quick Actions as floating button. |
| <768px (mobile) | Single column. Collapsible sections. Actions in bottom sheet. |

---

## Data Sources Summary

| Section | Primary Aggregate | Secondary Source |
|---|---|---|
| Header | Contract | Vendor |
| Overview | Contract | ContractLineItem (aggregated) |
| Current Status | Contract (state machine) | ContractVersionHistory |
| Health | Contract (computed) | — |
| Products | ContractLineItem | Product (snapshot) |
| Renewals | Renewal | — |
| Timeline | ContractVersionHistory | Domain event store |
| Documents | ContractDocument | — |
| Communications | RenewalEmail (via Renewal) | — |
| Financial Summary | Contract + Renewal + PO + Invoice | — |
| Tasks | RenewalTask (via Renewal) | — |
| Approvals | ApprovalRecord (via Renewal) | — |
| Analytics | Renewal history (computed) | — |
| Related Organizations | Vendor + User | — |
| Quick Actions | Contract (state machine + role) | — |
