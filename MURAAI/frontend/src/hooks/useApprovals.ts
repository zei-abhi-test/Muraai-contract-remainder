import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { approvalsApi } from '@/api/approvals'
import { queryKeys } from '@/lib/react-query'
import { getApiErrorMessage } from '@/lib/errors'
import { toast } from 'sonner'
import type { ApprovalFilters } from '@/api/approvals'

export function useApprovals(filters: ApprovalFilters = {}) {
  return useQuery({
    queryKey: queryKeys.approvals.list(filters),
    queryFn: () => approvalsApi.getApprovals(filters),
  })
}

export function useApproval(id: number) {
  return useQuery({
    queryKey: queryKeys.approvals.detail(String(id)),
    queryFn: () => approvalsApi.getApproval(id),
    enabled: !!id,
  })
}

export function useMyPendingApprovals() {
  return useQuery({
    queryKey: queryKeys.approvals.myPending(),
    queryFn: approvalsApi.getMyPendingApprovals,
  })
}

function invalidateAllApprovalRelated(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.approvals.lists() })
  queryClient.invalidateQueries({ queryKey: queryKeys.approvals.myPending() })
  queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() })
  queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() })
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() })
}

export function useApproveRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => approvalsApi.approveRequest(id, data),
    onSuccess: () => {
      toast.success('Request approved successfully')
      invalidateAllApprovalRelated(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to approve request'))
    },
  })
}

export function useRejectRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => approvalsApi.rejectRequest(id, data),
    onSuccess: () => {
      toast.success('Request rejected successfully')
      invalidateAllApprovalRelated(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to reject request'))
    },
  })
}

export function useCancelRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => approvalsApi.cancelRequest(id),
    onSuccess: () => {
      toast.success('Request cancelled successfully')
      invalidateAllApprovalRelated(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to cancel request'))
    },
  })
}

export function useDeleteRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => approvalsApi.deleteRequest(id),
    onSuccess: () => {
      toast.success('Request deleted successfully')
      invalidateAllApprovalRelated(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete request'))
    },
  })
}

export function useRequestApproval() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: approvalsApi.requestApproval,
    onSuccess: () => {
      toast.success('Approval requested successfully')
      invalidateAllApprovalRelated(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to request approval'))
    },
  })
}

export function useApprovalStages() {
  return useQuery({
    queryKey: queryKeys.approvals.stages(),
    queryFn: approvalsApi.getApprovalStages,
  })
}
