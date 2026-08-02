# Capability Map

**Status:** Approved (Sprint 0.5)
**Date:** 2026-07-20
**Purpose:** Product map for CIOs, stakeholders, and engineering. Every module, aggregate, command, event, policy, and UI belongs to exactly one capability.

---

## Overview

```
Muraai Enterprise Platform
│
├── 01 Portfolio Management
├── 02 Contract Management
├── 03 Renewal Management          ⭐ Core
├── 04 Vendor Collaboration
├── 05 Customer Collaboration
├── 06 Document Management
├── 07 Financial Operations
├── 08 Workflow Automation
├── 09 Task Management
├── 10 Notification Management
├── 11 Reporting & Analytics
└── 12 Administration
```

---

## 01 Portfolio Management

| Aspect | Detail |
|---|---|
| **Purpose** | Executive visibility into the entire contract and renewal portfolio |
| **Stakeholders** | S1 (Ops Mgr), S8 (Finance Director), S10 (Compliance) |
| **Aggregates** | None (read-only projections) |
| **Key Data** | Contract count, renewal pipeline, financial forecast, risk heat map |
| **Policies** | None |
| **UI** | Mission Control Dashboard |

### Sub-capabilities

| Sub-capability | Description |
|---|---|
| 01.01 Pipeline Overview | Overall renewal pipeline by status, assignee, date range |
| 01.02 Risk Heat Map | Renewals by risk score, stalled count, SLA breaches |
| 01.03 Financial Forecast | Projected cash outflow by month/quarter, confidence intervals |
| 01.04 Portfolio Analytics | Spend by vendor, category, business unit, region |

---

## 02 Contract Management ⚡ Sprint 1

| Aspect | Detail |
|---|---|
| **Purpose** | Source of truth for all software maintenance agreements |
| **Stakeholders** | S1, S2, S4, S5, S7 |
| **Aggregate** | **Contract** (AR) |
| **Child Entities** | ContractLineItem, ContractDocument, ContractClause, ContractVersionHistory |
| **Key Commands** | CreateContract, ActivateContract, UpdateContract, TerminateContract, AddLineItem, UploadDocument, AddClause |
| **Key Events** | `contract.created`, `contract.activated`, `contract.updated`, `contract.expired`, `contract.terminated`, `contract.renewal_window_opened` |
| **Policies** | RenewalDetectionPolicy (listens for renewal_window_opened → creates Renewal) |
| **UI** | Contract Workspace |

### Sub-capabilities

| Sub-capability | Aggregate(s) | Commands | UI Widget |
|---|---|---|---|
| 02.01 Contract Lifecycle | Contract | Create, Activate, Terminate | Status stepper, action bar |
| 02.02 Line Items | ContractLineItem | Add, Update, Remove LineItem | Line items table with inline edit |
| 02.03 Documents | ContractDocument | Upload, Delete, Download | Document list with version history |
| 02.04 Clauses | ContractClause | Add, Update Clause | Clause list with deviation tracking |
| 02.05 Version History | ContractVersionHistory | (auto-generated) | Version diff view |
| 02.06 Renewal History | Renewal (reference) | (read-only from Renewal aggregate) | Renewal timeline |

---

## 03 Renewal Management ⭐ Core Capability

| Aspect | Detail |
|---|---|
| **Purpose** | Orchestrate every contract renewal from identification through payment |
| **Stakeholders** | S1, S2, S3, S4, S5, S8 |
| **Aggregate** | **Renewal** (AR) |
| **Child Entities** | ApprovalRecord, UsageAttestation, RenewalTimelineEntry, RenewalDocument, RenewalEmail, RenewalNote, RenewalTask |
| **Key Commands** | 27 commands (full spec in `renewal-aggregate-spec.md`) |
| **Key Events** | 33 events (full catalog in `event-catalog.md`) |
| **Policies** | AssignmentSLAPolicy, QuoteAwaitingPolicy, BudgetApprovalPolicy, LegalReviewSLAPolicy, BusinessApprovalEscalationPolicy, POFollowUpPolicy, StalledDetectionPolicy |
| **UI** | Renewal Workspace (13 panels) |

### Sub-capabilities

| Sub-capability | Aggregate(s) | Key Policies | UI Widget |
|---|---|---|---|
| 03.01 Renewal Lifecycle | Renewal (state machine) | StalledDetectionPolicy | 20-step progress tracker |
| 03.02 Quote Management | Renewal | QuoteAwaitingPolicy | Quote panel |
| 03.03 Budget Validation | Renewal (ref: BudgetService) | BudgetApprovalPolicy | Budget status panel |
| 03.04 Legal Review | ApprovalRecord | LegalReviewSLAPolicy | Approval chain cards |
| 03.05 Business Approval | ApprovalRecord + UsageAttestation | BusinessApprovalEscalationPolicy | Approval chain + attestation form |
| 03.06 PO Generation | PurchaseOrder (reference) | POFollowUpPolicy | PO status card |
| 03.07 Invoice Matching | Invoice (reference) | InvoiceMatchPolicy | Invoice status card |
| 03.08 Timeline | RenewalTimelineEntry | — | Vertical timeline |
| 03.09 Tasks | RenewalTask | — | Task list |
| 03.10 Documents | RenewalDocument | — | Document checklist |
| 03.11 Communication | RenewalEmail | — | Email thread view |
| 03.12 Risk & Health | Computed | RiskRecalculationPolicy | Risk gauge + health score |

