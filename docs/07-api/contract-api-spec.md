# Contract Aggregate — API Specification

**Status:** Draft (Sprint 1)
**Date:** 2026-07-20
**Base URL:** `/api`
**Protocol:** HTTP/HTTPS
**Format:** JSON (request and response bodies)
**Auth:** JWT Bearer token (`Authorization: Bearer <token>`)

---

## Overview

This spec defines every endpoint for the Contract Aggregate. The API follows RESTful conventions: resources map to aggregates, child resources map to child entities, and state transitions are explicit POST actions.

### Endpoint Inventory

| Prefix | Resource | Count |
|---|---|---|
| `/api/contracts` | Contract aggregate | 7 |
| `/api/contracts/{id}/line-items` | ContractLineItem child entity | 4 |
| `/api/contracts/{id}/documents` | ContractDocument child entity | 5 |
| `/api/contracts/{id}/clauses` | ContractClause child entity | 4 |
| `/api/contracts/{id}/timeline` | ContractVersionHistory read-only | 1 |
| `/api/contracts/{id}/health` | Computed health status | 1 |
| `/api/contracts/dashboard` | Dashboard aggregation | 1 |
| **Total** | | **23 endpoints** |

---

## Common Patterns

### Pagination

All `GET` list endpoints support:

| Query param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number (1-indexed) |
| `per_page` | integer | 20 | Items per page (max 100) |
| `sort_by` | string | `created_at` | Field to sort by |
| `sort_order` | enum | `desc` | `asc` or `desc` |

Response:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

### Error Response Shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [
      {
        "field": "end_date",
        "message": "end_date must be after start_date",
        "code": "INVALID_DATE_RANGE"
      }
    ]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Request body failed validation |
| `NOT_FOUND` | 404 | Resource not found |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `CONFLICT` | 409 | State conflict (e.g., invalid transition) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `DEPENDENCY_FAILURE` | 502 | Downstream service unavailable |

### Common Query Parameters (List Endpoints)

| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by status (comma-separated for multiple) |
| `vendor_id` | integer | Filter by vendor |
| `contract_type_id` | integer | Filter by contract type |
| `user_id` | integer | Filter by owner/assignee |
| `search` | string | Full-text search on name, number, company |
| `date_from` | date | Start date range (inclusive) |
| `date_to` | date | End date range (inclusive) |
| `is_deleted` | boolean | Include soft-deleted (default false) |

---

## Endpoints

### 1. List Contracts

**`GET /api/contracts`**

Lists contracts with filtering, pagination, and search. Returns summary data (not full workspace).

**Query parameters:** standard pagination + common filters above.

**Response `200 OK`:**
```json
{
  "data": [
    {
      "id": 1,
      "contract_name": "Microsoft Enterprise Agreement 2026",
      "contract_number": "CON-2026-001",
      "vendor": {
        "id": 5,
        "name": "Microsoft Corp"
      },
      "contract_type": {
        "id": 2,
        "name": "Enterprise Agreement"
      },
      "status": "ACTIVE",
      "health": "Healthy",
      "total_contract_value": "1250000.00",
      "currency": "USD",
      "start_date": "2026-01-01",
      "end_date": "2028-12-31",
      "renewal_date": "2028-09-30",
      "days_until_end": 894,
      "assignee": {
        "id": 3,
        "name": "Alice Chen"
      },
      "created_at": "2025-11-15T10:30:00Z",
      "updated_at": "2026-07-20T08:15:00Z"
    }
  ],
  "pagination": {
    "page": 1, "per_page": 20, "total": 47, "total_pages": 3
  }
}
```

**Access Control:** All authenticated users with `contracts:read` permission.

---

### 2. Get Contract (Workspace)

**`GET /api/contracts/{contract_id}`**

Returns the full contract workspace data including all child entities and computed values.

**Path parameters:**
| Param | Type | Description |
|---|---|---|
| `contract_id` | integer | Contract ID |

**Query parameters:**
| Param | Type | Default | Description |
|---|---|---|---|
| `include` | string | `all` | Comma-separated list of sections to include: `overview,line_items,documents,clauses,timeline,health,financial,renewals,communications,tasks,approvals,analytics,organizations`. Use `minimal` for overview + status only. |
| `include_deleted_children` | boolean | false | Include soft-deleted child entities |

