# Muraai Product Vision

## Vision

To be the central nervous system for enterprise software maintenance contract operations — the single source of truth where Vendors, Customers, Procurement, Legal, Finance, and Operations converge to orchestrate every renewal lifecycle from quotation to cash.

## Mission

Eliminate renewal leakage by providing enterprises with a unified, intelligent, and auditable platform for software maintenance contract lifecycle management — from vendor quote to PO to invoice to license delivery — with every handoff tracked, every dollar accounted for, and every deadline anticipated.

## Core Value Proposition

| Problem | Muraai Solution |
|---|---|
| Renewals managed in spreadsheets, lost emails, and tribal knowledge | Centralized digital twin of every maintenance contract with full lifecycle state machine |
| No audit trail for who approved what, when, and why | Immutable activity log with entity-level change tracking |
| License count drift — paying for seats nobody uses | License reconciliation workflows with usage attestation gates |
| Finance blindsided by unexpected renewal invoices | PO-to-invoice matching with budget pre-validation before commitment |
| Legal cannot enforce standard terms across vendors | Clause library + approval workflow templates per contract type |
| Procurement lacks leverage — no centralized vendor view | Vendor performance scorecards + aggregated renewal book for negotiation |
| Inability to predict renewal cash outflow | Forecast engine with confidence intervals based on committed PO amounts and historical trends |

## Elevator Pitch

> "Muraai ensures that every software maintenance renewal is identified, reviewed, approved, purchased, and paid for — on time, within budget, and with full audit trail. No more surprise invoices. No more missed deadlines. No more auto-renewals that nobody authorized."

## Business Goals

| ID | Goal | Target | Enterprise Rationale |
|---|---|---|---|
| G1 | Reduce renewal leakage | ≥99% capture rate | Every missed renewal is a compliance and operational risk |
| G2 | Reduce renewal cycle time | ≤30 days P95 | Faster cycles reduce overlap and emergency processing |
| G3 | Achieve 100% PO-Invoice reconciliation | Zero unmatched invoices | Financial control and audit compliance |
| G4 | Centralize vendor relationship data | Single source of truth | Procurement leverage and negotiation power |
| G5 | Enable real-time renewal forecasting | ±5% accuracy 90-day | Predictable cash flow for Finance |
| G6 | Reduce manual touch rate | ≤2 touches per renewal | Automation ROI and scalability |
| G7 | Meet approval SLAs | ≥98% compliance | Stakeholder accountability |

## Competitive Advantages

| Advantage | How Muraai Delivers It | Competitor Gap |
|---|---|---|
| Unified Renewal State Machine | Deterministic lifecycle from identification to payment | Competitors treat renewals as calendar events |
| PO-Invoice Reconciliation as Core Feature | Bidirectional linking of renewal → PO → invoice | Competitors stop at "send reminder" |
| Vendor-Neutral Portfolio View | Group renewals by vendor, category, BU, region | Competitors are contract-centric, not relationship-centric |
| License Reconciliation Gate | Usage attestation required before renewal advances | No competitor ties renewal to usage data |
| Clause-Level Approvals | Legal approves at clause level, not document level | Competitors offer binary approval only |
| Forecast Engine | Predict cash outflow with adjustable confidence | Competitors provide only a renewal date calendar |
| Immutable Audit Trail | Every action logged for SOX/SOC2 readiness | Most have basic or no audit logging |
| ERP-Agnostic Integration | REST-first with webhook-based sync | Fixed or no integrations |

## Success Metrics

### Operational (Leading Indicators)

| Metric | Target | Why |
|---|---|---|
| Renewal Capture Rate | ≥99% | Below 99% means leakage |
| Renewal On-Time Rate | ≥95% | Measures process velocity |
| Days in Renewal Cycle (P95) | ≤30 days | Measures process efficiency |
| Manual Touch Rate | ≤2 touches per renewal | Lower = more automation |
| Approval SLA Compliance | ≥98% | Measures workflow health |

### Financial (Lagging Indicators)

| Metric | Target | Why |
|---|---|---|
| Renewal Leakage Rate | ≤2% | Value lost to inaction or auto-renewal |
| Invoice Exception Rate | ≤3% | Quote-to-PO accuracy |
| Forecast Accuracy (90-day) | ±5% | Cash flow predictability |
| Avg Cost Per Renewal | -40% YoY | Automation ROI |

### Experience (Qualitative)

| Metric | Collection Method | Target |
|---|---|---|
| NPS (Renewals Ops Managers) | Quarterly survey | ≥50 |
| Time-to-Proficiency | In-app analytics | ≤2 hours |
| Core Workflow Adoption | Product analytics | ≥80% weekly active |
| Support Ticket Volume | Support system | ≤0.1 tickets/user/month |

## Non-Goals

| Non-Goal | Rationale |
|---|---|
| Contract drafting or redlining | Use Icertis, Agiloft, or Conga |
| Full CLM replacement | Integrate with CLMs via API |
| Payment processing | Belongs in the ERP |
| Vendor self-service portal | Vendors interact through their own channels |
| Usage metering / license management | Integrate with Flexera, ServiceNow, Snow |
| General-purpose workflow engine | Purpose-built for renewal operations |
| Mobile-first experience | Desktop primary; mobile companion later |
| Multi-language / multi-currency | Phase 2 |
| AI/ML predictions | Phase 2 — core workflow first |

## Product Principles

*See also: `00-constitution/index.md` for the full constitution.*

1. **State Over Status** — Deterministic state machines, not freeform status fields
2. **Data Has One Home** — References, not copies
3. **Every Action Is Logged** — Immutable audit trail
4. **Workflow Over Freeform** — Processes encoded, not discretionary
5. **Integrate, Don't Absorb** — API-first, ERP-agnostic
6. **Read-Optimized, Write-Constrained** — Broad read, governed write
7. **Configuration Over Customization** — Admin settings, not code
8. **Platform Adapts to Roles** — Role-specific views
9. **Graceful Degradation** — Core works without integrations
10. **Enterprise Grade by Default** — Security from day one
