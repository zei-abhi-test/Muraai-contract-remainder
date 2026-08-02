# Phase 0 Audit: Current Codebase vs. Target Architecture

**Date:** 2026-07-20
**Scope:** MURAAI/backend (Flask) + MURAAI/frontend (React + Vite)

## Maturity Assessment

The codebase is **beyond MVP** — it has 20+ models, 19 route blueprints, a contract lifecycle state machine, configurable workflow engine, event-driven automation engine, APScheduler, storage abstraction (local + OneDrive), and a full React SPA with 23 pages. However, it was built incrementally without the target architecture in mind. The gap is in **architectural compliance** rather than feature absence.

---

## 1. Domain Model — Entity Gap Analysis

| Target Entity (DDD Spec) | Current State | Gap |
|---|---|---|
| **Renewal** (AR) | `ContractRenewal` model exists but is a simple junction table (no state machine, no lifecycle) | **CRITICAL** — needs full Renewal aggregate with 20-state machine |
| **ApprovalRecord** | `ContractApproval` + `WorkflowAssignmentStage` partially cover this | Needs to be part of Renewal aggregate with proper state machine |
| **UsageAttestation** | Does not exist | Must be created |
| **RenewalTimelineEntry** | `ActivityLog` partially covers this | Needs dedicated timeline entity optimized for renewal detail view |
| **Vendor** (AR) | `company_name` string on Contract/PO; no Vendor entity | Must be created as aggregate root |
| **Contract** (AR) | Exists but linked to `Customer` not `Vendor`; uses integer PK, not UUID | Needs refactoring |
| **ContractClause** | Does not exist | Must be created |
| **Product** (AR) | Exists with SKU | **Close** — needs UUID PK |
| **PurchaseOrder** (AR) | Exists | **Close** — needs UUID PK, proper state machine |
| **Invoice** (AR) | Exists | Needs full state machine (Received → Matched → Exception → Paid) |
| **PolicyRule** | Does not exist (rules in WorkflowRule are simpler) | Needs dedicated PolicyRule entity |
| **Budget** | Does not exist | Must be created |
| **SLAConfig** | Does not exist | Must be created |
| **EscalationRule** | Does not exist | Must be created |
| **ContractVersionHistory** | Does not exist | Must be created |
| **NotificationPreference** | `UserPreference` partially covers | Needs expansion |

### PK Strategy Gap (ADR-003)
- **Required:** UUID v4 for all entity PKs
- **Current:** Auto-increment integers everywhere
- **Impact:** Breaking change — requires full migration or new tables

### Status/ENUM Gap (ADR-002)
- **Required:** ENUMs at DB level (PostgreSQL) + VARCHAR fallback (SQLite)
- **Current:** Free-text strings everywhere; lifecycle service validates in app layer
- **Impact:** DB does not enforce valid states — inconsistent data possible

---

## 2. State Machine Gap Analysis

| Target State Machine | Current | Gap |
|---|---|---|
| **Contract** (6 states) | `contract_lifecycle.py` defines 11 statuses, 12 transitions | **Close** — but target has 6 states (simpler); current has 11. Need to reconcile. |
| **Renewal** (20 states) | Simple `ContractRenewal` with no state machine | **CRITICAL** — the flagship feature is mostly absent |
| **Purchase Order** (6 states) | Free-text status on PO model; `contract_lifecycle.py` has basic PO actions | Needs full state machine with ERROR/WARNING states |
| **Invoice** (7 states) | `effective_status()` on Invoice model computes OVERDUE | Needs full state machine with Matching, Exception, PendingPayment |
| **Task** (6 states) | `Task` model has free-text status | Needs proper state machine |
| **Approval** (5 states) | `ContractApproval` has free-text status | Needs proper state machine |
| **Document** (7 states) | `ContractDocument` has no state machine | Needs Uploading→Processing→Ready→Archived lifecycle |

### Key Architecture Gap
- **Target:** 7 state machines, each with explicit entry/exit actions, error states, recovery paths
- **Current:** Only Contract lifecycle has a state machine; others use free-text status
- **Action:** Implement all 7 state machines using a consistent pattern

---

## 3. System Architecture Gap Analysis

| Target Component | Current | Gap |
|---|---|---|
| **15 Domain Services** | ~8 service files (auth, lifecycle, workflow, automation, scheduler, storage, notification, task) | Missing: RenewalService, FinancialService, VendorService, PolicyService, BudgetService, DocumentService, UserService |
| **150+ REST Endpoints** | Good coverage (~80+ endpoints across 19 blueprints) | Missing renewal lifecycle endpoints; no `/api/v1/` prefix; no idempotency keys; no cursor pagination |
| **APScheduler + 11 Jobs** | Scheduler service exists with 3 jobs | Missing 8 jobs (renewal identification, SLA monitoring, stalled detection, etc.) |
| **Redis Event Bus** | Does not exist | No event-driven architecture — services are tightly coupled |
| **25+ Domain Events** | Automation engine has 10 trigger types but no formal event system | Events are string-based, not structured |
| **Email Service** (provider pattern) | Notification service exists with Resend + SMTP | Missing 11 template system; no priority/bulk queue |
| **File Storage** (provider pattern) | Storage abstraction exists with Local + OneDrive | **Close** — path convention needs alignment |
| **Notification Engine** (pipeline) | Basic notification sending | Missing: 4-stage pipeline, preference check, digest mode |
| **Renewal Engine** (standalone) | Does not exist | **CRITICAL** — the core of the platform |

