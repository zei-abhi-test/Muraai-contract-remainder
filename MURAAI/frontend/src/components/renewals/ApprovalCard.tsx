import { CheckCircle, Clock, XCircle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from './_utils'
import type { RenewalApproval } from './renewalWorkspaceMockData'

interface ApprovalCardProps {
  approvals: RenewalApproval[]
  className?: string
}

const statusIcons: Record<string, typeof CheckCircle> = {
  approved: CheckCircle,
  pending: Clock,
  rejected: XCircle,
}

const statusColors: Record<string, string> = {
  approved: 'text-green-500 bg-green-100 dark:bg-green-950/30 border-green-200 dark:border-green-900',
  pending: 'text-amber-500 bg-amber-100 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900',
  rejected: 'text-red-500 bg-red-100 dark:bg-red-950/30 border-red-200 dark:border-red-900',
}

export function ApprovalCard({ approvals, className }: ApprovalCardProps) {
  if (approvals.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-6 text-muted-foreground', className)}>
        <CheckCircle className="w-6 h-6 mb-2 opacity-50" />
        <p className="text-sm">No approvals required</p>
        <p className="text-xs">This renewal does not require any approvals</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {approvals.map((a) => {
        const Icon = statusIcons[a.status]
        const styles = statusColors[a.status]
        const isPending = a.status === 'pending'

        return (
          <div key={a.id} className={cn('border rounded-lg p-3 transition-colors', isPending ? 'border-dashed border-amber-300 dark:border-amber-700' : styles)}>
            <div className="flex items-start gap-2.5">
              <div className={cn('p-1 rounded-full flex-shrink-0', isPending ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-500' : '')}>
                <Icon className={cn('w-4 h-4', isPending ? 'text-amber-500' : '')} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{a.approver}</p>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded font-medium capitalize',
                    a.status === 'approved' && 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400',
                    a.status === 'pending' && 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
                    a.status === 'rejected' && 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
                  )}>{a.status}</span>
                </div>
                <p className="text-xs text-muted-foreground">{a.role}</p>
                {a.comments && <p className="text-xs text-muted-foreground mt-1 italic">&ldquo;{a.comments}&rdquo;</p>}
                {a.timestamp && (
                  <p className="text-[10px] text-muted-foreground mt-1">{formatDate(a.timestamp)}</p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
