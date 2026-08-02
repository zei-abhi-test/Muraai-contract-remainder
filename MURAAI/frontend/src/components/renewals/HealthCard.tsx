import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RenewalHealthFactor } from './renewalWorkspaceMockData'

interface HealthCardProps {
  score: number
  level: string
  factors: RenewalHealthFactor[]
  className?: string
}

const levelColors: Record<string, string> = {
  excellent: 'text-green-500',
  good: 'text-blue-500',
  fair: 'text-amber-500',
  critical: 'text-red-500',
}

const levelBgs: Record<string, string> = {
  excellent: 'bg-green-500',
  good: 'bg-blue-500',
  fair: 'bg-amber-500',
  critical: 'bg-red-500',
}

const factorIcons: Record<string, typeof CheckCircle> = {
  healthy: CheckCircle,
  warning: AlertTriangle,
  critical: XCircle,
}

const factorColors: Record<string, string> = {
  healthy: 'text-green-500 bg-green-100 dark:bg-green-950/30',
  warning: 'text-amber-500 bg-amber-100 dark:bg-amber-950/30',
  critical: 'text-red-500 bg-red-100 dark:bg-red-950/30',
}

export function HealthCard({ score, level, factors, className }: HealthCardProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-3">
        <span className={cn('text-2xl font-bold', levelColors[level] || 'text-gray-500')}>{score}</span>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', levelBgs[level] || 'bg-gray-500')} style={{ width: `${score}%` }} />
        </div>
        <span className={cn('text-xs font-medium capitalize', levelColors[level] || 'text-gray-500')}>{level}</span>
      </div>
      <div className="space-y-1">
        {factors.map((f) => {
          const Icon = factorIcons[f.status]
          return (
            <div key={f.label} className="flex items-center gap-2 py-1.5">
              <div className={cn('p-0.5 rounded-full', factorColors[f.status])}>
                <Icon className="w-3 h-3" />
              </div>
              <span className="text-xs text-muted-foreground flex-1">{f.label}</span>
              <span className={cn('text-xs font-medium tabular-nums', f.score / f.max >= 0.8 ? 'text-green-500' : f.score / f.max >= 0.5 ? 'text-amber-500' : 'text-red-500')}>
                {f.score}/{f.max}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
