# Atlas Integration Architecture

**Volume:** 13
**Status:** Draft
**Date:** 2026-07-20
**Purpose:** Define how Atlas connects to external systems — inbound, outbound, and the connector framework that makes integrations predictable and maintainable.

---

## 1. Architecture Principle

Every integration follows the same pattern:

```
External System <──> Connector <──> Adapter <──> Canonical Event
                                              └──> Canonical Command
```

- **Connector** — protocol-specific transport (HTTP, gRPC, SFTP, GraphQL)
- **Adapter** — maps external format to Atlas canonical format
- **Canonical Event/Command** — the domain event or command that Atlas understands internally

New integrations never require changes to the domain model. Only a new adapter.

---

## 2. Integration Categories

```
Integrations
├── INBOUND  — External systems trigger Atlas behavior
│     ├── Webhooks (vendor portals, payment gateways)
│     ├── Email (quote requests, PO acknowledgments)
│     ├── API calls (ERP pushing contract data)
│     └── File drops (SFTP, CSV imports)
│
├── OUTBOUND — Atlas triggers behavior in external systems
│     ├── Email (notifications, PO delivery)
│     ├── Document storage (OneDrive, SharePoint, S3, GDrive)
│     ├── Calendar (Outlook, Google Calendar)
│     ├── Chat (Slack, Teams)
│     └── ERP (SAP, Oracle, Dynamics)
│
├── SYNC    — Bidirectional synchronization
│     ├── Contract data with CLM systems
│     ├── Vendor data with procurement systems
│     └── Invoice data with accounting systems
│
└── PORTAL  — Customer/vendor collaboration (Phase 3.5)
      ├── Document sharing
      ├── Quote submission
      └── PO acknowledgment
```

---

## 3. Connector Framework

### Connector Interface

```python
class Connector(ABC):
    """Base class for all connectors."""

    @abstractmethod
    def connect(self) -> bool:
        """Establish connection to external system. Returns True if successful."""

    @abstractmethod
    def disconnect(self):
        """Close the connection gracefully."""

    @abstractmethod
    def health_check(self) -> HealthStatus:
        """Check if the external system is reachable."""

class InboundConnector(Connector, ABC):
    @abstractmethod
    def listen(self, handler: Callable[[RawMessage], CanonicalEvent]):
        """Start listening for incoming messages."""

    @abstractmethod
    def acknowledge(self, message_id: str):
        """Acknowledge successful processing."""

    @abstractmethod
    def reject(self, message_id: str, reason: str):
        """Reject a message (moves to DLQ)."""

class OutboundConnector(Connector, ABC):
    @abstractmethod
    def send(self, message: OutboundMessage) -> DeliveryResult:
        """Send a message to the external system."""

    @abstractmethod
    def send_batch(self, messages: List[OutboundMessage]) -> List[DeliveryResult]:
        """Send multiple messages efficiently."""

class SyncConnector(Connector, ABC):
    @abstractmethod
    def pull(self, since: datetime) -> List[RawRecord]:
        """Pull records modified since given timestamp."""

    @abstractmethod
    def push(self, records: List[CanonicalRecord]) -> SyncResult:
        """Push records to external system."""

    @abstractmethod
    def resolve_conflict(self, local: CanonicalRecord, remote: CanonicalRecord) -> CanonicalRecord:
        """Resolve a conflict between local and remote versions."""
```

### Connector Registry

All connectors are registered at startup:

```python
CONNECTOR_REGISTRY = {
    "onedrive": OneDriveConnector(config),
    "sharepoint": SharePointConnector(config),
    "s3": S3Connector(config),
    "gdrive": GoogleDriveConnector(config),
    "outlook_email": OutlookEmailConnector(config),
    "smtp": SMTPConnector(config),
    "slack": SlackConnector(config),
    "teams": TeamsConnector(config),
    "webhook": WebhookConnector(config),
    "sftp": SFTPConnector(config),
}
```

### Adapter Pattern

Adapters transform external formats to Atlas canonical events:

```python
class SAPContractAdapter(Adapter):
    """Maps SAP contract records to Atlas canonical events."""

    input_format: str = "SAP_IDOC"
    output_event: str = "contract.drafted"

    def transform(self, raw: RawMessage) -> CanonicalEvent:
        sap_data = raw.payload
        return CanonicalEvent(
            event_type="contract.drafted",
            aggregate_id=self.generate_id(sap_data["contract_id"]),
            payload={
                "contract_name": sap_data["description"],
                "vendor_id": self.map_vendor(sap_data["vendor_code"]),
                "start_date": parse_sap_date(sap_data["valid_from"]),
                "end_date": parse_sap_date(sap_data["valid_to"]),
                "total_contract_value": Decimal(sap_data["amount"]),
                "currency": sap_data["currency"],
            }
        )
```

---

## 4. Authentication & Credential Management

