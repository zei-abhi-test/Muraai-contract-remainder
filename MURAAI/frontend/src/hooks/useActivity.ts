import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { activityApi, type ActivityListParams } from '@/api/activity'

export const activityKeys = {
  all: ['activity'] as const,
  list: (params?: ActivityListParams) => ['activity', 'list', params] as const,
  unreadCount: () => ['activity', 'unread-count'] as const,
  contract: (id: number) => ['activity', 'contract', id] as const,
}

export function useActivityList(params?: ActivityListParams) {
  return useQuery({
    queryKey: activityKeys.list(params),
    queryFn: () => activityApi.list(params),
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: activityKeys.unreadCount(),
    queryFn: activityApi.unreadCount,
    refetchInterval: 30000,
  })
}

import { queryKeys } from '@/lib/react-query'

export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: activityApi.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() })
    },
  })
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: activityApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() })
    },
  })
}

export function useArchive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: activityApi.archive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() })
    },
  })
}

export function useArchiveAll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: activityApi.archiveAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() })
    },
  })
}

export function useContractActivity(contractId: number) {
  return useQuery({
    queryKey: activityKeys.contract(contractId),
    queryFn: () => activityApi.contractActivity(contractId),
    enabled: !!contractId,
  })
}
