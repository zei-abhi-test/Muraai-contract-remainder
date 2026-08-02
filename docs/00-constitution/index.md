# Muraai Constitution

## Core Identity

Muraai is an **Enterprise Contract Renewal Operations Platform**. It is not a contract reminder tool, a CLM, or a CRM. It is a renewal governance engine that sits at the intersection of Procurement, Finance, Legal, and IT Operations.

## First Principles

### 1. State Over Status

Every domain entity has a deterministic state machine. The system knows exactly where a renewal is, what happened before, and what can happen next. `allowed_actions` is derived from state, not convention.

**Rationale:** Freeform status fields invite inconsistency. A state machine enforces process compliance and makes the system auditable by construction.

### 2. Data Has One Home

Every field is defined exactly once. References, not copies. Changes propagate through joins, not synchronization.

**Rationale:** Duplicated data inevitably diverges. A single source of truth is non-negotiable for enterprise financial data.

### 3. Every Action Is Logged

Immutably. Who, what, when, previous value, new value. No user can modify or delete the audit log.

**Rationale:** Auditability is a legal and compliance requirement for SOX, SOC2, and internal audit. If it isn't logged, it didn't happen.

### 4. Workflow Over Freeform

Processes are encoded as state machines and workflows, not left to user discretion. Configurable but enforced.

**Rationale:** Enterprise renewal operations depend on consistent process execution. Relying on users to "remember the process" guarantees failure at scale.

### 5. Integrate, Don't Absorb

Muraai connects to ERPs, CLMs, SAM tools, identity providers, and communication platforms. It does not replace them.

**Rationale:** No enterprise will rip out their ERP to use Muraai. API-first design ensures data flows without friction.

### 6. Read-Optimized, Write-Constrained

Reading data is fast and broadly permitted. Writing data is governed by permissions, validation, and workflow state.

**Rationale:** Visibility drives accountability. But write access must be controlled to maintain data integrity and segregation of duties.

### 7. Configuration Over Customization

Business rules are configurable through admin settings, not code. Platform instances are tailored without forking.

**Rationale:** Custom code creates maintenance burden, upgrade friction, and security risk. Configuration is auditable and reversible.

### 8. The Platform Adapts to Roles

Every screen renders differently depending on the user's role. Role-specific views, not one-size-fits-all.

**Rationale:** A Renewals Manager, a Financial Analyst, and a CTO have fundamentally different jobs. The same interface cannot serve all three.

### 9. Graceful Degradation

If a downstream integration is unavailable, Muraai continues to function with its own data.

**Rationale:** Renewal operations cannot pause because the ERP is down for maintenance. Core functionality must be self-sufficient.

### 10. Enterprise Grade by Default

RBAC, SSO (SAML/OIDC), audit logging, data isolation, encryption at rest and in transit, rate limiting, pagination, idempotency. These are architectural requirements from day one.

**Rationale:** Retro-fitting enterprise security is exponentially more expensive than building it in from the start.

## Decision Framework

When faced with a design decision, evaluate in this order:

1. **Does this serve a stakeholder's defined goal or relieve a documented pain point?**
2. **Does this maintain or improve data integrity?**
3. **Does this make the system more auditable?**
4. **Does this reduce manual effort for any stakeholder?**
5. **Does this preserve or improve the ability to integrate with external systems?**
6. **Does this scale to enterprise multi-tenant usage?**

A design that fails any of the first three questions must be re-evaluated. A design that passes all six should be strongly preferred.

## Scope Boundaries

### In Scope
- Renewal identification, tracking, and execution
- Quote-to-PO-to-Invoice workflow orchestration
- Approval chain management with SLA enforcement
- Vendor performance tracking
- License usage attestation
- Renewal forecasting
- Audit logging and compliance reporting
- Integration with ERP, CLM, SAM, SSO, and email

### Out of Scope (by design)
- Contract drafting or redlining (use a CLM)
- General-purpose CLM (Muraai is renewal-specific)
- Payment execution (use an ERP)
- Vendor self-service portal
- Usage metering (integrate with SAM tools)
- Generic BPMN workflow engine
- Mobile-first experience (desktop primary, mobile companion later)
- Multi-language / multi-currency (Phase 2)
- ML-driven predictions (Phase 2)

## Document Hierarchy

This knowledge base is organized as follows:

| Section | Purpose | Authoritative For |
|---|---|---|
| 00-constitution | First principles, scope, decision framework | All decisions |
| 01-vision | Product vision, strategy, goals, metrics | Strategic direction |
| 02-business | Stakeholders, business model, policies | Business requirements |
| 03-domain-model | Entities, aggregates, domain events | Data model |
| 04-workflows | State machines, processes, integrations | Process logic |
| 05-ui | UX principles, screen map, user journeys | User experience |
| 06-api | API design, endpoints, integration patterns | System interfaces |
| 07-database | Schema, migrations, data integrity | Data storage |
| 08-design-system | UI components, tokens, patterns | Visual consistency |
| 09-roadmap | Phases, milestones, dependencies | Execution planning |
| 10-decisions | Architecture Decision Records | Technical rationale |

Lower-numbered sections are more foundational. A decision in a higher-numbered section must not contradict a higher-priority section.

## Amending This Constitution

This document is not static. As the product evolves, amendments may be proposed. Every amendment must:

1. Identify the specific principle or rule being changed
2. State the reason (what changed in the business environment?)
3. Describe the trade-off being accepted
4. Be recorded as a decision in `10-decisions/`

Amendments to the constitution require agreement across Vision, Business, and Technical stakeholders.
