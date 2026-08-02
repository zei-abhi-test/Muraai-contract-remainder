import { useQuery } from '@tanstack/react-query'
import { reportsApi, type ReportFilters } from '@/api/reports'
import { queryKeys } from '@/lib/react-query'

type ReportType = keyof ReportTypeMap

function getReportQueryKey(reportType: string, filters?: ReportFilters) {
  const reports = queryKeys.reports
  switch (reportType) {
    case 'contracts': return reports.contracts(filters ?? {})
    case 'invoices': return reports.invoices(filters ?? {})
    case 'purchase-orders': return reports['purchase-orders'](filters ?? {})
    case 'renewals': return reports.renewals(filters ?? {})
    case 'customers': return reports.customers(filters ?? {})
    case 'products': return reports.products(filters ?? {})
    case 'revenue': return reports.revenue(filters ?? {})
    case 'approvals': return queryKeys.reports.approvals(filters ?? {})
    default: return [queryKeys.reports.all[0], reportType, filters ?? {}]
  }
}

export function useReport<T extends ReportType>(reportType: T, filters?: ReportFilters) {
  const queryKey = getReportQueryKey(reportType, filters)
  const apiCallMap: Record<string, (filters?: ReportFilters) => Promise<any>> = {
    contracts: reportsApi.getContracts,
    invoices: reportsApi.getInvoices,
    'purchase-orders': reportsApi.getPurchaseOrders,
    renewals: reportsApi.getRenewals,
    customers: reportsApi.getCustomers,
    products: reportsApi.getProducts,
    revenue: reportsApi.getRevenue,
    approvals: reportsApi.getApprovals,
  }
  const apiCall = apiCallMap[reportType]
  
  return useQuery<ReportTypeMap[T]>({
    queryKey,
    queryFn: () => apiCall?.(filters) ?? Promise.resolve([] as any),
  })
}

export function useCharts(filters?: ReportFilters) {
  return useQuery({
    queryKey: queryKeys.reports.charts(filters ?? {}),
    queryFn: () => reportsApi.getCharts(filters),
  })
}

export function useSummary() {
  return useQuery({
    queryKey: queryKeys.reports.summary(),
    queryFn: () => reportsApi.getSummary(),
  })
}

export function useStatistics() {
  return useQuery({
    queryKey: queryKeys.reports.statistics(),
    queryFn: () => reportsApi.getStatistics(),
  })
}

export function useDocumentStats() {
  return useQuery({
    queryKey: queryKeys.reports.documentStats(),
    queryFn: () => reportsApi.getDocumentStats(),
  })
}

export function useActivityStats(filters?: ReportFilters) {
  return useQuery({
    queryKey: queryKeys.reports.activityStats(filters),
    queryFn: () => reportsApi.getActivityStats(filters),
  })
}

export function useRenewalStats() {
  return useQuery({
    queryKey: queryKeys.reports.renewalStats(),
    queryFn: () => reportsApi.getRenewalStats(),
  })
}
