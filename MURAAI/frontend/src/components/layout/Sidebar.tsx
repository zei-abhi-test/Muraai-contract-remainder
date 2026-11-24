import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Inbox,
  FileText,
  Users,
  Building2,
  Package,
  ShoppingCart,
  Receipt,
  RefreshCw,
  FolderOpen,
  BarChart3,
  CheckCircle,
  Settings,
  UserCog,
  FileSearch,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Menu,
  Layers,
  Zap,
  ClipboardList,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore, hasRole } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { memo } from 'react'
import { AppLogo } from './AppLogo'

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  allowedRoles?: readonly string[]
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Mission Control',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'activity-timeline', label: 'Activity Timeline', icon: Activity },
    ],
  },
  {
    label: 'Portfolio',
    items: [
      { id: 'contracts', label: 'Contracts', icon: FileText },
      { id: 'renewals', label: 'Renewals', icon: RefreshCw },
      { id: 'approvals', label: 'Approvals', icon: CheckCircle, allowedRoles: ['APPROVER', 'CONTRACT_MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'customers', label: 'Customers', icon: Building2, allowedRoles: ['CONTRACT_MANAGER', 'SALES', 'ADMIN', 'SUPER_ADMIN', 'VIEWER'] },
      { id: 'contacts', label: 'Contacts', icon: Users, allowedRoles: ['CONTRACT_MANAGER', 'SALES', 'ADMIN', 'SUPER_ADMIN', 'VIEWER'] },
      { id: 'products', label: 'Products', icon: Package, allowedRoles: ['FINANCE', 'CONTRACT_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'VIEWER'] },
      { id: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, allowedRoles: ['FINANCE', 'CONTRACT_MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
      { id: 'invoices', label: 'Invoices', icon: Receipt, allowedRoles: ['FINANCE', 'CONTRACT_MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
      { id: 'tasks', label: 'Tasks', icon: ClipboardList, allowedRoles: ['CONTRACT_MANAGER', 'FINANCE', 'APPROVER', 'LEGAL', 'SALES', 'ADMIN', 'SUPER_ADMIN', 'VIEWER'] },
    ],
  },
  {
    label: 'Documents',
    items: [
      { id: 'documents', label: 'Documents', icon: FolderOpen, allowedRoles: ['CONTRACT_MANAGER', 'FINANCE', 'LEGAL', 'ADMIN', 'SUPER_ADMIN'] },
    ],
  },
  {
    label: 'Reports & Analytics',
    items: [
      { id: 'reports', label: 'Reports', icon: BarChart3, allowedRoles: ['FINANCE', 'CONTRACT_MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'calendar', label: 'Calendar', icon: Calendar },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'workflows', label: 'Workflows', icon: Layers, allowedRoles: ['ADMIN', 'SUPER_ADMIN'] },
      { id: 'automation', label: 'Automation', icon: Zap, allowedRoles: ['ADMIN', 'SUPER_ADMIN'] },
      { id: 'settings', label: 'Settings', icon: Settings, allowedRoles: ['ADMIN', 'SUPER_ADMIN'] },
      { id: 'users', label: 'Users', icon: UserCog, allowedRoles: ['ADMIN', 'SUPER_ADMIN'] },
    ],
  },
]


function NavItemButton({ item, isActive, collapsed, onPageChange }: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
  onPageChange: (page: string) => void
}) {
  const Icon = item.icon

  return (
    <button
      onClick={() => onPageChange(item.id)}
      aria-current={isActive ? 'page' : undefined}
      aria-label={item.label}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg relative',
        'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'hover:bg-accent group',
        isActive ? 'text-primary bg-accent/50' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full" />
      )}
      <Icon className={cn(
        'w-[18px] h-[18px] flex-shrink-0',
        isActive ? 'text-primary' : ''
      )} aria-hidden="true" />
      {!collapsed && (
        <span className={cn(
          'text-sm',
          isActive ? 'font-medium' : ''
        )}>
          {item.label}
        </span>
      )}
    </button>
  )
}

export const Sidebar = memo(function Sidebar() {
  const { user } = useAuthStore()
  const { activePage, isSidebarCollapsed, toggleSidebar, setActivePage } = useUIStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  const initials = (user?.name || user?.username || 'U').charAt(0).toUpperCase()
  const displayName = user?.name || user?.username || 'User'
  const displayRole = user?.role || '—'

  const handleNavClick = (pageId: string) => {
    setActivePage(pageId)
    setMobileOpen(false)
  }

  const sidebarContent = (
    <>
      <div className={cn(
        'border-b border-border',
        isSidebarCollapsed ? 'p-3 flex justify-center' : 'p-4'
      )}>
        <AppLogo collapsed={isSidebarCollapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto" aria-label="Main navigation">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            item => !item.allowedRoles || hasRole(user, ...item.allowedRoles)
          )

          if (visibleItems.length === 0) return null

          return (
            <div key={group.label} className={cn(
              isSidebarCollapsed ? 'px-2 mt-3' : 'px-3 mt-4'
            )}>
              {!isSidebarCollapsed && (
                <div className="px-3 mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    {group.label}
                  </span>
                </div>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <NavItemButton
                    key={item.id}
                    item={item}
                    isActive={activePage === item.id}
                    collapsed={isSidebarCollapsed}
                    onPageChange={handleNavClick}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      <div className={cn(
        'border-t border-border',
        isSidebarCollapsed ? 'p-3' : 'p-4'
      )}>
        {isSidebarCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center" aria-hidden="true">
              <span className="text-primary font-medium text-sm">{initials}</span>
            </div>
            <button
              onClick={toggleSidebar}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <span className="text-primary font-medium text-sm">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{displayRole}</p>
              </div>
              <button
                onClick={toggleSidebar}
                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-accent transition-colors flex-shrink-0"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 bg-card border border-border rounded-lg shadow-lg"
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
      >
        <Menu className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="md:hidden fixed inset-0 bg-black/30 z-30"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={cn(
          'fixed left-0 top-0 h-screen bg-card border-r border-border',
          'flex flex-col z-40',
          'transition-all duration-300 ease-in-out',
          isSidebarCollapsed ? 'w-20' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
        aria-label="Sidebar navigation"
      >
        {sidebarContent}
      </motion.aside>
    </>
  )
})
