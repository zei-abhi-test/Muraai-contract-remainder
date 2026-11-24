import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, FileText, FileSpreadsheet, ShoppingCart, LogOut, Menu, X } from 'lucide-react'

import { useCustomerAuthStore } from '@/store/customerAuthStore'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const NAV_ITEMS = [
  { path: '/portal', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/portal/contracts', label: 'Contracts', icon: FileText },
  { path: '/portal/invoices', label: 'Invoices', icon: FileSpreadsheet },
  { path: '/portal/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
]

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const { customer, logout } = useCustomerAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768)

  const handleLogout = () => {
    logout()
    navigate('/portal/login')
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-56' : 'w-0 md:w-16'} transition-all duration-200 bg-card border-r border-border md:relative fixed z-40 h-screen md:h-auto overflow-hidden`}>
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-bold truncate">{sidebarOpen ? 'Customer Portal' : 'CP'}</h2>
        </div>
        <nav className="p-2 space-y-1" aria-label="Portal navigation">
          {NAV_ITEMS.map((item) => {
            const active = item.path === '/portal' ? location.pathname === '/portal' : location.pathname.startsWith(item.path)
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </button>
            )
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border">
          {sidebarOpen && (
            <div className="mb-2 px-3 text-xs text-muted-foreground truncate">{customer?.name}</div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-destructive rounded-lg hover:bg-accent transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/30 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Toggle button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-3 left-3 z-50 p-1.5 bg-card border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 pt-14 md:pt-6 max-w-5xl mx-auto w-full">
        <ErrorBoundary
          fallback={(error, reset) => (
            <div
              className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4"
              role="alert"
            >
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <span className="text-destructive text-xl" aria-hidden="true">⚠</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Something went wrong</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  This page encountered an error. Your other portal pages are unaffected.
                </p>
              </div>
              {error && (
                <details className="text-left w-full max-w-sm">
                  <summary className="text-xs font-medium text-muted-foreground cursor-pointer">
                    Error details
                  </summary>
                  <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-32">
                    {error.toString()}
                  </pre>
                </details>
              )}
              <div className="flex gap-3">
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
                  Reload page
                </button>
              </div>
            </div>
          )}
        >
          {children}
        </ErrorBoundary>
      </main>
    </div>
  )
}
