import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RenewalRisk } from './renewalWorkspaceMockData'

interface RiskCardProps {
  risks: RenewalRisk[]
  score: number
  level: string
  className?: string
}

const severityBorders: Record<string, string> = {
  critical: 'border-l-red-500 bg-red-50/50 dark:bg-red-950/10',
  high: 'border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/10',
  medium: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/10',
  low: 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/10',
}

export function RiskCard({ risks, score, level, className }: RiskCardProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <AlertTriangle className={cn('w-4 h-4', level === 'critical' ? 'text-red-500' : level === 'high' ? 'text-orange-500' : 'text-amber-500')} />
        <span className="text-sm font-medium">{score}% Risk Score</span>
        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded-full font-medium capitalize',
          level === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' :
          level === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400' :
          level === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' :
          'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
        )}>{level}</span>
      </div>
      {risks.map((r, i) => (
        <div key={i} className={cn('border-l-2 pl-3 py-2 rounded-r', severityBorders[r.severity])}>
          <p className="text-xs text-foreground">{r.message}</p>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{r.category}</span>
        </div>
      ))}
      {risks.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">No active risks</p>
      )}
    </div>
  )
}
