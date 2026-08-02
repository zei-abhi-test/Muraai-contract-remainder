# System Architecture

## Document Control

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-07-20 | Principal Architect | Complete system architecture specification |

---

## 0. Architecture Philosophy

### Design Tenets

1. **Every component has a single responsibility.** If a service does two unrelated things, it is two services.
2. **Communication is asynchronous by default, synchronous by explicit choice.** State changes emit events. APIs are for user requests, not service-to-service calls.
3. **The state machine is the source of truth.** No service bypasses state machine validation. Every state change goes through the Renewal Engine.
4. **External integrations are isolated behind adapters.** Switching from Resend to SendGrid, or from S3 to OneDrive, is a configuration change, not a rewrite.
5. **The scheduler drives time-based logic.** SLA monitoring, renewal identification, escalation — all time-based triggers live in the scheduler, not in cron jobs scattered across services.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT LAYER                                      │
│                  Web App (React) · Mobile (future) · API Consumers           │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ HTTPS / WebSocket
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API GATEWAY                                       │
│               Authentication · Rate Limiting · Routing · Versioning          │
└────────┬────────────────────────┬────────────────────────┬───────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌──────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│   SYNC API       │  │   ASYNC EVENTS       │  │   WEBSOCKET          │
│  (REST request)  │  │  (Event Bus emit)    │  │  (real-time push)    │
└────────┬─────────┘  └──────────┬───────────┘  └──────────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          APPLICATION SERVICES                                 │
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │  Renewal     │ │   Contract   │ │  Procurement │ │  Financial   │      │
│  │  Service     │ │   Service    │ │  Service     │ │  Service     │      │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘      │
│         │                │                │                │               │
│  ┌──────┴───────┐ ┌──────┴───────┐ ┌──────┴───────┐ ┌──────┴───────┐      │
│  │   Approval   │ │   Vendor     │ │   Policy     │ │   Budget     │      │
│  │   Service    │ │   Service    │ │   Engine     │ │   Service    │      │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │ Notification │ │   Document   │ │   Task       │ │   Import     │      │
│  │  Engine      │ │   Service    │ │   Service    │ │   Service    │      │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INFRASTRUCTURE SERVICES                            │
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │   Event Bus  │ │  Scheduler   │ │  Email       │ │  File        │      │
│  │   (Redis)    │ │  (APS)       │ │  Service     │ │  Storage     │      │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
|                            DATA LAYER                                        |
|                                                                              |
|  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                        |
|  │  PostgreSQL  │ │    Redis     │ │  File Store  │                        |
|  │  (primary)   │ │  (cache/queue)│ │  (S3/OneDr) │                        |
|  └──────────────┘ └──────────────┘ └──────────────┘                        |
|                                                                              |
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Services

### 1.1 Service Architecture Pattern

All services follow the same internal structure:

```
Service Layer
├── routes/          → HTTP handlers (thin — delegate to service)
├── services/        → Business logic (domain services)
├── models/          → SQLAlchemy ORM models (data access)
├── schemas/         → Pydantic request/response schemas
├── state_machines/  → State machine definitions and transition guards
├── integration/     → External system adapters
├── events/          → Event producers and consumers
└── tasks/           → Scheduled task definitions
```

Dependency rule: routes → services → models. Services never import routes. Models never import services.

### 1.2 Service Catalog

| Service | Responsibility | Owns | Depends On |
|---|---|---|---|
| **RenewalService** | Renewal CRUD, state machine transitions, timeline recording | Renewal aggregate | ContractService, VendorService, BudgetService |
| **ContractService** | Contract CRUD, line item management, renewal identification | Contract aggregate | VendorService, ProductService |
| **ProcurementService** | PO creation, sending, acknowledgment, line item management | PurchaseOrder aggregate | RenewalService, VendorService, DocumentService |
| **FinancialService** | Invoice recording, PO matching, exception handling, payment | Invoice aggregate | ProcurementService, RenewalService |
| **ApprovalService** | Approval chain management, SLA monitoring, escalation | ApprovalRecord | RenewalService, PolicyEngine |
| **VendorService** | Vendor CRUD, contacts, scorecard computation | Vendor aggregate | — |
| **ProductService** | Product CRUD, SKU generation | Product aggregate | — |
| **PolicyEngine** | Policy rule evaluation, approval chain determination | PolicyRule | — |
| **BudgetService** | Budget validation (ERP integration or manual) | (no entities) | PolicyEngine |
| **DocumentService** | File upload/download, virus scan coordination, storage abstraction | ContractDocument | — |
| **NotificationEngine** | Event-to-notification routing, delivery dispatch | Notification | UserService |
| **TaskService** | Task CRUD, auto-creation from events, SLA linkage | Task | UserService, RenewalService |
| **UserService** | User CRUD, authentication, role/permission management | User | — |
| **ActivityService** | Activity log writing and querying | ActivityLogEntry | (all services call it) |
| **ImportService** | Bulk import of contracts, vendors, products from external systems | — | ContractService, VendorService, ProductService |

### 1.3 Service Interaction Pattern

Services interact through three mechanisms:

| Mechanism | When | How |
|---|---|---|
| **Direct method call** | Same-process, synchronous, required | Service A imports Service B and calls a method. Used for cross-service validation (e.g., RenewalService calls ContractService to verify contract exists). |
| **Event subscription** | Cross-process, asynchronous, eventual consistency | Service A emits event. Service B subscribes and reacts. Used for workflows (e.g., ApprovalService emits business_approved, ProcurementService picks it up to create PO draft). |
| **API call** | Cross-service, synchronous, remote | Only for services running as separate processes. Avoided within the same process. |

### 1.4 Stateless Design

All services are stateless. State lives in the database. This means:
- Any instance of a service can handle any request.
- Horizontal scaling is additive — no session affinity, no sticky sessions.
- Service restarts lose no state.

### 1.5 Transaction Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    TRANSACTION BOUNDARIES                     │
│                                                              │
│  Renewal transition:                                         │
│  ┌─────┐     ┌───────────────┐     ┌──────────────────┐     │
│  │ API │────►│ RenewalService│────►│  DB (PostgreSQL) │     │
│  │     │     │ 1. Validate   │     │  UPDATE renewal  │     │
│  │     │     │ 2. Transition │     │  INSERT timeline │     │
│  │     │     │ 3. Log audit  │     │  INSERT activity │     │
│  │     │     │ 4. Emit event │     └──────────────────┘     │
│  │     │     └───────┬───────┘                               │
│  │     │             │ event                                 │
│  │     │             ▼                                       │
│  │     │     ┌──────────────────┐                            │
│  │     │     │   Event Bus      │                            │
│  │     │     │  (async, outside │                            │
│  │     │     │   transaction)   │                            │
│  │     │     └──────────────────┘                            │
│  │     │        │                                            │
│  │     │        ▼                                            │
│  │     │     ┌──────────────────┐     ┌──────────────────┐   │
│  │     │     │ NotificationEng │────►│  DB (PostgreSQL) │   │
│  │     │     │ (separate trans) │     │  INSERT notif.   │   │
│  │     │     └──────────────────┘     └──────────────────┘   │
│  └─────┘                                                     │
│                                                              │
│  Key rule: Event emission happens AFTER the transaction       │
│  commits. If the transaction fails, no event is emitted.      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. APIs

