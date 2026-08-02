import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PortalCustomer } from '@/api/customerPortal'

interface CustomerAuthState {
  customer: PortalCustomer | null
  token: string | null
  isAuthenticated: boolean
  setCustomer: (customer: PortalCustomer, token: string) => void
  logout: () => void
}

export const useCustomerAuthStore = create<CustomerAuthState>()(
  persist(
    (set) => ({
      customer: null,
      token: null,
      isAuthenticated: false,

      setCustomer: (customer, token) => {
        localStorage.setItem('customer_token', token)
        set({ customer, token, isAuthenticated: true })
      },

      logout: () => {
        localStorage.removeItem('customer_token')
        set({ customer: null, token: null, isAuthenticated: false })
      },
    }),
    {
      name: 'customer-auth-storage',
      partialize: (state) => ({
        customer: state.customer,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
