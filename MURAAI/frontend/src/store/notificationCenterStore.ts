import { create } from 'zustand'

export type NotificationFilter = 'all' | 'unread' | 'read'
export type NotificationView = 'inbox' | 'archived'

interface NotificationCenterState {
  search: string
  setSearch: (search: string) => void
  category: string
  setCategory: (category: string) => void
  filter: NotificationFilter
  setFilter: (filter: NotificationFilter) => void
  view: NotificationView
  setView: (view: NotificationView) => void
  selectedIds: Set<number>
  setSelectedIds: (ids: Set<number>) => void
  toggleSelection: (id: number) => void
  clearSelection: () => void
  offset: number
  setOffset: (offset: number) => void
  resetOffset: () => void
}

export const useNotificationCenterStore = create<NotificationCenterState>((set) => ({
  search: '',
  setSearch: (search) => set({ search, offset: 0 }),
  category: 'all',
  setCategory: (category) => set({ category, offset: 0 }),
  filter: 'all',
  setFilter: (filter) => set({ filter, offset: 0 }),
  view: 'inbox',
  setView: (view) => set({ view, offset: 0, selectedIds: new Set() }),
  selectedIds: new Set(),
  setSelectedIds: (selectedIds) => set({ selectedIds }),
  toggleSelection: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedIds: next }
    }),
  clearSelection: () => set({ selectedIds: new Set() }),
  offset: 0,
  setOffset: (offset) => set({ offset }),
  resetOffset: () => set({ offset: 0 }),
}))
