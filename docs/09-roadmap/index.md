# Muraai / Project Atlas — Product Roadmap

**Updated:** 2026-07-20

---

## Architecture Identity

**Product name:** Muraai
**Architecture codename:** Project Atlas (v2.0)

All internal documentation, code, and technical discussions reference "Atlas" for the architecture. "Muraai" remains the product name for customers and users.

See `docs/00-constitution/architecture-identity.md` for full convention details.

---

## Architecture Volumes

Every sprint produces or updates one or more volumes. Some volumes are cross-cutting (support all sprints).

| Vol | Title | Type | Status |
|---|---|---|---|
| 00 | Constitution (ADR, Capability Map, Architecture Identity) | Cross-cutting | Active |
| 01 | Business Domain Model | Domain | Draft |
| 02 | (reserved) | — | — |
| 03 | Domain Model (Aggregate Specs, Event Catalog) | Domain | Active |
| 04 | Policies & Process Managers | Domain | Planned (Sprint 2) |
| 05 | UI Specifications | UX | Active |
| 06 | Migration Strategy | Cross-cutting | Draft (Sprint 1) |
| 07 | API Specifications | Engineering | Draft (Sprint 1) |
| 08 | Sequence Diagrams & Failure Modes | Engineering | Draft (Sprint 1) |
| 09 | Roadmap | Cross-cutting | Active |
| 10 | Architecture Decision Records | Cross-cutting | Active |
| **11** | **Observability Architecture** | **Cross-cutting** | **Draft** |
| **12** | **Non-Functional Requirements** | **Cross-cutting** | **Draft** |
| **13** | **Integration Architecture** | **Cross-cutting** | **Draft** |
| 14+ | Future volumes | — | — |

---

## Sprint Overview

| Sprint | Focus | Status | Deliverables |
|---|---|---|---|
| Phase 0 | Foundation — codebase audit | Complete | Gap analysis, prioritized remediation |
| Sprint 0.5 | Domain Stabilization | Complete | Aggregate boundaries, invariants, Renewal spec, Event Catalog (57 events), ADRs 008-012, Capability Map |
| **Sprint 1** | **Core Contract Domain Modernization** | **Approved ✓** | **Contract Constitution, Aggregate Spec, Workspace Spec, Migration Strategy, API Contract, Event Catalog (81 events), 8 Sequence Diagrams, Failure Mode Analysis** |
| **Sprint 2** | **Renewal Domain Implementation** | **Proposed** | **Renewal Aggregate (code), Policy Engine, Timelines, Event Emission, Projections, Operational Inbox, Performance Baseline** |
| Sprint 3 | Dashboard & Mission Control | Planned | Mission Control UI, aggregate timelines UI, health indicators, role-filtered dashboards |
| Sprint 4 | Event Bus Infrastructure | Planned | Event bus implementation, subscription management, dead letter queue UI, replay capability |
| Sprint 5 | Financial Operations (PO + Invoice) | Planned | PO aggregate, Invoice aggregate, matching engine, exception workflow |
| Sprint 6 | Vendor Management + Integrations | Planned | Vendor aggregate, SAP/Oracle connectors, webhook system |
| Sprint 7 | Notification Engine + Collaboration | Planned | Real-time notifications, Slack/Teams integration, escalation framework |
| Phase 3.5 | External Collaboration Portal | Planned | Secure expiring links, customer/vendor portals, no-login access |
| Sprint 8 | Search, Analytics, Reporting | Planned | Full-text search, custom reports, export pipeline |
| Sprint 9 | AI Platform | Planned | ML forecasting, risk scoring, auto-classification |
| Sprint 10+ | Enterprise Scale | Future | SSO, RBAC refinement, multi-tenant, SOC 2 |

---

## Phase 0: Foundation Audit (Complete)

### Objective
Understand the current codebase, identify what aligns with the vision and what must be refactored.

### Deliverables
- Complete domain model audit — which entities map to the target model, which are missing
- State machine audit — do current entities have proper state machines?
- Permission audit — does current RBAC match stakeholder model?
- Integration audit — what external systems are connected, and how?
- Gap analysis with prioritized remediation list

