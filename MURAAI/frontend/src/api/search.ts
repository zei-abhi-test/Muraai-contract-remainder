import api from './axios'

export type SearchEntityType =
  | 'contract' | 'customer' | 'contact' | 'product' | 'invoice'
  | 'po' | 'document' | 'calendar_event' | 'report'
  | 'renewal' | 'vendor' | 'comment' | 'task' | 'approval'

export interface SearchResult {
  id: string
  type: SearchEntityType
  title: string
  subtitle: string
  entity_id: number
  entity_type: string
}

export interface CommandItem {
  id: string
  label: string
  icon: string
  action: 'navigate' | 'create'
  page: string
  params?: Record<string, any>
}

export const COMMANDS: CommandItem[] = [
  { id: 'create-contract', label: 'Create Contract', icon: 'FileText', action: 'create', page: 'contracts' },
  { id: 'create-customer', label: 'Create Customer', icon: 'Building2', action: 'create', page: 'customers' },
  { id: 'create-contact', label: 'Create Contact', icon: 'Users', action: 'create', page: 'contacts' },
  { id: 'create-product', label: 'Create Product', icon: 'Package', action: 'create', page: 'products' },
  { id: 'create-invoice', label: 'Create Invoice', icon: 'Receipt', action: 'create', page: 'invoices' },
  { id: 'create-po', label: 'Create Purchase Order', icon: 'ShoppingCart', action: 'create', page: 'purchase-orders' },
  { id: 'renew-contract', label: 'Renew Contract', icon: 'RefreshCw', action: 'navigate', page: 'renewals' },
  { id: 'navigate-renewals', label: 'Open Renewals', icon: 'RefreshCw', action: 'navigate', page: 'renewals' },
  { id: 'navigate-approvals', label: 'Open Approvals', icon: 'CheckCircle', action: 'navigate', page: 'approvals' },
  { id: 'navigate-inbox', label: 'Open Operational Inbox', icon: 'Inbox', action: 'navigate', page: 'operational-inbox' },
  { id: 'navigate-settings', label: 'Navigate to Settings', icon: 'Settings', action: 'navigate', page: 'settings' },
  { id: 'navigate-dashboard', label: 'Navigate to Dashboard', icon: 'LayoutDashboard', action: 'navigate', page: 'dashboard' },
  { id: 'navigate-calendar', label: 'Open Calendar', icon: 'Calendar', action: 'navigate', page: 'calendar' },
  { id: 'navigate-reports', label: 'Open Reports', icon: 'BarChart3', action: 'navigate', page: 'reports' },
]

const daysAgo = (d: number) => {
  const date = new Date(); date.setDate(date.getDate() - d)
  return date.toISOString().split('T')[0]
}

const daysFromNow = (d: number) => {
  const date = new Date(); date.setDate(date.getDate() + d)
  return date.toISOString().split('T')[0]
}

function matchQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase())
}

