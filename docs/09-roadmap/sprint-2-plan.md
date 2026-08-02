# Sprint 2 — Renewal Domain Implementation

**Status:** Proposed
**Date:** 2026-07-20
**Parent:** Project Atlas / Muraai
**Prerequisites:** Sprint 1 (Contract Aggregate specification) — Approved

---

## Sprint Goal

Implement the Renewal Aggregate as a fully functional domain, operationalize the Policy Engine, and ship the Operational Inbox as the user's default landing page.

This is the first sprint where code is written against the new Atlas architecture.

---

## Deliverables

### D1. Renewal Aggregate Implementation (Code)
**File:** `MURAAI/backend/src/renewal/` (new directory)

- Full Renewal Aggregate with all 7 child entities (Renewal, LineItem, Email, Task, Approval, Document, Communication)
- All 27 commands with validation and state machine guards
- All 33 domain events emitted on state transitions
- 20-state state machine with entry/exit actions and SLA timers
- Repository pattern (interface + SQLAlchemy implementation)
- Unit tests: 90%+ coverage on aggregate logic
- Integration tests: all 33 event emissions verified
- No hard deletes — all entities use soft delete

### D2. Renewal Workspace Specification (Document)
**File:** `docs/05-ui/renewal-workspace-spec.md`

- Business cockpit specification following Contract Workspace format
- Sections: Header, Overview, Current Status, Quote, Negotiation, Budget, Legal, Business Approval, Attestation, PO Status, Invoice Status, Timeline, Documents, Communications, Tasks, Approvals, Analytics, Quick Actions
- Each section justified by stakeholder need
- Visibility by status table
- Accessibility requirements
- Responsive behavior (desktop, tablet, mobile)

### D3. Policy Engine Implementation (Code + Document)
**File:** `MURAAI/backend/src/policies/` (new directory)

- Base Policy class with event subscription, command emission, error handling
- Implement initial policies:
  - `RenewalDetectionPolicy` — opens renewal window, creates renewal
  - `StalledEscalationPolicy` — detects stalled renewals, escalates
  - `SLABreachPolicy` — detects missed deadlines
  - `QuoteAwaitingPolicy` — follows up on pending quotes
  - `BudgetApprovalPolicy` — routes to budget approval chain
  - `LegalReviewSLAPolicy` — tracks legal review time
  - `BusinessApprovalEscalationPolicy` — escalates overdue business approvals
  - `InvoiceMatchPolicy` — matches invoice against PO
  - `POFollowUpPolicy` — follows up on unacknowledged POs
- Policy test suite: unit tests + event→command wiring tests
- Policy documentation: `docs/04-policies/policy-engine-spec.md`

### D4. Aggregate Timeline Implementation (Code)
**File:** `MURAAI/backend/src/timeline/` (new directory)

- Timeline projection for Contract and Renewal aggregates
- Event-driven: subscribes to domain events, writes timeline entries
- Timeline query API (paginated, filterable by event type)
- Timeline data source: `contract_version_history` and `renewal_version_history`
- No direct writes — timeline is always a projection

### D5. Event Emission Implementation (Code)

- Outbox pattern: events written to DB in same transaction as aggregate
- Background worker: polls outbox, publishes to event bus
- Idempotency handling per Event Catalog §10
- Retry with exponential backoff
- Dead letter queue for failed events

### D6. Projection Handlers (Code)

- Implement projection handlers for:
  - `ContractHealthProjection` — recomputes contract health on relevant events
  - `RenewalStatusProjection` — maintains denormalized renewal status
  - `VendorRiskProjection` — recomputes vendor risk on renewal events
- Projection consistency checks (compare projection to aggregate source)
- Projection rebuild command (admin-initiated)

### D7. Operational Inbox Implementation (Code + Document)

**File:** `docs/05-ui/operational-inbox-spec.md` (completed)
**Code:** `MURAAI/backend/src/inbox/` (new directory)

- Inbox item data model (`inbox_item` table)
- Inbox item CRUD API (create by policy, read by user, update status)
- Policy→Inbox wiring: all policies emit `CreateInboxItem` commands
- Auto-completion: events resolve related inbox items
- Real-time updates via WebSocket for new items
- Inbox API endpoints:
  - `GET /api/inbox` — list items for current user
  - `PUT /api/inbox/{id}/acknowledge` — acknowledge
  - `PUT /api/inbox/{id}/start` — start working
  - `PUT /api/inbox/{id}/complete` — complete
  - `PUT /api/inbox/{id}/dismiss` — dismiss
  - `PUT /api/inbox/{id}/snooze` — snooze for duration
  - `GET /api/inbox/stats` — item counts by status/priority

