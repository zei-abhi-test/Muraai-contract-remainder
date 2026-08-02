# Atlas Observability Architecture

**Volume:** 11
**Status:** Draft
**Date:** 2026-07-20
**Purpose:** Define how we know production is healthy — logging, metrics, tracing, and dashboards.

---

## 1. Pillars of Observability

```
Observability
├── LOGGING    — Structured JSON. What happened.
├── METRICS    — Counters, histograms, gauges. How much, how fast, how often.
└── TRACING    — Distributed traces. Where did the time go.
```

---

## 2. Structured Logging

### Format (JSON)
```json
{
  "timestamp": "2026-07-20T14:30:00.123Z",
  "level": "INFO",
  "logger": "atlas.contract",
  "message": "Contract activated",
  "correlation_id": "c7f3a1b2-...",
  "request_id": "req-abc123",
  "contract_id": 42,
  "user_id": 7,
  "duration_ms": 145,
  "event_type": "contract.activated",
  "error": null
}
```

### Correlation IDs

Every user-facing request gets a `correlation_id` (UUID v4) that propagates through the entire system:

```
User Request
  └── API Gateway (generates correlation_id)
        └── Contract API (propagates)
              ├── Aggregate (includes in event payload)
              └── Database (logged in slow query log)
        └── Event Bus (propagates in event metadata)
              ├── Policy (includes in command)
              └── Projection (includes in write)
```

### Mandatory Fields

| Field | Type | Always Present | Description |
|---|---|---|---|
| `timestamp` | ISO 8601 | Yes | When the event occurred |
| `level` | enum | Yes | DEBUG, INFO, WARN, ERROR, FATAL |
| `logger` | string | Yes | Component emitting the log |
| `message` | string | Yes | Human-readable description |
| `correlation_id` | UUID | Yes | End-to-end request identifier |
| `request_id` | UUID | Yes | Per-HTTP-request identifier |
| `duration_ms` | int | In handlers | Time spent in the operation |

### Domain-Specific Fields (included when relevant)

| Field | Components |
|---|---|
| `contract_id` | Contract Aggregate, API |
| `renewal_id` | Renewal Aggregate, Policy Engine |
| `vendor_id` | Vendor Aggregate |
| `user_id` | All authenticated components |
| `event_type` | Event Bus, Event Store |
| `policy_name` | Policy Engine |
| `aggregate_type` | All aggregates |
| `aggregate_version` | All aggregates (optimistic locking) |

### Log Levels by Component

| Component | DEBUG | INFO | WARN | ERROR | FATAL |
|---|---|---|---|---|---|
| API | Request payloads | Request/response | Validation failures | 5xx errors | Startup failure |
| Aggregate | State transitions | Command execution | Invalid transitions | DB errors | — |
| Event Bus | Event delivery | Event published | Retry attempt | Delivery failure | — |
| Policy | Policy evaluation | Policy triggered | Stale state | Policy crash | — |
| Scheduler | — | Run started/completed | Overlap detected | Run failure | — |
| Projection | — | Projection updated | Lag detected | Projection failure | — |

---

## 3. Metrics

### Application Metrics

| Metric | Type | Tags | Description |
|---|---|---|---|
| `contracts.active` | Gauge | — | Current count of ACTIVE contracts |
| `contracts.created` | Counter | contract_type | Contracts created |
| `contracts.activated` | Counter | — | Contracts activated |
| `contracts.terminated` | Counter | reason | Contracts terminated |
| `contracts.expired` | Counter | — | Contracts expired (scheduler) |
| `renewals.started` | Counter | — | Renewal processes started |
| `renewals.completed` | Counter | — | Renewal processes completed |
| `renewals.cancelled` | Counter | reason | Renewals cancelled |
| `renewal.avg_duration_seconds` | Histogram | — | Time from start to completion |
| `renewal.sla_miss_percent` | Gauge | approval_type | % of SLA deadlines missed |
| `policies.failed` | Counter | policy_name | Policy execution failures |
| `policies.triggered` | Counter | policy_name | Policy invocations |
| `policies.avg_duration_ms` | Histogram | policy_name | Policy execution time |

### Infrastructure Metrics

| Metric | Type | Description |
|---|---|---|
| `projection.lag_seconds` | Gauge | How far behind projections are |
| `eventbus.queue_depth` | Gauge | Unprocessed events in bus |
| `eventbus.dlq_count` | Gauge | Events in dead letter queue |
| `email.send_success_rate` | Gauge | % of emails sent successfully |
| `email.send_duration_ms` | Histogram | Email send time |
| `po.processing_time_ms` | Histogram | PO generation time |
| `invoice.match_time_ms` | Histogram | Invoice matching time |
| `db.connection_pool_usage` | Gauge | Active connections / max connections |
| `db.query_duration_ms` | Histogram | Database query time |
| `db.slow_queries` | Counter | Queries exceeding 1s |
| `api.p99_latency_ms` | Histogram | API response time (p99) |
| `api.requests_per_minute` | Gauge | Request rate |
| `api.errors_5xx` | Counter | Server errors |
| `api.errors_4xx` | Counter | Client errors |
| `api.errors_429` | Counter | Rate limit hits |
| `scheduler.last_run_timestamp` | Gauge | When scheduler last ran |
| `storage.upload_duration_ms` | Histogram | Document upload time |
| `storage.upload_size_bytes` | Histogram | Document upload size |

