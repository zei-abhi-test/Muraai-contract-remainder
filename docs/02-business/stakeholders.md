# Stakeholder Model

## Overview

Muraai serves 12 distinct stakeholder types across the enterprise renewal ecosystem. Every platform feature, permission, workflow state, and notification must trace back to a specific stakeholder's responsibility, goal, or pain point.

## Stakeholder Reference

| ID | Stakeholder | Primary Role | Engagement Frequency |
|---|---|---|---|
| S1 | Renewal Operations Manager | Central orchestrator | Daily |
| S2 | Procurement Specialist | Action executor | Daily |
| S3 | Financial Analyst (AP) | Reconciliation guardian | Daily |
| S4 | Legal Counsel | Terms guardian | Weekly / per renewal |
| S5 | Business Owner (Budget Holder) | Economic decision-maker | Per renewal cycle |
| S6 | Vendor Relationship Manager | Strategic negotiator | Weekly |
| S7 | CTO / CIO | Governance owner | Monthly / quarterly |
| S8 | CFO / Finance Director | Fiscal authority | Monthly / quarterly |
| S9 | Internal Audit / Compliance | Independent validator | Per audit cycle |
| S10 | System Administrator | Platform steward | Weekly |
| S11 | Vendor (External) | Counterparty | Per renewal (mediated) |
| S12 | External Auditor / Regulator | Compliance validator | Per audit cycle |

## Detailed Stakeholder Definitions

### S1: Renewal Operations Manager

| Dimension | Detail |
|---|---|
| **Responsibilities** | Own renewal process end-to-end. Monitor pipeline (30/60/90-day windows). Assign renewals to specialists. Track approval bottlenecks. Escalate stalled renewals. Ensure every renewal reaches a decision before end date. Generate status reports. |
| **Goals** | Zero missed renewals. Predictable pipeline. All stakeholders accountable with visible SLAs. Reduce status-chasing to near zero. |
| **Pain Points** | Renewals scattered across inboxes/calendars. No single pipeline view. 60% of time spent on status-chasing. Cannot prove every renewal was handled. Manual handoffs create black holes. No early warning for at-risk renewals. |
| **Permissions** | Full read on all renewals, contracts, vendors, products, POs, invoices. Write on assignment, priority, tags, notes, escalation. Trigger state transitions (escalate, hold, cancel). Cannot approve POs or invoices. Admin on workflow configuration within BU scope. |
| **KPIs** | Renewal capture rate (≥99%), on-time rate (≥95%), avg days in cycle, SLA breach count, manual touch rate, queue aging (P95). |
| **Decision Authority** | Full authority over assignment, priority, escalation. Cannot approve financial commitments. Can recommend renewal decision. |

### S2: Procurement Specialist

| Dimension | Detail |
|---|---|
| **Responsibilities** | Receive assigned renewals. Collect vendor quotes. Validate pricing. Verify budget. Route approvals. Create and send POs. Track acknowledgment. Hand off to finance. |
| **Goals** | Issue POs before deadlines. Never pay more than approved amount. Maintain accurate vendor records. Complete renewals with minimum rework. |
| **Pain Points** | Re-entering data into ERP. Hunting for vendor contacts. Quotes arrive via unstructured email. Budget validation requires separate finance system. Unclear approval chains. PO rejected by vendor due to incorrect terms. |
| **Permissions** | Read on assigned renewals, vendors, products, contract history. Write on quotes, notes, PO drafts. Create POs. Read on budget (via integration). Cannot approve POs above threshold. Cannot modify vendor master. |
| **KPIs** | PO issuance cycle time, PO accuracy rate, quote capture rate, budget validation coverage, PO acknowledgment turnaround. |
| **Decision Authority** | Full authority to create POs up to threshold (configurable, e.g., $50K). Requires approval above threshold. Cannot approve own POs. |

### S3: Financial Analyst (AP)

| Dimension | Detail |
|---|---|
| **Responsibilities** | Receive renewal invoices. Match to POs and renewals. Resolve exceptions. Schedule payments. Reconcile actual vs. forecast. Flag unauthorized charges. |
| **Goals** | Every invoice matched and paid within terms. Zero payment without PO match. Forecast accuracy within 5%. Clean audit trail. |
| **Pain Points** | Invoices arrive as unstructured PDFs. Manual PO lookup. No visibility if renewal was approved. Invoice before PO issued. Amount mismatches with no explanation. Cannot distinguish renewal vs. separate charge. |
| **Permissions** | Full read on invoices, POs, renewals, contracts (financial fields). Write on invoice matching status, exception notes, payment scheduling. Cannot modify POs. Cannot approve renewals. |
| **KPIs** | Invoice match rate (100%), exception resolution time P95, payment within terms %, forecast accuracy %. |
| **Decision Authority** | Match invoice to PO when amounts match within tolerance (±2%). Place invoice on hold for mismatches. Escalate for PO amendment or credit note. Cannot approve payment without PO match. |

### S4: Legal Counsel

