# Architecture Decision Records

## Purpose

Architecture Decision Records (ADRs) capture significant decisions made during the development of Muraai. Each ADR documents the context, options considered, decision, and consequences. This ensures future team members understand why the platform is designed the way it is.

## Decision Log

| ID | Title | Date | Status |
|---|---|---|---|
| 001 | SKU Generation Strategy | 2026-07-19 | Accepted |
| 002 | Entity State Machine Pattern | 2026-07-20 | Accepted |
| 003 | UUID Primary Keys | 2026-07-20 | Accepted |
| 004 | Immutable Activity Log | 2026-07-20 | Accepted |
| 005 | No Vendor Self-Service Portal | 2026-07-20 | Accepted |
| 006 | API Versioning Strategy | 2026-07-20 | Proposed |
| 007 | PostgreSQL Primary + SQLite Dev | 2026-07-20 | Accepted |
| 008 | Contract and Renewal Are Separate Aggregates | 2026-07-20 | Accepted |
| 009 | Bounded Contexts Communicate via Domain Events | 2026-07-20 | Accepted |
| 010 | No Hard Deletes for Business Entities | 2026-07-20 | Accepted |
| 011 | Aggregate Timelines Feed Global Activity Projections | 2026-07-20 | Accepted |
| 012 | Policies Orchestrate Long-Running Business Processes | 2026-07-20 | Accepted |

---

## ADR-001: SKU Generation Strategy

**Status:** Accepted  
**Date:** 2026-07-19  
**Context:** The Product entity requires a globally unique SKU. The SKU is auto-generated when not provided by the user. Multiple concurrent product creation requests must not produce duplicate SKUs.

**Options Considered:**
1. **Auto-increment product ID** — Use the product table's auto-increment ID as the SKU suffix. Rejected because the SKU is needed before the product row is committed (uniqueness check runs before insert).
2. **UUID-based SKU** — Use a UUID fragment as the unique suffix. Rejected because sequential human-readable SKUs are preferred for operational use.
3. **Counter table with INSERT … ON CONFLICT (original)** — Atomic but used RETURNING clause that was incompatible across dialects.
4. **Counter table with separate SELECT (chosen)** — Atomic INSERT … ON CONFLICT DO UPDATE followed by SELECT in the same transaction.

**Decision:** Use a `sku_counter` table with atomic `INSERT … ON CONFLICT DO UPDATE` (without RETURNING) followed by a `SELECT` in the same transaction. The write-lock on the `sku_counter` row serializes concurrent callers in both PostgreSQL (row-level lock) and SQLite (database-level lock).

**Consequences:**
- SKUs are sequential and human-readable: `SKU-{cat}-MUR-{year}-{sequence}`
- No `RETURNING` clause means better cross-dialect compatibility
- Gap in sequence if a transaction rolls back after incrementing the counter (acceptable — gaps are normal in sequences)
- Requires `sku_counter` table to exist (created via migration or `db.create_all()`)

**References:**
- Implementation: `src/routes/management.py` → `generate_sku()`
- Model: `src/models/contract.py` → `SkuCounter`
- N/A

---

## ADR-002: Entity State Machine Pattern

**Status:** Accepted  
**Date:** 2026-07-20  
**Context:** Domain entities (Renewal, PO, Invoice) go through well-defined lifecycle stages. Using freeform status fields leads to inconsistent data and makes it impossible to determine valid next actions programmatically.

**Options Considered:**
1. **Freeform status text field** — Simple but no enforcement. Rejected.
2. **Enum with state machine in application code** — Status defined as enum, transitions validated in service layer. Chosen.
3. **State machine as a library** (e.g., `python-statemachine` or `transitions`) — Adds dependency. Considered but deferred — application-level validation is sufficient for current complexity. May adopt a library as complexity grows.
4. **Database-level CHECK constraints for transitions** — Most restrictive. Rejected as too rigid for evolving workflows.

**Decision:** Use a status ENUM at the database level (with VARCHAR fallback for SQLite) and validate all transitions in the service layer. Each entity exposes `allowed_actions` based on current status and user permissions. State transition endpoints are explicit (`POST /renewals/:id/approve`), not generic PATCH updates.

**Consequences:**
- Transition logic centralized in service layer, testable in isolation
- Frontend derives available actions from `allowed_actions` response field
- Adding new states requires updating the service layer validation
- ENUM at database level ensures invalid states cannot be inserted

---

## ADR-003: UUID Primary Keys

**Status:** Accepted  
**Date:** 2026-07-20  
**Context:** All domain entities need primary keys. Options are auto-increment integers or UUIDs.

**Options Considered:**
1. **Auto-increment integer (SERIAL)** — Simple, small, fast B-tree inserts. Sequential IDs leak information (enumeration attack). Hard to merge distributed data.
2. **UUID v4 (chosen)** — 128-bit random UUID. No enumeration. Distributed generation safe. Higher storage cost (16 bytes) and slightly slower index insert due to randomness.
3. **ULID** — Time-sortable UUID alternative. More complex. Not natively supported by most databases.

**Decision:** UUID v4 for all entity primary keys. Client-side generation using `uuid4()` to avoid round-trips for ID generation.

