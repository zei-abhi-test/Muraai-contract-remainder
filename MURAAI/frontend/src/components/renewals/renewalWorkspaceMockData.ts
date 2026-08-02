export interface RenewalStage {
  id: string
  label: string
  status: 'completed' | 'active' | 'pending' | 'blocked'
  date?: string
  assignee?: string
  description?: string
}

export interface RenewalApproval {
  id: number
  step: number
  approver: string
  role: string
  status: 'pending' | 'approved' | 'rejected'
  comments: string
  timestamp: string
}

export interface RenewalTask {
  id: number
  title: string
  description: string
  assignee: string
  dueDate: string
  priority: 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'completed'
  category: string
}

export interface RenewalCommEntry {
  id: number
  type: 'email' | 'note' | 'meeting' | 'call'
  direction: 'inbound' | 'outbound'
  subject: string
  summary: string
  from: string
  to: string
  timestamp: string
  party: 'vendor' | 'customer'
}

export interface RenewalDocument {
  id: number
  fileName: string
  type: string
  uploadedBy: string
  uploadedAt: string
  size: string
  status: 'required' | 'uploaded' | 'missing' | 'expired'
}

export interface RenewalPO {
  id: number
  number: string
  amount: number
  status: string
  issuedDate: string
  expiryDate: string
  department: string
}

export interface RenewalInvoice {
  id: number
  number: string
  amount: number
  status: string
  dueDate: string
  paidDate?: string
  linkedPO?: string
}

export interface RenewalActivity {
  id: number
  type: string
  title: string
  description: string
  timestamp: string
  user: string
}

export interface RenewalHealthFactor {
  label: string
  status: 'healthy' | 'warning' | 'critical'
  detail: string
  score: number
  max: number
}

export interface RenewalRisk {
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  category: string
}

export interface RenewalNotification {
  id: number
  type: 'approval' | 'document' | 'task' | 'message' | 'system'
  message: string
  timestamp: string
  read: boolean
}

export interface RenewalDeadline {
  id: number
  label: string
  date: string
  type: 'approval' | 'signature' | 'payment' | 'review'
  assignee: string
}

export interface RenewalWorkspaceData {
  id: number
  contractId: number
  name: string
  renewalNumber: string
  status: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  contractName: string
  contractNumber: string
  companyName: string
  totalValue: number
  currency: string
  startDate: string
  endDate: string
  renewalDate: string
  createdAt: string
  lastUpdated: string
  owner: { name: string; email: string; role: string }
  department: string
  customer: { name: string; email: string; company: string }
  vendor: { name: string; email: string; company: string }
  currentStage: string

  slaDaysRemaining: number
  slaTotalDays: number
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'

  stages: RenewalStage[]
  approvalRequired: boolean
  approvals: RenewalApproval[]
  tasks: RenewalTask[]
  vendorCommunications: RenewalCommEntry[]
  customerCommunications: RenewalCommEntry[]
  documents: RenewalDocument[]
  purchaseOrders: RenewalPO[]
  invoices: RenewalInvoice[]
  activity: RenewalActivity[]
  healthScore: number
  healthLevel: string
  healthFactors: RenewalHealthFactor[]
  risks: RenewalRisk[]
  notifications: RenewalNotification[]
  upcomingDeadlines: RenewalDeadline[]

  recommendedAction: {
    text: string
    urgency: 'low' | 'medium' | 'high'
    actionLabel: string
    dueDate: string
  }

  progressPercent: number
}

function daysAgo(d: number): string {
  const date = new Date()
  date.setDate(date.getDate() - d)
  return date.toISOString()
}

function daysFromNow(d: number): string {
  const date = new Date()
  date.setDate(date.getDate() + d)
  return date.toISOString().split('T')[0]
}