### 2.1 API Gateway

The API Gateway is the single entry point for all client requests. It handles:

| Concern | Implementation |
|---|---|
| **Authentication** | JWT bearer token validation. Token contains user_id, role, session_id. |
| **Rate Limiting** | Per-user sliding window. Default: 1000 req/hr. Burst: 50 req/min. Dashboard endpoints: 500 req/hr. |
| **Request Logging** | Every request logged with: method, path, status, duration, user_id, ip. |
| **Response Compression** | gzip/brotli for responses >1KB. |
| **CORS** | Whitelist-based. Only configured origins allowed. |
| **Versioning** | URL prefix: `/api/v1/`. Headers not used for versioning. |

### 2.2 API Conventions

| Convention | Rule |
|---|---|
| **Base URL** | `/api/v1/` |
| **Naming** | kebab-case plural: `/purchase-orders`, `/policy-rules` |
| **IDs** | UUIDs in path: `/renewals/{id}` |
| **List params** | Cursor-based: `?cursor=uuid&limit=20`. Sort: `?sort=-created_at` (DESC) or `?sort=name` (ASC). Filter: `?status=pending&vendor_id=uuid` |
| **State transitions** | `POST /renewals/{id}/action-name`. Body contains transition-specific fields. |
| **Idempotency** | Header `Idempotency-Key: uuid`. Key cached for 24h. Duplicate requests within that window return the original response. |
| **Response envelope** | Single resource: top-level JSON object. List: `{ data: [...], pagination: {...} }`. Error: `{ error, code, details }`. |
| **HTTP status codes** | 200 OK, 201 Created, 204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict (invalid transition), 422 Unprocessable (validation), 429 Too Many Requests, 500 Internal Error. |

### 2.3 Full Endpoint Map

#### Renewals (`/api/v1/renewals`)

| Method | Path | Description | Permissions |
|---|---|---|---|
| GET | / | List renewals | All authenticated |
| GET | /:id | Get renewal detail | All authenticated |
| PATCH | /:id | Update renewal fields (notes, tags, priority) | S1, S2 |
| POST | /:id/assign | Assign to procurement specialist | S1 |
| POST | /:id/record-quote | Record vendor quote | S2 |
| POST | /:id/budget-check | Trigger budget validation | S2, System |
| POST | /:id/budget-override | Approve budget override | S8 |
| POST | /:id/submit-legal | Submit for legal review | System (auto) |
| POST | /:id/approve-legal | Legal approve terms | S4 |
| POST | /:id/reject-legal | Legal reject terms | S4 |
| POST | /:id/usage-attestation | Submit usage attestation | S5 |
| POST | /:id/approve-business | Business owner approve | S5 |
| POST | /:id/reject-business | Business owner reject | S5 |
| POST | /:id/hold | Place on hold | S1 |
| POST | /:id/resume | Resume from hold | S1 |
| POST | /:id/escalate | Escalate to next level | S1, System |
| POST | /:id/resolve-escalation | Resolve escalation | S1, escalation target |
| POST | /:id/cancel | Cancel renewal | S1, S5, S7 |
| GET | /:id/timeline | Get timeline entries | All authenticated |
| GET | /:id/activity | Get activity log | All authenticated |

#### Contracts (`/api/v1/contracts`)

| Method | Path | Description | Permissions |
|---|---|---|---|
| GET | / | List contracts | All authenticated |
| GET | /:id | Get contract detail | All authenticated |
| POST | / | Create contract | S1, S2 |
| PUT | /:id | Update contract | S1, S2 |
| DELETE | /:id | Delete (draft only) | S1 |
| GET | /:id/line-items | List line items | All authenticated |
| POST | /:id/line-items | Add line item | S1, S2 |
| PUT | /:id/line-items/:li_id | Update line item | S1, S2 |
| DELETE | /:id/line-items/:li_id | Remove line item | S1, S2 |
| GET | /:id/documents | List documents | All authenticated |
| POST | /:id/documents | Upload document | S1, S2 |
| POST | /:id/renew | Manually trigger renewal | S1 |
| GET | /:id/renewals | List renewal history | All authenticated |
| POST | /:id/activate | Activate contract (DRAFT -> ACTIVE) | S1 |
| POST | /:id/terminate | Terminate contract | S1, S7 |
| POST | /:id/reactivate | Reactivate terminated/expired contract | S1 |

#### Products (`/api/v1/products`)

| Method | Path | Description | Permissions |
|---|---|---|---|
| GET | / | List products | All authenticated |
| GET | /:id | Get product detail | All authenticated |
| POST | / | Create product (SKU auto-generated) | S10 |
| PUT | /:id | Update product | S10 |
| DELETE | /:id | Soft-deactivate | S10 |

#### Vendors (`/api/v1/vendors`)

| Method | Path | Description | Permissions |
|---|---|---|---|
| GET | / | List vendors | All authenticated |
| GET | /:id | Get vendor with contacts | All authenticated |
| POST | / | Create vendor | S2, S6, S10 |
| PUT | /:id | Update vendor | S2, S6, S10 |
| DELETE | /:id | Soft-delete (if no contracts) | S10 |
| GET | /:id/contracts | Contracts for vendor | All authenticated |
| GET | /:id/renewals | Renewals for vendor | All authenticated |
| GET | /:id/scorecard | Get current scorecard | S6, S1 |
| POST | /:id/scorecard | Create/update scorecard | S6 |
| GET | /:id/contacts | List vendor contacts | All authenticated |
| POST | /:id/contacts | Add vendor contact | S2, S6 |

#### Purchase Orders (`/api/v1/purchase-orders`)

| Method | Path | Description | Permissions |
|---|---|---|---|
| GET | / | List POs | All authenticated |
| GET | /:id | Get PO detail | All authenticated |
| POST | / | Create PO from renewal | S2, System |
| PUT | /:id | Update PO (draft only) | S2 |
| POST | /:id/send | Send PO to vendor | S2 |
| POST | /:id/acknowledge | Record vendor acknowledgment | S2 |
| POST | /:id/reject | Record vendor rejection | S2 |
| POST | /:id/cancel | Cancel PO | S2 |
| POST | /:id/amend | Create amended version | S2 |

#### Invoices (`/api/v1/invoices`)

| Method | Path | Description | Permissions |
|---|---|---|---|
| GET | / | List invoices | All authenticated |
| GET | /:id | Get invoice detail | All authenticated |
| POST | / | Record invoice | S3, System |
| POST | /:id/match | Trigger auto-match | S3, System |
| POST | /:id/resolve-exception | Resolve exception | S3 |
| POST | /:id/schedule-payment | Schedule payment | S3 |
| POST | /:id/record-payment | Record payment completed | S3, System |
| POST | /:id/cancel | Cancel invoice | S3 |