**Response `200 OK`:**
```json
{
  "data": {
    "id": 1,
    "contract_name": "Microsoft Enterprise Agreement 2026",
    "contract_number": "CON-2026-001",
    "status": "ACTIVE",
    "health": "Healthy",
    "overview": {
      "contract_type": { "id": 2, "name": "Enterprise Agreement" },
      "vendor": { "id": 5, "name": "Microsoft Corp", "code": "MSFT" },
      "contact_person": { "id": 12, "name": "John Smith", "email": "john@microsoft.com" },
      "assignee": { "id": 3, "name": "Alice Chen" },
      "total_contract_value": "1250000.00",
      "currency": "USD",
      "start_date": "2026-01-01",
      "end_date": "2028-12-31",
      "renewal_date": "2028-09-30",
      "days_until_end": 894,
      "days_until_renewal": 802,
      "line_item_count": 4,
      "last_modified_at": "2026-07-20T08:15:00Z",
      "last_modified_by": { "id": 3, "name": "Alice Chen" }
    },
    "health": {
      "status": "Healthy",
      "days_until_end": 894,
      "days_until_renewal": 802,
      "renewal_window_open": false,
      "last_assessment": "2026-07-20T00:00:00Z"
    },
    "line_items": [
      {
        "id": 1,
        "product_snapshot": {
          "product_id": 10,
          "sku": "EA-O365-E3",
          "product_name": "Microsoft 365 E3",
          "rate": "36.00",
          "currency": "USD"
        },
        "quantity": 500,
        "discount_percent": "10.00",
        "tax_percent": "0.00",
        "unit_price": "32.40",
        "line_total": "194400.00",
        "remarks": "Annual per-user license"
      }
    ],
    "documents": [
      {
        "id": 1,
        "file_name": "MS-EA-2026-signed.pdf",
        "content_type": "application/pdf",
        "file_size": 2457600,
        "category": "signed_agreement",
        "uploaded_by": { "id": 3, "name": "Alice Chen" },
        "uploaded_at": "2026-01-15T14:30:00Z",
        "is_latest_version": true,
        "version": 2
      }
    ],
    "clauses": [
      {
        "id": 1,
        "clause_type": "termination",
        "title": "Termination for Convenience",
        "content": "Either party may terminate...",
        "version": 1,
        "is_active": true
      }
    ],
    "timeline": {
      "entries": [
        {
          "event_type": "contract.activated",
          "performed_by": { "id": 3, "name": "Alice Chen" },
          "timestamp": "2026-01-01T09:00:00Z",
          "description": "Contract activated",
          "metadata": { "previous_status": "DRAFT" }
        }
      ],
      "pagination": { "page": 1, "per_page": 20, "total": 15, "total_pages": 1 }
    },
    "financial_summary": {
      "total_contract_value": "1250000.00",
      "spend_to_date": "388800.00",
      "remaining_value": "861200.00",
      "currency": "USD",
      "billing_frequency": "annual",
      "related_pos": [
        { "id": 3, "po_number": "PO-2026-001", "amount": "388800.00", "status": "issued" }
      ],
      "related_invoices": [
        { "id": 5, "invoice_number": "INV-2026-001", "amount": "388800.00", "status": "paid" }
      ]
    },
    "renewals": {
      "count": 1,
      "latest": {
        "id": 2,
        "renewal_year": 2028,
        "status": "pending",
        "total_value": null
      },
      "history": [
        { "id": 1, "renewal_year": 2025, "status": "completed", "total_value": "1150000.00" }
      ]
    },
    "communications": {
      "total_count": 8,
      "recent": [
        {
          "id": 1,
          "subject": "Quote request for 2026 renewal",
          "direction": "outbound",
          "sender": "alice@company.com",
          "recipient": "john@microsoft.com",
          "sent_at": "2025-10-15T11:00:00Z",
          "renewal_id": 1
        }
      ]
    },
    "tasks": {
      "open_count": 2,
      "items": [
        {
          "id": 1,
          "title": "Review updated SOW",
          "assignee": { "id": 5, "name": "Bob Li" },
          "due_date": "2026-08-01",
          "priority": "high",
          "status": "open",
          "renewal_id": 2
        }
      ]
    },
    "approvals": {
      "active": [],
      "past": [
        {
          "id": 1,
          "renewal_id": 1,
          "approver": { "id": 1, "name": "Admin" },
          "status": "approved",
          "approved_at": "2025-12-01T10:00:00Z"
        }
      ]
    },
    "related_organizations": {
      "vendor": { "id": 5, "name": "Microsoft Corp", "code": "MSFT", "tier": "platinum", "risk_rating": "low" },
      "vendor_contacts": [
        { "id": 12, "name": "John Smith", "email": "john@microsoft.com", "role": "Account Manager" }
      ],
      "internal_contacts": [
        { "id": 3, "name": "Alice Chen", "role": "Contract Owner" }
      ]
    },
    "allowed_actions": ["edit", "terminate", "upload_document", "add_line_item"],
    "created_at": "2025-11-15T10:30:00Z",
    "updated_at": "2026-07-20T08:15:00Z"
  }
}
```

