import { memo } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from './Skeleton'
import type { ReactNode } from 'react'

export interface TableColumn<T> {
  key: string
  header: string
  render: (item: T) => ReactNode
  className?: string
  sortable?: boolean
}

interface TableProps<T> {
  columns: TableColumn<T>[]
  data: T[]
  keyExtractor: (item: T) => string | number
  onRowClick?: (item: T) => void
  variant?: 'default' | 'striped' | 'bordered'
  compact?: boolean
  loading?: boolean
  emptyState?: ReactNode
  className?: string
}

const variantStyles = {
  default: 'divide-y divide-border',
  striped: 'divide-y divide-border [&_tr:nth-child(even)]:bg-muted/30',
  bordered: 'divide-y divide-border border border-border rounded-lg',
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  variant = 'default',
  compact = false,
  loading = false,
  emptyState,
  className,
}: TableProps<T>) {
  return (
    <div className={cn('overflow-x-auto', variant === 'bordered' && 'rounded-lg', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'text-left text-xs font-medium text-muted-foreground uppercase tracking-wider',
                  compact ? 'px-3 py-2.5' : 'px-4 py-3',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={variantStyles[variant]}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skeleton-${i}`}>
                {columns.map((col) => (
                  <td key={col.key} className={compact ? 'px-3 py-2' : 'px-4 py-3'}>
                    <Skeleton className="h-4 w-full max-w-[120px]" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12">
                {emptyState || (
                  <div className="text-center text-sm text-muted-foreground">No data</div>
                )}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={cn(
                  'transition-colors',
                  onRowClick ? 'cursor-pointer hover:bg-accent/50' : '',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'text-sm',
                      compact ? 'px-3 py-2' : 'px-4 py-3',
                      col.className,
                    )}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
