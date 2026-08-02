import api from './axios'

export interface InvoiceLineItem {
  id: number
  invoice_id: number
  product_id: number | null
  product_name: string
  sku: string | null
  quantity: number
  rate: number
  discount: number
  tax: number
  amount: number
}

export interface Invoice {
  id: number
  invoice_number: string
  contract_id: number | null
  customer_id: number | null
  purchase_order_id: number | null
  amount: number
  tax: number
  discount: number
  total: number
  currency: string
  invoice_date: string
  due_date: string | null
  paid_date: string | null
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED' | string
  remarks: string | null
  created_by: number | null
  line_items: InvoiceLineItem[]
  created_at: string
  updated_at: string
  user_id: number
}

export interface CreateInvoiceData {
  invoice_number?: string
  contract_id?: number | null
  customer_id?: number | null
  purchase_order_id?: number | null
  amount?: number | string
  tax?: number | string
  discount?: number | string
  total?: number | string
  currency?: string
  invoice_date?: string
  due_date?: string
  status?: string
  remarks?: string
  line_items?: Omit<InvoiceLineItem, 'id' | 'invoice_id' | 'created_at'>[]
}

export type UpdateInvoiceData = Partial<CreateInvoiceData>

export const invoicesApi = {
  getInvoices: async (filters?: { search?: string; contract_id?: number }): Promise<Invoice[]> => {
    const response = await api.get('/invoices', { params: filters || {} })
    return response.data as Invoice[]
  },
  getInvoice: async (id: number): Promise<Invoice> => {
    const response = await api.get(`/invoices/${id}`)
    return response.data as Invoice
  },
  createInvoice: async (data: CreateInvoiceData): Promise<Invoice> => {
    const response = await api.post('/invoices', data)
    return response.data as Invoice
  },
  updateInvoice: async (id: number, data: UpdateInvoiceData): Promise<Invoice> => {
    const response = await api.put(`/invoices/${id}`, data)
    return response.data as Invoice
  },
  deleteInvoice: async (id: number): Promise<void> => {
    await api.delete(`/invoices/${id}`)
  },
  issueInvoice: async (id: number): Promise<Invoice> => {
    const response = await api.post(`/invoices/${id}/issue`)
    return response.data as Invoice
  },
  markPaid: async (id: number): Promise<Invoice> => {
    const response = await api.post(`/invoices/${id}/mark-paid`)
    return response.data as Invoice
  },
  cancelInvoice: async (id: number): Promise<Invoice> => {
    const response = await api.post(`/invoices/${id}/cancel`)
    return response.data as Invoice
  },
  duplicateInvoice: async (id: number): Promise<Invoice> => {
    const response = await api.post(`/invoices/${id}/duplicate`)
    return response.data as Invoice
  },
  downloadInvoicePdf: async (id: number): Promise<Blob> => {
    const response = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' })
    return response.data as Blob
  },
  sendInvoiceEmail: async (id: number, toEmail: string): Promise<{ message: string; to_email: string }> => {
    const response = await api.post(`/invoices/${id}/send-email`, { to_email: toEmail })
    return response.data as { message: string; to_email: string }
  },
}

export default invoicesApi
