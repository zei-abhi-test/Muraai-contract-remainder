import { motion } from 'framer-motion'
import {
  Heart, CheckCircle, XCircle, AlertTriangle,
  Shield, FileText, Package, DollarSign, Calendar,
  ArrowUp, ArrowDown, ChevronRight, Scale, ArrowRight,
  AlertOctagon,
} from 'lucide-react'
import { useContractAssistance } from '@/hooks/useContracts'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import type { HealthFactor, RiskIndicator, VersionComparison } from '@/api/contracts'

function scoreColor(level: string): string {
  const map: Record<string, string> = {
    excellent: 'text-green-500', good: 'text-blue-500',
    fair: 'text-amber-500', poor: 'text-orange-500', critical: 'text-red-500',
  }
  return map[level] || 'text-muted-foreground'
}

function scoreBg(level: string): string {
  const map: Record<string, string> = {
    excellent: 'bg-green-500', good: 'bg-blue-500',
    fair: 'bg-amber-500', poor: 'bg-orange-500', critical: 'bg-red-500',
  }
  return map[level] || 'bg-muted'
}

function factorIcon(status: string) {
  if (status === 'healthy' || status === 'good') return CheckCircle
  if (status === 'warning') return AlertTriangle
  if (status === 'critical') return AlertOctagon
  return Info
}

function factorColor(status: string): string {
  if (status === 'healthy' || status === 'good') return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
  if (status === 'warning') return 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30'
  if (status === 'critical') return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
  return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800/50'
}

function severityColor(severity: string): string {
  const map: Record<string, string> = {
    critical: 'border-red-500 bg-red-50 text-red-700 dark:border-red-400 dark:bg-red-950/30 dark:text-red-400',
    high: 'border-orange-400 bg-orange-50 text-orange-700 dark:border-orange-400 dark:bg-orange-950/30 dark:text-orange-400',
    medium: 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-950/30 dark:text-amber-400',
    low: 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-400',
  }
  return map[severity] || 'border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-400'
}

