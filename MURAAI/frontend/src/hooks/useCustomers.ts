import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customersApi } from '@/api/customers'
import { queryKeys } from '@/lib/react-query'
import { getApiErrorMessage } from '@/lib/errors'
import { toast } from 'sonner'

export function useCustomers() {
  return useQuery({
    queryKey: queryKeys.customers.list({}),
    queryFn: () => customersApi.getCustomers(),
  })
}

export function useCustomer(id: number) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => customersApi.getCustomer(id),
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: customersApi.createCustomer,
    onSuccess: () => {
      toast.success('Customer created successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to create customer'))
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => customersApi.updateCustomer(id, data),
    onSuccess: (_, variables) => {
      toast.success('Customer updated successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to update customer'))
    },
  })
}

export function useArchiveCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: customersApi.archiveCustomer,
    onSuccess: () => {
      toast.success('Customer archived successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to archive customer'))
    },
  })
}
