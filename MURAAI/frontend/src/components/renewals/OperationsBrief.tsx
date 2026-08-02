import { useMemo } from 'react'
import {
  Sparkles, Circle, Clock, Shield, AlertTriangle,
  FileText, Ban, ArrowRight, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { daysUntil } from './_utils'
import type { RenewalWorkspaceData } from './renewalWorkspaceMockData'

interface OperationsBriefProps {
  data: RenewalWorkspaceData
  className?: string
}

interface BriefItem {
  icon: typeof Circle
  color: string
  text: string
}

export function OperationsBrief({ data, className }: OperationsBriefProps) {
  const items = useMemo((): BriefItem[] => {
    const result: BriefItem[] = []
    const daysToExpiry = daysUntil(data.endDate)
    const activeStage = data.stages.find(s => s.status === 'active')
    const blockedStage = data.stages.find(s => s.status === 'blocked')
    const slaPercent = Math.round((data.slaDaysRemaining / data.slaTotalDays) * 100)
    const pendingApprovals = data.approvals.filter(a => a.status === 'pending')
    const missingDocs = data.documents.filter(d => d.status === 'missing' || d.status === 'expired')
    const highRisks = data.risks.filter(r => r.severity === 'high' || r.severity === 'critical')
    const overdueTasks = data.tasks.filter(t => t.status !== 'completed' && daysUntil(t.dueDate) < 0)
    const completedStages = data.stages.filter(s => s.status === 'completed').length

    result.push({
      icon: Circle,
      color: daysToExpiry <= 7 ? 'text-red-500' : daysToExpiry <= 30 ? 'text-amber-500' : 'text-green-500',
      text: `${data.status.replace(/_/g, ' ')} · ${activeStage?.label || data.currentStage} · ${daysToExpiry < 0 ? `${Math.abs(daysToExpiry)}d overdue` : `${daysToExpiry}d until expiry`}`,
    })

    result.push({
      icon: Clock,
      color: slaPercent > 50 ? 'text-green-500' : slaPercent > 25 ? 'text-amber-500' : 'text-red-500',
      text: `SLA ${slaPercent}% remaining (${data.slaDaysRemaining}d of ${data.slaTotalDays}d) — ${slaPercent > 50 ? 'On track' : slaPercent > 25 ? 'Warning' : 'Critical'}`,
    })

    if (data.risks.length > 0) {
      const topRisk = highRisks.length > 0 ? highRisks[0] : data.risks[0]
      result.push({
        icon: AlertTriangle,
        color: highRisks.length > 0 ? 'text-orange-500' : 'text-amber-500',
        text: `${data.risks.length} risk${data.risks.length > 1 ? 's' : ''} (${highRisks.length} high)${highRisks.length > 0 ? ` · ${topRisk.message.slice(0, 80)}` : ''}`,
      })
    }

    if (missingDocs.length > 0) {
      const names = missingDocs.map(d => d.fileName.split('.')[0]).join(', ')
      result.push({
        icon: FileText,
        color: 'text-red-500',
        text: `${missingDocs.length} document${missingDocs.length > 1 ? 's' : ''} missing · ${names}`,
      })
    }

    if (pendingApprovals.length > 0) {
      const names = pendingApprovals.map(a => a.approver).join(', ')
      result.push({
        icon: Ban,
        color: 'text-amber-500',
        text: `${pendingApprovals.length} approval${pendingApprovals.length > 1 ? 's' : ''} pending · ${names}`,
      })
    }

    if (blockedStage) {
      result.push({
        icon: Shield,
        color: 'text-red-500',
        text: `Blocker: ${blockedStage.label}${blockedStage.assignee ? ` — ${blockedStage.assignee}` : ''}`,
      })
    } else if (activeStage && overdueTasks.length > 0) {
      result.push({
        icon: Shield,
        color: 'text-amber-500',
        text: `Attention needed: ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} in ${activeStage.label} stage`,
      })
    } else if (activeStage) {
      result.push({
        icon: Shield,
        color: 'text-blue-500',
        text: `Current focus: ${activeStage.label}${activeStage.assignee ? ` · ${activeStage.assignee}` : ''}`,
      })
    }

    result.push({
      icon: ArrowRight,
      color: 'text-primary',
      text: `${data.recommendedAction.actionLabel} — ${data.recommendedAction.text.slice(0, 100)}`,
    })

    const totalStages = data.stages.length
    const estLabel = daysToExpiry > 0
      ? `Est. completion in ${daysToExpiry}d`
      : 'Past expiry date'
    result.push({
      icon: BarChart3,
      color: 'text-muted-foreground',
      text: `${estLabel} · ${data.progressPercent}% progress · ${completedStages} of ${totalStages} stages complete`,
    })

    return result
  }, [data])

  return (
    <div className={cn(
      'rounded-lg border border-border/80 bg-gradient-to-r from-blue-50/40 to-transparent dark:from-blue-950/10',
      'p-4 space-y-2.5',
      className,
    )} role="status" aria-label="Operations brief">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Operations Brief</span>
        </div>
        <span className="text-[10px] text-muted-foreground">Generated just now</span>
      </div>
      <div className="space-y-1.5">
        {items.slice(0, 8).map((item, idx) => {
          const Icon = item.icon
          return (
            <div key={idx} className="flex items-start gap-2.5">
              <Icon className={cn('w-3.5 h-3.5 mt-0.5 flex-shrink-0', item.color)} />
              <span className="text-xs leading-relaxed text-foreground/90">{item.text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
