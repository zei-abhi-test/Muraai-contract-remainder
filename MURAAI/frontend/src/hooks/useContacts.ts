import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { contactsApi } from '@/api/contacts'
import { queryKeys } from '@/lib/react-query'
import { getApiErrorMessage } from '@/lib/errors'
import { toast } from 'sonner'

export function useContacts() {
  return useQuery({
    queryKey: queryKeys.contacts.list({}),
    queryFn: () => contactsApi.getContacts(),
  })
}

export function useContactsByCustomer(customerId: number) {
  return useQuery({
    queryKey: queryKeys.contacts.byCustomer(customerId),
    queryFn: () => contactsApi.getCustomerContacts(customerId),
    enabled: !!customerId,
  })
}

export function useCreateCustomerContact() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ customerId, data }: { customerId: number; data: any }) => 
      contactsApi.createCustomerContact(customerId, data),
    onSuccess: (_data, variables) => {
      toast.success('Contact created successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.byCustomer(variables.customerId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to create contact'))
    },
  })
}

export function useUpdateContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => contactsApi.updateContact(id, data),
    onSuccess: () => {
      toast.success('Contact updated successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to update contact'))
    },
  })
}

export function useDeleteContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: contactsApi.deleteContact,
    onSuccess: () => {
      toast.success('Contact deleted successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete contact'))
    },
  })
}