**Access Control:** Requires `contracts:read`. Financial data hidden from roles without `finance:read`. Health section only for ACTIVE contracts.

**Error Responses:**
| Code | Condition |
|---|---|
| 404 | Contract not found |
| 403 | Insufficient permissions |

---

### 3. Create Contract

**`POST /api/contracts`**

Creates a new contract in DRAFT status. Accepts contract details and optional line items, documents, clauses.

**Request Body:**
```json
{
  "contract_name": "Microsoft Enterprise Agreement 2026",
  "contract_number": "CON-2026-001",
  "vendor_id": 5,
  "contact_person_id": 12,
  "contract_type_id": 2,
  "currency": "USD",
  "start_date": "2026-01-01",
  "end_date": "2028-12-31",
  "renewal_date": "2028-09-30",
  "payment_terms": "Net 60",
  "notes": "Enterprise-wide subscription agreement",
  "notification_enabled": true,
  "notification_email": "alice@company.com",
  "notification_mobile": false,
  "total_contract_value": "1250000.00",
  "line_items": [
    {
      "product_id": 10,
      "quantity": 500,
      "rate": "36.00",
      "discount_percent": "10.00",
      "tax_percent": "0.00",
      "remarks": "Annual per-user license"
    }
  ],
  "documents": [],
  "clauses": []
}
```

**Validation Rules:**

| Field | Rule |
|---|---|
| `contract_name` | Required, 1-200 chars |
| `vendor_id` | Required, must reference existing vendor |
| `start_date` | Required |
| `end_date` | Required, must be after start_date |
| `renewal_date` | Required, must be before end_date |
| `contract_number` | Optional, unique if provided |
| `line_items[].product_id` | Required if line_items present, must reference existing product |
| `line_items[].quantity` | Required, must be > 0 |
| `line_items[].rate` | Required, must be >= 0 |

**Response `201 Created`:**
```json
{
  "data": {
    "id": 2,
    "contract_name": "Microsoft Enterprise Agreement 2026",
    "status": "DRAFT",
    "created_at": "2026-07-20T10:00:00Z",
    "contract_number": "CON-2026-001",
    "total_contract_value": "1250000.00",
    "allowed_actions": ["edit", "activate", "delete"]
  }
}
```

**Events emitted:** `contract.drafted` (async, after response)

**Access Control:** Requires `contracts:create`.

**Error Responses:**
| Code | Condition |
|---|---|
| 422 | Validation failure (missing field, invalid date range, duplicate contract_number) |
| 404 | vendor_id, contact_person_id, contract_type_id, or product_id not found |

---

### 4. Update Contract

**`PUT /api/contracts/{contract_id}`**

Updates contract fields and child entities. Only certain fields can be changed in certain statuses.

**Path parameters:**
| Param | Type | Description |
|---|---|---|
| `contract_id` | integer | Contract ID |

**Request Body:**
```json
{
  "contract_name": "Microsoft Enterprise Agreement 2026 (Amended)",
  "notes": "Updated terms",
  "line_items": [
    {
      "id": 1,
      "quantity": 600
    }
  ],
  "clauses": [
    {
      "clause_type": "data_protection",
      "title": "Data Processing Addendum",
      "content": "The parties agree to..."
    }
  ]
}
```

