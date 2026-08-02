import { memo } from 'react'
import { ChevronRight, Home } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'

interface BreadcrumbItem {
  label: string
  page?: string
  params?: Record<string, any>
}

export const Breadcrumbs = memo(function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const setActivePage = useUIStore((state) => state.setActivePage)

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      <button
        onClick={() => setActivePage('dashboard')}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        aria-label="Dashboard"
      >
        <Home className="w-3.5 h-3.5" />
      </button>
      {items.map((item, i) => (
        <span key={item.page ? `${item.page}-${i}` : `${item.label}-${i}`} className="flex items-center gap-1">
          <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
          {item.page ? (
            <button
              onClick={() => setActivePage(item.page!, item.params)}
              className="hover:text-foreground transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
})