### Business Metrics

| Metric | Type | Tags | Description |
|---|---|---|---|
| `contracts.about_to_expire` | Gauge | — | Contracts expiring within 30 days |
| `contracts.total_value` | Gauge | currency | Sum of all active contract values |
| `renewals.pending_approval` | Gauge | approval_type | Renewals awaiting approval |
| `renewals.total_value` | Gauge | currency | Sum of all in-progress renewal values |
| `vendors.active_count` | Gauge | tier | Active vendors |
| `users.active_sessions` | Gauge | — | Currently logged-in users |

### Metric Collection

- **Prometheus** for time-series storage and alerting
- Metrics exposed at `GET /metrics` (Prometheus format)
- Application metrics: custom instrumentations in each component
- Infrastructure metrics: node_exporter, postgres_exporter, redis_exporter

---

## 4. Distributed Tracing

### Trace Structure

Every end-to-end flow produces a single trace:

```
POST /api/contracts/42/activate
  ├── auth middleware: 5ms
  ├── contract API handler: 12ms
  │     ├── aggregate.activate: 8ms
  │     │     ├── db read: 2ms
  │     │     ├── validate: 1ms
  │     │     └── db write: 3ms
  │     └── event emission: 2ms
  └── response serialization: 1ms
```

### Trace Propagation

| Header | Purpose | Set By |
|---|---|---|
| `traceparent` | W3C trace context | API Gateway |
| `tracestate` | Vendor-specific trace data | API Gateway |
| `x-correlation-id` | Application correlation ID | API Gateway |

### Key Traces

| Trace Name | Span Count | Key Spans |
|---|---|---|
| `POST /api/contracts` | 8-15 | validate, db_insert, event_emit |
| `POST /api/contracts/{id}/activate` | 10-20 | validate, db_update, event_emit, policy_trigger |
| `POST /api/contracts/{id}/terminate` | 12-25 | validate, db_update, event_emit, renewal_cancel, notify |
| `Scheduler: expiry_check` | 5-50+ | db_query, per_contract: process_expire, emit_event |
| `Scheduler: renewal_detection` | 5-50+ | db_query, per_contract: check_window, create_renewal |
| `Renewal lifecycle` | 30-80+ | quote, budget, legal, approval, po, invoice, complete |

### Tracing Tool

**OpenTelemetry** SDK with Jaeger/Zipkin backend for trace visualization and analysis.

---

## 5. Dashboards

### DevOps Dashboard (Grafana)

Not for users. For operations teams.

**Panel 1: System Health**
- API p99 latency (sparkline, 24h)
- Error rate (5xx + 4xx, stacked)
- DB connection pool usage (gauge)
- Event bus queue depth (gauge)

**Panel 2: Domain Activity**
- Contracts activated per hour (bar chart)
- Renewals started vs completed (line chart, 7d)
- SLA miss % by approval type (heatmap)
- Policy failure rate (top 5 by name, table)

**Panel 3: Infrastructure Health**
- Scheduler last run (single stat, colored)
- Projection lag (gauge, red if >30s)
- Email success rate (gauge, red if <95%)
- Storage availability (single stat)

**Panel 4: Business Snapshot**
- Active contracts (stat)
- Renewals in progress (stat)
- Total contract value (stat)
- Pending approvals (stat)

### Alerting Rules

| Alert | Condition | Severity | Channel |
|---|---|---|---|
| API p99 latency > 2s | Last 5m avg | Critical | PagerDuty |
| Error rate > 5% | Last 5m avg | Critical | PagerDuty |
| DB connections > 80% | Current value | Warning | Slack |
| Projection lag > 60s | Current value | Warning | Slack |
| Scheduler not run > 36h | Age check | Critical | PagerDuty |
| Email success rate < 90% | Last 1h avg | Warning | Slack |
| Policy failure > 10/min | Last 5m rate | Critical | PagerDuty |
| Event bus DLQ > 100 | Current count | Warning | Slack |

---

## 6. Log Aggregation

- **Loki** or **Elasticsearch** for log storage and search
- Logs retained: 30 days (hot), 90 days (warm), 1 year (cold)
- Logs tagged with `service`, `environment`, `correlation_id`
- Searchable by correlation_id for end-to-end debugging

---

## 7. Health Check Endpoints

| Endpoint | What It Checks | Expected |
|---|---|---|
| `GET /health` | API process alive | `{"status": "ok"}` |
| `GET /health/ready` | DB, event bus, storage provider | `{"status": "ok", "dependencies": {...}}` |
| `GET /health/db` | DB connectivity + query | `{"status": "ok", "pool_usage": 3}` |
| `GET /health/eventbus` | Event bus connectivity | `{"status": "ok", "queue_depth": 0}` |
| `GET /health/storage` | Document storage connectivity | `{"status": "ok"}` |

---

## 8. Runbook Index

| Incident | Runbook | Owner |
|---|---|---|
| API latency spike | `ops/runbooks/api-latency.md` | Platform |
| DB connection pool exhaustion | `ops/runbooks/db-connections.md` | DBA |
| Scheduler not running | `ops/runbooks/scheduler-down.md` | Platform |
| Event bus backlog | `ops/runbooks/eventbus-backlog.md` | Platform |
| Email sending failure | `ops/runbooks/email-failure.md` | Integration |
| Projection lag | `ops/runbooks/projection-lag.md` | Data |
