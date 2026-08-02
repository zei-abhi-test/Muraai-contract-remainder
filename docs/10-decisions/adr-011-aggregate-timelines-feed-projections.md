# ADR-011: Aggregate Timelines Feed Global Activity Projections

**Status:** Accepted
**Date:** 2026-07-20
**Context:** Every aggregate has its own timeline table (`renewal_timeline_entry`, `contract_version_history`). The UI needs a global activity feed (Mission Control, notification center, audit explorer). If every aggregate wrote directly to a global table, there would be no single owner and no schema consistency.

**Decision:** Timelines are owned per aggregate. A read-only projection subscribes to domain events and builds the global activity log.

- **Write path:** Each aggregate owns its timeline table. No other aggregate writes to it.
- **Read path:** A projection listens to domain events and inserts into the global `activity_log` table.
- **Global timeline consumers** (Mission Control, Audit Explorer, Notification Feed) read from the projection, not from individual aggregate timelines.
- **Aggregate detail pages** read from the aggregate's own timeline (lower latency, more specific schema).

**Diagram:**
```
RenewalTimelineEntry (write)     ContractVersionHistory (write)
         │                                  │
         │ emits domain events              │ emits domain events
         ▼                                  ▼
    Event Bus ──────────► Projection ──► activity_log (read-only for UI)
                                                │
                                                ▼
                                      Mission Control / Audit Explorer
```

**Options Considered:**
1. **Single global timeline table, all aggregates write to it** — No single owner. Schema becomes generic (everyone writes the same shape). Hard to evolve per-aggregate. Rejected.
2. **Per-aggregate timelines + read-only projection (chosen)** — Each aggregate owns its schema. Projection normalizes into global format. Best of both worlds.
3. **Per-aggregate timelines only, no global projection** — Cannot build Mission Control or audit export without complex UNION queries. Rejected.

**Consequences:**
- Eventual consistency between aggregate timeline and global activity log (acceptable — sub-second)
- Projection must be idempotent (safe to replay events)
- Activity log is append-only (no UPDATE, no DELETE)
- Adding a new aggregate requires adding a new projector

**References:**
- Domain Stabilization: `docs/03-domain-model/domain-stabilization.md` §1b
- Event Catalog: `docs/03-domain-model/event-catalog.md`
