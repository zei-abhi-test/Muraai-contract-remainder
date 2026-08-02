import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { contactSchema, type ContactFormData } from '@/lib/validations'
import { useCreateCustomerContact, useUpdateContact } from '@/hooks/useContacts'
import { useCustomers } from '@/hooks/useCustomers'
import { toast } from 'sonner'
import { queryClient } from '@/lib/react-query'
import { queryKeys } from '@/lib/react-query'
import type { Contact } from '@/api/contacts'

interface ContactFormModalProps {
  isOpen: boolean
  onClose: () => void
  contact?: Contact | null
  defaultCustomerId?: number
}

/**
 * Single shared Contact create/edit form, used by ContactsPage, the global
 * Quick Add menu, and the Dashboard Quick Actions.
 */
export function ContactFormModal({ isOpen, onClose, contact, defaultCustomerId }: ContactFormModalProps) {
  const { data: customers } = useCustomers()
  const createContact = useCreateCustomerContact()
  const updateContact = useUpdateContact()
  const isEditing = !!contact

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { customer_id: defaultCustomerId || 0, contact_name: '', contact_number: '', email: '', designation: '' },
  })

  useEffect(() => {
    if (!isOpen) return
    reset({
      customer_id: contact?.customer_id || defaultCustomerId || 0,
      contact_name: contact?.contact_name || '',
      contact_number: contact?.contact_number || '',
      email: contact?.email || '',
      designation: contact?.designation || '',
    })
  }, [isOpen, contact, defaultCustomerId, reset])

  const onSubmit = (data: ContactFormData) => {
    if (isEditing && contact) {
      updateContact.mutate(
        { id: contact.id, data },
        {
          onSuccess: () => {
            toast.success('Contact updated successfully')
            queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() })
            onClose()
          },
          onError: (err: any) => toast.error(err?.response?.data?.error || err?.message || 'Failed to update contact'),
        },
      )
      return
    }
    if (!data.customer_id) return
    createContact.mutate(
      { customerId: data.customer_id, data },
      {
        onSuccess: () => {
          toast.success('Contact created successfully')
          queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() })
          onClose()
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || err?.message || 'Failed to create contact'),
      },
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="contact-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            key="contact-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-card border border-border rounded-xl w-full max-w-md p-6"
          >
        <h2 className="text-xl font-semibold mb-4">{isEditing ? 'Edit Contact' : 'New Contact'}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Customer *</label>
            <select
              {...register('customer_id', { valueAsNumber: true })}
              disabled={isEditing}
              className="w-full px-4 py-2 border border-input rounded-lg bg-background disabled:opacity-60"
            >
              <option value={0}>Select Customer</option>
              {customers?.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
            {errors.customer_id && <p className="text-sm text-destructive mt-1">{errors.customer_id.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Contact Name *</label>
            <input {...register('contact_name')} className="w-full px-4 py-2 border border-input rounded-lg bg-background" />
            {errors.contact_name && <p className="text-sm text-destructive mt-1">{errors.contact_name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input {...register('email')} type="email" className="w-full px-4 py-2 border border-input rounded-lg bg-background" />
            {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Phone *</label>
            <input {...register('contact_number')} className="w-full px-4 py-2 border border-input rounded-lg bg-background" />
            {errors.contact_number && <p className="text-sm text-destructive mt-1">{errors.contact_number.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Designation</label>
            <input {...register('designation')} className="w-full px-4 py-2 border border-input rounded-lg bg-background" />
            {errors.designation && <p className="text-sm text-destructive mt-1">{errors.designation.message}</p>}
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
