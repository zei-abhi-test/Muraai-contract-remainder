import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3, FileText, Users, Package, RefreshCw, DollarSign,
  FileSpreadsheet, Download, Search, Filter, X, Loader2,
  TrendingUp, TrendingDown, Receipt, ShoppingCart,
  CalendarRange, ChevronDown, Activity, Clock, Upload,
  CheckCircle, XCircle, AlertTriangle, Eye, Printer,
} from 'lucide-react'
import { PageHeader, StatusBadge } from '@/components/ui'
import { LoadingState, EmptyState } from '@/components/ui/LoadingSpinner'
import { DataTable, type Column } from '@/components/ui'
import {
  useReport, useCharts, useSummary, useStatistics,
  useDocumentStats, useActivityStats, useRenewalStats,
} from '@/hooks/useReports'
import { useCustomers } from '@/hooks/useCustomers'
import { useContractTypes } from '@/hooks/useContractTypes'
import { useUIStore } from '@/store/uiStore'
import { reportsApi, type ReportFilters, type ChartsData, type SummaryData, type StatisticsData, type RevenueData } from '@/api/reports'
import type { Contract } from '@/api/contracts'
import type { Invoice } from '@/api/invoices'
import type { PurchaseOrder } from '@/api/purchaseOrders'
import { toast } from 'sonner'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'

const c = (i: number) => `var(--chart-${i})`
const COLORS = [c(1), c(2), c(3), c(4), c(5), c(6), c(7), c(8)]
const PIE_COLORS = COLORS

const sections = [
  { id: 'overview', label: 'Executive Dashboard', icon: BarChart3 },
  { id: 'contracts', label: 'Contracts', icon: FileText },
  { id: 'revenue', label: 'Revenue', icon: DollarSign },
  { id: 'invoices', label: 'Invoices', icon: Receipt },
  { id: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
  { id: 'renewals', label: 'Renewals', icon: RefreshCw },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'approvals', label: 'Approvals', icon: CheckCircle },
  { id: 'documents', label: 'Documents', icon: FileSpreadsheet },
  { id: 'activity', label: 'Activity', icon: Activity },
]

