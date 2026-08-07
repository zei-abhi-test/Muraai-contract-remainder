import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Activity, BarChart3, Building2, CheckCircle,
  Clock, DollarSign, Download, Edit3, FileText, Heart,
  Mail, MessageSquare, Phone, Plus, Printer, RefreshCw,
  Shield, ShoppingCart, TrendingUp, Upload, Users,
  XCircle, AlertTriangle, Calendar, FileSpreadsheet,
  ChevronRight, Circle, MoreHorizontal,
} from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { cn } from '@/lib/utils'
import { Avatar, Button, Card, CardHeader, SectionHeader, StatusBadge } from '@/components/ui'
import { Timeline, TimelineItem } from '@/components/ui'
import type { ContractWorkspaceData } from '@/components/operations/contractWorkspaceMockData'
import {
  useContract, useContractLineItems, useContractDocuments,
  useContractAssistance, useContractApprovals,
  useContractInvoices, useRenewalHistory,
} from '@/hooks/useContracts'
import { useContractActivity } from '@/hooks/useActivity'
import type { Contract } from '@/api/contracts'
import type { ContractLineItem } from '@/api/contracts'
import type { ContractDocument } from '@/api/contracts'
import type { ContractAssistance } from '@/api/contracts'
import type { Approval } from '@/api/approvals'
import type { Invoice } from '@/api/invoices'
import type { ActivityItem } from '@/api/activity'

const sections = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'health', label: 'Health', icon: Heart },
  { id: 'products', label: 'Products', icon: ShoppingCart },
  { id: 'renewals', label: 'Renewals', icon: RefreshCw },
  { id: 'timeline', label: 'Timeline', icon: Activity },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'communications', label: 'Communications', icon: MessageSquare },
  { id: 'financial', label: 'Financial Summary', icon: DollarSign },
  { id: 'approvals', label: 'Approvals', icon: CheckCircle },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'organizations', label: 'Related Organizations', icon: Building2 },
]

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function daysUntil(d: string): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

function getActivityIcon(type: string) {
  const icons: Record<string, any> = {
    contract_created: Plus, contract_updated: Edit3, contract_submitted: Upload,
    contract_approved: CheckCircle, contract_rejected: XCircle, contract_activated: Shield,
    invoice_paid: DollarSign, document_uploaded: FileText, renewal_due: RefreshCw,
  }
  return icons[type] || Circle
}

function getActivityColor(type: string): string {
  const colors: Record<string, string> = {
    contract_created: 'text-blue-500 bg-blue-100 dark:bg-blue-950/30',
    contract_updated: 'text-amber-500 bg-amber-100 dark:bg-amber-950/30',
    contract_submitted: 'text-purple-500 bg-purple-100 dark:bg-purple-950/30',
    contract_approved: 'text-green-500 bg-green-100 dark:bg-green-950/30',
    contract_rejected: 'text-red-500 bg-red-100 dark:bg-red-950/30',
    contract_activated: 'text-teal-500 bg-teal-100 dark:bg-teal-950/30',
    invoice_paid: 'text-green-500 bg-green-100 dark:bg-green-950/30',
    document_uploaded: 'text-blue-500 bg-blue-100 dark:bg-blue-950/30',
    renewal_due: 'text-indigo-500 bg-indigo-100 dark:bg-indigo-950/30',
  }
  return colors[type] || 'text-gray-500 bg-gray-100 dark:bg-gray-800'
}

const commIcons: Record<string, any> = { email: Mail, note: FileText, meeting: Users, call: Phone }
const commColors: Record<string, string> = {
  email: 'bg-blue-100 text-blue-600 dark:bg-blue-950/30', note: 'bg-amber-100 text-amber-600 dark:bg-amber-950/30',
  meeting: 'bg-green-100 text-green-600 dark:bg-green-950/30', call: 'bg-purple-100 text-purple-600 dark:bg-purple-950/30',
}

const statusColor = (s: string) => s === 'paid' || s === 'approved' ? 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-950/30'
  : s === 'pending' ? 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/30'
  : s === 'rejected' ? 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-950/30'
  : 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800'