### Supported Auth Methods

| Method | Used For | Credential Storage |
|---|---|---|
| OAuth 2.0 Client Credentials | Microsoft Graph, Google APIs | Vault (rotated every 90d) |
| OAuth 2.0 Authorization Code | User-delegated access (OneDrive) | Vault + refresh token |
| API Key | Webhook providers, simple APIs | Vault (encrypted at rest) |
| Basic Auth | Legacy systems, SFTP | Vault (encrypted at rest) |
| Certificate | SAP, enterprise systems | HSM or Vault PKI |
| No Auth | Public webhook receivers | N/A |

### Credential Management

- All secrets stored in **HashiCorp Vault** (or equivalent)
- Never in environment variables, config files, or code
- Auto-rotation for OAuth tokens (before expiry)
- Audit log for every credential access
- Credential health check: daily verification that tokens are still valid

---

## 5. Retry & Resilience

### Outbound Retry Policy

| Attempt | Delay | Backoff |
|---|---|---|
| 1 | 0s | Immediate |
| 2 | 5s | Fixed |
| 3 | 30s | Fixed |
| 4 | 5m | Exponential |
| 5 | 30m | Exponential |
| 6+ | 2h, 6h, 24h | Exponential (cap at 24h) |

### Circuit Breaker

| State | Condition | Behavior |
|---|---|---|
| Closed | Normal operation | Requests pass through |
| Open | 5 consecutive failures | All requests fail fast (no attempt) |
| Half-Open | After 30s in Open | Single test request passes through |

- Circuit breaker per connector endpoint
- Half-open success → Closed. Half-open failure → Open (reset timer).

### Dead Letter Queue

When all retries are exhausted:

```json
{
  "dlq_entry": {
    "id": "dlq-abc123",
    "original_message_id": "msg-456",
    "connector": "outlook_email",
    "target": "vendor@example.com",
    "event_type": "renewal.po.sent",
    "payload": { "...": "..." },
    "failures": [
      {"attempt": 1, "error": "Connection timeout", "timestamp": "..."},
      {"attempt": 2, "error": "Connection timeout", "timestamp": "..."},
      {"attempt": 3, "error": "Connection timeout", "timestamp": "..."},
      {"attempt": 4, "error": "Connection timeout", "timestamp": "..."},
      {"attempt": 5, "error": "Connection timeout", "timestamp": "..."},
      {"attempt": 6, "error": "Connection timeout", "timestamp": "..."}
    ],
    "status": "failed",
    "failed_at": "2026-07-20T14:30:00Z"
  }
}
```

DLQ Management:
- Web UI for viewing, re-queueing, or discarding DLQ entries
- Alert when DLQ exceeds 100 entries
- Auto-retry from DLQ every 24 hours
- Max lifetime in DLQ: 7 days (auto-discard after)

---

## 6. Webhook System (Inbound)

### Webhook Registration

External systems register webhooks through an API:

```
POST /api/integrations/webhooks
{
  "name": "Vendor Portal Order Confirmation",
  "url": "https://vendor.example.com/webhooks/order-confirmed",
  "events": ["po.acknowledged", "invoice.payment.done"],
  "secret": "whsec_...",
  "retry_config": {
    "max_attempts": 5,
    "backoff_seconds": [0, 10, 60, 300, 3600]
  },
  "headers": {
    "X-Custom-Header": "value"
  }
}
```

### Webhook Delivery

```
Event → OutboundWebhookConnector
         ├── Look up registered webhooks for event_type
         ├── Sign payload with HMAC-SHA256 (webhook secret)
         ├── POST to webhook URL
         ├── Expect 2xx response within 10s
         ├── On failure: retry per config, then DLQ
         └── Log delivery attempt
```

### Webhook Payload

```json
{
  "event_id": "evt_abc123",
  "event_type": "po.acknowledged",
  "timestamp": "2026-07-20T14:30:00Z",
  "data": {
    "po_id": 42,
    "po_number": "PO-2026-001",
    "renewal_id": 7,
    "contract_id": 15,
    "vendor_id": 3,
    "acknowledged_at": "2026-07-20T14:30:00Z"
  }
}
```

Headers:
- `X-Atlas-Signature`: HMAC-SHA256 signature (hex)
- `X-Atlas-Event-Type`: event type for routing
- `X-Atlas-Delivery-Id`: unique delivery identifier (idempotency)

---

## 7. Inbound Integration Examples

### Example 1: Email → Renewal Quote

```
Vendor sends email with quote → Inbound Email Connector
  ├── Parse email (subject, body, attachment)
  ├── Identify contract/renewal via subject regex
  ├── Extract quote amount from body/attachment
  ├── Adapter maps to canonical event: renewal.quote.received
  └── Event bus delivers to Renewal Aggregate
```

### Example 2: SAP → Contract Creation

