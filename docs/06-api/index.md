# API Design

## API Design Principles

### 1. RESTful Resource Orientation
Resources map to domain entities. URLs represent entities, not actions. Actions are represented by HTTP methods and state transitions.

### 2. State Transitions via Endpoints
State transitions are explicit endpoints (e.g., `POST /renewals/:id/submit-for-approval`), not generic PATCH updates. This makes the workflow explicit in the API surface.

### 3. Consistent Error Responses
Every error returns a consistent structure: `{ error: string, details?: any, code?: string }`. HTTP status codes follow RFC 7231 semantics.

### 4. Pagination, Filtering, Sorting
All list endpoints support cursor-based pagination, field-level filtering, and multi-field sorting with direction.

### 5. Idempotency Where Required
State-changing endpoints support idempotency keys to prevent duplicate processing on retry.

### 6. Versioned from Day One
API is versioned via URL prefix (`/api/v1/`). Breaking changes create a new version. Deprecated versions maintained for minimum 6 months.

### 7. Activity Logging at the API Layer
Every state-changing request is logged to the activity log automatically via middleware. No endpoint needs to manually write audit entries.

## Endpoint Map

### Core Domain — Renewals

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/renewals | List renewals (paginated, filterable) |
| GET | /api/v1/renewals/:id | Get renewal detail |
| PATCH | /api/v1/renewals/:id | Update renewal fields |
| POST | /api/v1/renewals/:id/assign | Assign to procurement specialist |
| POST | /api/v1/renewals/:id/quote-received | Record vendor quote received |
| POST | /api/v1/renewals/:id/budget-check | Trigger budget validation |
| POST | /api/v1/renewals/:id/submit-for-approval | Submit to approval chain |
| POST | /api/v1/renewals/:id/approve | Approve (role-dependent context) |
| POST | /api/v1/renewals/:id/reject | Reject with reason |
| POST | /api/v1/renewals/:id/cancel | Cancel renewal |
| POST | /api/v1/renewals/:id/hold | Place on hold |
| POST | /api/v1/renewals/:id/escalate | Escalate to next level |
| POST | /api/v1/renewals/:id/usage-attestation | Submit usage attestation |
| GET | /api/v1/renewals/:id/activity | Get renewal activity log |
| GET | /api/v1/renewals/:id/timeline | Get state machine timeline |

### Contracts

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/contracts | List contracts |
| GET | /api/v1/contracts/:id | Get contract detail with line items |
| POST | /api/v1/contracts | Create contract (manual or from CLM integration) |
| PUT | /api/v1/contracts/:id | Update contract |
| DELETE | /api/v1/contracts/:id | Delete contract (soft, with referential checks) |
| GET | /api/v1/contracts/:id/renewals | Renewal history for this contract |

### Products

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/products | List products |
| GET | /api/v1/products/:id | Get product detail |
| POST | /api/v1/products | Create product (SKU auto-generated) |
| PUT | /api/v1/products/:id | Update product |
| DELETE | /api/v1/products/:id | Delete (soft-deactivate if referenced) |

### Vendors

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/vendors | List vendors |
| GET | /api/v1/vendors/:id | Get vendor with contacts |
| POST | /api/v1/vendors | Create vendor |
| PUT | /api/v1/vendors/:id | Update vendor |
| DELETE | /api/v1/vendors/:id | Delete (with referential checks) |
| GET | /api/v1/vendors/:id/contracts | Contracts for this vendor |
| GET | /api/v1/vendors/:id/renewals | Renewals for this vendor |

### Purchase Orders

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/purchase-orders | List POs |
| GET | /api/v1/purchase-orders/:id | Get PO detail |
| POST | /api/v1/purchase-orders | Create PO from renewal |
| PUT | /api/v1/purchase-orders/:id | Update PO |
| POST | /api/v1/purchase-orders/:id/send | Send PO to vendor |
| POST | /api/v1/purchase-orders/:id/acknowledge | Record vendor acknowledgment |
| POST | /api/v1/purchase-orders/:id/reject | Record vendor rejection |
| POST | /api/v1/purchase-orders/:id/cancel | Cancel PO |

### Invoices

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/invoices | List invoices |
| GET | /api/v1/invoices/:id | Get invoice with matching detail |
| POST | /api/v1/invoices | Record invoice received |
| POST | /api/v1/invoices/:id/match | Trigger matching against PO |
| POST | /api/v1/invoices/:id/approve-exception | Approve variance with reason |
| POST | /api/v1/invoices/:id/schedule-payment | Schedule for payment |
| POST | /api/v1/invoices/:id/record-payment | Record payment complete |

