import { useState, useMemo } from 'react'
import {
  ArrowLeft, RefreshCw, Target, Clock, Zap,
  AlertTriangle, ExternalLink, MoreHorizontal,
  UserPlus, User, Printer, Download,
} from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { Button, StatusBadge } from '@/components/ui'
import { Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatDate, daysUntil } from './_utils'
import type { RenewalWorkspaceData } from './renewalWorkspaceMockData'
import type { RenewalHealthFactor, RenewalRisk, RenewalPO, RenewalInvoice, RenewalApproval, RenewalActivity, RenewalDocument } from './renewalWorkspaceMockData'
import { useContract, useContractDocuments, useContractPurchaseOrders, useContractInvoices, useContractApprovals, useContractAssistance } from '@/hooks/useContracts'
import { useContractActivity } from '@/hooks/useActivity'
import type { Contract } from '@/api/contracts'
import type { ContractDocument } from '@/api/contracts'
import type { ContractAssistance } from '@/api/contracts'
import type { PurchaseOrder } from '@/api/purchaseOrders'
import type { Invoice } from '@/api/invoices'
import type { Approval } from '@/api/approvals'
import type { ActivityItem } from '@/api/activity'
import {
  SLAIndicator, HealthCard, RiskCard, SummaryCard, OwnerCard,
  StageProgress, Timeline, TaskPanel, DocumentGrid,
  ApprovalCard, CommunicationPanel, QuickActions, OperationsBrief,
} from './'
import { toast } from 'sonner'

function WorkspaceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr_300px] gap-6">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
      <div className="h-px flex-1 bg-border/50" />
      {children}
    </h3>
  )
}

function InfoRow({ label, value, href }: { label: string; value: string; href?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-medium text-right max-w-[55%] truncate', href && 'text-primary hover:underline cursor-pointer')}>
        {value}
        {href && <ExternalLink className="w-2.5 h-2.5 inline ml-0.5" />}
      </span>
    </div>
  )
}

function DeadlineRow({ label, date, type }: { label: string; date: string; type: string }) {
  const days = daysUntil(date)
  const isOverdue = days < 0
  const isToday = days === 0

  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className={cn(
        'w-1.5 h-1.5 rounded-full flex-shrink-0',
        isOverdue ? 'bg-red-500' : isToday ? 'bg-amber-500' : 'bg-muted-foreground/30',
      )} />
      <div className="flex-1 min-w-0">
        <p className="text-xs truncate">{label}</p>
        <p className="text-[10px] text-muted-foreground capitalize">{type}</p>
      </div>
      <span className={cn(
        'text-[10px] font-medium flex-shrink-0',
        isOverdue && 'text-red-500',
        isToday && 'text-amber-500',
      )}>
        {isOverdue ? `${Math.abs(days)}d overdue` : isToday ? 'Today' : `${days}d`}
      </span>
    </div>
  )
}

function NotificationRow({ message, type, read }: { message: string; type: string; read: boolean }) {
  return (
    <div className={cn('flex items-start gap-2 py-1.5', !read && 'font-medium')}>
      <div className={cn(
        'w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1',
        !read ? 'bg-primary' : 'bg-transparent',
      )} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs', !read && 'text-foreground')}>{message}</p>
        <p className="text-[10px] text-muted-foreground capitalize">{type}</p>
      </div>
    </div>
  )
}

