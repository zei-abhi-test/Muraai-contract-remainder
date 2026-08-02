import { contractsApi, type DashboardData } from './contracts'

// Dashboard API - uses contracts dashboard endpoint
export const dashboardApi = {
  // Get dashboard data (uses contracts dashboard endpoint)
  getDashboard: async (): Promise<DashboardData> => {
    return contractsApi.getDashboard()
  },
}

export default dashboardApi
