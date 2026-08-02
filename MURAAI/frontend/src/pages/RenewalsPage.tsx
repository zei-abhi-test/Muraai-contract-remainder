import { useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Calendar, Clock, AlertTriangle, Loader2 } from 'lucide-react'
import { useDashboard } from '@/hooks/useDashboard'
import { useReport } from '@/hooks/useReports'
import { useRenewContract, useRenewalHistory } from '@/hooks/useContracts'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { contractSchema, type ContractFormData } from '@/lib/validations'
import { PageHeader, EmptyState } from '@/components/ui'
import { toast } from 'sonner'
import { useUIStore } from '@/store/uiStore'

export function RenewalsPage() {
  const setActivePage = useUIStore((state) => state.setActivePage)
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null)
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false)

  const { data: dashboardData, isLoading: dashboardLoading } = useDashboard()
  const { data: expiringContracts, isLoading: expiringLoading } = useReport('renewals')
  const { data: renewalHistory, isLoading: historyLoading } = useRenewalHistory(selectedContractId || 0)
  const renewContract = useRenewContract()

  const {
    register, handleSubmit, formState: { errors, isSubmitting }, reset,
  } = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema) as any,
    defaultValues: { start_date: '', end_date: '', renewal_date: '', status: 'Active', currency: 'INR' },
  })

  const upcomingRenewals = dashboardData?.upcoming_renewals || []
  const allExpiring = expiringContracts || []

  const handleRenew = (data: ContractFormData) => {
    if (selectedContractId) {
      renewContract.mutate({ contractId: selectedContractId, data }, {
        onSuccess: (newContract: any) => {
          setIsRenewModalOpen(false)
          reset()
          setSelectedContractId(newContract.id)
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.error || err?.message || 'Failed to renew contract')
        },
      })
    }
  }

  const handleRenewClick = (contractId: number) => {
    setSelectedContractId(contractId)
    setIsRenewModalOpen(true)
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const getDaysUntil = (dateString: string) => {
    const today = new Date()
    const targetDate = new Date(dateString)
    return Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  const getUrgencyColor = (days: number) => {
    if (days <= 7) return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30'
    if (days <= 30) return 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/30'
    return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950/30'
  }

  const isLoading = dashboardLoading || expiringLoading

  return (
    <div className="space-y-6">
      <PageHeader
        title="Renewals"
        description="Track and manage contract renewals."
        breadcrumbs={[{ label: 'Renewals' }]}
      />

      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Upcoming Renewals</h3>
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div className="text-3xl font-bold">{upcomingRenewals.length}</div>
          <p className="text-sm text-muted-foreground">Contracts due for renewal</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Expiring Soon</h3>
            <Clock className="w-5 h-5 text-orange-500" />
          </div>
          <div className="text-3xl font-bold">{allExpiring.length}</div>
          <p className="text-sm text-muted-foreground">Contracts expiring within 30 days</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Critical</h3>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-3xl font-bold">{dashboardData?.critical_count || 0}</div>
          <p className="text-sm text-muted-foreground">Contracts expiring within 7 days</p>
        </div>
      </div>

      <div
        className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Upcoming Renewals</h2>
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 animate-pulse bg-muted rounded-lg" />)}</div>
        ) : upcomingRenewals.length === 0 && allExpiring.length === 0 ? (
          <EmptyState
            icon={RefreshCw}
            title="No upcoming renewals"
            description="All contracts are up to date."
            action={{ label: 'View Contracts', onClick: () => setActivePage('contracts') }}
          />
        ) : (
          <div className="space-y-3">
            {[...upcomingRenewals, ...allExpiring].map((contract) => {
              const daysUntil = getDaysUntil(contract.end_date || '')
              return (
                <div key={contract.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg"><RefreshCw className="w-5 h-5 text-primary" /></div>
                    <div>
                      <div className="font-medium">{contract.contract_name}</div>
                      <div className="text-sm text-muted-foreground">{contract.company_name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${getUrgencyColor(daysUntil)}`}>
                      {daysUntil > 0 ? `${daysUntil} days` : 'Expired'}
                    </div>
                    <div className="text-sm text-muted-foreground">{contract.end_date ? formatDate(contract.end_date) : 'N/A'}</div>
                    <button onClick={() => handleRenewClick(contract.id)}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm">
                      Renew
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedContractId && (
        <div
          className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Renewal History</h2>
          {historyLoading ? (
            <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-16 animate-pulse bg-muted rounded-lg" />)}</div>
          ) : renewalHistory && renewalHistory.length > 0 ? (
            <div className="space-y-3">
              {renewalHistory.map((contract) => (
                <div key={contract.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <div className="font-medium">{contract.contract_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {contract.start_date ? formatDate(contract.start_date) : 'N/A'} - {contract.end_date ? formatDate(contract.end_date) : 'N/A'}
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${contract.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                    {contract.status}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No renewal history found</p>
          )}
        </div>
      )}

      {isRenewModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">Renew Contract</h2>
            <form onSubmit={(handleSubmit as any)(handleRenew)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Start Date *</label>
                <input {...register('start_date')} type="date" className="w-full px-4 py-2 border border-input rounded-lg bg-background" />
                {errors.start_date && <p className="text-sm text-destructive mt-1">{errors.start_date.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">End Date *</label>
                <input {...register('end_date')} type="date" className="w-full px-4 py-2 border border-input rounded-lg bg-background" />
                {errors.end_date && <p className="text-sm text-destructive mt-1">{errors.end_date.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Renewal Date</label>
                <input {...register('renewal_date')} type="date" className="w-full px-4 py-2 border border-input rounded-lg bg-background" />
                {errors.renewal_date && <p className="text-sm text-destructive mt-1">{errors.renewal_date.message}</p>}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => { setIsRenewModalOpen(false); reset(); setSelectedContractId(null) }}
                  className="px-4 py-2 border border-input rounded-lg hover:bg-accent">Cancel</button>
                <button type="submit" disabled={isSubmitting || renewContract.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2">
                  {(isSubmitting || renewContract.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting || renewContract.isPending ? 'Renewing...' : 'Renew Contract'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
