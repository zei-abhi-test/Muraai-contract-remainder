import { z } from 'zod'

// Customer validation schema - matches backend
export const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  customer_code: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().optional(),
})

export type CustomerFormData = z.infer<typeof customerSchema>

// Contract validation schema - matches backend
export const contractSchema = z.object({
  company_name: z.string().min(2, 'Company name must be at least 2 characters'),
  contract_name: z.string().min(2, 'Contract name must be at least 2 characters'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  renewal_date: z.string().min(1, 'Renewal date is required'),
  notification_enabled: z.boolean(),
  notification_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  notification_mobile: z.boolean(),
  notes: z.string().optional(),
  contract_number: z.string().optional(),
  customer_id: z.number().optional(),
  contact_person_id: z.number().optional(),
  contract_type_id: z.number().optional(),
  contract_date: z.string().optional(),
  status: z.string(),
  currency: z.string(),
  payment_terms: z.string().optional(),
  remarks: z.string().optional(),
  contract_version: z.number(),
  parent_contract_id: z.number().optional(),
  previous_contract_id: z.number().optional(),
  line_items: z.array(z.object({
    product_id: z.number().optional(),
    product_name: z.string().min(1, 'Product name is required'),
    sku: z.string().optional(),
    quantity: z.number().min(0, 'Quantity must be positive'),
    rate: z.number().min(0, 'Rate must be positive'),
    discount: z.number().min(0, 'Discount must be positive').max(100, 'Discount cannot exceed 100%').default(0),
    tax: z.number().min(0, 'Tax must be positive').max(100, 'Tax cannot exceed 100%').default(0),
    remarks: z.string().optional(),
  })).optional(),
}).refine(
  (data) => {
    if (!data.notification_enabled) return true
    return !!data.notification_email && data.notification_email.trim().length > 0
  },
  {
    message: 'Notification email is required when notifications are enabled',
    path: ['notification_email'],
  },
)

export type ContractFormData = z.infer<typeof contractSchema>

// Purchase Order validation schema
export const purchaseOrderSchema = z.object({
  po_number: z.string().optional(),
  po_date: z.string().optional(),
  vendor: z.string().min(1, 'Vendor is required'),
  customer_id: z.number().optional(),
  amount: z.number().min(0, 'Amount must be positive'),
  status: z.string(),
  issue_date: z.string().optional(),
  expected_delivery: z.string().optional(),
  currency: z.string().default('INR'),
  remarks: z.string().optional(),
  contract_ids: z.array(z.number()).optional(),
})

export type PurchaseOrderFormData = z.infer<typeof purchaseOrderSchema>

// Invoice validation schema
export const invoiceSchema = z.object({
  invoice_number: z.string().optional(),
  contract_id: z.number().optional(),
  customer_id: z.number().optional(),
  purchase_order_id: z.number().optional(),
  amount: z.number().min(0, 'Amount must be positive'),
  tax: z.number().min(0, 'Tax must be positive').default(0),
  discount: z.number().min(0, 'Discount must be positive').default(0),
  total: z.number().min(0, 'Total must be positive'),
  currency: z.string().default('INR'),
  invoice_date: z.string().optional(),
  due_date: z.string().optional(),
  status: z.string().default('DRAFT'),
  remarks: z.string().optional(),
  line_items: z.array(z.object({
    product_id: z.number().optional(),
    product_name: z.string().min(1, 'Product name is required'),
    sku: z.string().optional(),
    quantity: z.number().min(0, 'Quantity must be positive'),
    rate: z.number().min(0, 'Rate must be positive'),
    discount: z.number().min(0, 'Discount must be positive').default(0),
    tax: z.number().min(0, 'Tax must be positive').default(0),
    amount: z.number().min(0, 'Amount must be positive'),
  })).optional(),
})

export type InvoiceFormData = z.infer<typeof invoiceSchema>

// Contact validation schema - matches backend
export const contactSchema = z.object({
  customer_id: z.number().min(1, 'Customer is required'),
  contact_name: z.string().min(2, 'Contact name must be at least 2 characters'),
  contact_number: z.string().min(10, 'Phone number must be at least 10 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  designation: z.string().optional(),
})

export type ContactFormData = z.infer<typeof contactSchema>

// Login validation schema - matches backend
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export type LoginFormData = z.infer<typeof loginSchema>

// Register validation schema - matches backend
export const registerSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export type RegisterFormData = z.infer<typeof registerSchema>

// Approval validation schema
export const approvalRejectSchema = z.object({
  comments: z.string().min(1, 'Comments are required when rejecting'),
})

export type ApprovalRejectFormData = z.infer<typeof approvalRejectSchema>