function buildRenewalData(
  c: Contract, docs: ContractDocument[], pos: PurchaseOrder[],
  invs: Invoice[], approvs: Approval[], acts: ActivityItem[],
  ass: ContractAssistance | undefined,
): RenewalWorkspaceData {
  const hf: RenewalHealthFactor[] = (ass?.health_score?.factors || []).map(f => ({
    label: f.label,
    status: (f.status === 'good' ? 'healthy' : f.status === 'warning' ? 'warning' : f.status || 'warning') as RenewalHealthFactor['status'],
    detail: f.detail, score: f.score, max: f.max,
  }))
  const riskScore = (ass?.risks || []).reduce((s, r) => {
    if (r.severity === 'critical') return s + 40
    if (r.severity === 'high') return s + 30
    if (r.severity === 'medium') return s + 15
    return s + 5
  }, 0)
  const riskLevel: RenewalWorkspaceData['riskLevel'] = riskScore > 60 ? 'critical' : riskScore > 30 ? 'high' : riskScore > 15 ? 'medium' : 'low'
  const risks: RenewalRisk[] = (ass?.risks || []).map(r => ({
    severity: r.severity as RenewalRisk['severity'], message: r.message, category: r.type || 'General',
  }))
  const healthScore = ass?.health_score?.score || 72
  const healthLevel = ass?.health_score?.level || 'good'
  const purchaseOrders: RenewalPO[] = (pos || []).map(p => ({
    id: p.id, number: p.po_number || `PO-${p.id}`, amount: p.amount || 0,
    status: p.status, issuedDate: p.issue_date || '', expiryDate: p.expected_delivery || '', department: '',
  }))
  const invoices: RenewalInvoice[] = (invs || []).map(i => ({
    id: i.id, number: i.invoice_number || `INV-${i.id}`, amount: i.total || i.amount || 0,
    status: i.status, dueDate: i.due_date || '', paidDate: i.paid_date || undefined,
  }))
  const approvals: RenewalApproval[] = (approvs || []).map(a => ({
    id: a.id, step: a.approval_level || 1, approver: a.approver_name || 'Unknown',
    role: 'Approver', status: a.status as RenewalApproval['status'],
    comments: a.comments || '', timestamp: a.submitted_at,
  }))
  const activity: RenewalActivity[] = (acts || []).map(a => ({
    id: a.id, type: a.activity_type, title: a.title, description: a.description || '',
    timestamp: a.created_at, user: `User ${a.user_id}`,
  }))
  const documents: RenewalDocument[] = (docs || []).map(d => ({
    id: d.id, fileName: d.file_name, type: d.content_type || 'Unknown',
    uploadedBy: `User ${d.uploaded_by_id || 0}`, uploadedAt: d.uploaded_at,
    size: '—', status: 'uploaded' as const,
  }))
  return {
    id: c.id, contractId: c.id, name: `${c.contract_name} — Renewal`,
    renewalNumber: `RNW-${c.id}`, status: c.status, priority: 'medium' as const,
    contractName: c.contract_name, contractNumber: c.contract_number || '',
    companyName: c.company_name, totalValue: c.total_contract_value,
    currency: c.currency || 'INR', startDate: c.start_date, endDate: c.end_date,
    renewalDate: c.renewal_date, createdAt: c.created_at, lastUpdated: c.updated_at,
    owner: { name: `User ${c.user_id}`, email: '', role: '' }, department: '',
    customer: { name: '', email: '', company: c.company_name },
    vendor: { name: '', email: '', company: '' }, currentStage: '',
    slaDaysRemaining: 45, slaTotalDays: 90,
    riskScore, riskLevel, stages: [], approvalRequired: approvals.length > 0,
    approvals, tasks: [], vendorCommunications: [], customerCommunications: [],
    documents, purchaseOrders, invoices, activity,
    healthScore, healthLevel, healthFactors: hf, risks,
    notifications: [], upcomingDeadlines: [],
    recommendedAction: { text: '', urgency: 'medium', actionLabel: '', dueDate: '' },
    progressPercent: 50,
  }
}

