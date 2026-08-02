# Contract Aggregate Specification

**Status:** Draft (Sprint 1)
**Date:** 2026-07-20
**Constitution:** `docs/03-domain-model/contract-constitution.md`

---

## 1. Aggregate Root Responsibilities

The **Contract** is the central business object. It is the long-lived source of truth for software maintenance agreements.

### Responsibilities

| Responsibility | Description |
|---|---|
| **Identity** | Assign and own `contract_id`, `contract_number`. Immutable after creation. |
| **Product Coverage** | Maintain the list of products covered (via ContractLineItem). At least one required for Activation. |
| **Term Management** | Track start_date, end_date, renewal_date. Drive renewal window detection. |
| **Vendor Relationship** | Reference the Vendor. Immutable after activation. |
| **Document Repository** | Own contract-scoped documents. Separate from renewal-scoped documents. |
| **Clause Repository** | Track legal terms and deviations from standard clauses. |
| **Version History** | Auto-generate snapshots on every state change. Immutable. |
| **Renewal History** | Reference past Renewals. Counter-cache `renewal_count`. |
| **Lifecycle Enforcement** | Own the 6-state machine. Enforce valid transitions. |
| **Integrity Monitoring** | Detect and report INCONSISTENT state. |

---

## 2. Child Entities

### 2.1 ContractLineItem

| Field | Type | Required | Description |
|---|---|---|---|
| id | Integer | Yes | PK |
| contract_id | Integer | Yes | FK to Contract |
| product_id | Integer | Yes | FK to Product |
| product_snapshot | JSON | Yes | Immutable copy: {name, sku, category, rate} |
| description | String(500) | No | Line-specific description |
| quantity | Integer | Yes | Number of units/licenses |
| unit_rate | Decimal(18,2) | Yes | Per-unit rate |
| discount_percent | Decimal(5,2) | No | 0-100 |
| discount_amount | Decimal(18,2) | No | Computed or manual |
| tax_percent | Decimal(5,2) | No | 0-100 |
| tax_amount | Decimal(18,2) | No | Computed |
| line_total | Decimal(18,2) | Yes | quantity × unit_rate - discount + tax |
| sort_order | Integer | Yes | Display order |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |

#### Rules
- `quantity` ≥ 1
- `unit_rate` ≥ 0
- `discount_percent` 0-100
- `tax_percent` 0-100
- `line_total` = (quantity × unit_rate) - discount_amount + tax_amount
- `product_snapshot` is immutable after creation
- Cascade soft-delete with parent Contract

#### Computation
```
base_amount = quantity × unit_rate
discount_amount = base_amount × (discount_percent / 100)
taxable_amount = base_amount - discount_amount
tax_amount = taxable_amount × (tax_percent / 100)
line_total = taxable_amount + tax_amount
```

### 2.2 ContractDocument

| Field | Type | Required | Description |
|---|---|---|---|
| id | Integer | Yes | PK |
| contract_id | Integer | Yes | FK to Contract |
| document_type | DocumentType | Yes | contract, sow, amendment, attachment, other |
| file_name | String(255) | Yes | |
| stored_file_name | String(255) | Yes | |
| file_path | String(500) | Yes | |
| content_type | String(120) | Yes | |
| file_size | Integer | Yes | Bytes |
| storage_provider | String(50) | Yes | local, onedrive, s3 |
| storage_reference | String(500) | No | Provider-specific ID |
| version_group_id | String(36) | No | Links document versions |
| version | Integer | No | 1 | Version number within group |
| is_latest_version | Boolean | No | True |
| uploaded_by | Integer | Yes | FK to User |
| uploaded_at | DateTime | Yes | |

#### Document Type Enum
```python
DocumentType = Enum {
    CONTRACT = "contract"
    SOW = "sow"
    AMENDMENT = "amendment"
    ATTACHMENT = "attachment"
    OTHER = "other"
}
```

### 2.3 ContractClause

| Field | Type | Required | Description |
|---|---|---|---|
| id | Integer | Yes | PK |
| contract_id | Integer | Yes | FK to Contract |
| clause_type | String(100) | Yes | liability_cap, termination, indemnification, payment_terms, data_protection, sla, other |
| title | String(200) | Yes | |
| content | Text | Yes | Full clause text |
| is_standard | Boolean | Yes | From standard clause library? |
| standard_clause_id | Integer | No | Link to library version if standard |
| deviation | Text | No | Description of deviation from standard |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |

### 2.4 ContractVersionHistory