**Field mutability by status:**

| Field | DRAFT | ACTIVE | EXPIRED | TERMINATED | INCONSISTENT | ARCHIVED |
|---|---|---|---|---|---|---|
| `contract_name` | yes | no | no | no | yes | no |
| `notes` | yes | yes | no | no | yes | no |
| `end_date` | yes | yes* | no | no | yes | no |
| `renewal_date` | yes | yes* | no | no | yes | no |
| `line_items` | yes | yes* | no | no | yes | no |
| `clauses` | yes | yes* | no | no | yes | no |
| `notification_enabled` | yes | yes | yes | yes | yes | no |

*Changing active contract fields requires an amendment, not a direct edit.

**Amendment handling for ACTIVE contracts:**
When any restricted field is edited on an ACTIVE contract:
- The current contract state is snapshotted to version history
- The new values are applied as a new version
- A `contract.amended` event is emitted

**Response `200 OK`:**
```json
{
  "data": {
    "id": 2,
    "contract_name": "Microsoft Enterprise Agreement 2026 (Amended)",
    "status": "ACTIVE",
    "contract_version": 2,
    "updated_at": "2026-07-20T11:00:00Z",
    "allowed_actions": ["edit", "terminate"]
  }
}
```

**Events emitted:** `contract.updated` or `contract.amended` (depending on status)

**Access Control:** Requires `contracts:update`.

**Error Responses:**
| Code | Condition |
|---|---|
| 404 | Contract not found |
| 422 | Field not mutable in current status |
| 403 | Insufficient permissions |

---

### 5. Soft Delete Contract

**`DELETE /api/contracts/{contract_id}`**

Marks the contract as deleted (soft delete). Only allowed in DRAFT or EXPIRED status.

**Path parameters:**
| Param | Type | Description |
|---|---|---|
| `contract_id` | integer | Contract ID |

**Query parameters:**
| Param | Type | Default | Description |
|---|---|---|---|
| `reason` | string | — | Required reason for deletion |

**Response `200 OK`:**
```json
{
  "data": {
    "id": 2,
    "status": "DRAFT",
    "is_deleted": true,
    "deleted_at": "2026-07-20T12:00:00Z",
    "deleted_by": { "id": 3, "name": "Alice Chen" },
    "deletion_reason": "Duplicate contract entry"
  }
}
```

**Events emitted:** `contract.deleted`

**Access Control:** Requires `contracts:delete`.

**Error Responses:**
| Code | Condition |
|---|---|
| 404 | Contract not found |
| 409 | Cannot delete in current status (only DRAFT or EXPIRED) |
| 422 | Missing reason |

---

### 6. Activate Contract

**`POST /api/contracts/{contract_id}/activate`**

Transitions contract from DRAFT to ACTIVE. Validates that all required fields and documents are present.

**Path parameters:**
| Param | Type | Description |
|---|---|---|
| `contract_id` | integer | Contract ID |

**Request Body:**
```json
{
  "activated_by": 3,
  "notes": "Contract activated after legal review"
}
```

**Pre-conditions:**
- Status must be DRAFT
- All required documents uploaded (per contract type config)
- At least one line item exists
- `total_contract_value` > 0
- `end_date` is in the future
- User has `contracts:activate` permission

**Response `200 OK`:**
```json
{
  "data": {
    "id": 1,
    "status": "ACTIVE",
    "health": "Healthy",
    "activated_at": "2026-07-20T13:00:00Z",
    "activated_by": { "id": 3, "name": "Alice Chen" },
    "allowed_actions": ["edit", "terminate", "upload_document", "add_line_item"]
  }
}
```

**Events emitted:** `contract.activated`

**Error Responses:**
| Code | Condition |
|---|---|
| 409 | Invalid transition (not in DRAFT) |
| 422 | Pre-conditions not met (missing line items, end_date in past, etc.) |

---

### 7. Terminate Contract

**`POST /api/contracts/{contract_id}/terminate`**

Transitions contract from ACTIVE to TERMINATED.

**Path parameters:**
| Param | Type | Description |
|---|---|---|
| `contract_id` | integer | Contract ID |

