# ADR-009: Bounded Contexts Communicate via Domain Events

**Status:** Accepted
**Date:** 2026-07-20
**Context:** Services in the current codebase call each other directly (NotificationService.email(), ContractService.doSomething()). This creates tight coupling — changing one service risks breaking others. It also makes it impossible to add new consumers without modifying existing code.

**Decision:** All cross-aggregate communication is via domain events. No aggregate calls another aggregate's methods directly.

- Each aggregate emits domain events after state changes
- Event handlers (subscribers) react to events — they may be Timeline writers, Notification senders, Policy triggers, or Analytics collectors
- The publisher does not know who is listening. That is the definition of loose coupling.

**Architecture:**
```
Contract Aggregate ──emit──► Domain Event ──► Event Bus
                                                    │
                           ┌────────────────────────┼────────────────────┐
                           ▼                        ▼                    ▼
                     Timeline Writer          Notification         Policy Engine
                     (writes entry)           (sends email)        (emits commands)
```

**Options Considered:**
1. **Direct service calls** — Simple, synchronous, typed. Tight coupling. Cannot add consumers without modifying callers. Rejected.
2. **Domain events with in-process bus** — Chosen for initial implementation (before Redis Streams).
3. **Domain events with Redis Streams** — Targeted for Sprint 4. Adds durability, at-least-once delivery, dead-letter queues.

**Consequences:**
- Services are decoupled — adding a new subscriber requires no changes to the publisher
- Eventual consistency is the default — within-aggregate consistency is strong, between-aggregates is eventual
- Event catalog becomes the contract between bounded contexts
- Testing requires event bus mocking
- Debugging event chains requires tooling (event tracing, dead-letter queues)

**References:**
- Event Catalog: `docs/03-domain-model/event-catalog.md`
- Domain Stabilization: `docs/03-domain-model/domain-stabilization.md` §1b