function OverviewSection({ data }: { data: ContractWorkspaceData }) {
  const daysLeft = daysUntil(data.endDate)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-muted/30 border-none">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-medium">Total Value</span>
          </div>
          <div className="text-2xl font-bold">{data.currency} {(data.totalValue / 100000).toFixed(1)}L</div>
          <div className="text-xs text-muted-foreground mt-1">{data.paymentTerms}</div>
        </Card>
        <Card className="bg-muted/30 border-none">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-medium">End Date</span>
          </div>
          <div className="text-2xl font-bold">{formatDate(data.endDate)}</div>
          <div className="text-xs text-muted-foreground mt-1">{daysLeft} days remaining</div>
        </Card>
        <Card className="bg-muted/30 border-none">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <RefreshCw className="w-4 h-4" />
            <span className="text-xs font-medium">Renewal Date</span>
          </div>
          <div className="text-2xl font-bold">{formatDate(data.renewalDate)}</div>
          <div className="text-xs text-muted-foreground mt-1">{daysUntil(data.renewalDate)} days away</div>
        </Card>
        <Card className="bg-muted/30 border-none">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Building2 className="w-4 h-4" />
            <span className="text-xs font-medium">Customer</span>
          </div>
          <div className="text-lg font-bold truncate">{data.companyName}</div>
          <div className="text-xs text-muted-foreground mt-1">{data.department}</div>
        </Card>
      </div>

      <Card>
        <SectionHeader title="Description" size="sm" />
        <p className="text-sm text-muted-foreground leading-relaxed mt-3">{data.description}</p>
      </Card>

      <Card>
        <SectionHeader title="Recent Notes" size="sm" action={
          <Button variant="ghost" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>Add Note</Button>
        } />
        <div className="space-y-3 mt-3">
          {data.notes.map((note) => (
            <div key={note.id} className="flex gap-3 p-3 rounded-lg bg-muted/30">
              <Avatar size="sm" fallback={note.author.charAt(0)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{note.author}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(note.timestamp)}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{note.content}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Start: <strong className="text-foreground">{formatDate(data.startDate)}</strong></span>
          <ChevronRight className="w-3 h-3" />
          <span>End: <strong className="text-foreground">{formatDate(data.endDate)}</strong></span>
          <ChevronRight className="w-3 h-3" />
          <span>Renewal: <strong className="text-foreground">{formatDate(data.renewalDate)}</strong></span>
        </div>
      </div>
    </div>
  )
}

function HealthSection({ data }: { data: ContractWorkspaceData }) {
  const scoreColor = data.healthLevel === 'excellent' ? 'text-green-500'
    : data.healthLevel === 'good' ? 'text-blue-500'
    : data.healthLevel === 'fair' ? 'text-amber-500'
    : 'text-red-500'
  const scoreBg = data.healthLevel === 'excellent' ? 'bg-green-500'
    : data.healthLevel === 'good' ? 'bg-blue-500'
    : data.healthLevel === 'fair' ? 'bg-amber-500'
    : 'bg-red-500'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <SectionHeader title="Health Factors" size="sm" />
          <div className="flex items-center gap-3 mt-4 mb-5">
            <div className={cn('text-3xl font-bold', scoreColor)}>{data.healthScore}</div>
            <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', scoreBg)} style={{ width: `${data.healthScore}%` }} />
            </div>
            <span className={cn('text-sm font-medium capitalize', scoreColor)}>{data.healthLevel}</span>
          </div>
          <div className="space-y-2">
            {data.healthFactors.map((f) => {
              const icon = f.status === 'healthy' ? CheckCircle : f.status === 'warning' ? AlertTriangle : XCircle
              const iconColor = f.status === 'healthy' ? 'text-green-500' : f.status === 'warning' ? 'text-amber-500' : 'text-red-500'
              const iconBg = f.status === 'healthy' ? 'bg-green-100 dark:bg-green-950/30' : f.status === 'warning' ? 'bg-amber-100 dark:bg-amber-950/30' : 'bg-red-100 dark:bg-red-950/30'
              return (
                <div key={f.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className={cn('p-1 rounded-full', iconBg)}>
                    <icon className={cn('w-3.5 h-3.5', iconColor)} />
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
          <SectionHeader title="Risk Indicators" size="sm" />
          <div className="space-y-2 mt-4">
            {data.riskIndicators.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Shield className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No risks identified</p>
              </div>
            ) : (
              data.riskIndicators.map((r, i) => {
                const sevColor = r.severity === 'critical' ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
                  : r.severity === 'high' ? 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20'
                  : r.severity === 'medium' ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'
                  : 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20'
                return (
                  <div key={i} className={cn('flex items-start gap-2 p-3 rounded-lg border', sevColor)}>
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{r.message}</p>
                      <span className="text-[10px] uppercase tracking-wider opacity-60">{r.severity}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

function ProductsSection({ data }: { data: ContractWorkspaceData }) {
  const total = data.products.reduce((s, p) => s + p.lineTotal, 0)
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Product</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Qty</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Rate</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Disc</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tax</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.products.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium">{p.productName}</div>
                  <div className="text-xs text-muted-foreground">{p.sku}</div>
                </td>
                <td className="px-4 py-3 text-right text-sm">{p.quantity}</td>
                <td className="px-4 py-3 text-right text-sm">{data.currency} {p.rate.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-sm">{p.discount}%</td>
                <td className="px-4 py-3 text-right text-sm">{p.tax}%</td>
                <td className="px-4 py-3 text-right text-sm font-medium">{data.currency} {p.lineTotal.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 py-4 border-t border-border">
        <span className="text-sm font-semibold">Total Contract Value</span>
        <span className="text-lg font-bold">{data.currency} {total.toLocaleString()}</span>
      </div>
    </Card>
  )
}

function RenewalsSection({ data }: { data: ContractWorkspaceData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-muted/30 border-none text-center">
          <div className="text-xs text-muted-foreground mb-1">Current Term</div>
          <div className="text-lg font-bold">{formatDate(data.startDate)} — {formatDate(data.endDate)}</div>
        </Card>
        <Card className="bg-muted/30 border-none text-center">
          <div className="text-xs text-muted-foreground mb-1">Next Renewal</div>
          <div className="text-lg font-bold">{formatDate(data.renewalDate)}</div>
          <div className="text-xs text-muted-foreground">{daysUntil(data.renewalDate)} days away</div>
        </Card>
        <Card className="bg-muted/30 border-none text-center">
          <div className="text-xs text-muted-foreground mb-1">Lifetime Value</div>
          <div className="text-lg font-bold">{data.currency} {(data.renewals.reduce((s, r) => s + r.value, 0) / 100000).toFixed(1)}L</div>
        </Card>
      </div>
      <Card>
        <SectionHeader title="Renewal History" size="sm" />
        <div className="space-y-0 mt-3">
          {data.renewals.map((r, i) => (
            <div key={r.id} className="flex items-center gap-4 py-3 last:pb-0 border-b border-border last:border-0">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <RefreshCw className="w-4 h-4" />
                </div>
                {i < data.renewals.length - 1 && <div className="w-0.5 h-4 bg-border" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{r.version}</div>
                <div className="text-xs text-muted-foreground">{formatDate(r.startDate)} — {formatDate(r.endDate)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{data.currency} {(r.value / 100000).toFixed(1)}L</div>
                <StatusBadge status={r.status} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function TimelineSection({ data }: { data: ContractWorkspaceData }) {
  return (
    <Card>
      <SectionHeader title="Activity Timeline" size="sm" />
      <div className="mt-4">
        <Timeline>
          {data.activity.map((a) => {
            const Icon = getActivityIcon(a.type)
            return (
              <TimelineItem
                key={a.id}
                icon={Icon}
                iconColor={getActivityColor(a.type).split(' ')[0]}
                iconBgColor={getActivityColor(a.type).split(' ').slice(1).join(' ')}
                title={a.title}
                description={a.description}
                time={formatDate(a.timestamp)}
              />
            )
          })}
        </Timeline>
      </div>
    </Card>
  )
}

function DocumentsSection({ data }: { data: ContractWorkspaceData }) {
  return (
    <div className="space-y-3">
      {data.documents.map((doc) => (
        <Card key={doc.id} variant="interactive" padding="md">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{doc.fileName}</p>
              <p className="text-xs text-muted-foreground">{doc.type} · {doc.size} · {doc.uploadedBy}</p>
            </div>
            <div className="text-xs text-muted-foreground">{formatDate(doc.uploadedAt)}</div>
            <Button variant="ghost" size="sm" icon={<Download className="w-4 h-4" />} />
          </div>
        </Card>
      ))}
      <Button variant="ghost" className="w-full" icon={<Upload className="w-4 h-4" />}>Upload Document</Button>
    </div>
  )
}

function CommunicationsSection({ data }: { data: ContractWorkspaceData }) {
  return (
    <div className="space-y-3">
      {data.communications.map((c) => {
        const Icon = commIcons[c.type] || MessageSquare
        return (
          <Card key={c.id} variant="interactive" padding="md">
            <div className="flex gap-4">
              <div className={cn('p-2.5 rounded-lg flex-shrink-0', commColors[c.type])}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.subject}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.type}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{c.summary}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>{c.from}</span>
                  <span>→</span>
                  <span>{c.to}</span>
                  <span>{formatDate(c.timestamp)}</span>
                </div>
              </div>
            </div>
          </Card>
        )
      })}
      <Button variant="ghost" className="w-full" icon={<Plus className="w-4 h-4" />}>Log Communication</Button>
    </div>
  )
}

function FinancialSection({ data }: { data: ContractWorkspaceData }) {
  const totalInvoiced = data.invoices.reduce((s, i) => s + i.amount, 0)
  const totalPaid = data.invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
  const outstanding = totalInvoiced - totalPaid

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-muted/30 border-none">
          <div className="text-xs text-muted-foreground mb-1">Total Invoiced</div>
          <div className="text-2xl font-bold">{data.currency} {(totalInvoiced / 100000).toFixed(1)}L</div>
        </Card>
        <Card className="bg-muted/30 border-none">
          <div className="text-xs text-muted-foreground mb-1">Total Collected</div>
          <div className="text-2xl font-bold text-green-600">{data.currency} {(totalPaid / 100000).toFixed(1)}L</div>
        </Card>
        <Card className="bg-muted/30 border-none">
          <div className="text-xs text-muted-foreground mb-1">Outstanding</div>
          <div className="text-2xl font-bold text-amber-600">{data.currency} {(outstanding / 100000).toFixed(1)}L</div>
        </Card>
      </div>
      <Card>
        <SectionHeader title="Invoice History" size="sm" />
        <div className="space-y-2 mt-4">
          {data.invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <div>
                <div className="text-sm font-medium">{inv.number}</div>
                <div className="text-xs text-muted-foreground">Due: {formatDate(inv.dueDate)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{data.currency} {(inv.amount / 100000).toFixed(1)}L</div>
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', statusColor(inv.status))}>
                  {inv.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function ApprovalsSection({ data }: { data: ContractWorkspaceData }) {
  return (
    <div className="space-y-3">
      {data.approvals.map((a) => (
        <Card key={a.id} variant="interactive" padding="md">
          <div className="flex items-start gap-4">
            <div className={cn(
              'p-2 rounded-lg flex-shrink-0',
              a.status === 'approved' ? 'bg-green-100 text-green-600 dark:bg-green-950/30' : 'bg-amber-100 text-amber-600 dark:bg-amber-950/30',
            )}>
              {a.status === 'approved' ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{a.approver}</span>
                <StatusBadge status={a.status} size="sm" />
              </div>
              <div className="text-xs text-muted-foreground">{a.role}</div>
              {a.comments && <p className="text-sm text-muted-foreground mt-1 italic">"{a.comments}"</p>}
              <div className="text-xs text-muted-foreground mt-1">{formatDate(a.timestamp)}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function AnalyticsSection({ data }: { data: ContractWorkspaceData }) {
  const maxUsage = Math.max(...data.analytics.monthlyUsage.map(m => m.value))
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-muted/30 border-none">
          <div className="text-xs text-muted-foreground mb-1">Compliance Rate</div>
          <div className="text-2xl font-bold text-green-600">{data.analytics.complianceRate}%</div>
        </Card>
        <Card className="bg-muted/30 border-none">
          <div className="text-xs text-muted-foreground mb-1">Avg Response Time</div>
          <div className="text-2xl font-bold">{data.analytics.avgResponseTime}</div>
        </Card>
        <Card className="bg-muted/30 border-none">
          <div className="text-xs text-muted-foreground mb-1">Satisfaction Score</div>
          <div className="text-2xl font-bold">{data.analytics.satisfactionScore}/5</div>
        </Card>
      </div>
      <Card>
        <SectionHeader title="Monthly Usage (Licensed Seats)" size="sm" />
        <div className="flex items-end gap-2 mt-6 h-32">
          {data.analytics.monthlyUsage.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">{m.value}</span>
              <div
                className="w-full bg-primary/20 rounded-t-md hover:bg-primary/30 transition-colors"
                style={{ height: `${(m.value / maxUsage) * 100}%` }}
              />
              <span className="text-[10px] text-muted-foreground">{m.month}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function OrganizationsSection({ data }: { data: ContractWorkspaceData }) {
  return (
    <div className="space-y-3">
      {data.organizations.map((org) => (
        <Card key={org.id} variant="interactive" padding="md">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary flex-shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{org.name}</span>
                <StatusBadge status={org.type} size="sm" variant="outlined" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{org.role}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {org.contactPerson}</span>
                <span>{org.email}</span>
                <span>{org.phone}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" icon={<ChevronRight className="w-4 h-4" />} />
          </div>
        </Card>
      ))}
    </div>
  )
}

const sectionComponents: Record<string, (data: ContractWorkspaceData) => React.ReactNode> = {
  overview: (d) => <OverviewSection data={d} />,
  health: (d) => <HealthSection data={d} />,
  products: (d) => <ProductsSection data={d} />,
  renewals: (d) => <RenewalsSection data={d} />,
  timeline: (d) => <TimelineSection data={d} />,
  documents: (d) => <DocumentsSection data={d} />,
  communications: (d) => <CommunicationsSection data={d} />,
  financial: (d) => <FinancialSection data={d} />,
  approvals: (d) => <ApprovalsSection data={d} />,
  analytics: (d) => <AnalyticsSection data={d} />,
  organizations: (d) => <OrganizationsSection data={d} />,
}

function toArray<T>(val: any): T[] {
  if (Array.isArray(val)) return val
  if (val && Array.isArray(val.approvals)) return val.approvals
  if (val && Array.isArray(val.items)) return val.items
  if (val && Array.isArray(val.invoices)) return val.invoices
  if (val && Array.isArray(val.documents)) return val.documents
  if (val && Array.isArray(val.renewals)) return val.renewals
  if (val && Array.isArray(val.activities)) return val.activities
  return []
}

function buildContractData(
  c: Contract, lineItems: any, docs: any,
  assistance: ContractAssistance | undefined, approvals: any,
  invoices: any, renewals: any, activities: any,
): ContractWorkspaceData {
  const hf = (assistance?.health_score?.factors || []).map(f => ({
    label: f.label, status: (f.status === 'good' ? 'healthy' : f.status || 'warning') as 'healthy' | 'warning' | 'critical',
    detail: f.detail, score: f.score, max: f.max,
  }))
  const ri = (assistance?.risks || []).map(r => ({
    severity: r.severity as 'low' | 'medium' | 'high' | 'critical', message: r.message,
  }))
  return {
    id: c.id, name: c.contract_name, contractNumber: c.contract_number || '',
    status: c.status, description: c.notes || '', companyName: c.company_name,
    totalValue: c.total_contract_value, currency: c.currency || 'INR',
    startDate: c.start_date, endDate: c.end_date, renewalDate: c.renewal_date,
    paymentTerms: c.payment_terms || '', owner: `User ${c.user_id}`, department: '',
    healthScore: assistance?.health_score?.score || 0, healthLevel: assistance?.health_score?.level || 'unknown',
    healthFactors: hf, riskIndicators: ri, notes: [],
    products: toArray<ContractLineItem>(lineItems).map(li => ({
      id: li.id, productName: li.product_name, sku: li.sku || '',
      quantity: li.quantity, rate: li.rate, discount: li.discount, tax: li.tax,
      lineTotal: li.line_total || li.amount,
    })),
    renewals: toArray<Contract>(renewals).map((r, i) => ({
      id: r.id, version: `v${i + 1}`, startDate: r.start_date || '',
      endDate: r.end_date || '', value: r.total_contract_value, status: r.status,
    })),
    activity: toArray<ActivityItem>(activities).map(a => ({
      id: a.id, type: a.activity_type, title: a.title, description: a.description || '',
      timestamp: a.created_at, user: `User ${a.user_id}`,
    })),
    documents: toArray<ContractDocument>(docs).map(d => ({
      id: d.id, fileName: d.file_name, type: d.content_type || 'Unknown',
      uploadedBy: `User ${d.uploaded_by_id || 0}`, uploadedAt: d.uploaded_at, size: '—',
    })),
    communications: [],
    invoices: toArray<Invoice>(invoices).map(i => ({
      id: i.id, number: i.invoice_number || `INV-${i.id}`, amount: i.total || i.amount || 0,
      status: i.status, dueDate: i.due_date || '', paidDate: i.paid_date,
    })),
    approvals: toArray<Approval>(approvals).map(a => ({
      id: a.id, step: a.approval_level || 1, approver: a.approver_name || 'Unknown',
      role: 'Approver', status: a.status as 'pending' | 'approved' | 'rejected',
      comments: a.comments || '', timestamp: a.submitted_at,
    })),
    analytics: { monthlyUsage: [], complianceRate: 0, avgResponseTime: '—', satisfactionScore: 0 },
    organizations: [],
  }
}

export function ContractWorkspace() {
  const { setActivePage, pageParams } = useUIStore()
  const contractId = pageParams.contractId as number | undefined
  const [activeSection, setActiveSection] = useState('overview')

  const { data: contract, isLoading: cLoading } = useContract(contractId!)
  const { data: lineItems } = useContractLineItems(contractId!)
  const { data: docs } = useContractDocuments(contractId!)
  const { data: assistance } = useContractAssistance(contractId!)
  const { data: approvals } = useContractApprovals(contractId!)
  const { data: invoices } = useContractInvoices(contractId!)
  const { data: renewals } = useRenewalHistory(contractId!)
  const { data: activities } = useContractActivity(contractId!)

  const isLoading = cLoading
  const data = contract && buildContractData(contract, lineItems || [], docs || [],
    assistance, approvals || [], invoices || [], renewals || [], activities || [])

  if (!contractId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <FileText className="w-16 h-16 mb-4" />
        <p className="text-lg">No contract selected</p>
        <Button onClick={() => setActivePage('contracts')} variant="link">Go to Contracts</Button>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="w-8 h-8 mb-4 animate-spin text-primary" />
        <p className="text-sm font-medium">Loading contract workspace...</p>
      </div>
    )
  }

  const SectionContent = sectionComponents[activeSection]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={() => setActivePage('contracts')} variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
          Back
        </Button>
      </div>

      <Card padding="lg" variant="elevated">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{data.name}</h1>
              <StatusBadge status={data.status} dot />
              <span className="text-sm text-muted-foreground">{data.contractNumber}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{data.companyName} · {data.owner}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="secondary" size="sm" icon={<Edit3 className="w-4 h-4" />}>Edit</Button>
            <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />}>Renew</Button>
            <Button variant="secondary" size="sm" icon={<Printer className="w-4 h-4" />}>Print</Button>
            <Button variant="ghost" size="sm" icon={<MoreHorizontal className="w-4 h-4" />} />
          </div>
        </div>
      </Card>

      <div className="flex gap-6">
        <nav className="hidden lg:flex flex-col gap-0.5 w-52 flex-shrink-0">
          <div className="sticky top-24 space-y-0.5">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-all text-left',
                  activeSection === s.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                <s.icon className="w-4 h-4" />
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-1 min-w-0">
          <div className="flex lg:hidden overflow-x-auto gap-1 mb-6 pb-2">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                  activeSection === s.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            ))}
          </div>

          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            {SectionContent(data)}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
