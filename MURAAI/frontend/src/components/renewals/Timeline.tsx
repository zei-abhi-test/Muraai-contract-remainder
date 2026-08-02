import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getActivityStyle, formatDate } from './_utils'
import type { RenewalActivity } from './renewalWorkspaceMockData'

interface TimelineProps {
  activities: RenewalActivity[]
  className?: string
}

function NarrativeCard({ event }: { event: RenewalActivity }) {
  const style = getActivityStyle(event.type)
  const Icon = style.icon

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0 group">
      <time className="text-[11px] font-mono font-medium text-muted-foreground/50 w-12 text-right flex-shrink-0 pt-0.5 select-none">
        {new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
      </time>
      <div className={cn('w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0', style.bg)}>
        <Icon className={cn('w-3 h-3', style.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-5">
          <span className="font-medium text-foreground">{event.user}</span>
          <span className="text-muted-foreground"> </span>
          <span className="text-foreground">{event.title}</span>
        </p>
        {event.description && (
          <p className="text-xs text-muted-foreground/70 mt-0.5 leading-relaxed">{event.description}</p>
        )}
      </div>
    </div>
  )
}

export function Timeline({ activities, className }: TimelineProps) {
  if (activities.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 text-muted-foreground', className)}>
        <Clock className="w-6 h-6 mb-2 opacity-50" />
        <p className="text-sm">No activity recorded yet</p>
        <p className="text-xs">Activity will appear here as the renewal progresses</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-0', className)}>
      {activities.map((event) => (
        <NarrativeCard key={event.id} event={event} />
      ))}
    </div>
  )
}
