# ADR-010: No Hard Deletes for Business Entities

**Status:** Accepted
**Date:** 2026-07-20
**Context:** Business entities (Contract, Renewal, PO, Invoice, Vendor, Product) accumulate referential chains. A hard delete can orphan child records, break audit trails, and cause data integrity violations. Regulatory compliance (SOX, SOC2) requires that business data is never truly destroyed.

**Decision:** All business entities use soft deletes. A `deleted_at` timestamp is set on deletion. Records are excluded from queries via a `WHERE deleted_at IS NULL` filter (or a partial index in PostgreSQL). Hard deletes are only permitted for:
- Draft entities that were never activated (e.g., a Contract in DRAFT that was never activated)
- Test/seed data in non-production environments
- PII data subject to GDPR right-to-erasure (handled via anonymization, not hard delete)

**Options Considered:**
1. **Hard deletes with cascade** — Simple but irreversible. Orphans audit trails. Violates compliance requirements. Rejected.
2. **Soft deletes (chosen)** — `deleted_at` column. Queries filter out deleted records. Audit trails preserved.
3. **Separate archive table** — Maximum data integrity. Complex queries (UNION ALL for current + archived). Over-engineered for current scale.

**Consequences:**
- Every business entity requires a `deleted_at` column
- All list queries must filter `WHERE deleted_at IS NULL`
- Unique constraints must handle soft-deleted rows (partial unique index in PostgreSQL, or exclude NULLs)
- Referential integrity: if parent is soft-deleted, children are soft-deleted too (cascade in application code, not DB)

**Implementation Pattern:**
```sql
-- PostgreSQL partial index for uniqueness ignoring soft-deleted rows
CREATE UNIQUE INDEX uq_contract_number_active
    ON contract(contract_number)
    WHERE deleted_at IS NULL;

-- Query filter
SELECT * FROM contract WHERE deleted_at IS NULL;
```

**References:**
- Domain Stabilization: `docs/03-domain-model/domain-stabilization.md` §3
