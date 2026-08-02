import api from './axios'
import type { Contract } from './contracts'
import type { Invoice } from './invoices'
import type { PurchaseOrder } from './purchaseOrders'
import type { Customer } from './customers'
import type { Product } from './products'

export interface ReportFilters {
  start_date?: string
  end_date?: string
  status?: string
  customer_id?: number
  contract_type_id?: number
  search?: string
}

export interface MonthCount {
  month: string
  count: number
}

export interface MonthRevenue {
  month: string
  revenue: number
}

export interface StatusCount {
  status: string
  count: number
}

export interface TypeCount {
  name: string
  count: number
}

export interface TopCustomer {
  id: number
  name: string
  contract_count: number
  total_value: number
}

export interface ChartsData {
  contracts_per_month: MonthCount[]
  revenue_trend: MonthRevenue[]
  invoice_status: StatusCount[]
  renewal_trend: MonthCount[]
  contract_types: TypeCount[]
  top_customers: TopCustomer[]
}

export interface SummaryData {
  total_contracts: number
  active_contracts: number
  expiring_soon: number
  total_customers: number
  total_invoices: number
  total_revenue: number
}

export interface ApprovalStats {
  pending: number
  approved: number
  rejected: number
  cancelled: number
  avg_approval_time_hours: number
}

export interface StatisticsData {
  contracts_by_status: Record<string, number>
  overdue_invoices: number
  upcoming_renewals: number
  monthly_revenue: MonthRevenue[]
  current_month_revenue: number
  prev_month_revenue: number
  approvals: ApprovalStats
}

export interface RevenueData {
  total_revenue: number
  total_line_items: number
}

export interface CustomerWithContracts extends Customer {
  contracts: Contract[]
  total_contract_value: number
}

export interface ProductWithUsage extends Product {
  contract_count: number
}

export interface DocumentStat {
  total_documents: number
  total_storage_bytes: number
  categories: { category: string; count: number }[]
  latest_uploads: any[]
}

export interface ActivityStat {
  by_type: { type: string; count: number }[]
  trend: { month: string; count: number }[]
}

export interface RenewalStat {
  total_renewed: number
  upcoming_renewals: number
  missed_renewals: number
  active_contracts: number
  success_rate: number
  avg_approval_time_hours: number
}

export const reportsApi = {
  getContracts: (filters?: ReportFilters): Promise<Contract[]> =>
    api.get('/reports/contracts', { params: filters }).then(r => r.data as Contract[]),

  getInvoices: (filters?: ReportFilters): Promise<Invoice[]> =>
    api.get('/reports/invoices', { params: filters }).then(r => r.data as Invoice[]),

  getPurchaseOrders: (filters?: ReportFilters): Promise<PurchaseOrder[]> =>
    api.get('/reports/purchase-orders', { params: filters }).then(r => r.data as PurchaseOrder[]),

  getRenewals: (filters?: ReportFilters): Promise<Contract[]> =>
    api.get('/reports/renewals', { params: filters }).then(r => r.data as Contract[]),

  getCustomers: (filters?: ReportFilters): Promise<CustomerWithContracts[]> =>
    api.get('/reports/customers', { params: filters }).then(r => r.data as CustomerWithContracts[]),

  getProducts: (filters?: ReportFilters): Promise<ProductWithUsage[]> =>
    api.get('/reports/products', { params: filters }).then(r => r.data as ProductWithUsage[]),

  getRevenue: (filters?: ReportFilters): Promise<RevenueData> =>
    api.get('/reports/revenue', { params: filters }).then(r => r.data as RevenueData),

  getCharts: (filters?: ReportFilters): Promise<ChartsData> =>
    api.get('/reports/charts', { params: filters }).then(r => r.data as ChartsData),

  getSummary: (): Promise<SummaryData> =>
    api.get('/reports/summary').then(r => r.data as SummaryData),

  getStatistics: (): Promise<StatisticsData> =>
    api.get('/reports/statistics').then(r => r.data as StatisticsData),

  getApprovals: (filters?: ReportFilters): Promise<any[]> =>
    api.get('/reports/approvals', { params: filters }).then(r => r.data as any[]),

  getDocumentStats: (): Promise<DocumentStat> =>
    api.get('/reports/documents-stats').then(r => r.data as DocumentStat),

  getActivityStats: (filters?: ReportFilters): Promise<ActivityStat> =>
    api.get('/reports/activity-stats', { params: filters }).then(r => r.data as ActivityStat),

  getRenewalStats: (): Promise<RenewalStat> =>
    api.get('/reports/renewal-stats').then(r => r.data as RenewalStat),

  exportCSV: (type: string, filters?: ReportFilters): Promise<Blob> =>
    api.get('/reports/export', {
      params: { type, format: 'csv', ...filters },
      responseType: 'blob',
    }).then(r => r.data as Blob),
}

export default reportsApi
