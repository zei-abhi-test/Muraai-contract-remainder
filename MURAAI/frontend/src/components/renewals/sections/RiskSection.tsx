import { AlertTriangle, Shield } from 'lucide-react'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import { riskBorder } from '../_utils'
import type { RenewalWorkspaceData } from '../renewalWorkspaceMockData'

const riskColor: Record<string, string> = {
  critical: 'text-red-500',
  high:     'text-orange-500',
  medium:   'text-amber-500',
  low:      'text-blue-500',
}

export function RiskSection({ data }: { data: RenewalWorkspaceData }) {
  return (
    <div className="space-y-3" role="list" aria-label="Risk indicators">
      {data.risks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Shield className="w-10 h-10 mb-2 opacity-50" aria-hidden="true" />
          <p className="text-sm">No risks identified</p>
        </div>
      ) : (
        data.risks.map((r, i) => (
          <Card key={i} padding="md" className={cn('border-l-4', riskBorder(r.severity))} role="listitem">
            <div className="flex items-start gap-3">
              <AlertTriangle className={cn('w-4 h-4 mt-0.5 flex-shrink-0', riskColor[r.severity] || '')} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{r.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] uppercase tracking-wider opacity-60">{r.severity}</span>
                  <span className="text-xs text-muted-foreground" aria-hidden="true">&middot;</span>
                  <span className="text-xs text-muted-foreground">{r.category}</span>
                </div>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
