import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useCreateProduct, useUpdateProduct } from '@/hooks/useProducts'
import { useModal } from '@/hooks/useModal'
import { toast } from 'sonner'
import { queryClient } from '@/lib/react-query'
import { queryKeys } from '@/lib/react-query'
import type { Product } from '@/api/products'

interface ProductFormValues {
  name: string
  code: string
  category: string
  rate: string
  price: string
  description: string
  status: string
}

interface ProductFormModalProps {
  isOpen: boolean
  onClose: () => void
  product?: Product | null
}

const emptyForm: ProductFormValues = {
  name: '',
  code: '',
  category: '',
  rate: '',
  price: '',
  description: '',
  status: 'active',
}

/**
 * Single shared Product create/edit form, used by ProductsPage, the global
 * Quick Add menu, and the Dashboard Quick Actions.
 */
export function ProductFormModal({ isOpen, onClose, product }: ProductFormModalProps) {
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const isEditing = !!product
  const dialogRef = useRef<HTMLDivElement>(null)
  useModal(dialogRef, isOpen, onClose)

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<ProductFormValues>({ defaultValues: emptyForm })

  useEffect(() => {
    if (!isOpen) return
    reset(
      product
        ? {
            name: product.name,
            code: product.code || '',
            category: product.category || '',
            rate: product.rate.toString(),
            price: product.price?.toString() || '',
            description: product.description || '',
            status: product.status,
          }
        : emptyForm,
    )
  }, [isOpen, product, reset])

  const onSubmit = (values: ProductFormValues) => {
    const payload = {
      name: values.name,
      code: values.code || undefined,
      category: values.category || undefined,
      rate: parseFloat(values.rate) || 0,
      price: values.price ? parseFloat(values.price) : undefined,
      description: values.description || undefined,
      status: values.status,
    }

    if (isEditing && product) {
      updateProduct.mutate(
        { id: product.id, data: payload },
        {
          onSuccess: () => {
            toast.success('Product updated successfully')
            queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() })
            onClose()
          },
          onError: (err: any) => toast.error(err?.response?.data?.error || err?.message || 'Failed to update product'),
        },
      )
    } else {
      createProduct.mutate(payload, {
        onSuccess: () => {
          toast.success('Product created successfully')
          queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() })
          onClose()
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || err?.message || 'Failed to create product'),
      })
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="product-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            key="product-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
          >
        <div className="p-6 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 id="product-modal-title" className="text-xl font-semibold">{isEditing ? 'Edit Product' : 'Add Product'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label htmlFor="product-name" className="block text-sm font-medium mb-2">Product Name *</label>
            <input
              id="product-name"
              type="text"
              required
              {...register('name', { required: true })}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="product-code" className="block text-sm font-medium mb-2">Code</label>
              <input id="product-code" {...register('code')} className="w-full px-3 py-2 bg-background border border-input rounded-lg" />
            </div>
            <div>
              <label htmlFor="product-category" className="block text-sm font-medium mb-2">Category</label>
              <input id="product-category" {...register('category')} className="w-full px-3 py-2 bg-background border border-input rounded-lg" placeholder="General" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="product-rate" className="block text-sm font-medium mb-2">Rate *</label>
              <input
                id="product-rate"
                type="number"
                step="0.01"
                required
                {...register('rate', { required: true })}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="product-price" className="block text-sm font-medium mb-2">Reference Price</label>
              <input id="product-price" type="number" step="0.01" {...register('price')} className="w-full px-3 py-2 bg-background border border-input rounded-lg" />
            </div>
          </div>
          <div>
            <label htmlFor="product-description" className="block text-sm font-medium mb-2">Description</label>
            <textarea id="product-description" {...register('description')} rows={3} className="w-full px-3 py-2 bg-background border border-input rounded-lg" />
          </div>
          <div>
            <label htmlFor="product-status" className="block text-sm font-medium mb-2">Status</label>
            <select id="product-status" {...register('status')} className="w-full px-3 py-2 bg-background border border-input rounded-lg">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
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
