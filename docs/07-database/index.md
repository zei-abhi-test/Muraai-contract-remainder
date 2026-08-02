# Database Architecture

## Database Type

PostgreSQL 15+ (primary). SQLite 3.39+ for development/testing. All DDL must be compatible with both or use Alembic-compiled dialect branches.

## Normalization Principles

1. **Every table has a UUID primary key.** UUIDs prevent enumeration attacks, support distributed ID generation, and avoid sequential ID conflicts in multi-tenant or replicated setups.

2. **Every table has audit columns.** `created_at`, `updated_at`, `deleted_at` with uniform types and defaults.

3. **Soft deletes preserve referential integrity.** Entities referenced by FK constraints are soft-deleted via `deleted_at`. Hard deletes are only permitted for entities never referenced (e.g., Draft contracts with no renewals).

4. **One logical fact per table.** No comma-separated values, no JSONB blobs replacing normalized rows, no polymorphic FKs. JSONB is used only for: (a) immutable snapshots, (b) policy rule conditions/actions, (c) user preferences — never for queryable business data.

5. **ENUMs for bounded state sets.** Status fields use PostgreSQL ENUM types. Enum values are immutable after creation — new values require CREATE TYPE ... AS ENUM migration.

6. **Versioning via row-level history.** Entities that require amendment tracking (Contract, PO) use a version_number column. Historical versions are preserved in a companion _history table with the same schema plus a valid_range daterange.

7. **Immutable audit log.** ActivityLog is insert-only. No UPDATE, DELETE, or TRUNCATE in application code. DB permissions restrict these operations to the migration user only.

---

## 1. Entity Relationship Diagram

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│     Vendor       │1────N│     Contract      │1────N│ ContractLineItem │
│                  │       │                  │       │                  │
│ id (PK)          │       │ id (PK)          │       │ id (PK)          │
│ name             │       │ vendor_id (FK)   │       │ contract_id (FK) │
│ vendor_code(UQ)  │       │ contract_number  │       │ product_id (FK)  │
│ website          │       │ parent_id (FK)   │       │ product_snapshot │
│ vendor_tier(ENUM)│       │ contract_type(EN)│       │ description      │
│ risk_rating(ENUM)│       │ description      │       │ quantity         │
│ payment_terms    │       │ start_date       │       │ unit_rate        │
│ tax_id           │       │ end_date         │       │ line_total       │
│ billing_address  │       │ renewal_window   │       │ discount_percent │
│ currency_default │       │ auto_renewal     │       │ discount_amount  │
│ preferred        │       │ notice_period    │       │ tax_percent      │
│ notes            │       │ renewal_term     │       │ tax_amount       │
│ total_contracts  │       │ billing_freq(EN) │       │ line_total_w_tax │
│ total_spend      │       │ budget_code      │       │ sort_order       │
│ avg_discount     │       │ notification_em  │       │ version          │
│ relationship_start│      │ notification_en  │       │ created_at       │
│ rel_manager (FK) │       │ status(ENUM)     │       │ updated_at       │
│ created_at       │       │ total_value      │       │ deleted_at       │
│ updated_at       │       │ currency         │       └──────────────────┘
│ deleted_at       │       │ version          │
└───────┬──────────┘       │ renewal_count    │       ┌──────────────────┐
        │                  │ latest_renewal(FK)│       │ ContractDocument │
        │ 1                │ owner_id (FK)    │       │                  │
        │                  │ created_at       │       │ id (PK)          │
        │                  │ updated_at       │       │ contract_id (FK) │
        │                  │ deleted_at       │       │ document_type(EN)│
        │                  └────────┬─────────┘       │ file_name        │
        │                           │                  │ file_url         │
        │ 1                    ┌────┴─────┐           │ file_size_bytes  │
        │                  ┌───┤  1     N  │           │ mime_type        │
        │                  │   │          │           │ uploaded_by (FK) │
        │                  │   └──────────┘           │ storage_provider │
        │                  │                          │ external_file_id │
        │  N         ┌─────┴──────┐   ┌──────────────┐│ version          │
        ├────────────┤  Renewal   │1 N│ApprovalRecord ││ created_at       │
        │            │            ├───┤              ││ updated_at       │
        │            │ id (PK)    │   │ id (PK)      ││ deleted_at       │
        │            │ contract(FK)│  │ renewal(FK)  │└──────────────────┘
        │            │ year       │   │ approver(FK) │
        │            │ status (EN)│   │ delegate(FK) │┌──────────────────┐
        │            │ priority   │   │ type (ENUM)  ││  ContractClause  │
        │            │ assigned(FK)│  │ status (ENUM)││                  │
        │            │ vendor_info│   │ comments     ││ id (PK)          │
        │            │ budget_info│   │ chain_order  ││ contract_id (FK) │
        │            │ approval   │   │ sla_deadline ││ clause_type      │
        │            │ escalation │   │ sla_breached ││ title            │
        │            │ tags       │   │ escalated_at ││ content          │
        │            │ notes      │   │ remind_at    ││ is_standard      │
        │            │ created_at │   │ decided_at   ││ standard_clause  │
        │            │ updated_at │   │ created_at   ││ deviation        │
        │            │ deleted_at │   │ updated_at   ││ created_at       │
        └────────────┴─────┬──────┘   └──────────────┘│ updated_at       │
                           │                          └──────────────────┘
                           │ 1
                           │
                  ┌────────┴────────┐      ┌──────────────────┐
                  │ RenewalTimeline │      │ UsageAttestation │
                  │                 │      │                  │
                  │ id (PK)         │      │ id (PK)          │
                  │ renewal_id (FK) │      │ renewal_id (FK)  │
                  │ from_status     │      │ attested_by (FK) │
                  │ to_status       │      │ current_users    │
                  │ action          │      │ planned_changes  │
                  │ performed_by(FK)│      │ still_required   │
                  │ performed_at    │      │ alternative_cons │
                  │ comments        │      │ comments         │
                  │ metadata(JSONB) │      │ attested_at      │
                  │ created_at      │      │ expires_at       │
                  └─────────────────┘      └──────────────────┘

┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  PurchaseOrder   │1────N│  POLineItem      │      │     Invoice      │
│                  │      │                  │      │                  │
│ id (PK)          │      │ id (PK)          │      │ id (PK)          │
│ renewal_id (UQ)  │      │ po_id (FK)       │      │ po_id (FK)       │
│ vendor_id (FK)   │      │ line_item_id(FK) │      │ vendor_id (FK)   │
│ po_number (UQ)   │      │ description      │      │ renewal_id (FK)  │
│ status (ENUM)    │      │ quantity         │      │ invoice_num (UQ) │
│ total_amount     │      │ unit_rate        │      │ status (ENUM)    │
│ currency         │      │ line_total       │      │ invoice_amount   │
│ budget_code      │      │ sort_order       │      │ matched_amount   │
│ budget_approved  │      │ created_at       │      │ variance_amt     │
│ notes            │      │ updated_at       │      │ variance_pct     │
│ vendor_po_ref    │      └──────────────────┘      │ variance_reason  │
│ sent_at          │                                 │ payment_status   │
│ sent_by (FK)     │                                 │ payment_due      │
│ sent_method      │                                 │ paid_date        │
│ acknowledged_at  │                                 │ payment_ref      │
│ rejected_at      │                                 │ invoice_date     │
│ reject_reason    │                                 │ received_date    │
│ document_url     │                                 │ document_url     │
│ erp_sync_status  │                                 │ erp_sync_status  │
│ erp_sync_at      │                                 │ erp_sync_at      │
│ erp_reference    │                                 │ notes            │
│ version          │                                 │ created_at       │
│ created_by (FK)  │                                 │ updated_at       │
│ created_at       │                                 │ deleted_at       │
│ updated_at       │                                 └──────────────────┘
│ deleted_at       │
└──────────────────┘

┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│     Product      │      │  VendorContact   │      │  VendorScorecard │
│                  │      │                  │      │                  │
│ id (PK)          │      │ id (PK)          │      │ id (PK)          │
│ name             │      │ vendor_id (FK)   │      │ vendor_id (FK)   │
│ code             │      │ name             │      │ scorecard_period │
│ sku (UQ)         │      │ email            │      │ overall_score    │
│ category         │      │ phone            │      │ dimensions(JSONB)│
│ rate             │      │ role             │      │ calculated_at    │
│ price            │      │ is_primary       │      │ calculated_by    │
│ description      │      │ notes            │      │ created_at       │
│ status (ENUM)    │      │ created_at       │      │ updated_at       │
│ owner_id (FK)    │      │ updated_at       │      └──────────────────┘
│ created_at       │      │ deleted_at       │
│ updated_at       │      └──────────────────┘
│ deleted_at       │
└──────────────────┘

┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│      User        │      │   ActivityLog    │      │   Notification   │
│                  │      │                  │      │                  │
│ id (PK)          │      │ id (PK)          │      │ id (PK)          │
│ username (UQ)    │      │ entity_type      │      │ user_id (FK)     │
│ email (UQ)       │      │ entity_id (UUID) │      │ type             │
│ password_hash    │      │ action           │      │ title            │
│ role (ENUM)      │      │ previous_state   │      │ body             │
│ status (ENUM)    │      │ new_state (JSONB)│      │ entity_type      │
│ department       │      │ changed_fields   │      │ entity_id        │
│ business_unit    │      │ performed_by(FK) │      │ priority         │
│ manager_id (FK)  │      │ performed_at     │      │ read             │
│ notif_prefs(JSON)│      │ ip_address       │      │ read_at          │
│ last_login_at    │      │ user_agent       │      │ email_sent       │
│ created_at       │      │ correlation_id   │      │ email_sent_at    │
│ updated_at       │      │ tenant_id        │      │ created_at       │
│ deleted_at       │      │ created_at       │      └──────────────────┘
└──────────────────┘      └──────────────────┘

┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   PolicyRule     │      │   SkuCounter     │      │      Task        │
│                  │      │                  │      │                  │
│ id (PK)          │      │ prefix (PK)      │      │ id (PK)          │
│ rule_type (ENUM) │      │ next_value       │      │ entity_type      │
│ name             │      └──────────────────┘      │ entity_id        │
│ description      │                                 │ title            │
│ entity_type      │                                 │ description      │
│ conditions(JSONB)│                                 │ assignee_id (FK) │
│ actions (JSONB)  │                                 │ creator_id (FK)  │
│ priority         │                                 │ status (ENUM)    │
│ enabled          │                                 │ priority         │
│ effective_from   │                                 │ due_date         │
│ effective_to     │                                 │ completed_at     │
│ created_by (FK)  │                                 │ auto_created     │
│ updated_by (FK)  │                                 │ source           │
│ created_at       │                                 │ created_at       │
│ updated_at       │                                 │ updated_at       │
│ deleted_at       │                                 │ deleted_at       │
└──────────────────┘                                 └──────────────────┘

                     ┌──────────────────┐
                     │ Contract_History │
                     │                  │
                     │ id (PK)          │
                     │ contract_id (FK) │
                     │ version          │
                     │ snapshot (JSONB) │
                     │ valid_range      │
                     │ superseded_by(FK)│
                     │ created_at       │
                     └──────────────────┘
