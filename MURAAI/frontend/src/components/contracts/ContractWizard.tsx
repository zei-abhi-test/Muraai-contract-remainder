import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Check, X, Plus, Trash2 } from 'lucide-react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCustomers } from '@/hooks/useCustomers'
import { useContactsByCustomer } from '@/hooks/useContacts'
import { useProducts } from '@/hooks/useProducts'
import { useContractTypes } from '@/hooks/useContractTypes'
import { useContract } from '@/hooks/useContracts'
import { contractSchema, type ContractFormData } from '@/lib/validations'

interface ContractWizardProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (contractData: any, contractId?: number) => Promise<any>
  editContractId?: number
}

/**
 * Builds the create-contract payload according to the real backend schema
 * (see MURAAI/backend/src/services/validators.py::ContractCreate).
 *
 * notification_mobile is a boolean flag on the backend (whether to also send
 * a mobile notification), not a phone number field.
 */
function buildContractPayload(data: ContractFormData) {
  const notificationEnabled = !!data.notification_enabled
  const trimmedEmail = data.notification_email?.trim()

  return {
    ...data,
    notification_enabled: notificationEnabled,
    // Backend rejects an empty string as an invalid email (EmailStr), so we
    // send null instead of '' whenever there is no email to send.
    notification_email: notificationEnabled && trimmedEmail ? trimmedEmail : null,
    notification_mobile: !!data.notification_mobile,
    // The backend always resolves sku/product_name from product_id when one
    // is selected (see create_contract_line_item), and only falls back to a
    // client-supplied product_name for fully custom (non-catalog) items. It
    // never trusts a client-supplied sku, so we don't send one here to avoid
    // implying the frontend can invent/override SKUs for existing products.
    line_items: (data.line_items || []).map(({ sku, ...item }) => ({
      ...item,
      product_id: item.product_id || undefined,
    })),
  }
}

const steps = [
  { id: 1, title: 'Parties', description: 'Customer, Contact, Company' },
  { id: 2, title: 'Contract Details', description: 'Dates, Status, Terms' },
  { id: 3, title: 'Line Items', description: 'Products, Quantities, Rates' },
  { id: 4, title: 'Review', description: 'Verify all information' },
]

