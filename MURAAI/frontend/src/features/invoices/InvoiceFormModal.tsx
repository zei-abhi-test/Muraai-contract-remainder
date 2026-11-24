import { useEffect, useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { useCreateInvoice, useUpdateInvoice } from '@/hooks/useInvoices'
import { useContracts } from '@/hooks/useContracts'
import { useCustomers } from '@/hooks/useCustomers'
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders'
import { toast } from 'sonner'
import { queryClient } from '@/lib/react-query'
import { queryKeys } from '@/lib/react-query'
import { getApiErrorMessage } from '@/lib/errors'
import { useModal } from '@/hooks/useModal'
import type { Invoice } from '@/api/invoices'

interface InvoiceFormValues {
  invoice_number: string
  contract_id: number
  customer_id: number
  purchase_order_id: number
  invoice_date: string
  due_date: string
  amount: string
  tax: string
  discount: string
  total: string
  currency: string
  status: string
  remarks: string
}

interface InvoiceFormModalProps {
  isOpen: boolean
  onClose: () => void
  invoice?: Invoice | null
}

const emptyForm: InvoiceFormValues = {
  invoice_number: '',
  contract_id: 0,
  customer_id: 0,
  purchase_order_id: 0,
  invoice_date: new Date().toISOString().split('T')[0],
  due_date: '',
  amount: '',
  tax: '0',
  discount: '0',
  total: '',
  currency: 'INR',
  status: 'DRAFT',
  remarks: '',
}

export function InvoiceFormModal({ isOpen, onClose, invoice }: InvoiceFormModalProps) {
  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()
  const { data: customers = [] } = useCustomers()
  const { data: contractsData, isLoading: contractsLoading } = useContracts({ per_page: 100 })
  const contracts = contractsData?.items ?? []
  const { data: purchaseOrders = [] } = usePurchaseOrders()
  const [apiError, setApiError] = useState('')
  const isEditing = !!invoice
  const dialogRef = useRef<HTMLDivElement>(null)
  useModal(dialogRef, isOpen, onClose)

  const { register, handleSubmit, reset, watch, setValue } = useForm<InvoiceFormValues>({
    defaultValues: emptyForm,
  })

  const selectedCustomerId = watch('customer_id')
  const selectedContractId = watch('contract_id')
  const selectedPOId = watch('purchase_order_id')
  const amountVal = watch('amount')
  const taxVal = watch('tax')
  const discountVal = watch('discount')

  const filteredContracts = useMemo(() => {
    if (!selectedCustomerId) return contracts
    return contracts.filter((c) => c.customer_id === selectedCustomerId)
  }, [contracts, selectedCustomerId])

  const filteredPOs = useMemo(() => {
    if (!selectedContractId) return []
    return purchaseOrders.filter((po) => po.contract_ids?.includes(selectedContractId))
  }, [purchaseOrders, selectedContractId])

  const selectedContract = contracts.find((c) => c.id === selectedContractId)
  const selectedPO = purchaseOrders.find((po) => po.id === selectedPOId)

  // Auto-calculate total
  useEffect(() => {
    const amount = parseFloat(amountVal) || 0
    const tax = parseFloat(taxVal) || 0
    const discount = parseFloat(discountVal) || 0
    const total = amount + tax - discount
    setValue('total', total.toFixed(2))
  }, [amountVal, taxVal, discountVal, setValue])

  useEffect(() => {
    if (!isOpen) return
    setApiError('')
    if (invoice) {
      reset({
        invoice_number: invoice.invoice_number,
        contract_id: invoice.contract_id || 0,
        customer_id: invoice.customer_id || 0,
        purchase_order_id: invoice.purchase_order_id || 0,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date || '',
        amount: String(invoice.amount),
        tax: String(invoice.tax || 0),
        discount: String(invoice.discount || 0),
        total: String(invoice.total || invoice.amount),
        currency: invoice.currency || 'INR',
        status: invoice.status,
        remarks: invoice.remarks || '',
      })
    } else {
      reset(emptyForm)
    }
  }, [isOpen, invoice, reset])

  // Auto-fill amount and currency when contract selected
  useEffect(() => {
    if (!isEditing && selectedContract) {
      setValue('amount', selectedContract.total_contract_value?.toString() || '')
      setValue('currency', selectedContract.currency || 'INR')
    }
  }, [selectedContract, setValue, isEditing])

  // Auto-fill from PO
  useEffect(() => {
    if (!isEditing && selectedPO) {
      setValue('amount', selectedPO.amount?.toString() || '')
      setValue('currency', selectedPO.currency || 'INR')
      setValue('customer_id', selectedPO.customer_id || 0)
    }
  }, [selectedPO, setValue, isEditing])

  const onSubmit = async (values: InvoiceFormValues) => {
    setApiError('')
    const payload = {
      contract_id: values.contract_id || undefined,
      customer_id: values.customer_id || undefined,
      purchase_order_id: values.purchase_order_id || undefined,
      invoice_number: isEditing ? values.invoice_number || undefined : undefined,
      invoice_date: values.invoice_date || undefined,
      due_date: values.due_date || undefined,
      amount: values.amount ? parseFloat(values.amount) : undefined,
      tax: values.tax ? parseFloat(values.tax) : 0,
      discount: values.discount ? parseFloat(values.discount) : 0,
      total: values.total ? parseFloat(values.total) : undefined,
      currency: values.currency || 'INR',
      status: values.status,
      remarks: values.remarks || undefined,
    }

    try {
      if (isEditing && invoice) {
        await updateInvoice.mutateAsync({ id: invoice.id, data: payload })
        toast.success('Invoice updated successfully')
      } else {
        await createInvoice.mutateAsync(payload)
        toast.success('Invoice created successfully')
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.metrics() })
      onClose()
    } catch (err: any) {
      const msg = getApiErrorMessage(err, isEditing ? 'Failed to update invoice' : 'Failed to create invoice')
      setApiError(msg)
      toast.error(msg)
    }
  }

  const isSaving = createInvoice.isPending || updateInvoice.isPending

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="invoice-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            key="invoice-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-card border border-border rounded-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-modal-title"
          >
        <div className="p-6 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 id="invoice-modal-title" className="text-xl font-semibold">{isEditing ? 'Edit Invoice' : 'Create Invoice'}</h2>
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

          <div>
            <label htmlFor="invoice-customer" className="block text-sm font-medium mb-2">Customer</label>
            <select
              id="invoice-customer"
              {...register('customer_id', { valueAsNumber: true })}
              onChange={(e) => { setValue('customer_id', parseInt(e.target.value)); setValue('contract_id', 0) }}
              disabled={isEditing}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg"
            >
              <option value={0}>Select Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="invoice-contract" className="block text-sm font-medium mb-2">Contract</label>
            <select
              id="invoice-contract"
              {...register('contract_id', { valueAsNumber: true })}
              disabled={isEditing || contractsLoading}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg disabled:opacity-60"
            >
              <option value={0}>Select Contract</option>
              {filteredContracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contract_name} ({c.contract_number || 'N/A'}) - {c.company_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="invoice-po" className="block text-sm font-medium mb-2">Purchase Order (Optional)</label>
            <select
              id="invoice-po"
              {...register('purchase_order_id', { valueAsNumber: true })}
              disabled={isEditing}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg"
            >
              <option value={0}>None</option>
              {filteredPOs.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.po_number} - {po.vendor}
                </option>
              ))}
            </select>
          </div>

          {selectedContract && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <div><span className="text-muted-foreground">Customer:</span> {selectedContract.company_name}</div>
              <div><span className="text-muted-foreground">Contract Value:</span> {selectedContract.currency || 'INR'} {selectedContract.total_contract_value?.toLocaleString() || '0'}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="invoice-number" className="block text-sm font-medium mb-2">Invoice Number</label>
              <input id="invoice-number" {...register('invoice_number')} className="w-full px-3 py-2 bg-background border border-input rounded-lg" placeholder="Auto-generated" disabled={isEditing} />
            </div>
            <div>
              <label htmlFor="invoice-status" className="block text-sm font-medium mb-2">Status</label>
              <select id="invoice-status" {...register('status')} className="w-full px-3 py-2 bg-background border border-input rounded-lg">
                <option value="DRAFT">Draft</option>
                <option value="ISSUED">Issued</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="invoice-date" className="block text-sm font-medium mb-2">Invoice Date</label>
              <input id="invoice-date" {...register('invoice_date')} type="date" className="w-full px-3 py-2 bg-background border border-input rounded-lg" />
            </div>
            <div>
              <label htmlFor="invoice-due-date" className="block text-sm font-medium mb-2">Due Date</label>
              <input id="invoice-due-date" {...register('due_date')} type="date" className="w-full px-3 py-2 bg-background border border-input rounded-lg" />
            </div>
          </div>

          <div>
            <label htmlFor="invoice-currency" className="block text-sm font-medium mb-2">Currency</label>
            <select id="invoice-currency" {...register('currency')} className="w-full px-3 py-2 bg-background border border-input rounded-lg">
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="invoice-amount" className="block text-sm font-medium mb-2">Amount (Subtotal)</label>
              <input id="invoice-amount" {...register('amount')} type="number" step="0.01" className="w-full px-3 py-2 bg-background border border-input rounded-lg" />
            </div>
            <div>
              <label htmlFor="invoice-tax" className="block text-sm font-medium mb-2">Tax</label>
              <input id="invoice-tax" {...register('tax')} type="number" step="0.01" className="w-full px-3 py-2 bg-background border border-input rounded-lg" placeholder="0" />
            </div>
            <div>
              <label htmlFor="invoice-discount" className="block text-sm font-medium mb-2">Discount</label>
              <input id="invoice-discount" {...register('discount')} type="number" step="0.01" className="w-full px-3 py-2 bg-background border border-input rounded-lg" placeholder="0" />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Grand Total</span>
            <span className="text-lg font-bold">{watch('currency') || 'INR'} {parseFloat(watch('total') || '0').toLocaleString()}</span>
          </div>

          <div>
            <label htmlFor="invoice-remarks" className="block text-sm font-medium mb-2">Remarks</label>
            <textarea id="invoice-remarks" {...register('remarks')} className="w-full px-3 py-2 bg-background border border-input rounded-lg" rows={2} placeholder="Optional remarks..." />
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