#### Approvals (`/api/v1/approvals`)

| Method | Path | Description | Permissions |
|---|---|---|---|
| GET | / | List approvals (filterable) | All authenticated |
| GET | /:id | Get approval detail | All authenticated |
| POST | /:id/approve | Approve | S4, S5, S8 |
| POST | /:id/reject | Reject | S4, S5, S8 |
| POST | /:id/defer | Defer decision | Approver |
| POST | /:id/cancel | Cancel approval step | S1, System |
| POST | /:id/remind | Send reminder | S1 |

#### Tasks (`/api/v1/tasks`)

| Method | Path | Description | Permissions |
|---|---|---|---|
| GET | / | List tasks (filterable by assignee, status) | All authenticated |
| GET | /:id | Get task detail | All authenticated |
| POST | / | Create task | All authenticated |
| PATCH | /:id | Update task | Assignee, creator |
| POST | /:id/complete | Mark complete | Assignee |
| POST | /:id/reopen | Reopen task | Assignee, creator |

#### Dashboard (`/api/v1/dashboard`)

| Method | Path | Description | Permissions |
|---|---|---|---|
| GET | /mission-control | Full dashboard data (all widgets) | S1 |
| GET | /pipeline | Renewal pipeline with counts | S1 |
| GET | /sla-compliance | SLA metrics by stage | S1 |
| GET | /financial-summary | Pipeline value, forecast | S1, S3, S8 |
| GET | /assignee-workload | Workload per team member | S1 |
| GET | /risk-contracts | At-risk contracts | S1, S7, S8 |
| GET | /alerts | Active alerts | S1 |

#### Notifications (`/api/v1/notifications`)

| Method | Path | Description | Permissions |
|---|---|---|---|
| GET | / | List notifications | Current user |
| GET | /unread-count | Unread count | Current user |
| PATCH | /:id/read | Mark read | Current user |
| POST | /mark-all-read | Mark all read | Current user |
| PATCH | /:id/archive | Archive notification | Current user |

#### Administration (`/api/v1/admin`)

| Method | Path | Description | Permissions |
|---|---|---|---|
| GET | /users | List users | S10 |
| POST | /users | Create user | S10 |
| PUT | /users/:id | Update user | S10 |
| DELETE | /users/:id | Deactivate user | S10 |
| GET | /policy-rules | List rules | S10 |
| POST | /policy-rules | Create rule | S10 |
| PUT | /policy-rules/:id | Update rule | S10 |
| DELETE | /policy-rules/:id | Delete rule | S10 |
| GET | /integrations | List integration status | S10 |
| PUT | /integrations/:id | Update integration config | S10 |
| GET | /health | Platform health status | S10 |
| GET | /activity | Full activity log | S9, S10 |

#### Activity (`/api/v1/activity`)

| Method | Path | Description | Permissions |
|---|---|---|---|
| GET | / | List activity (filterable by entity, action, user, date) | S1, S9, S10 |
| GET | /:id | Get activity detail | S1, S9, S10 |

### 2.4 Webhooks

Muraai emits webhooks for external system consumption. Delivery is managed by the webhook dispatcher.

| Event | Subscribers | Payload |
|---|---|---|
| renewal.created | ERP, CLM | renewal_id, contract_id, end_date, value |
| renewal.approved | ERP | renewal_id, approved_amount, po_ready |
| renewal.cancelled | ERP, CLM | renewal_id, reason |
| po.sent | ERP | po_id, po_number, amount, vendor |
| po.acknowledged | ERP | po_id, po_number, acknowledged_at |
| po.rejected | ERP | po_id, reason |
| invoice.matched | ERP | invoice_id, po_id, matched_amount |
| invoice.exception | ERP | invoice_id, variance, reason |

---

## 3. Scheduler

### 3.1 Purpose

The Scheduler is the central time-based trigger system. It replaces scattered cron jobs, Celery beat tasks, and manual timed procedures with a single, auditable scheduling service.

### 3.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SCHEDULER (APScheduler)                           │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         JOB STORE (PostgreSQL)                        │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────────┐  │   │
│  │  │ Job ID      │ │ Function    │ │ Trigger     │ │ Next Run      │  │   │
│  │  │ uuid        │ │ path        │ │ cron/interval│ │ timestamp     │  │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └───────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                           JOB LIST                                     │   │
│  │                                                                        │   │
│  │  ├─ identify_renewals          Daily 02:00   │  │   │                  │   │
│  │  ├─ monitor_sla                Hourly         │  │   │                  │   │
│  │  ├─ check_escalations          Hourly         │  │   │                  │   │
│  │  ├─ detect_stalled_renewals    Daily 06:00   │  │   │                  │   │
│  │  ├─ sync_erp                   Every 30 min   │  │   │                  │   │
│  │  ├─ cleanup_temp_files         Daily 03:00   │  │   │                  │   │
│  │  ├─ send_digest_notifications  Daily 08:00   │  │   │                  │   │
│  │  ├─ compute_vendor_scorecards  Weekly Sun 04:00 │  │                   │   │
│  │  └─ refresh_materialized_views  Every 15 min  │  │   │                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     EXECUTOR (ThreadPoolExecutor)                      │   │
│  │  max_workers = 10. Jobs run in parallel. No job blocks another.       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Job Catalog

| Job | Schedule | Description | Idempotent |
|---|---|---|---|
| **identify_renewals** | Daily 02:00 | Scan contracts where end_date enters renewal window. Create Renewal entities. | Yes — checks (contract_id, year) uniqueness |
| **monitor_sla** | Every hour | Check ApprovalRecord sla_deadline. Mark breached. Trigger escalation if beyond SLA + grace. | Yes — checks last_checked_at |
| **check_escalations** | Every hour | EscalationService: find pending approvals with breached SLA + escalation_count < 4. Escalate one level. | Yes — checks escalation_count |
| **detect_stalled** | Daily 06:00 | Find renewals with no status change in 14+ days. Mark as STALLED. Create alert. | Yes — checks last_status_change |
| **sync_erp** | Every 30 min | Push unsynced POs and invoices to ERP. Pull budget updates. | Yes — idempotency key per sync batch |
| **cleanup_temp** | Daily 03:00 | Delete temp uploads older than 24h. Purge soft-deleted records past retention. | Yes |
| **digest_notifications** | Daily 08:00 | Aggregate low-priority notifications into digest email per user. | Yes — marks as digested |
| **scorecards** | Weekly Sun 04:00 | Compute vendor scorecards from contract, PO, invoice data. | Yes — upsert per vendor+period |
| **refresh_views** | Every 15 min | Refresh materialized views for dashboard queries. | Yes |
| **check_invoice_overdue** | Daily 07:00 | Flag invoices past payment_due_date without payment recorded. | Yes |
| **auto_resume_hold** | Daily 09:00 | Find renewals where hold_until <= today. Notify S1 to review for resumption. | Yes |

### 3.4 Job Execution Guarantees

