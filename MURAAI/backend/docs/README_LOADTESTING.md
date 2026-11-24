# Load Testing Guide — Muraai Contract Reminder API

This directory documents how to execute benchmark and concurrency load tests against the Muraai backend using [Locust](https://locust.io/).

---

## 1. Prerequisites

Ensure dependencies are installed in your Python environment:

```bash
pip install -r requirements.txt
```

Verify Locust installation:
```bash
locust -V
```

---

## 2. Running Load Tests

### Mode A: Headless CLI (Automated / CI/CD)

Run a 30-second load test with 10 concurrent users ramping up at 2 users/sec:

```bash
cd MURAAI/backend
locust -f locustfile.py --headless -u 10 -r 2 -t 30s --host=http://localhost:5000
```

#### Output Metrics to Expect:
- **RPS (Requests Per Second)**: Total throughput across endpoints
- **50th / 95th / 99th Percentile Response Time (ms)**
- **Failure Rate (%)**

---

### Mode B: Interactive Web UI (Browser Dashboard)

Launch the Locust web controller:

```bash
cd MURAAI/backend
locust -f locustfile.py --host=http://localhost:5000
```

1. Open your browser at `http://localhost:8089`
2. Set **Number of users** (e.g. `50`) and **Spawn rate** (e.g. `5`)
3. Click **Start swarming** to monitor real-time charts for Response Times, RPS, and Error Rates.

---

## 3. Key Scenarios Tested

| User Class | Weight | Scenario Tested | Key Target Endpoints |
|---|---|---|---|
| `ContractManagerUser` | **4** | Authenticated admin/manager listing paginated contracts, invoices, search, and dashboard aggregations. | `/api/dashboard/data`<br>`/api/contracts`<br>`/api/invoices`<br>`/api/search` |
| `PortalCustomerUser` | **1** | External customer logging in and viewing portal contracts/invoices. | `/api/portal/auth/login`<br>`/api/portal/dashboard`<br>`/api/portal/contracts` |

---

## 4. Performance Goals & Benchmarks

| Metric | Target Goal | Optimization Used |
|---|---|---|
| `/api/dashboard/data` (cached) | **< 50ms** | `Flask-Caching` (Redis / SimpleCache) |
| `/api/contracts` (paginated) | **< 100ms** | Database indexes on `(customer_id, created_at, status)` |
| Total Error Rate | **< 0.1%** | Connection pooling & rate-limit handling |
