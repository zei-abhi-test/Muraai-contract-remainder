import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'
import { queryKeys } from '@/lib/react-query'
import { toast } from 'sonner'

export function useNotifications(contractId?: number, limit?: number) {
  return useQuery({
    queryKey: queryKeys.notifications.list({ contractId, limit }),
    queryFn: () => notificationsApi.getNotifications(contractId, limit),
  })
}

export function useNotificationHistory(contractId: number) {
  return useQuery({
    queryKey: queryKeys.notifications.history(contractId),
    queryFn: () => notificationsApi.getNotificationHistory(contractId),
    enabled: !!contractId,
  })
}

export function useCreateNotification() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: notificationsApi.createNotification,
    onSuccess: () => {
      toast.success('Notification created successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create notification')
    },
  })
}

export function useSendTestNotification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: notificationsApi.sendTestNotification,
    onSuccess: (data) => {
      toast.success(data.message || 'Test notification sent')
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send test notification')
    },
  })
}

export function useCheckRenewals() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: notificationsApi.checkRenewals,
    onSuccess: (data) => {
      toast.success(`Renewal check completed. Found ${data.results?.length || 0} contracts.`)
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to check renewals')
    },
  })
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ contractId, data }: { contractId: number; data: any }) => 
      notificationsApi.updateNotificationSettings(contractId, data),
    onSuccess: (data) => {
      toast.success(data.message || 'Notification settings updated')
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update notification settings')
    },
  })
}

export function useConfigureNotifications() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: notificationsApi.configureNotifications,
    onSuccess: (data) => {
      toast.success(data.message || 'Notification configuration updated')
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to configure notifications')
    },
  })
}