---

## 4. API Gap Analysis

| Target Convention | Current | Gap |
|---|---|---|
| `/api/v1/` prefix | No version prefix | ADR-006 not applied |
| UUID PKs in URLs | Integer IDs (e.g., `/contracts/42`) | Breaking change |
| Explicit state transition endpoints | Some exist (renamed/merged) | Missing renewal transitions |
| Cursor pagination | No pagination standard | Page-based or none |
| Idempotency keys | Not implemented | Risk of duplicate processing |
| `allowed_actions` in responses | Not implemented | Frontend can't derive available actions |
| Consistent error format | `{ error, code, details }` partially | Needs standardization |

---

## 5. RBAC / Stakeholder Gap Analysis

| Target (12 stakeholders) | Current (8 roles) | Gap |
|---|---|---|
| S1: Renewals Ops Manager | Missing | Merge with CONTRACT_MANAGER? |
| S2: Procurement Specialist | Missing | Merge with CONTRACT_MANAGER? |
| S3: Financial Analyst | FINANCE | **Close** — needs refinement |
| S4: Legal Counsel | LEGAL | **Close** |
| S5: Business Owner | Missing | Needs new role |
| S6: Vendor Manager | Missing | Needs new role |
| S7: Contract Manager | CONTRACT_MANAGER | **Close** |
| S8: Finance Director / CFO | Missing (ADMIN covers) | Needs refinement |
| S9: System Administrator | ADMIN / SUPER_ADMIN | **Close** |
| S10: Compliance Officer | Missing | Needs new role |
| S11: Auditor | Missing | Needs new role |
| S12: Customer / Vendor Contact | Customer portal exists | Separate auth system |

### Key Gap
- Current has 8 roles with resource-level permissions
- Target has 12 stakeholders with granular, business-defined permissions
- Some current roles map to multiple target stakeholders

---

## 6. Database Schema Gap Analysis

| Target (21 tables, 20 ENUMs) | Current | Gap |
|---|---|---|
| Normalized schema with FK constraints | FK constraints exist | **Close** |
| UUID PKs | Integer auto-increment | Breaking change |
| ENUMs at DB level | No ENUMs — free-text strings | Data integrity risk |
| `contract_version_history` | Does not exist | Missing |
| Immutable `activity_log` (insert-only) | `ActivityLog` exists but allows updates | Needs restriction |
| Soft-delete with `deleted_at` | Rarely implemented | Missing pattern |
| 30+ indexes including partial | Unknown | Needs audit |
| Unique constraints | Some present (contract_number, sku) | Missing many (contract_id+year, etc.) |

---

## 7. Frontend Gap Analysis

| Target Feature | Current | Gap |
|---|---|---|
| **Contract Workspace** (21 sections) | `ContractWorkspace.tsx` + `ContractWizard.tsx` exist | Partial — needs role-adaptive UI, slide-over panels, action bar governed by state machine |
| **Renewal Workspace** (13 panels) | `RenewalsPage.tsx` exists | **CRITICAL** — needs full quad-grid layout, all 13 panels |
| **Mission Control Dashboard** (9 widgets) | `Dashboard.tsx` exists with dashboard components | Partial — needs all 9 widgets, 30-second rule, no vanity metrics |
| **Role-adaptive UI** | Theme toggle exists | No role-based view adaptation |
| **Keyboard shortcuts** | Ctrl+K for search | No full shortcut system |
| **Design system** | Tailwind CSS with some custom tokens | No formal design token system |

---

## 8. Code Quality & Testing Gap

| Aspect | Current | Gap |
|---|---|---|
| TypeScript (frontend) | Full TypeScript | **Good** |
| Error handling | Flask error handlers | No structured error catalog |
| Backend tests | Not found in codebase | **CRITICAL** — no tests |
| Frontend tests | `CalendarPage.test.tsx` only | **CRITICAL** — minimal tests |
| Linting | oxlint configured | **Good** |
| CI/CD | Not found | No automated pipeline |

---

## 9. Prioritized Remediation List

### Immediate (Phase 1 — Core Renewal Operations)

| Priority | Gap | Action | Effort |
|---|---|---|---|
| **P0** | No Renewal aggregate | Create Renewal entity with full 20-state machine, UUID PK, timeline entries | 3-4 weeks |
| **P0** | No usage attestation | Create UsageAttestation entity | 1 week |
| **P0** | No Renewal Workspace | Build 13-panel UI per design doc | 4-5 weeks |
| **P1** | No Vendor entity | Create Vendor aggregate, migrate contract references | 2-3 weeks |
| **P1** | Basic renewal engine | Build standalone RenewalEngine service | 2-3 weeks |
| **P1** | No tests | Add pytest for backend, vitest for frontend | 2 weeks |