function mockSearch(query: string): SearchResult[] {
  const q = query.toLowerCase()
  const results: SearchResult[] = []
  let idCounter = 0

  const add = (type: SearchEntityType, title: string, subtitle: string, entity_id: number) => {
    if (matchQuery(title, q) || matchQuery(subtitle, q)) {
      results.push({ id: `${type}-${entity_id}`, type, title, subtitle, entity_id, entity_type: type })
    }
  }

  // Contracts
  const contracts = [
    { name: 'Enterprise License Agreement — Acme Corp', company: 'Acme Corporation', id: 101 },
    { name: 'SaaS Platform Subscription — GlobalTech', company: 'GlobalTech Industries', id: 102 },
    { name: 'Cloud Infrastructure Deal — TechCorp', company: 'TechCorp Solutions', id: 103 },
    { name: 'Partnership Framework — Startify Labs', company: 'Startify Labs', id: 104 },
    { name: 'Managed Services Contract — Beta Inc', company: 'Beta Inc', id: 105 },
    { name: 'Master Services Agreement — Zenith Corp', company: 'Zenith Corp', id: 106 },
    { name: 'Support & Maintenance — Gamma LLC', company: 'Gamma LLC', id: 107 },
    { name: 'Procurement Agreement — Omega Supplies', company: 'Omega Supplies', id: 108 },
    { name: 'Data Processing Agreement — CloudStack', company: 'CloudStack Inc', id: 109 },
    { name: 'Reseller Agreement — NovaTech', company: 'NovaTech Partners', id: 110 },
  ]
  contracts.forEach(c => add('contract', c.name, c.company, c.id))

  // Renewals
  const renewals = [
    { name: 'Enterprise License — Year 3 Renewal', company: 'Acme Corporation', id: 201 },
    { name: 'CloudServe Enterprise Agreement Renewal', company: 'CloudServe Inc', id: 202 },
    { name: 'Annual Support Renewal — DataVault', company: 'DataVault Systems', id: 203 },
    { name: 'Managed Services FY25 Renewal', company: 'Beta Inc', id: 204 },
    { name: 'Q3 Enterprise Renewal — PremierCorp', company: 'PremierCorp', id: 205 },
    { name: 'FinServ Enterprise Renewal FY26', company: 'FinServ Group', id: 206 },
    { name: 'StreamScale Usage-based Renewal', company: 'StreamScale', id: 207 },
    { name: 'HealthFirst Renewal QBR', company: 'HealthFirst', id: 208 },
  ]
  renewals.forEach(r => add('renewal', r.name, r.company, r.id))

  // Customers
  const customers = [
    { name: 'Acme Corporation', code: 'CUST-001', id: 1 },
    { name: 'GlobalTech Industries', code: 'CUST-002', id: 2 },
    { name: 'TechCorp Solutions', code: 'CUST-003', id: 3 },
    { name: 'Startify Labs', code: 'CUST-004', id: 4 },
    { name: 'Beta Inc', code: 'CUST-005', id: 5 },
    { name: 'Delta Services', code: 'CUST-006', id: 6 },
    { name: 'PremierCorp', code: 'CUST-007', id: 7 },
    { name: 'Zenith Corp', code: 'CUST-008', id: 8 },
    { name: 'CloudServe Inc', code: 'CUST-009', id: 9 },
    { name: 'DataVault Systems', code: 'CUST-010', id: 10 },
    { name: 'MegaCorp Enterprise', code: 'CUST-011', id: 11 },
    { name: 'RetailMax Corp', code: 'CUST-012', id: 12 },
    { name: 'CoreBank Financial', code: 'CUST-013', id: 13 },
    { name: 'GovCloud Systems', code: 'CUST-014', id: 14 },
    { name: 'EduTech Solutions', code: 'CUST-015', id: 15 },
  ]
  customers.forEach(c => add('customer', c.name, c.code, c.id))

  // Vendors
  const vendors = [
    { name: 'TechPartners Inc', category: 'Hardware Supplier', id: 301 },
    { name: 'Apex Logistics', category: 'Logistics Provider', id: 302 },
    { name: 'McKinsey Digital', category: 'Consulting Services', id: 303 },
    { name: 'SafeGuard Insurance', category: 'Insurance Partner', id: 304 },
    { name: 'StationeryWorld', category: 'Office Supplies', id: 305 },
    { name: 'AWS Enterprise Support', category: 'Cloud Infrastructure', id: 306 },
    { name: 'Global Consulting Partners', category: 'Management Consulting', id: 307 },
    { name: 'ApexDigital Solutions', category: 'Digital Agency', id: 308 },
  ]
  vendors.forEach(v => add('vendor', v.name, v.category, v.id))

  // Invoices
  const invoices = [
    { number: 'INV-2024-423', customer: 'Delta Manufacturing', amount: '$34,000', id: 401 },
    { number: 'INV-2024-456', customer: 'RetailMax Corp', amount: '$78,000', id: 402 },
    { number: 'INV-2024-445', customer: 'AWS Enterprise', amount: '$240,000', id: 403 },
    { number: 'INV-2025-001', customer: 'Acme Corporation', amount: '$500,000', id: 404 },
    { number: 'INV-2024-388', customer: 'BlueLine Corp', amount: '$12,450', id: 405 },
    { number: 'INV-2024-265', customer: 'StationeryWorld', amount: '$890', id: 406 },
    { number: 'INV-2024-301', customer: 'Old Account', amount: '$230', id: 407 },
    { number: 'INV-2025-002', customer: 'Acme Corporation', amount: '$750,000', id: 408 },
  ]
  invoices.forEach(i => add('invoice', i.number, `${i.customer} — ${i.amount}`, i.id))

  // Purchase Orders
  const pos = [
    { number: 'PO-2024-088', vendor: 'TechPartners Inc', amount: '$58,000', id: 501 },
    { number: 'PO-2024-092', vendor: 'Raw Materials Co', amount: '$92,000', id: 502 },
    { number: 'PO-2024-085', vendor: 'McKinsey Digital', amount: '$24,000', id: 503 },
    { number: 'PO-2024-095', vendor: 'Lab Equipment Co', amount: '$185,000', id: 504 },
    { number: 'PO-2024-099', vendor: 'Inventory Supplier', amount: '$420,000', id: 505 },
    { number: 'PO-2024-078', vendor: 'Office Renovation Co', amount: '$150,000', id: 506 },
    { number: 'PO-2024-054', vendor: 'Office Furniture Inc', amount: '$35,000', id: 507 },
    { number: 'PO-2025-001', vendor: 'Acme Corporation', amount: '$500,000', id: 508 },
  ]
  pos.forEach(p => add('po', p.number, `${p.vendor} — ${p.amount}`, p.id))

  // Documents
  const docs = [
    { name: 'Renewal_Proposal_v2_Acme.pdf', type: 'PDF', uploaded: 'Ravi Kumar', id: 601 },
    { name: 'Acme_Corp_Performance_Review_Q3.pptx', type: 'Presentation', uploaded: 'Ananya K.', id: 602 },
    { name: 'Q3_Usage_Report_Acme.xlsx', type: 'Spreadsheet', uploaded: 'Ananya K.', id: 603 },
    { name: 'Renewal_Terms_Checklist.pdf', type: 'PDF', uploaded: 'Ravi Kumar', id: 604 },
    { name: 'Current_Agreement_ELA_v3.pdf', type: 'PDF', uploaded: 'System', id: 605 },
    { name: 'NDA_v3_Orion_AI.pdf', type: 'PDF', uploaded: 'Legal Team', id: 606 },
    { name: 'SOW_ProServe_NorthWind.pdf', type: 'PDF', uploaded: 'Operations', id: 607 },
    { name: 'DPA_v2_Data_Processor.pdf', type: 'PDF', uploaded: 'Legal Team', id: 608 },
    { name: 'SOC2_Control_Evidence_Q2.xlsx', type: 'Spreadsheet', uploaded: 'Compliance', id: 609 },
    { name: 'Enterprise_Plus_SLA_Template.docx', type: 'Document', uploaded: 'Product Team', id: 610 },
  ]
  docs.forEach(d => add('document', d.name, `${d.type} · Uploaded by ${d.uploaded}`, d.id))

  // Tasks
  const tasks = [
    { title: 'Finalise pricing proposal document', assignee: 'Ravi Kumar', due: daysFromNow(3), id: 701 },
    { title: 'Schedule customer presentation with Acme', assignee: 'Ravi Kumar', due: daysFromNow(5), id: 702 },
    { title: 'Update SLA commitments for new tier', assignee: 'Legal Team', due: daysFromNow(10), id: 703 },
    { title: 'Prepare usage analytics report', assignee: 'Ananya K.', due: daysFromNow(2), id: 704 },
    { title: 'Verify headcount licensing', assignee: 'Support Team', due: daysFromNow(14), id: 705 },
    { title: 'Send vendor quote request to TechPartners', assignee: 'Ravi Kumar', due: daysAgo(1), id: 706 },
    { title: 'Upload compliance certification evidence', assignee: 'Compliance Team', due: daysFromNow(7), id: 707 },
    { title: 'Review contract amendment — Force Majeure', assignee: 'Legal Team', due: daysFromNow(2), id: 708 },
    { title: 'Complete DPDPA policy review', assignee: 'Legal Team', due: daysFromNow(15), id: 709 },
    { title: 'Process quarterly access certification', assignee: 'IT Security', due: daysFromNow(12), id: 710 },
  ]
  tasks.forEach(t => add('task', t.title, `${t.assignee} · Due ${t.due}`, t.id))

  // Approvals
  const approvals = [
    { title: 'Pricing Approval — Acme Renewal', approver: 'Priya Sharma', role: 'VP Finance', id: 801 },
    { title: 'CEO Approval — Acme Renewal', approver: 'Arun Nair', role: 'CEO', id: 802 },
    { title: 'VP Sales Approval — CloudServe', approver: 'Ananya K.', role: 'VP Sales', id: 803 },
    { title: 'Budget Approval — Q4 Inventory PO', approver: 'Finance Team', role: 'Budget Review', id: 804 },
    { title: 'SLA Exception Approval — FinTech Client', approver: 'Operations Director', role: 'Service Delivery', id: 805 },
    { title: 'Compliance Sign-off — SOC 2 Evidence', approver: 'Compliance Officer', role: 'Audit', id: 806 },
    { title: 'Credit Note Approval — INV-2024-423', approver: 'Finance Controller', role: 'Dispute Resolution', id: 807 },
    { title: 'Contract Amendment Approval — Force Majeure', approver: 'Legal Counsel', role: 'Contract Review', id: 808 },
  ]
  approvals.forEach(a => add('approval', a.title, `${a.approver} (${a.role})`, a.id))

  // Comments
  const comments = [
    { text: 'Customer requesting 22% discount on 3-year enterprise license', author: 'Ravi Kumar', entity: 'QTE-2024-107', id: 901 },
    { text: 'VP Sales confirmed max 12% discount on overall deal', author: 'Ananya K.', entity: 'Acme Renewal', id: 902 },
    { text: 'Supplier invoking force majeure due to port strike — amend timeline +60d', author: 'Legal Team', entity: 'Force Majeure Clause', id: 903 },
    { text: 'Usage data shows 94% compliance — strong renewal position', author: 'Ananya K.', entity: 'Acme Performance Review', id: 904 },
    { text: 'Customer expressed interest in 3-year deal but requesting better add-on pricing', author: 'John Smith', entity: 'Renewal Terms', id: 905 },
    { text: 'Competitor XYZ reaching out to Acme procurement — monitor closely', author: 'Ravi Kumar', entity: 'Competitive Intel', id: 906 },
    { text: 'Pricing approval from VP Finance may be delayed due to quarterly close', author: 'Ravi Kumar', entity: 'Acme Renewal', id: 907 },
    { text: 'NDA fully negotiated and approved by both legal teams — ready for signature', author: 'Legal Team', entity: 'CloudStack Reseller', id: 908 },
    { text: 'Client wants to switch from flat-fee to usage-based pricing', author: 'Account Manager', entity: 'StreamScale Renewal', id: 909 },
    { text: 'QBR meeting rescheduled to next Thursday — prepare updated deck', author: 'Ravi Kumar', entity: 'DataVault QBR', id: 910 },
  ]
  comments.forEach(c => add('comment', c.text, `${c.author} · on ${c.entity}`, c.id))

  // Contacts
  const contacts = [
    { name: 'John Smith', email: 'john.smith@acme.com', company: 'Acme Corporation', id: 1001 },
    { name: 'Sarah Chen', email: 'sarah.chen@globaltech.com', company: 'GlobalTech', id: 1002 },
    { name: 'Mike Johnson', email: 'mike.j@techcorp.com', company: 'TechCorp Solutions', id: 1003 },
    { name: 'Priya Sharma', email: 'priya.sharma@muraai.com', company: 'Muraai Inc.', id: 1004 },
    { name: 'Tom Rodriguez', email: 'tom.r@startify.io', company: 'Startify Labs', id: 1005 },
    { name: 'Lisa M.', email: 'lisa.m@betainc.com', company: 'Beta Inc', id: 1006 },
    { name: 'Ananya K.', email: 'ananya.k@muraai.com', company: 'Muraai Inc.', id: 1007 },
    { name: 'Ravi Kumar', email: 'ravi.kumar@muraai.com', company: 'Muraai Inc.', id: 1008 },
  ]
  contacts.forEach(c => add('contact', c.name, `${c.email} · ${c.company}`, c.id))

  // Products
  const products = [
    { name: 'Enterprise License — Premium Tier', sku: 'SKU-ENT-001', price: '$250,000/yr', id: 1101 },
    { name: 'SaaS Platform — Business Plan', sku: 'SKU-SaaS-002', price: '$12,000/mo', id: 1102 },
    { name: 'Cloud Infrastructure — Compute Pack', sku: 'SKU-CLD-003', price: '$8,000/mo', id: 1103 },
    { name: 'Managed Services — Standard', sku: 'SKU-MSVC-004', price: '$15,000/mo', id: 1104 },
    { name: 'Advanced Analytics Add-on', sku: 'SKU-ANL-005', price: '$5,000/mo', id: 1105 },
    { name: 'Support & Maintenance — Premium', sku: 'SKU-SUP-006', price: '$3,500/mo', id: 1106 },
    { name: 'Security Audit Package', sku: 'SKU-SEC-007', price: '$25,000', id: 1107 },
    { name: 'API Access — Enterprise Tier', sku: 'SKU-API-008', price: '$2,000/mo', id: 1108 },
  ]
  products.forEach(p => add('product', p.name, `${p.sku} · ${p.price}`, p.id))

  return results.slice(0, 25)
}

export const searchApi = {
  globalSearch: async (query: string): Promise<SearchResult[]> => {
    if (query.length < 2) return []
    try {
      const response = await api.get('/search', {
        params: { q: query, limit: 25 },
        timeout: 3000,
      })
      return response.data as SearchResult[]
    } catch {
      return mockSearch(query)
    }
  },
}

export default searchApi