```

---

## 2. Table Specifications

### 2.1 Vendor

Stores software vendor master data. Each vendor is a legal entity the enterprise has contracts with.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | Primary identifier |
| name | VARCHAR(200) | NOT NULL | Legal entity name |
| vendor_code | VARCHAR(50) | NOT NULL UNIQUE | Internal vendor identifier |
| website | VARCHAR(500) | | |
| vendor_tier | vendor_tier | NOT NULL DEFAULT 'standard' | Strategic, Preferred, Standard, Non-preferred |
| risk_rating | risk_rating | NOT NULL DEFAULT 'low' | Low, Medium, High, Critical |
| payment_terms | VARCHAR(100) | DEFAULT 'Net 30' | |
| tax_id | VARCHAR(50) | | Tax/VAT registration |
| billing_address | JSONB | | Structured address object |
| currency_default | currency_code | DEFAULT 'USD' | ISO 4217 |
| preferred | BOOLEAN | NOT NULL DEFAULT false | |
| notes | TEXT | | |
| total_contract_count | INTEGER | NOT NULL DEFAULT 0 | Counter cache |
| total_spend | DECIMAL(18,2) | NOT NULL DEFAULT 0 | Counter cache |
| average_discount_rate | DECIMAL(5,2) | | Computed |
| relationship_start_date | DATE | | |
| relationship_manager_id | UUID | FK -> User.id | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

### 2.2 VendorContact

Contacts at a vendor responsible for renewals and relationship management.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| vendor_id | UUID | NOT NULL FK -> Vendor.id | |
| name | VARCHAR(200) | NOT NULL | |
| email | VARCHAR(200) | NOT NULL | |
| phone | VARCHAR(50) | | |
| role | VARCHAR(100) | | e.g., Account Manager |
| is_primary | BOOLEAN | NOT NULL DEFAULT false | Primary contact for renewals |
| notes | TEXT | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| deleted_at | TIMESTAMPTZ | | |

**Unique constraint:** UNIQUE (vendor_id, email)

### 2.3 VendorScorecard

Performance evaluation of a vendor for a given period.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| vendor_id | UUID | NOT NULL FK -> Vendor.id UNIQUE (vendor_id, scorecard_period) | |
| scorecard_period | VARCHAR(20) | NOT NULL | e.g., "2026-Q2" |
| overall_score | DECIMAL(3,1) | | 0.0 - 10.0 |
| dimensions | JSONB | | Configurable dimension scores |
| calculated_at | TIMESTAMPTZ | NOT NULL | |
| calculated_by | VARCHAR(50) | NOT NULL | 'system' or 'manual' |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Check:** overall_score >= 0 AND overall_score <= 10

### 2.4 Product

Software product catalog. SKU is auto-generated and globally unique.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| name | VARCHAR(200) | NOT NULL | |
| code | VARCHAR(80) | | Vendor product code |
| sku | VARCHAR(100) | NOT NULL UNIQUE | SKU-{CAT3}-MUR-{YEAR}-{SEQ} |
| category | VARCHAR(100) | | e.g., ERP, CRM |
| rate | DECIMAL(18,2) | NOT NULL CHECK (rate >= 0) | Standard per-unit rate |
| price | DECIMAL(18,2) | CHECK (price >= 0) | List price |
| description | TEXT | | |
| status | product_status | NOT NULL DEFAULT 'active' | Active, Inactive |
| owner_id | UUID | NOT NULL FK -> User.id | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| deleted_at | TIMESTAMPTZ | | |

**Indexes:** (category), (sku UNIQUE)

### 2.5 Contract

Core contract record. Represents a software maintenance agreement.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| vendor_id | UUID | NOT NULL FK -> Vendor.id | |
| contract_name | VARCHAR(200) | NOT NULL | |
| contract_number | VARCHAR(100) | NOT NULL UNIQUE | MCR-{YEAR}-{SEQ} |
| contract_type | contract_type | NOT NULL | Maintenance, Support, Subscription, SaaS, License, Other |
| parent_contract_id | UUID | FK -> Contract.id | Master agreement linkage |
| description | TEXT | | |
| start_date | DATE | NOT NULL | |
| end_date | DATE | NOT NULL CHECK (end_date > start_date) | |
| renewal_date | DATE | | When renewal must initiate |
| renewal_window_days | INTEGER | NOT NULL DEFAULT 90 CHECK (renewal_window_days BETWEEN 30 AND 365) | |
| total_contract_value | DECIMAL(18,2) | NOT NULL CHECK (total_contract_value >= 0) | |
| currency | currency_code | NOT NULL DEFAULT 'USD' | |
| status | contract_status | NOT NULL DEFAULT 'draft' | Draft, Active, Expired, Terminated |
| auto_renewal | BOOLEAN | NOT NULL DEFAULT false | |
| auto_renewal_notice_period | INTEGER | CHECK (notice_period > 0) | Days before end for non-renewal notice |
| auto_renewal_term_months | INTEGER | DEFAULT 12 | |
| billing_frequency | billing_frequency | NOT NULL DEFAULT 'annual' | Annual, Quarterly, Monthly, One-time |
| budget_code_default | VARCHAR(50) | | |
| notification_email | VARCHAR(200) | | |
| notification_enabled | BOOLEAN | NOT NULL DEFAULT false | |
| owner_id | UUID | NOT NULL FK -> User.id | Contract owner |
| renewal_count | INTEGER | NOT NULL DEFAULT 0 | Counter cache |
| latest_renewal_id | UUID | FK -> Renewal.id | Most recent renewal |
| version | INTEGER | NOT NULL DEFAULT 1 | Amendment version |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| deleted_at | TIMESTAMPTZ | | |

**Indexes:** (vendor_id), (end_date), (status), (contract_type)

### 2.6 ContractLineItem

Products covered under a contract. Uses ProductSnapshot for immutability.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| contract_id | UUID | NOT NULL FK -> Contract.id ON DELETE CASCADE | |
| product_id | UUID | NOT NULL FK -> Product.id | |
| product_snapshot | JSONB | NOT NULL | Immutable: {name, code, sku, category, rate, description} |
| description | VARCHAR(500) | | Line-specific override |
| quantity | INTEGER | NOT NULL CHECK (quantity >= 1) | |
| unit_rate | DECIMAL(18,2) | NOT NULL CHECK (unit_rate >= 0) | |
| line_total | DECIMAL(18,2) | NOT NULL CHECK (line_total >= 0) | qty x unit_rate |
| negotiated_rate | DECIMAL(18,2) | CHECK (negotiated_rate >= 0) | If different from standard |
| discount_percent | DECIMAL(5,2) | CHECK (discount_percent BETWEEN 0 AND 100) | |
| discount_amount | DECIMAL(18,2) | CHECK (discount_amount >= 0) | |
| tax_percent | DECIMAL(5,2) | CHECK (tax_percent BETWEEN 0 AND 100) | |
| tax_amount | DECIMAL(18,2) | CHECK (tax_amount >= 0) | |
| line_total_with_tax | DECIMAL(18,2) | CHECK (line_total_with_tax >= 0) | |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | |
| version | INTEGER | NOT NULL DEFAULT 1 | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| deleted_at | TIMESTAMPTZ | | |

**Index:** (contract_id, sort_order)

### 2.7 ContractDocument

Documents attached to a contract (SOW, signed copy, amendments).

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| contract_id | UUID | NOT NULL FK -> Contract.id ON DELETE CASCADE | |
| document_type | document_type | NOT NULL | Contract, SOW, Amendment, Attachment, Other |
| file_name | VARCHAR(255) | NOT NULL | |
| file_url | VARCHAR(500) | NOT NULL | S3 / storage URL |
| file_size_bytes | INTEGER | NOT NULL | |
| mime_type | VARCHAR(100) | NOT NULL | |
| uploaded_by | UUID | NOT NULL FK -> User.id | |
| storage_provider | VARCHAR(50) | DEFAULT 'local' | local, onedrive, s3 |
| external_file_id | VARCHAR(200) | | Provider-specific file ID |
| version | INTEGER | NOT NULL DEFAULT 1 | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| deleted_at | TIMESTAMPTZ | | |

**Index:** (contract_id, document_type)

### 2.8 ContractClause

Contract terms and conditions. Supports standard vs. deviated tracking.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| contract_id | UUID | NOT NULL FK -> Contract.id ON DELETE CASCADE | |
| clause_type | VARCHAR(100) | NOT NULL | liability_cap, termination, indemnification |
| title | VARCHAR(200) | NOT NULL | |
| content | TEXT | NOT NULL | |
| is_standard | BOOLEAN | NOT NULL DEFAULT true | From standard clause library? |
| standard_clause_id | UUID | | Link to library version |
| deviation | TEXT | | Description of deviation |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Index:** (contract_id)

### 2.9 Renewal

The core domain entity. A single contract renewal cycle.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| contract_id | UUID | NOT NULL FK -> Contract.id | |
| year | INTEGER | NOT NULL CHECK (year >= 2020) | |
| status | renewal_status | NOT NULL DEFAULT 'pending_review' | 12-state machine |
| priority | priority_level | NOT NULL DEFAULT 'normal' | Low, Normal, High, Critical |
| assigned_to | UUID | FK -> User.id | |
| assigned_at | TIMESTAMPTZ | | |
| vendor_quote_ref | VARCHAR(100) | | Vendor quote reference |
| vendor_quote_amount | DECIMAL(18,2) | CHECK (amount >= 0) | |
| vendor_quote_currency | currency_code | DEFAULT 'USD' | |
| vendor_quote_received_at | TIMESTAMPTZ | | |
| vendor_quote_document_url | VARCHAR(500) | | |
| negotiated_amount | DECIMAL(18,2) | CHECK (amount >= 0) | |
| negotiated_at | TIMESTAMPTZ | | |
| budget_code | VARCHAR(50) | | |
| budget_approved_amount | DECIMAL(18,2) | CHECK (amount >= 0) | |
| budget_checked_at | TIMESTAMPTZ | | |
| legal_approval_status | approval_status | | |
| legal_reviewed_at | TIMESTAMPTZ | | |
| usage_attestation_id | UUID | FK -> UsageAttestation.id | |
| business_approved_at | TIMESTAMPTZ | | |
| po_id | UUID | FK -> PurchaseOrder.id | |
| invoice_id | UUID | FK -> Invoice.id | |
| cancellation_reason | TEXT | | |
| hold_reason | TEXT | | |
| hold_until | DATE | CHECK (hold_until > CURRENT_DATE) | |
| escalation_level | INTEGER | NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 4) | |
| escalation_escalated_at | TIMESTAMPTZ | | |
| notes | TEXT | | |
| tags | VARCHAR(50)[] | DEFAULT '{}' | Max 10 tags |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| deleted_at | TIMESTAMPTZ | | |

**Unique constraint:** UNIQUE (contract_id, year) — no duplicate renewals
**Indexes:** (status), (assigned_to, status), (priority, status), (created_at DESC), (contract_id)

### 2.10 RenewalTimelineEntry

Visual timeline of state transitions within a renewal.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| renewal_id | UUID | NOT NULL FK -> Renewal.id ON DELETE CASCADE | |
| from_status | renewal_status | | Null for initial creation |
| to_status | renewal_status | NOT NULL | |
| action | VARCHAR(100) | NOT NULL | Human readable |
| performed_by | UUID | NOT NULL FK -> User.id | |
| performed_at | TIMESTAMPTZ | NOT NULL | |
| comments | TEXT | | |
| metadata | JSONB | | Amounts, references |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Index:** (renewal_id, performed_at DESC)

### 2.11 ApprovalRecord

A single approval decision in a renewal's approval chain.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| renewal_id | UUID | NOT NULL FK -> Renewal.id ON DELETE CASCADE | |
| approver_type | approval_type | NOT NULL | Legal, Business, Financial, ProcurementMgr, CTO, CFO |
| approver_id | UUID | NOT NULL FK -> User.id | |
| delegate_id | UUID | FK -> User.id | Approved on behalf of |
| status | approval_step_status | NOT NULL DEFAULT 'pending' | Pending, Approved, Rejected, Cancelled |
| comments | TEXT | | |
| approval_chain_order | INTEGER | NOT NULL DEFAULT 1 | |
| sla_deadline | TIMESTAMPTZ | NOT NULL | |
| sla_breached | BOOLEAN | NOT NULL DEFAULT false | |
| reminded_at | TIMESTAMPTZ | | Last reminder sent |
| escalation_count | INTEGER | NOT NULL DEFAULT 0 CHECK (count >= 0) | |
| decided_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Unique constraint:** UNIQUE (renewal_id, approver_type, status) WHERE status = 'pending' — only one pending per type
**Indexes:** (renewal_id, approval_chain_order), (approver_id, status)

### 2.12 UsageAttestation

Business Owner confirmation that software is still required.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| renewal_id | UUID | NOT NULL FK -> Renewal.id | |
| attested_by | UUID | NOT NULL FK -> User.id | |
| current_user_count | INTEGER | NOT NULL CHECK (count > 0) | |
| planned_changes | TEXT | | |
| still_required | BOOLEAN | NOT NULL | |
| alternative_considered | BOOLEAN | | |
| comments | TEXT | | |
| attested_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| expires_at | TIMESTAMPTZ | NOT NULL | 12 months from attestation |

### 2.13 PurchaseOrder

PO generated from an approved renewal.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| renewal_id | UUID | NOT NULL UNIQUE FK -> Renewal.id | One PO per renewal |
| vendor_id | UUID | NOT NULL FK -> Vendor.id | |
| po_number | VARCHAR(50) | NOT NULL UNIQUE | PO-{YEAR}-{SEQ} |
| status | po_status | NOT NULL DEFAULT 'draft' | |
| total_amount | DECIMAL(18,2) | NOT NULL CHECK (amount >= 0) | |
| currency | currency_code | NOT NULL DEFAULT 'USD' | |
| budget_code | VARCHAR(50) | | |
| budget_approved_amount | DECIMAL(18,2) | CHECK (amount >= 0) | |
| notes | TEXT | | |
| vendor_po_reference | VARCHAR(100) | | Vendor's reference |
| sent_at | TIMESTAMPTZ | | |
| sent_by | UUID | FK -> User.id | |
| sent_method | VARCHAR(50) | | email, edi, portal |
| acknowledged_at | TIMESTAMPTZ | | |
| rejected_at | TIMESTAMPTZ | | |
| rejection_reason | TEXT | | |
| document_url | VARCHAR(500) | | |
| erp_sync_status | erp_sync_status | NOT NULL DEFAULT 'pending' | |
| erp_synced_at | TIMESTAMPTZ | | |
| erp_reference | VARCHAR(100) | | |
| version | INTEGER | NOT NULL DEFAULT 1 | |
| created_by | UUID | NOT NULL FK -> User.id | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| deleted_at | TIMESTAMPTZ | | |

**Indexes:** (vendor_id, status), (erp_sync_status)

### 2.14 POLineItem

Line items within a PO, derived from contract line items.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| po_id | UUID | NOT NULL FK -> PurchaseOrder.id ON DELETE CASCADE | |
| line_item_id | UUID | FK -> ContractLineItem.id | Source reference |
| description | VARCHAR(500) | NOT NULL | |
| quantity | INTEGER | NOT NULL CHECK (quantity >= 1) | |
| unit_rate | DECIMAL(18,2) | NOT NULL CHECK (rate >= 0) | |
| line_total | DECIMAL(18,2) | NOT NULL CHECK (total >= 0) | |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Index:** (po_id, sort_order)

### 2.15 Invoice

Invoice received from vendor for a renewal.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| invoice_number | VARCHAR(100) | NOT NULL | Vendor's invoice number |
| vendor_id | UUID | NOT NULL FK -> Vendor.id | |
| po_id | UUID | NOT NULL FK -> PurchaseOrder.id | |
| renewal_id | UUID | FK -> Renewal.id | |
| status | invoice_status | NOT NULL DEFAULT 'received' | |
| invoice_amount | DECIMAL(18,2) | NOT NULL CHECK (amount >= 0) | |
| invoice_currency | currency_code | NOT NULL DEFAULT 'USD' | |
| po_matched_amount | DECIMAL(18,2) | CHECK (amount >= 0) | |
| variance_amount | DECIMAL(18,2) | | Computed |
| variance_pct | DECIMAL(5,2) | | Computed |
| variance_reason | variance_reason | | |
| payment_status | payment_status | NOT NULL DEFAULT 'pending' | |
| payment_due_date | DATE | | |
| paid_date | DATE | | |
| payment_reference | VARCHAR(100) | | |
| invoice_date | DATE | | |
| received_date | DATE | NOT NULL DEFAULT CURRENT_DATE | |
| document_url | VARCHAR(500) | | |
| erp_sync_status | erp_sync_status | NOT NULL DEFAULT 'pending' | |
| erp_synced_at | TIMESTAMPTZ | | |
| notes | TEXT | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| deleted_at | TIMESTAMPTZ | | |

**Unique constraint:** UNIQUE (invoice_number, vendor_id)
**Indexes:** (po_id), (vendor_id, status), (erp_sync_status)

### 2.16 User

Platform user. Maps directly to stakeholder roles S1-S10.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| username | VARCHAR(80) | NOT NULL UNIQUE | |
| email | VARCHAR(200) | NOT NULL UNIQUE | |
| password_hash | VARCHAR(255) | NOT NULL | BCrypt |
| role | user_role | NOT NULL DEFAULT 'viewer' | |
| status | user_status | NOT NULL DEFAULT 'active' | Active, Inactive, Suspended |
| department | VARCHAR(100) | | |
| business_unit | VARCHAR(100) | | |
| manager_id | UUID | FK -> User.id | |
| notification_preferences | JSONB | DEFAULT '{}' | Per-type prefs |
| last_login_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| deleted_at | TIMESTAMPTZ | | |

**Indexes:** (role), (department)

### 2.17 ActivityLogEntry

Immutable audit trail. Insert-only.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| tenant_id | UUID | NOT NULL | Multi-tenant isolation |
| entity_type | VARCHAR(50) | NOT NULL | renewal, purchase_order, invoice, contract |
| entity_id | UUID | NOT NULL | |
| action | VARCHAR(50) | NOT NULL | status_changed, approved, rejected, created |
| previous_state | JSONB | | Snapshot before |
| new_state | JSONB | | Snapshot after |
| changed_fields | JSONB | | {field: {from: x, to: y}} |
| performed_by | UUID | NOT NULL FK -> User.id | |
| performed_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| ip_address | VARCHAR(45) | | |
| user_agent | VARCHAR(500) | | |
| correlation_id | UUID | | Links related events |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Indexes:** (entity_type, entity_id, performed_at DESC), (performed_by, performed_at DESC), (performed_at DESC), (correlation_id)
**Permissions:** INSERT only for application user. All other DML restricted.

### 2.18 Notification

In-app and email notifications to stakeholders.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| user_id | UUID | NOT NULL FK -> User.id | |
| notification_type | VARCHAR(50) | NOT NULL | |
| title | VARCHAR(200) | NOT NULL | |
| body | TEXT | | |
| entity_type | VARCHAR(50) | | For deep linking |
| entity_id | UUID | | |
| priority | notification_priority | NOT NULL DEFAULT 'normal' | |
| read | BOOLEAN | NOT NULL DEFAULT false | |
| read_at | TIMESTAMPTZ | | |
| email_sent | BOOLEAN | NOT NULL DEFAULT false | |
| email_sent_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Index:** (user_id, read, created_at DESC)

### 2.19 PolicyRule

Configurable business rules governing approvals, escalations, and validations.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| rule_type | rule_type | NOT NULL | approval_threshold, escalation, mandatory_review, validation, notification |
| name | VARCHAR(200) | NOT NULL | |
| description | TEXT | | |
| entity_type | VARCHAR(50) | NOT NULL | |
| conditions | JSONB | NOT NULL | Rule evaluation criteria |
| actions | JSONB | NOT NULL | Actions when conditions match |
| priority | INTEGER | NOT NULL DEFAULT 100 | Lower = evaluated first |
| enabled | BOOLEAN | NOT NULL DEFAULT true | |
| effective_from | DATE | | |
| effective_to | DATE | | |
| created_by | UUID | NOT NULL FK -> User.id | |
| updated_by | UUID | FK -> User.id | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| deleted_at | TIMESTAMPTZ | | |

**Index:** (rule_type, enabled, priority)

### 2.20 Task

Manual work items assigned to users, auto-created or ad-hoc.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| entity_type | VARCHAR(50) | | Related entity type |
| entity_id | UUID | | Related entity ID |
| title | VARCHAR(200) | NOT NULL | |
| description | TEXT | | |
| assignee_id | UUID | FK -> User.id | |
| creator_id | UUID | NOT NULL FK -> User.id | |
| status | task_status | NOT NULL DEFAULT 'pending' | Pending, Assigned, InProgress, Completed, Cancelled |
| priority | priority_level | NOT NULL DEFAULT 'normal' | |
| due_date | DATE | | |
| completed_at | TIMESTAMPTZ | | |
| auto_created | BOOLEAN | NOT NULL DEFAULT false | |
| source | VARCHAR(50) | | Trigger: sla_breach, budget_review, manual |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| deleted_at | TIMESTAMPTZ | | |

**Indexes:** (assignee_id, status, due_date), (entity_type, entity_id)

### 2.21 SkuCounter

Atomic sequence counter for SKU generation.

| Column | Type | Constraints | Description |
|---|---|---|---|
| prefix | VARCHAR(20) | PK | e.g., "ERP-MUR-2026" |
| next_value | INTEGER | NOT NULL DEFAULT 1 | |

---

## 3. ENUM Definitions

```sql
-- Vendor
CREATE TYPE vendor_tier AS ENUM ('strategic', 'preferred', 'standard', 'non_preferred');
CREATE TYPE risk_rating AS ENUM ('low', 'medium', 'high', 'critical');