### Key Output
`docs/00-constitution/phase-0-audit.md`

---

## Sprint 0.5: Domain Stabilization (Complete)

### Objective
Stabilize aggregate boundaries, event catalog, and architectural primitives before any code is written.

### Deliverables
- Domain Stabilization Document (`docs/03-domain-model/domain-stabilization.md`)
- Renewal Aggregate Specification (`docs/03-domain-model/renewal-aggregate-spec.md`)
- Event Catalog — 57 events across 7 domains (`docs/03-domain-model/event-catalog.md`)
- Capability Map — 12 capabilities (`docs/00-constitution/capability-map.md`)
- ADRs 008-012 (Contract-Renewal separation, Event-driven, No hard deletes, Timeline projections, Policies)
- Roadmap updated with Phase 3.5 (External Collaboration Portal)

---

## Sprint 1: Core Contract Domain Modernization (Approved ✓)

### Objective
Modernize the Contract aggregate from a CRUD entity into the central business object of Atlas.

### Deliverables
| # | Deliverable | File |
|---|---|---|
| D0 | Contract Constitution | `docs/03-domain-model/contract-constitution.md` |
| D1 | Contract Aggregate Spec | `docs/03-domain-model/contract-aggregate-spec.md` |
| D2 | Contract Workspace Spec | `docs/05-ui/contract-workspace-spec.md` |
| D3 | Migration Strategy | `docs/06-migration/migration-strategy.md` |
| D4 | API Contract | `docs/07-api/contract-api-spec.md` |
| D5 | Event Catalog (expanded) | `docs/03-domain-model/event-catalog.md` |
| D6 | Sequence Diagrams (8 flows) | `docs/08-sequences/contract-sequence-diagrams.md` |
| D7 | Failure Mode Analysis | `docs/08-sequences/failure-mode-analysis.md` |

### Status
All 7 deliverables complete and approved by Architecture Review Board.

---

## Sprint 2: Renewal Domain Implementation (Proposed)

### Objective
Implement the Renewal Aggregate as a fully functional domain, operationalize the Policy Engine, and ship the Operational Inbox.

### Deliverables
| # | Deliverable | Type |
|---|---|---|
| D1 | Renewal Aggregate Implementation | Code |
| D2 | Renewal Workspace Specification | Document |
| D3 | Policy Engine Implementation (9 policies) | Code + Document |
| D4 | Aggregate Timeline Implementation | Code |
| D5 | Event Emission (outbox pattern) | Code |
| D6 | Projection Handlers (3 projections) | Code |
| D7 | Operational Inbox Implementation | Code + Document |
| D8 | Performance Baseline | Test Results |
| D9 | Test Suite (400+ tests) | Tests |

Full plan: `docs/09-roadmap/sprint-2-plan.md`

---

## Cross-Cutting Architecture Volumes

The following volumes were produced in parallel with Sprint 1 and inform all future sprints:

### Volume 11: Observability Architecture
**File:** `docs/11-observability/observability-architecture.md`

Covers structured JSON logging, correlation IDs (propagated user→API→aggregate→event→policy→projection), Prometheus metrics (application + infrastructure + business), OpenTelemetry distributed tracing, Grafana dashboards, alerting rules, health check endpoints.

### Volume 12: Non-Functional Requirements
**File:** `docs/12-nfr/non-functional-requirements.md`

Defines availability (99.9%), performance/latency targets per workspace, RTO/RPO, security (encryption, auth, audit), caching strategy, browser support, localization, data retention, compliance, rate limits, error budget, and NFR verification per sprint.

### Volume 13: Integration Architecture
**File:** `docs/13-integration/integration-architecture.md`

Defines the connector framework (Inbound, Outbound, Sync), adapter pattern for external payload→canonical event mapping, credential management (Vault), retry/circuit breaker/DLQ patterns, webhook system (inbound + outbound), authentication methods, and integration roadmap covering Microsoft, SAP, Oracle, Salesforce, Google, Slack, Teams, and 10+ more.

