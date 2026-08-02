# Muraai Knowledge Base

## Enterprise Contract Renewal Operations Platform

Welcome to the Muraai product knowledge base. This is the single source of truth for the platform's design, strategy, and architecture. Every document here is authoritative. All design decisions, implementation work, and product discussions must reference these documents.

## How to Use This Knowledge Base

### Navigation
Start with the **Constitution** (00) to understand the core principles that guide every decision. Then follow the numbered sections in order — each builds on the previous.

### Reference Pattern
When working on Muraai, your prompt should follow this pattern:

```
I am working on [feature/entity]. 
Based on Muraai knowledge base:
- Domain model: docs/03-domain-model/index.md → [specific section]
- Workflow: docs/04-workflows/index.md → [specific workflow]
- Stakeholders: docs/02-business/stakeholders.md → [specific stakeholder]
- Prior decisions: docs/10-decisions/index.md → [relevant ADRs]

Here is what I need to do: [specific task]
```

This ensures every piece of work compounds the existing knowledge rather than reinventing it.

## Document Structure

| Section | Purpose | Key Documents |
|---|---|---|
| **00-constitution** | Core principles, scope, decision framework | `index.md` — The constitution (10 principles, decision framework, scope boundaries) |
| **01-vision** | Product vision, strategy, goals, metrics | `index.md` — Vision, mission, value proposition, competitive advantages, KPIs |
| **02-business** | Stakeholders, business rules, policies | `stakeholders.md` — 12 stakeholder definitions with permissions, KPIs, decision authority |
| **03-domain-model** | Entities, aggregates, domain events, value objects | `index.md` — All entities, their fields, state machines, aggregate boundaries, domain events |
| **04-workflows** | State machines, process flows, escalations, notifications | `index.md` — Complete renewal lifecycle, PO workflow, invoice matching, approval chain, SLA enforcement |
| **05-ui** | UX principles, screen map, user journeys, patterns | `index.md` — Role-first design, screen map, 3 user journeys, UI component patterns |
| **06-api** | REST API design, endpoints, integration patterns | `index.md` — Principles, full endpoint map (150+ endpoints), webhooks, integration patterns |
| **07-database** | Schema, migrations, data integrity | `index.md` — ERD (textual), indexing strategy, integrity rules, migration strategy |
| **08-design-system** | Visual design tokens, components, layout | `index.md` — Color, typography, spacing tokens, component patterns (badge, table, panel, timeline) |
| **09-roadmap** | Phases, milestones, dependencies, risks | `index.md` — 6 phases (0-5), epic definitions, success criteria, dependency map, risk register |
| **10-decisions** | Architecture Decision Records | `index.md` — 7 ADRs covering SKU generation, state machines, UUIDs, activity log, API versioning |

## Status Legend

Documents in this knowledge base follow a status convention:

- **Accepted** — Decision is final. Future work must comply unless a new ADR overrides it.
- **Proposed** — Decision is under review. Comments welcome.
- **Deprecated** — Replaced by a newer decision. Links to the replacement.
- **Draft** — Initial version, subject to change.

## Contribution Guidelines

To add or modify a document:

1. All changes must align with the constitution (00-constitution).
2. Proposed changes should be recorded as an ADR in 10-decisions/ before modifying higher-level documents.
3. Cross-reference related documents using relative paths (`../03-domain-model/index.md#renewal`).
4. Follow the existing document structure and tone.
5. Code snippets in documents are illustrative only — actual implementation may differ.
6. Documents are markdown. Use GitHub-flavored markdown for tables, code blocks, and diagrams.

---

*This knowledge base is maintained as the authoritative reference for Muraai's product design. Every document builds on those that precede it. Read in order for full context.*
