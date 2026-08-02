import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { useCreatePurchaseOrder, useUpdatePurchaseOrder } from '@/hooks/usePurchaseOrders'
import { useCustomers } from '@/hooks/useCustomers'
import { useContracts } from '@/hooks/useContracts'
import { toast } from 'sonner'
import { queryClient } from '@/lib/react-query'
import { queryKeys } from '@/lib/react-query'
import { getApiErrorMessage } from '@/lib/errors'
import type { PurchaseOrder } from '@/api/purchaseOrders'

interface POFormValues {
  po_number: string
  po_date: string
  vendor: string
  customer_id: number
  amount: string
  status: string
  issue_date: string
  expected_delivery: string
  currency: string
  remarks: string
  contract_ids: number[]
}

interface PurchaseOrderFormModalProps {
  isOpen: boolean
  onClose: () => void
  purchaseOrder?: PurchaseOrder | null
}

const emptyForm: POFormValues = {
  po_number: '',
  po_date: new Date().toISOString().split('T')[0],
  vendor: '',
  customer_id: 0,
  amount: '',
  status: 'Draft',
  issue_date: '',
  expected_delivery: '',
  currency: 'INR',
  remarks: '',
  contract_ids: [],
}

export function PurchaseOrderFormModal({ isOpen, onClose, purchaseOrder }: PurchaseOrderFormModalProps) {
  const createPurchaseOrder = useCreatePurchaseOrder()
  const updatePurchaseOrder = useUpdatePurchaseOrder()
  const { data: customers = [], isLoading: customersLoading } = useCustomers()
  const { data: contracts = [], isLoading: contractsLoading } = useContracts()
  const [apiError, setApiError] = useState('')
  const isEditing = !!purchaseOrder

  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm<POFormValues>({
    defaultValues: emptyForm,
  })

  const selectedCustomerId = watch('customer_id')
  const filteredContracts = selectedCustomerId
    ? contracts.filter((c) => c.customer_id === selectedCustomerId)
    : []

  useEffect(() => {
    if (!isOpen) return
    setApiError('')
    if (purchaseOrder) {
      reset({
        po_number: purchaseOrder.po_number,
        po_date: purchaseOrder.po_date,
        vendor: purchaseOrder.vendor,
        customer_id: purchaseOrder.customer_id || 0,
        amount: String(purchaseOrder.amount),
        status: purchaseOrder.status,
        issue_date: purchaseOrder.issue_date || '',
        expected_delivery: purchaseOrder.expected_delivery || '',
        currency: purchaseOrder.currency || 'INR',
        remarks: purchaseOrder.remarks || '',
        contract_ids: purchaseOrder.contract_ids || [],
      })
    } else {
      reset(emptyForm)
    }
  }, [isOpen, purchaseOrder, reset])

  const onSubmit = async (values: POFormValues) => {
    setApiError('')
    const contractIds = selectedCustomerId
      ? filteredContracts.filter((c) => values.contract_ids?.includes(c.id)).map((c) => c.id)
      : []

    const payload = {
      vendor: values.vendor,
      po_date: values.po_date || undefined,
      customer_id: values.customer_id || undefined,
      amount: parseFloat(values.amount) || 0,
      status: values.status,
      issue_date: values.issue_date || undefined,
      expected_delivery: values.expected_delivery || undefined,
      currency: values.currency || 'INR',
      remarks: values.remarks || undefined,
      contract_ids: contractIds,
    }

    try {
      if (isEditing && purchaseOrder) {
        await updatePurchaseOrder.mutateAsync({ id: purchaseOrder.id, data: payload })
        toast.success('Purchase order updated successfully')
      } else {
        await createPurchaseOrder.mutateAsync(payload)
        toast.success('Purchase order created successfully')
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.metrics() })
      onClose()
    } catch (err: any) {
      const msg = getApiErrorMessage(err, isEditing ? 'Failed to update purchase order' : 'Failed to create purchase order')
      setApiError(msg)
      toast.error(msg)
    }
  }

  const isSaving = isSubmitting || createPurchaseOrder.isPending || updatePurchaseOrder.isPending

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="po-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            key="po-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
          >
        <div className="p-6 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{isEditing ? 'Edit Purchase Order' : 'New Purchase Order'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
              <span className="w-5 h-5 flex items-center justify-center">&times;</span>
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
          {apiError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {apiError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">PO Number</label>
              <input {...register('po_number')} className="w-full px-3 py-2 bg-background border border-input rounded-lg" placeholder="Auto-generated" disabled={isEditing} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Date</label>
              <input {...register('po_date')} type="date" className="w-full px-3 py-2 bg-background border border-input rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Vendor *</label>
            <input {...register('vendor', { required: true })} className="w-full px-3 py-2 bg-background border border-input rounded-lg" placeholder="Vendor name" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Customer</label>
            <select
              {...register('customer_id', { valueAsNumber: true })}
              onChange={(e) => {
                setValue('customer_id', parseInt(e.target.value))
                setValue('contract_ids', [])
              }}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg"
              disabled={customersLoading}
            >
              <option value={0}>Select Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {selectedCustomerId > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Contracts</label>
              {contractsLoading ? (
                <div className="text-sm text-muted-foreground py-2">Loading contracts...</div>
              ) : filteredContracts.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2">No contracts found for this customer.</div>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto border border-input rounded-lg p-2">
                  {filteredContracts.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        value={c.id}
                        {...register('contract_ids')}
                        className="w-4 h-4"
                      />
                      {c.contract_name} ({c.contract_number || 'N/A'})
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Issue Date</label>
              <input {...register('issue_date')} type="date" className="w-full px-3 py-2 bg-background border border-input rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Expected Delivery</label>
              <input {...register('expected_delivery')} type="date" className="w-full px-3 py-2 bg-background border border-input rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Currency</label>
              <select {...register('currency')} className="w-full px-3 py-2 bg-background border border-input rounded-lg">
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Amount *</label>
              <input {...register('amount', { required: true })} type="number" step="0.01" className="w-full px-3 py-2 bg-background border border-input rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select {...register('status')} className="w-full px-3 py-2 bg-background border border-input rounded-lg">
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
                <option value="Approved">Approved</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Remarks</label>
            <textarea {...register('remarks')} className="w-full px-3 py-2 bg-background border border-input rounded-lg" rows={3} placeholder="Optional remarks..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-input rounded-lg hover:bg-accent" disabled={isSaving}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
