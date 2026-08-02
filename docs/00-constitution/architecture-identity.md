# Architecture Identity: Project Atlas

**Date:** 2026-07-20
**Purpose:** Separate the product brand (Muraai) from the internal architecture identity (Atlas). All documentation, code comments, and technical discussions reference "Atlas" for the architecture, while "Muraai" remains the product name.

---

## Why Two Names

| Brand | Scope | Audience |
|---|---|---|
| **Muraai** | Product name, UI, marketing, user-facing documentation | Customers, users, stakeholders |
| **Atlas** | Internal architecture, domain model, event catalog, API specs, ADRs | Engineering, architecture, DevOps |

### Convention

- **Atlas Architecture v2.0** — the overall system architecture
- **Atlas Contract Domain** — the Contract Aggregate and related components
- **Atlas Renewal Domain** — the Renewal Aggregate and related components
- **Atlas Policy Engine** — event-driven process managers
- **Atlas Mission Control** — operational dashboard
- **Atlas Operational Inbox** — work assignment system
- **Atlas External Collaboration Portal** — customer/vendor portal
- **Atlas AI Platform** — ML-powered insights

### File Path Convention

All architecture documentation uses "atlas" in the path implicitly (as the architecture framework). No filename change needed — the identity document establishes the convention.

### Tagging Convention

- Code: `# atlas-architecture-v2` in commit messages
- PRs: `[Atlas]` prefix for architecture changes
- Issues: `atlas/` label for architecture concerns
- Diagrams: "Atlas Architecture v2.0 — [Diagram Name]"

---

## Architecture Pillars

```
Muraai (Product)
    └── Atlas (Architecture)
            ├── Business Domain      (contracts, renewals, vendors)
            ├── Policy Engine        (event-driven process managers)
            ├── Mission Control      (operational awareness)
            ├── Operational Inbox    (work assignment)
            ├── External Portal      (collaboration)
            └── AI Platform          (insights & automation)
```

---

## Versioning

| Version | Date | What Changed |
|---|---|---|
| v1.0 | 2026-05 | Original CRUD architecture |
| v2.0 | 2026-07 | Event-driven DDD architecture (current) |
