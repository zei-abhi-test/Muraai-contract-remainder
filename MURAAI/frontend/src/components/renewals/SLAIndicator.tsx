import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SLAIndicatorProps {
  daysRemaining: number
  totalDays: number
  className?: string
}

export function SLAIndicator({ daysRemaining, totalDays, className }: SLAIndicatorProps) {
  const percent = ((totalDays - daysRemaining) / totalDays) * 100
  const urgent = daysRemaining <= 15
  const warning = daysRemaining <= 30 && daysRemaining > 15

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          SLA Remaining
        </span>
        <span className={cn(
          'font-medium tabular-nums',
          urgent && 'text-red-500',
          warning && 'text-amber-500',
          !urgent && !warning && 'text-green-500',
        )}>
          {daysRemaining}d / {totalDays}d
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            urgent && 'bg-red-500',
            warning && 'bg-amber-500',
            !urgent && !warning && 'bg-green-500',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
