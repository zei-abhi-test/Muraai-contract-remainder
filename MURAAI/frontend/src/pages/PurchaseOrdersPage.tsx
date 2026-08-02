import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Trash2, Eye, Edit3, X,
  Send, Ban, CheckCircle, Copy, Download, MoreHorizontal,
} from 'lucide-react'
import {
  usePurchaseOrders, useDeletePurchaseOrder, usePurchaseOrder,
  useSubmitPurchaseOrder, useCancelPurchaseOrder,
  useMarkReceivedPurchaseOrder, useDuplicatePurchaseOrder,
} from '@/hooks/usePurchaseOrders'
import { useCustomers } from '@/hooks/useCustomers'
import { PurchaseOrderFormModal } from '@/features/purchase-orders/PurchaseOrderFormModal'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

import { useQuickAddStore } from '@/store/quickAddStore'
import { toast } from 'sonner'
import { purchaseOrdersApi } from '@/api/purchaseOrders'
import type { PurchaseOrder } from '@/api/purchaseOrders'
import { DataTable, type Column, PageHeader, StatusBadge } from '@/components/ui'

export function PurchaseOrdersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null)
  const [deletingPO, setDeletingPO] = useState<PurchaseOrder | null>(null)
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null)
  const [menuOpenPO, setMenuOpenPO] = useState<number | null>(null)
  const [sortField, setSortField] = useState<string>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const openQuickAdd = useQuickAddStore((state) => state.open)

  const { data: purchaseOrdersData, isLoading: posLoading, error: posError } = usePurchaseOrders({ search: searchQuery || undefined })
  const { data: customers = [] } = useCustomers()
  const deletePurchaseOrder = useDeletePurchaseOrder()
  const submitPO = useSubmitPurchaseOrder()
  const cancelPO = useCancelPurchaseOrder()
  const markReceivedPO = useMarkReceivedPurchaseOrder()
  const duplicatePO = useDuplicatePurchaseOrder()
  const { data: detailPO } = usePurchaseOrder(viewingPO?.id || 0)

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const purchaseOrders = (purchaseOrdersData || []).sort((a, b) => {
    if (!sortField) return 0
    const aVal = a[sortField as keyof typeof a]
    const bVal = b[sortField as keyof typeof b]
    if (aVal == null) return 1
    if (bVal == null) return -1
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  })

  const customerMap = useMemo(() => {
    const map: Record<number, string> = {}
    customers.forEach((c) => { map[c.id] = c.name })
    return map
  }, [customers])

  const handleConfirmDelete = () => {
    if (!deletingPO) return
    deletePurchaseOrder.mutate(deletingPO.id, {
      onSuccess: () => {
        toast.success(`PO "${deletingPO.po_number}" deleted`)
        setDeletingPO(null)
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.error || err?.message || 'Failed to delete PO')
        setDeletingPO(null)
      },
    })
  }

  const handleEdit = (po: PurchaseOrder) => {
    setEditingPO(po)
    setIsModalOpen(true)
  }

  const handleDownloadPdf = async (po: PurchaseOrder) => {
    try {
      const blob = await purchaseOrdersApi.downloadPurchaseOrderPdf(po.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${po.po_number}.txt`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to download PO')
    }
  }


  const getCustomerName = (customerId: number | null) => !customerId ? '-' : customerMap[customerId] || `ID: ${customerId}`

  const handleFormClose = () => {
    setIsModalOpen(false)
    setEditingPO(null)
  }

  const allowedActions = (po: PurchaseOrder) => po.allowed_actions || []

  const columns: Column<PurchaseOrder>[] = [
    { key: 'po_number', header: 'PO Number', sortable: true, render: po => <div className="font-medium">{po.po_number}</div> },
    { key: 'po_date', header: 'Date', sortable: true, render: po => <span className="text-sm">{po.po_date}</span> },
    { key: 'vendor', header: 'Vendor', sortable: true, render: po => <span className="text-sm">{po.vendor}</span> },
    { key: 'customer_id', header: 'Customer', render: po => <span className="text-sm">{getCustomerName(po.customer_id)}</span> },
    { key: 'issue_date', header: 'Issue Date', render: po => <span className="text-sm">{po.issue_date || '-'}</span> },
    { key: 'expected_delivery', header: 'Delivery', render: po => <span className="text-sm">{po.expected_delivery || '-'}</span> },
    { key: 'amount', header: 'Amount', sortable: true, render: po => <span className="text-sm">{po.currency || 'INR'} {po.amount?.toLocaleString() || '0'}</span> },
    {
      key: 'status',
      header: 'Status',
      render: po => <StatusBadge status={po.status} dot />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: po => (
        <div className="flex items-center gap-1">
          <button onClick={() => setViewingPO(po)} className="p-2 hover:bg-accent rounded-lg" aria-label={`View PO ${po.po_number}`}>
            <Eye className="w-4 h-4" />
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpenPO(menuOpenPO === po.id ? null : po.id)} className="p-2 hover:bg-accent rounded-lg" aria-label={`More actions for ${po.po_number}`}>
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpenPO === po.id && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl z-50 py-1 min-w-[160px]">
                {allowedActions(po).includes('edit') && (
                  <button onClick={() => { setMenuOpenPO(null); handleEdit(po) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent">
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
                {allowedActions(po).includes('po_submit') && (
                  <button onClick={() => { setMenuOpenPO(null); submitPO.mutate(po.id) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent">
                    <Send className="w-3.5 h-3.5" /> Submit
                  </button>
                )}
                {allowedActions(po).includes('po_cancel') && (
                  <button onClick={() => { setMenuOpenPO(null); cancelPO.mutate(po.id) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-destructive">
                    <Ban className="w-3.5 h-3.5" /> Cancel
                  </button>
                )}
                {allowedActions(po).includes('po_mark_received') && (
                  <button onClick={() => { setMenuOpenPO(null); markReceivedPO.mutate(po.id) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent">
                    <CheckCircle className="w-3.5 h-3.5" /> Mark Received
                  </button>
                )}
                <button onClick={() => { setMenuOpenPO(null); duplicatePO.mutate(po.id) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent">
                  <Copy className="w-3.5 h-3.5" /> Duplicate
                </button>
                <button onClick={() => { setMenuOpenPO(null); handleDownloadPdf(po) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent">
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
                <button onClick={() => { setMenuOpenPO(null); setDeletingPO(po) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-destructive">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description="Manage purchase orders and vendor relationships."
        breadcrumbs={[{ label: 'Purchase Orders' }]}
        action={
          <button onClick={() => openQuickAdd('purchase-order')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Purchase Order
          </button>
        }
      />

      <div
        className="bg-card border border-border rounded-xl p-6">
        <DataTable
          columns={columns}
          data={purchaseOrders}
          keyExtractor={po => po.id}
          isLoading={posLoading}
          error={posError ? 'Failed to load purchase orders. Please try again.' : null}
          emptyMessage={searchQuery ? 'No POs match your search.' : 'No purchase orders yet'}
          emptyAction={!searchQuery ? (
            <button onClick={() => openQuickAdd('purchase-order')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium">
              <Plus className="w-4 h-4" /> Add Purchase Order
            </button>
          ) : undefined}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search POs..."
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
        />
      </div>

      <PurchaseOrderFormModal isOpen={isModalOpen} onClose={handleFormClose} purchaseOrder={editingPO} />
      <ConfirmDeleteModal isOpen={!!deletingPO} title={`Delete PO "${deletingPO?.po_number}"?`}
        description="This action cannot be undone." isDeleting={deletePurchaseOrder.isPending}
        onCancel={() => setDeletingPO(null)} onConfirm={handleConfirmDelete} />

      {viewingPO && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Purchase Order Details</h2>
                <button onClick={() => setViewingPO(null)} className="p-2 hover:bg-accent rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm text-muted-foreground">PO Number</label><p className="font-medium">{viewingPO.po_number}</p></div>
                <div><label className="text-sm text-muted-foreground">Date</label><p className="font-medium">{viewingPO.po_date}</p></div>
                <div><label className="text-sm text-muted-foreground">Vendor</label><p className="font-medium">{viewingPO.vendor}</p></div>
                <div><label className="text-sm text-muted-foreground">Customer</label><p className="font-medium">{getCustomerName(viewingPO.customer_id)}</p></div>
                <div><label className="text-sm text-muted-foreground">Issue Date</label><p className="font-medium">{viewingPO.issue_date || '-'}</p></div>
                <div><label className="text-sm text-muted-foreground">Expected Delivery</label><p className="font-medium">{viewingPO.expected_delivery || '-'}</p></div>
                <div><label className="text-sm text-muted-foreground">Amount</label><p className="font-medium">{viewingPO.currency || 'INR'} {viewingPO.amount?.toLocaleString() || '0'}</p></div>
                <div><label className="text-sm text-muted-foreground">Status</label><p><StatusBadge status={viewingPO.status} /></p></div>
              </div>
              {viewingPO.remarks && (
                <div><label className="text-sm text-muted-foreground block mb-1">Remarks</label><p className="text-sm">{viewingPO.remarks}</p></div>
              )}
              {detailPO && detailPO.contract_ids && detailPO.contract_ids.length > 0 && (
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Linked Contracts</label>
                  <div className="space-y-1">
                    {detailPO.contract_ids.map((cid) => (
                      <div key={cid} className="text-sm px-3 py-1.5 bg-muted rounded-lg">Contract #{cid}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

