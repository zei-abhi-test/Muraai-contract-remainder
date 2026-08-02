import { useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Sidebar } from './Sidebar'
import { TopNavigation } from './TopNavigation'
import { GlobalSearch } from '@/components/GlobalSearch'
import { QuickAddHost } from '@/components/QuickAddHost'
import { useUIStore } from '@/store/uiStore'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { isDarkMode, toggleDarkMode, isSidebarCollapsed, setActivePage } = useUIStore()
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [isDarkMode])

  const handleOpenSearch = useCallback(() => setGlobalSearchOpen(true), [])
  const handleCloseSearch = useCallback(() => setGlobalSearchOpen(false), [])

  const handleGlobalSearchNavigate = useCallback((page: string, itemId?: string) => {
    setGlobalSearchOpen(false)
    if (page === 'contract-workspace' && itemId) {
      setActivePage(page, { contractId: parseInt(itemId) })
    } else if (page === 'renewal-workspace' && itemId) {
      setActivePage(page, { renewalId: parseInt(itemId) })
    } else if (itemId) {
      setActivePage(page, { id: itemId })
    } else {
      setActivePage(page)
    }
  }, [setActivePage])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      setGlobalSearchOpen(true)
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault()
      useUIStore.getState().toggleSidebar()
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const marginLeft = isSidebarCollapsed ? 'ml-20' : 'ml-64'

  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-card focus:border focus:border-border focus:rounded-lg focus:text-sm focus:font-medium focus:outline-none focus:ring-2 focus:ring-ring">
        Skip to main content
      </a>
      <ErrorBoundary>
        <Sidebar />
        <TopNavigation
          isDarkMode={isDarkMode}
          onThemeToggle={toggleDarkMode}
          onOpenGlobalSearch={handleOpenSearch}
          sidebarCollapsed={isSidebarCollapsed}
        />
        <main
          id="main-content"
          className={`${marginLeft} pt-16 min-h-screen transition-all duration-300 ease-in-out`}
        >
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="mx-auto" style={{ maxWidth: 'var(--max-content-width, 1280px)' }}>
              {children}
            </div>
          </div>
        </main>
        <GlobalSearch
          isOpen={globalSearchOpen}
          onClose={handleCloseSearch}
          onNavigate={handleGlobalSearchNavigate}
        />
        <QuickAddHost />
      </ErrorBoundary>
    </div>
  )
}
