import { useCallback } from 'react'
import {
  RefreshCw, Clock, AlertTriangle, CheckCircle,
  Bell, ExternalLink, ChevronRight, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageLayout } from '@/components/ui'
import { useUIStore } from '@/store/uiStore'
import { useDashboard } from '@/hooks/useDashboard'
import { useActivityList } from '@/hooks/useActivity'
import { useMyPendingApprovals } from '@/hooks/useApprovals'
import type { DashboardData } from '@/api/contracts'
import type { ActivityItem } from '@/api/activity'
import type { Approval } from '@/api/approvals'

// ── Types ──
interface TodayMetric { value: string; label: string; detail: string; icon: LucideIcon; color: string; bg: string; accent: string }
interface CompactInboxItem { id: string; title: string; summary: string; type: string; priority: string; timestamp: string; actionable: boolean }
interface CompactActivityItem { id: string; actor: string; action: string; target: string; timestamp: string; type: string }
interface DeadlineItem { id: string; label: string; entity: string; days: number; type: string }
interface AIRecommendation { id: string; title: string; description: string; action: string; priority: 'high' | 'medium' | 'low'; page: string; params?: Record<string, any> }
interface MissionControlData { todayMetrics: TodayMetric[]; inboxItems: CompactInboxItem[]; recentActivity: CompactActivityItem[]; deadlines: DeadlineItem[]; aiRecommendations: AIRecommendation[] }

