import api from './axios'

export interface Approval {
  id: number
  contract_id: number
  approver_id: number | null
  approver_name: string | null
  requested_by: number | null
  requester_name: string | null
  status: string
  comments: string | null
  approval_level: number | null
  submitted_at: string
  approved_at: string | null
  rejected_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
  contract_number?: string
  contract_name?: string
  company_name?: string
  customer_id?: number | null
  total_contract_value?: number
  contract_status?: string
}

export interface PaginatedApprovals {
  approvals: Approval[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface ApprovalFilters {
  status?: string
  search?: string
  page?: number
  per_page?: number
  contract_id?: number
}

export const approvalsApi = {
  getApprovals: async (params?: ApprovalFilters): Promise<PaginatedApprovals> => {
    const response = await api.get('/approvals', { params })
    return response.data as PaginatedApprovals
  },

  getApproval: async (id: number): Promise<Approval> => {
    const response = await api.get(`/approvals/${id}`)
    return response.data as Approval
  },

  approveRequest: async (id: number, data?: any): Promise<Approval> => {
    const response = await api.post(`/approvals/${id}/approve`, data || {})
    return response.data as Approval
  },

  rejectRequest: async (id: number, data: any): Promise<Approval> => {
    const response = await api.post(`/approvals/${id}/reject`, data)
    return response.data as Approval
  },

  cancelRequest: async (id: number): Promise<Approval> => {
    const response = await api.post(`/approvals/${id}/cancel`)
    return response.data as Approval
  },

  deleteRequest: async (id: number): Promise<void> => {
    await api.delete(`/approvals/${id}`)
  },

  getMyPendingApprovals: async (): Promise<Approval[]> => {
    const response = await api.get('/approvals', { params: { status: 'pending', per_page: 100 } })
    const data = response.data as PaginatedApprovals
    return data.approvals
  },

  requestApproval: async (contractId: number): Promise<any> => {
    const response = await api.post(`/contracts/${contractId}/submit`)
    return response.data
  },

  getApprovalStages: async (): Promise<any[]> => {
    return []
  },
}

export default approvalsApi