**Request Body:**
```json
{
  "termination_reason": "vendor_breach",
  "termination_date": "2026-07-20",
  "notes": "Terminated due to material breach of SLA",
  "effective_immediately": true
}
```

**Valid `termination_reason` values:**
`mutual_agreement`, `vendor_breach`, `customer_breach`, `convenience`, `non_performance`, `bankruptcy`, `regulatory`, `other`

**Pre-conditions:**
- Status must be ACTIVE
- User has `contracts:terminate` permission
- No active renewals in progress (warning only, not blocking)

**Response `200 OK`:**
```json
{
  "data": {
    "id": 1,
    "status": "TERMINATED",
    "terminated_at": "2026-07-20T14:00:00Z",
    "terminated_by": { "id": 3, "name": "Alice Chen" },
    "termination_reason": "vendor_breach",
    "allowed_actions": ["archive", "view"]
  }
}
```

**Events emitted:** `contract.terminated`

**Error Responses:**
| Code | Condition |
|---|---|
| 409 | Invalid transition (not in ACTIVE) |
| 422 | Missing termination_reason |

---

### 8. Archive Contract

**`POST /api/contracts/{contract_id}/archive`**

Transitions contract from EXPIRED or TERMINATED to ARCHIVED.

**Path parameters:**
| Param | Type | Description |
|---|---|---|
| `contract_id` | integer | Contract ID |

**Request Body:**
```json
{
  "archived_by": 3,
  "retention_until": "2031-07-20",
  "notes": "Standard 5-year retention"
}
```

**Pre-conditions:**
- Status must be EXPIRED or TERMINATED
- User has `contracts:archive` permission

**Response `200 OK`:**
```json
{
  "data": {
    "id": 1,
    "status": "ARCHIVED",
    "archived_at": "2026-07-20T15:00:00Z",
    "archived_by": { "id": 3, "name": "Alice Chen" },
    "retention_until": "2031-07-20",
    "allowed_actions": ["view"]
  }
}
```

**Events emitted:** `contract.archived`

**Error Responses:**
| Code | Condition |
|---|---|
| 409 | Invalid transition (not in EXPIRED or TERMINATED) |

---

### 9. Mark Inconsistent / Resolve

**`POST /api/contracts/{contract_id}/mark-inconsistent`**

Marks a contract as INCONSISTENT (error state) when data integrity issues are detected.

**`POST /api/contracts/{contract_id}/resolve`**

Resolves an INCONSISTENT contract back to its previous valid state.

**Request Body (mark-inconsistent):**
```json
{
  "reason": "Data integrity violation: end_date before start_date",
  "detected_by": "system",
  "inconsistent_fields": ["end_date", "start_date"]
}
```

**Request Body (resolve):**
```json
{
  "resolved_by": 3,
  "corrections": {
    "end_date": "2028-12-31",
    "start_date": "2026-01-01"
  }
}
```

**Events emitted:** `contract.marked_inconsistent`, `contract.resolved`

**Access Control:** Requires `contracts:admin`.

---

### 10. List Line Items

**`GET /api/contracts/{contract_id}/line-items`**

Returns all line items for a contract, including soft-deleted if `include_deleted=true`.

**Response `200 OK`:**
```json
{
  "data": [
    {
      "id": 1,
      "product_snapshot": {
        "product_id": 10,
        "sku": "EA-O365-E3",
        "product_name": "Microsoft 365 E3",
        "rate": "36.00",
        "currency": "USD"
      },
      "quantity": 500,
      "discount_percent": "10.00",
      "tax_percent": "0.00",
      "unit_price": "32.40",
      "line_total": "194400.00",
      "remarks": "Annual per-user license",
      "is_deleted": false,
      "created_at": "2026-01-01T09:00:00Z",
      "updated_at": "2026-01-01T09:00:00Z"
    }
  ]
}
```

### 11. Create Line Item

**`POST /api/contracts/{contract_id}/line-items`**

**Request Body:**
```json
{
  "product_id": 11,
  "quantity": 100,
  "rate": "12.00",
  "discount_percent": "0.00",
  "tax_percent": "18.00",
  "remarks": "Additional licenses"
}
```

**Response `201 Created`** — returns created line item.

**Validation:**
- `product_id` must reference existing product
- `quantity` > 0
- `rate` >= 0
- Contract must be in DRAFT or ACTIVE status

