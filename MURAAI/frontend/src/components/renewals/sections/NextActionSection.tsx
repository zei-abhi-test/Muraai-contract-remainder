import { AlertTriangle, Calendar, ChevronRight, Clock } from 'lucide-react'
import { Card, Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatDate, urgencyBorder } from '../_utils'
import type { RenewalWorkspaceData } from '../renewalWorkspaceMockData'

const urgencyIcon: Record<string, typeof AlertTriangle> = {
  high:   AlertTriangle,
  medium: Clock,
  low:    ChevronRight,
}

const urgencyBg: Record<string, string> = {
  high:   'bg-red-100 text-red-600 dark:bg-red-950/30',
  medium: 'bg-amber-100 text-amber-600 dark:bg-amber-950/30',
  low:    'bg-blue-100 text-blue-600 dark:bg-blue-950/30',
}

const urgencyLabel: Record<string, string> = {
  high:   'bg-red-100 text-red-600 dark:bg-red-950/30',
  medium: 'bg-amber-100 text-amber-600 dark:bg-amber-950/30',
  low:    'bg-blue-100 text-blue-600 dark:bg-blue-950/30',
}

export function NextActionSection({ data }: { data: RenewalWorkspaceData }) {
  const urgency = data.recommendedAction.urgency
  const UrgencyIcon = urgencyIcon[urgency] || ChevronRight

  return (
    <Card padding="lg" className={cn('border-l-4', urgencyBorder(urgency))} role="alert">
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div className={cn('p-3 rounded-full flex-shrink-0', urgencyBg[urgency])} aria-hidden="true">
          <UrgencyIcon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold">Next Recommended Action</h3>
            <span className={cn('text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full', urgencyLabel[urgency])}>
              {urgency} priority
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{data.recommendedAction.text}</p>
          <div className="flex items-center gap-4 mt-3">
            <Button variant="primary" size="sm">{data.recommendedAction.actionLabel}</Button>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              Due by {formatDate(data.recommendedAction.dueDate)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
