import { useState, useRef, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Moon, Sun, ChevronDown, LogOut, FileText, Building2, Users, Package, ShoppingCart, Receipt, Settings, User } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useQuickAddStore } from '@/store/quickAddStore'
import { useLogout } from '@/hooks/useAuth'
import { useUIStore } from '@/store/uiStore'
import type { QuickAddEntity } from '@/store/quickAddStore'
import { dropdownIn } from '@/lib/motion-utils'
import { NotificationBell, NotificationPanel } from '@/components/notifications'
import { useUnreadCount } from '@/hooks/useActivity'

interface TopNavigationProps {
  onThemeToggle: () => void
  isDarkMode: boolean
  onOpenGlobalSearch: () => void
  sidebarCollapsed: boolean
}

const quickAddItems: { entity: QuickAddEntity; label: string; icon: any }[] = [
  { entity: 'contract', label: 'New Contract', icon: FileText },
  { entity: 'customer', label: 'New Customer', icon: Building2 },
  { entity: 'contact', label: 'New Contact', icon: Users },
  { entity: 'product', label: 'New Product', icon: Package },
  { entity: 'purchase-order', label: 'New Purchase Order', icon: ShoppingCart },
  { entity: 'invoice', label: 'New Invoice', icon: Receipt },
]

export const TopNavigation = memo(function TopNavigation({ onThemeToggle, isDarkMode, onOpenGlobalSearch, sidebarCollapsed }: TopNavigationProps) {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [notifPanelOpen, setNotifPanelOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const quickAddRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const { user } = useAuthStore()
  const { mutate: logout } = useLogout()
  const openQuickAdd = useQuickAddStore((state) => state.open)
  const setActivePage = useUIStore((state) => state.setActivePage)

  const { data: unreadCount = 0 } = useUnreadCount()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) setQuickAddOpen(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !notifPanelOpen) { setQuickAddOpen(false); setUserMenuOpen(false) }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey) }
  }, [notifPanelOpen])

  const handleLogout = () => logout()

  const handleQuickAddItem = (entity: QuickAddEntity) => {
    setQuickAddOpen(false)
    openQuickAdd(entity)
  }

  const leftOffset = sidebarCollapsed ? 'left-20' : 'left-64'

  return (
    <header
      className={`fixed top-0 ${leftOffset} right-0 h-16 bg-card/80 backdrop-blur-lg border-b border-border z-30 transition-all duration-300 ease-in-out`}
    >
      <div className="h-full px-6 flex items-center justify-between gap-4">
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search... (Ctrl+K)"
              className="w-full pl-10 pr-3 py-2 bg-secondary/50 border border-transparent rounded-lg text-sm focus:outline-none focus:bg-background focus:border-input focus:ring-0 transition-colors hover:bg-secondary/80 cursor-pointer"
              onClick={onOpenGlobalSearch}
              readOnly
              aria-label="Open global search"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative" ref={quickAddRef}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setQuickAddOpen(!quickAddOpen)}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-haspopup="true"
              aria-expanded={quickAddOpen}
              aria-label="Quick add"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span>
            </motion.button>

            <AnimatePresence>
              {quickAddOpen && (
                <motion.div
                  key="quick-add-dropdown"
                  variants={dropdownIn}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl z-50 py-1 min-w-[200px]"
                  role="menu"
                  aria-label="Quick add options"
                >
                  {quickAddItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.entity}
                        onClick={() => handleQuickAddItem(item.entity)}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors text-left focus-visible:outline-none focus-visible:bg-accent"
                        role="menuitem"
                      >
                        <Icon className="w-4 h-4 text-primary" />
                        {item.label}
                      </button>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onThemeToggle}
            className="p-2 hover:bg-accent rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </motion.button>

          <NotificationBell
            unreadCount={unreadCount}
            isOpen={notifPanelOpen}
            onClick={() => setNotifPanelOpen(true)}
          />
          <NotificationPanel
            isOpen={notifPanelOpen}
            onClose={() => setNotifPanelOpen(false)}
          />

          <div className="relative pl-3 ml-1.5 border-l border-border" ref={userMenuRef}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1.5 hover:bg-accent rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-haspopup="true"
              aria-expanded={userMenuOpen}
              aria-label="User menu"
            >
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold text-xs">
                  {(user?.name || user?.username || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-sm font-medium">{user?.name || user?.username || 'User'}</div>
                <div className="text-[10px] text-muted-foreground">{user?.role || '—'}</div>
              </div>
              <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-muted-foreground" />
            </motion.button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  key="user-menu-dropdown"
                  variants={dropdownIn}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl z-50 py-1 min-w-[180px]"
                  role="menu"
                  aria-label="User options"
                >
                  <div className="px-4 py-2.5 border-b border-border">
                    <div className="text-sm font-medium">{user?.name || user?.username || 'User'}</div>
                    <div className="text-xs text-muted-foreground">{user?.email || ''}</div>
                  </div>
                  <button
                    onClick={() => { setUserMenuOpen(false); setActivePage('settings'); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors text-left focus-visible:outline-none focus-visible:bg-accent"
                    role="menuitem"
                  >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors text-left text-destructive focus-visible:outline-none focus-visible:bg-accent"
                    role="menuitem"
                  >
                    <LogOut className="w-4 h-4" />
                    Log out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  )
})
