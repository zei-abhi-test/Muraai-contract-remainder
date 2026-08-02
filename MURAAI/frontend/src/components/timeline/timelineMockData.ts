export interface NarrativeEvent {
  id: string
  timestamp: string
  actor: { name: string; role?: string }
  action: string
  target: string
  detail: string
  entityType: 'contract' | 'renewal' | 'invoice' | 'po' | 'document' | 'task' | 'approval' | 'comment' | 'system'
  entityLabel: string
}

function h(hoursAgo: number, minutes = 0): string {
  const d = new Date()
  d.setHours(d.getHours() - hoursAgo, d.getMinutes() - minutes, 0, 0)
  return d.toISOString()
}

function d(daysAgo: number, hours = 0, minutes = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hours, minutes, 0, 0)
  return d.toISOString()
}

export const mockTimelineEvents: NarrativeEvent[] = [
  {
    id: 'e1', timestamp: h(0, 38),
    actor: { name: 'Sarah Chen', role: 'VP Finance' },
    action: 'approved', target: 'revised pricing',
    detail: 'Approved 8% uplift with 3-year commitment for Acme Corp renewal. Margin meets 28% threshold.',
    entityType: 'approval', entityLabel: 'Enterprise License — Year 3 Renewal',
  },
  {
    id: 'e2', timestamp: h(0, 25),
    actor: { name: 'Vendor Portal', role: 'System' },
    action: 'uploaded', target: 'Q4 technology quote',
    detail: 'Vendor submitted updated pricing for pass-through infrastructure costs — $240,000 annual.',
    entityType: 'document', entityLabel: 'Vendor Quote_Q4.xlsx',
  },
  {
    id: 'e3', timestamp: h(0, 58),
    actor: { name: 'System', role: 'Automation' },
    action: 'sent', target: 'pricing approval reminder',
    detail: 'Automatic reminder triggered — VP Finance approval pending for 3 days on RNW-2025-001.',
    entityType: 'system', entityLabel: 'RNW-2025-001 · Enterprise License Renewal',
  },
  {
    id: 'e4', timestamp: h(1, 45),
    actor: { name: 'System', role: 'Automation' },
    action: 'generated', target: 'Purchase Order PO-2025-0004',
    detail: 'PO auto-generated from approved renewal terms — $320,000 for Advanced Analytics add-on module.',
    entityType: 'po', entityLabel: 'PO-2025-0004 · Acme Corporation',
  },
  {
    id: 'e5', timestamp: h(2, 30),
    actor: { name: 'Ananya K.', role: 'VP Sales' },
    action: 'reviewed', target: 'contract amendment clause 4.3',
    detail: 'Reviewed and marked up amendment for auto-renewal terms. Changes sent to legal for finalisation.',
    entityType: 'contract', entityLabel: 'Enterprise License Agreement — CONT-2024-001',
  },
  {
    id: 'e6', timestamp: h(3, 15),
    actor: { name: 'System', role: 'Automation' },
    action: 'marked', target: 'INV-2025-0042 as paid',
    detail: 'Payment of $750,000 received and reconciled against PO-2025-0003. Invoice status updated to paid.',
    entityType: 'invoice', entityLabel: 'INV-2025-0042 · Acme Corporation',
  },
  {
    id: 'e7', timestamp: h(4, 0),
    actor: { name: 'Ravi Kumar', role: 'Enterprise Account Manager' },
    action: 'commented on', target: 'renewal pricing discussion',
    detail: '"Customer requesting additional 3% discount on add-on modules. Recommend tiered pricing approach to protect margin."',
    entityType: 'comment', entityLabel: 'Enterprise License — Year 3 Renewal',
  },
  {
    id: 'e8', timestamp: d(1, 9, 15),
    actor: { name: 'Ravi Kumar', role: 'Enterprise Account Manager' },
    action: 'submitted', target: 'renewal proposal to customer',
    detail: 'Final proposal with 8% uplift, 3-year commitment, and tiered add-on pricing sent to Acme procurement.',
    entityType: 'renewal', entityLabel: 'Enterprise License — Year 3 Renewal',
  },
  {
    id: 'e9', timestamp: d(1, 10, 30),
    actor: { name: 'John Smith', role: 'Procurement Lead — Acme Corp' },
    action: 'replied to', target: 'renewal terms discussion',
    detail: '"We are interested in the 3-year deal. Can we revisit the add-on pricing structure for Advanced Analytics?"',
    entityType: 'comment', entityLabel: 'Enterprise License — Year 3 Renewal',
  },
  {
    id: 'e10', timestamp: d(1, 11, 0),
    actor: { name: 'Ravi Kumar', role: 'Enterprise Account Manager' },
    action: 'uploaded', target: 'Compliance Certification 2025',
    detail: 'Renewed compliance certificate uploaded — valid through July 2027. Resolves missing document flag.',
    entityType: 'document', entityLabel: 'Compliance_Certification_2025.pdf',
  },
  {
    id: 'e11', timestamp: d(1, 13, 0),
    actor: { name: 'System', role: 'Workflow' },
    action: 'sent', target: 'approval request to Priya Sharma',
    detail: 'Step 3 approval routed to VP Finance — pricing revision for Enterprise License renewal requires sign-off.',
    entityType: 'approval', entityLabel: 'Pricing Approval · Enterprise License Renewal',
  },
  {
    id: 'e12', timestamp: d(1, 15, 20),
    actor: { name: 'Support Team', role: 'Operations' },
    action: 'completed', target: 'headcount licensing verification',
    detail: 'Cross-checked 1,240 license count against current employee roster — 100% match. No adjustments needed.',
    entityType: 'task', entityLabel: 'Verify headcount licensing',
  },
  {
    id: 'e13', timestamp: d(2, 8, 0),
    actor: { name: 'Legal Team', role: 'Legal' },
    action: 'finalised', target: 'SLA amendment schedule',
    detail: 'Updated SLA commitments based on current usage patterns. Response times adjusted for new enterprise tier.',
    entityType: 'contract', entityLabel: 'Enterprise License Agreement — SLA Schedule B',
  },
  {
    id: 'e14', timestamp: d(2, 9, 45),
    actor: { name: 'System', role: 'Automation' },
    action: 'generated', target: 'Q3 Usage Analytics Report',
    detail: 'Automated report generated for Acme Corp — 94% platform adoption, 99.9% uptime, 4.5/5 satisfaction score.',
    entityType: 'document', entityLabel: 'Q3_Usage_Report_Acme.xlsx',
  },
  {
    id: 'e15', timestamp: d(2, 11, 30),
    actor: { name: 'Priya Sharma', role: 'VP Finance' },
    action: 'flagged', target: 'budget overrun risk',
    detail: 'Departmental budget utilisation at 87% with Q4 remaining. flagged for quarterly review before additional PO approval.',
    entityType: 'system', entityLabel: 'Budget Alert — Enterprise Sales',
  },
  {
    id: 'e16', timestamp: d(3, 10, 0),
    actor: { name: 'Ravi Kumar', role: 'Enterprise Account Manager' },
    action: 'created', target: 'task for customer presentation',
    detail: 'New task created: "Schedule QBR slot with Acme procurement team for proposal walkthrough". Due in 5 days.',
    entityType: 'task', entityLabel: 'Schedule customer presentation',
  },
  {
    id: 'e17', timestamp: d(3, 14, 30),
    actor: { name: 'Vendor Portal', role: 'System' },
    action: 'updated', target: 'pricing for infrastructure tier',
    detail: 'Vendor revised annual infrastructure pricing from $240,000 to $225,000 — 6.25% reduction effective Q4.',
    entityType: 'po', entityLabel: 'Vendor Pricing Update — Infrastructure',
  },
  {
    id: 'e18', timestamp: d(4, 8, 30),
    actor: { name: 'Ananya K.', role: 'VP Sales' },
    action: 'approved', target: 'discount ceiling exception',
    detail: 'Approved exception to standard discount ceiling — allows up to 12% for strategic Enterprise deals above $2M ACV.',
    entityType: 'approval', entityLabel: 'Discount Ceiling Exception — Enterprise Sales',
  },
  {
    id: 'e19', timestamp: d(4, 10, 15),
    actor: { name: 'System', role: 'Automation' },
    action: 'sent', target: 'renewal reminder to account team',
    detail: '45-day reminder: Enterprise License renewal window closing. Current stage: Pricing Approval — 55% complete.',
    entityType: 'system', entityLabel: 'RNW-2025-001 · 45-Day Renewal Reminder',
  },
  {
    id: 'e20', timestamp: d(4, 16, 0),
    actor: { name: 'Ravi Kumar', role: 'Enterprise Account Manager' },
    action: 'updated', target: 'renewal proposal to v2',
    detail: 'Revised pricing with 8% uplift, 3-year commitment, and tiered add-on pricing incorporated into proposal.',
    entityType: 'renewal', entityLabel: 'Enterprise License — Year 3 Renewal',
  },
  {
    id: 'e21', timestamp: d(5, 9, 0),
    actor: { name: 'Sarah Chen', role: 'VP Finance' },
    action: 'approved', target: 'INV-2025-0039 payment',
    detail: 'Approved payment of $500,000 against PO-2025-0001. Payment scheduled for next batch run.',
    entityType: 'invoice', entityLabel: 'INV-2025-0039 · Acme Corporation',
  },
  {
    id: 'e22', timestamp: d(5, 11, 45),
    actor: { name: 'System', role: 'Automation' },
    action: 'generated', target: 'monthly compliance report',
    detail: 'Automated compliance report for July 2026 — all 12 active contracts in good standing. Zero breaches.',
    entityType: 'document', entityLabel: 'Compliance_Report_July_2026.pdf',
  },
  {
    id: 'e23', timestamp: d(5, 15, 0),
    actor: { name: 'John Smith', role: 'Procurement Lead — Acme Corp' },
    action: 'requested', target: 'additional discount on modules',
    detail: 'Formal request for 5% additional discount on Advanced Analytics and Reporting add-on modules.',
    entityType: 'comment', entityLabel: 'Enterprise License — Year 3 Renewal',
  },
  {
    id: 'e24', timestamp: d(6, 8, 0),
    actor: { name: 'Muraai Legal', role: 'Legal' },
    action: 'finalised', target: 'NDA addendum for partnership',
    detail: 'Executed NDA addendum with expanded scope covering joint go-to-market activities for 2026.',
    entityType: 'document', entityLabel: 'Signed_NDA_Addendum_2026.pdf',
  },
  {
    id: 'e25', timestamp: d(6, 10, 30),
    actor: { name: 'Ravi Kumar', role: 'Enterprise Account Manager' },
    action: 'initiated', target: 'renewal workflow for TechStart Inc',
    detail: 'Started early renewal process for TechStart Inc — current contract expires January 2027. 12-month runway.',
    entityType: 'renewal', entityLabel: 'TechStart Enterprise — Year 2 Renewal',
  },
  {
    id: 'e26', timestamp: d(6, 13, 0),
    actor: { name: 'System', role: 'Workflow' },
    action: 'created', target: '6 new approval requests',
    detail: 'Bulk approval requests generated for Q4 pricing revisions across 6 enterprise renewals.',
    entityType: 'approval', entityLabel: 'Bulk Approval — Q4 Pricing Revision',
  },
  {
    id: 'e27', timestamp: d(7, 9, 15),
    actor: { name: 'Customer Portal', role: 'System' },
    action: 'signed', target: 'contract amendment digitally',
    detail: 'Acme Corp authorised representative digitally signed Amendment #3 for auto-renewal clause update.',
    entityType: 'contract', entityLabel: 'Enterprise License Agreement — Amendment #3',
  },
  {
    id: 'e28', timestamp: d(7, 11, 0),
    actor: { name: 'Ananya K.', role: 'VP Sales' },
    action: 'reviewed', target: 'Q2 business review deck',
    detail: 'Reviewed and approved Q2 Business Review presentation for Acme Corp. Deck highlights 94% compliance and 99.9% uptime.',
    entityType: 'document', entityLabel: 'Q2_Business_Review_Acme.pptx',
  },
  {
    id: 'e29', timestamp: d(7, 14, 30),
    actor: { name: 'Finance Team', role: 'Operations' },
    action: 'reconciled', target: '12 invoices against POs',
    detail: 'Monthly reconciliation completed — 12 invoices matched against 8 purchase orders. Zero discrepancies.',
    entityType: 'invoice', entityLabel: 'Monthly Reconciliation — June 2026',
  },
  {
    id: 'e30', timestamp: d(7, 16, 45),
    actor: { name: 'System', role: 'Automation' },
    action: 'flagged', target: '3 documents expiring next month',
    detail: 'Automatic compliance check — 3 certification documents expiring within 30 days. Renewal reminders queued.',
    entityType: 'system', entityLabel: 'Document Expiry Alert',
  },
]

export function generateNewEvent(): NarrativeEvent {
  const actors = [
    { name: 'Sarah Chen', role: 'VP Finance' },
    { name: 'Ravi Kumar', role: 'Enterprise Account Manager' },
    { name: 'System', role: 'Automation' },
    { name: 'Ananya K.', role: 'VP Sales' },
    { name: 'Vendor Portal', role: 'System' },
  ]
  const actions = ['approved', 'uploaded', 'submitted', 'reviewed', 'generated']
  const targets = ['pricing revision', 'compliance document', 'renewal proposal', 'QBR deck', 'purchase order']
  const actor = actors[Math.floor(Math.random() * actors.length)]
  const action = actions[Math.floor(Math.random() * actions.length)]
  const target = targets[Math.floor(Math.random() * targets.length)]
  return {
    id: `new-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor,
    action,
    target,
    detail: `${actor.name} ${action} ${target} — auto-generated event simulation.`,
    entityType: 'system',
    entityLabel: 'Live Activity Feed',
  }
}
