import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { purchaseOrdersApi } from '@/api/purchaseOrders'
import { queryKeys } from '@/lib/react-query'
import { getApiErrorMessage } from '@/lib/errors'
import { toast } from 'sonner'
import { activityKeys } from './useActivity'

function invalidatePOQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() })
  queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() })
  queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() })
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() })
  queryClient.invalidateQueries({ queryKey: activityKeys.all })
}

export function usePurchaseOrders(filters: { search?: string; contract_id?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.list(filters),
    queryFn: () => purchaseOrdersApi.getPurchaseOrders(filters),
  })
}

export function usePurchaseOrder(id: number) {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.detail(String(id)),
    queryFn: () => purchaseOrdersApi.getPurchaseOrder(id),
    enabled: !!id,
  })
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: purchaseOrdersApi.createPurchaseOrder,
    onSuccess: () => {
      toast.success('Purchase order created successfully')
      invalidatePOQueries(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to create purchase order'))
    },
  })
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => purchaseOrdersApi.updatePurchaseOrder(id, data),
    onSuccess: (_, variables) => {
      toast.success('Purchase order updated successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(String(variables.id)) })
      invalidatePOQueries(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to update purchase order'))
    },
  })
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: purchaseOrdersApi.deletePurchaseOrder,
    onSuccess: () => {
      toast.success('Purchase order deleted successfully')
      invalidatePOQueries(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete purchase order'))
    },
  })
}

export function useSubmitPurchaseOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: purchaseOrdersApi.submitPurchaseOrder,
    onSuccess: (po) => {
      toast.success(`PO "${po.po_number}" submitted`)
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(String(po.id)) })
      invalidatePOQueries(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to submit PO'))
    },
  })
}

export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: purchaseOrdersApi.cancelPurchaseOrder,
    onSuccess: (po) => {
      toast.success(`PO "${po.po_number}" cancelled`)
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(String(po.id)) })
      invalidatePOQueries(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to cancel PO'))
    },
  })
}

export function useMarkReceivedPurchaseOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: purchaseOrdersApi.markReceivedPurchaseOrder,
    onSuccess: (po) => {
      toast.success(`PO "${po.po_number}" marked as received`)
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(String(po.id)) })
      invalidatePOQueries(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to mark PO as received'))
    },
  })
}

export function useDuplicatePurchaseOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: purchaseOrdersApi.duplicatePurchaseOrder,
    onSuccess: () => {
      toast.success('Purchase order duplicated')
      invalidatePOQueries(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to duplicate PO'))
    },
  })
}
