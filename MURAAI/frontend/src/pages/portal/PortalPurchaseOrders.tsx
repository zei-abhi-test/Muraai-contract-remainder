import { useQuery } from '@tanstack/react-query'
import { ShoppingCart, ClipboardList } from 'lucide-react'

import { customerPortalApi } from '@/api/customerPortal'

export function PortalPurchaseOrders() {
  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'purchase-orders'],
    queryFn: customerPortalApi.getPurchaseOrders,
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Purchase Orders</h1>
        <p className="text-sm text-muted-foreground">View your purchase orders</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ClipboardList className="w-10 h-10 mb-3 opacity-50" aria-hidden="true" />
          <p className="font-medium text-sm">No purchase orders found.</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl divide-y divide-border">
          {data.map((po) => (
            <div key={po.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <ShoppingCart className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{po.po_number}</p>
                  <p className="text-xs text-muted-foreground truncate">{po.vendor}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold">{po.amount?.toLocaleString()}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  po.status === 'Issued' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                  po.status === 'Received' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  po.status === 'Cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-muted text-muted-foreground'
                }`}>{po.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}