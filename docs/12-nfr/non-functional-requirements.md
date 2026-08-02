# Atlas Non-Functional Requirements

**Volume:** 12
**Status:** Draft
**Date:** 2026-07-20
**Purpose:** Define the quality attributes that every sprint must respect. These are not optional — they are acceptance criteria for production readiness.

---

## 1. Availability

### Target

| Tier | Uptime | Downtime/Month | Downtime/Year |
|---|---|---|---|
| Core (API, DB, Event Bus) | 99.9% | 43m | 8.76h |
| Secondary (Reports, Analytics) | 99.5% | 3.6h | 43.8h |
| Best-effort (Batch, Sync) | 99.0% | 7.2h | 87.6h |

### Definition

- **Available:** API responds to health check within 2s, DB accepts queries, event bus accepts messages
- **Unavailable:** Health check fails for >30s, or >5% of requests return 5xx in a 5-minute window
- **Maintenance window:** Not counted as downtime if announced 7 days in advance and scheduled outside business hours (08:00-18:00 local time)

### Enforcement

- Health check endpoints monitored every 30s
- Synthetic transactions run every 5 minutes (create → read → delete a test contract)
- Multi-region deployment for DR (future)

---

## 2. Performance & Latency

### API Response Times (p95, under normal load)

| Endpoint Group | Target | Degraded | Unacceptable |
|---|---|---|---|
| Read single (GET /contracts/{id}) | <200ms | 200-500ms | >500ms |
| Read list (GET /contracts) | <400ms | 400-1000ms | >1s |
| Write single (POST/PUT contract) | <500ms | 500-1000ms | >1s |
| State transition (activate, terminate) | <800ms | 800-1500ms | >1.5s |
| Dashboard (GET /dashboard) | <1s | 1-2s | >2s |
| Timeline (GET /timeline) | <200ms | 200-500ms | >500ms |
| Search (GET /search) | <500ms | 500-1000ms | >1s |
| Document upload (POST /documents) | <3s | 3-10s | >10s |

### Workspace-Specific Targets

| Workspace | Target p95 | Degraded |
|---|---|---|
| Renewal Workspace | <400ms | 400-800ms |
| Contract Workspace | <500ms | 500-1000ms |
| Mission Control | <1s | 1-3s |
| Operational Inbox | <200ms | 200-500ms |

### Load Capacity

| Metric | Target | Tested At |
|---|---|---|
| Concurrent users | 500 | Load test |
| Requests per second (peak) | 100 | Load test |
| Contracts in database | 100,000 | Volume test |
| Events per day | 50,000 | Volume test |
| Document storage | 10TB | Scale test |

---

## 3. Recovery (RTO / RPO)

### Disaster Recovery

| Tier | RTO | RPO | Scope |
|---|---|---|---|
| Critical | <1 hour | <5 minutes | API, Database, Event Bus |
| High | <4 hours | <15 minutes | Auth, Notifications |
| Standard | <24 hours | <1 hour | Reports, Analytics, Batch |

### Component-Specific

| Component | RTO | RPO | Recovery Method |
|---|---|---|---|
| PostgreSQL | 1h | 5min | WAL streaming replica + pg_rewind |
| Event Store | 1h | 5min | Stream from DB WAL |
| Document Storage | 4h | 1h | Cross-region replication |
| API Servers | 15min | — | Load balanced + auto-scaling group |
| Cache (Redis) | 15min | 0 (rebuildable) | Rebuild from DB |
| Scheduler | 1h | — | Stateless, catch-up on restart |

### Backup Schedule

| Data | Frequency | Retention | Type |
|---|---|---|---|
| Database | Every 6h | 30 days | pg_dump + WAL archive |
| Event Store | Every 6h | 90 days | Logical backup |
| Documents | Continuous | 7 years | Cross-region replication |
| Configuration | Per deploy | 90 days | Git + Infrastructure-as-Code |

---

## 4. Security

### Authentication & Authorization

| Requirement | Standard |
|---|---|
| Password hashing | bcrypt (cost factor 12) |
| Session management | JWT (access: 15min, refresh: 7 days) |
| MFA | TOTP (RFC 6238) — optional per user |
| API authentication | JWT Bearer token |
| API-to-API auth | Client credentials (OAuth 2.0) |
| Rate limiting | Per user: 100 req/min (read), 30 req/min (write) |

### Data Protection

| Classification | Examples | Encryption at Rest | Encryption in Transit |
|---|---|---|---|
| Public | Product names, contract types | No | TLS 1.3 |
| Internal | Company names, departments | AES-256 | TLS 1.3 |
| Confidential | Contract amounts, pricing, PII | AES-256 | TLS 1.3 |
| Restricted | Passwords, API keys, legal terms | AES-256 + HSM | TLS 1.3 |

### Audit Trail

| Event | Log Detail | Retention |
|---|---|---|
| User login | user_id, IP, timestamp, success/fail | 1 year |
| Status transition | user_id, contract_id, from, to, timestamp | 7 years |
| Financial change | user_id, contract_id, old_value, new_value | 7 years |
| Permission change | admin_id, user_id, old_role, new_role | 7 years |
| Document access | user_id, document_id, timestamp | 1 year |
| API access (anonymized) | role, endpoint, timestamp, duration | 90 days |

### Vulnerability Management

| Severity | Remediation SLA | Example |
|---|---|---|
| Critical | <24 hours | Remote code execution |
| High | <7 days | SQL injection, auth bypass |
| Medium | <30 days | XSS, CSRF |
| Low | <90 days | Information disclosure |

