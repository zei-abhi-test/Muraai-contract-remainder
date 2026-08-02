import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { contractTypesApi } from '@/api/contractTypes'
import { queryKeys } from '@/lib/react-query'
import { toast } from 'sonner'

export function useContractTypes() {
  return useQuery({
    queryKey: queryKeys.contractTypes.list({}),
    queryFn: () => contractTypesApi.getContractTypes(),
  })
}

export function useContractType(id: number) {
  return useQuery({
    queryKey: queryKeys.contractTypes.detail(id),
    queryFn: () => contractTypesApi.getContractType(id),
    enabled: !!id,
  })
}

export function useCreateContractType() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: contractTypesApi.createContractType,
    onSuccess: () => {
      toast.success('Contract type created successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.contractTypes.lists() })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create contract type')
    },
  })
}

export function useUpdateContractType() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => contractTypesApi.updateContractType(id, data),
    onSuccess: (_, variables) => {
      toast.success('Contract type updated successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.contractTypes.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.contractTypes.lists() })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update contract type')
    },
  })
}

export function useDeleteContractType() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: contractTypesApi.deleteContractType,
    onSuccess: () => {
      toast.success('Contract type deleted successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.contractTypes.lists() })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete contract type')
    },
  })
}
