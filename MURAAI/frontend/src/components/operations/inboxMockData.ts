export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type Stage = 'review' | 'approval' | 'negotiation' | 'signature' | 'execution' | 'renewal' | 'completion'
export type BusinessObject = 'quote' | 'contract' | 'renewal' | 'invoice' | 'purchase_order' | 'document' | 'sla' | 'compliance'
export type Team = 'legal' | 'finance' | 'operations' | 'sales' | 'procurement' | 'compliance'
export type GroupBy = 'priority' | 'dueDate' | 'type' | 'team'

export interface QuickAction {
  label: string
  action: string
  variant?: 'primary' | 'secondary' | 'destructive'
}

export interface InboxItem {
  id: string
  priority: Priority
  type: BusinessObject
  team: Team
  title: string
  context: string
  businessObjectName: string
  businessObjectId?: number
  dueDate: string
  stage: Stage
  owner: string
  recommendedAction: string
  quickActions: QuickAction[]
  createdAt: string
}

export interface InboxStore {
  pinnedIds: string[]
  snoozedUntil: Record<string, string>
  assignments: Record<string, string>
}

function daysOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function hoursAgo(hours: number): string {
  const d = new Date()
  d.setHours(d.getHours() - hours)
  return d.toISOString()
}

function hoursFromNow(hours: number): string {
  const d = new Date()
  d.setHours(d.getHours() + hours)
  return d.toISOString().split('T')[0]
}

const owners = ['Ravi Kumar', 'Sarah Chen', 'Ananya K.', 'Priya S.', 'Legal Team', 'Mike O.', 'John D.', 'Lisa M.', 'Tom R.', 'Aisha W.']
const teams: Team[] = ['legal', 'finance', 'operations', 'sales', 'procurement', 'compliance']
const priorities: Priority[] = ['critical', 'high', 'medium', 'low']
const stages: Stage[] = ['review', 'approval', 'negotiation', 'signature', 'execution', 'renewal', 'completion']
const types: BusinessObject[] = ['quote', 'contract', 'renewal', 'invoice', 'purchase_order', 'document', 'sla', 'compliance']