| Field | Type | Required | Description |
|---|---|---|---|
| id | Integer | Yes | PK |
| contract_id | Integer | Yes | FK to Contract |
| version | Integer | Yes | Incrementing version number |
| status | String(50) | Yes | Contract status at this version |
| snapshot | JSON | Yes | Full contract snapshot (all fields + line items + clauses) |
| change_description | String(500) | No | Summary of what changed |
| changed_by | Integer | Yes | FK to User |
| created_at | DateTime | Yes | |

#### Rules
- Immutable after creation
- One entry per state change (create, activate, update, terminate, etc.)
- Snapshot includes all child entities at that point in time
- Version number auto-increments

---

## 3. Value Objects

### 3.1 ContractStatus

```python
class ContractStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    EXPIRED = "expired"
    TERMINATED = "terminated"
    INCONSISTENT = "inconsistent"
    ARCHIVED = "archived"
    DELETED = "deleted"
```

### 3.2 DocumentType

```python
class DocumentType(str, Enum):
    CONTRACT = "contract"
    SOW = "sow"
    AMENDMENT = "amendment"
    ATTACHMENT = "attachment"
    OTHER = "other"
```

### 3.3 BillingFrequency

```python
class BillingFrequency(str, Enum):
    ANNUAL = "annual"
    QUARTERLY = "quarterly"
    MONTHLY = "monthly"
    ONE_TIME = "one_time"
```

### 3.4 Money

```python
Money = {
    amount: Decimal(18, 2),
    currency: str  # ISO 4217
}
```

### 3.5 ProductSnapshot

```python
# Immutable copy stored at line item creation time
ProductSnapshot = {
    product_id: int,
    name: str,
    sku: str,
    category: str,
    rate: Decimal(18, 2),
    description: str
}
```

---

## 4. Commands

| Command | Description | Target Status | Required Role |
|---|---|---|---|
| `CreateContract` | Create in DRAFT | DRAFT | S1, S2, S7, S9 |
| `UpdateContract` | Update DRAFT or ACTIVE fields | (same status) | S1, S2, S7, S9 |
| `ActivateContract` | DRAFT → ACTIVE | ACTIVE | S1, S7, S9 |
| `AddLineItem` | Add product line item | (same status) | S1, S2, S7, S9 |
| `UpdateLineItem` | Change quantity/rate/discount | (same status) | S1, S2, S7, S9 |
| `RemoveLineItem` | Remove product line item | (same status) | S1, S2, S7, S9 |
| `UploadDocument` | Attach document | (same status) | S1, S2, S4, S5, S7, S9 |
| `DeleteDocument` | Remove attached document | (same status) | S1, S2, S7, S9 |
| `AddClause` | Add legal clause | (same status) | S4, S7, S9 |
| `UpdateClause` | Modify clause | (same status) | S4, S7, S9 |
| `TerminateContract` | ACTIVE → TERMINATED | TERMINATED | S1, S7, S9 |
| `ArchiveContract` | ACTIVE → ARCHIVED | ARCHIVED | S1, S9 |
| `DeleteContract` | DRAFT → DELETED | DELETED | S1, S2, S7, S9 |
| `ResolveInconsistency` | INCONSISTENT → ACTIVE | ACTIVE | S1, S7, S9 |
| `RestoreContract` | EXPIRED/TERMINATED → ACTIVE (admin) | ACTIVE | S9 |

---

## 5. Domain Events

See Event Catalog (`docs/03-domain-model/event-catalog.md`) for the full Contract events section.

---

## 6. State Machine

### 6.1 Diagram

```
[User creates contract]
         │
         ▼
   ┌──────────┐
   │  DRAFT   │◄──── (edit/save)
   └────┬─────┘
        │ [User activates]
        ▼
   ┌──────────┐
   │  ACTIVE  │─────────────────────────────────────┐
   └────┬─────┘                                      │
        │                                            │
        ├── [end_date reached, no active renewal]    │
        │         ▼                                  │
        │   ┌──────────┐                             │
        │   │ EXPIRED  │                             │
        │   └────┬─────┘                             │
        │        │ [Renewal processed]               │
        │        ▼                                   │
        │   ┌──────────┐                             │
        │   │  ACTIVE  │  (re-entry via renewal)    │
        │   └──────────┘                             │
        │                                            │
        ├── [User terminates]                        │
        │         ▼                                  │
        │   ┌────────────┐                           │
        │   │ TERMINATED │                           │
        │   └─────┬──────┘                           │
        │         │ [Admin reversal]                │
        │         ▼                                  │
        │   ┌──────────┐                             │
        │   │  ACTIVE  │                             │
        │   └──────────┘                             │
        │                                            │
        ├── [Integrity check fails]                  │
        │         ▼                                  │
        │   ┌──────────────┐                         │
        │   │ INCONSISTENT │                         │
        │   └──────┬───────┘                         │
        │          │ [Data corrected]                │
        │          ▼                                  │
        │   ┌──────────┐                             │
        │   │  ACTIVE  │                             │
        │   └──────────┘                             │
        │                                            │
        └── [Retention period passed]                │
                 ▼                                   │
           ┌──────────┐                              │
           │ ARCHIVED │──────────────────────────────┘
           └──────────┘

   ┌──────────┐
   │  DELETED │  (only from DRAFT)
   └──────────┘
```

