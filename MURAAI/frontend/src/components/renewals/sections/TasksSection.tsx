import { Calendar, CheckCircle, Users, Plus } from 'lucide-react'
import { Card, Button, StatusBadge } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatDate, priorityBadge } from '../_utils'
import type { RenewalWorkspaceData } from '../renewalWorkspaceMockData'

export function TasksSection({ data }: { data: RenewalWorkspaceData }) {
  const sorted = [...data.tasks].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return (order[a.priority] || 99) - (order[b.priority] || 99)
  })

  return (
    <div className="space-y-2" role="list" aria-label="Renewal tasks">
      {sorted.map((t) => (
        <Card key={t.id} variant="interactive" padding="md" role="listitem">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors',
                t.status === 'completed'
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-muted-foreground/40',
              )}
              aria-label={t.status === 'completed' ? 'Completed' : 'Not completed'}
              aria-hidden="true"
            >
              {t.status === 'completed' && <CheckCircle className="w-3.5 h-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-sm font-medium', t.status === 'completed' && 'line-through text-muted-foreground')}>
                  {t.title}
                </span>
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', priorityBadge[t.priority] || '')}>
                  {t.priority}
                </span>
                <StatusBadge status={t.status === 'in_progress' ? 'in progress' : t.status} size="sm" />
              </div>
              {t.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              )}
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" aria-hidden="true" />
                  {t.assignee}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" aria-hidden="true" />
                  Due {formatDate(t.dueDate)}
                </span>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted">{t.category}</span>
              </div>
            </div>
          </div>
        </Card>
      ))}
      <Button variant="ghost" className="w-full" icon={<Plus className="w-4 h-4" />}>
        Add Task
      </Button>
    </div>
  )
}