---

## 04 Vendor Collaboration

| Aspect | Detail |
|---|---|
| **Purpose** | Manage vendor relationships, contacts, and performance |
| **Stakeholders** | S2, S6 (Vendor Manager) |
| **Aggregate** | **Vendor** (AR) |
| **Child Entities** | VendorContact, VendorScorecard |
| **Key Commands** | CreateVendor, UpdateVendor, AddContact, UpdateScorecard |
| **Key Events** | `vendor.created`, `vendor.updated`, `vendor.risk.rating.changed` |
| **Policies** | None |
| **UI** | Vendor profile page, scorecard widget |

### Sub-capabilities

| Sub-capability | Description |
|---|---|
| 04.01 Vendor Master | CRUD for vendor records, tax IDs, payment terms |
| 04.02 Vendor Contacts | Primary and secondary contacts per vendor |
| 04.03 Vendor Scorecards | Configurable performance scoring, auto-calculated from contract data |
| 04.04 Vendor Risk Rating | Manual or automated risk rating (low/medium/high/critical) |

---

## 05 Customer Collaboration ⏳ Phase 3.5

| Aspect | Detail |
|---|---|
| **Purpose** | External-facing portal for customers and vendors |
| **Stakeholders** | S12 (Customer), Vendors |
| **Aggregate** | None (secure link generation on top of internal aggregates) |
| **Architecture** | Secure, expiring, role-scoped links → read-only or limited-write views |
| **Customer Sees** | Renewal notice, upload PO, approve renewal, download invoice |
| **Vendor Sees** | Upload quote, upload invoice, respond to renewal, track status |

### Sub-capabilities

| Sub-capability | Description |
|---|---|
| 05.01 Secure Link Generation | Expiring tokens with granular permissions per resource |
| 05.02 Customer Portal | Customer-facing renewal status, document upload, approval |
| 05.03 Vendor Portal | Vendor-facing quote/invoice upload, communication, status tracking |
| 05.04 Audit Trail | Every external action logged to ActivityLog |

---

## 06 Document Management

| Aspect | Detail |
|---|---|
| **Purpose** | Store, version, and retrieve documents across all aggregates |
| **Stakeholders** | All |
| **Aggregates** | ContractDocument, RenewalDocument (per aggregate ownership) |
| **State Machine** | Document state machine (Uploading → Ready → Archived → Deleted) |
| **Storage** | Abstraction layer: Local, OneDrive, S3 |

### Sub-capabilities

| Sub-capability | Description |
|---|---|
| 06.01 Document Upload | File upload with virus scan, type validation, thumbnail generation |
| 06.02 Document Versioning | Version history per document group |
| 06.03 Document Retrieval | Download, preview, secure links |
| 06.04 Retention Management | Auto-archive and delete per policy |

---

## 07 Financial Operations

| Aspect | Detail |
|---|---|
| **Purpose** | Manage POs, invoices, matching, and forecasting |
| **Stakeholders** | S3 (Financial Analyst), S8 (Finance Director) |
| **Aggregate** | **PurchaseOrder** (AR), **Invoice** (AR) |
| **Child Entities** | POLineItem, InvoiceLineItem |
| **Key Commands** | CreatePO, SendPO, RecordInvoice, MatchInvoice, RecordPayment |
| **Key Events** | `po.created`, `po.sent`, `invoice.matched`, `invoice.exception.created` |
| **Policies** | InvoiceMatchPolicy, PaymentReminderPolicy |
| **UI** | PO workspace, Invoice workspace, Financial dashboard |

### Sub-capabilities

| Sub-capability | Aggregate | UI |
|---|---|---|
| 07.01 Purchase Orders | PurchaseOrder | PO workspace with state machine |
| 07.02 Invoice Management | Invoice | Invoice workspace with matching |
| 07.03 PO-Invoice Matching | Invoice + PurchaseOrder | Matching queue with exception handling |
| 07.04 Payment Tracking | Invoice | Payment schedule and status |
| 07.05 Financial Forecasting | Projection | Forecast dashboard |

---

## 08 Workflow Automation

| Aspect | Detail |
|---|---|
| **Purpose** | Configure and observe business automation |
| **Stakeholders** | S1, S9 (Admin) |
| **Primitives** | Policies (process managers), scheduled jobs |
| **Key Configuration** | SLA thresholds, escalation chains, reminder timing, routing rules |
| **UI** | Automation rules page, policy status dashboard |

### Sub-capabilities

