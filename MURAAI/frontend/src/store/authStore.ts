import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/api/auth'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ user: null, isAuthenticated: false, isLoading: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
)

export function hasRole(user: { role?: string } | null, ...roles: string[]): boolean {
  if (!user) return false
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true
  return roles.length === 0 || roles.includes(user.role || '')
}
