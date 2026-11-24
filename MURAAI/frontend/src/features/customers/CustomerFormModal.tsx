import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { customerSchema, type CustomerFormData } from '@/lib/validations'
import { useCreateCustomer, useUpdateCustomer } from '@/hooks/useCustomers'
import { useModal } from '@/hooks/useModal'
import { toast } from 'sonner'
import { queryClient } from '@/lib/react-query'
import { queryKeys } from '@/lib/react-query'
import type { Customer } from '@/api/customers'

interface CustomerFormModalProps {
  isOpen: boolean
  onClose: () => void
  customer?: Customer | null
}

/**
 * Single shared Customer create/edit form. Used by CustomersPage's "New
 * Customer" button, the global Quick Add menu, and the Dashboard Quick
 * Actions - there is exactly one Customer create flow in the app.
 */
export function CustomerFormModal({ isOpen, onClose, customer }: CustomerFormModalProps) {
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const isEditing = !!customer
  const dialogRef = useRef<HTMLDivElement>(null)
  useModal(dialogRef, isOpen, onClose)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', customer_code: '', phone: '', email: '', address: '' },
  })

  useEffect(() => {
    if (!isOpen) return
    reset({
      name: customer?.name || '',
      customer_code: customer?.customer_code || '',
      phone: customer?.phone || '',
      email: customer?.email || '',
      address: customer?.address || '',
    })
  }, [isOpen, customer, reset])

  const onSubmit = (data: CustomerFormData) => {
    if (isEditing && customer) {
      updateCustomer.mutate(
        { id: customer.id, data },
        {
          onSuccess: () => {
            toast.success('Customer updated successfully')
            queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() })
            onClose()
          },
          onError: (err: any) => toast.error(err?.response?.data?.error || err?.message || 'Failed to update customer'),
        },
      )
    } else {
      createCustomer.mutate(data, {
        onSuccess: () => {
          toast.success('Customer created successfully')
          queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() })
          onClose()
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || err?.message || 'Failed to create customer'),
      })
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="customer-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            key="customer-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-card border border-border rounded-xl w-full max-w-md p-6"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-modal-title"
          >
        <h2 id="customer-modal-title" className="text-xl font-semibold mb-4">{isEditing ? 'Edit Customer' : 'New Customer'}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="customer-name" className="block text-sm font-medium mb-2">Name *</label>
            <input id="customer-name" {...register('name')} className="w-full px-4 py-2 border border-input rounded-lg bg-background" />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor="customer-code" className="block text-sm font-medium mb-2">Customer Code</label>
            <input id="customer-code" {...register('customer_code')} className="w-full px-4 py-2 border border-input rounded-lg bg-background" />
            {errors.customer_code && <p className="text-sm text-destructive mt-1">{errors.customer_code.message}</p>}
          </div>
          <div>
            <label htmlFor="customer-email" className="block text-sm font-medium mb-2">Email</label>
            <input id="customer-email" {...register('email')} type="email" className="w-full px-4 py-2 border border-input rounded-lg bg-background" />
            {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label htmlFor="customer-phone" className="block text-sm font-medium mb-2">Phone</label>
            <input id="customer-phone" {...register('phone')} className="w-full px-4 py-2 border border-input rounded-lg bg-background" />
            {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>}
          </div>
          <div>
            <label htmlFor="customer-address" className="block text-sm font-medium mb-2">Address</label>
            <textarea id="customer-address" {...register('address')} className="w-full px-4 py-2 border border-input rounded-lg bg-background" rows={3} />
            {errors.address && <p className="text-sm text-destructive mt-1">{errors.address.message}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-input rounded-lg hover:bg-accent">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
