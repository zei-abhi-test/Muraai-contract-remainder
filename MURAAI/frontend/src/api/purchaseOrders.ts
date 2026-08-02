import api from './axios'

export interface PurchaseOrder {
  id: number
  po_number: string
  po_date: string
  vendor: string
  customer_id: number | null
  amount: number
  status: string
  issue_date: string | null
  expected_delivery: string | null
  currency: string
  remarks: string | null
  contract_ids: number[]
  allowed_actions: string[]
  created_at: string
  updated_at: string
  user_id: number
}

export interface CreatePurchaseOrderData {
  po_number?: string
  po_date?: string
  vendor: string
  customer_id?: number | null
  amount: number | string
  status?: string
  issue_date?: string
  expected_delivery?: string
  currency?: string
  remarks?: string
  contract_ids?: number[]
}

export type UpdatePurchaseOrderData = Partial<CreatePurchaseOrderData>

export const purchaseOrdersApi = {
  getPurchaseOrders: async (filters?: { search?: string; contract_id?: number }): Promise<PurchaseOrder[]> => {
    const response = await api.get('/purchase-orders', { params: filters || {} })
    return response.data as PurchaseOrder[]
  },
  getPurchaseOrder: async (id: number): Promise<PurchaseOrder> => {
    const response = await api.get(`/purchase-orders/${id}`)
    return response.data as PurchaseOrder
  },
  createPurchaseOrder: async (data: CreatePurchaseOrderData): Promise<PurchaseOrder> => {
    const response = await api.post('/purchase-orders', data)
    return response.data as PurchaseOrder
  },
  updatePurchaseOrder: async (id: number, data: UpdatePurchaseOrderData): Promise<PurchaseOrder> => {
    const response = await api.put(`/purchase-orders/${id}`, data)
    return response.data as PurchaseOrder
  },
  deletePurchaseOrder: async (id: number): Promise<void> => {
    await api.delete(`/purchase-orders/${id}`)
  },
  submitPurchaseOrder: async (id: number): Promise<PurchaseOrder> => {
    const response = await api.post(`/purchase-orders/${id}/submit`)
    return response.data as PurchaseOrder
  },
  cancelPurchaseOrder: async (id: number): Promise<PurchaseOrder> => {
    const response = await api.post(`/purchase-orders/${id}/cancel`)
    return response.data as PurchaseOrder
  },
  markReceivedPurchaseOrder: async (id: number): Promise<PurchaseOrder> => {
    const response = await api.post(`/purchase-orders/${id}/mark-received`)
    return response.data as PurchaseOrder
  },
  duplicatePurchaseOrder: async (id: number): Promise<PurchaseOrder> => {
    const response = await api.post(`/purchase-orders/${id}/duplicate`)
    return response.data as PurchaseOrder
  },
  downloadPurchaseOrderPdf: async (id: number): Promise<Blob> => {
    const response = await api.get(`/purchase-orders/${id}/pdf`, { responseType: 'blob' })
    return response.data as Blob
  },
}

export default purchaseOrdersApi
