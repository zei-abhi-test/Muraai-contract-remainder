import { Calendar, Users } from 'lucide-react'
import { Card, SectionHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatDate, getStageStyle } from '../_utils'
import type { RenewalWorkspaceData } from '../renewalWorkspaceMockData'

export function TimelineSection({ data }: { data: RenewalWorkspaceData }) {
  return (
    <Card>
      <SectionHeader title="Renewal Stages" size="sm" />
      <ol className="mt-4 space-y-1" role="list" aria-label="Renewal stage progression">
        {data.stages.map((stage, i) => {
          const s = getStageStyle(stage.status)
          const StageIcon = s.icon
          return (
            <li key={stage.id} className="flex items-stretch gap-4">
              <div className="flex flex-col items-center pt-3" aria-hidden="true">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                  s.color, s.bg,
                  s.ring && 'ring-2 ring-blue-400/40',
                )}>
                  <StageIcon className="w-4 h-4" />
                </div>
                {i < data.stages.length - 1 && (
                  <div className={cn('w-0.5 flex-1 min-h-[1rem] transition-colors', stage.status === 'completed' ? 'bg-green-300 dark:bg-green-700' : 'bg-border')} />
                )}
              </div>
              <div
                className={cn('flex-1 pb-6 pt-2', stage.status === 'active' && 'bg-blue-50/50 dark:bg-blue-950/10 -mx-3 px-3 rounded-lg')}
                aria-current={stage.status === 'active' ? 'step' : undefined}
              >
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-medium', stage.status === 'active' ? 'text-blue-600 dark:text-blue-400' : stage.status === 'completed' ? 'text-foreground' : 'text-muted-foreground')}>
                    {stage.label}
                  </span>
                  <span className={cn('text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded-full', s.color, s.bg)}>
                    {s.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{stage.description}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground" aria-label={`Stage details`}>
                  {stage.assignee && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" aria-hidden="true" />
                      {stage.assignee}
                    </span>
                  )}
                  {stage.date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" aria-hidden="true" />
                      {formatDate(stage.date)}
                    </span>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