---

## Phase 3: Vendor & Portfolio Management

### Objective
Vendor Managers and Business Owners can analyze vendor performance, negotiate renewals, and optimize the vendor portfolio.

### Epics
- Vendor scorecards (configurable dimensions, automated data population)
- Portfolio analytics (spend by vendor/category/region, renewal concentration risk)
- Negotiation workspace (multi-renewal view, aggregated leverage data, what-if scenarios)
- Dashboards for Vendor Manager and Business Owner

### Dependencies
- Sprint 2 Renewal Aggregate (data source)
- Sprint 5 PO + Invoice (financial data)
- Volume 13 Integration Architecture (ERP data sync)

---

## Phase 3.5: External Collaboration Portal

### Objective
External stakeholders interact with Muraai without logging into the internal application. Secure, expiring, role-scoped links provide controlled access.

### Epics
- Secure link generation (configurable expiry, per-resource scoping, role-based permissions)
- Customer portal (view renewal notices, upload documents, approve requests)
- Vendor portal (upload quotes, upload invoices, track PO status)
- Full audit trail for all external actions

### Dependencies
- Sprint 1 Contract Aggregate
- Sprint 2 Renewal Aggregate
- Sprint 5 PO + Invoice

---

## Phase 4: Compliance & Enterprise

### Objective
Platform meets enterprise security, compliance, and scalability requirements.

### Epics
- Enterprise authentication (SAML/OIDC, SCIM, MFA enforcement)
- RBAC refinement (granular permission sets, resource-level scoping, temporary elevation)
- Compliance features (SOC 2 evidence export, data retention policies, encryption key management)
- Multi-tenant isolation (schema-per-tenant or row-level security)
- Audit dashboard

### Dependencies
- Sprint 1 RBAC foundation
- Sprint 2+ aggregate implementations
- Volume 12 NFRs

---

## Phase 5: Intelligence & Scale

### Objective
Platform provides predictive intelligence, deeper automation, and marketplace extensibility.

### Epics
- ML forecasting (renewal risk scoring, price prediction, auto-classification)
- Automation expansion (smart defaults, automated vendor communication, conditional auto-approval)
- Integrations marketplace (public API, certified integrations, plugin architecture)
- Platform scale (100K+ renewals per tenant, real-time collaboration, custom dashboards)

---

## Dependency Map

```
Phase 0 ──► Sprint 0.5 ──► Sprint 1 ──► Sprint 2 ──► Sprint 3 ──► ...
  │                            │            │            │
  │                            │            │            └── Depends on:
  │                            │            │               • Sprint 2 event emission
  │                            │            │               • Sprint 2 operational inbox
  │                            │            │
  │                            │            └── Depends on:
  │                            │               • Sprint 1 Contract Aggregate
  │                            │               • Sprint 0.5 Renewal spec + Event Catalog
  │                            │               • Volumes 11, 12, 13 (observability, NFRs, integration)
  │                            │
  │                            └── Depends on:
  │                               • Sprint 0.5 aggregate boundaries
  │                               • Phase 0 audit findings
  │
  └── Foundation for all sprints
```

Cross-cutting volumes (11, 12, 13) support ALL sprints and are maintained continuously.

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Sprint 2 timeline slips (Renewal has 27 commands, 20-state machine) | Schedule slip | Medium | 4-week sprint with daily standups. Reduce scope if needed (drop 2 of 9 policies). |
| Event bus implementation delays (Sprint 4) | Downstream sprint delays | Low | Outbox pattern in Sprint 2 minimizes event bus dependency. Sprints 5+ can use outbox directly. |
| ERP integration complexity understimated | Sprint 5+ delay | Medium | Volume 13 Integration Architecture provides framework. Start SAP/Oracle research in Sprint 3. |
| Performance targets (500 concurrent users) not met | User experience degradation | Medium | Performance baseline in Sprint 2. Early warning before downstream sprints. |
| Team unfamiliarity with DDD | Sprint 2 velocity lower | High | Comprehensive spec documents. Pair programming initial sprints. |
