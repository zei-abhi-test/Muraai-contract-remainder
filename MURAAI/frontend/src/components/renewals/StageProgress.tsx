import { CheckCircle, Clock, Circle, XCircle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RenewalStage } from './renewalWorkspaceMockData'

interface StageProgressProps {
  stages: RenewalStage[]
  progressPercent: number
  className?: string
}

const stageIcons: Record<string, typeof CheckCircle> = {
  completed: CheckCircle,
  active: Clock,
  blocked: XCircle,
  pending: Circle,
}

const stageColors: Record<string, string> = {
  completed: 'text-green-500 border-green-500 bg-green-100 dark:bg-green-950/30',
  active: 'text-blue-500 border-blue-500 bg-blue-100 dark:bg-blue-950/30 ring-2 ring-blue-500/30',
  blocked: 'text-red-500 border-red-500 bg-red-100 dark:bg-red-950/30',
  pending: 'text-muted-foreground border-muted bg-muted/50',
}

const stageLineColors: Record<string, string> = {
  completed: 'bg-green-500',
  active: 'bg-blue-500',
  blocked: 'bg-red-500',
  pending: 'bg-muted',
}

export function StageProgress({ stages, progressPercent, className }: StageProgressProps) {
  const activeIdx = stages.findIndex(s => s.status === 'active')
  const currentStep = stages.filter(s => s.status === 'completed').length + 1

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Progress</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden w-32">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{progressPercent}%</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Stage</p>
          <p className="text-sm font-medium">{currentStep} of {stages.length}</p>
        </div>
      </div>

      <div className="relative">
        {stages.map((stage, idx) => {
          const Icon = stageIcons[stage.status]
          const isLast = idx === stages.length - 1
          const isActive = stage.status === 'active'
          const isCompleted = stage.status === 'completed'
          const isBlocked = stage.status === 'blocked'

          return (
            <div key={stage.id} className="flex gap-3 pb-4 last:pb-0 relative">
              {!isLast && (
                <div className={cn(
                  'absolute left-[11px] top-6 w-0.5 h-full -z-0',
                  stageLineColors[stage.status],
                  stage.status === 'pending' && 'bg-muted',
                )} />
              )}
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2',
                stageColors[stage.status],
              )}>
                <Icon className="w-3 h-3" />
              </div>
              <div className={cn('flex-1 min-w-0 pb-2', isActive && 'bg-accent/30 -mx-2 px-2 rounded-lg')}>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-sm font-medium',
                    isActive && 'text-primary',
                    isCompleted && 'text-muted-foreground',
                    isBlocked && 'text-red-500',
                  )}>{stage.label}</span>
                  {isActive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Current</span>}
                  {isBlocked && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400 font-medium">Blocked</span>}
                </div>
                {stage.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{stage.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                  {stage.assignee && <span>{stage.assignee}</span>}
                  {stage.date && <span>{new Date(stage.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