| Dimension | Detail |
|---|---|
| **Responsibilities** | Review vendor renewal terms against standard clause library. Approve or redline non-standard terms. Log clause-level approvals. Maintain clause templates. Define approval policies by type/value/vendor. |
| **Goals** | Every renewal reviewed for legal risk. Zero renewals with unacceptable terms. Clause library current. Approval decisions documented. |
| **Pain Points** | Terms arrive as PDF — no structured comparison. Cannot see what changed from prior year. Standard terms on shared drive — version unknown. No pipeline visibility — legal is last to know. Binary approval with no clause granularity. |
| **Permissions** | Full read on renewal terms, current contract, prior terms, clause library. Write on legal approval status, clause-level decisions, amendment notes. Cannot modify financial fields. Admin on clause library and policies. |
| **KPIs** | Review cycle time, clause deviation capture rate, SLA compliance, amendment accuracy rate. |
| **Decision Authority** | Full authority to approve standard terms. Full authority to reject non-standard. Can propose amendments. Escalate to General Counsel for material deviations. |

### S5: Business Owner

| Dimension | Detail |
|---|---|
| **Responsibilities** | Review renewal recommendation. Confirm business need and budget. Approve or reject spend. Provide usage attestation. Identify scope changes. |
| **Goals** | Only renew what is used and needed. Right-size spend. No surprise renewals. Informed decisions with data. |
| **Pain Points** | Renewal arrives as surprise. No visibility into usage or value. Cannot compare pricing across products. Approval requested with insufficient context. No time to evaluate alternatives. |
| **Permissions** | Read on renewals requiring their approval, related contracts, usage data, spend history. Write on approval decision, usage attestation, budget allocation. Cannot create POs. Cannot modify vendor records. |
| **KPIs** | Approval response time (≤48 hrs), right-sizing rate, budget adherence, attestation completion rate. |
| **Decision Authority** | Full authority to approve/reject within department budget. Full authority to reduce scope. Requires CFO for above-budget or above-threshold renewals. |

### S6: Vendor Relationship Manager

| Dimension | Detail |
|---|---|
| **Responsibilities** | Maintain vendor master. Track vendor performance. Lead negotiations for strategic vendors. Analyze portfolio for consolidation. Manage relationship health. |
| **Goals** | Optimize vendor portfolio. Negotiate enterprise-wide pricing. Consolidate where beneficial. Eliminate underperformers. |
| **Pain Points** | Vendor data scattered across systems. No single view of total spend per vendor. Pricing trends invisible. Performance subjective. Renewal negotiations in isolation. |
| **Permissions** | Full read on vendor master, all vendor contracts, POs, invoices, renewal history. Write on vendor master (address, contacts, risk rating). Cannot approve individual renewals. Cannot create POs. Admin on scorecard configuration. |
| **KPIs** | Consolidation rate, avg discount improvement YoY, SLA compliance rate, risk score coverage, negotiation cycle time. |
| **Decision Authority** | Full authority to negotiate within policy. Recommend vendor selection. Cannot unilaterally approve renewals. Escalate to Procurement Director for exceptions. |

### S7: CTO / CIO

| Dimension | Detail |
|---|---|
| **Responsibilities** | Define renewal policy and governance. Approve portfolio strategy. Review executive dashboard. Approve policy exceptions. Sponsor platform adoption. |
| **Goals** | Fully governed technology portfolio. Predictable IT spend. Risk-managed vendor relationships. Clean audit trail. |
| **Pain Points** | Cannot answer "what is total software maintenance spend?" Discovered missed renewals after license lapsed. Cannot prove governance to auditors. |
| **Permissions** | Full read on all platform data. Cannot create/modify transactional records. Write on policy configuration, approval thresholds, governance rules. Admin on RBAC. Audit access. |
| **KPIs** | Governance coverage, policy compliance rate, audit findings (target zero), portfolio optimization, renewal spend as % of IT budget. |
| **Decision Authority** | Full authority over renewal policy. Requires Board/CFO for total above plan. Can override policy for exceptions (rare, audited). Delegates operational authority to S1 and S2. |

### S8: CFO / Finance Director

| Dimension | Detail |
|---|---|
| **Responsibilities** | Approve total renewal budget. Review forecast vs. actual. Approve above-threshold renewals. Set financial approval thresholds. Ensure SOX compliance. |
| **Goals** | Predictable cash outflow. Zero unauthorized spend. Clean audit trail. Forecast accuracy within 5%. |
| **Pain Points** | Cannot predict cash outflow. Discovers invoices after payment due. No visibility into YoY spend trend. Audit requires manual data collection. |
| **Permissions** | Full read on all financial data. Write on financial approval decisions. Write on threshold configuration. Cannot create POs or match invoices. Audit access. |
| **KPIs** | Forecast accuracy, unauthorized spend incidents (zero), PO-invoice match rate, cost trend YoY, cash flow variance. |
| **Decision Authority** | Full authority on financial thresholds. Approve renewals above BU threshold. Requires Board for total above plan. |

