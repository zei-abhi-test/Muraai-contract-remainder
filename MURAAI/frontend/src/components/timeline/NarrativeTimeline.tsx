import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { NarrativeEvent } from './timelineMockData'

interface NarrativeTimelineProps {
  events: NarrativeEvent[]
  className?: string
  isLoading?: boolean
  compact?: boolean
}

function TimeGroup({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{label}</span>
      <div className="h-px flex-1 bg-border/40" />
    </div>
  )
}

function NarrativeCard({ event, compact }: { event: NarrativeEvent; compact?: boolean }) {
  const isLive = Date.now() - new Date(event.timestamp).getTime() < 300000

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative flex items-start gap-4 py-3 group',
        'border-b border-border/30 last:border-0',
      )}
    >
      {isLive && (
        <span className="absolute -left-1 top-3 w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0 mt-1" />
      )}
      <time className={cn(
        'text-[11px] font-mono font-medium text-muted-foreground/60 flex-shrink-0 w-14 text-right leading-5 select-none',
        compact && 'w-12 text-[10px]',
      )}>
        {new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
      </time>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-5', compact && 'text-xs')}>
          <span className="font-medium text-foreground">{event.actor.name}</span>
          <span className="text-muted-foreground"> </span>
          <span className="font-medium text-foreground">{event.action}</span>
          <span className="text-muted-foreground"> </span>
          <span className="text-foreground">{event.target}</span>
        </p>
        <p className={cn(
          'text-xs text-muted-foreground/70 mt-0.5 leading-relaxed max-w-prose',
          compact && 'text-[11px]',
        )}>
          {event.detail}
        </p>
        <span className="text-[10px] text-muted-foreground/40 mt-1 inline-block">{event.entityLabel}</span>
      </div>
    </motion.div>
  )
}

function TimelineSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-0">
      <div className="flex items-center gap-3 py-3">
        <div className="h-3 w-16 bg-muted rounded animate-pulse" />
        <div className="h-px flex-1 bg-border/40" />
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 py-3 border-b border-border/30">
          <div className="h-3 w-14 bg-muted rounded animate-pulse mt-1" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-muted/60 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

function TimelineEmpty({ compact }: { compact?: boolean }) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 text-muted-foreground',
      compact && 'py-8',
    )}>
      <div className={cn(
        'w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3',
        compact && 'w-8 h-8',
      )}>
        <svg className={cn('w-6 h-6', compact && 'w-4 h-4')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className={cn('text-sm font-medium', compact && 'text-xs')}>No activity yet</p>
      <p className={cn('text-xs mt-1', compact && 'text-[11px]')}>Events will appear here as they happen across the platform</p>
    </div>
  )
}

type GroupKey = 'today' | 'yesterday' | 'this_week' | 'earlier'

function groupKey(timestamp: string): GroupKey {
  const now = new Date()
  const d = new Date(timestamp)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  if (d >= today) return 'today'
  if (d >= yesterday) return 'yesterday'
  if (d >= weekAgo) return 'this_week'
  return 'earlier'
}

const groupLabels: Record<GroupKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  earlier: 'Earlier',
}

export function NarrativeTimeline({ events, className, isLoading, compact }: NarrativeTimelineProps) {
  const grouped = useMemo(() => {
    const groups: Record<GroupKey, NarrativeEvent[]> = { today: [], yesterday: [], this_week: [], earlier: [] }
    const sorted = [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    sorted.forEach(e => { groups[groupKey(e.timestamp)].push(e) })
    return Object.entries(groupLabels).map(([key, label]) => ({ key: key as GroupKey, label, items: groups[key as GroupKey] }))
  }, [events])

  if (isLoading) return <TimelineSkeleton />

  const hasEvents = grouped.some(g => g.items.length > 0)
  if (!hasEvents) return <TimelineEmpty compact={compact} />

  return (
    <div className={cn('space-y-1', className)}>
      {grouped.map(group => {
        if (group.items.length === 0) return null
        return (
          <div key={group.key}>
            <TimeGroup label={group.label} />
            <div className="pl-0">
              {group.items.map(event => (
                <NarrativeCard key={event.id} event={event} compact={compact} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