export function ContractWizard({ isOpen, onClose, onSubmit, editContractId }: ContractWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const { data: customers = [], isLoading: customersLoading } = useCustomers()
  const { data: products = [], isLoading: productsLoading } = useProducts()
  const { data: contractTypes = [], isLoading: contractTypesLoading } = useContractTypes()
  const { data: existingContract } = useContract(editContractId || 0)
  
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    trigger,
    reset,
  } = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema) as any,
    defaultValues: {
      company_name: '',
      contract_name: '',
      start_date: '',
      end_date: '',
      status: 'Active',
      currency: 'INR',
      // Notifications default to OFF. Enabling them requires a valid
      // notification_email (enforced below and by the backend).
      notification_enabled: false,
      notification_email: '',
      notification_mobile: false,
      contract_version: 1,
      line_items: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'line_items',
  })

  const selectedCustomerId = watch('customer_id')
  const { data: contacts = [] } = useContactsByCustomer(selectedCustomerId || 0)

  useEffect(() => {
    if (editContractId && existingContract) {
      reset({
        company_name: existingContract.company_name || '',
        contract_name: existingContract.contract_name || '',
        contract_number: existingContract.contract_number || '',
        start_date: existingContract.start_date || '',
        end_date: existingContract.end_date || '',
        renewal_date: existingContract.renewal_date || '',
        customer_id: existingContract.customer_id || undefined,
        contact_person_id: existingContract.contact_person_id || undefined,
        contract_type_id: existingContract.contract_type_id || undefined,
        contract_date: existingContract.contract_date || '',
        status: existingContract.status || 'Active',
        currency: existingContract.currency || 'INR',
        payment_terms: existingContract.payment_terms || '',
        remarks: existingContract.remarks || '',
        notification_enabled: existingContract.notification_enabled || false,
        notification_email: existingContract.notification_email || '',
        notification_mobile: existingContract.notification_mobile || false,
        contract_version: existingContract.contract_version || 1,
        line_items: [],
      })
    }
  }, [editContractId, existingContract, reset])

  // Auto-populate product details when selected
  const handleProductChange = (index: number, productId: number) => {
    const product = products.find(p => p.id === productId)
    if (product) {
      setValue(`line_items.${index}.product_name`, product.name)
      setValue(`line_items.${index}.sku`, product.sku)
      setValue(`line_items.${index}.rate`, product.rate)
    }
  }

  const handleNext = async () => {
    if (currentStep === 2) {
      // Block advancing past Contract Details until notification settings
      // are valid (e.g. email required + valid when notifications enabled).
      const valid = await trigger(['notification_enabled', 'notification_email'])
      if (!valid) return
    }
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleAddLineItem = () => {
    append({ product_id: 0, product_name: '', sku: '', quantity: 0, rate: 0, discount: 0, tax: 0, remarks: '' })
  }

  const handleWizardSubmit = async (data: ContractFormData) => {
    const payload = buildContractPayload(data)

    try {
      await onSubmit(payload, editContractId)
      reset()
      setCurrentStep(1)
      onClose()
    } catch (error) {
      // The mutation's onError handler already shows a normalized error
      // toast. Keep the wizard open with the current step/data so the user
      // can fix the issue (e.g. add a notification email) and resubmit.
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">Parties Information</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Customer *</label>
                <select
                  {...register('customer_id', { valueAsNumber: true })}
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                >
                  <option value={0}>Select Customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
                {errors.customer_id && <p className="text-sm text-destructive mt-1">{errors.customer_id.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Contact Person</label>
                <select
                  {...register('contact_person_id', { valueAsNumber: true })}
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                  disabled={!selectedCustomerId}
                >
                  <option value={0}>Select Contact</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>{contact.contact_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Company *</label>
                <input
                  {...register('company_name')}
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                  placeholder="Enter company name"
                />
                {errors.company_name && <p className="text-sm text-destructive mt-1">{errors.company_name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Contract Type *</label>
                <select
                  {...register('contract_type_id', { valueAsNumber: true })}
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                >
                  <option value={0}>Select Contract Type</option>
                  {contractTypes.map((ct) => (
                    <option key={ct.id} value={ct.id}>{ct.name}</option>
                  ))}
                </select>
                {errors.contract_type_id && <p className="text-sm text-destructive mt-1">{errors.contract_type_id.message}</p>}
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">Contract Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Contract Name *</label>
                <input
                  {...register('contract_name')}
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                  placeholder="Enter contract name"
                />
                {errors.contract_name && <p className="text-sm text-destructive mt-1">{errors.contract_name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Contract Number</label>
                <input
                  {...register('contract_number')}
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                  placeholder="Auto-generated if empty"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Start Date *</label>
                <input
                  {...register('start_date')}
                  type="date"
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                />
                {errors.start_date && <p className="text-sm text-destructive mt-1">{errors.start_date.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">End Date *</label>
                <input
                  {...register('end_date')}
                  type="date"
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                />
                {errors.end_date && <p className="text-sm text-destructive mt-1">{errors.end_date.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Contract Date</label>
                <input
                  {...register('contract_date')}
                  type="date"
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Renewal Date</label>
                <input
                  {...register('renewal_date')}
                  type="date"
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  {...register('status')}
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                >
                  <option value="Draft">Draft</option>
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Completed">Completed</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Currency</label>
                <select
                  {...register('currency')}
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Payment Terms</label>
                <input
                  {...register('payment_terms')}
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                  placeholder="e.g., Net 30, Net 60"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Remarks</label>
                <textarea
                  {...register('remarks')}
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                  rows={3}
                  placeholder="Additional notes or terms"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-semibold mb-3">Notification Settings</h4>
              <div className="flex items-center gap-2 mb-4">
                <input
                  id="notification_enabled"
                  type="checkbox"
                  {...register('notification_enabled')}
                  className="w-4 h-4"
                />
                <label htmlFor="notification_enabled" className="text-sm font-medium">
                  Enable renewal notifications
                </label>
              </div>

              {watch('notification_enabled') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Notification Email *</label>
                    <input
                      {...register('notification_email')}
                      type="email"
                      className="w-full px-4 py-2 border border-input rounded-lg bg-background"
                      placeholder="user@example.com"
                    />
                    {errors.notification_email && (
                      <p className="text-sm text-destructive mt-1">{errors.notification_email.message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-8">
                    <input
                      id="notification_mobile"
                      type="checkbox"
                      {...register('notification_mobile')}
                      className="w-4 h-4"
                    />
                    <label htmlFor="notification_mobile" className="text-sm font-medium">
                      Also notify via mobile/SMS
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">Line Items</h3>
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-8 gap-4 p-4 border border-border rounded-lg">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Product *</label>
                    <select
                      {...register(`line_items.${index}.product_id` as const, { valueAsNumber: true })}
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm"
                      onChange={(e) => handleProductChange(index, Number(e.target.value))}
                    >
                      <option value={0}>Select Product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>{product.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Quantity *</label>
                    <input
                      {...register(`line_items.${index}.quantity` as const, { valueAsNumber: true })}
                      type="number"
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Rate *</label>
                    <input
                      {...register(`line_items.${index}.rate` as const, { valueAsNumber: true })}
                      type="number"
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Discount %</label>
                    <input
                      {...register(`line_items.${index}.discount` as const, { valueAsNumber: true })}
                      type="number"
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm"
                      min="0"
                      max="100"
                      step="0.01"
                      defaultValue={0}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Tax %</label>
                    <input
                      {...register(`line_items.${index}.tax` as const, { valueAsNumber: true })}
                      type="number"
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm"
                      min="0"
                      max="100"
                      step="0.01"
                      defaultValue={0}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Remarks</label>
                    <input
                      {...register(`line_items.${index}.remarks` as const)}
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddLineItem}
                className="flex items-center gap-2 px-4 py-2 border border-dashed border-input rounded-lg hover:bg-accent text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Line Item
              </button>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">Review Contract</h3>
            <div className="bg-muted/50 rounded-lg p-6 space-y-6">
              {/* Parties Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold">Parties</h4>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-sm text-primary hover:underline"
                  >
                    Edit
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="ml-2">{customers?.find((c) => c?.id === watch('customer_id'))?.name || 'Not selected'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Contact Person:</span>
                    <span className="ml-2">{contacts?.find((c) => c?.id === watch('contact_person_id'))?.contact_name || 'Not selected'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Company:</span>
                    <span className="ml-2">{watch('company_name') || ''}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Contract Type:</span>
                    <span className="ml-2">{contractTypes?.find((ct) => ct?.id === watch('contract_type_id'))?.name || 'Not selected'}</span>
                  </div>
                </div>
              </div>

              {/* Contract Details Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold">Contract Details</h4>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-sm text-primary hover:underline"
                  >
                    Edit
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Contract Number:</span>
                    <span className="ml-2">Auto-generated by backend</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Contract Date:</span>
                    <span className="ml-2">{watch('contract_date') || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Start Date:</span>
                    <span className="ml-2">{watch('start_date') || ''}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">End Date:</span>
                    <span className="ml-2">{watch('end_date') || ''}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Renewal Date:</span>
                    <span className="ml-2">{watch('renewal_date') || ''}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <span className="ml-2">{watch('status') || ''}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Currency:</span>
                    <span className="ml-2">{watch('currency') || ''}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payment Terms:</span>
                    <span className="ml-2">{watch('payment_terms') || 'Not set'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Remarks:</span>
                    <span className="ml-2">{watch('remarks') || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Notifications:</span>
                    <span className="ml-2">{watch('notification_enabled') ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  {watch('notification_enabled') && (
                    <div>
                      <span className="text-muted-foreground">Notification Email:</span>
                      <span className="ml-2">{watch('notification_email') || 'Not set'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold">Line Items</h4>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="text-sm text-primary hover:underline"
                  >
                    Edit
                  </button>
                </div>
                {fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No line items added</p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-7 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                      <div>Product</div>
                      <div>SKU</div>
                      <div className="text-right">Qty</div>
                      <div className="text-right">Rate</div>
                      <div className="text-right">Discount</div>
                      <div className="text-right">Tax</div>
                      <div className="text-right">Line Total</div>
                    </div>
                    {fields.map((field, index) => {
                      const quantity = watch(`line_items.${index}.quantity`) || 0
                      const rate = watch(`line_items.${index}.rate`) || 0
                      const discount = watch(`line_items.${index}.discount`) || 0
                      const tax = watch(`line_items.${index}.tax`) || 0
                      
                      const baseAmount = quantity * rate
                      const discountAmount = baseAmount * discount / 100
                      const taxableAmount = baseAmount - discountAmount
                      const taxAmount = taxableAmount * tax / 100
                      const lineTotal = taxableAmount + taxAmount
                      
                      return (
                        <div key={field.id} className="grid grid-cols-7 gap-2 text-sm">
                          <div className="truncate">{watch(`line_items.${index}.product_name`) || 'Product'}</div>
                          <div className="truncate text-muted-foreground">{watch(`line_items.${index}.sku`) || '-'}</div>
                          <div className="text-right">{quantity}</div>
                          <div className="text-right">₹{rate.toFixed(2)}</div>
                          <div className="text-right">{discount}%</div>
                          <div className="text-right">{tax}%</div>
                          <div className="text-right font-medium">₹{lineTotal.toFixed(2)}</div>
                        </div>
                      )
                    })}
                    <div className="pt-2 border-t flex justify-end">
                      <span className="font-semibold">Contract Total: ₹{
                        fields.reduce((total, _field, index) => {
                          const quantity = watch(`line_items.${index}.quantity`) || 0
                          const rate = watch(`line_items.${index}.rate`) || 0
                          const discount = watch(`line_items.${index}.discount`) || 0
                          const tax = watch(`line_items.${index}.tax`) || 0
                          
                          const baseAmount = quantity * rate
                          const discountAmount = baseAmount * discount / 100
                          const taxableAmount = baseAmount - discountAmount
                          const taxAmount = taxableAmount * tax / 100
                          const lineTotal = taxableAmount + taxAmount
                          
                          return total + lineTotal
                        }, 0).toFixed(2)
                      }</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Sticky Header */}
        <div className="p-6 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{editContractId ? 'Edit Contract' : 'Create Contract'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  currentStep >= step.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {index < steps.length - 1 && <div className="w-8 h-px bg-border ml-3" />}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {customersLoading || productsLoading || contractTypesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin text-2xl">⏳</div>
            </div>
          ) : (
            renderStep()
          )}
        </div>

        {/* Sticky Footer */}
        <div className="p-6 border-t border-border flex items-center justify-between flex-shrink-0">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={currentStep === steps.length ? (handleSubmit as any)(handleWizardSubmit) : handleNext}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : currentStep === steps.length ? 'Submit' : 'Next'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  )
}