### S9: Internal Audit / Compliance

| Dimension | Detail |
|---|---|
| **Responsibilities** | Audit renewal processes for policy compliance. Verify segregation of duties. Validate audit trail completeness. Test controls. Report findings. |
| **Goals** | Every renewal auditable and compliant. Zero material findings. Controls operate as designed. |
| **Pain Points** | Cannot reconstruct renewal history easily. Evidence scattered. Manual testing time-consuming. No real-time control visibility. |
| **Permissions** | Read-only on all platform data. Audit access to full activity log. Cannot create, modify, or approve any record. Cannot hold any transactional role. |
| **KPIs** | Finding count, control effectiveness rate, audit cycle time, evidence completeness score. |
| **Decision Authority** | No operational authority. Can recommend improvements. Can escalate to Audit Committee. |

### S10: System Administrator

| Dimension | Detail |
|---|---|
| **Responsibilities** | Configure platform settings. Manage users and roles. Monitor integration health. Manage reference data. Monitor uptime. |
| **Goals** | Platform always available. Users have correct access. Integrations error-free. Changes tracked and reversible. |
| **Pain Points** | Access change requests violating segregation of duties. Integrations failing silently. Configuration drift. No sandbox environment. |
| **Permissions** | Full admin on configuration. No transactional permissions. Read on all data for troubleshooting. Write on reference data. Cannot modify audit log. |
| **KPIs** | Platform uptime (≥99.9%), user provisioning (≤4hrs), integration uptime (≥99.5%), rollback rate (0%). |
| **Decision Authority** | Full authority over configuration within policy. Requires CAB for financial control changes. Cannot override segregation of duties. |

### S11: Vendor (External)

| Dimension | Detail |
|---|---|
| **Responsibilities** | Provide quotations. Respond to POs. Deliver licenses/support. Invoice per terms. Provide usage reports. |
| **Goals** | Get paid on time. Maintain customer relationship. Minimize administrative overhead. |
| **Pain Points** | Opaque renewal process. PO arrives late. Payment terms not honored. Multiple customer contacts. Each customer has different process. |
| **Permissions** | No platform access by design. All interactions mediated through S2 or automated integration. |
| **KPIs** | Quote response time, PO acknowledgment time, invoice accuracy rate. |

### S12: External Auditor / Regulator

| Dimension | Detail |
|---|---|
| **Responsibilities** | Verify controls are designed and operating effectively. Test sample renewals. Validate financial reporting. Assess SOX/SOC2/ISO compliance. |
| **Goals** | Sufficient audit evidence. Effective controls. No material misstatements. |
| **Pain Points** | No direct platform access. Must request evidence from S9. Manual sampling. No standard audit package. |
| **Permissions** | No direct access. Evidence provided through S9. |
| **KPIs** | Audit completion time, findings per cycle, evidence sufficiency. |

## Segregation of Duties Matrix

| Activity | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 | S10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Configure workflow rules | ✓ | | | | | | ✓ | | | ✓ |
| Assign renewal to specialist | ✓ | | | | | | | | | |
| Create vendor master | | ✓ | | | | ✓ | | | | ✓ |
| Enter vendor quote | | ✓ | | | | | | | | |
| Approve terms | | | | ✓ | | | | | | |
| Approve spend (within threshold) | | | | | ✓ | | | ✓ | | |
| Create PO | | ✓ | | | | | | | | |
| Match invoice to PO | | | ✓ | | | | | | | |
| Pay invoice | | | ✓ | | | | | | | |
| Modify audit log | | | | | | | | | | |
| Configure roles/permissions | | | | | | | | | | ✓ |
| Delete records | | | | | | | | | | ✓* |

✓* = with audited override procedure

## Decision Authority Matrix

| Decision | Authority | Escalation |
|---|---|---|
| Renew as-is (within budget) | S5 | — |
| Renew as-is (above budget) | S8 | Board |
| Right-size / reduce scope | S5 | — |
| Do not renew / exit | S5 + S7 | — |
| Change vendor | S6 + S2 | S7 |
| Accept non-standard terms | S4 | General Counsel |
| Override preferred vendor | S7 | Board |
| Exceed PO amount | S2 + S8 | — |
| Write off invoice discrepancy | S3 + S8 | — |
| Change platform config | S10 | CAB |
| Override segregation of duties | S7 + S9 | Audit Committee |

## Key Business Rules

1. No user can approve their own request.
2. PO cannot exceed approved renewal amount (system-enforced).
3. Invoice cannot be paid without PO match (within ±2% or $500).
4. Legal review is mandatory for renewals above configurable threshold (default $100K).
5. Usage attestation required every 12 months before renewal advances.
6. Vendor Manager cannot be sole approver for renewals they manage.
7. Audit trail is immutable — no user can modify or delete.
8. Business Owner approval is always required, even for zero-cost renewals.
9. Automatic escalation on SLA breach: 48h → manager, 72h → director, 96h → CTO/CFO.
10. No direct vendor access to Muraai.
