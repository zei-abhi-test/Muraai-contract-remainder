import api from './axios'

export interface PortalCustomer {
  id: number
  name: string
  email: string | null
  phone: string | null
  portal_email: string
}

export interface PortalLoginResponse {
  token: string
  customer: PortalCustomer
}

export interface PortalDashboard {
  total_contracts: number
  active_contracts: number
  expiring_soon: number
  expired_contracts: number
  recent_contracts: {
    id: number
    contract_name: string
    status: string
    end_date: string | null
  }[]
}

export interface PortalContract {
  id: number
  contract_name: string
  company_name: string
  contract_number: string | null
  status: string
  start_date: string | null
  end_date: string | null
  renewal_date: string | null
  total_contract_value: number
  currency: string
  days_until_end: number | null
}

export interface PortalContractDetail extends PortalContract {
  notes: string | null
  line_items: any[]
  documents: any[]
  renewal_info: {
    original_contract_id: number
    previous_contract_id: number
    renewed_at: string
  } | null
}

export interface PortalInvoice {
  id: number
  invoice_number: string
  amount: number
  invoice_date: string | null
  due_date: string | null
  status: string
  contract_id: number | null
}

export interface PortalPurchaseOrder {
  id: number
  po_number: string
  vendor: string
  amount: number
  status: string
  created_at: string | null
}

export interface PortalDocument {
  id: number
  file_name: string
  stored_file_name: string
  content_type: string | null
  uploaded_at: string | null
}

const portalApi = api

export const customerPortalApi = {
  login: async (email: string, password: string): Promise<PortalLoginResponse> => {
    const r = await portalApi.post('/portal/auth/login', { email, password })
    return r.data as PortalLoginResponse
  },

  getMe: async (): Promise<PortalCustomer> => {
    const r = await portalApi.get('/portal/auth/me')
    return r.data as PortalCustomer
  },

  getDashboard: async (): Promise<PortalDashboard> => {
    const r = await portalApi.get('/portal/dashboard')
    return r.data as PortalDashboard
  },

  getContracts: async (): Promise<PortalContract[]> => {
    const r = await portalApi.get('/portal/contracts')
    return r.data as PortalContract[]
  },

  getContractDetail: async (contractId: number): Promise<PortalContractDetail> => {
    const r = await portalApi.get(`/portal/contracts/${contractId}`)
    return r.data as PortalContractDetail
  },

  getInvoices: async (): Promise<PortalInvoice[]> => {
    const r = await portalApi.get('/portal/invoices')
    return r.data as PortalInvoice[]
  },

  downloadInvoice: async (invoiceId: number): Promise<Blob> => {
    const r = await portalApi.get(`/portal/invoices/${invoiceId}/download`, { responseType: 'blob' })
    return r.data
  },

  getPurchaseOrders: async (): Promise<PortalPurchaseOrder[]> => {
    const r = await portalApi.get('/portal/purchase-orders')
    return r.data as PortalPurchaseOrder[]
  },

  getDocuments: async (contractId: number): Promise<PortalDocument[]> => {
    const r = await portalApi.get(`/portal/contracts/${contractId}/documents`)
    return r.data as PortalDocument[]
  },

  uploadDocument: async (contractId: number, file: File): Promise<PortalDocument> => {
    const form = new FormData()
    form.append('file', file)
    const r = await portalApi.post(`/portal/contracts/${contractId}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return r.data as PortalDocument
  },
}