function fmt(d: string): string {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function buildMetrics(d: DashboardData) {
  return [
    { value: String(d.renewals_due || d.upcoming_renewals?.length || 0), label: 'Renewals Due', detail: `${d.upcoming_count || 0} need attention`, icon: RefreshCw, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20', accent: 'bg-red-500' },
    { value: String(d.pending_approvals || 0), label: 'Approval Required', detail: `${d.pending_approvals || 0} pending reviews`, icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/20', accent: 'bg-purple-500' },
    { value: String(d.ending_soon_count || 0), label: 'Expiring Soon', detail: `${d.ending_soon_count || 0} contracts expiring`, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/20', accent: 'bg-orange-500' },
    { value: String(d.overdue_invoices || 0), label: 'Overdue Invoices', detail: `₹${((d.outstanding_invoice_amount || 0) / 100000).toFixed(1)}L outstanding`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20', accent: 'bg-amber-500' },
  ]
}

function buildInbox(d: DashboardData, approvals: Approval[]): CompactInboxItem[] {
  const items: CompactInboxItem[] = []
  for (const a of approvals.slice(0, 2)) {
    items.push({ id: `a-${a.id}`, title: `Approval: ${a.contract_name || `#${a.contract_id}`}`, summary: `${a.company_name || ''} — ${a.status}`, type: 'approval', priority: 'urgent', timestamp: fmt(a.submitted_at), actionable: true })
  }
  for (const c of (d.upcoming_renewals || []).slice(0, 2)) {
    items.push({ id: `r-${c.id}`, title: `Renewal: ${c.contract_name}`, summary: `${c.company_name} — ${c.days_until_end ? `${c.days_until_end}d left` : 'Expiring'}`, type: 'renewal', priority: 'high', timestamp: fmt(c.end_date), actionable: true })
  }
  if (d.overdue_invoices && d.overdue_invoices > 0) {
    items.push({ id: 'overdue-summary', title: `${d.overdue_invoices} overdue invoices`, summary: `₹${((d.outstanding_invoice_amount || 0) / 100000).toFixed(1)}L outstanding`, type: 'invoice', priority: 'urgent', timestamp: 'Overdue', actionable: true })
  }
  return items.slice(0, 5)
}

function buildActivity(items: ActivityItem[]): CompactActivityItem[] {
  return items.map(a => {
    const parts = a.activity_type.split('_')
    return { id: String(a.id), actor: `User ${a.user_id}`, action: a.activity_type.replace(/_/g, ' '), target: a.title, timestamp: fmt(a.created_at), type: parts.length > 1 ? parts[parts.length - 1] : a.activity_type }
  })
}

function buildDeadlines(d: DashboardData): DeadlineItem[] {
  const items: DeadlineItem[] = []
  for (const c of (d.upcoming_renewals || [])) {
    items.push({ id: `r-${c.id}`, label: c.contract_name, entity: c.company_name, days: c.days_until_end ?? 999, type: 'renewal' })
  }
  for (const c of (d.ending_soon_contracts || [])) {
    if (!items.some(i => i.id === `r-${c.id}`)) {
      items.push({ id: `e-${c.id}`, label: c.contract_name, entity: c.company_name, days: c.days_until_end ?? 999, type: 'expiry' })
    }
  }
  return items.sort((a, b) => a.days - b.days).slice(0, 5)
}

function buildRecommendations(d: DashboardData): AIRecommendation[] {
  const recs: AIRecommendation[] = []
  if (d.renewals_due > 0) recs.push({ id: 'r1', title: `${d.renewals_due} renewals require attention`, description: `${d.upcoming_count || 0} contracts due for renewal`, action: 'Open Renewals', priority: 'high', page: 'renewals' })
  if (d.pending_approvals > 0) recs.push({ id: 'r2', title: `${d.pending_approvals} pending approval requests`, description: 'Review and process outstanding approvals', action: 'View Approvals', priority: 'high', page: 'approvals' })
  if ((d.overdue_invoices || 0) > 0) recs.push({ id: 'r3', title: `${d.overdue_invoices} overdue invoices`, description: `₹${((d.outstanding_invoice_amount || 0) / 100000).toFixed(1)}L outstanding`, action: 'View Invoices', priority: 'medium', page: 'invoices' })
  recs.push({ id: 'r4', title: 'Review contract portfolio', description: `${d.active_count || 0} active contracts`, action: 'View Contracts', priority: 'medium', page: 'contracts' })
  return recs
}

function useMissionControl() {
  const { data: dashboard, isLoading: dbLoading, error: dbError } = useDashboard()
  const { data: activities, isLoading: actLoading } = useActivityList({ per_page: 5 })
  const { data: approvals, isLoading: apprLoading } = useMyPendingApprovals()
  const isLoading = dbLoading || actLoading || apprLoading
  const error = dbError
  const data: MissionControlData | null = dashboard ? {
    todayMetrics: buildMetrics(dashboard),
    inboxItems: buildInbox(dashboard, approvals || []),
    recentActivity: buildActivity(activities?.items ?? []),
    deadlines: buildDeadlines(dashboard),
    aiRecommendations: buildRecommendations(dashboard),
  } : null
  return { data, isLoading, error }
}

const INBOX_PAGE_MAP: Record<string, string> = {
  approval: 'approvals',
  invoice: 'invoices',
  renewal: 'renewals',
  document: 'documents',
}

function TodayMetricCard({ metric, onNavigate }: { metric: MissionControlData['todayMetrics'][0]; onNavigate: (page: string) => void }) {
  const Icon = metric.icon
  const page = metric.label.includes('Renewal') ? 'renewals'
    : metric.label.includes('Approval') ? 'approvals'
    : metric.label.includes('Expiring') ? 'contracts'
    : 'invoices'

  return (
    <button
      onClick={() => onNavigate(page)}
      className={cn('rounded-lg border border-border p-4 text-left w-full transition-colors hover:border-primary/30', metric.bg)}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{metric.label}</span>
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', metric.bg)}>
          <Icon className={cn('w-4 h-4', metric.color)} />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn('text-2xl font-bold', metric.color)}>{metric.value}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed text-left">{metric.detail}</p>
    </button>
  )
}

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{children}</span>
      <div className="h-px flex-1 bg-border/40" />
      {count !== undefined && <span className="text-[10px] text-muted-foreground/50">{count} items</span>}
    </div>
  )
}

function InboxSummary({ items, onNavigate }: { items: MissionControlData['inboxItems']; onNavigate: (page: string) => void }) {
  return (
    <div className="bg-card border border-border rounded-lg divide-y divide-border/50 overflow-hidden">
      {items.map(item => {
        const page = INBOX_PAGE_MAP[item.type] || 'operational-inbox'
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(page)}
            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent/30 transition-colors group text-left"
          >
            <div className={cn(
              'w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0',
              item.priority === 'urgent' ? 'bg-red-500' : item.priority === 'high' ? 'bg-amber-500' : 'bg-muted-foreground/30',
            )} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded font-medium',
                  item.priority === 'urgent' ? 'bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400' :
                  item.priority === 'high' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' :
                  'bg-muted text-muted-foreground',
                )}>
                  {item.priority}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.summary}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] text-muted-foreground">{item.timestamp}</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
            </div>
          </button>
        )
      })}
    </div>
  )
}

function ActivityFeed({ items, onNavigate }: { items: MissionControlData['recentActivity']; onNavigate: (page: string) => void }) {
  const activityColors: Record<string, string> = {
    created: 'text-blue-500', approved: 'text-green-500', paid: 'text-emerald-500',
    updated: 'text-amber-500', uploaded: 'text-indigo-500', rejected: 'text-red-500',
  }

  return (
    <div className="bg-card border border-border rounded-lg divide-y divide-border/30 overflow-hidden">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onNavigate('activity-timeline')}
          className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors text-left"
        >
          <time className="text-[10px] font-mono text-muted-foreground/50 w-12 text-right flex-shrink-0 pt-1 select-none">
            {item.timestamp}
          </time>
          <span className={cn(
            'mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0',
            (activityColors[item.type] || 'text-muted-foreground/30').replace('text-', 'bg-'),
          )} />
          <div className="flex-1 min-w-0">
            <p className="text-xs leading-5">
              <span className="font-medium text-foreground">{item.actor}</span>
              <span className="text-muted-foreground"> </span>
              <span className="font-medium text-foreground">{item.action}</span>
              <span className="text-muted-foreground"> </span>
              <span className="text-foreground">{item.target}</span>
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}

