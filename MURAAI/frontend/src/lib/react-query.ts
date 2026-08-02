import { QueryClient } from '@tanstack/react-query'

// Create QueryClient with production-ready configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Refetch on window focus - disabled for better UX
      refetchOnWindowFocus: false,
      
      // Retry failed requests
      retry: 1,
      
      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Time to consider data stale
      staleTime: 5 * 60 * 1000, // 5 minutes
      
      // Time to keep unused data in cache
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      
      // Throw error on fetch failure
      throwOnError: false,
    },
    mutations: {
      // Retry failed mutations
      retry: 0,
      
      // Mutation errors must be handled locally (via onError/try-catch),
      // not thrown during render. Throwing here propagates to the nearest
      // React ErrorBoundary and blanks the whole screen on any 4xx/5xx
      // mutation response (e.g. contract validation errors).
      throwOnError: false,
    },
  },
})

// Query key factories for consistent cache keys
export const queryKeys = {
  // Auth
  auth: {
    all: ['auth'] as const,
    user: () => ['auth', 'user'] as const,
    profile: () => ['auth', 'profile'] as const,
  },
  
  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    metrics: () => ['dashboard', 'metrics'] as const,
    data: () => ['dashboard', 'data'] as const,
    recentActivity: (limit?: number) => ['dashboard', 'recent-activity', limit] as const,
    recentContracts: (limit?: number) => ['dashboard', 'recent-contracts', limit] as const,
    upcomingRenewals: (days?: number) => ['dashboard', 'upcoming-renewals', days] as const,
    approvalSummary: () => ['dashboard', 'approval-summary'] as const,
    revenueChart: (months?: number) => ['dashboard', 'revenue-chart', months] as const,
    contractStatusDistribution: () => ['dashboard', 'contract-status-distribution'] as const,
    customerDistribution: (limit?: number) => ['dashboard', 'customer-distribution', limit] as const,
  },
  
  // Contracts
  contracts: {
    all: ['contracts'] as const,
    lists: () => ['contracts', 'list'] as const,
    list: (filters: any) => ['contracts', 'list', filters] as const,
    details: () => ['contracts', 'detail'] as const,
    detail: (id: number) => ['contracts', 'detail', id] as const,
    history: (id: number) => ['contracts', 'detail', id, 'history'] as const,
    approvals: (id: number) => ['contracts', 'detail', id, 'approvals'] as const,
    documents: (id: number) => ['contracts', 'detail', id, 'documents'] as const,
    lineItems: (id: number) => ['contracts', 'detail', id, 'line-items'] as const,
    renewalHistory: (id: number) => ['contracts', 'detail', id, 'renewal-history'] as const,
    assistance: (id: number) => ['contracts', 'detail', id, 'assistance'] as const,
  },
  
  // Customers
  customers: {
    all: ['customers'] as const,
    lists: () => ['customers', 'list'] as const,
    list: (filters: any) => ['customers', 'list', filters] as const,
    details: () => ['customers', 'detail'] as const,
    detail: (id: number) => ['customers', 'detail', id] as const,
    contracts: (id: number) => ['customers', 'detail', id, 'contracts'] as const,
    contacts: (id: number) => ['customers', 'detail', id, 'contacts'] as const,
    invoices: (id: number) => ['customers', 'detail', id, 'invoices'] as const,
    pos: (id: number) => ['customers', 'detail', id, 'purchase-orders'] as const,
    analytics: (id: number) => ['customers', 'detail', id, 'analytics'] as const,
    search: (query: string) => ['customers', 'search', query] as const,
  },
  
  // Contacts
  contacts: {
    all: ['contacts'] as const,
    lists: () => ['contacts', 'list'] as const,
    list: (filters: any) => ['contacts', 'list', filters] as const,
    details: () => ['contacts', 'detail'] as const,
    detail: (id: string) => ['contacts', 'detail', id] as const,
    byCustomer: (customerId: number) => ['contacts', 'customer', customerId] as const,
    search: (query: string, customerId?: string) => ['contacts', 'search', query, customerId] as const,
  },
  
  // Products
  products: {
    all: ['products'] as const,
    lists: () => ['products', 'list'] as const,
    list: (filters: any) => ['products', 'list', filters] as const,
    details: () => ['products', 'detail'] as const,
    detail: (id: number) => ['products', 'detail', id] as const,
    byCode: (code: string) => ['products', 'by-code', code] as const,
    categories: () => ['products', 'categories'] as const,
    search: (query: string) => ['products', 'search', query] as const,
  },
  
  // Documents
  documents: {
    all: ['documents'] as const,
    lists: () => ['documents', 'list'] as const,
    list: (filters: any) => ['documents', 'list', filters] as const,
    details: () => ['documents', 'detail'] as const,
    detail: (id: number) => ['documents', 'detail', id] as const,
    preview: (id: number) => ['documents', 'detail', id, 'preview'] as const,
    ocrData: (id: number) => ['documents', 'detail', id, 'ocr-data'] as const,
    versions: (id: number) => ['documents', 'detail', id, 'versions'] as const,
  },
  
  // Reports
  reports: {
    all: ['reports'] as const,
    overview: (data: any) => ['reports', 'overview', data] as const,
    revenue: (data: any) => ['reports', 'revenue', data] as const,
    contracts: (data: any) => ['reports', 'contracts', data] as const,
    customers: (data: any) => ['reports', 'customers', data] as const,
    products: (data: any) => ['reports', 'products', data] as const,
    renewals: (data: any) => ['reports', 'renewals', data] as const,
    invoices: (data: any) => ['reports', 'invoices', data] as const,
    'purchase-orders': (data: any) => ['reports', 'purchase-orders', data] as const,
    approvals: (data: any) => ['reports', 'approvals', data] as const,
    charts: (data: any) => ['reports', 'charts', data] as const,
    summary: () => ['reports', 'summary'] as const,
    statistics: () => ['reports', 'statistics'] as const,
    documentStats: () => ['reports', 'documents-stats'] as const,
    activityStats: (filters?: any) => ['reports', 'activity-stats', filters ?? {}] as const,
    renewalStats: () => ['reports', 'renewal-stats'] as const,
  },
  
  // Approvals
  approvals: {
    all: ['approvals'] as const,
    lists: () => ['approvals', 'list'] as const,
    list: (filters: any) => ['approvals', 'list', filters] as const,
    details: () => ['approvals', 'detail'] as const,
    detail: (id: string) => ['approvals', 'detail', id] as const,
    myPending: () => ['approvals', 'my-pending'] as const,
    stages: () => ['approvals', 'stages'] as const,
  },
  
  // Notifications
  notifications: {
    all: ['notifications'] as const,
    lists: () => ['notifications', 'list'] as const,
    list: (filters: any) => ['notifications', 'list', filters] as const,
    details: () => ['notifications', 'detail'] as const,
    detail: (id: string) => ['notifications', 'detail', id] as const,
    unreadCount: () => ['notifications', 'unread-count'] as const,
    recent: (limit?: number) => ['notifications', 'recent', limit] as const,
    history: (contractId: number) => ['notifications', 'history', contractId] as const,
  },
  
  // Search
  search: {
    all: ['search'] as const,
    global: (query: string) => ['search', 'global', query] as const,
  },
  
  // Purchase Orders
  purchaseOrders: {
    all: ['purchase-orders'] as const,
    lists: () => ['purchase-orders', 'list'] as const,
    list: (filters: any) => ['purchase-orders', 'list', filters] as const,
    details: () => ['purchase-orders', 'detail'] as const,
    detail: (id: string) => ['purchase-orders', 'detail', id] as const,
  },
  
  // Users
  users: {
    all: ['users'] as const,
    lists: () => ['users', 'list'] as const,
    list: (filters?: any) => ['users', 'list', filters] as const,
    details: () => ['users', 'detail'] as const,
    detail: (id: number) => ['users', 'detail', id] as const,
  },

  // Contract Types
  contractTypes: {
    all: ['contract-types'] as const,
    lists: () => ['contract-types', 'list'] as const,
    list: (filters?: any) => ['contract-types', 'list', filters] as const,
    details: () => ['contract-types', 'detail'] as const,
    detail: (id: number) => ['contract-types', 'detail', id] as const,
  },

  // Settings
  settings: {
    all: ['settings'] as const,
    profile: () => ['settings', 'profile'] as const,
    organization: () => ['settings', 'organization'] as const,
    preferences: () => ['settings', 'preferences'] as const,
    integrations: () => ['settings', 'integrations'] as const,
    roles: () => ['settings', 'roles'] as const,
    usersWithRoles: () => ['settings', 'users-with-roles'] as const,
    system: () => ['settings', 'system'] as const,
    sessions: () => ['settings', 'sessions'] as const,
    loginHistory: (page?: number) => ['settings', 'login-history', page] as const,
  },

  // Calendar
  calendar: {
    all: ['calendar'] as const,
    events: (filters: any) => ['calendar', 'events', filters] as const,
    tasks: (filters?: any) => ['calendar', 'tasks', filters] as const,
    reminderConfigs: ['calendar', 'reminder-configs'] as const,
    filterOptions: ['calendar', 'filter-options'] as const,
    userEvents: ['calendar', 'user-events'] as const,
  },

  // Microsoft
  microsoft: {
    all: ['microsoft'] as const,
    status: () => ['microsoft', 'status'] as const,
    onedrive: {
      all: () => ['microsoft', 'onedrive'] as const,
      files: (folder?: string) => ['microsoft', 'onedrive', 'files', folder] as const,
    },
    teams: {
      all: () => ['microsoft', 'teams'] as const,
      list: () => ['microsoft', 'teams', 'list'] as const,
      channels: (teamId: string) => ['microsoft', 'teams', teamId, 'channels'] as const,
    },
    entra: {
      all: () => ['microsoft', 'entra'] as const,
      users: (filter?: string) => ['microsoft', 'entra', 'users', filter] as const,
      user: (userId: string) => ['microsoft', 'entra', 'users', userId] as const,
      groupMembers: (groupId: string) => ['microsoft', 'entra', 'groups', groupId, 'members'] as const,
    },
  },

  // Invoices
  invoices: {
    all: ['invoices'] as const,
    lists: () => ['invoices', 'list'] as const,
    list: (filters: any) => ['invoices', 'list', filters] as const,
    details: () => ['invoices', 'detail'] as const,
    detail: (id: string) => ['invoices', 'detail', id] as const,
    payments: (id: string) => ['invoices', 'detail', id, 'payments'] as const,
  },
  workflows: {
    all: ['workflows'] as const,
    lists: () => ['workflows', 'list'] as const,
    list: (params?: any) => ['workflows', 'list', params] as const,
    details: () => ['workflows', 'detail'] as const,
    detail: (id: number) => ['workflows', 'detail', id] as const,
    meta: ['workflows', 'meta'] as const,
    assignments: (params?: any) => ['workflows', 'assignments', params] as const,
    assignment: (id: number) => ['workflows', 'assignments', id] as const,
  },
  automation: {
    all: ['automation'] as const,
    lists: () => ['automation', 'list'] as const,
    list: (params?: any) => ['automation', 'list', params] as const,
    details: () => ['automation', 'detail'] as const,
    detail: (id: number) => ['automation', 'detail', id] as const,
    meta: ['automation', 'meta'] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    lists: () => ['tasks', 'list'] as const,
    list: (filters?: any) => ['tasks', 'list', filters] as const,
    details: () => ['tasks', 'detail'] as const,
    detail: (id: number) => ['tasks', 'detail', id] as const,
    stats: ['tasks', 'stats'] as const,
  },
}

// Helper function to invalidate related queries
export const invalidateQueries = (queryClient: QueryClient, keys: any[]) => {
  keys.forEach(key => {
    queryClient.invalidateQueries({ queryKey: key })
  })
}
