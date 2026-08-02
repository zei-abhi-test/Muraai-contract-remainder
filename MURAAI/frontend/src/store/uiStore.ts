import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  isDarkMode: boolean
  isSidebarCollapsed: boolean
  activePage: string
  pageParams: Record<string, any>
  toggleDarkMode: () => void
  toggleSidebar: () => void
  setActivePage: (page: string, params?: Record<string, any>) => void
  setDarkMode: (isDark: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isDarkMode: false,
      isSidebarCollapsed: false,
      activePage: 'dashboard',
      pageParams: {},
      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setActivePage: (page, params) => set({ activePage: page, pageParams: params || {} }),
      setDarkMode: (isDarkMode) => set({ isDarkMode: isDarkMode }),
    }),
    {
      name: 'ui-storage',
    }
  )
)