| Property | Guarantee |
|---|---|
| **At-least-once execution** | Jobs may run more than once. All jobs are idempotent. |
| **No parallel runs of same job** | If a job is still running when the next trigger fires, the next run is skipped. |
| **Audit trail** | Every job execution is logged: start time, end time, success/failure, records processed, errors. |
| **Failure notification** | If a job fails 3 consecutive times, S10 is notified via critical notification. |
| **Manual trigger** | S10 can trigger any job manually from the admin panel. |

### 3.5 Dynamic Scheduling

Some jobs are not on a fixed schedule but triggered by conditions:

| Job | Trigger | Behavior |
|---|---|---|
| **retry_erp_sync** | PO/Invoice created with erp_sync_status = 'failed' | Runs 5 min after failure, then 15 min, then 60 min. Max 3 retries. |
| **remind_approver** | ApprovalRecord.reminded_at > 24h ago | Sends reminder notification to approver. |

---

## 4. Notification Engine

### 4.1 Purpose

The Notification Engine routes domain events to the right stakeholders through the right channels at the right priority. It is the single source of truth for who gets notified about what.

### 4.2 Architecture

```
                   Domain Event (from Event Bus)
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      NOTIFICATION ENGINE                                     │
│                                                                              │
│  1. EVENT INTERPRETER                                                        │
│     ┌──────────────────────────────────────────────────────────────────┐    │
│     │  Input: { event: "renewal.assigned", payload: {...} }           │    │
│     │  Output: { affected_users: [uuid, uuid], priority: "high" }     │    │
│     └──────────────────────────────────────────────────────────────────┘    │
│                            │                                                 │
│                            ▼                                                 │
│  2. PREFERENCE CHECK                                                        │
│     ┌──────────────────────────────────────────────────────────────────┐    │
│     │  For each user: check notification_preferences JSONB            │    │
│     │  { "renewal_assigned": "in_app+email", "sla_breach": "all" }    │    │
│     │  Filter out users who have opted out of this event type.        │    │
│     └──────────────────────────────────────────────────────────────────┘    │
│                            │                                                 │
│                            ▼                                                 │
│  3. NOTIFICATION CREATION                                                    │
│     ┌──────────────────────────────────────────────────────────────────┐    │
│     │  INSERT into notifications table for each affected user.        │    │
│     │  Fields: user_id, type, title, body, entity_type, entity_id,    │    │
│     │           priority, read=false                                   │    │
│     └──────────────────────────────────────────────────────────────────┘    │
│                            │                                                 │
│                            ▼                                                 │
│  4. CHANNEL DISPATCH                                                        │
│     ┌──────────────────────────────────────────────────────────────────┐    │
│     │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │    │
│     │  │ In-App   │  │  Email   │  │  Digest  │  │  WebSocket │       │    │
│     │  │ (always) │  │ (per prefs)│  │(low pri) │  │ (if conn) │       │    │
│     │  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │    │
│     └──────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Event-to-Notification Mapping

| Domain Event | Affected Users | Priority | Channel |
|---|---|---|---|
| renewal.created | S1 | normal | in-app |
| renewal.assigned | S2 (assignee) | normal | in-app + email |
| quote.received | S1 | normal | in-app |
| budget.approved | S2 | low | in-app |
| budget.rejected | S2, S1 | high | in-app + email |
| legal.review.required | S4 | high | in-app + email |
| legal.approved | S2 | normal | in-app |
| legal.rejected | S2, S1 | high | in-app + email |
| business.approval.required | S5 | high | in-app + email |
| business.approved | S2 | normal | in-app |
| business.rejected | S2, S1 | high | in-app + email |
| renewal.cancelled | S1, S2 | high | in-app + email |
| renewal.on_hold | S1 | normal | in-app |
| renewal.escalated | Escalation target, S1 | critical | in-app + email |
| po.created | S2 | normal | in-app |
| po.sent | S2 | normal | in-app |
| po.acknowledged | S2 | low | in-app |
| po.rejected | S2, S1 | high | in-app + email |
| invoice.received | S3 | normal | in-app |
| invoice.matched | S3 | low | in-app |
| invoice.exception | S3, S2 | high | in-app + email |
| sla.breached | Approver, approver's manager, S1 | critical | in-app + email |
| renewal.stalled | S1 | high | in-app + email |
| task.assigned | Assignee | normal | in-app |

### 4.4 Digest Mode

Low-priority notifications are held and delivered as a daily digest:

```
Subject: Muraai Daily Digest — Jul 20, 2026
───
RENEWALS
  • RNW-4125 — Budget approved ($45,000)
  • RNW-4118 — Quote received from SAP ($180,000)

PURCHASE ORDERS
  • PO-2026-00421 — Acknowledged by Oracle

INVOICES
  • INV-2026-08921 — Matched to PO-2026-00421
```

Digest is sent at 08:00 in the user's timezone (derived from user preferences). Users can opt out of digest in favor of real-time.

### 4.5 Notification Preferences JSONB Schema

```json
{
  "renewal_assigned": "in_app",
  "approval_required": "in_app+email",
  "sla_breach": "all",
  "invoice_received": "in_app",
  "po_status": "digest",
  "system_notifications": "email",
  "digest_enabled": true,
  "digest_time": "08:00",
  "timezone": "America/New_York"
}
```

---

## 5. Renewal Engine

### 5.1 Purpose

The Renewal Engine is the heart of Muraai. It orchestrates every renewal lifecycle from identification through completion. It enforces the state machine, coordinates domain services, and emits events at every transition.

### 5.2 Architecture

```
                    ┌─────────────────────────────────────┐
                    │           RENEWAL ENGINE              │
                    │                                      │
                    │  ┌──────────────────────────────┐   │
                    │  │    STATE MACHINE CORE         │   │
                    │  │  ┌────────────────────────┐  │   │
    Transition ────►│  │  │ TransitionValidator    │  │   │
    Request         │  │  │ - Allowed transition?  │  │   │
                    │  │  │ - Business rules pass? │  │   │
                    │  │  │ - Permissions check?   │  │   │
                    │  │  └───────────┬────────────┘  │   │
                    │  │              ▼               │   │
                    │  │  ┌────────────────────────┐  │   │
                    │  │  │ TransitionExecutor     │  │   │
                    │  │  │ - Execute exit actions │  │   │
                    │  │  │ - Update status        │  │   │
                    │  │  │ - Execute entry actions│  │   │
                    │  │  │ - Create timeline entry│  │   │
                    │  │  │ - Log to activity log  │  │   │
                    │  │  └───────────┬────────────┘  │   │
                    │  └──────────────┼───────────────┘   │
                    │                 │                    │
                    │                 ▼                    │
                    │  ┌──────────────────────────────┐   │
                    │  │    SERVICE ORCHESTRATOR       │   │
                    │  │  Calls domain services during │   │
                    │  │  transitions:                 │   │
                    │  │  - BudgetValidationService    │   │
                    │  │  - ApprovalRoutingService     │   │
                    │  │  - EscalationService          │   │
                    │  │  - PODraftCreationService     │   │
                    │  └───────────┬──────────────────┘   │
                    │              │                       │
                    │              ▼                       │
                    │  ┌──────────────────────────────┐   │
                    │  │    EVENT EMITTER              │   │
                    │  │  Emits after successful       │   │
                    │  │  transition:                  │   │
                    │  │  - renewal.{new_status}       │   │
                    │  └──────────────────────────────┘   │
                    └─────────────────────────────────────┘
