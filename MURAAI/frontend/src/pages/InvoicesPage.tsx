import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Trash2, Eye, Edit3,
  Send, CheckCircle, XCircle, X, Copy, Download, MoreHorizontal,
} from 'lucide-react'
import {
  useInvoices, useDeleteInvoice, useIssueInvoice, useMarkPaid,
  useCancelInvoice, useDuplicateInvoice, useDownloadInvoicePdf,
  useSendInvoiceEmail,
} from '@/hooks/useInvoices'
import { useCustomers } from '@/hooks/useCustomers'
import { useContracts } from '@/hooks/useContracts'
import { InvoiceFormModal } from '@/features/invoices/InvoiceFormModal'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

import { DataTable, type Column, PageHeader, StatusBadge } from '@/components/ui'
import { useUIStore } from '@/store/uiStore'
import { useQuickAddStore } from '@/store/quickAddStore'
import { toast } from 'sonner'
import type { Invoice } from '@/api/invoices'

export function InvoicesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null)
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
  const [emailModalId, setEmailModalId] = useState<number | null>(null)
  const [emailTo, setEmailTo] = useState('')
  const [sortField, setSortField] = useState<string>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const pageParams = useUIStore((state) => state.pageParams)
  const openQuickAdd = useQuickAddStore((state) => state.open)

  const { data: invoicesData, isLoading: invoicesLoading, error: invoicesError } = useInvoices({ search: searchQuery })
  const { data: customers = [] } = useCustomers()
  const { data: contracts = [] } = useContracts()
  const deleteInvoice = useDeleteInvoice()
  const issueInvoice = useIssueInvoice()
  const markPaid = useMarkPaid()
  const cancelInvoice = useCancelInvoice()
  const duplicateInvoice = useDuplicateInvoice()
  const downloadPdf = useDownloadInvoicePdf()
  const sendEmail = useSendInvoiceEmail()

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const invoices = (invoicesData || []).filter(invoice => {
    if (!statusFilter) return true
    if (statusFilter === 'overdue') return invoice.status === 'OVERDUE'
    if (statusFilter === 'outstanding') return invoice.status === 'ISSUED' || invoice.status === 'DRAFT'
    return invoice.status === statusFilter
  }).sort((a, b) => {
    if (!sortField) return 0
    const aVal = a[sortField as keyof typeof a]
    const bVal = b[sortField as keyof typeof b]
    if (aVal == null) return 1
    if (bVal == null) return -1
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  })

  useEffect(() => {
    if (pageParams.status) setStatusFilter(pageParams.status)
  }, [pageParams.status])

  const customerMap = useMemo(() => {
    const map: Record<number, string> = {}
    customers.forEach((c) => { map[c.id] = c.name })
    return map
  }, [customers])

  const contractMap = useMemo(() => {
    const map: Record<number, string> = {}
    contracts.forEach((c) => { map[c.id] = c.contract_name })
    return map
  }, [contracts])

  const handleConfirmDelete = () => {
    if (!deletingInvoice) return
    deleteInvoice.mutate(deletingInvoice.id, {
      onSuccess: () => { toast.success('Invoice deleted'); setDeletingInvoice(null) },
      onError: (err: any) => { toast.error(err?.response?.data?.error || err?.message || 'Failed to delete'); setDeletingInvoice(null) },
    })
  }

  const handleEdit = (inv: Invoice) => { setEditingInvoice(inv); setIsModalOpen(true) }
  const handleFormClose = () => { setIsModalOpen(false); setEditingInvoice(null) }


  const formatCurrency = (amount: number, currency = 'INR') => `${currency} ${amount.toLocaleString()}`
  const getCustomerName = (customerId: number | null) => !customerId ? '-' : customerMap[customerId] || `ID: ${customerId}`
  const getContractName = (contractId: number | null) => !contractId ? '-' : contractMap[contractId] || `ID: ${contractId}`

  const statusFilters = ['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED']

  const handleSendEmail = () => {
    if (!emailModalId || !emailTo) return
    sendEmail.mutate({ id: emailModalId, toEmail: emailTo }, {
      onSuccess: () => { setEmailModalId(null); setEmailTo('') },
    })
  }

  const columns: Column<Invoice>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice',
      sortable: true,
      render: inv => (
        <div>
          <div className="font-medium">{inv.invoice_number}</div>
          <div className="text-sm text-muted-foreground">{inv.invoice_date}</div>
        </div>
      ),
    },
    {
      key: 'contract_id',
      header: 'Contract',
      render: inv => <span className="text-sm">{getContractName(inv.contract_id)}</span>,
    },
    {
      key: 'customer_id',
      header: 'Customer',
      render: inv => <span className="text-sm">{getCustomerName(inv.customer_id)}</span>,
    },
    {
      key: 'total',
      header: 'Amount',
      sortable: true,
      render: inv => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{formatCurrency(inv.total || inv.amount, inv.currency)}</span>
        </div>
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      sortable: true,
      render: inv => <span className="text-sm">{inv.due_date || '-'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: inv => <StatusBadge status={inv.status} dot />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: inv => (
        <div className="flex items-center gap-1">
          <button onClick={() => setViewingInvoice(inv)} className="p-2 hover:bg-accent rounded-lg" title="View">
            <Eye className="w-4 h-4" />
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpenId(menuOpenId === inv.id ? null : inv.id)} className="p-2 hover:bg-accent rounded-lg" title="More">
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpenId === inv.id && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl z-50 py-1 min-w-[160px]">
                {inv.status === 'DRAFT' && (
                  <>
                    <button onClick={() => { setMenuOpenId(null); handleEdit(inv) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent">
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => { setMenuOpenId(null); issueInvoice.mutate(inv.id) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent">
                      <Send className="w-3.5 h-3.5" /> Issue
                    </button>
                    <button onClick={() => { setMenuOpenId(null); setDeletingInvoice(inv) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-destructive">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </>
                )}
                {(inv.status === 'ISSUED' || inv.status === 'OVERDUE') && (
                  <>
                    <button onClick={() => { setMenuOpenId(null); markPaid.mutate(inv.id) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-green-600 dark:text-green-400">
                      <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
                    </button>
                    <button onClick={() => { setMenuOpenId(null); cancelInvoice.mutate(inv.id) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-destructive">
                      <XCircle className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </>
                )}
                <button onClick={() => { setMenuOpenId(null); duplicateInvoice.mutate(inv.id) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent">
                  <Copy className="w-3.5 h-3.5" /> Duplicate
                </button>
                <button onClick={() => { setMenuOpenId(null); downloadPdf.mutate(inv.id) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent">
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
                <button onClick={() => { setMenuOpenId(null); setEmailModalId(inv.id); setEmailTo('') }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent">
                  <Send className="w-3.5 h-3.5" /> Send Email
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
        title="Invoices"
        description="Manage invoices and payments."
        breadcrumbs={[{ label: 'Invoices' }]}
        action={
          <button onClick={() => openQuickAdd('invoice')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium">
            <Plus className="w-4 h-4" /> Create Invoice
          </button>
        }
      />

      <div
        className="bg-card border border-border rounded-xl p-6">
        <DataTable
          columns={columns}
          data={invoices}
          keyExtractor={inv => inv.id}
          isLoading={invoicesLoading}
          error={invoicesError ? 'Failed to load invoices. Please try again.' : null}
          emptyMessage={searchQuery || statusFilter ? 'No invoices match your filters.' : 'No invoices yet'}
          emptyAction={!searchQuery && !statusFilter ? (
            <button onClick={() => openQuickAdd('invoice')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium">
              <Plus className="w-4 h-4" /> Create Invoice
            </button>
          ) : undefined}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search invoices..."
          filters={
            <div className="flex items-center gap-2">
              {statusFilters.map(s => (
                <button key={s} onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}>{s}</button>
              ))}
              {statusFilter && (
                <button onClick={() => setStatusFilter(null)}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-lg">
                  Clear
                </button>
              )}
            </div>
          }
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
        />
      </div>

      <InvoiceFormModal isOpen={isModalOpen} onClose={handleFormClose} invoice={editingInvoice} />
      <ConfirmDeleteModal isOpen={!!deletingInvoice} title={`Delete invoice "${deletingInvoice?.invoice_number}"?`}
        description="Only DRAFT invoices can be deleted." isDeleting={deleteInvoice.isPending}
        onCancel={() => setDeletingInvoice(null)} onConfirm={handleConfirmDelete} />

      {emailModalId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Send Invoice Email</h3>
            <input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)}
              placeholder="recipient@example.com" className="w-full px-3 py-2 bg-background border border-input rounded-lg mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setEmailModalId(null); setEmailTo('') }} className="px-4 py-2 border border-input rounded-lg">Cancel</button>
              <button onClick={handleSendEmail} disabled={!emailTo || sendEmail.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
                {sendEmail.isPending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {viewingInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Invoice Details</h2>
                <button onClick={() => setViewingInvoice(null)} className="p-2 hover:bg-accent rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm text-muted-foreground">Invoice Number</label><p className="font-medium">{viewingInvoice.invoice_number}</p></div>
                <div><label className="text-sm text-muted-foreground">Status</label><p><StatusBadge status={viewingInvoice.status} /></p></div>
                <div><label className="text-sm text-muted-foreground">Contract</label><p className="font-medium">{getContractName(viewingInvoice.contract_id)}</p></div>
                <div><label className="text-sm text-muted-foreground">Customer</label><p className="font-medium">{getCustomerName(viewingInvoice.customer_id)}</p></div>
                <div><label className="text-sm text-muted-foreground">Invoice Date</label><p className="font-medium">{viewingInvoice.invoice_date}</p></div>
                <div><label className="text-sm text-muted-foreground">Due Date</label><p className="font-medium">{viewingInvoice.due_date || '-'}</p></div>
                <div><label className="text-sm text-muted-foreground">Paid Date</label><p className="font-medium">{viewingInvoice.paid_date || '-'}</p></div>
                <div><label className="text-sm text-muted-foreground">Currency</label><p className="font-medium">{viewingInvoice.currency || 'INR'}</p></div>
                <div className="col-span-2"><label className="text-sm text-muted-foreground">Amount</label><p className="font-medium">{formatCurrency(viewingInvoice.amount, viewingInvoice.currency)}</p></div>
                <div><label className="text-sm text-muted-foreground">Tax</label><p className="font-medium">{viewingInvoice.tax || 0}</p></div>
                <div><label className="text-sm text-muted-foreground">Discount</label><p className="font-medium">{viewingInvoice.discount || 0}</p></div>
                <div className="col-span-2"><label className="text-sm text-muted-foreground">Grand Total</label><p className="font-bold text-lg">{formatCurrency(viewingInvoice.total || viewingInvoice.amount, viewingInvoice.currency)}</p></div>
                {viewingInvoice.remarks && (
                  <div className="col-span-2"><label className="text-sm text-muted-foreground">Remarks</label><p className="text-sm">{viewingInvoice.remarks}</p></div>
                )}
              </div>
              {viewingInvoice.line_items && viewingInvoice.line_items.length > 0 && (
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Line Items</label>
                  <div className="space-y-1">
                    {viewingInvoice.line_items.map((li) => (
                      <div key={li.id} className="text-sm px-3 py-1.5 bg-muted rounded-lg flex justify-between">
                        <span>{li.product_name} x{li.quantity}</span>
                        <span className="font-medium">{li.amount}</span>
                      </div>
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