### 6.2 Entry Actions

| State | Entry Action |
|---|---|
| DRAFT | Auto-generate `contract_number`. Set `created_by`, `created_at`. Create VersionHistory v1. Emit `contract.created`. |
| ACTIVE | Set `activated_at`. Start renewal window monitoring. Notify stakeholders. Create VersionHistory. Emit `contract.activated`. |
| EXPIRED | Notify contract owner. Stop renewal monitoring. Update `renewal_date` for next cycle. Emit `contract.expired`. |
| TERMINATED | Set `terminated_at`. Notify stakeholders. Cancel active Renewals via event. Emit `contract.terminated`. |
| INCONSISTENT | Notify contract owner and S10. Flag in admin dashboard. Create VersionHistory with consistency report. Emit `contract.inconsistent`. |
| ARCHIVED | Move documents to cold storage. Update storage_references. Emit `contract.archived`. |
| DELETED | Hard delete. Log to ActivityLog. Emit `contract.deleted`. |

### 6.3 Exit Actions

| State | Exit Action |
|---|---|
| DRAFT | None |
| ACTIVE | Clear integrity warnings. Cancel pending timers. |
| INCONSISTENT | Clear inconsistency flag. Archive consistency report. |

### 6.4 Forbidden Transitions

| From | To | Why Forbidden |
|---|---|---|
| ACTIVE | DRAFT | Cannot return to draft after activation. Amendment instead. |
| EXPIRED | DRAFT | Must go through renewal, not revert to draft. |
| EXPIRED | ACTIVE | Cannot bypass renewal. Only Renewal aggregate can reactivate. |
| TERMINATED | DRAFT | Same as above. |
| DELETED | ANY | Terminal state. |
| ACTIVE | DELETED | Only DRAFT can be hard-deleted. |

---

## 7. Persistence Model