-- Product
CREATE TYPE product_status AS ENUM ('active', 'inactive');

-- Contract
CREATE TYPE contract_type AS ENUM ('maintenance', 'support', 'subscription', 'saas', 'license', 'other');
CREATE TYPE contract_status AS ENUM ('draft', 'active', 'expired', 'terminated');
CREATE TYPE billing_frequency AS ENUM ('annual', 'quarterly', 'monthly', 'one_time');

-- Document
CREATE TYPE document_type AS ENUM ('contract', 'sow', 'amendment', 'attachment', 'other');

-- Renewal
CREATE TYPE renewal_status AS ENUM (
  'pending_review', 'assigned', 'quote_received',
  'budget_check', 'budget_review', 'budget_passed',
  'legal_review', 'legal_approved', 'legal_rejected',
  'business_approval', 'business_approved', 'business_rejected',
  'po_pending', 'po_sent', 'invoice_matched',
  'complete', 'cancelled', 'on_hold', 'escalated', 'stalled'
);
CREATE TYPE priority_level AS ENUM ('low', 'normal', 'high', 'critical');

-- Approval
CREATE TYPE approval_type AS ENUM ('legal', 'business_owner', 'financial', 'procurement_manager', 'cto', 'cfo');
CREATE TYPE approval_step_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'deferred', 'escalated');

