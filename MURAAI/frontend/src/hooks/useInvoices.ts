import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoicesApi } from '@/api/invoices'
import { queryKeys } from '@/lib/react-query'
import { getApiErrorMessage } from '@/lib/errors'
import { toast } from 'sonner'
import { activityKeys } from './useActivity'

export function useInvoices(filters: any = {}) {
  return useQuery({
    queryKey: queryKeys.invoices.list(filters),
    queryFn: () => invoicesApi.getInvoices(filters),
  })
}

export function useInvoice(id: number) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(String(id)),
    queryFn: () => invoicesApi.getInvoice(id),
    enabled: !!id,
  })
}

function invalidateInvoiceRelated(queryClient: any) {
  queryClient.invalidateQueries({ queryKey: queryKeys.invoices.lists() })
  queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() })
  queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() })
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() })
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() })
  queryClient.invalidateQueries({ queryKey: activityKeys.all })
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: invoicesApi.createInvoice,
    onSuccess: () => {
      toast.success('Invoice created successfully')
      invalidateInvoiceRelated(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to create invoice'))
    },
  })
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => invoicesApi.updateInvoice(id, data),
    onSuccess: (_, variables) => {
      toast.success('Invoice updated successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(String(variables.id)) })
      invalidateInvoiceRelated(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to update invoice'))
    },
  })
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: invoicesApi.deleteInvoice,
    onSuccess: () => {
      toast.success('Invoice deleted successfully')
      invalidateInvoiceRelated(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete invoice'))
    },
  })
}

export function useIssueInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: invoicesApi.issueInvoice,
    onSuccess: (data) => {
      toast.success('Invoice issued successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(String(data.id)) })
      invalidateInvoiceRelated(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to issue invoice'))
    },
  })
}

export function useMarkPaid() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: invoicesApi.markPaid,
    onSuccess: (data) => {
      toast.success('Invoice marked as paid')
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(String(data.id)) })
      invalidateInvoiceRelated(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to mark invoice as paid'))
    },
  })
}

export function useCancelInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: invoicesApi.cancelInvoice,
    onSuccess: (data) => {
      toast.success('Invoice cancelled')
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(String(data.id)) })
      invalidateInvoiceRelated(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to cancel invoice'))
    },
  })
}

export function useDuplicateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: invoicesApi.duplicateInvoice,
    onSuccess: () => {
      toast.success('Invoice duplicated')
      invalidateInvoiceRelated(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to duplicate invoice'))
    },
  })
}

export function useDownloadInvoicePdf() {
  return useMutation({
    mutationFn: async (id: number) => {
      const blob = await invoicesApi.downloadInvoicePdf(id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${id}.txt`
      a.click()
      window.URL.revokeObjectURL(url)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to download invoice PDF'))
    },
  })
}

export function useSendInvoiceEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, toEmail }: { id: number; toEmail: string }) => invoicesApi.sendInvoiceEmail(id, toEmail),
    onSuccess: (data) => {
      toast.success(`Invoice sent to ${data.to_email}`)
      invalidateInvoiceRelated(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to send invoice email'))
    },
  })
}