```

### 5.3 Transition Flow

```
POST /renewals/{id}/approve-business
         │
         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 1. AUTHORIZATION CHECK                                                      │
│    - Is the user authenticated?                                            │
│    - Does the user have the business_owner role?                           │
│    - Is this renewal assigned to the user's department?                    │
│    - Is the user different from the creator? (segregation of duties)       │
└────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 2. STATE MACHINE VALIDATION                                                 │
│    - Load current status from DB                                           │
│    - Load allowed transitions map                                          │
│    - Is BUSINESS_APPROVAL -> BUSINESS_APPROVED allowed?                    │
│    - Check guards: usage attestation valid?                                │
└────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 3. BUSINESS RULE EVALUATION                                                 │
│    - Value > CFO_THRESHOLD? -> Schedule additional CFO approval step       │
│    - Usage attestation > 12 months old? -> Require new attestation first    │
└────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 4. TRANSITION EXECUTION (in DB transaction)                                 │
│    - Exit actions on current state                                          │
│    - UPDATE renewal SET status = 'business_approved', business_approved_at │
│    - INSERT into renewal_timeline_entry                                     │
│    - INSERT into activity_log                                               │
│    - Entry actions on new state                                             │
│    COMMIT                                                                   │
└────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 5. POST-TRANSITION ACTIONS (after commit, async)                            │
│    - Emit event: renewal.business_approved                                  │
│    - If CFO approval needed: ApprovalRoutingService creates CFO step       │
│    - If no further approval: PODraftCreationService triggered              │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Entry and Exit Actions

Each state in the renewal machine has entry and exit actions executed by the Renewal Engine:

| State | Entry Action | Exit Action |
|---|---|---|
| PENDING_REVIEW | Notify S1. Start 14-day assignment SLA timer. | — |
| ASSIGNED | Notify S2. Set assigned_at. Start quote SLA timer. | Clear assignment timer. |
| QUOTE_RECEIVED | Store quote amount and ref. Notify S1. | — |
| BUDGET_CHECK | Call BudgetValidationService. Set budget_checked_at. | — |
| BUDGET_PASSED | Set budget_approved_amount. Evaluate approval routing. | — |
| BUDGET_REVIEW | Notify S2, S1. Start budget review SLA. | — |
| LEGAL_REVIEW | Create ApprovalRecord for S4. Start 48h SLA. | — |
| LEGAL_APPROVED | Record approval. Check chain for next step. | — |
| LEGAL_REJECTED | Log rejection. Notify S2. | — |
| BUSINESS_APPROVAL | Check attestation. Create ApprovalRecord for S5. Start 48h SLA. | — |
| BUSINESS_APPROVED | Record approval. Check CFO threshold. Trigger PO creation. | — |
| BUSINESS_REJECTED | Set cancellation_reason. Notify stakeholders. | — |
| PO_PENDING | System creates PO draft. Notify S2 "PO ready." | — |
| PO_SENT | Link PO. Start acknowledgment SLA. | — |
| INVOICE_MATCHED | Link invoice. Update forecast. | — |
| COMPLETE | Notify all stakeholders. Archive. | — |
| ON_HOLD | Set hold_reason, hold_until. Schedule resume check. | — |
| ESCALATED | Increment escalation_level. Notify target. | — |
| CANCELLED | Log reason. Notify stakeholders. | — |
| STALLED | Notify S1. EscalationService evaluates next step. | — |

### 5.5 State Machine Definition Format

```python
# Pseudocode — the state machine is defined as a data structure, not if/else

RENEWAL_STATES = {
    "pending_review": {
        "allowed_transitions": ["assigned", "cancelled", "on_hold"],
        "entry_actions": ["notify_s1", "start_assignment_sla_timer"],
        "exit_actions": []
    },
    "assigned": {
        "allowed_transitions": ["quote_received", "cancelled", "on_hold", "escalated", "stalled"],
        "entry_actions": ["notify_s2", "set_assigned_at", "start_quote_sla_timer"],
        "exit_actions": ["clear_assignment_timer"]
    },
    # ... all 20 states defined similarly
}

TRANSITION_GUARDS = {
    "business_approval->business_approved": ["attestation_valid", "not_cancelled"],
    "pending_review->assigned": ["assignee_has_procurement_role"],
    "po_pending->po_sent": ["po_has_line_items"],
}
```

---

## 6. Event Bus

### 6.1 Purpose

The Event Bus decouples service communication. Services emit events without knowing who consumes them. Consumers subscribe to events without knowing who emitted them. This prevents circular dependencies and enables independent deployability.

### 6.2 Technology

| Environment | Technology | Rationale |
|---|---|---|
| **Production** | Redis Pub/Sub + Redis Streams | Low latency, no additional infrastructure, built-in persistence with Streams |
| **Development** | In-process event bus | Zero infrastructure required. Same interface as Redis. |
| **Fallback (no Redis)** | PostgreSQL LISTEN/NOTIFY | Uses existing database connection. Higher latency, no persistence. |

### 6.3 Event Format

```json
{
  "id": "evt_uuid",
  "type": "renewal.business_approved",
  "version": 1,
  "timestamp": "2026-07-20T12:00:00.000Z",
  "producer": "renewal_service",
  "correlation_id": "uuid",
  "data": {
    "renewal_id": "uuid",
    "contract_id": "uuid",
    "approved_amount": 250000.00,
    "approved_by": "user_uuid"
  }
}
```

### 6.4 Event Catalog

| Event | Producer | Consumers |
|---|---|---|
| renewal.created | RenewalEngine | NotificationEngine, ActivityService |
| renewal.assigned | RenewalEngine | NotificationEngine, ActivityService, Scheduler (start SLA) |
| quote.received | RenewalEngine | NotificationEngine, ActivityService, BudgetService |
| budget.passed | BudgetService | RenewalEngine, NotificationEngine, ActivityService |
| budget.rejected | BudgetService | RenewalEngine, NotificationEngine, ActivityService, TaskService |
| legal.required | RenewalEngine | ApprovalService, NotificationEngine, ActivityService |
| legal.approved | ApprovalService | RenewalEngine, NotificationEngine, ActivityService |
| legal.rejected | ApprovalService | RenewalEngine, NotificationEngine, ActivityService |
| business.approved | ApprovalService | RenewalEngine, NotificationEngine, ActivityService, ProcurementService |
| business.rejected | ApprovalService | RenewalEngine, NotificationEngine, ActivityService |
| renewal.cancelled | RenewalEngine | NotificationEngine, ActivityService, TaskService |
| renewal.on_hold | RenewalEngine | NotificationEngine, ActivityService, Scheduler |
| renewal.escalated | RenewalEngine | NotificationEngine, ActivityService |
| renewal.stalled | Scheduler | NotificationEngine, ActivityService, TaskService |
| po.created | ProcurementService | RenewalEngine, NotificationEngine, ActivityService |
| po.sent | ProcurementService | NotificationEngine, ActivityService, Scheduler (start ack SLA) |
| po.acknowledged | ProcurementService | NotificationEngine, ActivityService |
| po.rejected | ProcurementService | NotificationEngine, ActivityService, TaskService |
| invoice.received | FinancialService | NotificationEngine, ActivityService, InvoiceMatchingService |
| invoice.matched | FinancialService | RenewalEngine, NotificationEngine, ActivityService |
| invoice.exception | FinancialService | NotificationEngine, ActivityService, TaskService |
| sla.breached | Scheduler | NotificationEngine, ActivityService, EscalationService |
| task.created | TaskService | NotificationEngine, ActivityService |
| contract.end_date_approaching | Scheduler | RenewalEngine |