-- PO
CREATE TYPE po_status AS ENUM ('draft', 'sent', 'acknowledged', 'rejected', 'amended', 'complete', 'cancelled', 'send_failed');
CREATE TYPE erp_sync_status AS ENUM ('pending', 'synced', 'failed');

-- Invoice
CREATE TYPE invoice_status AS ENUM ('received', 'matching', 'matched', 'exception', 'pending_payment', 'paid', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'scheduled', 'paid');
CREATE TYPE variance_reason AS ENUM ('none', 'price_difference', 'quantity_difference', 'currency_mismatch', 'discount_mismatch', 'tax_mismatch', 'other');

-- User
CREATE TYPE user_role AS ENUM ('admin', 'renewals_manager', 'procurement', 'financial_analyst', 'legal_counsel', 'business_owner', 'vendor_manager', 'executive', 'auditor', 'viewer');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');

-- Notification
CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high', 'critical');

-- Policy
CREATE TYPE rule_type AS ENUM ('approval_threshold', 'escalation', 'mandatory_review', 'validation', 'notification');

-- Task
CREATE TYPE task_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');

-- Currency
CREATE TYPE currency_code AS ENUM ('USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'CHF', 'SGD', 'HKD');
```

---

## 4. Key Constraints Summary

### Primary Keys
All 21 tables use UUID primary keys with `DEFAULT gen_random_uuid()`.

### Foreign Keys
| Source | Target | Type | Behavior |
|---|---|---|---|
| Contract.vendor_id | Vendor.id | Mandatory | RESTRICT on delete |
| Contract.parent_contract_id | Contract.id | Optional | SET NULL on delete |
| Contract.owner_id | User.id | Mandatory | RESTRICT |
| Contract.latest_renewal_id | Renewal.id | Optional | SET NULL |
| ContractLineItem.contract_id | Contract.id | Mandatory | CASCADE |
| ContractLineItem.product_id | Product.id | Mandatory | RESTRICT |
| ContractDocument.contract_id | Contract.id | Mandatory | CASCADE |
| ContractDocument.uploaded_by | User.id | Mandatory | RESTRICT |
| ContractClause.contract_id | Contract.id | Mandatory | CASCADE |
| Renewal.contract_id | Contract.id | Mandatory | RESTRICT |
| Renewal.assigned_to | User.id | Optional | SET NULL |
| Renewal.usage_attestation_id | UsageAttestation.id | Optional | SET NULL |
| RenewalTimelineEntry.renewal_id | Renewal.id | Mandatory | CASCADE |
| RenewalTimelineEntry.performed_by | User.id | Mandatory | RESTRICT |
| ApprovalRecord.renewal_id | Renewal.id | Mandatory | CASCADE |
| ApprovalRecord.approver_id | User.id | Mandatory | RESTRICT |
| ApprovalRecord.delegate_id | User.id | Optional | SET NULL |
| UsageAttestation.renewal_id | Renewal.id | Mandatory | RESTRICT |
| PurchaseOrder.renewal_id | Renewal.id | Mandatory | RESTRICT (UNIQUE) |
| PurchaseOrder.vendor_id | Vendor.id | Mandatory | RESTRICT |
| PurchaseOrder.sent_by | User.id | Optional | SET NULL |
| PurchaseOrder.created_by | User.id | Mandatory | RESTRICT |
| POLineItem.po_id | PurchaseOrder.id | Mandatory | CASCADE |
| POLineItem.line_item_id | ContractLineItem.id | Optional | SET NULL |
| Invoice.po_id | PurchaseOrder.id | Mandatory | RESTRICT |
| Invoice.vendor_id | Vendor.id | Mandatory | RESTRICT |
| Invoice.renewal_id | Renewal.id | Optional | SET NULL |
| Notification.user_id | User.id | Mandatory | CASCADE |
| PolicyRule.created_by | User.id | Mandatory | RESTRICT |
| PolicyRule.updated_by | User.id | Optional | SET NULL |
| Task.assignee_id | User.id | Optional | SET NULL |
| Task.creator_id | User.id | Mandatory | RESTRICT |
| Vendor.relationship_manager_id | User.id | Optional | SET NULL |
| User.manager_id | User.id | Optional | SET NULL |
| Product.owner_id | User.id | Mandatory | RESTRICT |
| VendorContact.vendor_id | Vendor.id | Mandatory | CASCADE |
| VendorScorecard.vendor_id | Vendor.id | Mandatory | CASCADE |

### Unique Constraints
| Table | Columns | Purpose |
|---|---|---|
| Vendor | vendor_code | Internal identifier uniqueness |
| VendorContact | (vendor_id, email) | No duplicate contacts per email |
| Product | sku | Global SKU uniqueness |
| Contract | contract_number | MCR number uniqueness |
| ContractLineItem | (contract_id, product_id, sort_order) | No duplicate product at same position |
| Renewal | (contract_id, year) | One renewal per contract per year |
| ApprovalRecord | (renewal_id, approver_type) WHERE status='pending' | One pending approval per type |
| PurchaseOrder | renewal_id | One PO per renewal |
| PurchaseOrder | po_number | PO number uniqueness |
| Invoice | (invoice_number, vendor_id) | No duplicate invoices |
| User | username | Login uniqueness |
| User | email | Contact uniqueness |
| VendorScorecard | (vendor_id, scorecard_period) | One scorecard per period |
| SkuCounter | prefix | One sequence per prefix |

### Check Constraints
| Table | Constraint | Rule |
|---|---|---|
| Contract | end_date_after_start | end_date > start_date |
| Contract | valid_window | renewal_window_days BETWEEN 30 AND 365 |
| Contract | positive_value | total_contract_value >= 0 |
| Contract | valid_notice | auto_renewal_notice_period > 0 (when auto_renewal=true, application-enforced) |
| ContractLineItem | valid_quantity | quantity >= 1 |
| ContractLineItem | valid_rate | unit_rate >= 0 |
| ContractLineItem | valid_line_total | line_total >= 0 |
| ContractLineItem | valid_discount | discount_percent BETWEEN 0 AND 100 |
| ContractLineItem | valid_tax | tax_percent BETWEEN 0 AND 100 |
| Renewal | valid_year | year >= 2020 |
| Renewal | valid_priority | priority IN ('low','normal','high','critical') |
| Renewal | valid_escalation | escalation_level BETWEEN 0 AND 4 |
| Renewal | hold_date_future | hold_until > CURRENT_DATE (when set) |
| PurchaseOrder | positive_amount | total_amount >= 0 |
| POLineItem | valid_quantity | quantity >= 1 |
| POLineItem | valid_rate | unit_rate >= 0 |
| POLineItem | valid_total | line_total >= 0 |
| Invoice | positive_amount | invoice_amount >= 0 |
| UsageAttestation | positive_users | current_user_count > 0 |
| VendorScorecard | valid_score | overall_score BETWEEN 0 AND 10 |
| ApprovalRecord | valid_escalation | escalation_count >= 0 |
| Task | valid_priority | priority IN ('low','normal','high','critical') |

---

## 5. Indexing Strategy

### Performance Indexes

| Table | Index | Type | Columns | Query Pattern |
|---|---|---|---|---|
| contract | idx_contract_vendor | B-tree | (vendor_id) | Contracts by vendor |
| contract | idx_contract_end_date | B-tree | (end_date) | Renewal identification (daily job) |
| contract | idx_contract_status | B-tree | (status) | Status filter |
| contract | idx_contract_type | B-tree | (contract_type) | Type filter |
| contract_line_item | idx_cli_contract_sort | B-tree | (contract_id, sort_order) | Line items ordered |
| contract_document | idx_cdoc_contract_type | B-tree | (contract_id, document_type) | Documents by type |
| contract_clause | idx_cclause_contract | B-tree | (contract_id) | Contract clauses |
| renewal | idx_renewal_status | B-tree | (status) | Pipeline by status |
| renewal | idx_renewal_assignee_status | B-tree | (assigned_to, status) | My assignments |
| renewal | idx_renewal_priority_status | B-tree | (priority, status) | Priority pipeline |
| renewal | idx_renewal_created | B-tree DESC | (created_at) | Recent renewals |
| renewal | idx_renewal_contract | B-tree | (contract_id, year) | Contract renewal history |
| renewal_timeline | idx_timeline_renewal | B-tree | (renewal_id, performed_at DESC) | Timeline ordered |
| approval_record | idx_apr_renewal_order | B-tree | (renewal_id, approval_chain_order) | Approval chain |
| approval_record | idx_apr_approver_status | B-tree | (approver_id, status) | Pending approvals for user |
| purchase_order | idx_po_vendor_status | B-tree | (vendor_id, status) | Vendor PO history |
| purchase_order | idx_po_erp_sync | B-tree | (erp_sync_status) | Pending sync |
| po_line_item | idx_po_li_po_sort | B-tree | (po_id, sort_order) | PO line items |
| invoice | idx_inv_po | B-tree | (po_id) | Invoice-PO matching |
| invoice | idx_inv_vendor_status | B-tree | (vendor_id, status) | Vendor invoice view |
| invoice | idx_inv_erp_sync | B-tree | (erp_sync_status) | Pending sync |
| activity_log | idx_act_entity | B-tree | (entity_type, entity_id, performed_at DESC) | Entity timeline |
| activity_log | idx_act_user | B-tree | (performed_by, performed_at DESC) | User history |
| activity_log | idx_act_time | B-tree DESC | (performed_at) | Recent activity (dashboard) |
| activity_log | idx_act_correlation | B-tree | (correlation_id) | Cross-entity tracing |
| notification | idx_notif_user_read | B-tree | (user_id, read, created_at DESC) | Notification center |
| product | idx_product_sku | UNIQUE B-tree | (sku) | SKU lookup |
| product | idx_product_category | B-tree | (category) | Category filter |
| user | idx_user_role | B-tree | (role) | Role-based queries |
| user | idx_user_department | B-tree | (department) | Department queries |
| policy_rule | idx_policy_type_enabled | B-tree | (rule_type, enabled, priority) | Rule evaluation |
| task | idx_task_assignee | B-tree | (assignee_id, status, due_date) | User task queue |
| task | idx_task_entity | B-tree | (entity_type, entity_id) | Entity-linked tasks |
| vendor_contact | idx_vc_vendor_primary | B-tree | (vendor_id, is_primary) | Primary contact lookup |

### Partial Indexes

```sql
-- Only pending renewals for pipeline queries
CREATE INDEX idx_renewal_active_pipeline ON renewal (status, priority, created_at)
  WHERE status NOT IN ('complete', 'cancelled');

-- Only unread notifications for notification count
CREATE INDEX idx_notification_unread ON notification (user_id, created_at DESC)
  WHERE read = false;

-- Only active contracts for renewal identification
CREATE INDEX idx_contract_active_end ON contract (end_date)
  WHERE status = 'active';

-- Only pending approvals for escalation monitoring
CREATE INDEX idx_approval_pending_sla ON approval_record (sla_deadline)
  WHERE status = 'pending';
```

### Composite Index Rationale

The renewal pipeline query drives the most critical dashboard widget:

```sql
-- Dashboard: "My Active Renewals" for S1
SELECT r.*, c.contract_name, v.name AS vendor_name
FROM renewal r
JOIN contract c ON c.id = r.contract_id
JOIN vendor v ON v.id = c.vendor_id
WHERE r.status NOT IN ('complete', 'cancelled')
  AND (r.assigned_to = :user_id OR :user_id IN (SELECT id FROM "user" WHERE role = 'renewals_manager'))
ORDER BY r.priority DESC, r.created_at ASC;
```

Covered by: `idx_renewal_active_pipeline` + `idx_renewal_assignee_status`

---

## 6. Versioning

### Amendment Versioning

Contracts, PurchaseOrders, and ContractDocuments use integer `version` columns for amendment tracking.

| Entity | Version Strategy | History Table |
|---|---|---|
| Contract | Increment on amendment. `parent_contract_id` links master agreements. | `contract_version_history` |
| PurchaseOrder | Increment on PO amendment (rejected -> amended -> re-sent). Original version retained. | None — prior versions stored as JSONB snapshot in `contract_version_history` |
| ContractDocument | Increment on replace. Old file versioned in storage. | None — old files retained in storage with version suffix |

### contract_version_history

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| contract_id | UUID | NOT NULL FK -> Contract.id | |
| version | INTEGER | NOT NULL | |
| snapshot | JSONB | NOT NULL | Full contract state at this version (including line items, documents, clauses) |
| valid_from | DATE | NOT NULL | When this version became effective |
| valid_to | DATE | | When this version was superseded |
| superseded_by | UUID | FK -> contract_version_history.id | |
| change_summary | TEXT | | Human-readable description of changes |
| changed_by | UUID | NOT NULL FK -> User.id | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Index:** (contract_id, version DESC)

---

## 7. Soft Delete Strategy

### Rules

| Scenario | Behavior |
|---|---|
| Entity has dependent FKs | Soft delete via `deleted_at`. FK constraints remain satisfied. |
| Entity has NO dependent FKs | Hard delete permitted (e.g., Draft contract with no renewals). |
| Soft-deleted entity queried | All application queries include `WHERE deleted_at IS NULL`. |
| Cascade on soft delete | Not automatic. Application layer updates dependent records if policy requires (e.g., cancelling renewals when contract is terminated). |
| Restore | Setting `deleted_at = NULL` restores the entity. Logged in ActivityLog. |

### Soft-Delete Eligible Tables

All tables except:
- `activity_log` — insert-only, never deleted
- `sku_counter` — pure sequence data
- `renewal_timeline_entry` — immutable history
- `contract_version_history` — immutable history

### Hard-Delete Eligible Tables

- `contract` — only when status = 'draft' AND no renewals reference it
- `product` — only when no ContractLineItem references it
- All soft-deleted records after configurable retention period (default: 7 years for financial entities, 3 years for operational entities)

---

## 8. Audit Strategy

### Application-Level Audit

Every state-changing operation writes to `activity_log`:

| Operation | Audit Action | Captures |
|---|---|---|
| CREATE entity | `{entity}_created` | Full new_state snapshot |
| UPDATE entity | `{entity}_updated` | changed_fields diff |
| STATUS CHANGE | `{entity}_status_changed` | from_status, to_status |
| DELETE (soft) | `{entity}_deleted` | deleted_at timestamp |
| RESTORE (soft) | `{entity}_restored` | deleted_at cleared |
| APPROVE | `approval_approved` | ApprovalRecord ID, comments |
| REJECT | `approval_rejected` | ApprovalRecord ID, reason |
| TRANSITION | `renewal_transitioned` | From status, to status, transition trigger |

### Database-Level Audit

| Mechanism | Implementation |
|---|---|
| **Application user permissions** | Application DB user has INSERT-only on `activity_log`. No UPDATE, DELETE, or TRUNCATE. |
| **Trigger-based change capture** | (Optional) PostgreSQL audit triggers can mirror activity_log writes to a separate `audit_log_archive` table for additional safety. |
| **Connection audit** | `pg_stat_activity` logged periodically. All application connections use named service accounts. |

### Audit Retention

| Data | Retention |
|---|---|
| ActivityLog (application) | 7 years (financial compliance) |
| ActivityLog (archive) | 10 years (legal hold) |
| contract_version_history | Indefinite |

---

## 9. History Strategy

### Immutable History

Two tables are strictly insert-only (immutable):

| Table | Rationale |
|---|---|
| `activity_log` | Audit trail. No row may be modified or deleted. |
| `renewal_timeline_entry` | State machine evidence. No row may be modified or deleted. |

### Versioned History

`contract_version_history` stores point-in-time snapshots of contract state. A new version is created when:
1. Contract terms are amended (end_date, value, line items)
2. The contract is renewed (new end_date, potentially new terms)
3. A correction is made that changes financial fields

### Query Pattern for History

```sql
-- Get contract state as of a specific date
SELECT * FROM contract_version_history
WHERE contract_id = :id
  AND valid_from <= :as_of_date
  AND (valid_to IS NULL OR valid_to > :as_of_date)
ORDER BY version DESC
LIMIT 1;
```

---

## 10. Migration Strategy

| Principle | Rule |
|---|---|
| Tool | Alembic (or equivalent) |
| Reversibility | Every migration has a downgrade script |
| Naming | `YYYYMMDD_description` |
| Schema changes | DDL migrations only |
| Data migrations | Separate scripts (never mixed with DDL) |
| Enum changes | CREATE TYPE + ALTER TABLE, never in-place ALTER TYPE |
| Testing | Every migration tested against a copy of production data before deployment |
| Order | Schema -> Indexes -> Constraints -> Data (in separate migration steps) |
| Zero-downtime | Preferred: add columns as nullable, backfill, then add NOT NULL |
