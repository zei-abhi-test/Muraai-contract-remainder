import { useEffect, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AppShell } from './components/layout/AppShell'
import { PortalLayout } from './components/portal/PortalLayout'
import { queryClient } from './lib/react-query'
import { useAuthStore } from './store/authStore'
import { useCustomerAuthStore } from './store/customerAuthStore'
import { useUIStore } from './store/uiStore'
import { useCurrentUser } from './hooks/useAuth'
import { getAccessToken } from './api/axios'
import { ErrorBoundary } from './components/ErrorBoundary'

const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const ContractsPage = lazy(() => import('./pages/ContractsPage').then(m => ({ default: m.ContractsPage })))
const ContractWorkspace = lazy(() => import('./components/contracts/ContractWorkspace').then(m => ({ default: m.ContractWorkspace })))
const CustomersPage = lazy(() => import('./pages/CustomersPage').then(m => ({ default: m.CustomersPage })))
const ProductsPage = lazy(() => import('./pages/ProductsPage').then(m => ({ default: m.ProductsPage })))
const PurchaseOrdersPage = lazy(() => import('./pages/PurchaseOrdersPage').then(m => ({ default: m.PurchaseOrdersPage })))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage').then(m => ({ default: m.DocumentsPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })))
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage').then(m => ({ default: m.ApprovalsPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const UsersPage = lazy(() => import('./pages/UsersPage').then(m => ({ default: m.UsersPage })))
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })))
const ContactsPage = lazy(() => import('./pages/ContactsPage').then(m => ({ default: m.ContactsPage })))
const InvoicesPage = lazy(() => import('./pages/InvoicesPage').then(m => ({ default: m.InvoicesPage })))
const RenewalsPage = lazy(() => import('./pages/RenewalsPage').then(m => ({ default: m.RenewalsPage })))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })))
const CalendarPage = lazy(() => import('./pages/CalendarPage').then(m => ({ default: m.CalendarPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })))
const PortalLoginPage = lazy(() => import('./pages/portal/PortalLoginPage').then(m => ({ default: m.PortalLoginPage })))
const PortalDashboard = lazy(() => import('./pages/portal/PortalDashboard').then(m => ({ default: m.PortalDashboard })))
const PortalContracts = lazy(() => import('./pages/portal/PortalContracts').then(m => ({ default: m.PortalContracts })))
const PortalContractDetail = lazy(() => import('./pages/portal/PortalContractDetail').then(m => ({ default: m.PortalContractDetail })))
const PortalInvoices = lazy(() => import('./pages/portal/PortalInvoices').then(m => ({ default: m.PortalInvoices })))
const PortalPurchaseOrders = lazy(() => import('./pages/portal/PortalPurchaseOrders').then(m => ({ default: m.PortalPurchaseOrders })))
const OperationalInboxPage = lazy(() => import('./pages/OperationalInboxPage').then(m => ({ default: m.OperationalInboxPage })))
const RenewalWorkspace = lazy(() => import('./components/renewals/RenewalWorkspace').then(m => ({ default: m.RenewalWorkspace })))
const TimelinePage = lazy(() => import('./components/timeline/TimelinePage').then(m => ({ default: m.TimelinePage })))
const TaskPage = lazy(() => import('./pages/TaskPage').then(m => ({ default: m.TaskPage })))
const WorkflowBuilderPage = lazy(() => import('./pages/WorkflowBuilderPage').then(m => ({ default: m.WorkflowBuilderPage })))
const AutomationRulePage = lazy(() => import('./pages/AutomationRulePage').then(m => ({ default: m.AutomationRulePage })))