const scenarios: {
  type: BusinessObject
  team: Team
  title: string
  context: string
  businessObjectName: string
  recommendedAction: string
  quickActions: QuickAction[]
  stage: Stage
  priority: Priority
  overdueWindow: [number, number]
}[] = [
  {
    type: 'quote', team: 'sales', priority: 'high', stage: 'approval',
    title: 'Vendor quote QTE-2024-112 overdue — review updated pricing from Apex Logistics',
    context: 'Quote expired 3 days ago. Vendor revised pricing upward by 12%. Requires re-approval before PO can be issued.',
    businessObjectName: 'QTE-2024-112 — Apex Logistics',
    recommendedAction: 'Compare revised pricing against budget and approve or request renegotiation.',
    quickActions: [
      { label: 'Review Quote', action: 'review', variant: 'primary' },
      { label: 'Request Revision', action: 'revise', variant: 'secondary' },
    ],
    overdueWindow: [-5, -1],
  },
  {
    type: 'contract', team: 'legal', priority: 'critical', stage: 'review',
    title: 'Contract EXP-2024-089 expires in 14 days — begin renewal with Zenith Corp',
    context: 'Master Services Agreement with Zenith Corp expires Aug 15. Current T&amp;C auto-renew unless notice is given within 14 days.',
    businessObjectName: 'Zenith Corp — MSA-2022-089',
    recommendedAction: 'Review current contract terms and initiate renewal negotiation with the counterparty.',
    quickActions: [
      { label: 'Review Contract', action: 'review', variant: 'primary' },
      { label: 'Initiate Renewal', action: 'renew', variant: 'secondary' },
    ],
    overdueWindow: [7, 14],
  },
  {
    type: 'renewal', team: 'operations', priority: 'critical', stage: 'approval',
    title: 'Renewal RNW-2024-032 for CloudServe awaiting executive approval',
    context: 'CloudServe enterprise agreement renewal ($240k ARR) has been submitted. VP Sales approval pending for 4 days.',
    businessObjectName: 'RNW-2024-032 — CloudServe Enterprise',
    recommendedAction: 'Review renewal terms and approve or return with comments.',
    quickActions: [
      { label: 'Approve Renewal', action: 'approve', variant: 'primary' },
      { label: 'View Details', action: 'view', variant: 'secondary' },
    ],
    overdueWindow: [-2, 2],
  },
  {
    type: 'invoice', team: 'finance', priority: 'critical', stage: 'execution',
    title: 'Invoice INV-2024-423 rejected by customer — resolve dispute',
    context: 'Customer rejected invoice citing quantity discrepancy (billed 500 units, received 480). Credit note or correction required.',
    businessObjectName: 'INV-2024-423 — Delta Manufacturing',
    recommendedAction: 'Verify delivery records and issue credit note or corrected invoice.',
    quickActions: [
      { label: 'Investigate', action: 'investigate', variant: 'primary' },
      { label: 'Issue Credit', action: 'credit', variant: 'secondary' },
    ],
    overdueWindow: [-3, 0],
  },
  {
    type: 'purchase_order', team: 'procurement', priority: 'high', stage: 'approval',
    title: 'Purchase Order PO-2024-088 missing vendor approval signature',
    context: 'PO for $58k IT hardware has been approved internally but vendor has not countersigned. Follow-up required.',
    businessObjectName: 'PO-2024-088 — TechPartners Inc.',
    recommendedAction: 'Contact vendor to obtain countersignature or escalate to vendor relationship manager.',
    quickActions: [
      { label: 'Follow Up', action: 'followup', variant: 'primary' },
      { label: 'Resend PO', action: 'resend', variant: 'secondary' },
    ],
    overdueWindow: [-2, 3],
  },
  {
    type: 'document', team: 'operations', priority: 'medium', stage: 'review',
    title: 'Customer uploaded unsigned SOW for review — ProServe engagement',
    context: 'Statement of Work uploaded by client contact 2 days ago. Needs internal review before countersigning.',
    businessObjectName: 'SOW-ProServe-2024 — NorthWind Solutions',
    recommendedAction: 'Review uploaded SOW for scope alignment and approve for countersignature.',
    quickActions: [
      { label: 'Review Document', action: 'review', variant: 'primary' },
      { label: 'Request Changes', action: 'revise', variant: 'secondary' },
    ],
    overdueWindow: [1, 5],
  },
  {
    type: 'sla', team: 'operations', priority: 'critical', stage: 'execution',
    title: 'SLA BREACH — Response time exceeded for PremierCorp support ticket',
    context: 'Ticket #T-88421 breached 4-hour response SLA by 2h17m. Penalty clause may apply if not resolved within 24h.',
    businessObjectName: 'PremierCorp — Support Agreement #SA-2023-045',
    recommendedAction: 'Assign senior engineer to resolve ticket and prepare SLA breach report.',
    quickActions: [
      { label: 'Assign Engineer', action: 'assign', variant: 'primary' },
      { label: 'Generate Report', action: 'report', variant: 'secondary' },
    ],
    overdueWindow: [-1, 0],
  },
  {
    type: 'compliance', team: 'compliance', priority: 'high', stage: 'review',
    title: 'Compliance review required — SOC 2 Type II report due in 45 days',
    context: 'Annual SOC 2 audit scheduled. Evidence collection phase begins next week. 35 controls need documentation.',
    businessObjectName: 'SOC 2 Type II — Fiscal Year 2025',
    recommendedAction: 'Assign control owners and begin evidence collection for the 35 in-scope controls.',
    quickActions: [
      { label: 'Start Review', action: 'review', variant: 'primary' },
      { label: 'View Controls', action: 'view', variant: 'secondary' },
    ],
    overdueWindow: [10, 30],
  },
  {
    type: 'quote', team: 'sales', priority: 'low', stage: 'completion',
    title: 'Follow up on draft quote QTE-2024-091 sent to GreenBuild 2 weeks ago',
    context: 'Quote for sustainable materials package ($34k) sent 14 days ago. No response from prospect.',
    businessObjectName: 'QTE-2024-091 — GreenBuild Construction',
    recommendedAction: 'Send follow-up email or call prospect to gauge interest level.',
    quickActions: [
      { label: 'Send Reminder', action: 'remind', variant: 'secondary' },
    ],
    overdueWindow: [10, 20],
  },
  {
    type: 'contract', team: 'legal', priority: 'high', stage: 'negotiation',
    title: 'Negotiate liability cap with SafeGuard Insurance for new MSA',
    context: 'SafeGuard requesting liability cap reduction from $5M to $2M. Current proposal at $3.5M — legal review needed.',
    businessObjectName: 'SafeGuard Insurance — MSA Draft v4',
    recommendedAction: 'Review risk profile and determine acceptable liability cap range for negotiation.',
    quickActions: [
      { label: 'Review Terms', action: 'review', variant: 'primary' },
      { label: 'Counter Offer', action: 'counter', variant: 'secondary' },
    ],
    overdueWindow: [3, 8],
  },
  {
    type: 'renewal', team: 'sales', priority: 'high', stage: 'renewal',
    title: 'Annual support renewal for DataVault — schedule QBR before renewing',
    context: 'DataVault renews Aug 31 ($120k). QBR not yet scheduled. Quarterly review is prerequisite for renewal approval.',
    businessObjectName: 'DataVault Systems — Support Contract',
    recommendedAction: 'Schedule QBR with DataVault stakeholders before proceeding with renewal.',
    quickActions: [
      { label: 'Schedule QBR', action: 'schedule', variant: 'primary' },
      { label: 'Prepare Deck', action: 'prepare', variant: 'secondary' },
    ],
    overdueWindow: [5, 15],
  },
  {
    type: 'invoice', team: 'finance', priority: 'medium', stage: 'completion',
    title: 'Invoice INV-2024-388 past due — 35 days outstanding',
    context: 'Invoice for $12,450 to BlueLine Corp is 35 days overdue. Second reminder sent. Escalate to collections?',
    businessObjectName: 'INV-2024-388 — BlueLine Corp',
    recommendedAction: 'Send final notice or escalate to collections agency.',
    quickActions: [
      { label: 'Send Final Notice', action: 'remind', variant: 'primary' },
      { label: 'Escalate', action: 'escalate', variant: 'destructive' },
    ],
    overdueWindow: [-35, -20],
  },
  {
    type: 'purchase_order', team: 'procurement', priority: 'critical', stage: 'approval',
    title: 'PO-2024-092 emergency — production line at risk without raw materials',
    context: 'PO for raw materials ($92k) stuck in approval for 5 days. Production line runs out in 3 days.',
    businessObjectName: 'PO-2024-092 — Raw Materials Batch #4',
    recommendedAction: 'Expedite approval through procurement director or VP Operations.',
    quickActions: [
      { label: 'Approve Now', action: 'approve', variant: 'primary' },
      { label: 'Escalate', action: 'escalate', variant: 'destructive' },
    ],
    overdueWindow: [-5, -2],
  },
  {
    type: 'document', team: 'legal', priority: 'medium', stage: 'signature',
    title: 'NDA v3 signed by counterparty — countersign for Orion AI partnership',
    context: 'Orion AI has signed the Mutual NDA. All terms are as agreed. E-signature required to proceed.',
    businessObjectName: 'Mutual NDA — Orion AI (v3)',
    recommendedAction: 'Countersign the NDA document to move forward with partnership discussions.',
    quickActions: [
      { label: 'Sign Now', action: 'sign', variant: 'primary' },
    ],
    overdueWindow: [0, 3],
  },
  {
    type: 'sla', team: 'operations', priority: 'high', stage: 'execution',
    title: 'SLA warning — uptime 99.2% this month for FinServ client',
    context: 'FinServ client requires 99.9% uptime per SLA. Current month tracking at 99.2% due to 2 incidents. Breach imminent.',
    businessObjectName: 'FinServ Client — Premium Support SLA',
    recommendedAction: 'Investigate root cause of incidents and apply preventive measures immediately.',
    quickActions: [
      { label: 'Investigate', action: 'investigate', variant: 'primary' },
      { label: 'Notify Client', action: 'notify', variant: 'secondary' },
    ],
    overdueWindow: [0, 5],
  },
  {
    type: 'compliance', team: 'compliance', priority: 'critical', stage: 'review',
    title: 'GDPR data subject access request (DSAR) from European customer',
    context: 'DSAR received from EU customer requesting all personal data held. 30-day response clock started 5 days ago.',
    businessObjectName: 'DSAR-2024-017 — GDPR Request',
    recommendedAction: 'Locate and compile all personal data for the requesting customer across all systems.',
    quickActions: [
      { label: 'Process Request', action: 'process', variant: 'primary' },
      { label: 'View Deadline', action: 'view', variant: 'secondary' },
    ],
    overdueWindow: [-5, 10],
  },
  {
    type: 'quote', team: 'sales', priority: 'high', stage: 'negotiation',
    title: 'Negotiate pricing on QTE-2024-107 — enterprise license for MegaCorp',
    context: 'MegaCorp requesting 22% discount for 3-year enterprise license. Standard max discount is 18%. Requires VP approval.',
    businessObjectName: 'QTE-2024-107 — MegaCorp Enterprise',
    recommendedAction: 'Review discount request and prepare exception approval memo for VP Sales.',
    quickActions: [
      { label: 'Review Pricing', action: 'review', variant: 'primary' },
      { label: 'Submit Exception', action: 'approve', variant: 'secondary' },
    ],
    overdueWindow: [2, 7],
  },
  {
    type: 'contract', team: 'legal', priority: 'medium', stage: 'signature',
    title: 'Contract CTR-2024-215 ready for signature — CloudStack reseller',
    context: 'CloudStack reseller agreement fully negotiated and approved by both legal teams. Ready for final signature.',
    businessObjectName: 'CTR-2024-215 — CloudStack Reseller',
    recommendedAction: 'Execute final signature to activate the reseller partnership.',
    quickActions: [
      { label: 'Sign Contract', action: 'sign', variant: 'primary' },
    ],
    overdueWindow: [0, 5],
  },
  {
    type: 'renewal', team: 'operations', priority: 'medium', stage: 'review',
    title: 'Renewal RNW-2024-041 — review usage data before presenting to client',
    context: 'Client usage data for FY24 available. Needs to be packaged into renewal presentation for HealthFirst client meeting.',
    businessObjectName: 'RNW-2024-041 — HealthFirst',
    recommendedAction: 'Analyze usage trends and prepare renewal recommendation deck.',
    quickActions: [
      { label: 'Analyze Usage', action: 'review', variant: 'primary' },
    ],
    overdueWindow: [5, 12],
  },
  {
    type: 'invoice', team: 'finance', priority: 'low', stage: 'completion',
    title: 'Invoice INV-2024-265 — missing PO reference, on hold in ERP',
    context: 'Invoice from StationeryWorld ($890) lacks PO reference. AP team unable to process.',
    businessObjectName: 'INV-2024-265 — StationeryWorld',
    recommendedAction: 'Obtain PO reference from requestor or return invoice to vendor for correction.',
    quickActions: [
      { label: 'Find PO', action: 'view', variant: 'secondary' },
    ],
    overdueWindow: [5, 15],
  },
  {
    type: 'purchase_order', team: 'procurement', priority: 'medium', stage: 'negotiation',
    title: 'Negotiate pricing on PO-2024-085 — consulting services overage',
    context: 'Consulting engagement exceeded allocated hours by 40%. Vendor submitted revised SOW for $24k overage.',
    businessObjectName: 'PO-2024-085 — McKinsey Digital',
    recommendedAction: 'Negotiate blended rate for overage hours or reduce scope to stay within budget.',
    quickActions: [
      { label: 'Review Overage', action: 'review', variant: 'primary' },
      { label: 'Negotiate', action: 'negotiate', variant: 'secondary' },
    ],
    overdueWindow: [3, 10],
  },
  {
    type: 'document', team: 'compliance', priority: 'high', stage: 'execution',
    title: 'Upload evidence for SOX control testing — Q2 FY25',
    context: 'SOX control testing window closes in 2 weeks. 8 controls still missing supporting evidence.',
    businessObjectName: 'SOX Controls Q2 FY25 — ITGC Domain',
    recommendedAction: 'Collect and upload evidence artifacts for the 8 remaining controls.',
    quickActions: [
      { label: 'Upload Evidence', action: 'upload', variant: 'primary' },
      { label: 'View Controls', action: 'view', variant: 'secondary' },
    ],
    overdueWindow: [5, 14],
  },
  {
    type: 'sla', team: 'operations', priority: 'medium', stage: 'completion',
    title: 'Monthly SLA performance report — generate for exec review',
    context: 'Monthly SLA compliance report for all enterprise clients due in 5 days. Includes uptime, response time, resolution metrics.',
    businessObjectName: 'SLA Performance — Monthly Report',
    recommendedAction: 'Generate and distribute the monthly SLA performance report to leadership.',
    quickActions: [
      { label: 'Generate Report', action: 'report', variant: 'primary' },
    ],
    overdueWindow: [3, 7],
  },
  {
    type: 'compliance', team: 'legal', priority: 'high', stage: 'review',
    title: 'Review updated DPDPA policy wording for India subsidiary',
    context: 'DPDPA 2023 compliance requires updated privacy policy. Draft received from external counsel. Legal review needed.',
    businessObjectName: 'DPDPA Privacy Policy v2',
    recommendedAction: 'Review draft policy against regulatory requirements and provide feedback to external counsel.',
    quickActions: [
      { label: 'Review Policy', action: 'review', variant: 'primary' },
    ],
    overdueWindow: [5, 15],
  },
  {
    type: 'quote', team: 'sales', priority: 'medium', stage: 'review',
    title: 'Review updated pricing for QTE-2024-119 — EduTech RFP response',
    context: 'EduTech RFP response requires updated pricing. Product team provided new volume discount schedule.',
    businessObjectName: 'QTE-2024-119 — EduTech RFP',
    recommendedAction: 'Validate new pricing against RFP requirements and submit proposal.',
    quickActions: [
      { label: 'Validate Pricing', action: 'review', variant: 'primary' },
    ],
    overdueWindow: [2, 8],
  },
  {
    type: 'contract', team: 'sales', priority: 'low', stage: 'completion',
    title: 'Archive contract CTR-2020-178 — completed and closed',
    context: 'Contract with OmniCorp fully executed and delivered. Final invoice paid. Ready for archival.',
    businessObjectName: 'CTR-2020-178 — OmniCorp',
    recommendedAction: 'Move contract to archived state and store final documents in document repository.',
    quickActions: [
      { label: 'Archive', action: 'archive', variant: 'secondary' },
    ],
    overdueWindow: [20, 40],
  },
  {
    type: 'renewal', team: 'finance', priority: 'critical', stage: 'approval',
    title: 'Renewal pricing exception requested — 35% discount for FinServ client',
    context: 'FinServ client renewal ($680k) requires 35% discount due to market benchmarking. Exceeds Finance authority by $45k.',
    businessObjectName: 'FinServ — Enterprise Renewal FY26',
    recommendedAction: 'Review financial impact and approve pricing exception or propose counter.',
    quickActions: [
      { label: 'Review Exception', action: 'review', variant: 'primary' },
      { label: 'Approve', action: 'approve', variant: 'primary' },
    ],
    overdueWindow: [-1, 4],
  },
  {
    type: 'invoice', team: 'finance', priority: 'high', stage: 'approval',
    title: 'Credit note request CN-2024-018 for $34k — disputed charges',
    context: 'Customer disputing $34k in consulting charges due to alleged scope overlap. Account manager recommending full credit.',
    businessObjectName: 'CN-2024-018 — Global Consulting Partners',
    recommendedAction: 'Review engagement letters and approve or adjust credit note amount.',
    quickActions: [
      { label: 'Review Dispute', action: 'review', variant: 'primary' },
      { label: 'Approve Credit', action: 'approve', variant: 'secondary' },
    ],
    overdueWindow: [0, 5],
  },
  {
    type: 'purchase_order', team: 'procurement', priority: 'low', stage: 'completion',
    title: 'Close PO-2024-054 — all items received and invoiced',
    context: 'Final delivery confirmed against PO-2024-054. All invoices matched and paid. Ready for closure.',
    businessObjectName: 'PO-2024-054 — Office Furniture',
    recommendedAction: 'Verify final reconciliation and close the purchase order.',
    quickActions: [
      { label: 'Close PO', action: 'complete', variant: 'secondary' },
    ],
    overdueWindow: [10, 25],
  },
  {
    type: 'document', team: 'operations', priority: 'low', stage: 'completion',
    title: 'Organize signed agreements by quarter for annual audit prep',
    context: 'Annual audit preparation. All signed agreements from FY24 need to be organized and indexed.',
    businessObjectName: 'FY24 Signed Agreements Repository',
    recommendedAction: 'Sort, index, and tag all FY24 agreements for audit readiness.',
    quickActions: [
      { label: 'Organize', action: 'archive', variant: 'secondary' },
    ],
    overdueWindow: [20, 45],
  },
  {
    type: 'sla', team: 'operations', priority: 'critical', stage: 'execution',
    title: 'Major incident — P1 outage affecting 3 enterprise clients',
    context: 'Critical system outage (incident INC-2024-442) affecting production access for 3 enterprise clients. 37 min elapsed.',
    businessObjectName: 'INC-2024-442 — Platform Outage',
    recommendedAction: 'Activate incident response team and provide client communications every 30 minutes.',
    quickActions: [
      { label: 'Activate IRT', action: 'assign', variant: 'primary' },
      { label: 'Send Update', action: 'notify', variant: 'secondary' },
    ],
    overdueWindow: [-1, 0],
  },
  {
    type: 'compliance', team: 'compliance', priority: 'medium', stage: 'execution',
    title: 'Quarterly access review — 45 active users need certification',
    context: 'Quarterly access certification cycle. 45 user access reviews pending across 12 systems. Deadline: 14 days.',
    businessObjectName: 'Access Review Q2 FY25',
    recommendedAction: 'Complete access certification for assigned user populations in all 12 systems.',
    quickActions: [
      { label: 'Start Review', action: 'review', variant: 'primary' },
      { label: 'View Progress', action: 'view', variant: 'secondary' },
    ],
    overdueWindow: [5, 14],
  },
  {
    type: 'quote', team: 'sales', priority: 'critical', stage: 'signature',
    title: 'Quote QTE-2024-122 approved by customer — convert to contract',
    context: 'Customer approved quote for $156k (3-year term). All pricing and terms accepted. Ready for contract generation.',
    businessObjectName: 'QTE-2024-122 — ApexDigital Solutions',
    recommendedAction: 'Generate contract from approved quote and send for countersignature.',
    quickActions: [
      { label: 'Generate Contract', action: 'create', variant: 'primary' },
    ],
    overdueWindow: [-1, 2],
  },
  {
    type: 'contract', team: 'legal', priority: 'critical', stage: 'review',
    title: 'Emergency contract amendment needed — price adjustment clause',
    context: 'Raw material cost surge requires invoking price adjustment clause in supplier contracts. Urgent amendments needed for 3 key suppliers.',
    businessObjectName: 'Supplier Contracts — Price Adjustment',
    recommendedAction: 'Draft and circulate amendment letters for affected supplier contracts.',
    quickActions: [
      { label: 'Draft Amendment', action: 'create', variant: 'primary' },
      { label: 'View Contracts', action: 'view', variant: 'secondary' },
    ],
    overdueWindow: [-2, 1],
  },
  {
    type: 'renewal', team: 'sales', priority: 'medium', stage: 'negotiation',
    title: 'Renewal RNW-2024-029 — client requesting usage-based pricing',
    context: 'Client wants to switch from flat-fee to usage-based pricing for renewal. Requires product and finance input.',
    businessObjectName: 'RNW-2024-029 — StreamScale',
    recommendedAction: 'Evaluate usage-based pricing model feasibility with product and finance teams.',
    quickActions: [
      { label: 'Evaluate Model', action: 'review', variant: 'primary' },
    ],
    overdueWindow: [7, 20],
  },
  {
    type: 'invoice', team: 'finance', priority: 'high', stage: 'approval',
    title: 'Invoice INV-2024-445 for $240k — approve for payment run',
    context: 'Large vendor invoice for Q3 infrastructure costs. Within budget. Standard 30-day terms. Payment run in 3 days.',
    businessObjectName: 'INV-2024-445 — AWS Enterprise Support',
    recommendedAction: 'Verify against PO and approve for payment run.',
    quickActions: [
      { label: 'Approve Payment', action: 'approve', variant: 'primary' },
    ],
    overdueWindow: [-2, 3],
  },
  {
    type: 'purchase_order', team: 'procurement', priority: 'high', stage: 'review',
    title: 'Review sole-source justification for PO-2024-095',
    context: 'PO for specialized lab equipment ($185k) requires sole-source justification per procurement policy. Documentation submitted.',
    businessObjectName: 'PO-2024-095 — Lab Equipment',
    recommendedAction: 'Review sole-source justification and approve or require competitive bidding.',
    quickActions: [
      { label: 'Review Justification', action: 'review', variant: 'primary' },
    ],
    overdueWindow: [2, 7],
  },
  {
    type: 'document', team: 'legal', priority: 'high', stage: 'signature',
    title: 'Data processing agreement v2 — execute before Sep 1 deadline',
    context: 'Updated DPA reflecting new regulatory requirements must be executed with all data processors before Sep 1. 12 processors pending.',
    businessObjectName: 'DPA v2 — Data Processor Agreements',
    recommendedAction: 'Send updated DPA for signature to remaining 12 data processors.',
    quickActions: [
      { label: 'Send DPA', action: 'send', variant: 'primary' },
      { label: 'Track Progress', action: 'view', variant: 'secondary' },
    ],
    overdueWindow: [3, 10],
  },
  {
    type: 'sla', team: 'operations', priority: 'medium', stage: 'execution',
    title: 'Proactive maintenance window — notify enterprise clients',
    context: 'Scheduled maintenance window next Saturday (2 AM - 6 AM EST). Requires 7-day advance notice per SLA terms.',
    businessObjectName: 'Infrastructure Maintenance — Aug Maintenance',
    recommendedAction: 'Send maintenance notification to all affected enterprise clients.',
    quickActions: [
      { label: 'Notify Clients', action: 'notify', variant: 'primary' },
    ],
    overdueWindow: [3, 7],
  },
  {
    type: 'compliance', team: 'compliance', priority: 'high', stage: 'review',
    title: 'CCPA compliance audit — 3rd-party data sharing assessment',
    context: 'Annual CCPA audit requires assessment of all 3rd-party data sharing arrangements. 22 vendors to review.',
    businessObjectName: 'CCPA 3rd-Party Audit FY25',
    recommendedAction: 'Review data sharing agreements with 22 vendors and update risk assessments.',
    quickActions: [
      { label: 'Start Assessment', action: 'review', variant: 'primary' },
      { label: 'View Vendors', action: 'view', variant: 'secondary' },
    ],
    overdueWindow: [10, 25],
  },
  {
    type: 'quote', team: 'sales', priority: 'high', stage: 'approval',
    title: 'QTE-2024-125 exceeds approval threshold — VP approval needed',
    context: 'Enterprise quote for $850k exceeds standard sales authority. Requires VP Sales and Finance VP approvals.',
    businessObjectName: 'QTE-2024-125 — GovCloud Migration',
    recommendedAction: 'Review quote and margin analysis, then approve or escalate to C-suite.',
    quickActions: [
      { label: 'Review Quote', action: 'review', variant: 'primary' },
      { label: 'Approve', action: 'approve', variant: 'secondary' },
    ],
    overdueWindow: [0, 4],
  },
  {
    type: 'contract', team: 'legal', priority: 'low', stage: 'execution',
    title: 'Update standard contract template for 2025',
    context: 'Annual template review cycle. Key changes: updated indemnification clause and revised limitation of liability.',
    businessObjectName: 'Standard Contract Template v2025',
    recommendedAction: 'Review proposed template changes and approve for legal team distribution.',
    quickActions: [
      { label: 'Review Template', action: 'review', variant: 'secondary' },
    ],
    overdueWindow: [15, 30],
  },
  {
    type: 'renewal', team: 'operations', priority: 'low', stage: 'completion',
    title: 'Close renewal RNW-2024-002 — fully executed and invoiced',
    context: 'Renewal completed. Contract signed. First invoice generated. Ready for operational handoff.',
    businessObjectName: 'RNW-2024-002 — SmallBiz Saas',
    recommendedAction: 'Verify completion checklist and close renewal record.',
    quickActions: [
      { label: 'Close Record', action: 'complete', variant: 'secondary' },
    ],
    overdueWindow: [15, 30],
  },
  {
    type: 'invoice', team: 'finance', priority: 'critical', stage: 'execution',
    title: 'Invoice INV-2024-456 — payment overdue, client facing liquidity issues',
    context: '$78k invoice 60 days overdue. Client acknowledged but cited cash flow issues. Payment plan proposal received.',
    businessObjectName: 'INV-2024-456 — RetailMax Corp',
    recommendedAction: 'Review payment plan proposal and approve or escalate to legal for collections.',
    quickActions: [
      { label: 'Review Plan', action: 'review', variant: 'primary' },
      { label: 'Escalate Legal', action: 'escalate', variant: 'destructive' },
    ],
    overdueWindow: [-60, -30],
  },
  {
    type: 'purchase_order', team: 'procurement', priority: 'medium', stage: 'execution',
    title: 'Track delivery status PO-2024-078 — partial shipment received',
    context: 'Partial shipment (60%) received for office renovation materials. Remaining 40% delayed by 2 weeks.',
    businessObjectName: 'PO-2024-078 — Office Renovation',
    recommendedAction: 'Contact vendor for updated delivery timeline and assess impact on renovation schedule.',
    quickActions: [
      { label: 'Track Shipment', action: 'view', variant: 'secondary' },
    ],
    overdueWindow: [2, 10],
  },
  {
    type: 'document', team: 'operations', priority: 'medium', stage: 'review',
    title: 'Review updated SLA document template for new service tier',
    context: 'Product team launching "Enterprise Plus" tier. SLA template needs review before publishing to sales team.',
    businessObjectName: 'Enterprise Plus SLA Template',
    recommendedAction: 'Review SLA commitments for feasibility and approve template.',
    quickActions: [
      { label: 'Review SLA', action: 'review', variant: 'primary' },
    ],
    overdueWindow: [4, 12],
  },
  {
    type: 'sla', team: 'operations', priority: 'high', stage: 'approval',
    title: 'SLA exception request — client requesting 99.99% uptime guarantee',
    context: 'Strategic client requesting premium SLA with 99.99% uptime. Requires infra assessment and pricing adjustment.',
    businessObjectName: 'Premium SLA Request — FinTech Client',
    recommendedAction: 'Assess infrastructure capability to support 99.99% uptime and determine pricing impact.',
    quickActions: [
      { label: 'Assess Feasibility', action: 'review', variant: 'primary' },
    ],
    overdueWindow: [5, 15],
  },
  {
    type: 'compliance', team: 'legal', priority: 'medium', stage: 'review',
    title: 'Review whistleblower policy update for global compliance',
    context: 'Updated whistleblower policy incorporating new EU Whistleblower Directive requirements. Legal review before board approval.',
    businessObjectName: 'Whistleblower Policy v4',
    recommendedAction: 'Review policy against EU directive requirements and provide feedback.',
    quickActions: [
      { label: 'Review Policy', action: 'review', variant: 'primary' },
    ],
    overdueWindow: [10, 20],
  },
  {
    type: 'quote', team: 'sales', priority: 'medium', stage: 'execution',
    title: 'Convert QTE-2024-099 to order — customer accepted verbally',
    context: 'Customer verbally accepted quote for $45k. Written PO expected but not yet received. Follow up needed.',
    businessObjectName: 'QTE-2024-099 — MidSize Manufacturing',
    recommendedAction: 'Send formal order confirmation and follow up for written purchase order.',
    quickActions: [
      { label: 'Send Confirmation', action: 'send', variant: 'primary' },
    ],
    overdueWindow: [3, 8],
  },
  {
    type: 'contract', team: 'compliance', priority: 'critical', stage: 'review',
    title: 'Contract CTR-2024-198 — Sanctions screening flagged name match',
    context: 'Automated screening flagged counterparty name against OFAC sanctions list. Manual review required within 48 hours.',
    businessObjectName: 'CTR-2024-198 — International Partners Ltd',
    recommendedAction: 'Perform enhanced due diligence and determine if match is false positive or requires escalation.',
    quickActions: [
      { label: 'Review Flag', action: 'review', variant: 'primary' },
      { label: 'Escalate', action: 'escalate', variant: 'destructive' },
    ],
    overdueWindow: [-1, 2],
  },
  {
    type: 'renewal', team: 'sales', priority: 'critical', stage: 'approval',
    title: 'Renewal RNW-2024-048 — customer threatening to churn without discount',
    context: 'Customer indicated they will not renew at current pricing. Competitive bid from rival vendor at 28% lower. Retention at risk.',
    businessObjectName: 'RNW-2024-048 — CoreBank Financial',
    recommendedAction: 'Review retention analysis and approve competitive discount to prevent churn.',
    quickActions: [
      { label: 'Review Retention', action: 'review', variant: 'primary' },
      { label: 'Approve Discount', action: 'approve', variant: 'primary' },
    ],
    overdueWindow: [-2, 5],
  },
  {
    type: 'invoice', team: 'finance', priority: 'low', stage: 'completion',
    title: 'Invoice INV-2024-301 — small balance ($230) write-off request',
    context: 'Residual balance of $230 remaining after partial payment. Cost to collect exceeds amount. Write-off recommended.',
    businessObjectName: 'INV-2024-301 — Old Account',
    recommendedAction: 'Approve write-off of $230 residual balance.',
    quickActions: [
      { label: 'Approve Write-off', action: 'approve', variant: 'secondary' },
    ],
    overdueWindow: [15, 30],
  },
  {
    type: 'purchase_order', team: 'procurement', priority: 'high', stage: 'approval',
    title: 'PO-2024-099 urgent — seasonal inventory ramp for Q4',
    context: 'Q4 inventory ramp requires early PO placement. $420k for seasonal stock. Standard lead time requires approval this week.',
    businessObjectName: 'PO-2024-099 — Q4 Inventory',
    recommendedAction: 'Approve PO to meet seasonal inventory lead times.',
    quickActions: [
      { label: 'Approve PO', action: 'approve', variant: 'primary' },
    ],
    overdueWindow: [0, 5],
  },
  {
    type: 'document', team: 'legal', priority: 'critical', stage: 'review',
    title: 'Review urgent contract amendment — Force Majeure clause triggered',
    context: 'Supplier invoking force majeure due to port strike. Amendment proposed to extend delivery timeline by 60 days.',
    businessObjectName: 'Force Majeure Amendment — Port Strike',
    recommendedAction: 'Review force majeure claim validity and negotiate amended delivery schedule.',
    quickActions: [
      { label: 'Review Amendment', action: 'review', variant: 'primary' },
      { label: 'Negotiate', action: 'negotiate', variant: 'secondary' },
    ],
    overdueWindow: [-2, 1],
  },
  {
    type: 'sla', team: 'operations', priority: 'medium', stage: 'completion',
    title: 'Close SLA incident INC-2024-423 — root cause analysis complete',
    context: 'Post-mortem for P2 incident completed. RCA documented. Action items assigned. Ready for closure.',
    businessObjectName: 'INC-2024-423 — Database Performance',
    recommendedAction: 'Review RCA report and close incident record.',
    quickActions: [
      { label: 'Review RCA', action: 'review', variant: 'secondary' },
      { label: 'Close Incident', action: 'complete', variant: 'secondary' },
    ],
    overdueWindow: [3, 8],
  },
  {
    type: 'compliance', team: 'compliance', priority: 'low', stage: 'completion',
    title: 'File annual beneficial ownership report with FinCEN',
    context: 'Corporate Transparency Act requires beneficial ownership filing. Due in 60 days. Information collected, ready for submission.',
    businessObjectName: 'BOI Report — Corporate Entity',
    recommendedAction: 'Verify beneficial ownership information and file report with FinCEN.',
    quickActions: [
      { label: 'File Report', action: 'file', variant: 'primary' },
    ],
    overdueWindow: [30, 50],
  },
]

