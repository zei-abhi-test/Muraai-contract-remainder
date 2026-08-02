export interface ContractNote {
  id: string
  author: string
  content: string
  timestamp: string
}

export interface HealthFactor {
  label: string
  status: 'healthy' | 'warning' | 'critical'
  detail: string
  score: number
  max: number
}

export interface RiskIndicator {
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
}

export interface ProductLineItem {
  id: number
  productName: string
  sku: string
  quantity: number
  rate: number
  discount: number
  tax: number
  lineTotal: number
}

export interface RenewalRecord {
  id: number
  version: string
  startDate: string
  endDate: string
  value: number
  status: string
}

export interface ActivityEntry {
  id: number
  type: string
  title: string
  description: string
  timestamp: string
  user: string
}

export interface DocumentItem {
  id: number
  fileName: string
  type: string
  uploadedBy: string
  uploadedAt: string
  size: string
}

export interface CommunicationEntry {
  id: number
  type: 'email' | 'note' | 'meeting' | 'call'
  subject: string
  summary: string
  from: string
  to: string
  timestamp: string
}

export interface InvoiceSummary {
  id: number
  number: string
  amount: number
  status: string
  dueDate: string
  paidDate?: string
}

export interface ApprovalRecord {
  id: number
  step: number
  approver: string
  role: string
  status: 'pending' | 'approved' | 'rejected'
  comments: string
  timestamp: string
}

export interface RelatedOrganization {
  id: number
  name: string
  type: 'customer' | 'partner' | 'vendor' | 'regulatory'
  role: string
  contactPerson: string
  email: string
  phone: string
}

