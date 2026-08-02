import api from './axios'

export interface ProfileData {
  id: number
  username: string
  email: string
  name: string
  phone: string | null
  avatar_url: string | null
  role: string
  status: string
  last_login: string | null
  created_at: string
  updated_at: string
}

export interface OrganizationData {
  id?: number
  company_name: string | null
  address: string | null
  logo_url: string | null
  default_currency: string
  timezone: string
  fiscal_year: string | null
}

export interface UserPreferenceData {
  notification_email: boolean
  notification_push: boolean
  reminder_days: number
  invoice_reminder_days: number
  approval_notifications: boolean
  default_contract_type_id: number | null
  default_renewal_period_days: number
  default_payment_terms: string
  theme: string
}

export interface IntegrationData {
  id: number
  provider: string
  config: Record<string, any>
  enabled: boolean
}

export interface LoginHistoryEntry {
  id: number
  user_id: number
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface LoginHistoryResponse {
  items: LoginHistoryEntry[]
  total: number
  page: number
  per_page: number
  pages: number
}

export const settingsApi = {
  getProfile: async (): Promise<ProfileData> => {
    const r = await api.get('/settings/profile')
    return r.data as ProfileData
  },

  updateProfile: async (data: Partial<ProfileData & { new_password?: string; confirm_password?: string }>): Promise<ProfileData> => {
    const r = await api.put('/settings/profile', data)
    return r.data as ProfileData
  },

  getOrganization: async (): Promise<OrganizationData> => {
    const r = await api.get('/settings/organization')
    return r.data as OrganizationData
  },

  updateOrganization: async (data: Partial<OrganizationData>): Promise<OrganizationData> => {
    const r = await api.put('/settings/organization', data)
    return r.data as OrganizationData
  },

  getPreferences: async (): Promise<UserPreferenceData> => {
    const r = await api.get('/settings/preferences')
    return r.data as UserPreferenceData
  },

  updatePreferences: async (data: Partial<UserPreferenceData>): Promise<UserPreferenceData> => {
    const r = await api.put('/settings/preferences', data)
    return r.data as UserPreferenceData
  },

  listIntegrations: async (): Promise<IntegrationData[]> => {
    const r = await api.get('/settings/integrations')
    return r.data as IntegrationData[]
  },

  createIntegration: async (data: { provider: string; config?: any; enabled?: boolean }): Promise<IntegrationData> => {
    const r = await api.post('/settings/integrations', data)
    return r.data as IntegrationData
  },

  updateIntegration: async (id: number, data: Partial<IntegrationData>): Promise<IntegrationData> => {
    const r = await api.put(`/settings/integrations/${id}`, data)
    return r.data as IntegrationData
  },

  deleteIntegration: async (id: number): Promise<void> => {
    await api.delete(`/settings/integrations/${id}`)
  },

  changePassword: async (data: { current_password: string; new_password: string }): Promise<{ success: boolean; message: string }> => {
    const r = await api.put('/settings/security/password', data)
    return r.data as { success: boolean; message: string }
  },

  getSessions: async (): Promise<LoginHistoryEntry[]> => {
    const r = await api.get('/settings/security/sessions')
    return r.data as LoginHistoryEntry[]
  },

  getLoginHistory: async (page?: number, perPage?: number): Promise<LoginHistoryResponse> => {
    const r = await api.get('/settings/security/login-history', { params: { page, per_page: perPage } })
    return r.data as LoginHistoryResponse
  },
}