### 6.5 Subscription Pattern

```python
# Pseudocode — services subscribe during startup

class NotificationEngine:
    def on_startup(self):
        event_bus.subscribe("renewal.assigned", self.handle_assigned)
        event_bus.subscribe("renewal.cancelled", self.handle_cancelled)
        event_bus.subscribe("sla.breached", self.handle_sla_breach)
        # ...

    def handle_assigned(self, event):
        users = [event.data.assigned_to]
        self.create_notifications(users, event)
```

### 6.6 Delivery Guarantees

| Property | Implementation |
|---|---|
| **At-least-once** | Redis Streams consumer groups with manual acknowledgment. If consumer crashes, message is re-delivered. |
| **Ordering** | Per-stream ordering guaranteed. Cross-stream ordering not guaranteed (services must not depend on it). |
| **Retry** | Failed messages are retried 3 times with exponential backoff (5s, 30s, 120s). After 3 failures, moved to dead letter queue. |
| **Dead letter** | Dead letter queue persisted in Redis. S10 can view and replay dead letters from admin panel. |

---

## 7. Email Service

### 7.1 Purpose

Handle all outbound email delivery: notifications, PO documents, vendor communication, and digest emails.

### 7.2 Architecture

```
                    ┌─────────────────────────────────────┐
                    │          EMAIL SERVICE                │
                    │                                      │
                    │  ┌──────────────────────────────┐   │
                    │  │    EMAIL QUEUE (Redis)       │   │
                    │  │  ┌──────────┐ ┌──────────┐  │   │
                    │  │  │ priority │ │ bulk     │  │   │
                    │  │  │ queue    │ │ queue    │  │   │
                    │  │  └──────────┘ └──────────┘  │   │
                    │  └──────────────┬───────────────┘   │
                    │                 │                    │
                    │                 ▼                    │
                    │  ┌──────────────────────────────┐   │
                    │  │    RENDERER                   │   │
                    │  │  - Template engine (Jinja2)   │   │
                    │  │  - Inlines CSS for clients    │   │
                    │  │  - Renders HTML + plaintext   │   │
                    │  └──────────────┬───────────────┘   │
                    │                 │                    │
                    │                 ▼                    │
                    │  ┌──────────────────────────────┐   │
                    │  │    PROVIDER ADAPTER           │   │
                    │  │  ┌──────────┐ ┌──────────┐  │   │
                    │  │  │ Resend   │ │ SendGrid │  │   │
                    │  │  │ (default)│ │ (opt.)   │  │   │
                    │  │  └──────────┘ └──────────┘  │   │
                    │  └──────────────────────────────┘   │
                    │                                      │
                    │  ┌──────────────────────────────┐   │
                    │  │    TRACKING                   │   │
                    │  │  - Delivery status            │   │
                    │  │  - Open tracking (1x1 pixel)  │   │
                    │  │  - Bounce handling            │   │
                    │  └──────────────────────────────┘   │
                    └─────────────────────────────────────┘
```

### 7.3 Email Templates

| Template | Trigger | Priority | Attachments |
|---|---|---|---|
| **renewal_assigned** | Renewal assigned to S2 | Normal | — |
| **approval_required** | Approval step created | High | — |
| **sla_breach** | Approval SLA breached | Critical | — |
| **po_sent** | PO sent to vendor | Normal | PO PDF |
| **po_acknowledgment** (to vendor) | PO sent | Normal | PO PDF, renewal summary |
| **quote_request** (to vendor) | S2 requests quote | Normal | Contract summary |
| **invoice_received** | Invoice recorded | Normal | — |
| **invoice_exception** | Matching variance | High | Exception details |
| **digest** | Daily notification digest | Low | — |
| **vendor_document_request** | Request document from vendor | Normal | Secure upload link |

### 7.4 Provider Abstraction

```python
class EmailProvider(ABC):
    @abstractmethod
    def send(self, to: str, subject: str, html: str, text: str,
             attachments: list[Attachment]) -> SendResult: ...

class ResendProvider(EmailProvider):
    def send(self, ...):
        # Calls Resend API
        pass

class SendGridProvider(EmailProvider):
    def send(self, ...):
        # Calls SendGrid API
        pass
```

Switching providers is a configuration change:
```json
{
  "email_provider": "resend",
  "resend_api_key": "re_..."
}
```

### 7.5 Email Queue

| Queue | Processing | Retry |
|---|---|---|
| **priority** | Immediate delivery (SLA breach, approval required) | 3 retries: 1min, 5min, 15min. Then dead letter. |
| **bulk** | Batched every 5 minutes (digest, non-urgent notifications) | 3 retries: 5min, 15min, 60min. Then dead letter. |

### 7.6 Sending Email from the Renewal Workspace

When S2 clicks "Email Vendor" from the Renewal Workspace Communication section:

```
1. Composer opens pre-filled:
   - To: vendor primary contact email
   - Subject: "Re: Renewal RNW-4123 — Oracle DB EE"
   - Body: Template with renewal context
2. S2 composes and sends
3. Email is sent via Email Service
4. Copy is stored in the Communication section (emails table)
5. Activity log entry created: "email_sent — to vendor, subject: ..."
```

---

## 8. File Storage

### 8.1 Purpose

Abstract file storage behind a uniform interface. Support multiple providers (local filesystem for development, S3 for production, OneDrive for enterprise customers).

### 8.2 Architecture

