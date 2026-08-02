import { create } from 'zustand'

export type QuickAddEntity = 'contract' | 'customer' | 'contact' | 'product' | 'purchase-order' | 'invoice'

interface QuickAddState {
  activeEntity: QuickAddEntity | null
  open: (entity: QuickAddEntity) => void
  close: () => void
}

/**
 * Global "Quick Add" state. The TopNavigation Quick Add button and the
 * Dashboard Quick Actions both call `open(entity)`, which is rendered by a
 * single <QuickAddHost/> mounted once at the app root. This guarantees there
 * is exactly one create flow per entity - no duplicate forms.
 */
export const useQuickAddStore = create<QuickAddState>((set) => ({
  activeEntity: null,
  open: (entity) => set({ activeEntity: entity }),
  close: () => set({ activeEntity: null }),
}))
