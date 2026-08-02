import { useState, useRef, useEffect } from 'react'
import { Plus, MoreVertical, Eye, Edit, Send, CheckCircle, XCircle, Pause, Play, RefreshCw, CheckSquare } from 'lucide-react'
import type { ElementType } from 'react'
import { ContractWizard } from '@/components/contracts/ContractWizard'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useContracts, useCreateContract, useUpdateContract } from '@/hooks/useContracts'
import { activityKeys } from '@/hooks/useActivity'
import { queryClient } from '@/lib/react-query'
import { queryKeys } from '@/lib/react-query'
import { toast } from 'sonner'
import { useUIStore } from '@/store/uiStore'
import type { Contract } from '@/api/contracts'
import { DataTable, type Column, Button, PageHeader, StatusBadge } from '@/components/ui'
import api from '@/api/axios'

const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  edit: 'Edit',
  submit: 'Submit for Approval',
  approve: 'Approve',
  reject: 'Reject',
  activate: 'Activate',
  hold: 'Put On Hold',
  resume: 'Resume',
  complete: 'Mark Completed',
  renew: 'Renew',
  expire: 'Mark Expired',
  mark_renewal_due: 'Mark Renewal Due',
  revert_to_draft: 'Revert to Draft',
}

const ACTION_ICONS: Record<string, ElementType> = {
  view: Eye, edit: Edit, submit: Send, approve: CheckCircle,
  reject: XCircle, activate: Play, hold: Pause, resume: Play,
  complete: CheckSquare, renew: RefreshCw, expire: XCircle,
  mark_renewal_due: RefreshCw, revert_to_draft: Edit,
}

interface ActionMenuProps {
  contractId: number
  allowedActions: string[]
  onClose: () => void
  onAction: (contractId: number, action: string) => void
}

function ActionMenu({ contractId, allowedActions, onClose, onAction }: ActionMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const actions = allowedActions.filter(a => a !== 'approve' && a !== 'reject')
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])
  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl z-50 py-1 min-w-[180px]">
      {actions.map((action) => {
        const Icon = ACTION_ICONS[action] || Eye
        return (
          <button key={action} onClick={() => { onAction(contractId, action); onClose() }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent transition-colors text-left">
            <Icon className="w-4 h-4" /> {ACTION_LABELS[action] || action}
          </button>
        )
      })}
    </div>
  )
}

