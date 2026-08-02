import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SavedFilter {
  id: string
  name: string
  page: string
  query: string
  statusFilter?: string
  sortField?: string
  sortDir?: 'asc' | 'desc'
  columnVisibility?: Record<string, boolean>
}

interface FilterStore {
  savedFilters: SavedFilter[]
  saveFilter: (filter: Omit<SavedFilter, 'id'>) => void
  deleteFilter: (id: string) => void
  renameFilter: (id: string, name: string) => void
}

export const useFilterStore = create<FilterStore>()(
  persist(
    (set) => ({
      savedFilters: [],
      saveFilter: (filter) =>
        set((state) => ({
          savedFilters: [
            ...state.savedFilters,
            { ...filter, id: crypto.randomUUID?.() || `${Date.now()}` },
          ],
        })),
      deleteFilter: (id) =>
        set((state) => ({
          savedFilters: state.savedFilters.filter((f) => f.id !== id),
        })),
      renameFilter: (id, name) =>
        set((state) => ({
          savedFilters: state.savedFilters.map((f) =>
            f.id === id ? { ...f, name } : f
          ),
        })),
    }),
    { name: 'muraai-saved-filters' }
  )
)