export interface ContractWorkspaceData {
  id: number
  name: string
  contractNumber: string
  status: string
  description: string
  companyName: string
  totalValue: number
  currency: string
  startDate: string
  endDate: string
  renewalDate: string
  paymentTerms: string
  owner: string
  department: string
  healthScore: number
  healthLevel: string
  healthFactors: HealthFactor[]
  riskIndicators: RiskIndicator[]
  notes: ContractNote[]
  products: ProductLineItem[]
  renewals: RenewalRecord[]
  activity: ActivityEntry[]
  documents: DocumentItem[]
  communications: CommunicationEntry[]
  invoices: InvoiceSummary[]
  approvals: ApprovalRecord[]
  analytics: {
    monthlyUsage: { month: string; value: number }[]
    complianceRate: number
    avgResponseTime: string
    satisfactionScore: number
  }
  organizations: RelatedOrganization[]
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

export const mockContractWorkspaceData: ContractWorkspaceData = {
  id: 101,
  name: 'Enterprise License Agreement',
  contractNumber: 'CONT-2024-001',
  status: 'active',
  description: 'Master enterprise license agreement covering all commercial terms for Acme Corp\'s usage of the Muraai platform across 5 departments. Includes volume discounts, SLA commitments, and annual true-up provisions.',
  companyName: 'Acme Corporation',
  totalValue: 2400000,
  currency: 'INR',
  startDate: '2024-01-15',
  endDate: '2026-01-14',
  renewalDate: '2025-11-15',
  paymentTerms: 'Net 45',
  owner: 'Ravi Kumar',
  department: 'Enterprise Sales',
  healthScore: 78,
  healthLevel: 'good',
  healthFactors: [
    { label: 'Payment History', status: 'healthy', detail: 'All invoices paid within terms', score: 95, max: 100 },
    { label: 'Compliance', status: 'healthy', detail: 'All regulatory requirements met', score: 88, max: 100 },
    { label: 'Usage', status: 'warning', detail: 'Usage at 72% of licensed capacity', score: 72, max: 100 },
    { label: 'Communication', status: 'healthy', detail: 'Regular check-ins maintained', score: 85, max: 100 },
    { label: 'Renewal Risk', status: 'warning', detail: 'Renewal discussion not yet initiated', score: 50, max: 100 },
  ],
  riskIndicators: [
    { severity: 'medium', message: 'Usage approaching licensed capacity — may require upselling' },
    { severity: 'low', message: 'Renewal date approaching in 4 months — start preparation' },
  ],
  notes: [
    { id: 'n1', author: 'Ravi Kumar', content: 'Discussed expansion opportunities with Acme CFO. They are interested in adding 2 more departments by Q4.', timestamp: daysAgo(2) },
    { id: 'n2', author: 'Ananya K.', content: 'Q2 business review completed. Customer satisfaction score: 4.5/5. No escalations.', timestamp: daysAgo(14) },
  ],
  products: [
    { id: 1, productName: 'Muraai Contract Management Suite', sku: 'MUR-CM-ENT', quantity: 500, rate: 3200, discount: 15, tax: 18, lineTotal: 1520000 },
    { id: 2, productName: 'Advanced Analytics Add-on', sku: 'MUR-ANL-PRO', quantity: 50, rate: 5800, discount: 10, tax: 18, lineTotal: 286200 },
    { id: 3, productName: 'API Integration Package', sku: 'MUR-API-ENT', quantity: 3, rate: 120000, discount: 0, tax: 18, lineTotal: 424800 },
    { id: 4, productName: 'Premium Support - 24x7', sku: 'MUR-SUP-PRM', quantity: 1, rate: 240000, discount: 0, tax: 18, lineTotal: 283200 },
  ],
  renewals: [
    { id: 1, version: 'v1 (Initial)', startDate: '2022-01-15', endDate: '2023-01-14', value: 1200000, status: 'completed' },
    { id: 2, version: 'v2 (Renewed)', startDate: '2023-01-15', endDate: '2024-01-14', value: 1800000, status: 'completed' },
    { id: 3, version: 'v3 (Current)', startDate: '2024-01-15', endDate: '2026-01-14', value: 2400000, status: 'active' },
  ],
  activity: [
    { id: 1, type: 'contract_created', title: 'Contract Created', description: 'Contract drafted by Ravi Kumar with initial terms', timestamp: daysAgo(365), user: 'Ravi Kumar' },
    { id: 2, type: 'contract_submitted', title: 'Submitted for Approval', description: 'Submitted to legal team for review', timestamp: daysAgo(360), user: 'Ravi Kumar' },
    { id: 3, type: 'contract_approved', title: 'Approved by Legal', description: 'Legal team approved all terms and conditions', timestamp: daysAgo(358), user: 'Legal Team' },
    { id: 4, type: 'contract_activated', title: 'Contract Activated', description: 'Contract activated — customer onboarded successfully', timestamp: daysAgo(355), user: 'System' },
    { id: 5, type: 'invoice_paid', title: 'Invoice Paid', description: 'INV-2024-0001 — ₹4,00,000 received', timestamp: daysAgo(330), user: 'System' },
    { id: 6, type: 'document_uploaded', title: 'Document Uploaded', description: 'Signed agreement uploaded by Ananya K.', timestamp: daysAgo(300), user: 'Ananya K.' },
    { id: 7, type: 'contract_updated', title: 'Terms Amended', description: 'Added 2 new departments to license scope', timestamp: daysAgo(180), user: 'Ravi Kumar' },
    { id: 8, type: 'invoice_paid', title: 'Invoice Paid', description: 'INV-2024-0002 — ₹8,00,000 received', timestamp: daysAgo(150), user: 'System' },
    { id: 9, type: 'renewal_due', title: 'Renewal Reminder Sent', description: 'System sent renewal reminder — 6 months remaining', timestamp: daysAgo(30), user: 'System' },
  ],
  documents: [
    { id: 1, fileName: 'Enterprise_Agreement_v3_Signed.pdf', type: 'PDF', uploadedBy: 'Ananya K.', uploadedAt: daysAgo(300), size: '3.2 MB' },
    { id: 2, fileName: 'Amendment_1_AddDepts.pdf', type: 'PDF', uploadedBy: 'Ravi Kumar', uploadedAt: daysAgo(180), size: '1.1 MB' },
    { id: 3, fileName: 'Q2_Business_Review_2024.pptx', type: 'Presentation', uploadedBy: 'Ananya K.', uploadedAt: daysAgo(14), size: '5.8 MB' },
    { id: 4, fileName: 'Acme_Corp_Onboarding_Checklist.xlsx', type: 'Spreadsheet', uploadedBy: 'Priya S.', uploadedAt: daysAgo(350), size: '0.9 MB' },
  ],
  communications: [
    { id: 1, type: 'meeting', subject: 'Q2 Business Review', summary: 'Reviewed platform usage, satisfaction score 4.5/5. Discussed expansion opportunities for Q3.', from: 'Ravi Kumar', to: 'Acme Corp Stakeholders', timestamp: daysAgo(14) },
    { id: 2, type: 'email', subject: 'Renewal Terms Discussion', summary: 'Sent preliminary renewal terms. Awaiting feedback from Acme procurement team.', from: 'Ravi Kumar', to: 'procurement@acme.com', timestamp: daysAgo(7) },
    { id: 3, type: 'note', subject: 'Internal Note - Pricing', summary: 'Discussed with VP Sales — can offer 5% discount on early renewal if committed by Oct.', from: 'Ananya K.', to: 'Internal', timestamp: daysAgo(3) },
    { id: 4, type: 'call', subject: 'Support Escalation Call', summary: 'Resolved API latency issue. Response time improved from 2.3s to 0.4s.', from: 'Support Team', to: 'Acme IT Team', timestamp: daysAgo(20) },
  ],
  invoices: [
    { id: 1, number: 'INV-2024-0001', amount: 400000, status: 'paid', dueDate: '2024-02-15', paidDate: '2024-02-10' },
    { id: 2, number: 'INV-2024-0002', amount: 800000, status: 'paid', dueDate: '2024-05-15', paidDate: '2024-05-12' },
    { id: 3, number: 'INV-2024-0003', amount: 800000, status: 'paid', dueDate: '2024-08-15', paidDate: '2024-08-14' },
    { id: 4, number: 'INV-2024-0004', amount: 400000, status: 'pending', dueDate: daysFromNow(15), paidDate: undefined },
  ],
  approvals: [
    { id: 1, step: 1, approver: 'Vikram Mehta', role: 'VP Legal', status: 'approved', comments: 'Terms reviewed and compliant with company policy.', timestamp: daysAgo(358) },
    { id: 2, step: 2, approver: 'Priya Sharma', role: 'VP Finance', status: 'approved', comments: 'Pricing within approved range. Budget allocated.', timestamp: daysAgo(357) },
    { id: 3, step: 3, approver: 'Arun Nair', role: 'CEO', status: 'approved', comments: 'Approved. Strategic account — proceed with signing.', timestamp: daysAgo(356) },
  ],
  analytics: {
    monthlyUsage: [
      { month: 'Feb', value: 320 }, { month: 'Mar', value: 380 },
      { month: 'Apr', value: 410 }, { month: 'May', value: 390 },
      { month: 'Jun', value: 430 }, { month: 'Jul', value: 360 },
    ],
    complianceRate: 94,
    avgResponseTime: '2.4 hours',
    satisfactionScore: 4.5,
  },
  organizations: [
    { id: 1, name: 'Acme Corporation', type: 'customer', role: 'Licensee', contactPerson: 'John Smith', email: 'john.smith@acme.com', phone: '+1-555-0101' },
    { id: 2, name: 'TechLaw Partners', type: 'partner', role: 'Legal Counsel', contactPerson: 'Sarah Chen', email: 'sarah@techlaw.com', phone: '+1-555-0202' },
    { id: 3, name: 'Acme IT Services', type: 'vendor', role: 'Implementation Partner', contactPerson: 'Mike Johnson', email: 'mike@acme-it.com', phone: '+1-555-0303' },
  ],
}
