import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Eye, CheckCircle, XCircle, X,
  MoreVertical, Ban, Trash2, Clock,
} from 'lucide-react'
import {
  useApprovals, useApproveRequest, useRejectRequest,
  useCancelRequest, useDeleteRequest,
} from '@/hooks/useApprovals'
import { useUIStore } from '@/store/uiStore'
import { DataTable, type Column, PageHeader, EmptyState, StatusBadge } from '@/components/ui'
import { toast } from 'sonner'
import type { Approval } from '@/api/approvals'

const TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
]

function formatDate(dateString: string | null) {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatCurrency(value?: number) {
  return `$${(value || 0).toLocaleString()}`
}

export function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState('pending')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null)
  const [rejectModal, setRejectModal] = useState<Approval | null>(null)
  const [rejectComments, setRejectComments] = useState('')
  const [openDropdown, setOpenDropdown] = useState<number | null>(null)
  const setActivePage = useUIStore((state) => state.setActivePage)

  const { data, isLoading, isError, error } = useApprovals({
    status: activeTab || undefined,
    search: search || undefined,
    page,
    per_page: 15,
  })

  const approvals = data?.approvals || []
  const totalPages = data?.pages || 0
  const total = data?.total || 0

  const approveMutation = useApproveRequest()
  const rejectMutation = useRejectRequest()
  const cancelMutation = useCancelRequest()
  const deleteMutation = useDeleteRequest()

  const handleView = (approval: Approval) => {
    setSelectedApproval(approval)
    setOpenDropdown(null)
  }

  const handleApprove = (approval: Approval) => {
    approveMutation.mutate({ id: Number(approval.id), data: {} }, {
      onSuccess: () => {
        toast.success(`Contract "${approval.contract_name}" approved`)
        setSelectedApproval(null)
      },
      onError: (err: any) => toast.error(err?.response?.data?.error || err?.message || 'Failed to approve'),
    })
    setOpenDropdown(null)
  }

  const handleRejectOpen = (approval: Approval) => {
    setRejectModal(approval)
    setRejectComments('')
    setOpenDropdown(null)
  }

  const handleRejectConfirm = () => {
    if (!rejectModal) return
    rejectMutation.mutate(
      { id: Number(rejectModal.id), data: { comments: rejectComments } },
      {
        onSuccess: () => {
          toast.success(`Contract "${rejectModal.contract_name}" rejected`)
          setRejectModal(null)
          setSelectedApproval(null)
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || err?.message || 'Failed to reject'),
      },
    )
  }

  const handleCancel = (approval: Approval) => {
    cancelMutation.mutate(Number(approval.id), {
      onSuccess: () => {
        toast.success(`Approval for "${approval.contract_name}" cancelled`)
        setSelectedApproval(null)
      },
      onError: (err: any) => toast.error(err?.response?.data?.error || err?.message || 'Failed to cancel'),
    })
    setOpenDropdown(null)
  }

  const handleDelete = (approval: Approval) => {
    deleteMutation.mutate(Number(approval.id), {
      onSuccess: () => {
        toast.success(`Approval record deleted`)
        setSelectedApproval(null)
      },
      onError: (err: any) => toast.error(err?.response?.data?.error || err?.message || 'Failed to delete'),
    })
    setOpenDropdown(null)
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setPage(1)
    setSearch('')
    setSelectedApproval(null)
  }

  const columns: Column<Approval>[] = [
    {
      key: 'contract_name',
      header: 'Contract',
      render: approval => (
        <div>
          <button onClick={() => handleView(approval)} className="font-medium text-left hover:text-primary transition-colors">
            {approval.contract_name}
          </button>
          <div className="text-sm text-muted-foreground">{approval.contract_number}</div>
        </div>
      ),
    },
    { key: 'company_name', header: 'Company' },
    {
      key: 'total_contract_value',
      header: 'Value',
      render: approval => <>{formatCurrency(approval.total_contract_value)}</>,
    },
    {
      key: 'submitted_at',
      header: 'Submitted',
      render: approval => <>{approval.submitted_at ? formatDate(approval.submitted_at) : 'N/A'}</>,
    },
    {
      key: 'status',
      header: 'Status',
      render: approval => <StatusBadge status={approval.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-20',
      render: approval => (
        <div className="relative">
          <button onClick={() => setOpenDropdown(openDropdown === approval.id ? null : approval.id)}
            className="p-1.5 hover:bg-accent rounded-lg transition-colors">
            <MoreVertical className="w-4 h-4" />
          </button>
          {openDropdown === approval.id && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
              <div className="absolute right-4 top-12 z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]">
                <button onClick={() => handleView(approval)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent text-left">
                  <Eye className="w-3.5 h-3.5" /> View
                </button>
                {approval.status === 'Pending' && (
                  <>
                    <button onClick={() => handleApprove(approval)}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent text-left text-green-600 dark:text-green-400">
                      <CheckCircle className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button onClick={() => handleRejectOpen(approval)}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent text-left text-red-600 dark:text-red-400">
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                    <button onClick={() => handleCancel(approval)}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent text-left text-amber-600 dark:text-amber-400">
                      <Ban className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </>
                )}
                {(approval.status === 'Cancelled' || approval.status === 'Rejected') && (
                  <button onClick={() => handleDelete(approval)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent text-left text-muted-foreground">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Manage contract approval workflows."
        breadcrumbs={[{ label: 'Approvals' }]}
      />

      <div
        className="flex flex-wrap items-center gap-3">
        <nav className="flex gap-1 bg-muted/50 p-1 rounded-lg">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex gap-6">
        <div
          className={`bg-card border border-border rounded-xl ${selectedApproval ? 'w-2/3' : 'w-full'}`}
        >
          {isLoading ? (
            <div className="p-6"><DataTable columns={columns} data={[]} keyExtractor={a => a.id} isLoading={true} /></div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <XCircle className="w-10 h-10 mb-4 text-destructive" />
              <p className="font-semibold text-foreground text-lg mb-1">Failed to load approvals</p>
              <p className="text-sm">{(error as any)?.message || 'An unexpected error occurred.'}</p>
            </div>
          ) : approvals.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title={activeTab ? `No ${activeTab} approvals` : 'No approvals found'}
              description={search ? 'Try a different search term.' : 'All contracts have been reviewed.'}
              action={!search ? { label: 'Browse Contracts', onClick: () => setActivePage('contracts') } : undefined}
            />
          ) : (
            <DataTable
              columns={columns}
              data={approvals}
              keyExtractor={a => a.id}
              searchQuery={search}
              onSearchChange={handleSearch}
              searchPlaceholder="Search by contract name, company..."
              totalPages={totalPages}
              totalItems={total}
              pageSize={15}
              currentPage={page}
              onPageChange={setPage}
            />
          )}
        </div>

        {selectedApproval && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-1/3 bg-card border border-border rounded-xl p-6 space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Approval Details</h2>
              <button onClick={() => setSelectedApproval(null)} className="p-1 hover:bg-accent rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium">{selectedApproval.contract_name}</div>
                <div className="text-xs text-muted-foreground">{selectedApproval.contract_number}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedApproval.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Company:</span>
                  <p className="font-medium">{selectedApproval.company_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Value:</span>
                  <p className="font-medium">{formatCurrency(selectedApproval.total_contract_value)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Contract Status:</span>
                  <p className="font-medium">{selectedApproval.contract_status}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Level:</span>
                  <p className="font-medium">{selectedApproval.approval_level || '1'}</p>
                </div>
              </div>

              {selectedApproval.comments && (
                <div>
                  <span className="text-sm text-muted-foreground">Comments:</span>
                  <p className="text-sm mt-1 p-3 bg-muted/30 rounded-lg">{selectedApproval.comments}</p>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Timeline
              </h3>
              <div className="space-y-3">
                {selectedApproval.submitted_at && (
                  <div className="flex gap-3 text-sm">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                      <div className="w-px flex-1 bg-border" />
                    </div>
                    <div>
                      <p className="font-medium">Submitted</p>
                      <p className="text-xs text-muted-foreground">{formatDate(selectedApproval.submitted_at)}</p>
                      {selectedApproval.requester_name && (
                        <p className="text-xs text-muted-foreground">by {selectedApproval.requester_name}</p>
                      )}
                    </div>
                  </div>
                )}
                {selectedApproval.approved_at && (
                  <div className="flex gap-3 text-sm">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                      <div className="w-px flex-1 bg-border" />
                    </div>
                    <div>
                      <p className="font-medium text-green-600 dark:text-green-400">Approved</p>
                      <p className="text-xs text-muted-foreground">{formatDate(selectedApproval.approved_at)}</p>
                      {selectedApproval.approver_name && (
                        <p className="text-xs text-muted-foreground">by {selectedApproval.approver_name}</p>
                      )}
                    </div>
                  </div>
                )}
                {selectedApproval.rejected_at && (
                  <div className="flex gap-3 text-sm">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                      <div className="w-px flex-1 bg-border" />
                    </div>
                    <div>
                      <p className="font-medium text-red-600 dark:text-red-400">Rejected</p>
                      <p className="text-xs text-muted-foreground">{formatDate(selectedApproval.rejected_at)}</p>
                      {selectedApproval.approver_name && (
                        <p className="text-xs text-muted-foreground">by {selectedApproval.approver_name}</p>
                      )}
                    </div>
                  </div>
                )}
                {selectedApproval.cancelled_at && (
                  <div className="flex gap-3 text-sm">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground mt-1.5" />
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Cancelled</p>
                      <p className="text-xs text-muted-foreground">{formatDate(selectedApproval.cancelled_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selectedApproval.status === 'Pending' && (
              <div className="flex gap-2 pt-2">
                <button onClick={() => handleApprove(selectedApproval)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-800/40">
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                <button onClick={() => handleRejectOpen(selectedApproval)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-800/40">
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button onClick={() => handleCancel(selectedApproval)}
                  className="flex items-center justify-center px-3 py-2 border border-input rounded-lg hover:bg-accent text-sm font-medium">
                  <Ban className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {rejectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-xl w-full max-w-md p-6">
              <h2 className="text-xl font-semibold mb-2">Reject Contract</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Reject "{rejectModal.contract_name}" ({rejectModal.contract_number})?
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Comments *</label>
                  <textarea value={rejectComments} onChange={(e) => setRejectComments(e.target.value)}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background" rows={3} placeholder="Reason for rejection..." />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setRejectModal(null)}
                    className="px-4 py-2 border border-input rounded-lg hover:bg-accent">Cancel</button>
                  <button onClick={handleRejectConfirm} disabled={!rejectComments.trim() || rejectMutation.isPending}
                    className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50">
                    {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
