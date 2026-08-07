import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { contractsApi, type ContractFilters } from '@/api/contracts'
import { purchaseOrdersApi } from '@/api/purchaseOrders'
import { invoicesApi } from '@/api/invoices'
import { approvalsApi } from '@/api/approvals'
import { queryKeys } from '@/lib/react-query'
import { getApiErrorMessage } from '@/lib/errors'
import { activityKeys } from '@/hooks/useActivity'
import { toast } from 'sonner'

export function useContracts(filters: ContractFilters = {}) {
  return useQuery({
    queryKey: queryKeys.contracts.list(filters),
    queryFn: () => contractsApi.getContracts(filters),
    placeholderData: keepPreviousData,
  })
}

export function useContract(id: number) {
  return useQuery({
    queryKey: queryKeys.contracts.detail(id),
    queryFn: () => contractsApi.getContract(id),
    enabled: !!id,
  })
}

export function useCreateContract() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: contractsApi.createContract,
    onSuccess: () => {
      toast.success('Contract created successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() })
      queryClient.invalidateQueries({ queryKey: activityKeys.all })
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to create contract'))
    },
  })
}

export function useUpdateContract() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => contractsApi.updateContract(id, data),
    onSuccess: (_, variables) => {
      toast.success('Contract updated successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() })
      queryClient.invalidateQueries({ queryKey: activityKeys.all })
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to update contract'))
    },
  })
}

export function useDeleteContract() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: contractsApi.deleteContract,
    onSuccess: () => {
      toast.success('Contract deleted successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() })
      queryClient.invalidateQueries({ queryKey: activityKeys.all })
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete contract'))
    },
  })
}

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard.metrics(),
    queryFn: () => contractsApi.getDashboard(),
  })
}

export function useContractLineItems(contractId: number) {
  return useQuery({
    queryKey: queryKeys.contracts.lineItems(contractId),
    queryFn: () => contractsApi.getLineItems(contractId),
    enabled: !!contractId,
  })
}

export function useCreateLineItem() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ contractId, data }: { contractId: number; data: any }) => 
      contractsApi.createLineItem(contractId, data),
    onSuccess: (_, variables) => {
      toast.success('Line item added successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lineItems(variables.contractId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(variables.contractId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
      queryClient.invalidateQueries({ queryKey: activityKeys.all })
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to add line item'))
    },
  })
}

export function useContractDocuments(contractId: number) {
  return useQuery({
    queryKey: queryKeys.contracts.documents(contractId),
    queryFn: () => contractsApi.getDocuments(contractId),
    enabled: !!contractId,
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ contractId, file }: { contractId: number; file: File }) => 
      contractsApi.uploadDocument(contractId, file),
    onSuccess: (_, variables) => {
      toast.success('Document uploaded successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.documents(variables.contractId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to upload document'))
    },
  })
}

export function useRenewContract() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ contractId, data }: { contractId: number; data: any }) => 
      contractsApi.renewContract(contractId, data),
    onSuccess: () => {
      toast.success('Contract renewed successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() })
      queryClient.invalidateQueries({ queryKey: activityKeys.all })
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to renew contract'))
    },
  })
}

export function useRenewalHistory(contractId: number) {
  return useQuery({
    queryKey: queryKeys.contracts.renewalHistory(contractId),
    queryFn: () => contractsApi.getRenewalHistory(contractId),
    enabled: !!contractId,
  })
}

export function useContractPurchaseOrders(contractId: number) {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.list({ contract_id: contractId }),
    queryFn: () => purchaseOrdersApi.getPurchaseOrders({ contract_id: contractId }),
    enabled: !!contractId,
  })
}

export function useContractInvoices(contractId: number) {
  return useQuery({
    queryKey: queryKeys.invoices.list({ contract_id: contractId }),
    queryFn: () => invoicesApi.getInvoices({ contract_id: contractId }),
    enabled: !!contractId,
  })
}

export function useContractApprovals(contractId: number) {
  return useQuery({
    queryKey: queryKeys.approvals.list({ contract_id: contractId }),
    queryFn: () => approvalsApi.getApprovals({ contract_id: contractId }),
    enabled: !!contractId,
  })
}

export function useContractAssistance(contractId: number) {
  return useQuery({
    queryKey: queryKeys.contracts.assistance(contractId),
    queryFn: () => contractsApi.getAssistance(contractId),
    enabled: !!contractId,
  })
}
