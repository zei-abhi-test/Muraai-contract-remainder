import { Card, SectionHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import { healthScoreColor, healthScoreBg, healthFactorStyle } from '../_utils'
import type { RenewalWorkspaceData } from '../renewalWorkspaceMockData'

export function HealthSection({ data }: { data: RenewalWorkspaceData }) {
  const scoreColor = healthScoreColor(data.healthLevel)
  const scoreBg = healthScoreBg(data.healthLevel)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <SectionHeader title="Renewal Health Factors" size="sm" />
          <div className="flex items-center gap-3 mt-4 mb-5" role="progressbar" aria-valuenow={data.healthScore} aria-valuemin={0} aria-valuemax={100} aria-label={`Renewal health score: ${data.healthScore}%`}>
            <div className={cn('text-3xl font-bold', scoreColor)}>{data.healthScore}</div>
            <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', scoreBg)} style={{ width: `${data.healthScore}%` }} />
            </div>
            <span className={cn('text-sm font-medium capitalize', scoreColor)}>{data.healthLevel}</span>
          </div>
          <div className="space-y-2">
            {data.healthFactors.map((f) => {
              const s = healthFactorStyle(f.status)
              const Icon = s.icon
              return (
                <div key={f.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className={cn('p-1 rounded-full', s.bg)} aria-hidden="true">
                    <Icon className={cn('w-3.5 h-3.5', s.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{f.label}</div>
                    <div className="text-xs text-muted-foreground">{f.detail}</div>
                  </div>
                  <div className={cn('text-sm font-bold', f.score / f.max >= 0.8 ? 'text-green-500' : f.score / f.max >= 0.5 ? 'text-amber-500' : 'text-red-500')}>
                    {f.score}/{f.max}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Summary" size="sm" />
          <div className="space-y-3 mt-4">
            <SummaryRow label="Timeline" healthy={data.healthFactors[0]?.status === 'healthy'} onTrack="On Track" offTrack="Needs Attention" />
            <SummaryRow label="Customer" healthy={data.healthFactors[1]?.status === 'healthy'} onTrack="Engaged" offTrack="At Risk" />
            <SummaryRow
              label="Internal Approvals"
              healthy={data.healthFactors[2]?.status === 'healthy'}
              onTrack="Complete"
              offTrack={`${data.approvals.filter(a => a.status === 'pending').length} Pending`}
            />
            <SummaryRow label="Documents" healthy={data.documents.length > 0} onTrack={`Ready (${data.documents.length})`} offTrack="Incomplete" />
            <SummaryRow label="Competitive Risk" healthy={true} onTrack="Low" offTrack="High" />
          </div>
        </Card>
      </div>
    </div>
  )
}

function SummaryRow({ label, healthy, onTrack, offTrack }: { label: string; healthy: boolean; onTrack: string; offTrack: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium', healthy ? 'text-green-500' : 'text-amber-500')}>
        {healthy ? onTrack : offTrack}
      </span>
    </div>
  )
}