export const mockRenewalWorkspaceData: RenewalWorkspaceData = {
  id: 201,
  contractId: 101,
  name: 'Enterprise License — Year 3 Renewal',
  renewalNumber: 'RNW-2025-001',
  status: 'in_progress',
  priority: 'high',
  contractName: 'Enterprise License Agreement',
  contractNumber: 'CONT-2024-001',
  companyName: 'Acme Corporation',
  totalValue: 3200000,
  currency: 'INR',
  startDate: '2025-11-15',
  endDate: '2026-01-14',
  renewalDate: '2026-01-14',
  createdAt: daysAgo(45),
  lastUpdated: daysAgo(1),
  owner: { name: 'Ravi Kumar', email: 'ravi.kumar@muraai.com', role: 'Enterprise Account Manager' },
  department: 'Enterprise Sales',
  customer: { name: 'John Smith', email: 'john.smith@acme.com', company: 'Acme Corporation' },
  vendor: { name: 'Priya Sharma', email: 'priya.sharma@muraai.com', company: 'Muraai Inc.' },

  slaDaysRemaining: 45,
  slaTotalDays: 90,
  riskScore: 28,
  riskLevel: 'medium',
  currentStage: 'pricing_approval',

  stages: [
    { id: 'initiation', label: 'Initiation', status: 'completed', date: daysAgo(45), assignee: 'Ravi Kumar', description: 'Renewal process initiated' },
    { id: 'performance_review', label: 'Performance Review', status: 'completed', date: daysAgo(35), assignee: 'Ananya K.', description: 'Q2-Q3 performance analysed — 94% compliance, 4.5/5 satisfaction' },
    { id: 'pricing_discussion', label: 'Pricing Discussion', status: 'completed', date: daysAgo(21), assignee: 'Ravi Kumar', description: 'Preliminary terms sent to customer — 5% early renewal discount offered' },
    { id: 'pricing_approval', label: 'Pricing Approval', status: 'active', assignee: 'Priya Sharma', description: 'Internal approval for revised pricing — 8% uplift with 3-year commitment' },
    { id: 'legal_review', label: 'Legal Review', status: 'pending', assignee: 'Legal Team', description: 'Terms and conditions review' },
    { id: 'customer_review', label: 'Customer Review', status: 'pending', assignee: 'Acme Corp', description: 'Awaiting customer sign-off on revised terms' },
    { id: 'execution', label: 'Execution', status: 'pending', assignee: 'Both Parties', description: 'Signing and activation' },
  ],

  approvalRequired: true,
  approvals: [
    { id: 1, step: 1, approver: 'Ravi Kumar', role: 'Account Manager', status: 'approved', comments: 'Recommending 8% uplift with 3-year commit. Customer relationship is strong.', timestamp: daysAgo(25) },
    { id: 2, step: 2, approver: 'Ananya K.', role: 'VP Sales', status: 'approved', comments: 'Approved. Strategic account — acceptable terms.', timestamp: daysAgo(22) },
    { id: 3, step: 3, approver: 'Priya Sharma', role: 'VP Finance', status: 'pending', comments: '', timestamp: '' },
    { id: 4, step: 4, approver: 'Arun Nair', role: 'CEO', status: 'pending', comments: '', timestamp: '' },
  ],

  tasks: [
    { id: 1, title: 'Finalise pricing proposal document', description: 'Compile final pricing with discount structure and payment terms', assignee: 'Ravi Kumar', dueDate: daysAgo(1), priority: 'high', status: 'open', category: 'pricing' },
    { id: 2, title: 'Schedule customer presentation', description: 'Book QBR slot with Acme procurement team for proposal walkthrough', assignee: 'Ravi Kumar', dueDate: daysFromNow(5), priority: 'high', status: 'open', category: 'meeting' },
    { id: 3, title: 'Update SLA commitments', description: 'Review and update SLA terms based on current usage patterns', assignee: 'Legal Team', dueDate: daysFromNow(10), priority: 'medium', status: 'open', category: 'legal' },
    { id: 4, title: 'Prepare usage analytics report', description: 'Generate and package usage analytics for customer review meeting', assignee: 'Ananya K.', dueDate: daysFromNow(0), priority: 'medium', status: 'in_progress', category: 'analytics' },
    { id: 5, title: 'Verify headcount licensing', description: 'Cross-check license count against current employee roster', assignee: 'Support Team', dueDate: daysFromNow(14), priority: 'low', status: 'completed', category: 'operations' },
    { id: 6, title: 'Send vendor quote request', description: 'Request updated pricing from technology vendor for pass-through', assignee: 'Ravi Kumar', dueDate: daysAgo(2), priority: 'high', status: 'open', category: 'pricing' },
  ],

  vendorCommunications: [
    { id: 1, type: 'email', direction: 'outbound', subject: 'Renewal Pricing Proposal v2', summary: 'Sent updated pricing with 8% uplift and 3-year commitment discount', from: 'Ravi Kumar', to: 'procurement@acme.com', timestamp: daysAgo(2), party: 'customer' },
    { id: 2, type: 'meeting', direction: 'inbound', subject: 'Preliminary Renewal Discussion', summary: 'Discussed renewal scope, additional department needs, and budget constraints', from: 'Acme Procurement Team', to: 'Ravi Kumar', timestamp: daysAgo(7), party: 'customer' },
    { id: 3, type: 'email', direction: 'outbound', subject: 'Q2 Business Review Slides', summary: 'Shared Q2 review deck highlighting 94% compliance and 99.9% uptime', from: 'Ananya K.', to: 'john.smith@acme.com', timestamp: daysAgo(14), party: 'customer' },
  ],

  customerCommunications: [
    { id: 1, type: 'email', direction: 'inbound', subject: 'Feedback on Renewal Terms', summary: 'Customer expressing interest in 3-year deal but requesting better discount on add-on modules', from: 'john.smith@acme.com', to: 'Ravi Kumar', timestamp: daysAgo(4), party: 'vendor' },
    { id: 2, type: 'call', direction: 'outbound', subject: 'Follow-up on Pricing Query', summary: 'Discussed volume discount options for Advanced Analytics add-on. Offered tiered pricing.', from: 'Ravi Kumar', to: 'John Smith (Acme)', timestamp: daysAgo(5), party: 'vendor' },
    { id: 3, type: 'note', direction: 'inbound', subject: 'Internal — Discount Ceiling', summary: 'VP Sales confirmed max 12% discount on overall deal. No further room without CEO approval.', from: 'Ananya K.', to: 'Internal', timestamp: daysAgo(6), party: 'vendor' },
  ],

  documents: [
    { id: 1, fileName: 'Renewal_Proposal_v2_Acme.pdf', type: 'PDF', uploadedBy: 'Ravi Kumar', uploadedAt: daysAgo(2), size: '2.4 MB', status: 'uploaded' },
    { id: 2, fileName: 'Q3_Usage_Report_Acme.xlsx', type: 'Spreadsheet', uploadedBy: 'Ananya K.', uploadedAt: daysAgo(10), size: '1.8 MB', status: 'uploaded' },
    { id: 3, fileName: 'Acme_Corp_Performance_Review_Q3.pptx', type: 'Presentation', uploadedBy: 'Ananya K.', uploadedAt: daysAgo(15), size: '6.2 MB', status: 'uploaded' },
    { id: 4, fileName: 'Renewal_Terms_Checklist.pdf', type: 'PDF', uploadedBy: 'Ravi Kumar', uploadedAt: daysAgo(3), size: '0.7 MB', status: 'uploaded' },
    { id: 5, fileName: 'Current_Agreement_ELA_v3.pdf', type: 'PDF', uploadedBy: 'System', uploadedAt: daysAgo(45), size: '3.1 MB', status: 'required' },
    { id: 6, fileName: 'Signed_NDA_Addendum.pdf', type: 'PDF', uploadedBy: 'System', uploadedAt: daysAgo(60), size: '0.5 MB', status: 'expired' },
    { id: 7, fileName: 'Vendor_Quote_Q4.xlsx', type: 'Spreadsheet', uploadedBy: '', uploadedAt: '', size: '', status: 'missing' },
    { id: 8, fileName: 'Compliance_Certification_2025.pdf', type: 'PDF', uploadedBy: '', uploadedAt: '', size: '', status: 'missing' },
  ],

  purchaseOrders: [
    { id: 1, number: 'PO-2024-0042', amount: 2400000, status: 'completed', issuedDate: '2024-01-10', expiryDate: '2024-07-10', department: 'Enterprise Sales' },
    { id: 2, number: 'PO-2025-0001', amount: 500000, status: 'partial', issuedDate: daysFromNow(-15), expiryDate: daysFromNow(75), department: 'Enterprise Sales' },
    { id: 3, number: 'PO-2025-0003', amount: 300000, status: 'draft', issuedDate: '', expiryDate: '', department: 'Enterprise Sales' },
  ],

  invoices: [
    { id: 1, number: 'INV-2024-0001', amount: 400000, status: 'paid', dueDate: '2024-02-15', paidDate: '2024-02-10', linkedPO: 'PO-2024-0042' },
    { id: 2, number: 'INV-2024-0002', amount: 800000, status: 'paid', dueDate: '2024-05-15', paidDate: '2024-05-12', linkedPO: 'PO-2024-0042' },
    { id: 3, number: 'INV-2025-0001', amount: 500000, status: 'pending', dueDate: daysFromNow(20), linkedPO: 'PO-2025-0001' },
    { id: 4, number: 'INV-2025-0002', amount: 750000, status: 'draft', dueDate: daysFromNow(45), linkedPO: 'PO-2025-0003' },
  ],

  activity: [
    { id: 1, type: 'renewal_initiated', title: 'Renewal Process Initiated', description: 'Ravi Kumar started renewal workflow for Acme Corp', timestamp: daysAgo(45), user: 'Ravi Kumar' },
    { id: 2, type: 'performance_reviewed', title: 'Performance Review Completed', description: 'Q2-Q3 performance reviewed — 94% compliance rate, 4.5/5 satisfaction', timestamp: daysAgo(35), user: 'Ananya K.' },
    { id: 3, type: 'proposal_sent', title: 'Preliminary Proposal Sent', description: 'Initial renewal proposal with 5% early discount sent to Acme procurement', timestamp: daysAgo(21), user: 'Ravi Kumar' },
    { id: 4, type: 'approval_submitted', title: 'Pricing Approval Requested', description: 'Internal approval for 8% uplift pricing submitted to VP Sales', timestamp: daysAgo(22), user: 'Ravi Kumar' },
    { id: 5, type: 'approval_granted', title: 'VP Sales Approval Granted', description: 'Ananya K. approved the pricing revision recommendation', timestamp: daysAgo(20), user: 'Ananya K.' },
    { id: 6, type: 'proposal_updated', title: 'Proposal Updated to v2', description: 'Revised pricing with 8% uplift, 3-year commitment, and tiered add-on pricing', timestamp: daysAgo(2), user: 'Ravi Kumar' },
    { id: 7, type: 'document_uploaded', title: 'Renewal Proposal v2 Uploaded', description: 'Final proposal document uploaded for customer review', timestamp: daysAgo(2), user: 'Ravi Kumar' },
    { id: 8, type: 'task_completed', title: 'Headcount Verification Done', description: 'Support team verified license count matches current employee roster', timestamp: daysAgo(1), user: 'Support Team' },
  ],

  healthScore: 72,
  healthLevel: 'good',
  healthFactors: [
    { label: 'Timeline Adherence', status: 'healthy', detail: 'On track with renewal timeline', score: 85, max: 100 },
    { label: 'Customer Engagement', status: 'warning', detail: 'Customer responsive but pricing negotiation in progress', score: 65, max: 100 },
    { label: 'Internal Alignment', status: 'warning', detail: 'Pending approvals from VP Finance and CEO', score: 55, max: 100 },
    { label: 'Documentation Readiness', status: 'healthy', detail: 'All required documents prepared', score: 90, max: 100 },
    { label: 'Risk Exposure', status: 'healthy', detail: 'Low competitive risk, strong relationship', score: 80, max: 100 },
  ],

  risks: [
    { severity: 'medium', message: 'Pricing approval from VP Finance may be delayed due to quarterly close', category: 'Internal Process' },
    { severity: 'high', message: 'Customer requested additional discount — may impact margin targets below 25%', category: 'Commercial' },
    { severity: 'medium', message: 'Competitor XYZ reaching out to Acme procurement — monitor closely', category: 'Competitive' },
    { severity: 'low', message: 'Vendor quote for pass-through costs overdue by 5 days', category: 'Procurement' },
  ],

  notifications: [
    { id: 1, type: 'approval', message: 'VP Finance approval pending — 3 days overdue', timestamp: daysAgo(3), read: false },
    { id: 2, type: 'document', message: 'Compliance certification document missing — action required', timestamp: daysAgo(5), read: false },
    { id: 3, type: 'task', message: 'Pricing proposal task overdue — due yesterday', timestamp: daysAgo(1), read: false },
    { id: 4, type: 'message', message: 'Customer replied to renewal terms email', timestamp: daysAgo(1), read: true },
    { id: 5, type: 'system', message: 'SLA countdown: 45 days remaining in renewal window', timestamp: daysAgo(0), read: true },
  ],

  upcomingDeadlines: [
    { id: 1, label: 'VP Finance Approval', date: daysAgo(1), type: 'approval', assignee: 'Priya Sharma' },
    { id: 2, label: 'Customer Proposal Walkthrough', date: daysFromNow(5), type: 'review', assignee: 'Ravi Kumar' },
    { id: 3, label: 'Revised Pricing Submission', date: daysAgo(2), type: 'review', assignee: 'Ravi Kumar' },
    { id: 4, label: 'Contract Signing Deadline', date: daysFromNow(45), type: 'signature', assignee: 'Both Parties' },
  ],

  recommendedAction: {
    text: 'Follow up with Priya Sharma (VP Finance) on pricing approval. Prepare customer presentation deck for proposal walkthrough scheduled this week.',
    urgency: 'high',
    actionLabel: 'Follow Up on Approval',
    dueDate: daysFromNow(2),
  },

  progressPercent: 55,
}