/** Error fallback used on auth pages (no app chrome) */
function AuthErrorFallback({ error, reset }: { error: Error | null; reset: () => void }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" role="alert">
      <div className="bg-card border border-border rounded-xl p-8 max-w-sm w-full text-center shadow-lg">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-destructive text-xl" aria-hidden="true">⚠</span>
        </div>
        <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm text-muted-foreground mb-6">
          This page encountered an unexpected error.
        </p>
        {error && (
          <details className="text-left mb-4">
            <summary className="text-xs font-medium text-muted-foreground cursor-pointer">
              Error details
            </summary>
            <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-28">
              {error.toString()}
            </pre>
          </details>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 border border-input rounded-lg text-sm hover:bg-accent"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  )
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const hasToken = !!getAccessToken()
  
  if (hasToken) {
    return <Navigate to="/" replace />
  }
  
  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  const { data: user, isLoading: isUserLoading } = useCurrentUser()
  const hasToken = !!getAccessToken()

  // Show loading only on initial load (when we have a token but no user data yet)
  if (hasToken && !isAuthenticated && !user && isUserLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    )
  }

  // If no token, redirect to login
  if (!hasToken) {
    return <Navigate to="/login" replace />
  }

  // If we have a token and are authenticated (or have user data), allow access
  return <>{children}</>
}

function CustomerProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useCustomerAuthStore()
  const customerToken = localStorage.getItem('customer_token')

  if (!customerToken) {
    return <Navigate to="/portal/login" replace />
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function AppContent() {
  const { activePage, setActivePage } = useUIStore()
  const { setUser, setLoading } = useAuthStore()
  const { data: user, isLoading } = useCurrentUser()

  useEffect(() => {
    if (!isLoading) {
      setUser(user || null)
      setLoading(false)
    }
  }, [user, isLoading, setUser, setLoading])

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />
      case 'contracts':
        return <ContractsPage />
      case 'contract-workspace':
        return <ContractWorkspace />
      case 'customers':
        return <CustomersPage />
      case 'contacts':
        return <ContactsPage />
      case 'products':
        return <ProductsPage />
      case 'purchase-orders':
        return <PurchaseOrdersPage />
      case 'invoices':
        return <InvoicesPage />
      case 'renewals':
        return <RenewalsPage />
      case 'renewal-workspace':
        return <RenewalWorkspace />
      case 'documents':
        return <DocumentsPage />
      case 'reports':
        return <ReportsPage />
      case 'approvals':
        return <ApprovalsPage />
      case 'notifications':
        return <NotificationsPage />
      case 'settings':
        return <SettingsPage />
      case 'users':
        return <UsersPage />
      case 'calendar':
        return <CalendarPage />
      case 'activity-timeline':
        return <TimelinePage />

      case 'tasks':
        return <TaskPage />
      case 'workflows':
        return <WorkflowBuilderPage />
      case 'automation':
        return <AutomationRulePage />
      default:
        return <Dashboard />
    }
  }

  return (
    <AppShell>
      <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </Suspense>
    </AppShell>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={
            <ErrorBoundary fallback={(error, reset) => <AuthErrorFallback error={error} reset={reset} />}>
              <Suspense fallback={null}><PublicRoute><LoginPage /></PublicRoute></Suspense>
            </ErrorBoundary>
          } />
          <Route path="/register" element={
            <ErrorBoundary fallback={(error, reset) => <AuthErrorFallback error={error} reset={reset} />}>
              <Suspense fallback={null}><PublicRoute><RegisterPage /></PublicRoute></Suspense>
            </ErrorBoundary>
          } />
          <Route path="/portal/login" element={
            <ErrorBoundary fallback={(error, reset) => <AuthErrorFallback error={error} reset={reset} />}>
              <Suspense fallback={null}><PublicRoute><PortalLoginPage /></PublicRoute></Suspense>
            </ErrorBoundary>
          } />
          <Route
            path="/portal"
            element={
              <Suspense fallback={null}>
                <CustomerProtectedRoute>
                  <PortalLayout><PortalDashboard /></PortalLayout>
                </CustomerProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/portal/contracts"
            element={
              <Suspense fallback={null}>
                <CustomerProtectedRoute>
                  <PortalLayout><PortalContracts /></PortalLayout>
                </CustomerProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/portal/contracts/:contractId"
            element={
              <Suspense fallback={null}>
                <CustomerProtectedRoute>
                  <PortalLayout><PortalContractDetail /></PortalLayout>
                </CustomerProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/portal/invoices"
            element={
              <Suspense fallback={null}>
                <CustomerProtectedRoute>
                  <PortalLayout><PortalInvoices /></PortalLayout>
                </CustomerProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/portal/purchase-orders"
            element={
              <Suspense fallback={null}>
                <CustomerProtectedRoute>
                  <PortalLayout><PortalPurchaseOrders /></PortalLayout>
                </CustomerProtectedRoute>
              </Suspense>
            }
          />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppContent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App

