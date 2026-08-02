# ADR-012: Policies Orchestrate Long-Running Business Processes

**Status:** Accepted
**Date:** 2026-07-20
**Context:** Business automation logic (SLA escalation, approval routing, staged reminders) was being embedded inside services. This made services fat, made automation rules hard to configure, and made it impossible to observe the automation chain as a whole.

**Decision:** Introduce **Policies (Process Managers)** as a third architectural primitive alongside Commands and Events.

- **Command** — A user or system request to mutate an aggregate. Validated, authorized, executed.
- **Event** — A fact that something happened. Emitted by the aggregate after execution.
- **Policy** — A long-running process that listens to events and emits commands. This is where business automation lives.

**Flow:**
```
User Action → Command → Aggregate → Event → Policy → Command → Aggregate → ...
```

**Examples of Policies:**
- `LegalReviewSLAPolicy`: Listens to `renewal.legal.review_started` → sends reminder at 48h, escalates to GC at 72h
- `BusinessApprovalEscalationPolicy`: Listens to `renewal.business.approval_started` → escalates through 3 levels (manager → director → CTO) at 48h/72h/96h
- `StalledDetectionPolicy`: Listens to renewal entering any active state → starts timer → emits `renewal.stalled` after 14 days of no transition
- `POFollowUpPolicy`: Listens to `renewal.po.sent` → sends follow-up reminder at 3 days, escalates at 7 days

**Options Considered:**
1. **Automation logic inside services** — Current approach. Simple but not observable. Rules are hard-coded, not configurable. Every change requires code deployment. Rejected.
2. **External workflow engine (Temporal, Camunda)** — Most powerful but adds infrastructure complexity. Over-engineered for current needs. May adopt later for complex multi-entity sagas.
3. **Policies as code with configuration (chosen)** — Policies are code classes that are instantiated with configuration (timing, thresholds, escalation chains). Configurable via admin UI without code changes for timing/thresholds.

**Consequences:**
- Services stay thin — they validate, execute, and emit
- Policies are testable in isolation (pure event → command logic)
- Policies are idempotent — they track processed event IDs
- Policies are durable — state is persisted (event ID, timer, retry count)
- Adding a new policy requires no changes to existing aggregates
- Policy configuration (timeouts, thresholds, escalation chains) is data, not code

**Implementation Pattern:**
```python
class BusinessApprovalEscalationPolicy(Policy):
    triggers = ["renewal.business.approval_started"]
    
    def handle(self, event: DomainEvent):
        # Create escalation schedule from config
        sla_config = self.config.get("business_approval")
        levels = sla_config["escalation_levels"]  # [{hours: 48, role: "manager"}, ...]
        
        for level in levels:
            self.schedule(
                after=level["hours"],
                command=EscalateRenewal(
                    renewal_id=event.renewal_id,
                    escalation_level=level["level"],
                    escalated_to=resolve_user(level["role"])
                )
            )
```

**References:**
- Domain Stabilization: `docs/03-domain-model/domain-stabilization.md` §1c
- Event Catalog: `docs/03-domain-model/event-catalog.md`