```
                    ┌─────────────────────────────────────┐
                    │        FILE STORAGE SERVICE           │
                    │                                      │
                    │  ┌──────────────────────────────┐   │
                    │  │    STORAGE ADAPTER            │   │
                    │  │  ┌──────────┐ ┌──────────┐  │   │
                    │  │  │  Local   │ │   S3     │  │   │
                    │  │  │ (dev)    │ │ (prod)   │  │   │
                    │  │  └──────────┘ └──────────┘  │   │
                    │  │  ┌──────────┐ ┌──────────┐  │   │
                    │  │  │ OneDrive │ │  GCS    │  │   │
                    │  │  │ (enterp) │ │ (opt.)   │  │   │
                    │  │  └──────────┘ └──────────┘  │   │
                    │  └──────────────────────────────┘   │
                    │                                      │
                    │  ┌──────────────────────────────┐   │
                    │  │    PROCESSING PIPELINE        │   │
                    │  │  - Virus scan (ClamAV)        │   │
                    │  │  - Malware detection           │   │
                    │  │  - File type validation        │   │
                    │  │  - Size validation             │   │
                    │  │  - Thumbnail generation (PDF)  │   │
                    │  └──────────────────────────────┘   │
                    │                                      │
                    │  ┌──────────────────────────────┐   │
                    │  │    URL GENERATION             │   │
                    │  │  - Signed URLs (S3 presigned) │   │
                    │  │  - Expiring links             │   │
                    │  │  - OneDrive sharing links      │   │
                    │  └──────────────────────────────┘   │
                    └─────────────────────────────────────┘
```

### 8.3 Storage Adapter Interface

```python
class StorageProvider(ABC):
    @abstractmethod
    def upload(self, file: BinaryIO, path: str, content_type: str) -> str:
        """Upload file. Returns URL."""
        pass

    @abstractmethod
    def download(self, url: str) -> BinaryIO:
        """Download file by URL."""
        pass

    @abstractmethod
    def delete(self, url: str) -> None:
        """Delete file by URL."""
        pass

    @abstractmethod
    def get_signed_url(self, url: str, expires_in: int = 3600) -> str:
        """Get temporary access URL."""
        pass

    @abstractmethod
    def copy(self, source_url: str, dest_path: str) -> str:
        """Copy file to new path."""
        pass
```

### 8.4 File Path Convention

```
{environment}/{entity_type}/{entity_id}/{document_id}_{version}.{ext}

Examples:
  production/contracts/a1b2c3d4/doc_e5f6g7h8_1.pdf
  development/vendors/i9j0k1l2/doc_m3n4o5p6_1.jpg
```

### 8.5 Allowed File Types

| Category | MIME Types | Max Size |
|---|---|---|
| **Documents** | application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document | 50 MB |
| **Spreadsheets** | application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | 50 MB |
| **Images** | image/jpeg, image/png, image/tiff | 25 MB |
| **Archives** | application/zip | 100 MB |
| **Text** | text/plain, text/csv | 10 MB |

Files outside these types are rejected before upload.

### 8.6 Upload Flow

```
1. Client requests signed upload URL
   POST /api/v1/files/upload-url
   { "entity_type": "contract", "entity_id": "uuid", "file_name": "contract.pdf" }
   
2. Server validates:
   - File extension against allowed types
   - User permission on the entity
   - Storage quota (if applicable)

3. Server returns presigned URL:
   { "upload_url": "https://s3...", "file_url": "https://...", "expires_in": 3600 }

4. Client uploads directly to storage provider

5. Client notifies server:
   POST /api/v1/contracts/{id}/documents
   { "file_url": "https://...", "file_name": "contract.pdf", "file_size": 1234 }

6. Server records document metadata, triggers processing pipeline
```

### 8.7 Processing Pipeline

After upload, the document enters the processing pipeline:

```
Upload Complete
     │
     ▼
┌────────────────┐
│ Virus Scan     │──── Failed ──► Quarantine (PROCESS_FAILED)
└────────┬───────┘               Notify S10. Admin can delete or force-approve.
         │ Passed
         ▼
┌────────────────┐
│ Type Validate  │──── Failed ──► Reject with error message
└────────┬───────┘
         │ Passed
         ▼
┌────────────────┐
│ Thumbnail Gen  │──── Failed ──► Document still usable, no thumbnail
└────────┬───────┘
         │ Complete
         ▼
┌────────────────┐
│ Index for      │
│ Search (future)│
└────────┬───────┘
         │ Complete
         ▼
┌────────────────┐
│ STATUS: READY  │
│ Document       │
│ available for  │
│ view/download  │
└────────────────┘
```

### 8.8 Storage Provider Configuration

```json
{
  "active_provider": "s3",
  "providers": {
    "local": {
      "base_path": "/data/files"
    },
    "s3": {
      "bucket": "muraai-files-prod",
      "region": "us-east-1",
      "access_key": "...",
      "secret_key": "...",
      "endpoint": null
    },
    "onedrive": {
      "tenant_id": "...",
      "client_id": "...",
      "client_secret": "...",
      "root_path": "/Muraai/Contracts"
    }
  }
}
```

---

## 9. Cross-Cutting Concerns

### 9.1 Error Handling

All services follow a consistent error handling pattern:

| Layer | Error Handling |
|---|---|
| **Route handler** | Catches service exceptions. Returns standardized error response with HTTP status code. |
| **Service layer** | Raises typed exceptions: `ValidationError`, `TransitionError`, `PermissionDenied`, `NotFoundError`, `ConflictError`. |
| **Integration adapters** | Wraps external API errors in `IntegrationError`. Retries transient failures. |
| **Unhandled errors** | Global exception handler logs full stack trace, returns 500 with error reference code. |

### 9.2 Logging

| Concern | Log Level | Destination |
|---|---|---|
| Business events (state transitions, approvals) | INFO | ActivityLog (DB) + structured log (stdout) |
| API requests | INFO | Structured log (stdout) |
| Integration calls | DEBUG | Structured log |
| Errors | ERROR | Structured log + error tracking (Sentry) |
| Security events (auth failure, permission denied) | WARN | Structured log + security alert |

### 9.3 Health Checks