### D8. Performance Baseline (Test Results)

- Load test: 500 concurrent users, all 8 renewal flows
- Each endpoint measured against NFR targets (Volume 12)
- Baseline recorded for future sprints to compare against
- Slowest operations identified for optimization

### D9. Test Suite

| Test Type | Count Target | Tool |
|---|---|---|
| Unit tests (aggregate) | 200+ | pytest |
| Unit tests (policies) | 80+ | pytest |
| Integration tests (events) | 50+ | pytest + testcontainers |
| Integration tests (API) | 60+ | pytest + httpx |
| End-to-end (full flow) | 10 | playwright or k6 |
| Performance tests | 5 scenarios | k6 or locust |

---

## Sprint Backlog

### Week 1: Foundation
| Day | Work | Output |
|---|---|---|
| Mon | Renewal Aggregate — data model + SQL schema | Migration script + models |
| Tue | Renewal Aggregate — command handlers + validation | 15 commands implemented |
| Wed | Renewal Aggregate — remaining commands + state machine | All 27 commands + 20-state machine |
| Thu | Renewal Aggregate — event emission | All 33 events verified |
| Fri | Event emission — outbox + worker | Outbox pattern implemented |

### Week 2: Policies + Timelines
| Day | Work | Output |
|---|---|---|
| Mon | Policy Engine — base class + first 4 policies | Detection, Stalled, SLA, Quote |
| Tue | Policy Engine — remaining 5 policies | Budget, Legal, Business, Invoice, PO |
| Wed | Aggregate Timeline implementation | Timeline projection + query API |
| Thu | Projection handlers | Health, Status, Risk projections |
| Fri | Integration tests — event→policy→command wiring | 50 integration tests passing |

### Week 3: Operational Inbox
| Day | Work | Output |
|---|---|---|
| Mon | Inbox data model + CRUD API | inbox_item table + endpoints |
| Tue | Policy→Inbox wiring | All policies emit CreateInboxItem |
| Wed | Auto-completion + WebSocket | Items auto-close, real-time updates |
| Thu | Inbox API polish + error handling | All edge cases covered |
| Fri | Inbox integration tests | 30 integration tests passing |

### Week 4: Hardening
| Day | Work | Output |
|---|---|---|
| Mon | Performance baseline (load test) | k6 results against NFR targets |
| Tue | Bug fixes + edge case coverage | All tests passing |
| Wed | Documentation sync (all volumes) | Docs updated |
| Thu | Sprint review prep + demo script | Demo ready |
| Fri | Sprint review | Ship decision |

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | All 27 Renewal commands execute correctly | Unit tests pass |
| 2 | All 33 Renewal events emitted correctly | Integration tests verify event log |
| 3 | 20-state machine allows only valid transitions | State machine tests |
| 4 | All 9 policies trigger on correct events | Policy tests |
| 5 | Events published via outbox → worker → bus | Integration test |
| 6 | Timeline populated from events, not direct writes | Query verification |
| 7 | Projections consistent with aggregate state | Comparison query |
| 8 | Operational Inbox populated by policies | API returns items |
| 9 | Inbox auto-completion works for 3 scenarios | Integration test |
| 10 | Load test passes NFR targets (500 concurrent, <1s p95) | k6 report |
| 11 | No regression on Contract API (from Sprint 1) | Full regression suite |
| 12 | All logs structured JSON with correlation IDs | Log parse test |
| 13 | Every endpoint returns correct `allowed_actions` | Integration test |

---

## Blocking Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Renewal 20-state machine has hidden transition paths | Medium | Matrix test — every (status, command) pair verified |
| Outbox pattern introduces latency | Low | Benchmark emission time, optimize if >100ms |
| Policy ordering dependencies | Medium | Policies are independent by design. Test with concurrent events. |
| Performance baseline reveals issues | Medium | Identify top 3 slowest paths, optimize before hardening week |

---

## Dependencies

| Dependency | On | Notes |
|---|---|---|
| Contract Aggregate spec | Sprint 1 | Approved and stable |
| Event Catalog | Sprint 0.5 | Already covers all renewal events |
| NFR targets | Volume 12 | Performance baseline compares against these |
| Observability framework | Volume 11 | Structured logging + metrics implemented before load test |

---

## Definition of Done

A Sprint 2 deliverable is "done" when:

- Code: reviewed, merged, all tests passing
- Docs: every volume updated, no stale references
- Specs: business specs reviewed by stakeholder proxy
- API: contract spec reflects any changes
- Events: catalog updated if new events discovered
- NFRs: verified against Volume 12 targets
- Observability: all new components emit structured logs and metrics
- Tests: coverage thresholds met, performance baseline recorded
