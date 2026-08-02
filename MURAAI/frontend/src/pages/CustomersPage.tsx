import { useState } from 'react'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { useCustomers, useDeleteCustomer } from '@/hooks/useCustomers'
import { CustomerFormModal } from '@/features/customers/CustomerFormModal'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { DataTable, type Column, Button, PageHeader } from '@/components/ui'
import { useQuickAddStore } from '@/store/quickAddStore'
import { toast } from 'sonner'
import { queryClient } from '@/lib/react-query'
import { queryKeys } from '@/lib/react-query'
import type { Customer } from '@/api/customers'

export function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null)
  const [sortField, setSortField] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const openQuickAdd = useQuickAddStore((state) => state.open)

  const { data: customers, isLoading: customersLoading, error: customersError } = useCustomers()
  const deleteCustomer = useDeleteCustomer()

  const sortedCustomers = (customers?.filter(customer =>
    customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.customer_code?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []).sort((a, b) => {
    if (!sortField) return 0
    const aVal = a[sortField as keyof typeof a]
    const bVal = b[sortField as keyof typeof b]
    if (aVal == null) return 1
    if (bVal == null) return -1
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  })

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setEditingCustomer(null)
  }

  const handleConfirmDelete = () => {
    if (!deletingCustomer) return
    deleteCustomer.mutate(deletingCustomer.id, {
      onSuccess: () => {
        toast.success(`Customer "${deletingCustomer.name}" deleted`)
        setDeletingCustomer(null)
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() })
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.error || err?.message || 'Failed to delete customer')
        setDeletingCustomer(null)
      },
    })
  }

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: c => (
        <div>
          <div className="font-medium">{c.name}</div>
          {c.customer_code && <div className="text-sm text-muted-foreground">{c.customer_code}</div>}
        </div>
      ),
    },
    { key: 'email', header: 'Email', render: c => <span className="text-sm text-muted-foreground">{c.email || '-'}</span> },
    { key: 'phone', header: 'Phone', render: c => <span className="text-sm text-muted-foreground">{c.phone || '-'}</span> },
    { key: 'address', header: 'Address', render: c => <span className="text-sm text-muted-foreground truncate max-w-[200px] block">{c.address || '-'}</span> },
    {
      key: 'created_at',
      header: 'Created',
      render: c => <span className="text-sm text-muted-foreground">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: c => (
        <div className="flex items-center gap-2">
          <button onClick={() => handleEdit(c)} className="p-2 hover:bg-accent rounded-lg" aria-label={`Edit ${c.name}`}>
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={() => setDeletingCustomer(c)} className="p-2 hover:bg-accent rounded-lg text-destructive" aria-label={`Delete ${c.name}`}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage your customers and their information."
        breadcrumbs={[{ label: 'Customers' }]}
        action={
          <button onClick={() => openQuickAdd('customer')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium">
            <Plus className="w-4 h-4" /> New Customer
          </button>
        }
      />

      <div
        className="bg-card border border-border rounded-xl p-6">
        <DataTable
          columns={columns}
          data={sortedCustomers}
          keyExtractor={c => c.id}
          isLoading={customersLoading}
          error={customersError ? 'Failed to load customers. Please try again.' : null}
          emptyMessage={searchQuery ? 'No customers match your search.' : 'No customers yet'}
          emptyAction={!searchQuery ? (
            <Button onClick={() => openQuickAdd('customer')}>
              <Plus className="w-4 h-4" /> New Customer
            </Button>
          ) : undefined}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search customers..."
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
        />
      </div>

      <CustomerFormModal isOpen={isModalOpen} onClose={handleModalClose} customer={editingCustomer} />
      <ConfirmDeleteModal isOpen={!!deletingCustomer} title={`Delete customer "${deletingCustomer?.name}"?`}
        isDeleting={deleteCustomer.isPending} onCancel={() => setDeletingCustomer(null)} onConfirm={handleConfirmDelete} />
    </div>
  )
}
