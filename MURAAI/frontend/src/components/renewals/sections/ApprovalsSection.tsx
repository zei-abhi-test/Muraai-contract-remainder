import { CheckCircle, Clock, XCircle } from 'lucide-react'
import { Card, StatusBadge } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatDate } from '../_utils'
import type { RenewalWorkspaceData } from '../renewalWorkspaceMockData'

const statusIcon: Record<string, { icon: typeof CheckCircle; bg: string }> = {
  approved: { icon: CheckCircle, bg: 'bg-green-100 text-green-600 dark:bg-green-950/30' },
  rejected: { icon: XCircle,     bg: 'bg-red-100 text-red-600 dark:bg-red-950/30' },
  pending:  { icon: Clock,       bg: 'bg-amber-100 text-amber-600 dark:bg-amber-950/30' },
}

export function ApprovalsSection({ data }: { data: RenewalWorkspaceData }) {
  return (
    <div className="space-y-3" role="list" aria-label="Approval chain">
      {data.approvals.map((a) => {
        const s = statusIcon[a.status] || statusIcon.pending
        const Icon = s.icon
        return (
          <Card key={a.id} variant="interactive" padding="md" role="listitem">
            <div className="flex items-start gap-4">
              <div className={cn('p-2 rounded-lg flex-shrink-0', s.bg)} aria-hidden="true">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{a.approver}</span>
                  <StatusBadge status={a.status} size="sm" />
                </div>
                <div className="text-xs text-muted-foreground">{a.role}</div>
                {a.comments && (
                  <p className="text-sm text-muted-foreground mt-1 italic">
                    &ldquo;{a.comments}&rdquo;
                  </p>
                )}
                {a.timestamp && (
                  <div className="text-xs text-muted-foreground mt-1">{formatDate(a.timestamp)}</div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">Step {a.step}</div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