**Consequences:**
- 16 bytes per PK (vs 4 bytes for SERIAL) — acceptable at expected data volumes
- Slightly slower B-tree insert due to randomness — mitigated by using PostgreSQL's `uuid-ossp` extension with v4 UUIDs
- No enumeration vulnerability in API endpoints
- Distributed ID generation without coordination

---

## ADR-004: Immutable Activity Log

**Status:** Accepted  
**Date:** 2026-07-20  
**Context:** Regulatory compliance (SOX, SOC2) and internal audit require an unalterable record of all state-changing operations.

**Options Considered:**
1. **Application-level logging to file** — Simple but not queryable, not integrated with data model. Rejected.
2. **Database table with UPDATE/DELETE restricted** — ActivityLog table with application-level restriction. Chosen.
3. **Separate append-only database** — Most secure but operationally complex. Not justified for current scale.
4. **Blockchain-backed audit trail** — Over-engineered for this use case. Rejected.

**Decision:** ActivityLog is a database table with:
- Application-level restriction: no UPDATE or DELETE capability exposed through the API or service layer
- Database-level restriction: application database user has only INSERT and SELECT privileges on the table
- All state-changing API endpoints automatically write to ActivityLog via middleware (no endpoint needs to manually audit)
- ActivityLog stored in the same database as business data (single-writer pattern for transactional consistency)

**Consequences:**
- True immutability with reasonable operational complexity
- Activity log is queryable alongside business data
- Storage grows unbounded — mitigated by data retention policies and archival (configured per tenant)
- Migration/administration user still has DDL access for schema changes (audited separately)

---

## ADR-005: No Vendor Self-Service Portal

**Status:** Accepted  
**Date:** 2026-07-20  
**Context:** Vendors are external stakeholders who send quotes, receive POs, and send invoices. The question is whether to provide a vendor-facing portal.

**Options Considered:**
1. **Vendor portal (rejected)** — Requires vendor user management, SSO for external users, different permission model, and ongoing support. Every vendor has their own systems — asking them to use yet another portal creates adoption friction.
2. **Mediated communication (chosen)** — All vendor communication is mediated through tagged email or automated document exchange. Procurement Specialist uploads vendor quotes. POs are emailed to vendors. Invoices are received via email or EDI.
3. **Automated integration** — EDI or API-based exchange with vendor systems. Ideal but requires vendor cooperation. Implement when high-volume vendors demand it.

**Decision:** No vendor self-service portal. All vendor interactions are mediated through platform users (primarily Procurement Specialist) or automated document exchange. Muraai tracks the external interaction status but does not provide vendor login capability.

**Consequences:**
- Simpler permission model (no external user management)
- No vendor-facing UI to build and maintain
- Procurement Specialist acts as the bridge — additional manual step but ensures human validation
- As vendor adoption grows, EDI/API integration can supplement (not replace) the mediated model
- This is explicitly listed as a Non-Goal in the product vision

---

## ADR-006: API Versioning Strategy

**Status:** Proposed  
**Date:** 2026-07-20  
**Context:** The API needs to evolve without breaking existing integrations.

**Options Considered:**
1. **URL prefix versioning** (`/api/v1/`, `/api/v2/`) — Clear, explicit, cacheable. Chosen.
2. **Header versioning** (`Accept: application/vnd.muraai.v1+json`) — Cleaner URL but less discoverable. Harder to test and cache.
3. **Query parameter versioning** (`?version=1`) — Ambiguous, easy to forget. Rejected.

**Decision:** URL prefix versioning (`/api/v1/`). Breaking changes create a new version URL. Deprecated versions maintained for minimum 6 months with documented deprecation notice in response headers.

**Consequences:**
- Clear segregation of API versions
- Multiple versions can run simultaneously during migration
- URL path changes require integration updates — mitigated by long deprecation window
- Implementation pattern: Blueprint/module per version

---

## ADR-007: PostgreSQL Primary + SQLite Dev

**Status:** Accepted  
**Date:** 2026-07-20  
**Context:** The application needs to run in production (PostgreSQL) and development/testing environments (potentially SQLite).

**Options Considered:**
1. **PostgreSQL only** — Maximum feature utilization but requires PostgreSQL in all environments including CI. Higher developer setup friction.
2. **PostgreSQL + SQLite (chosen)** — Production uses PostgreSQL for full feature set (JSONB, ENUMs, concurrent connections). Development/testing uses SQLite for zero-config setup.
3. **PostgreSQL in all environments** — Docker Compose for development. More realistic but higher barrier for new developers.

**Decision:** Production PostgreSQL, development/testing SQLite. SQL must be compatible with both. PostgreSQL-specific features (JSONB, ENUMs) are used but with fallback implementations for SQLite (VARCHAR for ENUMs, TEXT for JSONB).

**Consequences:**
- Lower barrier for developer onboarding (zero-config SQLite)
- Need to test PostgreSQL-specific features separately
- Cannot use PostgreSQL-exclusive SQL constructs without SQLite fallback
- Migration scripts must handle both dialects
- CI runs tests against both SQLite and PostgreSQL
