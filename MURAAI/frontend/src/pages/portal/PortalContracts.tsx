import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { FileText, Search, FileIcon, AlertCircle, RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { customerPortalApi } from '@/api/customerPortal'

export function PortalContracts() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['portal', 'contracts'],
    queryFn: customerPortalApi.getContracts,
  })
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const filtered = (data || []).filter(
    (c) =>
      c.contract_name.toLowerCase().includes(search.toLowerCase()) ||
      c.contract_number?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">My Contracts</h1>
        <p className="text-sm text-muted-foreground">View your contract details and status</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contracts..." aria-label="Search contracts"
          className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-12 text-destructive border border-destructive/20 bg-destructive/10 rounded-xl">
          <AlertCircle className="w-10 h-10 mb-3 opacity-80" aria-hidden="true" />
          <p className="font-medium text-sm">Failed to load contracts.</p>
          <button
            onClick={() => refetch()}
            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileIcon className="w-10 h-10 mb-3 opacity-50" aria-hidden="true" />
          <p className="font-medium text-sm">{search ? 'No contracts match your search.' : 'No contracts found.'}</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl divide-y divide-border">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/portal/contracts/${c.id}`)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/50 transition-colors"
              aria-label={`View contract: ${c.contract_name}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.contract_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.company_name}{c.contract_number ? ` · ${c.contract_number}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {c.total_contract_value.toLocaleString()} {c.currency}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  c.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  c.status === 'Expired' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  c.status === 'Draft' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
                  'bg-muted text-muted-foreground'
                }`}>{c.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}