function HealthScoreCard({ score, level, factors }: { score: number; level: string; factors: HealthFactor[] }) {
  return (
    <div className="p-5 border border-border rounded-xl">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-500" /> Health Score
        </h3>
        <div className="flex items-center gap-2">
          <div className={cn('text-2xl font-bold', scoreColor(level))}>{score}</div>
          <span className={cn('text-xs font-medium capitalize', scoreColor(level))}>/100 {level}</span>
        </div>
      </div>
      <div className="w-full h-2.5 bg-muted rounded-full mb-5 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', scoreBg(level))}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="space-y-2.5">
        {factors.map((f, i) => {
          const Icon = factorIcon(f.status)
          return (
            <motion.div
              key={`${f.label}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn('p-1 rounded-full', factorColor(f.status))}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="text-xs text-muted-foreground">{f.detail}</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <div className={cn('text-sm font-bold', scoreColor(
                  f.score >= f.max ? 'excellent' : f.score >= f.max * 0.6 ? 'good' : f.score >= f.max * 0.3 ? 'fair' : 'critical'
                ))}>
                  {f.score}/{f.max}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function ReadinessCard({ passed, total, ready, checks }: { passed: number; total: number; ready: boolean; checks: { label: string; passed: boolean; detail: string }[] }) {
  return (
    <div className="p-5 border border-border rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" /> Readiness Checklist
        </h3>
        <div className="flex items-center gap-2">
          <span className={cn('text-lg font-bold', ready ? 'text-green-500' : 'text-amber-500')}>{passed}/{total}</span>
          {ready ? (
            <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full dark:text-green-400 dark:bg-green-900/30">Ready</span>
          ) : (
            <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full dark:text-amber-400 dark:bg-amber-900/30">Incomplete</span>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {checks.map((c, i) => (
          <motion.div
            key={`${c.label}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
          >
            {c.passed ? (
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{c.label}</div>
              <div className="text-xs text-muted-foreground truncate">{c.detail}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function RisksCard({ risks }: { risks: RiskIndicator[] }) {
  if (!risks.length) return null
  return (
    <div className="p-5 border border-border rounded-xl">
      <h3 className="font-semibold flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-amber-500" /> Risk Indicators
      </h3>
      <div className="space-y-2">
        {risks.map((r, i) => (
          <motion.div
            key={`${r.type}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn('flex items-center gap-3 p-3 rounded-lg border', severityColor(r.severity))}
          >
            <div className="flex-shrink-0">
              {r.severity === 'critical' ? (
                <AlertOctagon className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{r.message}</div>
              <div className="text-xs opacity-75 capitalize">{r.severity} priority</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function DiffRow({ label, prev, curr, format }: { label: string; prev: any; curr: any; format?: (v: any) => string }) {
  const f = format || ((v: any) => String(v ?? '—'))
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className="w-28 text-sm text-muted-foreground flex-shrink-0">{label}</div>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-sm text-red-500 line-through truncate">{f(prev)}</span>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-sm text-green-600 dark:text-green-400 font-medium truncate">{f(curr)}</span>
      </div>
    </div>
  )
}

function VersionDiffSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="p-4 border border-border rounded-lg">
      <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-muted-foreground" /> {title}
      </h4>
      {children}
    </div>
  )
}

function VersionComparisonCard({ vc }: { vc: VersionComparison }) {
  return (
    <div className="p-5 border border-border rounded-xl">
      <div className="flex items-center gap-3 mb-5">
        <Scale className="w-5 h-5 text-indigo-500" />
        <div>
          <h3 className="font-semibold">Version Comparison</h3>
          <p className="text-xs text-muted-foreground">Comparing v{vc.previous_version} → v{vc.current_version}</p>
        </div>
      </div>
      <div className="space-y-3">
        {vc.dates && (
          <VersionDiffSection title="Dates" icon={Calendar}>
            {vc.dates.map(d => (
              <DiffRow key={d.field} label={d.field} prev={d.previous} curr={d.current} format={v => v ? new Date(v).toLocaleDateString() : '—'} />
            ))}
          </VersionDiffSection>
        )}
        {vc.prices && (
          <VersionDiffSection title="Prices" icon={DollarSign}>
            {vc.prices.map(p => (
              <DiffRow key={p.field} label={p.field} prev={p.previous} curr={p.current} format={v => `$${Number(v).toLocaleString()}`} />
            ))}
          </VersionDiffSection>
        )}
        {vc.payment_terms && (
          <VersionDiffSection title="Payment Terms" icon={FileText}>
            {vc.payment_terms.map(p => (
              <DiffRow key={p.field} label={p.field} prev={p.previous} curr={p.current} />
            ))}
          </VersionDiffSection>
        )}
        {vc.line_items && (
          <VersionDiffSection title="Products" icon={Package}>
            {vc.line_items.added.length > 0 && (
              <div className="mb-2">
                <span className="text-xs font-medium text-green-600 dark:text-green-400">Added ({vc.line_items.added.length}):</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {vc.line_items.added.map(i => (
                    <span key={i.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <ArrowUp className="w-3 h-3" /> {i.product_name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {vc.line_items.removed.length > 0 && (
              <div className="mb-2">
                <span className="text-xs font-medium text-red-600 dark:text-red-400">Removed ({vc.line_items.removed.length}):</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {vc.line_items.removed.map(i => (
                    <span key={i.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      <ArrowDown className="w-3 h-3" /> {i.product_name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {vc.line_items.changed.length > 0 && (
              <div>
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Changed ({vc.line_items.changed.length}):</span>
                <div className="space-y-2 mt-1">
                  {vc.line_items.changed.map(c => (
                    <div key={c.current.id} className="p-2 rounded bg-muted/30 text-xs">
                      <div className="font-medium mb-1">{c.product_name}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {c.previous.rate !== c.current.rate && (
                          <div>Rate: ${Number(c.previous.rate).toFixed(2)} → ${Number(c.current.rate).toFixed(2)}</div>
                        )}
                        {c.previous.quantity !== c.current.quantity && (
                          <div>Qty: {c.previous.quantity} → {c.current.quantity}</div>
                        )}
                        {c.previous.discount !== c.current.discount && (
                          <div>Discount: {c.previous.discount}% → {c.current.discount}%</div>
                        )}
                        {c.previous.tax !== c.current.tax && (
                          <div>Tax: {c.previous.tax}% → {c.current.tax}%</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </VersionDiffSection>
        )}
        {!vc.dates && !vc.prices && !vc.payment_terms && !vc.line_items && (
          <p className="text-sm text-muted-foreground text-center py-4">No differences between versions</p>
        )}
      </div>
    </div>
  )
}

export function AssistanceTab({ contractId }: { contractId: number }) {
  const { data, isLoading } = useContractAssistance(contractId)

  if (isLoading) return <CardSkeleton count={4} />

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Heart className="w-12 h-12 mb-3 opacity-40" />
        <p className="font-semibold text-lg">Unable to load assistance data</p>
        <p className="text-sm">Try again later.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HealthScoreCard score={data.health_score.score} level={data.health_score.level} factors={data.health_score.factors} />
        <div className="space-y-6">
          <ReadinessCard
            passed={data.readiness.passed}
            total={data.readiness.total}
            ready={data.readiness.ready}
            checks={data.readiness.checks}
          />
          {data.risks.length > 0 && <RisksCard risks={data.risks} />}
        </div>
      </div>

      {data.version_comparison && (
        <VersionComparisonCard vc={data.version_comparison} />
      )}
    </div>
  )
}