### Approvals

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/approvals | List approvals (pending, historical) |
| GET | /api/v1/approvals/:id | Get approval detail |
| POST | /api/v1/approvals/:id/approve | Approve |
| POST | /api/v1/approvals/:id/reject | Reject with reason |
| POST | /api/v1/approvals/:id/cancel | Cancel approval request |

### Dashboard & Reports

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/dashboard/renewals-pipeline | Pipeline counts by status and date range |
| GET | /api/v1/dashboard/sla-compliance | SLA metrics by stage and team |
| GET | /api/v1/dashboard/financial-summary | Forecast vs. actual, pending PO value |
| GET | /api/v1/dashboard/assignee-workload | Workload per team member |
| GET | /api/v1/reports/renewal-forecast | Detailed forecast report |
| GET | /api/v1/reports/vendor-performance | Vendor scorecard data |
| GET | /api/v1/reports/audit-export | Full audit export for compliance |

### Notifications

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/notifications | List notifications for current user |
| PATCH | /api/v1/notifications/:id/read | Mark as read |
| POST | /api/v1/notifications/mark-all-read | Mark all as read |
| GET | /api/v1/notifications/unread-count | Unread count |

### Administration

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/admin/users | List users |
| POST | /api/v1/admin/users | Create user |
| PUT | /api/v1/admin/users/:id | Update user |
| DELETE | /api/v1/admin/users/:id | Deactivate user |
| GET | /api/v1/admin/roles | List roles with permissions |
| PUT | /api/v1/admin/roles/:id | Update role permissions |
| GET | /api/v1/admin/policy-rules | List policy rules |
| POST | /api/v1/admin/policy-rules | Create policy rule |
| PUT | /api/v1/admin/policy-rules/:id | Update policy rule |
| DELETE | /api/v1/admin/policy-rules/:id | Delete policy rule |
| GET | /api/v1/admin/integrations | List integrations and status |
| PUT | /api/v1/admin/integrations/:id | Update integration configuration |
| GET | /api/v1/admin/health | Platform health status |

### Activity Log

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/activity | List activity log (filterable by entity, action, user, date range) |
| GET | /api/v1/activity/:id | Get activity detail |

## Standard Response Formats

### Success
```json
{
  "id": "uuid",
  "name": "string",
  "status": "enum_value",
  "...": "..."
}
```

### List (paginated)
```json
{
  "data": [ ... ],
  "pagination": {
    "cursor": "string",
    "has_more": true,
    "total": 100
  }
}
```

### Error
```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### State Transition Response
```json
{
  "success": true,
  "new_status": "approved",
  "transition": {
    "from": "pending_approval",
    "to": "approved",
    "performed_by": "user_id",
    "performed_at": "2026-07-20T12:00:00Z"
  }
}
```

## Webhook Integration Pattern

Muraai emits webhooks for external systems to consume. Webhooks are sent for all domain events.

### Webhook Format
```json
{
  "event": "renewal.approved",
  "timestamp": "2026-07-20T12:00:00Z",
  "data": {
    "renewal_id": "uuid",
    "contract_id": "uuid",
    "vendor_id": "uuid",
    "approved_amount": 50000.00,
    "approved_by": "user_id",
    "po_ready": true
  }
}
```

### Webhook Security
- HMAC-SHA256 signature in header for payload verification
- Configurable retry policy (3 retries, exponential backoff)
- Dead letter queue after max retries
- Webhook delivery status visible in admin dashboard

## Integration Patterns

| Integration Type | Protocol | Purpose |
|---|---|---|
| **ERP Sync** | REST (bidirectional webhooks) | Sync POs, invoices, budget codes, GL mappings |
| **CLM Integration** | REST (inbound) | Import contracts, amendments, clauses |
| **SAM Integration** | REST (inbound) | Import usage data for attestation |
| **SSO** | SAML 2.0 / OIDC | Enterprise authentication |
| **Email** | SMTP / REST API | Notifications, PO delivery, vendor communication |
| **Document Storage** | S3-compatible API | Contract PDFs, invoices, POs |

## API Security

- All endpoints require authentication (JWT bearer token or session cookie)
- Authorization is role-based with resource-level scoping
- Idempotency keys required for state-changing POST endpoints
- Rate limiting per user (configurable: default 1000 req/hr)
- Request logging for audit trail
