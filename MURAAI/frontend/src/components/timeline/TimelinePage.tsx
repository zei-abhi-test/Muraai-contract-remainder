import { useState, useCallback, useMemo } from 'react'
import { RefreshCw, Activity } from 'lucide-react'
import { Button } from '@/components/ui'
import { PageLayout } from '@/components/ui'
import { cn } from '@/lib/utils'
import { NarrativeTimeline } from './NarrativeTimeline'
import { useActivityList } from '@/hooks/useActivity'
import type { ActivityItem } from '@/api/activity'

interface NarrativeEvent {
  id: string; timestamp: string; actor: { name: string; role?: string }
  action: string; target: string; detail: string
  entityType: 'contract' | 'renewal' | 'invoice' | 'po' | 'document' | 'task' | 'approval' | 'comment' | 'system'
  entityLabel: string
}

function activityToEvent(item: ActivityItem): NarrativeEvent {
  const bo = item.activity_type.startsWith('contract') ? 'contract'
    : item.activity_type.startsWith('invoice') ? 'invoice'
    : item.activity_type.startsWith('po_') ? 'po'
    : item.activity_type.startsWith('approval') ? 'approval'
    : item.activity_type.startsWith('renewal') ? 'renewal'
    : item.activity_type.startsWith('document') ? 'document'
    : item.activity_type.startsWith('task') ? 'task'
    : item.activity_type.startsWith('comment') ? 'comment'
    : 'system'
  return {
    id: `a-${item.id}`, timestamp: item.created_at,
    actor: { name: `User ${item.user_id}` },
    action: item.activity_type.replace(/_/g, ' '),
    target: item.title, detail: item.description || '',
    entityType: bo as NarrativeEvent['entityType'],
    entityLabel: item.title,
  }
}

const ENTITY_TYPES = [
  { value: '', label: 'All Activity' },
  { value: 'renewal', label: 'Renewals' },
  { value: 'contract', label: 'Contracts' },
  { value: 'approval', label: 'Approvals' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'po', label: 'Purchase Orders' },
  { value: 'document', label: 'Documents' },
  { value: 'task', label: 'Tasks' },
  { value: 'comment', label: 'Comments' },
  { value: 'system', label: 'System' },
]

export function TimelinePage() {
  const { data: activities, refetch, isRefetching } = useActivityList({ limit: 50 })
  const events = useMemo(() => (activities || []).map(activityToEvent), [activities])
  const [filterType, setFilterType] = useState('')

  const filteredEvents = useMemo(() => {
    if (!filterType) return events
    return events.filter(e => e.entityType === filterType)
  }, [events, filterType])

  const liveIndicator = useMemo(() => {
    const recent = events.filter(e => Date.now() - new Date(e.timestamp).getTime() < 600000)
    return recent.length
  }, [events])

  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  return (
    <PageLayout
      title="Activity Timeline"
      description="Every event across your platform, told as a story"
      actions={
        <div className="flex items-center gap-2">
          {liveIndicator > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {liveIndicator} recent
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={handleRefresh} className="gap-1.5">
            <RefreshCw className={cn('w-3.5 h-3.5', isRefetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      }
    >
      <div className="max-w-3xl mx-auto">

        <div className="bg-card border border-border rounded-lg p-1 mb-4 flex items-center gap-1 overflow-x-auto">
          {ENTITY_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setFilterType(t.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
                filterType === t.value
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
              {' · live feed'}
            </span>
          </div>
          <NarrativeTimeline events={filteredEvents} />
        </div>
      </div>
    </PageLayout>
  )
}
