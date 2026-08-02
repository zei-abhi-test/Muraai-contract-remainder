import api from './axios'

// Types
export interface Contract {
  id: number
  company_name: string
  contract_name: string
  start_date: string
  end_date: string
  renewal_date: string
  notification_enabled: boolean
  notification_email: string | null
  notification_mobile: boolean
  notes: string | null
  contract_number: string | null
  customer_id: number | null
  contact_person_id: number | null
  contract_type_id: number | null
  contract_date: string | null
  status: string
  currency: string
  payment_terms: string | null
  remarks: string | null
  total_contract_value: number
  contract_version: number
  parent_contract_id: number | null
  previous_contract_id: number | null
  created_by_id: number | null
  last_modified_by_id: number | null
  created_at: string
  updated_at: string
  user_id: number
  days_until_end: number | null
  health_status: string | null
  next_reminder_date: string | null
  total_reminders_sent: number
  last_reminder_sent_at: string | null
  last_reminder_type: string | null
  last_reminder_message: string | null
  allowed_actions: string[]
}

export interface ContractLineItem {
  id: number
  contract_id: number
  product_id: number | null
  sku: string | null
  product_name: string
  quantity: number
  rate: number
  discount: number
  tax: number
  amount: number
  line_total: number
  remarks: string | null
  created_at: string
  updated_at: string
}

export interface ContractDocument {
  id: number
  contract_id: number
  file_name: string
  stored_file_name: string
  content_type: string | null
  uploaded_at: string
  uploaded_by_id: number | null
}

export interface CreateContractData {
  company_name: string
  contract_name: string
  start_date: string
  end_date: string
  renewal_date: string
  notification_enabled?: boolean
  notification_email?: string
  notification_mobile?: boolean
  notes?: string
  contract_number?: string
  customer_id?: number
  contact_person_id?: number
  contract_type_id?: number
  contract_date?: string
  status?: string
  currency?: string
  payment_terms?: string
  remarks?: string
  contract_version?: number
  parent_contract_id?: number
  previous_contract_id?: number
  line_items?: ContractLineItem[]
}

export interface UpdateContractData extends Partial<CreateContractData> {}

export interface ContractFilters {
  user_id?: number
  upcoming_only?: boolean
  status?: 'active' | 'ending-soon' | 'critical' | 'expired'
}

export interface DashboardData {
  active_contracts: Contract[]
  ending_soon_contracts: Contract[]
  critical_contracts: Contract[]
  expired_contracts: Contract[]
  upcoming_renewals: Contract[]
  upcoming_expiries: Contract[]
  overdue_contracts: Contract[]
  total_contracts: number
  active_count: number
  ending_soon_count: number
  critical_count: number
  expired_count: number
  total_reminders_sent: number
  upcoming_count: number
  overdue_count: number
  pending_approvals: number
  renewals_due: number
  outstanding_invoice_amount: number
  overdue_invoices: number
}

export interface HealthFactor {
  label: string
  score: number
  max: number
  status: string
  detail: string
}

export interface HealthScore {
  score: number
  level: string
  factors: HealthFactor[]
}

export interface ReadinessCheck {
  label: string
  field: string
  passed: boolean
  detail: string
}

export interface Readiness {
  checks: ReadinessCheck[]
  passed: number
  total: number
  ready: boolean
}

export interface RiskIndicator {
  type: string
  severity: string
  message: string
  days?: number
}

export interface VersionComparison {
  current_version: number
  previous_version: number
  line_items: {
    added: ContractLineItem[]
    removed: ContractLineItem[]
    changed: { product_name: string; previous: ContractLineItem; current: ContractLineItem }[]
  } | null
  dates: { field: string; previous: string | null; current: string | null }[] | null
  prices: { field: string; previous: number; current: number }[] | null
  payment_terms: { field: string; previous: string | null; current: string | null }[] | null
}

export interface ContractAssistance {
  contract_id: number
  contract_name: string
  health_score: HealthScore
  readiness: Readiness
  risks: RiskIndicator[]
  version_comparison: VersionComparison | null
}

// Contracts API
export const contractsApi = {
  // Get all contracts with filtering
  getContracts: async (filters: ContractFilters = {}): Promise<Contract[]> => {
    const response = await api.get('/contracts', { params: filters })
    return response.data as Contract[]
  },

  // Get single contract by ID
  getContract: async (id: number): Promise<Contract> => {
    const response = await api.get(`/contracts/${id}`)
    return response.data as Contract
  },

  // Create new contract
  createContract: async (data: CreateContractData): Promise<Contract> => {
    const response = await api.post('/contracts', data)
    return response.data as Contract
  },

  // Update contract
  updateContract: async (id: number, data: UpdateContractData): Promise<Contract> => {
    const response = await api.put(`/contracts/${id}`, data)
    return response.data as Contract
  },

  // Delete contract
  deleteContract: async (id: number): Promise<void> => {
    await api.delete(`/contracts/${id}`)
  },

  // Get dashboard data
  getDashboard: async (filters: ContractFilters = {}): Promise<DashboardData> => {
    const response = await api.get('/contracts/dashboard', { params: filters })
    return response.data as DashboardData
  },

  // Get contract line items
  getLineItems: async (contractId: number): Promise<ContractLineItem[]> => {
    const response = await api.get(`/contracts/${contractId}/line-items`)
    return response.data as ContractLineItem[]
  },

  // Create contract line item
  createLineItem: async (contractId: number, data: Omit<ContractLineItem, 'id' | 'contract_id' | 'created_at' | 'updated_at'>): Promise<ContractLineItem> => {
    const response = await api.post(`/contracts/${contractId}/line-items`, data)
    return response.data as ContractLineItem
  },

  // Get contract documents
  getDocuments: async (contractId: number): Promise<ContractDocument[]> => {
    const response = await api.get(`/contracts/${contractId}/documents`)
    return response.data as ContractDocument[]
  },

  // Upload contract document
  uploadDocument: async (contractId: number, file: File): Promise<ContractDocument> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post(`/contracts/${contractId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data as ContractDocument
  },

  // Renew contract
  renewContract: async (contractId: number, data: Partial<CreateContractData>): Promise<Contract> => {
    const response = await api.post(`/contracts/${contractId}/renew`, data)
    return response.data as Contract
  },

  // Get renewal history
  getRenewalHistory: async (contractId: number): Promise<Contract[]> => {
    const response = await api.get(`/contracts/${contractId}/renewal-history`)
    return response.data as Contract[]
  },

  // Get contract assistance (health score, readiness, risks, version comparison)
  getAssistance: async (contractId: number): Promise<ContractAssistance> => {
    const response = await api.get(`/contracts/${contractId}/assistance`)
    return response.data as ContractAssistance
  },
}

export default contractsApi