**Events emitted:** `contract.line_item_added`

### 12. Update Line Item

**`PUT /api/contracts/{contract_id}/line-items/{line_item_id}`**

Updates a line item. For ACTIVE contracts, creates a product_snapshot archival entry.

**Events emitted:** `contract.line_item_updated`

### 13. Delete Line Item (Soft)

**`DELETE /api/contracts/{contract_id}/line-items/{line_item_id}`**

Soft-deletes a line item. Warning if the line item has renewal history.

**Events emitted:** `contract.line_item_removed`

---

### 14. List Documents

**`GET /api/contracts/{contract_id}/documents`**

Returns all documents. Filterable by `category`.

### 15. Upload Document

**`POST /api/contracts/{contract_id}/documents`**

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | file | yes | The document file (max 50MB) |
| `category` | string | yes | `signed_agreement`, `sow`, `amendment`, `quote`, `legal`, `other` |
| `title` | string | no | Display title (defaults to filename) |

**Response `201 Created`** — returns created document metadata.

**Events emitted:** `contract.document_added`

### 16. Get Document

**`GET /api/contracts/{contract_id}/documents/{document_id}`**

Returns document metadata. For downloading, use the `download_url` field.

**Response includes:** `download_url` (expiring presigned URL for storage provider).

### 17. Replace Document (Versioning)

**`POST /api/contracts/{contract_id}/documents/{document_id}/replace`**

**Content-Type:** `multipart/form-data`

Uploads a new version of an existing document. Previous version is retained with `is_latest_version: false`.

**Events emitted:** `contract.document_updated`

### 18. Delete Document (Soft)

**`DELETE /api/contracts/{contract_id}/documents/{document_id}`**

Soft-deletes a document.

**Events emitted:** `contract.document_removed`

---

### 19. List Clauses

**`GET /api/contracts/{contract_id}/clauses`**

Returns all clauses for a contract. Filterable by `clause_type`.

### 20. Create Clause

**`POST /api/contracts/{contract_id}/clauses`**

**Request Body:**
```json
{
  "clause_type": "termination",
  "title": "Termination for Convenience",
  "content": "Either party may terminate this agreement upon 90 days written notice."
}
```

**Valid `clause_type` values:**
`termination`, `renewal`, `payment`, `confidentiality`, `data_protection`, `liability`, `governing_law`, `sla`, `scope`, `general`

**Events emitted:** `contract.clause_added`

### 21. Update Clause

**`PUT /api/contracts/{contract_id}/clauses/{clause_id}`**

Updates clause content. Increments clause version.

**Events emitted:** `contract.clause_updated`

### 22. Delete Clause (Soft)

**`DELETE /api/contracts/{contract_id}/clauses/{clause_id}`**

**Events emitted:** `contract.clause_removed`

---

### 23. Get Timeline

**`GET /api/contracts/{contract_id}/timeline`**

Returns paginated version history and domain events for the contract.

**Query parameters:** standard pagination.
| Param | Type | Description |
|---|---|---|
| `event_types` | string | Comma-separated filter: `contract.activated`, `contract.updated`, etc. |
| `date_from` | datetime | Start of date range |
| `date_to` | datetime | End of date range |

**Response:**
```json
{
  "data": [
    {
      "event_type": "contract.activated",
      "event_id": 42,
      "performed_by": { "id": 3, "name": "Alice Chen" },
      "timestamp": "2026-01-01T09:00:00Z",
      "description": "Contract activated",
      "version": 1,
      "metadata": {
        "previous_status": "DRAFT",
        "new_status": "ACTIVE"
      },
      "changes": [
        { "field": "status", "old_value": "DRAFT", "new_value": "ACTIVE" }
      ]
    }
  ],
  "pagination": { "page": 1, "per_page": 20, "total": 15, "total_pages": 1 }
}
```

---

### 24. Get Health Status

**`GET /api/contracts/{contract_id}/health`**

Returns computed health status. Only meaningful for ACTIVE contracts.