Every service exposes a health endpoint at `/health`:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "dependencies": {
    "postgresql": { "status": "ok", "latency_ms": 2 },
    "redis": { "status": "ok", "latency_ms": 1 },
    "s3": { "status": "ok", "latency_ms": 15 }
  },
  "uptime_seconds": 3600,
  "last_db_migration": "20260720_initial"
}
```

---

## 10. Sequence Diagrams

### 10.1 Renewal Lifecycle — Complete Happy Path

```
Scheduler    RenewalEng   ContractSvc  ApprovalSvc  BudgetSvc   ProcureSvc  FinancialSvc  EmailSvc
    │            │            │            │            │            │            │            │
    │ ① detect  │            │            │            │            │            │            │
    │──────────►│            │            │            │            │            │            │
    │            │ ② get     │            │            │            │            │            │
    │            │──────────►│            │            │            │            │            │
    │            │◄──────────│            │            │            │            │            │
    │            │ ③ create  │            │            │            │            │            │
    │            │──┐        │            │            │            │            │            │
    │            │  │ INSERT │            │            │            │            │            │
    │            │◄─┘        │            │            │            │            │            │
    │            │ ④ emit    │            │            │            │            │            │
    │            │───┐       │            │            │            │            │            │
    │            │   │ event │            │            │            │            │            │
    │            │◄──┘       │            │            │            │            │            │
    │            │           │            │            │            │            │ ⑤ notify   │
    │            │           │            │            │            │            │──────────►│
    │            │           │            │            │            │            │            │
    │ [S1 assigns — API call]            │            │            │            │            │
    │            │ ⑥ transit │            │            │            │            │            │
    │            │──┐        │            │            │            │            │            │
    │            │  │ UPDATE │            │            │            │            │            │
    │            │◄─┘        │            │            │            │            │            │
    │            │ ⑦ emit    │            │            │            │            │            │
    │            │───┐       │            │            │            │            │            │
    │            │   │       │            │            │            │            │ ⑧ notify   │
    │            │   │       │            │            │            │            │──────────►│
    │ [S2 records quote — API call]      │            │            │            │            │
    │            │ ⑨ transit │            │            │            │            │            │
    │            │──┐        │            │            │            │            │            │
    │            │  │ UPDATE │            │            │            │            │            │
    │            │◄─┘        │            │            │            │            │            │
    │            │ ⑩ emit    │            │            │            │            │            │
    │            │───┐       │            │            │            │            │            │
    │            │   │ event │            │            │            │            │            │
    │            │◄──┘       │            │            │            │            │            │
    │            │           │            │            │ ⑪ validate │            │            │
    │            │           │            │            │──┐         │            │            │
    │            │           │            │            │  │ ERP call│            │            │
    │            │           │            │            │◄─┘         │            │            │
    │            │ ⑫ transit │            │            │            │            │            │
    │            │──┐        │            │            │            │            │            │
    │            │  │ UPDATE │            │            │            │            │            │
    │            │◄─┘        │            │            │            │            │            │
    │            │ ⑬ route   │            │            │            │            │            │
    │            │──────────►│            │            │            │            │            │
    │            │           │ ⑭ create   │            │            │            │            │
    │            │           │──────────►│            │            │            │            │
    │            │           │ ⑮ notify   │            │            │            │            │
    │            │           │           │            │            │            │──────────►│
    │ [S4 approves — API call]           │            │            │            │            │
    │            │           │ ⑯ approve  │            │            │            │            │
    │            │           │◄──────────│            │            │            │            │
    │            │ ⑰ transit │            │            │            │            │            │
    │            │──┐        │            │            │            │            │            │
    │            │  │        │            │            │            │            │            │
    │ [S5 approves — API call]           │            │            │            │            │
    │            │ ⑱ transit │            │            │            │            │            │
    │            │──┐        │            │            │            │            │            │
    │            │  │        │            │            │            │            │            │
    │            │ ⑲ trigger  │            │            │            │            │            │
    │            │───────────│────────────│────────────│───────────►│            │            │
    │            │           │            │            │            │ ⑳ create   │            │
    │            │           │            │            │            │──┐         │            │
    │            │           │            │            │            │  │ INSERT  │            │
    │            │           │            │            │            │◄─┘         │            │
    │ [S2 sends PO — API call]           │            │            │            │            │
    │            │           │            │            │            │ ㉑ send    │            │
    │            │           │            │            │            │──┐         │            │
    │            │           │            │            │            │  │ email   │            │
    │            │           │            │            │            │  │─────────►            │
    │            │           │            │            │            │◄─┘         │            │
    │ [Invoice received — API call]      │            │            │            │            │
    │            │           │            │            │            │ ㉒ match   │            │
    │            │           │            │            │            │──────────►│            │
    │            │           │            │            │            │ ㉓ result  │            │
    │            │           │            │            │            │◄──────────│            │
    │            │ ㉔ transit │            │            │            │            │            │
    │            │──┐        │            │            │            │            │            │
    │            │  │ COMPLETE│           │            │            │            │            │
    │            │◄─┘        │            │            │            │            │ ㉕ notify  │
    │            │           │            │            │            │            │──────────►│
```

### 10.2 SLA Breach Escalation

```
Scheduler           ApprovalSvc        NotificationEng        User (Manager)
    │                    │                    │                    │
    │ ① check_sla       │                    │                    │
    │──────────────────►│                    │                    │
    │                   │ ② find breaches    │                    │
    │                   │──┐                 │                    │
    │                   │  │ SELECT pending   │                    │
    │                   │  │ WHERE deadline<now AND esc_count < 4 │
    │                   │◄─┘                 │                    │
    │                   │ ③ escalate         │                    │
    │                   │──┐                 │                    │
    │                   │  │ UPDATE esc_count │                    │
    │                   │◄─┘                 │                    │
    │                   │ ④ emit             │                    │
    │                   │───────────────────►│                    │
    │                   │                    │ ⑤ notify manager  │
    │                   │                    │──────────────────►│
    │                   │                    │                    │
    │                   │                    │          [Manager reviews]
    │                   │                    │                    │
```

---

## 11. Deployment Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION DEPLOYMENT                                 │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  LOAD BALANCER (Nginx / Cloudflare)                                  │   │
│  └────────────────────┬─────────────────────────────────────────────────┘   │
│                       │                                                     │
│          ┌────────────┴────────────┐                                        │
│          ▼                         ▼                                        │
│  ┌──────────────┐         ┌──────────────┐                                  │
│  │  API Instance 1 │         │  API Instance 2 │                              │
│  │  (all services) │         │  (all services) │                              │
│  └────────┬───────┘         └────────┬───────┘                              │
│           │                          │                                       │
│           └──────────┬───────────────┘                                       │
│                      │                                                        │
│                      ▼                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     DATA LAYER                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │ PostgreSQL   │  │    Redis     │  │  S3 / OneDr  │               │   │
│  │  │ (primary)    │  │ (cache/queue)│  │  (file store)│               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     BACKGROUND WORKERS                                │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │  Scheduler   │  │  Email       │  │  File        │               │   │
│  │  │  (1 instance)│  │  Worker      │  │  Processor   │               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     MONITORING                                        │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │  Health      │  │  Error       │  │  Metrics     │               │   │
│  │  │  Checks      │  │  Tracking    │  │  (Prometheus)│               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Technology Stack Summary

| Component | Technology | Rationale |
|---|---|---|
| **Runtime** | Python 3.11+ | Existing codebase, team expertise, rich ecosystem |
| **Web Framework** | Flask / FastAPI | Existing Flask codebase. FastAPI recommended for new services. |
| **ORM** | SQLAlchemy 2.0 | Mature, supports PostgreSQL + SQLite, async support |
| **Validation** | Pydantic v2 | Request/response schemas, integrated with FastAPI |
| **Database** | PostgreSQL 15 | ENUMs, JSONB, UUIDs, materialized views |
| **Cache / Queue** | Redis 7 | Pub/Sub, streams, rate limiting, session cache |
| **Scheduler** | APScheduler | DB-backed job store, cron/interval triggers |
| **Email** | Resend (primary), SendGrid (fallback) | Reliable API, tracking, templates |
| **File Storage** | S3 (primary), OneDrive (enterprise) | Standard object storage, presigned URLs |
| **Auth** | JWT (now), SAML/OIDC (Phase 4) | Stateless auth, SSO-ready |
| **Testing** | pytest, pytest-asyncio | Existing test suite (290 tests) |
| **CI/CD** | GitHub Actions | Existing pipeline |
| **Container** | Docker + Docker Compose | Existing setup |