export function RenewalWorkspace() {
  const { setActivePage, pageParams } = useUIStore()
  const [error, setError] = useState<string | null>(null)

  const renewalId = pageParams.renewalId as number | undefined

  const { data: contract, isLoading: cLoading } = useContract(renewalId!)
  const { data: documents } = useContractDocuments(renewalId!)
  const { data: purchaseOrders } = useContractPurchaseOrders(renewalId!)
  const { data: invoices } = useContractInvoices(renewalId!)
  const { data: approvals } = useContractApprovals(renewalId!)
  const { data: activities } = useContractActivity(renewalId!)
  const { data: assistance } = useContractAssistance(renewalId!)

  const isLoading = cLoading
  const data: RenewalWorkspaceData | undefined = useMemo(() => {
    if (!contract) return undefined
    return buildRenewalData(contract, documents || [], purchaseOrders || [],
      invoices || [], approvals || [], activities || [], assistance)
  }, [contract, documents, purchaseOrders, invoices, approvals, activities, assistance])

  const activeStage = useMemo(() => data?.stages.find(s => s.status === 'active'), [data])

  if (isLoading) {
    return <WorkspaceSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <AlertTriangle className="w-16 h-16 mb-4 text-destructive opacity-60" />
        <p className="text-lg font-medium text-foreground mb-1">Failed to load renewal</p>
        <p className="text-sm mb-6">{error}</p>
        <Button onClick={() => setActivePage('renewals')} variant="outline" size="sm">Back to Renewals</Button>
      </div>
    )
  }

  if (!renewalId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="w-16 h-16 mb-4 opacity-40" />
        <p className="text-lg font-medium text-foreground mb-1">No renewal selected</p>
        <p className="text-sm mb-6">Select a renewal from the list to view its workspace</p>
        <Button onClick={() => setActivePage('renewals')} variant="link">Go to Renewals</Button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <AlertTriangle className="w-16 h-16 mb-4 text-destructive opacity-60" />
        <p className="text-lg font-medium text-foreground mb-1">Renewal data not found</p>
        <p className="text-sm mb-6">The requested renewal workspace could not be loaded</p>
        <Button onClick={() => setActivePage('renewals')} variant="outline" size="sm">Back to Renewals</Button>
      </div>
    )
  }

  const summaryItems = [
    { label: 'Renewal ID', value: data.renewalNumber },
    { label: 'Created', value: formatDate(data.createdAt) },
    { label: 'Renewal Date', value: formatDate(data.renewalDate) },
    { label: 'Last Updated', value: formatDate(data.lastUpdated) },
    { label: 'Total Value', value: `${data.currency} ${data.totalValue.toLocaleString()}` },
    { label: 'Department', value: data.department },
  ]

  return (
    <div className="max-w-[1440px] mx-auto">
      <header className="mb-6">
        <nav className="mb-3">
          <Button onClick={() => setActivePage('renewals')} variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Back to Renewals
          </Button>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight">{data.name}</h1>
              <StatusBadge status={data.status.replace(/_/g, ' ')} dot />
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                data.priority === 'critical' && 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
                data.priority === 'high' && 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
                data.priority === 'medium' && 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
                data.priority === 'low' && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
              )}>{data.priority}</span>
              {activeStage && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  {activeStage.label}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {data.companyName} · {data.owner.name} · {data.department}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Contract: {data.contractName} ({data.contractNumber})
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => toast.info('Assign dialog')}>
              <UserPlus className="w-3.5 h-3.5" />Assign
            </Button>
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => toast.info('Change owner dialog')}>
              <User className="w-3.5 h-3.5" />Owner
            </Button>
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => toast.success('Export started')}>
              <Download className="w-3.5 h-3.5" />Export
            </Button>
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" />Print
            </Button>
            <Button variant="ghost" size="sm" onClick={() => toast.info('More actions')}>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <OperationsBrief data={data} className="mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] xl:grid-cols-[250px_1fr_300px] gap-6 items-start">
        {/* LEFT SIDEBAR */}
        <aside className="space-y-5 lg:sticky lg:top-24" aria-label="Renewal summary">
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Summary</p>
            <div className="divide-y divide-border/50">
              {summaryItems.map(item => (
                <InfoRow key={item.label} {...item} />
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <SLAIndicator daysRemaining={data.slaDaysRemaining} totalDays={data.slaTotalDays} />
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <SummaryCard items={[
              { label: 'Contract', value: data.contractName, onClick: () => setActivePage('contract-workspace', { contractId: data.contractId }) },
              { label: 'Customer', value: data.customer.company, onClick: () => setActivePage('customers') },
              { label: 'Vendor', value: data.vendor.company, onClick: () => setActivePage('purchase-orders') },
            ]} />
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <OwnerCard name={data.owner.name} email={data.owner.email} role={data.owner.role} />
          </div>
        </aside>

        {/* CENTER WORKSPACE */}
        <main className="space-y-6 min-w-0" aria-label="Renewal workspace content">
          {/* 1. Current Stage */}
          <section aria-label="Current stage">
            <div className="bg-card border border-border rounded-lg p-4">
              <SectionTitle>Current Stage</SectionTitle>
              <StageProgress stages={data.stages} progressPercent={data.progressPercent} />
            </div>
          </section>

          {/* 2. Recommended Next Action (CTA) */}
          <section aria-label="Recommended next action">
            <div className={cn(
              'rounded-lg border p-4',
              data.recommendedAction.urgency === 'high'
                ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'
                : 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20',
            )} role="alert">
              <div className="flex items-start gap-3">
                <div className={cn(
                  'p-1.5 rounded-full flex-shrink-0',
                  data.recommendedAction.urgency === 'high'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
                )}>
                  {data.recommendedAction.urgency === 'high' ? <AlertTriangle className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Recommended Next Action</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{data.recommendedAction.text}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <Button size="sm" variant="primary">{data.recommendedAction.actionLabel}</Button>
                    {data.recommendedAction.dueDate && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Due {formatDate(data.recommendedAction.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Timeline */}
          <section aria-label="Activity timeline">
            <div className="bg-card border border-border rounded-lg p-4">
              <SectionTitle>Timeline</SectionTitle>
              <Timeline activities={data.activity.slice(0, 8)} />
            </div>
          </section>

          {/* 4. Tasks */}
          <section aria-label="Tasks">
            <div className="bg-card border border-border rounded-lg p-4">
              <SectionTitle>Tasks</SectionTitle>
              <TaskPanel tasks={data.tasks} />
            </div>
          </section>

          {/* 5. Documents */}
          <section aria-label="Documents">
            <div className="bg-card border border-border rounded-lg p-4">
              <SectionTitle>Documents</SectionTitle>
              <DocumentGrid documents={data.documents} />
            </div>
          </section>

          {/* 6. Communications */}
          <section aria-label="Communications">
            <div className="bg-card border border-border rounded-lg p-4">
              <SectionTitle>Communications</SectionTitle>
              <CommunicationPanel vendorComms={data.vendorCommunications} customerComms={data.customerCommunications} />
            </div>
          </section>
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className="space-y-5 xl:sticky xl:top-24" aria-label="Renewal insights">
          {/* Health Summary */}
          <div className="bg-card border border-border rounded-lg p-4">
            <SectionTitle>Health</SectionTitle>
            <HealthCard score={data.healthScore} level={data.healthLevel} factors={data.healthFactors.slice(0, 3)} />
          </div>

          {/* Risk Indicators */}
          <div className="bg-card border border-border rounded-lg p-4">
            <SectionTitle>Risks</SectionTitle>
            <RiskCard risks={data.risks} score={data.riskScore} level={data.riskLevel} />
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-card border border-border rounded-lg p-4">
            <SectionTitle>Deadlines</SectionTitle>
            <div className="divide-y divide-border/50">
              {data.upcomingDeadlines.map(d => (
                <DeadlineRow key={d.id} label={d.label} date={d.date} type={d.type} />
              ))}
            </div>
            {data.upcomingDeadlines.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">No upcoming deadlines</p>
            )}
          </div>

          {/* Approvals */}
          <div className="bg-card border border-border rounded-lg p-4">
            <SectionTitle>Approvals</SectionTitle>
            <ApprovalCard approvals={data.approvals.filter(a => a.status === 'pending')} />
          </div>

          {/* Related Purchase Orders */}
          <div className="bg-card border border-border rounded-lg p-4">
            <SectionTitle>Purchase Orders</SectionTitle>
            <div className="space-y-1.5">
              {data.purchaseOrders.map(po => (
                <div key={po.id} className="flex items-center justify-between py-1">
                  <span className="text-xs font-medium text-primary hover:underline cursor-pointer" onClick={() => setActivePage("purchase-orders", { id: String(po.id) })}>{po.number}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{po.amount.toLocaleString()}</span>
                    <StatusBadge status={po.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
            {data.purchaseOrders.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">No purchase orders</p>
            )}
          </div>

          {/* Related Invoices */}
          <div className="bg-card border border-border rounded-lg p-4">
            <SectionTitle>Invoices</SectionTitle>
            <div className="space-y-1.5">
              {data.invoices.slice(0, 3).map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-1">
                  <span className="text-xs font-medium text-primary hover:underline cursor-pointer" onClick={() => setActivePage("invoices", { id: String(inv.id) })}>{inv.number}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{inv.amount.toLocaleString()}</span>
                    <StatusBadge status={inv.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
            {data.invoices.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">No invoices</p>
            )}
          </div>

          {/* Recent Notifications */}
          <div className="bg-card border border-border rounded-lg p-4">
            <SectionTitle>
              <span className="flex items-center gap-1">
                Notifications
                {data.notifications.filter(n => !n.read).length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </span>
            </SectionTitle>
            <div className="divide-y divide-border/50">
              {data.notifications.slice(0, 4).map(n => (
                <NotificationRow key={n.id} message={n.message} type={n.type} read={n.read} />
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-lg p-4">
            <SectionTitle>Quick Actions</SectionTitle>
            <QuickActions />
          </div>
        </aside>
      </div>
    </div>
  )
}