**Response `200 OK`:**
```json
{
  "data": {
    "status": "Healthy",
    "days_until_end": 894,
    "days_until_renewal": 802,
    "renewal_window_open": false,
    "last_assessment": "2026-07-20T00:00:00Z",
    "next_reminder_date": "2028-09-01",
    "reminder_days": [30, 14, 7, 3, 1, 0],
    "notification_status": {
      "email": "configured",
      "mobile": "disabled"
    }
  }
}
```

**Health values:** `Healthy`, `Attention` (≤90 days to end), `Warning` (≤30 days), `Critical` (≤7 days), `Expired` (past end_date).

---

### 25. Get Financial Summary

**`GET /api/contracts/{contract_id}/financial-summary`**

Returns financial data. Requires `finance:read` permission.

**Response `200 OK`:**
```json
{
  "data": {
    "total_contract_value": "1250000.00",
    "spend_to_date": "388800.00",
    "remaining_value": "861200.00",
    "currency": "USD",
    "billing_frequency": "annual",
    "payment_terms": "Net 60",
    "related_pos": [
      { "id": 3, "po_number": "PO-2026-001", "amount": "388800.00", "status": "issued", "renewal_id": 1 }
    ],
    "related_invoices": [
      { "id": 5, "invoice_number": "INV-2026-001", "amount": "388800.00", "status": "paid", "renewal_id": 1 }
    ]
  }
}
```

---

### 26. Get Dashboard

**`GET /api/contracts/dashboard`**

Returns aggregated dashboard data. Existing endpoint retained with expansion.

**Response:** Status counts, upcoming renewals, expiring contracts, recent activity, health distribution.

---

## Permission Matrix

| Endpoint | Permission Required |
|---|---|
| `GET /api/contracts` | `contracts:read` |
| `GET /api/contracts/{id}` | `contracts:read` |
| `POST /api/contracts` | `contracts:create` |
| `PUT /api/contracts/{id}` | `contracts:update` |
| `DELETE /api/contracts/{id}` | `contracts:delete` |
| `POST /api/contracts/{id}/activate` | `contracts:activate` |
| `POST /api/contracts/{id}/terminate` | `contracts:terminate` |
| `POST /api/contracts/{id}/archive` | `contracts:archive` |
| `POST /api/contracts/{id}/mark-inconsistent` | `contracts:admin` |
| `POST /api/contracts/{id}/resolve` | `contracts:admin` |
| Child entity CRUD | `contracts:update` (same as parent) |
| `GET /api/contracts/{id}/financial-summary` | `contracts:read` + `finance:read` |
| `GET /api/contracts/dashboard` | `contracts:read` |

---

## Events Referenced

This API spec references the following domain events (fully specified in the Event Catalog):

| Event | Trigger | Published By |
|---|---|---|
| `contract.drafted` | POST /api/contracts | Contract AR |
| `contract.updated` | PUT /api/contracts/{id} | Contract AR |
| `contract.amended` | PUT /api/contracts/{id} (ACTIVE) | Contract AR |
| `contract.activated` | POST .../activate | Contract AR |
| `contract.terminated` | POST .../terminate | Contract AR |
| `contract.archived` | POST .../archive | Contract AR |
| `contract.marked_inconsistent` | POST .../mark-inconsistent | Contract AR |
| `contract.resolved` | POST .../resolve | Contract AR |
| `contract.deleted` | DELETE /api/contracts/{id} | Contract AR |
| `contract.line_item_added` | POST .../line-items | Contract AR |
| `contract.line_item_updated` | PUT .../line-items/{id} | Contract AR |
| `contract.line_item_removed` | DELETE .../line-items/{id} | Contract AR |
| `contract.document_added` | POST .../documents | Contract AR |
| `contract.document_updated` | POST .../documents/{id}/replace | Contract AR |
| `contract.document_removed` | DELETE .../documents/{id} | Contract AR |
| `contract.clause_added` | POST .../clauses | Contract AR |
| `contract.clause_updated` | PUT .../clauses/{id} | Contract AR |
| `contract.clause_removed` | DELETE .../clauses/{id} | Contract AR |

---

## Rate Limiting

| Endpoint Group | Limit | Window |
|---|---|---|
| List / Read endpoints | 100 requests/min | Per user |
| Write endpoints (POST, PUT, DELETE) | 30 requests/min | Per user |
| Dashboard | 10 requests/min | Per user |
| Upload endpoints | 10 requests/min | Per user |
