import api from './axios'

// Types
export interface Notification {
  id: number
  contract_id: number
  notification_type: string
  send_date: string
  status: string
  message: string | null
}

export interface CreateNotificationData {
  contract_id: number
  notification_type: string
  status: string
  message?: string
}

export interface TestNotificationData {
  contract_id: number
  type: 'email' | 'mobile'
}

export interface NotificationSettingsData {
  notification_enabled?: boolean
  notification_email?: string
  notification_mobile?: boolean
}

// Notifications API
export const notificationsApi = {
  // Get all notifications
  getNotifications: async (contractId?: number, limit?: number): Promise<Notification[]> => {
    const params: any = {}
    if (contractId) params.contract_id = contractId
    if (limit) params.limit = limit
    const response = await api.get('/notifications', { params })
    return response.data as Notification[]
  },

  // Create notification
  createNotification: async (data: CreateNotificationData): Promise<Notification> => {
    const response = await api.post('/notifications', data)
    return response.data as Notification
  },

  // Send test notification
  sendTestNotification: async (data: TestNotificationData): Promise<{ success: boolean; message: string; type: string }> => {
    const response = await api.post('/notifications/send-test', data)
    return response.data as { success: boolean; message: string; type: string }
  },

  // Check renewals (manual trigger)
  checkRenewals: async (): Promise<{ success: boolean; results: any }> => {
    const response = await api.post('/notifications/check-renewals')
    return response.data as { success: boolean; results: any }
  },

  // Get notification history for contract
  getNotificationHistory: async (contractId: number): Promise<Notification[]> => {
    const response = await api.get(`/notifications/history/${contractId}`)
    return response.data as Notification[]
  },

  // Update notification settings for contract
  updateNotificationSettings: async (contractId: number, data: NotificationSettingsData): Promise<{ success: boolean; message: string; contract: any }> => {
    const response = await api.put(`/notifications/settings/${contractId}`, data)
    return response.data as { success: boolean; message: string; contract: any }
  },

  // Configure global notification settings
  configureNotifications: async (data: any): Promise<{ success: boolean; message: string; config: any }> => {
    const response = await api.post('/notifications/configure', data)
    return response.data as { success: boolean; message: string; config: any }
  },
}

export default notificationsApi