| Sub-capability | Description |
|---|---|
| 08.01 SLA Management | Configurable SLA thresholds per approval type, per stage |
| 08.02 Escalation Chains | Multi-level escalation with timing and role targets |
| 08.03 Scheduled Jobs | Daily renewal detection, weekly summaries, health checks |
| 08.04 Policy Monitoring | View active policies, execution history, failures |

---

## 09 Task Management

| Aspect | Detail |
|---|---|
| **Purpose** | Track manual work items across the platform |
| **Stakeholders** | All |
| **Aggregate** | RenewalTask (within Renewal aggregate) |
| **State Machine** | Task state machine (Pending → Assigned → In Progress → Completed) |
| **UI** | Task list widget in Renewal Workspace, My Tasks dashboard widget |

### Sub-capabilities

| Sub-capability | Description |
|---|---|
| 09.01 Task Assignment | Assign tasks to users with due dates and priorities |
| 09.02 Task Lifecycle | Track task progress through state machine |
| 09.03 Task Dashboard | Personal and team task views in Mission Control |

---

## 10 Notification Management

| Aspect | Detail |
|---|---|
| **Purpose** | Deliver in-app and email notifications based on domain events |
| **Stakeholders** | All |
| **Architecture** | Event → NotificationEngine → Preference Check → Channel Dispatch (in-app, email, push) |
| **UI** | Notification center (bell dropdown), notification preferences page |

### Sub-capabilities

| Sub-capability | Description |
|---|---|
| 10.01 In-App Notifications | Real-time notification feed in the sidebar |
| 10.02 Email Notifications | HTML email templates for all event types |
| 10.03 Notification Preferences | Per-user config: which events, which channels, digest vs. immediate |
| 10.04 Digest Mode | Daily/weekly digest for low-priority notifications |

---

## 11 Reporting & Analytics

| Aspect | Detail |
|---|---|
| **Purpose** | Exportable, filterable reports for stakeholders and compliance |
| **Stakeholders** | S10 (Compliance), S11 (Auditor), S1, S8 |
| **Data Sources** | ActivityLog (global timeline projection), aggregate data |
| **UI** | Reports page, Audit Export page, Mission Control widgets |

### Sub-capabilities

| Sub-capability | Description |
|---|---|
| 11.01 Audit Export | Full activity log export for SOC2/SOX compliance |
| 11.02 Operational Reports | Renewal pipeline, SLA compliance, assignee workload |
| 11.03 Financial Reports | Forecast vs. actual, spend by vendor/category |
| 11.04 Custom Reports | Configurable report builder (future) |

---

## 12 Administration

| Aspect | Detail |
|---|---|
| **Purpose** | User management, role configuration, system settings |
| **Stakeholders** | S9 (Admin) |
| **Aggregate** | **User** (AR) |
| **Child Entities** | Organization, UserPreference, Role (via RoleAssignment) |
| **UI** | Users page, Settings page, Role configuration |

### Sub-capabilities

| Sub-capability | Description |
|---|---|
| 12.01 User Management | Create, update, deactivate users |
| 12.02 Role-Based Access | Configure roles and resource-level permissions |
| 12.03 System Settings | Platform-wide configuration (email, storage, integrations) |
| 12.04 Integration Management | Configure ERP, CLM, SSO integrations |
| 12.05 Health Monitoring | System health status, job history, error logs |

---

## Capability → Aggregate → UI Mapping

```
Portfolio Management ──► Mission Control Dashboard
Contract Management  ──► Contract Aggregate ──► Contract Workspace
Renewal Management   ──► Renewal Aggregate  ──► Renewal Workspace
Vendor Collaboration ──► Vendor Aggregate   ──► Vendor Profile Page
Financial Operations ──► PO + Invoice Agg.  ──► PO Workspace / Invoice Workspace
Task Management      ──► RenewalTask        ──► Task Widget (in Renewal)
Notification Mgmt    ──► Event-driven       ──► Notification Center
Administration       ──► User Aggregate     ──► Settings / Users Pages
```

---

## Capability → Stakeholder Matrix

| Capability | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 | S10 | S11 | S12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Portfolio Management | ✓ | | | | | | | ✓ | | ✓ | | |
| Contract Management | ✓ | ✓ | | ✓ | ✓ | | ✓ | | | ✓ | ✓ | |
| Renewal Management | ✓ | ✓ | ✓ | ✓ | ✓ | | | ✓ | | | | |
| Vendor Collaboration | | ✓ | | | | ✓ | | | | | | |
| Customer Collaboration | | | | | | | | | | | | ✓ |
| Document Management | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | ✓ | ✓ | ✓ | ✓ |
| Financial Operations | | | ✓ | | | | | ✓ | | | | |
| Workflow Automation | ✓ | | | | | | | | ✓ | | | |
| Task Management | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | | | |
| Notification Mgmt | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | ✓ | ✓ | | |
| Reporting | ✓ | | | | | | | ✓ | | ✓ | ✓ | |
| Administration | | | | | | | | | ✓ | | | |
