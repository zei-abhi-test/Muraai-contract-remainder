import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatDate, invoiceStatusBadge } from '../_utils'
import type { RenewalWorkspaceData } from '../renewalWorkspaceMockData'

export function InvoicesSection({ data }: { data: RenewalWorkspaceData }) {
  return (
    <div className="space-y-2" role="list" aria-label="Renewal invoices">
      {data.invoices.map((inv) => (
        <Card key={inv.id} variant="interactive" padding="md" role="listitem">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium">{inv.number}</div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <span>Due: {formatDate(inv.dueDate)}</span>
                {inv.linkedPO && <span aria-hidden="true">&middot;</span>}
                {inv.linkedPO && <span>PO: {inv.linkedPO}</span>}
                {inv.paidDate && <span aria-hidden="true">&middot;</span>}
                {inv.paidDate && <span>Paid: {formatDate(inv.paidDate)}</span>}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-semibold">{data.currency} {(inv.amount / 1000).toFixed(0)}K</div>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', invoiceStatusBadge[inv.status] || '')}>
                {inv.status}
              </span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
