import { useQuery } from '@tanstack/react-query'
import api from '@/api/axios'
import { queryKeys } from '@/lib/react-query'

export interface DashboardSummary {
  total_contracts: number
  active_contracts: number
  draft_contracts: number
  expired_contracts: number
  expiring_this_month: number
  pending_approvals: number
  renewals_due: number
  total_invoices: number
  invoices_due: number
  overdue_invoices: number
  outstanding_revenue: number
  total_purchase_orders: number
  po_pending: number
  po_completed: number
  po_cancelled: number
  total_documents: number
  total_customers: number
  total_products: number
  total_notifications: number
  unread_notifications: number
}

export interface ChartDataPoint {
  month: string
  count?: number
  revenue?: number
}

export interface InvoiceStatusItem {
  status: string
  count: number
}

export interface TopCustomer {
  id: number
  name: string
  contract_count: number
  total_value: number
}

export interface TopProduct {
  id: number
  name: string
  category: string | null
  usage_count: number
  total_revenue: number
}

export interface CalendarEvent {
  id: number
  type: string
  title: string
  date: string
}

export interface SystemHealth {
  database: boolean
  scheduler: boolean
  timestamp: string
}

export interface FullDashboardData {
  summary: DashboardSummary
  tasks: {
    contracts_expiring_today: number
    invoices_due_today: number
    pending_approvals: number
    missing_documents: number
    renewals_due_today: number
  }
  calendar_events: CalendarEvent[]
  recent_contracts: any[]
  recent_activity: any[]
  recent_documents: any[]
  contracts_by_status: Record<string, number>
  charts: {
    contracts_per_month: ChartDataPoint[]
    revenue_trend: ChartDataPoint[]
    invoice_status: InvoiceStatusItem[]
    renewal_trend: ChartDataPoint[]
    top_customers: TopCustomer[]
    po_trend: ChartDataPoint[]
    approval_trend: any[]
  }
  top_customers: TopCustomer[]
  top_products: TopProduct[]
  health: SystemHealth
}

export function useFullDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard.data(),
    queryFn: async () => {
      const response = await api.get('/dashboard/data')
      return response.data as FullDashboardData
    },
    refetchInterval: 60000,
  })
}