---

## 5. Scalability

### Horizontal Scaling

| Component | Scaling Strategy | Max Nodes |
|---|---|---|
| API servers | Stateless, behind load balancer | 20 |
| Event bus workers | Partition-based consumption | 10 |
| Scheduler | Single-active (leader election) | 3 (1 active + 2 standby) |
| Policy engine | Partition by aggregate type | 10 |
| Document storage | CDN + object storage (unlimited) | N/A |

### Database Scaling

| Stage | Strategy | Max Contracts |
|---|---|---|
| Launch | Single PostgreSQL instance | 10,000 |
| Growth | Read replicas (3x) | 50,000 |
| Scale | Read replicas + connection pooling | 100,000 |
| Enterprise | Sharding by vendor_id | 500,000+ |

---

## 6. Caching Strategy

| Cache | What | TTL | Invalidation |
|---|---|---|---|
| Contract list (filtered) | GET /contracts with query params | 60s | On any contract write |
| Contract workspace | GET /contracts/{id} (full) | 30s | On contract write |
| Health status | Computed health | 300s | On contract status change |
| Dashboard aggregates | Dashboard data | 300s | On any domain event |
| Vendor list | GET /vendors | 300s | On vendor write |
| Product list | GET /products | 600s | On product write |

**Cache technology:** Redis (in-memory), CDN for static assets and document downloads.

---

## 7. Browser Support

| Tier | Browsers | Testing |
|---|---|---|
| Fully supported | Chrome 120+, Firefox 120+, Edge 120+ | Every sprint |
| Partially supported | Safari 17+ | Every release |
| Not supported | IE11, legacy browsers | N/A |

### Requirements

- All features work without JavaScript degradation (basic contract viewing)
- PWA support for offline document access (future)
- Responsive down to 320px width (mobile)

---

## 8. Localization

| Level | Languages | Timeline |
|---|---|---|
| L1 — UI strings | English (en), Hindi (hi) | Launch |
| L2 — Dates, currencies | All via Intl API | Launch |
| L3 — Full localization | English, Hindi, Arabic, Spanish | Q1 2027 |

### i18n Architecture

- All UI strings externalized to JSON files
- ICU message format for pluralization and gender
- RTL support ready in CSS (not enabled until Arabic added)

---

## 9. Data Retention

| Data Type | Active | Archive | Delete |
|---|---|---|---|
| Contracts | Until 1 year after termination/expiry | 7 years after archive | After retention period |
| Renewals | Until 1 year after completion | 7 years after completion | With parent contract |
| Users | Until account deactivation | 3 years | After retention period |
| Audit logs | 90 days | 7 years | After retention period |
| Events | 90 days in hot storage | 3 years in cold storage | After retention period |
| Documents | Until contract archived | With contract archive | With contract deletion |
| Sessions | Until logout/expiry | 30 days | After retention period |

---

## 10. Compliance

| Requirement | Standard | Scope |
|---|---|---|
| Data privacy | GDPR, CCPA (future) | User data, PII |
| Financial records | SOX (future) | Contracts, POs, Invoices |
| Security | SOC 2 Type II (future) | All systems |
| Accessibility | WCAG 2.1 AA | All user-facing UI |
| Document retention | Legal hold per contract | Contract documents |

---

## 11. Rate Limits

| Endpoint Group | Limit | Window | Response Header |
|---|---|---|---|
| Read endpoints | 100 req/min | Per user | `X-RateLimit-Remaining` |
| Write endpoints | 30 req/min | Per user | `X-RateLimit-Remaining` |
| State transitions | 10 req/min | Per user | `X-RateLimit-Remaining` |
| Dashboard | 10 req/min | Per user | `X-RateLimit-Remaining` |
| Upload | 10 req/min | Per user | `X-RateLimit-Remaining` |
| Auth (login) | 5 req/min | Per IP | `X-RateLimit-Remaining` |
| API keys | 1000 req/min | Per key | `X-RateLimit-Remaining` |

### Rate Limit Response

When exceeded:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Retry after 30 seconds.",
    "retry_after_seconds": 30
  }
}
```
Headers: `429 Too Many Requests`, `Retry-After: 30`

---

## 12. Error Budget

| Month | Budget (errors) | Spend |
|---|---|---|
| 99.9% availability = 0.1% error budget | 43m of downtime | Tracked monthly |

- Error budget consumed by: 5xx errors, critical alerts, failed health checks
- If budget exhausted: freeze all feature deployments, focus on reliability
- Budget resets monthly

---

## 13. NFR Verification Per Sprint

Every sprint must verify these NFRs before shipping:

| Check | Tool | Threshold | Blocking? |
|---|---|---|---|
| API p95 latency | k6 or locust | <500ms write, <200ms read | Yes |
| Load test (100 concurrent) | k6 or locust | All endpoints pass | Yes |
| No new vulnerabilities | SAST scan (bandit/semgrep) | Zero critical/high | Yes |
| Auth coverage | Automated test | All endpoints require auth | Yes |
| SQL injection check | DAST scan | Zero findings | Yes |
| Rate limiting works | Automated test | Returns 429 correctly | No (warn) |
| Accessible | Axe/lighthouse | WCAG AA | No (warn) |
| Logs structured JSON | Integration test | All log lines parseable | Yes |
| Correlation ID propagation | Trace test | Present across all spans | Yes |