function DeadlinesList({ items, onNavigate }: { items: MissionControlData['deadlines']; onNavigate: (page: string) => void }) {
  return (
    <div className="bg-card border border-border rounded-lg divide-y divide-border/50 overflow-hidden">
      {items.map(d => {
        const page = d.type === 'compliance' ? 'reports' : 'renewals'
        return (
          <button
            key={d.id}
            onClick={() => onNavigate(page)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors group text-left"
          >
            <div className={cn(
              'w-1.5 h-1.5 rounded-full flex-shrink-0',
              d.days <= 3 ? 'bg-red-500' : d.days <= 7 ? 'bg-amber-500' : 'bg-muted-foreground/30',
            )} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{d.label}</p>
              <p className="text-xs text-muted-foreground">{d.entity}</p>
            </div>
            <span className={cn(
              'text-xs font-semibold flex-shrink-0',
              d.days <= 3 ? 'text-red-500' : d.days <= 7 ? 'text-amber-500' : 'text-muted-foreground',
            )}>
              {d.days}d
            </span>
          </button>
        )
      })}
    </div>
  )
}

function AIRecommendations({ items, onNavigate }: { items: MissionControlData['aiRecommendations']; onNavigate: (page: string, params?: Record<string, any>) => void }) {
  return (
    <div className="bg-card border border-border rounded-lg divide-y divide-border/50 overflow-hidden">
      {items.map(r => (
        <div key={r.id} className="px-4 py-3 hover:bg-accent/30 transition-colors group">
          <div className="flex items-start gap-3">
            <div className={cn(
              'w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
              r.priority === 'high' ? 'bg-purple-100 text-purple-600 dark:bg-purple-950/30' : 'bg-muted text-muted-foreground',
            )}>
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{r.title}</p>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded font-medium',
                  r.priority === 'high' ? 'bg-purple-100 text-purple-600 dark:bg-purple-950/30' : 'bg-muted text-muted-foreground',
                )}>
                  {r.priority}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.description}</p>
              <button
                onClick={() => onNavigate(r.page, r.params)}
                className="text-xs text-primary font-medium mt-1.5 hover:underline inline-flex items-center gap-1"
              >
                {r.action}
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
      <div className="h-48 bg-muted rounded-lg animate-pulse" />
      <div className="h-32 bg-muted rounded-lg animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-40 bg-muted rounded-lg animate-pulse" />
        <div className="h-48 bg-muted rounded-lg animate-pulse" />
      </div>
    </div>
  )
}

function DashboardEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <RefreshCw className="w-8 h-8 opacity-40" />
      </div>
      <p className="text-lg font-medium text-foreground mb-1">Welcome to Mission Control</p>
      <p className="text-sm mb-6">Your workspace will populate as you add contracts and activities</p>
    </div>
  )
}

export function Dashboard() {
  const { data, isLoading, error } = useMissionControl()
  const { setActivePage } = useUIStore()

  const handleNavigate = useCallback((page: string, params?: Record<string, any>) => {
    setActivePage(page, params)
  }, [setActivePage])

  if (isLoading) return <PageLayout title="Mission Control"><DashboardSkeleton /></PageLayout>

  if (error) {
    return (
      <PageLayout title="Mission Control" error={(error as any)?.message || 'Failed to load dashboard'}>
        <DashboardEmpty />
      </PageLayout>
    )
  }

  if (!data || data.todayMetrics.length === 0) {
    return (
      <PageLayout title="Mission Control">
        <DashboardEmpty />
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Mission Control"
      description="Your command center"
    >
      <div className="max-w-4xl mx-auto space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">🔥</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Today</span>
            <div className="h-px flex-1 bg-border/40" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {data.todayMetrics.map(m => (
              <TodayMetricCard key={m.label} metric={m} onNavigate={handleNavigate} />
            ))}
          </div>
        </div>

        <SectionLabel count={data.inboxItems.length}>My Work</SectionLabel>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold tracking-wide text-foreground flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-muted-foreground" />
              Operational Inbox
            </h3>
            <button onClick={() => handleNavigate('operational-inbox')} className="text-[11px] text-primary hover:underline">View all</button>
          </div>
          {data.inboxItems.length > 0 ? (
            <InboxSummary items={data.inboxItems} onNavigate={handleNavigate} />
          ) : (
            <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
              No pending items — you are all caught up
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold tracking-wide text-foreground flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
              Recent Activity
            </h3>
            <button onClick={() => handleNavigate('activity-timeline')} className="text-[11px] text-primary hover:underline">View all</button>
          </div>
          {data.recentActivity.length > 0 ? (
            <ActivityFeed items={data.recentActivity} onNavigate={handleNavigate} />
          ) : (
            <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
              No recent activity
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-foreground mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              Upcoming Deadlines
            </h3>
            {data.deadlines.length > 0 ? (
              <DeadlinesList items={data.deadlines} onNavigate={handleNavigate} />
            ) : (
              <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
                No upcoming deadlines
              </div>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-foreground mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
              AI Recommendations
            </h3>
            {data.aiRecommendations.length > 0 ? (
              <AIRecommendations items={data.aiRecommendations} onNavigate={handleNavigate} />
            ) : (
              <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
                No recommendations yet
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
