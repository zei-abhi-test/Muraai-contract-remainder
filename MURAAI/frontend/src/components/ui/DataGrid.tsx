import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface DataGridProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  keyExtractor: (item: T) => string | number
  columns?: 1 | 2 | 3 | 4
  gap?: 'sm' | 'md' | 'lg'
  emptyState?: ReactNode
  className?: string
}

const gridColumns = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
}

const gapSizes = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
}

export function DataGrid<T>({
  items,
  renderItem,
  keyExtractor,
  columns = 3,
  gap = 'md',
  emptyState,
  className,
}: DataGridProps<T>) {
  if (items.length === 0) {
    return emptyState ? <>{emptyState}</> : null
  }

  return (
    <div className={cn('grid', gridColumns[columns], gapSizes[gap], className)}>
      {items.map((item, index) => (
        <div key={keyExtractor(item)}>
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  )
}
