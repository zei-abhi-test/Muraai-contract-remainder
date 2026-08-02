import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit, Trash2, X } from 'lucide-react'
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from '@/hooks/useProducts'
import { toast } from 'sonner'
import type { Product } from '@/api/products'
import { DataTable, type Column, PageHeader, StatusBadge } from '@/components/ui'

export function ProductsPage() {
  const { data: products = [], isLoading, error } = useProducts()
  const createProductMutation = useCreateProduct()
  const updateProductMutation = useUpdateProduct()
  const deleteProductMutation = useDeleteProduct()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: '',
    rate: '',
    price: '',
    description: '',
    status: 'Active'
  })

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.code && product.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortField) return 0
    const aVal = a[sortField as keyof typeof a]
    const bVal = b[sortField as keyof typeof b]
    if (aVal == null) return 1
    if (bVal == null) return -1
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  })

  const handleAddProduct = () => {
    setFormData({
      name: '',
      code: '',
      category: '',
      rate: '',
      price: '',
      description: '',
      status: 'Active'
    })
    setIsCreateModalOpen(true)
  }

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product)
    setFormData({
      name: product.name,
      code: product.code || '',
      category: product.category || '',
      rate: product.rate.toString(),
      price: product.price?.toString() || '',
      description: product.description || '',
      status: product.status
    })
    setIsEditModalOpen(true)
  }

  const handleDeleteProduct = (id: number) => {
    deleteProductMutation.mutate(id, {
      onSuccess: () => toast.success('Product deleted'),
      onError: (err: any) => toast.error(err?.response?.data?.error || err?.message || 'Failed to delete product'),
    })
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      name: formData.name,
      code: formData.code || undefined,
      category: formData.category || undefined,
      rate: parseFloat(formData.rate) || 0,
      price: formData.price ? parseFloat(formData.price) : undefined,
      description: formData.description || undefined,
      status: formData.status
    }
    
    createProductMutation.mutate(payload, {
      onSuccess: () => {
        setIsCreateModalOpen(false)
        setFormData({
          name: '',
          code: '',
          category: '',
          rate: '',
          price: '',
          description: '',
          status: 'Active'
        })
      }
    })
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct) return
    
    const payload = {
      name: formData.name,
      code: formData.code || undefined,
      category: formData.category || undefined,
      rate: parseFloat(formData.rate) || 0,
      price: formData.price ? parseFloat(formData.price) : undefined,
      description: formData.description || undefined,
      status: formData.status
    }
    
    updateProductMutation.mutate({ id: selectedProduct.id, data: payload }, {
      onSuccess: () => {
        setIsEditModalOpen(false)
        setSelectedProduct(null)
      }
    })
  }

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product',
      sortable: true,
      render: p => (
        <div>
          <div className="font-medium">{p.name}</div>
          {p.description && <div className="text-sm text-muted-foreground">{p.description}</div>}
        </div>
      ),
    },
    { key: 'code', header: 'Code', hideable: true, defaultHidden: true, render: p => <span className="font-mono text-sm">{p.code || '-'}</span> },
    { key: 'sku', header: 'SKU', hideable: true, render: p => <span className="font-mono text-sm">{p.sku}</span> },
    { key: 'category', header: 'Category', hideable: true, render: p => <span>{p.category || '-'}</span> },
    { key: 'rate', header: 'Rate', sortable: true, render: p => <>${p.rate.toLocaleString()}</> },
    {
      key: 'status',
      header: 'Status',
      hideable: true,
      render: p => <StatusBadge status={p.status} dot />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: p => (
        <div className="flex items-center gap-2">
          <button onClick={() => handleEditProduct(p)} className="p-2 hover:bg-accent rounded-lg">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={() => handleDeleteProduct(p.id)} className="p-2 hover:bg-accent rounded-lg text-destructive">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your product catalog and SKUs."
        breadcrumbs={[{ label: 'Products' }]}
        action={
          <button onClick={handleAddProduct}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        }
      />

      <div
        className="bg-card border border-border rounded-xl p-6"
      >
        <DataTable
          columns={columns}
          data={sortedProducts}
          keyExtractor={p => p.id}
          isLoading={isLoading}
          error={error ? 'Failed to load products' : null}
          emptyMessage={searchQuery ? 'No products match your search.' : 'No products yet'}
          emptyAction={!searchQuery ? (
            <button onClick={handleAddProduct}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          ) : undefined}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search products..."
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
        />
      </div>

      {/* Create Product Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="p-6 border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Add Product</h2>
                <button 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-2 hover:bg-accent rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Product Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg"
                  placeholder="Enter product name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Product Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg"
                  placeholder="Enter product code (optional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg"
                  placeholder="Enter category (optional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Rate *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg"
                  placeholder="Enter rate"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg"
                  placeholder="Enter price (optional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg min-h-[80px]"
                  placeholder="Enter description (optional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-input rounded-lg hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProductMutation.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {createProductMutation.isPending ? 'Creating...' : 'Create Product'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Product Modal */}
      {isEditModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="p-6 border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Edit Product</h2>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 hover:bg-accent rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Product Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg"
                  placeholder="Enter product name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Product Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg"
                  placeholder="Enter product code (optional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg"
                  placeholder="Enter category (optional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Rate *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg"
                  placeholder="Enter rate"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg"
                  placeholder="Enter price (optional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg min-h-[80px]"
                  placeholder="Enter description (optional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-input rounded-lg hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateProductMutation.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {updateProductMutation.isPending ? 'Updating...' : 'Update Product'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
