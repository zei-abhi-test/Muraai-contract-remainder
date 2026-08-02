import api from './axios'

export interface ActivityItem {
  id: number
  user_id: number
  contract_id: number | null
  activity_type: string
  title: string
  description: string | null
  entity_type: string | null
  entity_id: number | null
  is_read: boolean
  is_archived?: boolean
  created_at: string
}

export interface ActivityListParams {
  limit?: number
  offset?: number
  unread_first?: boolean
  search?: string
  category?: string
  archived?: boolean
}

export const ACTIVITY_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'purchase_orders', label: 'Purchase Orders' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'renewals', label: 'Renewals' },
  { id: 'documents', label: 'Documents' },
  { id: 'products', label: 'Products' },
] as const

export const ACTIVITY_TYPE_CATEGORY: Record<string, string> = {
  contract_created: 'contracts', contract_updated: 'contracts',
  contract_submitted: 'contracts', contract_approved: 'contracts',
  contract_rejected: 'contracts', contract_activated: 'contracts',
  contract_completed: 'contracts', contract_renewed: 'contracts',
  contract_expiring: 'contracts',
  invoice_created: 'invoices', invoice_updated: 'invoices',
  invoice_deleted: 'invoices', invoice_issued: 'invoices',
  invoice_paid: 'invoices', invoice_cancelled: 'invoices',
  invoice_sent: 'invoices', invoice_due: 'invoices',
  invoice_overdue: 'invoices',
  po_created: 'purchase_orders', po_updated: 'purchase_orders',
  po_deleted: 'purchase_orders', po_submitted: 'purchase_orders',
  po_cancelled: 'purchase_orders', po_completed: 'purchase_orders',
  po_mark_received: 'purchase_orders',
  approval_requested: 'approvals', approval_cancelled: 'approvals',
  renewal_due: 'renewals',
  document_uploaded: 'documents',
  product_added: 'products',
}

export const activityApi = {
  list: async (params: ActivityListParams = {}): Promise<ActivityItem[]> => {
    const { limit = 50, offset = 0, unread_first = true, search, category, archived } = params
    const queryParams: Record<string, any> = { limit, offset, unread_first }
    if (search) queryParams.search = search
    if (category && category !== 'all') queryParams.category = category
    if (archived) queryParams.archived = true
    const response = await api.get('/activity', { params: queryParams })
    return response.data as ActivityItem[]
  },

  unreadCount: async (): Promise<number> => {
    const response = await api.get('/activity/unread-count')
    return (response.data as { count: number }).count
  },

  markRead: async (id: number): Promise<ActivityItem> => {
    const response = await api.post(`/activity/${id}/read`)
    return response.data as ActivityItem
  },

  markAllRead: async (): Promise<void> => {
    await api.post('/activity/mark-all-read')
  },

  archive: async (id: number): Promise<ActivityItem> => {
    const response = await api.post(`/activity/${id}/archive`)
    return response.data as ActivityItem
  },

  archiveAll: async (): Promise<void> => {
    await api.post('/activity/archive-all')
  },

  contractActivity: async (contractId: number): Promise<ActivityItem[]> => {
    const response = await api.get(`/activity/contract/${contractId}`)
    return response.data as ActivityItem[]
  },
}
