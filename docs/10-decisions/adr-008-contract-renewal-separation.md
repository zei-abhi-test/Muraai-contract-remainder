# ADR-008: Contract and Renewal Are Separate Aggregates

**Status:** Accepted
**Date:** 2026-07-20
**Context:** The relationship between Contract and Renewal was ambiguous. Earlier designs treated Renewal as a child of Contract or as a simple workflow process. This caused confusion about aggregate boundaries, transactional ownership, and lifecycle management.

**Decision:** Contract and Renewal are separate aggregates with different transactional boundaries.

- **Contract** = the long-lived agreement. It is created once and exists for years. It owns line items, documents, clauses, and version history.
- **Renewal** = one operational cycle of a Contract. It is created when the Contract enters its renewal window and exists for 30-90 days. It owns approvals, timeline, tasks, emails, budget tracking, and renewal-scoped documents.
- A Renewal **must** reference exactly one Contract (FK `renewal.contract_id`). A Renewal cannot exist without a Contract.
- A Contract **does not** own Renewals transactionally. Contract conceptually has many Renewals over its lifetime, but they are separate aggregates with separate transaction boundaries.
- Cross-aggregate communication is via domain events, not direct service calls or FK cascades.

**Options Considered:**
1. **Renewal as child of Contract** — Single transaction boundary. Simpler consistency but couples lifetimes. A large Contract with many Renewals becomes a performance bottleneck. Rejected.
2. **Renewal as workflow process (no entity)** — Transient, no persistence. Cannot track history, cannot audit. Rejected.
3. **Separate aggregates with event-driven communication** — Chosen.

**Consequences:**
- Renewal has its own transaction boundary, its own state machine, its own lifecycle
- Contract is not locked during Renewal operations (no contention)
- Renewal can be deleted/archived independently of Contract
- Eventual consistency between Contract and Renewal is acceptable
- Domain events bridge the gap: `renewal.completed` → Contract updates `renewal_count`

**References:**
- Domain Stabilization: `docs/03-domain-model/domain-stabilization.md` §1
- Renewal Aggregate Spec: `docs/03-domain-model/renewal-aggregate-spec.md`
