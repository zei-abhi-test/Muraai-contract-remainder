import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { productsApi } from '@/api/products'
import { queryKeys } from '@/lib/react-query'
import { getApiErrorMessage } from '@/lib/errors'
import { toast } from 'sonner'

export function useProducts(filters: any = {}) {
  return useQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: () => productsApi.getProducts(filters),
  })
}

export function useProduct(id: number) {
  return useQuery({
    queryKey: queryKeys.products.detail(id),
    queryFn: () => productsApi.getProduct(id),
    enabled: !!id,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: productsApi.createProduct,
    onSuccess: () => {
      toast.success('Product created successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to create product'))
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => productsApi.updateProduct(id, data),
    onSuccess: (_, variables) => {
      toast.success('Product updated successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to update product'))
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: productsApi.deleteProduct,
    onSuccess: (result: any) => {
      toast.success(
        result?.deactivated
          ? 'Product is referenced by existing contracts - deactivated instead of deleted'
          : 'Product deleted successfully',
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete product'))
    },
  })
}
