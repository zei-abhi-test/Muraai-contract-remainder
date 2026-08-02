import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { FileText, FileSpreadsheet, AlertTriangle, TrendingUp, FileIcon } from 'lucide-react'

import { customerPortalApi } from '@/api/customerPortal'
import { useCustomerAuthStore } from '@/store/customerAuthStore'

function StatCardSkeleton() {
  return <div className="h-24 bg-muted animate-pulse rounded-xl" />
}

export function PortalDashboard() {
  const { customer } = useCustomerAuthStore()
  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'dashboard'],
    queryFn: customerPortalApi.getDashboard,
  })
  const navigate = useNavigate()

  const cards = [
    { label: 'Total Contracts', value: data?.total_contracts ?? 0, icon: FileText, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Active', value: data?.active_contracts ?? 0, icon: TrendingUp, color: 'text-green-600 dark:text-green-400' },
    { label: 'Expiring Soon', value: data?.expiring_soon ?? 0, icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400' },
    { label: 'Expired', value: data?.expired_contracts ?? 0, icon: FileSpreadsheet, color: 'text-red-600 dark:text-red-400' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Welcome, {customer?.name}</h1>
        <p className="text-sm text-muted-foreground">Customer Portal Dashboard</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <div key={card.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{card.label}</span>
                  <Icon className={`w-4 h-4 ${card.color}`} aria-hidden="true" />
                </div>
                <p className="text-2xl font-bold">{card.value}</p>
              </div>
            )
          })}
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-3">Recent Contracts</h2>
        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : data?.recent_contracts && data.recent_contracts.length > 0 ? (
          <div className="border border-border rounded-xl divide-y divide-border">
            {data.recent_contracts.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/portal/contracts/${c.id}`)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/50 transition-colors"
                aria-label={`View contract: ${c.contract_name}`}
              >
                <div>
                  <p className="text-sm font-medium">{c.contract_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Ends: {c.end_date ? new Date(c.end_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  c.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  c.status === 'Expired' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-muted text-muted-foreground'
                }`}>{c.status}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileIcon className="w-10 h-10 mb-3 opacity-50" aria-hidden="true" />
            <p className="font-medium text-sm">No contracts found</p>
          </div>
        )}
      </div>
    </div>
  )
}
