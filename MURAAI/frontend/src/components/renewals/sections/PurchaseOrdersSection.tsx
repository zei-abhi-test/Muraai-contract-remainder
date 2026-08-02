import { DollarSign, Building2, Download, Plus } from 'lucide-react'
import { Card, Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatDate, poStatusBadge } from '../_utils'
import type { RenewalWorkspaceData } from '../renewalWorkspaceMockData'

export function PurchaseOrdersSection({ data }: { data: RenewalWorkspaceData }) {
  return (
    <div className="space-y-3" role="list" aria-label="Purchase orders">
      {data.purchaseOrders.map((po) => (
        <Card key={po.id} variant="interactive" padding="md" role="listitem">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{po.number}</span>
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', poStatusBadge[po.status] || '')}>
                  {po.status}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3" aria-hidden="true" />
                  {data.currency} {(po.amount / 1000).toFixed(0)}K
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" aria-hidden="true" />
                  {po.department}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {po.issuedDate && <span>Issued: {formatDate(po.issuedDate)}</span>}
                {po.expiryDate && <span>Expires: {formatDate(po.expiryDate)}</span>}
              </div>
            </div>
            <Button variant="ghost" size="sm" icon={<Download className="w-4 h-4" />} aria-label={`Download PO ${po.number}`} />
          </div>
        </Card>
      ))}
      <Button variant="ghost" className="w-full" icon={<Plus className="w-4 h-4" />}>
        Add Purchase Order
      </Button>
    </div>
  )
}
