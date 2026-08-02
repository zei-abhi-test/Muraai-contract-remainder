import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/api/dashboard'
import { queryKeys } from '@/lib/react-query'

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard.metrics(),
    queryFn: dashboardApi.getDashboard,
  })
}

export function useDashboardMetrics() {
  return useDashboard()
}

export function useRecentContracts() {
  const { data } = useDashboard()
  return {
    data: data?.active_contracts?.slice(0, 5) || [],
    isLoading: false,
  }
}

export function useUpcomingRenewals() {
  const { data } = useDashboard()
  return {
    data: data?.upcoming_renewals || [],
    isLoading: false,
  }
}

export function useRecentActivity() {
  return {
    data: [], // Backend doesn't provide activity feed
    isLoading: false,
  }
}