function FilterBar({ filters, onChange, onClear }: {
  filters: ReportFilters
  onChange: (f: ReportFilters) => void
  onClear: () => void
}) {
  const { data: customers } = useCustomers()
  const { data: contractTypes } = useContractTypes()

  return (
    <div className="flex flex-wrap items-end gap-3 p-4 bg-muted/30 rounded-lg border border-border print:hidden">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Start Date</label>
        <input type="date" value={filters.start_date || ''}
          onChange={e => onChange({ ...filters, start_date: e.target.value || undefined })}
          className="px-3 py-1.5 rounded-md border border-border bg-background text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">End Date</label>
        <input type="date" value={filters.end_date || ''}
          onChange={e => onChange({ ...filters, end_date: e.target.value || undefined })}
          className="px-3 py-1.5 rounded-md border border-border bg-background text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <select value={filters.status || ''}
          onChange={e => onChange({ ...filters, status: e.target.value || undefined })}
          className="px-3 py-1.5 rounded-md border border-border bg-background text-sm">
          <option value="">All</option>
          <option value="Active">Active</option>
          <option value="Draft">Draft</option>
          <option value="Expired">Expired</option>
          <option value="Terminated">Terminated</option>
          <option value="On Hold">On Hold</option>
          <option value="Pending Approval">Pending Approval</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Customer</label>
        <select value={filters.customer_id || ''}
          onChange={e => onChange({ ...filters, customer_id: e.target.value ? Number(e.target.value) : undefined })}
          className="px-3 py-1.5 rounded-md border border-border bg-background text-sm">
          <option value="">All</option>
          {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Contract Type</label>
        <select value={filters.contract_type_id || ''}
          onChange={e => onChange({ ...filters, contract_type_id: e.target.value ? Number(e.target.value) : undefined })}
          className="px-3 py-1.5 rounded-md border border-border bg-background text-sm">
          <option value="">All</option>
          {(contractTypes || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Search</label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input type="text" value={filters.search || ''}
            onChange={e => onChange({ ...filters, search: e.target.value || undefined })}
            placeholder="Search..." className="pl-8 pr-3 py-1.5 rounded-md border border-border bg-background text-sm w-40" />
        </div>
      </div>
      <button onClick={onClear}
        className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
        <X className="w-3.5 h-3.5" /> Clear
      </button>
    </div>
  )
}

function SummaryCards({ data }: { data: SummaryData | undefined }) {
  if (!data) return null
  const cards = [
    { label: 'Total Contracts', value: data.total_contracts, icon: FileText, color: 'text-info' },
    { label: 'Active', value: data.active_contracts, icon: Activity, color: 'text-success' },
    { label: 'Expiring Soon', value: data.expiring_soon, icon: CalendarRange, color: 'text-warning' },
    { label: 'Customers', value: data.total_customers, icon: Users, color: 'text-primary' },
    { label: 'Invoices', value: data.total_invoices, icon: Receipt, color: 'text-rose-500' },
    { label: 'Revenue', value: `$${data.total_revenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500' },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map(card => {
        const Icon = card.icon
        return (
          <div key={card.label} className="p-4 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-2 mb-2"><Icon className={`w-4 h-4 ${card.color}`} /><span className="text-xs text-muted-foreground">{card.label}</span></div>
            <div className="text-2xl font-bold">{card.value}</div>
          </div>
        )
      })}
    </div>
  )
}

function StatCards({ data }: { data: StatisticsData | undefined }) {
  if (!data) return null
  const monthlyData = data.monthly_revenue || []
  const trend = data.current_month_revenue >= data.prev_month_revenue
  const TrendIcon = trend ? TrendingUp : TrendingDown
  const trendColor = trend ? 'text-success' : 'text-destructive'
  const appr = data.approvals || { pending: 0, approved: 0, rejected: 0, cancelled: 0, avg_approval_time_hours: 0 }
  const bs = data.contracts_by_status || {}

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-card border border-border rounded-xl"><div className="text-xs text-muted-foreground mb-1">Overdue Invoices</div><div className="text-2xl font-bold text-destructive">{data.overdue_invoices}</div></div>
        <div className="p-4 bg-card border border-border rounded-xl"><div className="text-xs text-muted-foreground mb-1">Upcoming Renewals</div><div className="text-2xl font-bold text-warning">{data.upcoming_renewals}</div></div>
        <div className="p-4 bg-card border border-border rounded-xl">
          <div className="text-xs text-muted-foreground mb-1">Monthly Revenue</div>
          <div className="text-2xl font-bold">${data.current_month_revenue.toLocaleString()}</div>
          <div className={`flex items-center gap-1 text-xs mt-1 ${trendColor}`}><TrendIcon className="w-3 h-3" />{trend ? 'Up' : 'Down'} from ${data.prev_month_revenue.toLocaleString()}</div>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl"><div className="text-xs text-muted-foreground mb-1">Active Contracts</div><div className="text-2xl font-bold">{bs.Active || 0}</div><div className="text-xs text-muted-foreground mt-1">Draft: {bs.Draft || 0} | Expired: {bs.Expired || 0}</div></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
        <div className="p-4 bg-card border border-border rounded-xl"><div className="text-xs text-muted-foreground mb-1">Pending Approvals</div><div className="text-2xl font-bold text-warning">{appr.pending}</div></div>
        <div className="p-4 bg-card border border-border rounded-xl"><div className="text-xs text-muted-foreground mb-1">Approved</div><div className="text-2xl font-bold text-success">{appr.approved}</div></div>
        <div className="p-4 bg-card border border-border rounded-xl"><div className="text-xs text-muted-foreground mb-1">Rejected</div><div className="text-2xl font-bold text-destructive">{appr.rejected}</div></div>
        <div className="p-4 bg-card border border-border rounded-xl"><div className="text-xs text-muted-foreground mb-1">Cancelled</div><div className="text-2xl font-bold text-muted-foreground">{appr.cancelled}</div></div>
        <div className="p-4 bg-card border border-border rounded-xl"><div className="text-xs text-muted-foreground mb-1">Avg Approval Time</div><div className="text-2xl font-bold text-info">{appr.avg_approval_time_hours}h</div></div>
      </div>
    </>
  )
}

function ContractsPerMonthChart({ data }: { data: ChartsData | undefined }) {
  if (!data?.contracts_per_month?.length) return null
  return (
    <div className="p-4 bg-card border border-border rounded-xl"><h4 className="text-sm font-semibold mb-4">Monthly Contract Growth</h4>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data.contracts_per_month}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
          <Bar dataKey="count" fill={c(1)} radius={[4, 4, 0, 0]} name="Contracts" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function RevenueTrendChart({ data }: { data: ChartsData | undefined }) {
  if (!data?.revenue_trend?.length) return null
  return (
    <div className="p-4 bg-card border border-border rounded-xl"><h4 className="text-sm font-semibold mb-4">Revenue Trend</h4>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data.revenue_trend}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} formatter={(value: number | undefined) => [`$${(value ?? 0).toLocaleString()}`, 'Revenue']} />
          <Area type="monotone" dataKey="revenue" stroke={c(2)} fill={c(2)} fillOpacity={0.15} strokeWidth={2} dot={{ r: 2 }} name="Revenue" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function InvoiceStatusChart({ data }: { data: ChartsData | undefined }) {
  if (!data?.invoice_status?.length) return null
  return (
    <div className="p-4 bg-card border border-border rounded-xl"><h4 className="text-sm font-semibold mb-4">Invoice Status Distribution</h4>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={data.invoice_status} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="count" nameKey="status" labelLine={false}>
            {data.invoice_status.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function DonutChart({ data, title, dataKey, nameKey, colors = PIE_COLORS }: { data: any[]; title: string; dataKey: string; nameKey: string; colors?: string[] }) {
  if (!data?.length) return null
  return (
    <div className="p-4 bg-card border border-border rounded-xl"><h4 className="text-sm font-semibold mb-4">{title}</h4>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey={dataKey} nameKey={nameKey} labelLine={false}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function RenewalTrendChart({ data }: { data: ChartsData | undefined }) {
  if (!data?.renewal_trend?.length) return null
  return (
    <div className="p-4 bg-card border border-border rounded-xl"><h4 className="text-sm font-semibold mb-4">Renewal Trend</h4>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data.renewal_trend}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
          <Line type="monotone" dataKey="count" stroke={c(3)} strokeWidth={2} dot={{ r: 3 }} name="Renewals" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ContractTypesChart({ data }: { data: ChartsData | undefined }) {
  if (!data?.contract_types?.length) return null
  return (
    <div className="p-4 bg-card border border-border rounded-xl"><h4 className="text-sm font-semibold mb-4">Top Contract Types</h4>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data.contract_types} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={100} />
          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
          <Bar dataKey="count" fill={c(5)} radius={[0, 4, 4, 0]} name="Contracts" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function TopCustomersChart({ data }: { data: ChartsData | undefined }) {
  if (!data?.top_customers?.length) return null
  return (
    <div className="p-4 bg-card border border-border rounded-xl"><h4 className="text-sm font-semibold mb-4">Top Customers by Contracts</h4>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data.top_customers} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={100} />
          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} formatter={(value: number | undefined) => [value ?? 0, 'Contracts']} />
          <Bar dataKey="contract_count" fill={c(6)} radius={[0, 4, 4, 0]} name="Contracts" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function TopCustomersByValueChart({ data }: { data: ChartsData | undefined }) {
  if (!data?.top_customers?.length) return null
  const sorted = [...data.top_customers].sort((a, b) => b.total_value - a.total_value)
  return (
    <div className="p-4 bg-card border border-border rounded-xl"><h4 className="text-sm font-semibold mb-4">Revenue by Customer</h4>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={sorted} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={100} />
          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} formatter={(value: number | undefined) => [`$${(value ?? 0).toLocaleString()}`, 'Value']} />
          <Bar dataKey="total_value" fill={c(7)} radius={[0, 4, 4, 0]} name="Total Value" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ExportButton({ reportType, filters, label }: { reportType: string; filters: ReportFilters; label: string }) {
  const [exporting, setExporting] = useState(false)
  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const blob = await reportsApi.exportCSV(reportType, filters)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reportType}-report.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report exported successfully')
    } catch {
      toast.error('Failed to export report')
    } finally {
      setExporting(false)
    }
  }, [reportType, filters])
  return (
    <button onClick={handleExport} disabled={exporting}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-50">
      {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      {label}
    </button>
  )
}

function PrintButton() {
  return (
    <button onClick={() => window.print()}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-secondary transition-colors">
      <Printer className="w-3.5 h-3.5" /> Print
    </button>
  )
}

function SectionHeader({ title, exportType, filters, actions }: { title: string; exportType?: string; filters: ReportFilters; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4 print:border-b print:border-border print:pb-2">
      <h3 className="font-semibold text-lg">{title}</h3>
      <div className="flex items-center gap-2 print:hidden">
        {actions}
        {exportType && <ExportButton reportType={exportType} filters={filters} label="CSV" />}
        <PrintButton />
      </div>
    </div>
  )
}

function formatStorage(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

export function ReportsPage() {
  const pageParams = useUIStore(s => s.pageParams)
  const initialSection = (pageParams?.section as string) || 'overview'
  const [activeSection, setActiveSection] = useState(initialSection)
  const [filters, setFilters] = useState<ReportFilters>({})
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')

  const { data: charts, isLoading: chartsLoading } = useCharts(filters)
  const { data: summary, isLoading: summaryLoading } = useSummary()
  const { data: statistics, isLoading: statsLoading } = useStatistics()
  const { data: contracts = [], isLoading: contractsLoading } = useReport<Contract[]>('contracts', filters)
  const { data: invoices = [], isLoading: invoicesLoading } = useReport<Invoice[]>('invoices', filters)
  const { data: purchaseOrders = [], isLoading: poLoading } = useReport<PurchaseOrder[]>('purchase-orders', filters)
  const { data: renewals = [], isLoading: renewalsLoading } = useReport<Contract[]>('renewals', filters)
  const { data: customers = [], isLoading: customersLoading } = useReport<any[]>('customers', filters)
  const { data: products = [], isLoading: productsLoading } = useReport<any[]>('products', filters)
  const { data: revenue = { total_revenue: 0, total_line_items: 0 }, isLoading: revenueLoading } = useReport<RevenueData>('revenue', filters)
  const { data: approvals = [], isLoading: approvalsLoading } = useReport<any[]>('approvals', filters)
  const { data: docStats, isLoading: docLoading } = useDocumentStats()
  const { data: activityStats, isLoading: activityLoading } = useActivityStats(filters)
  const { data: renewalStats, isLoading: renewalStatsLoading } = useRenewalStats()

  const clearFilters = () => setFilters({})
  const overviewLoading = summaryLoading || statsLoading || chartsLoading

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-6">
            <SummaryCards data={summary} />
            <StatCards data={statistics} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ContractsPerMonthChart data={charts} />
              <RevenueTrendChart data={charts} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <InvoiceStatusChart data={charts} />
              <ContractTypesChart data={charts} />
              <TopCustomersChart data={charts} />
            </div>
          </div>
        )

      case 'contracts': {
        const bs = statistics?.contracts_by_status || {}
        return (
          <div className="space-y-4">
            <SectionHeader title={`Contracts Report (${contracts?.length || 0})`} exportType="contracts" filters={filters} />
            {/* Contract KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Total</div><div className="text-xl font-bold">{(bs.Active || 0) + (bs.Draft || 0) + (bs.Expired || 0) + (bs['On Hold'] || 0) + (bs['Pending Approval'] || 0) + (bs.Completed || 0) || 0}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Active</div><div className="text-xl font-bold text-success">{bs.Active || 0}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Draft</div><div className="text-xl font-bold text-muted-foreground">{bs.Draft || 0}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Expired</div><div className="text-xl font-bold text-destructive">{bs.Expired || 0}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">On Hold</div><div className="text-xl font-bold text-warning">{bs['On Hold'] || 0}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Pending Approval</div><div className="text-xl font-bold text-primary">{bs['Pending Approval'] || 0}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Completed</div><div className="text-xl font-bold text-info">{bs.Completed || 0}</div></div>
            </div>
            {/* Contract Value */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-card border border-border rounded-xl">
                <div className="text-sm text-muted-foreground mb-1">Total Contract Value</div>
                <div className="text-2xl font-bold">${(contracts || []).reduce((s, c) => s + (c.total_contract_value || 0), 0).toLocaleString()}</div>
              </div>
              <div className="p-4 bg-card border border-border rounded-xl">
                <div className="text-sm text-muted-foreground mb-1">Average Contract Value</div>
                <div className="text-2xl font-bold">${contracts?.length ? ((contracts || []).reduce((s, c) => s + (c.total_contract_value || 0), 0) / contracts.length).toLocaleString() : '0'}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ContractsPerMonthChart data={charts} />
              <ContractTypesChart data={charts} />
            </div>
            <DataTable
              columns={[
                { key: 'contract_name', header: 'Name', render: (c: any) => <span className="font-medium">{c.contract_name}</span> },
                { key: 'company_name', header: 'Company' },
                { key: 'status', header: 'Status', render: (c: any) => <StatusBadge status={c.status} dot />},
                { key: 'start_date', header: 'Start', render: (c: any) => <span className="text-muted-foreground">{c.start_date ? new Date(c.start_date).toLocaleDateString() : '-'}</span> },
                { key: 'end_date', header: 'End', render: (c: any) => <span className="text-muted-foreground">{c.end_date ? new Date(c.end_date).toLocaleDateString() : '-'}</span> },
                { key: 'total_contract_value', header: 'Value', className: 'text-right', render: (c: any) => <span className="font-medium">${(c.total_contract_value || 0).toLocaleString()}</span> },
                { key: 'currency', header: 'Currency' },
              ]}
              data={contracts || []}
              keyExtractor={(c: any) => c.id}
              isLoading={contractsLoading}
              emptyMessage="No contracts found"
            />
          </div>
        )
      }

      case 'invoices': {
        const issued = (invoices || []).filter(i => i.status === 'ISSUED' || i.status === 'SENT').length
        const paid = (invoices || []).filter(i => i.status === 'PAID').length
        const cancelled = (invoices || []).filter(i => i.status === 'CANCELLED').length
        const overdue = (invoices || []).filter(i => i.status === 'OVERDUE').length
        const totalAmt = (invoices || []).reduce((s, i) => s + (i.total || i.amount || 0), 0)
        const paidAmt = (invoices || []).filter(i => i.status === 'PAID').reduce((s, i) => s + (i.total || i.amount || 0), 0)
        const collectionRate = totalAmt > 0 ? Math.round((paidAmt / totalAmt) * 100) : 0
        return (
          <div className="space-y-4">
            <SectionHeader title={`Invoices Report (${invoices?.length || 0})`} exportType="invoices" filters={filters} />
            {/* Invoice KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Issued</div><div className="text-xl font-bold text-info">{issued}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Paid</div><div className="text-xl font-bold text-success">{paid}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Overdue</div><div className="text-xl font-bold text-destructive">{overdue}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Cancelled</div><div className="text-xl font-bold text-muted-foreground">{cancelled}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Total Revenue</div><div className="text-xl font-bold">${totalAmt.toLocaleString()}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Collection Rate</div><div className="text-xl font-bold text-emerald-500">{collectionRate}%</div></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <InvoiceStatusChart data={charts} />
              <RevenueTrendChart data={charts} />
            </div>
            <DataTable
              columns={[
                { key: 'invoice_number', header: '#', render: (i: any) => <span className="font-medium">{i.invoice_number}</span> },
                { key: 'amount', header: 'Amount', className: 'text-right', render: (i: any) => <>${(i.amount || 0).toLocaleString()}</> },
                { key: 'invoice_date', header: 'Date', render: (i: any) => <span className="text-muted-foreground">{i.invoice_date ? new Date(i.invoice_date).toLocaleDateString() : '-'}</span> },
                { key: 'due_date', header: 'Due', render: (i: any) => <span className="text-muted-foreground">{i.due_date ? new Date(i.due_date).toLocaleDateString() : '-'}</span> },
                { key: 'status', header: 'Status', render: (i: any) => <StatusBadge status={i.status} dot />},
                { key: 'currency', header: 'Currency' },
              ]}
              data={invoices || []}
              keyExtractor={(i: any) => i.id}
              isLoading={invoicesLoading}
              emptyMessage="No invoices found"
            />
          </div>
        )
      }

      case 'purchase-orders': {
        const pending = (purchaseOrders || []).filter(p => p.status === 'Pending' || p.status === 'Draft').length
        const completed = (purchaseOrders || []).filter(p => p.status === 'Completed').length
        const approved = (purchaseOrders || []).filter(p => p.status === 'Approved').length
        const cancelled = (purchaseOrders || []).filter(p => p.status === 'Cancelled').length
        const totalVendor = (purchaseOrders || []).reduce((s, p) => s + (p.amount || 0), 0)
        return (
          <div className="space-y-4">
            <SectionHeader title={`Purchase Orders Report (${purchaseOrders?.length || 0})`} exportType="purchase_orders" filters={filters} />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Created</div><div className="text-xl font-bold">{purchaseOrders?.length || 0}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Pending</div><div className="text-xl font-bold text-warning">{pending}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Approved</div><div className="text-xl font-bold text-success">{approved}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Completed</div><div className="text-xl font-bold text-info">{completed}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Cancelled</div><div className="text-xl font-bold text-destructive">{cancelled}</div></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-card border border-border rounded-xl"><div className="text-sm text-muted-foreground mb-1">Total Vendor Spending</div><div className="text-2xl font-bold">${totalVendor.toLocaleString()}</div></div>
            </div>
            <DataTable
              columns={[
                { key: 'po_number', header: 'PO #', render: (p: any) => <span className="font-medium">{p.po_number}</span> },
                { key: 'vendor', header: 'Vendor' },
                { key: 'po_date', header: 'Date', render: (p: any) => <span className="text-muted-foreground">{p.po_date ? new Date(p.po_date).toLocaleDateString() : '-'}</span> },
                { key: 'amount', header: 'Amount', className: 'text-right', render: (p: any) => <>${(p.amount || 0).toLocaleString()}</> },
                { key: 'status', header: 'Status', render: (p: any) => <StatusBadge status={p.status} dot />},
                { key: 'currency', header: 'Currency' },
              ]}
              data={purchaseOrders || []}
              keyExtractor={(p: any) => p.id}
              isLoading={poLoading}
              emptyMessage="No purchase orders found"
            />
          </div>
        )
      }

      case 'renewals':
        return (
          <div className="space-y-4">
            <SectionHeader title={`Renewals Report`} exportType="renewals" filters={filters} />
            {renewalStatsLoading ? <LoadingState /> : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Renewed</div><div className="text-xl font-bold text-success">{renewalStats?.total_renewed || 0}</div></div>
                <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Upcoming (30d)</div><div className="text-xl font-bold text-warning">{renewalStats?.upcoming_renewals || 0}</div></div>
                <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Missed</div><div className="text-xl font-bold text-destructive">{renewalStats?.missed_renewals || 0}</div></div>
                <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Active Contracts</div><div className="text-xl font-bold">{renewalStats?.active_contracts || 0}</div></div>
                <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Success Rate</div><div className="text-xl font-bold text-emerald-500">{renewalStats?.success_rate || 0}%</div></div>
                <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Avg Approval Time</div><div className="text-xl font-bold text-info">{renewalStats?.avg_approval_time_hours || 0}h</div></div>
              </div>
            )}
            <RenewalTrendChart data={charts} />
            <DataTable
              columns={[
                { key: 'contract_name', header: 'Name', render: (c: any) => <span className="font-medium">{c.contract_name}</span> },
                { key: 'company_name', header: 'Company' },
                { key: 'renewal_date', header: 'Renewal Date', render: (c: any) => <span className="text-muted-foreground">{c.renewal_date ? new Date(c.renewal_date).toLocaleDateString() : '-'}</span> },
                { key: 'status', header: 'Status', render: (c: any) => <StatusBadge status={c.status} dot />},
                { key: 'total_contract_value', header: 'Value', className: 'text-right', render: (c: any) => <>${(c.total_contract_value || 0).toLocaleString()}</> },
              ]}
              data={renewals || []}
              keyExtractor={(c: any) => c.id}
              isLoading={renewalsLoading}
              emptyMessage="No upcoming renewals"
            />
          </div>
        )

      case 'customers':
        return (
          <div className="space-y-4">
            <SectionHeader title={`Customers Report (${customers?.length || 0})`} exportType="customers" filters={filters} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TopCustomersChart data={charts} />
              <TopCustomersByValueChart data={charts} />
            </div>
            <DataTable
              columns={[
                { key: 'name', header: 'Name', render: (c: any) => <span className="font-medium">{c.name}</span> },
                { key: 'customer_code', header: 'Code', render: (c: any) => <span className="text-muted-foreground">{c.customer_code || '-'}</span> },
                { key: 'email', header: 'Email', render: (c: any) => <span className="text-muted-foreground">{c.email || '-'}</span> },
                { key: 'contract_count', header: 'Contracts', className: 'text-right' },
                { key: 'total_contract_value', header: 'Total Value', className: 'text-right', render: (c: any) => <span className="font-medium">${(c.total_contract_value || 0).toLocaleString()}</span> },
              ]}
              data={customers || []}
              keyExtractor={(c: any) => c.id}
              isLoading={customersLoading}
              emptyMessage="No customers found"
            />
          </div>
        )

      case 'products':
        return (
          <div className="space-y-4">
            <SectionHeader title={`Products Report (${products?.length || 0})`} exportType="products" filters={filters} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Total Products</div><div className="text-xl font-bold">{products?.length || 0}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Most Used</div><div className="text-xl font-bold">{products?.length ? Math.max(...products.map(p => p.contract_count || 0)) : 0}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Avg Rate</div><div className="text-xl font-bold">${products?.length ? (products.reduce((s, p) => s + (p.rate || 0), 0) / products.length).toFixed(2) : '0'}</div></div>
              <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Avg Product Usage</div><div className="text-xl font-bold">{products?.length ? (products.reduce((s, p) => s + (p.contract_count || 0), 0) / products.length).toFixed(1) : '0'}</div></div>
            </div>
            <DataTable
              columns={[
                { key: 'name', header: 'Name', render: (p: any) => <span className="font-medium">{p.name}</span> },
                { key: 'sku', header: 'SKU' },
                { key: 'category', header: 'Category', render: (p: any) => <span className="text-muted-foreground">{p.category || '-'}</span> },
                { key: 'rate', header: 'Rate', className: 'text-right', render: (p: any) => <>${(p.rate || 0).toLocaleString()}</> },
                { key: 'contract_count', header: 'Contracts', className: 'text-right' },
                { key: 'status', header: 'Status', render: (p: any) => <StatusBadge status={p.status} dot />},
              ]}
              data={products || []}
              keyExtractor={(p: any) => p.id}
              isLoading={productsLoading}
              emptyMessage="No products found"
            />
          </div>
        )

      case 'revenue':
        return (
          <div className="space-y-4">
            <SectionHeader title="Revenue Report" exportType="revenue" filters={filters} />
            <RevenueTrendChart data={charts} />
            {revenueLoading ? <LoadingState message="Loading revenue..." /> : !revenue ? (
              <EmptyState title="No revenue data" description="Try adjusting your filters." />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 bg-card border border-border rounded-xl"><div className="text-sm text-muted-foreground mb-1">Total Revenue</div><div className="text-3xl font-bold text-emerald-500">${revenue.total_revenue.toLocaleString()}</div></div>
                  <div className="p-6 bg-card border border-border rounded-xl"><div className="text-sm text-muted-foreground mb-1">Total Line Items</div><div className="text-3xl font-bold">{revenue.total_line_items}</div></div>
                </div>
                {statistics?.monthly_revenue && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <DonutChart data={(statistics.monthly_revenue || []).slice(-6).map(m => ({ ...m, label: m.month }))} title="Revenue Distribution (Last 6 Months)" dataKey="revenue" nameKey="month" />
                </div>}
              </>
            )}
          </div>
        )

      case 'approvals':
        return (
          <div className="space-y-4">
            <SectionHeader title={`Approvals Report (${approvals?.length || 0})`} exportType="approvals" filters={filters} />
            {statistics?.approvals && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Pending</div><div className="text-xl font-bold text-warning">{statistics.approvals.pending}</div></div>
                <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Approved</div><div className="text-xl font-bold text-success">{statistics.approvals.approved}</div></div>
                <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Rejected</div><div className="text-xl font-bold text-destructive">{statistics.approvals.rejected}</div></div>
                <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Avg Time</div><div className="text-xl font-bold text-info">{statistics.approvals.avg_approval_time_hours}h</div></div>
                <div className="p-3 bg-card border border-border rounded-lg text-center">
                  <div className="text-xs text-muted-foreground">Success Rate</div>
                  <div className="text-xl font-bold text-emerald-500">
                    {(() => {
                      const a = statistics.approvals.approved
                      const r = statistics.approvals.rejected
                      const total = a + r
                      return total > 0 ? Math.round((a / total) * 100) + '%' : '0%'
                    })()}
                  </div>
                </div>
              </div>
            )}
            <DonutChart data={[
              { name: 'Pending', value: statistics?.approvals?.pending || 0 },
              { name: 'Approved', value: statistics?.approvals?.approved || 0 },
              { name: 'Rejected', value: statistics?.approvals?.rejected || 0 },
              { name: 'Cancelled', value: statistics?.approvals?.cancelled || 0 },
            ]} title="Approval Status Distribution" dataKey="value" nameKey="name" />
            {approvalsLoading ? <LoadingState message="Loading approvals..." /> : !approvals?.length ? (
              <EmptyState title="No approvals found" description="Try adjusting your filters." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Contract ID</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Approver</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Submitted</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Approved</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Comments</th>
                  </tr></thead>
                  <tbody>{approvals.map(a => (
                    <tr key={a.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3 font-medium">#{a.contract_id}</td>
                      <td className="py-3 px-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${a.status === 'Approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : a.status === 'Pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : a.status === 'Rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>{a.status}</span></td>
                      <td className="py-3 px-3 text-muted-foreground">{a.approver_name || a.approver_id || '-'}</td>
                      <td className="py-3 px-3 text-muted-foreground">{a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : '-'}</td>
                      <td className="py-3 px-3 text-muted-foreground">{a.approved_at ? new Date(a.approved_at).toLocaleDateString() : '-'}</td>
                      <td className="py-3 px-3 text-muted-foreground max-w-[200px] truncate">{a.comments || '-'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )

      case 'documents':
        return (
          <div className="space-y-4">
            <SectionHeader title="Documents Report" exportType="documents" filters={filters} />
            {docLoading ? <LoadingState /> : !docStats ? (
              <EmptyState title="No document data available" />
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Total Uploads</div><div className="text-xl font-bold text-info">{docStats.total_documents}</div></div>
                  <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Total Storage</div><div className="text-xl font-bold text-emerald-500">{formatStorage(docStats.total_storage_bytes)}</div></div>
                  <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Categories</div><div className="text-xl font-bold">{docStats.categories?.length || 0}</div></div>
                  <div className="p-3 bg-card border border-border rounded-lg text-center"><div className="text-xs text-muted-foreground">Latest Uploads</div><div className="text-xl font-bold">{docStats.latest_uploads?.length || 0}</div></div>
                </div>
                {docStats.categories?.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <DonutChart data={docStats.categories.map(c => ({ name: c.category, value: c.count }))} title="Document Categories" dataKey="value" nameKey="name" />
                    <div className="p-4 bg-card border border-border rounded-xl">
                      <h4 className="text-sm font-semibold mb-4">Latest Uploads</h4>
                      <div className="space-y-2 max-h-[250px] overflow-y-auto">
                        {docStats.latest_uploads.slice(0, 8).map(d => (
                          <div key={d.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg text-sm">
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="truncate flex-1">{d.file_name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )

      case 'activity':
        return (
          <div className="space-y-4">
            <SectionHeader title="Activity Report" exportType="activity" filters={filters} />
            {activityLoading ? <LoadingState /> : !activityStats ? (
              <EmptyState title="No activity data available" />
            ) : (
              <>
                {activityStats.by_type?.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <DonutChart data={activityStats.by_type.map(a => ({ name: a.type.replace(/_/g, ' '), value: a.count }))} title="Activity by Type" dataKey="value" nameKey="name" />
                    <div className="p-4 bg-card border border-border rounded-xl">
                      <h4 className="text-sm font-semibold mb-4">Activity Breakdown</h4>
                      <div className="space-y-2">
                        {activityStats.by_type.slice(0, 10).map(a => (
                          <div key={a.type} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm">
                            <span className="capitalize">{a.type.replace(/_/g, ' ')}</span>
                            <span className="font-semibold">{a.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {activityStats.trend?.length > 0 && (
                  <div className="p-4 bg-card border border-border rounded-xl">
                    <h4 className="text-sm font-semibold mb-4">Activity Trend</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={activityStats.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
                        <Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={2} dot={{ r: 3 }} name="Activities" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Business insights powered by live data."
        breadcrumbs={[{ label: 'Reports' }]}
        action={<span className="print:hidden"><PrintButton /></span>}
      />

      <FilterBar filters={filters} onChange={setFilters} onClear={clearFilters} />

      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border overflow-x-auto print:overflow-visible">
          <nav className="flex gap-2 print:flex-wrap print:gap-1">
            {sections.map((section) => {
              const Icon = section.icon
              return (
                <button key={section.id} onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeSection === section.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}>
                  <Icon className="w-4 h-4" />{section.label}
                </button>
              )
            })}
          </nav>
        </div>
        <div className="p-6">
          {overviewLoading && activeSection === 'overview' ? (
            <LoadingState message="Loading overview..." />
          ) : (
            renderSection()
          )}
        </div>
      </div>
    </div>
  )
}