export function ContractsPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [_selectedContractId, setSelectedContractId] = useState<number | null>(null)
  const [sortField, setSortField] = useState<string>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const pageSize = 15
  const setActivePage = useUIStore((state) => state.setActivePage)
  const pageParams = useUIStore((state) => state.pageParams)

  const { data: contracts = [], isLoading: contractsLoading, error: contractsError } = useContracts()
  const createContract = useCreateContract()
  const updateContract = useUpdateContract()

  useEffect(() => {
    if (pageParams.status) {
      setStatusFilter(pageParams.status)
    }
  }, [pageParams.status])

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = contract.contract_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contract.contract_number && contract.contract_number.toLowerCase().includes(searchQuery.toLowerCase()))
    if (statusFilter) {
      return matchesSearch && contract.status?.toLowerCase().replace(/\s+/g, '-') === statusFilter.toLowerCase().replace(/\s+/g, '-')
    }
    return matchesSearch
  }).sort((a, b) => {
    if (!sortField) return 0
    const aVal = a[sortField as keyof typeof a]
    const bVal = b[sortField as keyof typeof b]
    if (aVal == null) return 1
    if (bVal == null) return -1
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  })

  const totalPages = Math.ceil(filteredContracts.length / pageSize)
  const paginatedContracts = filteredContracts.slice((page - 1) * pageSize, page * pageSize)
  const handlePageChange = (newPage: number) => { setPage(newPage); setOpenMenuId(null) }
  useEffect(() => { setPage(1) }, [searchQuery, statusFilter])

  const handleContractSubmit = (contractData: any, contractId?: number) => {
    if (contractId) {
      return updateContract.mutateAsync({ id: contractId, data: contractData }).then(() => {
        setIsWizardOpen(false)
        setSelectedContractId(null)
      }).catch((err: any) => {
        throw err
      })
    }
    return createContract.mutateAsync(contractData).then(() => {
      setIsWizardOpen(false)
    }).catch((err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to create contract')
      throw err
    })
  }

  const handleAction = async (contractId: number, action: string) => {
    if (action === 'view') {
      setActivePage('contract-workspace', { contractId })
      return
    }
    if (action === 'edit') {
      setSelectedContractId(contractId)
      setIsWizardOpen(true)
      return
    }
    const actionEndpointMap: Record<string, string> = {
      submit: `contracts/${contractId}/submit`, activate: `contracts/${contractId}/activate`,
      hold: `contracts/${contractId}/hold`, resume: `contracts/${contractId}/resume`,
      complete: `contracts/${contractId}/complete`, renew: `contracts/${contractId}/renew`,
      expire: `contracts/${contractId}/expire`, mark_renewal_due: `contracts/${contractId}/mark-renewal-due`,
      revert_to_draft: `contracts/${contractId}/revert-to-draft`,
    }
    const endpoint = actionEndpointMap[action]
    if (!endpoint) return
    try {
      await api.post(`/${endpoint}`)
      toast.success(`${ACTION_LABELS[action]} successful`)
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() })
      queryClient.invalidateQueries({ queryKey: activityKeys.all })
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || `Failed to ${action}`)
    }
  }

  const columns: Column<Contract>[] = [
    {
      key: 'contract_name',
      header: 'Contract',
      sortable: true,
      render: c => (
        <div>
          <div className="font-medium">{c.contract_name}</div>
          {c.contract_number && <div className="text-sm text-muted-foreground">{c.contract_number}</div>}
        </div>
      ),
    },
    { key: 'company_name', header: 'Customer', sortable: true },
    { key: 'start_date', header: 'Start Date', sortable: true },
    { key: 'end_date', header: 'End Date', sortable: true },
    {
      key: 'total_contract_value',
      header: 'Value',
      sortable: true,
      render: c => <>${c.total_contract_value?.toLocaleString() || '0'}</>,
    },
    {
      key: 'status',
      header: 'Status',
      render: c => <StatusBadge status={c.status || 'Unknown'} dot />
    },
    {
      key: 'actions',
      header: 'Actions',
      render: c => (
        <div className="relative">
          <button onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
            className="p-2 hover:bg-accent rounded-lg" aria-label="Contract actions">
            <MoreVertical className="w-4 h-4" />
          </button>
          {openMenuId === c.id && (
            <ActionMenu contractId={c.id} allowedActions={c.allowed_actions || ['view']}
              onClose={() => setOpenMenuId(null)} onAction={handleAction} />
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracts"
        description="Manage all your contracts in one place."
        breadcrumbs={[{ label: 'Contracts' }]}
        action={
          <button onClick={() => { setIsWizardOpen(true); setSelectedContractId(null) }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium">
            <Plus className="w-4 h-4" /> New Contract
          </button>
        }
      />

      <div
        className="bg-card border border-border rounded-xl p-6">
        <DataTable
          columns={columns}
          data={paginatedContracts}
          keyExtractor={c => c.id}
          isLoading={contractsLoading}
          error={contractsError ? 'Failed to load contracts. Please try again.' : null}
          emptyMessage={searchQuery || statusFilter ? 'No contracts match your filters.' : 'No contracts yet'}
          emptyAction={!searchQuery && !statusFilter ? <Button onClick={() => { setIsWizardOpen(true); setSelectedContractId(null) }}><Plus className="w-4 h-4" /> New Contract</Button> : undefined}
          searchQuery={searchQuery}
          onSearchChange={v => { setSearchQuery(v); setPage(1) }}
          searchPlaceholder="Search contracts..."
          filters={
            <div className="flex items-center gap-2">
              {['active', 'draft', 'expired', 'pending approval'].map(s => (
                <button key={s} onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}>{s}</button>
              ))}
              {statusFilter && (
                <button onClick={() => setStatusFilter(null)}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20">
                  Clear
                </button>
              )}
            </div>
          }
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
          totalPages={totalPages}
          totalItems={filteredContracts.length}
          pageSize={pageSize}
          currentPage={page}
          onPageChange={handlePageChange}
          exportFn={async () => {
            try {
              const res = await api.get('/reports/export', { params: { type: 'contracts' }, responseType: 'blob' })
              const url = URL.createObjectURL(new Blob([res.data]))
              const a = document.createElement('a'); a.href = url; a.download = `contracts-export-${new Date().toISOString().split('T')[0]}.csv`; a.click()
              URL.revokeObjectURL(url)
              toast.success('Contracts exported')
            } catch {
              toast.error('Export failed. Try downloading from Reports.')
            }
          }}
        />
      </div>

      {isWizardOpen && (
        <ErrorBoundary>
          <ContractWizard isOpen={isWizardOpen} onClose={() => { setIsWizardOpen(false); setSelectedContractId(null) }} onSubmit={handleContractSubmit} editContractId={_selectedContractId || undefined} />
        </ErrorBoundary>
      )}
    </div>
  )
}
