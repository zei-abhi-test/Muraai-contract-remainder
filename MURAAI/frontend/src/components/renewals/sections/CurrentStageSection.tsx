import { Zap, Target, Clock, Users, CheckCircle } from 'lucide-react'
import { Card, Button, StatusBadge, SectionHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatDate, daysUntil } from '../_utils'
import type { RenewalWorkspaceData } from '../renewalWorkspaceMockData'

export function CurrentStageSection({ data }: { data: RenewalWorkspaceData }) {
  const activeStage = data.stages.find(s => s.status === 'active')
  const daysDeadline = daysUntil(data.endDate)

  return (
    <div className="space-y-6">
      <Card padding="lg" variant="elevated" className="border-l-4 border-l-blue-500">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
              <Target className="w-3.5 h-3.5" aria-hidden="true" />
              <span id="current-stage-label">Current Stage</span>
            </div>
            <h2 className="text-xl font-bold" aria-labelledby="current-stage-label">
              {activeStage?.label || data.currentStage}
            </h2>
            {activeStage?.description && (
              <p className="text-sm text-muted-foreground mt-1">{activeStage.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              {activeStage?.assignee && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" aria-hidden="true" />
                  {activeStage.assignee}
                </span>
              )}
              {activeStage?.date && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  Started {formatDate(activeStage.date)}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={data.status.replace(/_/g, ' ')} dot />
            <div className="text-sm text-muted-foreground" aria-label={`Stage ${data.stages.filter(s => s.status === 'completed').length + 1} of ${data.stages.length}`}>
              Stage {data.stages.filter(s => s.status === 'completed').length + 1} of {data.stages.length}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Progress" size="sm" />
        <div className="flex items-center gap-3 mt-3" role="progressbar" aria-valuenow={data.progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label={`Renewal progress: ${data.progressPercent}%`}>
          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${data.progressPercent}%` }} />
          </div>
          <span className="text-sm font-medium text-muted-foreground">{data.progressPercent}%</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
          <StatBox label="Days Elapsed" value={daysUntil(data.startDate) > 0 ? `${Math.abs(daysUntil(data.startDate))}` : '\u2014'} />
          <StatBox label="Days to Deadline" value={daysDeadline > 0 ? `${daysDeadline} days` : 'Overdue'} />
          <StatBox label="Approvals Pending" value={String(data.approvals.filter(a => a.status === 'pending').length)} />
          <StatBox label="Tasks Open" value={String(data.tasks.filter(t => t.status !== 'completed').length)} />
        </div>
      </Card>

      <Card padding="md" className="border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20" role="alert">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex-shrink-0" aria-hidden="true">
            <Zap className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Recommended Next Action</p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">{data.recommendedAction.text}</p>
          </div>
          <Button size="sm" variant="primary" className="flex-shrink-0">
            {data.recommendedAction.actionLabel}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted/30">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  )
}