### Medium (Phase 1-2)

| Priority | Gap | Action | Effort |
|---|---|---|---|
| **P2** | Integer PKs → UUID | Full migration or new tables | 3-4 weeks |
| **P2** | Free-text statuses → ENUMs | Database migration + app layer update | 1-2 weeks |
| **P2** | No event bus | Implement Redis Streams | 2 weeks |
| **P2** | No API versioning | Add `/api/v1/` prefix, migrate routes | 1-2 weeks |
| **P3** | 8 roles → 12 stakeholders | Expand RBAC model | 1-2 weeks |
| **P3** | No Mission Control | Build dashboard per design doc | 3 weeks |
| **P3** | Missing 6 state machines | Implement consistent pattern | 2-3 weeks |

### Later (Phase 3+)

| Priority | Gap | Action | Effort |
|---|---|---|---|
| **P4** | Invoice state machine | Full lifecycle implementation | 1-2 weeks |
| **P4** | Document state machine | Processing pipeline | 1-2 weeks |
| **P4** | PolicyRule entity | Policy engine expansion | 2 weeks |
| **P4** | SSL/TLS health monitoring | Security hardening | 1 week |
| **P5** | CI/CD pipeline | GitHub Actions | 1 week |
| **P5** | Contract Workspace refinement | Role-adaptive UI, action bar | 2-3 weeks |

---

## 10. Recommended Approach

### Strategy: "Wrap, don't rewrite"
The current codebase has too much working value to discard. Instead:
1. **Stabilize the domain first** (Sprint 0.5) — finalize aggregate boundaries, invariants, and entity relationships before any refactoring
2. **Spec before build** — produce a complete Renewal Aggregate Specification before touching code
3. **Build Contract as true AR** — everything (Products, Documents, Activities, Timeline, Renewals) hangs from Contract
4. **Event bus last** — build it only after all domain events are known, not guessed
5. **Postpone UUID migration** — integer PKs are acceptable until the domain model is stable
6. **Add tests first** — before refactoring any existing code, write tests to lock behavior

### Revised Sprint Plan

| Sprint | Focus | Deliverables |
|---|---|---|
| Sprint 0.5 | **Domain Stabilization** | Final aggregate boundaries, invariants, locked domain model, Renewal Aggregate Specification |
| Sprint 1 | **Core Contract Domain Modernization** | Final Contract aggregate, Product relationship cleanup, Document ownership, Timeline integration, Domain events, Policy hooks, Public API contract, Migration plan |
| Sprint 2 | **Renewal Aggregate** | Full aggregate: identity, 20-state machine, health/risk score, SLA, budget, quotes, approvals, PO, invoice, timeline, documents, emails, audit |
| Sprint 3 | **Activity & Timeline Engine** | Domain events, audit trail, timeline, structured activity log |
| Sprint 4 | **Event Bus** | Redis Streams, decoupled services, notifications, analytics, webhooks |
| Sprint 5 | **Mission Control + UI** | Operational dashboard, Contract Workspace, Renewal Workspace |
| Sprint 6 | **AI Features** | ML forecasting, risk prediction, automation expansion |

### Key Architectural Decision: Event Bus

The event bus is the biggest architectural opportunity. Current coupling:
```
ContractService → RenewalService → NotificationService  (everything calls everything)
```

Target:
```
Contract Activated → Domain Event → Timeline | Notification | Audit | Analytics | Scheduler | Email | Webhook | Mission Control
```

Nobody knows who is listening. That is enterprise architecture. But build it last — only after every event is known, not guessed.

### Key Architectural Decision: Renewal Aggregate

The Renewal is not just a 20-state machine. It is a complete business object:
```
Renewal {
  Identity, Current Stage, Health Score, Risk Score, SLA,
  Budget, Vendor Quote, Customer Response, Negotiation,
  Approvals, Purchase Order, Invoice, Payment,
  Timeline, Documents, Emails, Notes, Attachments,
  Automation, Audit
}
```
That is a Renewal Workspace. The specification must cover all of these before implementation begins.

### Key Architectural Decision: UUID Postponement

Integer PKs are acceptable to postpone. Unless the system has:
- External integrations that require UUIDs
- Distributed services generating IDs without coordination
- External references that must be non-enumerable

...integer keys won't block the Renewal redesign. Schedule UUID migration after the domain model is stable.

### Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| UUID migration breaks existing integrations | High | Medium | Dual-write during migration; deprecate old endpoints |
| Renewal Workspace scope too large for single sprint | High | Medium | Split into 2 sprints; deliverable per panel |
| No tests leads to regression during refactoring | High | High | Write tests before any refactoring; use contract tests |
| Integer→UUID migration on large dataset | Medium | Low | Generate UUIDs lazily; batch migration |