function pick<T>(arr: T[], rng: () => number = Math.random): T {
  return arr[Math.floor(rng() * arr.length)]
}

function randInt(min: number, max: number, rng: () => number = Math.random): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

const contractNames = [
  'Enterprise License Agreement', 'SaaS Platform Subscription', 'Cloud Infrastructure Deal',
  'Partnership Framework', 'Managed Services Contract', 'Support & Maintenance Contract',
  'Procurement Agreement', 'Office Supplies Contract', 'Master Services Agreement',
  'NovaTech Partnership', 'Data Processing Agreement', 'Reseller Agreement',
  'Consulting Services Framework', 'Software Maintenance Renewal', 'Hardware Lease Agreement',
]

const companyNames = [
  'Acme Corp', 'GlobalTech', 'TechCorp', 'Startify Labs', 'Beta Inc', 'Delta Services',
  'Gamma LLC', 'Omega Supplies', 'NovaTech', 'PremierCorp', 'Apex Logistics', 'Zenith Corp',
  'CloudServe', 'Delta Manufacturing', 'TechPartners Inc', 'NorthWind Solutions',
  'SafeGuard Insurance', 'DataVault Systems', 'BlueLine Corp', 'GreenBuild Construction',
  'Orion AI', 'MegaCorp', 'CloudStack', 'HealthFirst', 'StationeryWorld',
  'EduTech Solutions', 'OmniCorp', 'Global Consulting Partners', 'ApexDigital',
  'StreamScale', 'RetailMax Corp', 'MidSize Manufacturing', 'International Partners Ltd',
  'CoreBank Financial', 'FinServ Group', 'SmallBiz SaaS', 'GovCloud Systems',
]