```
SAP sends IDOC → SFTP Connector picks up file
  ├── Parse IDOC XML
  ├── SAPContractAdapter maps fields
  ├── Dedup check (by SAP contract_id)
  ├── Emit contract.drafted
  └── Manual review required before activation
```

### Example 3: Vendor Portal → PO Acknowledgment

```
Vendor clicks "Acknowledge" in portal → Inbound Webhook
  ├── Verify HMAC signature
  ├── Identify PO
  ├── Adapter maps to canonical event: po.acknowledged
  └── Event bus delivers to PO Aggregate
```

---

## 8. Outbound Integration Examples

### Example 1: Notification → Email

```
Policy emits notification → Outbound Email Connector
  ├── Template engine renders email (HTML+text)
  ├── Resend/SendGrid API call
  ├── Log delivery result
  ├── On success: record notification.sent
  └── On failure: retry → DLQ
```

### Example 2: Document → OneDrive/SharePoint

```
Contract document uploaded → Outbound Storage Connector
  ├── Determine provider (OneDrive, SharePoint, S3, GDrive)
  ├── Upload file with metadata
  ├── Store provider reference in document record
  └── On failure: fallback to secondary provider
```

### Example 3: Renewal Event → Slack/Teams

```
Renewal requires attention → Outbound Chat Connector
  ├── Format message for platform (blocks for Slack, cards for Teams)
  ├── Send to configured channel
  └── Log delivery
```

---

## 9. Sync Integration Examples

### Example 1: Bidirectional Contract Sync with CLM

```
CLM Sync Connector (runs every 15 minutes)
  ├── PULL: Get contracts modified since last sync
  │     ├── Map CLM fields → Atlas fields
  │     ├── Conflict detection (last_modified_at comparison)
  │     └── Apply changes to Atlas (or flag for review)
  ├── PUSH: Get Atlas contracts modified since last sync
  │     ├── Map Atlas fields → CLM fields
  │     └── Send to CLM API
  └── LOG: Sync result (records pulled, pushed, conflicted)
```

---

## 10. Integration Health Dashboard

```
Integration Health (Grafana)
├── Connector Status (table)
│     ├── Name, Connected, Last Success, Last Failure, Error Rate
│     └── Color: green/red per connector
├── Webhook Delivery Rate (line chart, 24h)
│     ├── Attempted, Delivered, Failed
│     └── Per webhook endpoint
├── DLQ Count (gauge)
│     └── Red if > 100
├── Retry Queue Depth (gauge)
│     └── Per connector
├── Sync Lag (gauge)
│     └── Per sync integration (minutes since last successful sync)
└── Email Send Rate (line chart, 24h)
      ├── Sent, Delivered, Bounced, Failed
      └── Per email provider
```

---

## 11. Integration Testing

### Test Matrix

| Test Type | What | Frequency |
|---|---|---|
| Unit | Adapter transformation logic | CI (every commit) |
| Integration | Connector connection + message exchange | CI (daily) |
| Contract | API contract conformance | CI (every PR) |
| Chaos | Network failure, timeout, auth expiry | Weekly |
| Load | Throughput test per connector | Monthly |

### Mock External Systems

- WireMock for HTTP integrations
- In-memory SMTP server for email
- MinIO for S3-compatible storage
- Local SFTP server for file-based integrations
- Test OAuth provider for auth flows

---

## 12. Integration Roadmap

| Phase | Integration | Sprint | Status |
|---|---|---|---|
| 1 | SMTP Email (Resend/SendGrid) | Current | Existing |
| 2 | Document Storage (local filesystem) | Current | Existing |
| 3 | Microsoft Graph (OneDrive, Outlook, Teams) | Phase 2 | Partial |
| 4 | Webhook System (outbound) | Sprint 4 | Planned |
| 5 | SFTP Connector | Sprint 5 | Planned |
| 6 | Webhook System (inbound) | Sprint 5 | Planned |
| 7 | SAP Connector | Sprint 6 | Planned |
| 8 | Google Workspace (GDrive, GCal) | Sprint 6 | Planned |
| 9 | Slack Connector | Sprint 7 | Planned |
| 10 | Oracle/Dynamics ERP | Sprint 8 | Planned |
| 11 | Salesforce CRM | Sprint 8 | Planned |
| 12 | External Collaboration Portal | Phase 3.5 | Planned |
| 13 | AI Platform Integrations | Phase 4 | Planned |

---

## 13. Event Catalog as Integration Contract

The Event Catalog (`docs/03-domain-model/event-catalog.md`) serves as the integration contract:

- **Inbound adapters** map external payloads to canonical events
- **Outbound adapters** map canonical events to external payloads
- **Webhook subscriptions** are registered per event type
- **Sync integrations** use events as the change data capture mechanism

New integrations never require domain changes — only a new adapter that produces or consumes canonical events.