```sql
-- ============================================================
-- CONTRACT AGGREGATE
-- ============================================================

CREATE TABLE contract (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_number VARCHAR(80) NOT NULL UNIQUE,
    vendor_id       INTEGER NOT NULL REFERENCES vendor(id),
    contract_name   VARCHAR(200) NOT NULL,
    description     TEXT,

    -- Term
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    renewal_date    DATE,
    renewal_window_days INTEGER NOT NULL DEFAULT 90,

    -- Financial
    total_contract_value   DECIMAL(18,2) NOT NULL DEFAULT 0,
    currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
    billing_frequency VARCHAR(20) DEFAULT 'annual',

    -- Status
    status          VARCHAR(50) NOT NULL DEFAULT 'draft',
    contract_version INTEGER NOT NULL DEFAULT 1,

    -- Renewal tracking
    renewal_count   INTEGER NOT NULL DEFAULT 0,
    latest_renewal_id INTEGER REFERENCES renewal(id),

    -- Notifications
    notification_enabled BOOLEAN NOT NULL DEFAULT 0,
    notification_email   VARCHAR(200),

    -- Auto-renewal
    auto_renewal    BOOLEAN NOT NULL DEFAULT 0,
    auto_renewal_notice_period INTEGER,
    auto_renewal_term_months INTEGER DEFAULT 12,

    -- Ownership
    user_id         INTEGER NOT NULL REFERENCES user(id),
    created_by_id   INTEGER NOT NULL REFERENCES user(id),
    last_modified_by_id INTEGER REFERENCES user(id),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP,

    -- Checks
    CHECK(end_date > start_date),
    CHECK(total_contract_value >= 0),
    CHECK(renewal_window_days BETWEEN 30 AND 365),
    CHECK(renewal_date IS NULL OR renewal_date <= end_date)
);

CREATE INDEX idx_contract_vendor ON contract(vendor_id);
CREATE INDEX idx_contract_status ON contract(status);
CREATE INDEX idx_contract_end_date ON contract(end_date);
CREATE INDEX idx_contract_user ON contract(user_id);
CREATE INDEX idx_contract_deleted ON contract(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================
-- CONTRACT LINE ITEM
-- ============================================================

CREATE TABLE contract_line_item (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id     INTEGER NOT NULL REFERENCES contract(id),
    product_id      INTEGER NOT NULL REFERENCES product(id),
    product_snapshot TEXT NOT NULL,  -- JSON
    description     VARCHAR(500),
    quantity        INTEGER NOT NULL,
    unit_rate       DECIMAL(18,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(18,2) DEFAULT 0,
    tax_percent     DECIMAL(5,2) DEFAULT 0,
    tax_amount      DECIMAL(18,2) DEFAULT 0,
    line_total      DECIMAL(18,2) NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK(quantity >= 1),
    CHECK(unit_rate >= 0),
    CHECK(discount_percent BETWEEN 0 AND 100),
    CHECK(tax_percent BETWEEN 0 AND 100)
);

CREATE INDEX idx_cli_contract ON contract_line_item(contract_id);
CREATE INDEX idx_cli_product ON contract_line_item(product_id);

-- ============================================================
-- CONTRACT DOCUMENT
-- ============================================================

CREATE TABLE contract_document (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id     INTEGER NOT NULL REFERENCES contract(id),
    document_type   VARCHAR(30) NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    stored_file_name VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    content_type    VARCHAR(120) NOT NULL,
    file_size       INTEGER NOT NULL,
    storage_provider VARCHAR(50) NOT NULL DEFAULT 'local',
    storage_reference VARCHAR(500),
    version_group_id VARCHAR(36),
    version         INTEGER DEFAULT 1,
    is_latest_version BOOLEAN DEFAULT 1,
    uploaded_by     INTEGER NOT NULL REFERENCES user(id),
    uploaded_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cdoc_contract ON contract_document(contract_id);

-- ============================================================
-- CONTRACT CLAUSE
-- ============================================================

CREATE TABLE contract_clause (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id     INTEGER NOT NULL REFERENCES contract(id),
    clause_type     VARCHAR(100) NOT NULL,
    title           VARCHAR(200) NOT NULL,
    content         TEXT NOT NULL,
    is_standard     BOOLEAN NOT NULL DEFAULT 0,
    standard_clause_id INTEGER,
    deviation       TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cclause_contract ON contract_clause(contract_id);

-- ============================================================
-- CONTRACT VERSION HISTORY (immutable)
-- ============================================================

CREATE TABLE contract_version_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id     INTEGER NOT NULL REFERENCES contract(id),
    version         INTEGER NOT NULL,
    status          VARCHAR(50) NOT NULL,
    snapshot        TEXT NOT NULL,  -- JSON
    change_description VARCHAR(500),
    changed_by      INTEGER NOT NULL REFERENCES user(id),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(contract_id, version)
);

CREATE INDEX idx_cvh_contract ON contract_version_history(contract_id);
```

---

## 8. Health Status Computation

The Contract health status is derived, not stored:

```python
def compute_health(contract) -> str:
    if contract.status != "active":
        return contract.status.capitalize()
    
    days_until_end = (contract.end_date - date.today()).days
    
    if days_until_end < 0:
        return "Expired"
    if days_until_end <= 7:
        return "Critical"
    if days_until_end <= 30:
        return "Warning"
    if days_until_end <= 90:
        return "Attention"
    return "Healthy"
```

---

## 9. API Contract

See `docs/06-api/contract-api-spec.md` for the complete OpenAPI specification.

---

## 10. Cross-Aggregate Interactions

| Interaction | Direction | Mechanism |
|---|---|---|
| Contract → Vendor | Read reference | `contract.vendor_id` FK |
| Contract → Renewal | Create trigger | Domain event: `contract.renewal_window_opened` → Policy → Create Renewal |
| Contract ← Renewal | Counter update | Domain event: `renewal.completed` → Policy → Update `contract.renewal_count` |
| Contract → PurchaseOrder | Through Renewal | Renewal aggregate creates PO |
| Contract → Invoice | Through Renewal/PO | PO aggregate links to Invoice |

---

## 11. Validation Rules

| Field | Rule | Error Code |
|---|---|---|
| contract_name | 1-200 characters, required | CTR-VAL-001 |
| vendor_id | Must reference active Vendor | CTR-VAL-002 |
| start_date | Must be in the past or today | CTR-VAL-003 |
| end_date | Must be after start_date | CTR-VAL-004 |
| renewal_window_days | 30-365 | CTR-VAL-005 |
| total_contract_value | Must equal sum of line_total | CTR-VAL-006 |
| notification_email | Required when notification_enabled | CTR-VAL-007 |
| line_items | At least 1 required for activation | CTR-VAL-008 |
| quantity | Per line item: ≥ 1 | CTR-VAL-009 |
| termination_reason | Required for TERMINATED | CTR-VAL-010 |
| archive_reason | Required for ARCHIVED | CTR-VAL-011 |