function generateItems(): InboxItem[] {
  const items: InboxItem[] = []

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i]
    const [minDays, maxDays] = s.overdueWindow
    const days = randInt(minDays, maxDays)
    const dueDate = daysOffset(days)
    const owner = pick(owners)
    const company = pick(companyNames)
    const createdAt = hoursAgo(randInt(12, 168))

    items.push({
      id: `in-${String(i + 1).padStart(3, '0')}`,
      priority: s.priority,
      type: s.type,
      team: s.team,
      title: s.title,
      context: s.context,
      businessObjectName: `${company} — ${s.businessObjectName}`,
      businessObjectId: 1000 + i,
      dueDate,
      stage: s.stage,
      owner,
      recommendedAction: s.recommendedAction,
      quickActions: s.quickActions,
      createdAt,
    })
  }

  for (let i = scenarios.length; i < 100; i++) {
    const type = pick(types)
    const priority = pick(priorities.slice(1))
    const stage = pick(stages)
    const company = pick(companyNames)
    const owner = pick(owners)
    const team = pick(teams)
    const days = randInt(-5, 45)
    const dueDate = daysOffset(days)
    const createdAt = hoursAgo(randInt(12, 240))
    const isDue = days <= 0

    let title: string
    let context: string
    let businessObjectName: string
    let recommendedAction: string
    const quickActions: QuickAction[] = [
      { label: 'View Details', action: 'view', variant: 'secondary' },
    ]
    let businessObjectId = 2000 + i

    const prefixes: Record<BusinessObject, string> = {
      quote: 'QTE', contract: 'CTR', renewal: 'RNW', invoice: 'INV',
      purchase_order: 'PO', document: 'DOC', sla: 'SLA', compliance: 'CMP',
    }
    const refId = `${prefixes[type]}-${2024}-${String(randInt(1, 500)).padStart(3, '0')}`

    switch (type) {
      case 'quote':
        title = isDue
          ? `Quote ${refId} response overdue — follow up with ${company}`
          : `Quote ${refId} ready for review — ${company}`
        context = `${company} requested pricing for ${pick(['enterprise license', 'SaaS subscription', 'consulting services', 'hardware bundle'])}. ${isDue ? 'Response deadline passed.' : 'Response due.'}`
        businessObjectName = `${refId} — ${company}`
        recommendedAction = isDue ? 'Follow up with prospect regarding outstanding quote.' : 'Review and submit quote to prospect.'
        quickActions.push({ label: isDue ? 'Send Reminder' : 'Review Quote', action: isDue ? 'remind' : 'review', variant: 'primary' })
        break
      case 'contract':
        title = isDue
          ? `Contract ${refId} requires attention — ${company}`
          : `Contract ${refId} ${pick(['ready for signature', 'pending legal review', 'awaiting countersignature'])}`
        context = `${company} contract ${isDue ? 'requires immediate action' : 'is pending review'}. Next step: ${pick(['legal review', 'countersignature', 'board approval'])}.`
        businessObjectName = `${refId} — ${company}`
        recommendedAction = isDue ? 'Take immediate action on pending contract.' : 'Complete next step in contract workflow.'
        quickActions.push({ label: isDue ? 'Review Now' : 'Continue', action: 'review', variant: 'primary' })
        break
      case 'renewal':
        title = isDue
          ? `Renewal ${refId} overdue — ${company} contract expiring`
          : `Renewal ${refId} approaching — ${company}`
        context = `${company} renewal ${isDue ? 'is past due' : 'is upcoming'}. Current value: $${randInt(50, 500)}k. ${isDue ? 'Risk of service interruption.' : 'Plan renewal strategy.'}`
        businessObjectName = `${refId} — ${company}`
        recommendedAction = isDue ? 'Contact client immediately to prevent lapse.' : 'Prepare renewal package and schedule discussion.'
        quickActions.push({ label: isDue ? 'Contact Client' : 'Prepare Renewal', action: isDue ? 'contact' : 'prepare', variant: 'primary' })
        break
      case 'invoice':
        title = isDue
          ? `Invoice ${refId} past due — ${company}`
          : `Invoice ${refId} ${pick(['pending approval', 'ready for payment', 'under review'])}`
        context = `Invoice for $${randInt(500, 250000)} from ${company}. ${isDue ? `${Math.abs(days)} days overdue.` : 'Processing in progress.'}`
        businessObjectName = `${refId} — ${company}`
        recommendedAction = isDue ? 'Send payment reminder or escalate to collections.' : 'Process invoice through standard workflow.'
        quickActions.push({ label: isDue ? 'Send Reminder' : 'Process', action: isDue ? 'remind' : 'process', variant: 'primary' })
        break
      case 'purchase_order':
        title = isDue
          ? `PO ${refId} requires approval — ${company}`
          : `PO ${refId} ${pick(['pending vendor confirmation', 'awaiting delivery', 'under review'])}`
        context = `Purchase order for $${randInt(1000, 500000)} from ${company}. ${isDue ? 'Approval overdue.' : 'Standard processing.'}`
        businessObjectName = `${refId} — ${company}`
        recommendedAction = isDue ? 'Expedite PO approval process.' : 'Monitor PO status and vendor confirmation.'
        quickActions.push({ label: isDue ? 'Approve Now' : 'Track Status', action: isDue ? 'approve' : 'view', variant: 'primary' })
        break
      case 'document':
        title = isDue
          ? `Document ${refId} pending signature — ${company}`
          : `Document ${refId} ${pick(['ready for review', 'uploaded by partner', 'requires update'])}`
        context = `${pick(['NDA', 'SOW', 'Amendment', 'Addendum', 'Statement of Work'])} document for ${company}. ${isDue ? 'Signature deadline passed.' : 'Awaiting action.'}`
        businessObjectName = `${refId} — ${company}`
        recommendedAction = isDue ? 'Follow up on pending document signature.' : 'Review and process document.'
        quickActions.push({ label: isDue ? 'Follow Up' : 'Review', action: isDue ? 'followup' : 'review', variant: 'primary' })
        break
      case 'sla':
        title = isDue
          ? `SLA ${refId} at risk — ${company} service levels`
          : `SLA ${refId} review — ${company} compliance check`
        context = `${company} SLA monitoring shows ${pick(['response time degradation', 'uptime below threshold', 'support ticket backlog'])}.`
        businessObjectName = `${refId} — ${company}`
        recommendedAction = isDue ? 'Investigate SLA breach and prepare remediation plan.' : 'Review SLA metrics and schedule client check-in.'
        quickActions.push({ label: isDue ? 'Investigate' : 'Review Metrics', action: 'investigate', variant: 'primary' })
        break
      case 'compliance':
        title = isDue
          ? `Compliance ${refId} deadline approaching — take action`
          : `Compliance ${refId} ${pick(['review scheduled', 'documentation due', 'audit pending'])}`
        context = `${pick(['GDPR', 'SOC 2', 'ISO 27001', 'PCI DSS', 'HIPAA'])} compliance task. ${isDue ? 'Deadline imminent.' : 'Scheduled review cycle.'}`
        businessObjectName = `${refId} — ${pick(['Enterprise', 'Corporate', 'Regulatory'])}`
        recommendedAction = isDue ? 'Complete compliance task before deadline.' : 'Schedule and prepare for compliance review.'
        quickActions.push({ label: isDue ? 'Complete Now' : 'Schedule Review', action: isDue ? 'complete' : 'schedule', variant: 'primary' })
        break
    }

    const stageMap: Record<BusinessObject, Stage> = {
      quote: 'approval', contract: 'review', renewal: 'renewal',
      invoice: 'execution', purchase_order: 'approval', document: 'signature',
      sla: 'execution', compliance: 'execution',
    }

    items.push({
      id: `in-${String(i + 1).padStart(3, '0')}`,
      priority,
      type,
      team,
      title,
      context,
      businessObjectName,
      businessObjectId,
      dueDate,
      stage: stageMap[type] ?? stage,
      owner,
      recommendedAction,
      quickActions,
      createdAt,
    })
  }

  return items.sort((a, b) => {
    const pOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    const diff = pOrder[a.priority] - pOrder[b.priority]
    if (diff !== 0) return diff
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  })
}

export const inboxItems: InboxItem[] = generateItems()
