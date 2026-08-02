import { useRef, memo, useState, useCallback, useEffect } from 'react'
import { Search, Download, ChevronUp, ChevronDown, Columns, GripVertical, X, Eye, EyeOff, ChevronLeft, ChevronRight, ListEnd } from 'lucide-react'
import { Button } from './Button'
import { TableSkeleton } from './Skeleton'
import { EmptyState } from './EmptyState'
import { cn } from '@/lib/utils'

export type Column<T> = {
  key: string
  header: string
  sortable?: boolean
  render?: (item: T) => React.ReactNode
  className?: string
  hideable?: boolean
  defaultHidden?: boolean
  minWidth?: number
  width?: number | string
}

export type BulkAction = {
  label: string
  onClick: (selectedIds: string[]) => void
  variant?: 'default' | 'destructive'
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string | number
  isLoading?: boolean
  error?: string | null
  emptyMessage?: string
  emptyAction?: React.ReactNode
  searchQuery?: string
  onSearchChange?: (q: string) => void
  searchPlaceholder?: string
  filters?: React.ReactNode
  sortField?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (field: string) => void
  totalPages?: number
  totalItems?: number
  pageSize?: number
  currentPage?: number
  onPageChange?: (page: number) => void
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  bulkActions?: BulkAction[]
  columnVisibility?: Record<string, boolean>
  onColumnVisibilityChange?: (visibility: Record<string, boolean>) => void
  rowActions?: (item: T) => React.ReactNode
  exportFn?: () => void
  toolbarActions?: React.ReactNode
  mobileCard?: (item: T) => React.ReactNode
  className?: string
}

const ROW_HEIGHT = 48

function exportToCsv<T>(columns: Column<T>[], data: T[], filename: string) {
  const headers = columns.map(c => c.header)
  const rows = data.map(item =>
    columns.map(c => {
      const value = (item as any)[c.key]
      if (value == null) return ''
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n'))
        return `"${str.replace(/"/g, '""')}"`
      return str
    })
  )
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

export const DataTable = memo(DataTableInner) as typeof DataTableInner

function DataTableInner<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  error = null,
  emptyMessage = 'No data found',
  emptyAction,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters,
  sortField,
  sortDir,
  onSort,
  totalPages,
  totalItems,
  pageSize = 15,
  currentPage,
  onPageChange,
  selectedIds = [],
  onSelectionChange,
  bulkActions,
  columnVisibility: columnVisibilityProp,
  onColumnVisibilityChange,
  rowActions,
  exportFn,
  toolbarActions,
  mobileCard,
  className,
}: DataTableProps<T>) {
  const isMobile = useIsMobile()
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const tableRef = useRef<HTMLDivElement>(null)
  const resizeState = useRef<{ key: string; startX: number; startWidth: number } | null>(null)
  const colWidths = useRef<Map<string, number>>(new Map())
  const [, forceRender] = useState(0)

  const visibleColumns = columnVisibilityProp
    ? columns.filter(col => columnVisibilityProp[col.key] !== false)
    : columns.filter(col => !col.defaultHidden)

  const allKeys = data.map(item => String(keyExtractor(item)))
  const allVisibleSelected = allKeys.length > 0 && allKeys.every(k => selectedIds.includes(k))
  const someVisibleSelected = !allVisibleSelected && allKeys.some(k => selectedIds.includes(k))

  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return
    if (allVisibleSelected) {
      onSelectionChange(selectedIds.filter(id => !allKeys.includes(id)))
    } else {
      const set = new Set(selectedIds)
      allKeys.forEach(k => set.add(k))
      onSelectionChange(Array.from(set))
    }
  }, [onSelectionChange, selectedIds, allKeys, allVisibleSelected])

  const toggleRow = useCallback((id: string) => {
    if (!onSelectionChange) return
    const set = new Set(selectedIds)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    onSelectionChange(Array.from(set))
  }, [onSelectionChange, selectedIds])

  const handleExport = () => {
    if (exportFn) exportFn()
    else exportToCsv(columns, data, 'export.csv')
  }

  const hasSelection = onSelectionChange != null
  const colCount = visibleColumns.length + (hasSelection ? 1 : 0)

  const toggleColumnVisibility = (key: string) => {
    if (!onColumnVisibilityChange || !columnVisibilityProp) return
    onColumnVisibilityChange({ ...columnVisibilityProp, [key]: columnVisibilityProp[key] === false ? true : false })
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node))
        setShowColumnMenu(false)
    }
    if (showColumnMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showColumnMenu])

  const handleResizeStart = useCallback((e: React.MouseEvent, colKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    const th = (e.target as HTMLElement).closest('th')
    const currentWidth = th?.offsetWidth || 150
    resizeState.current = { key: colKey, startX: e.pageX, startWidth: currentWidth }

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeState.current) return
      const newWidth = Math.max(60, resizeState.current.startWidth + (ev.pageX - resizeState.current.startX))
      colWidths.current.set(resizeState.current.key, newWidth)
      forceRender(n => n + 1)
    }

    const onMouseUp = () => {
      resizeState.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!data.length) return
    const maxIndex = data.length - 1
    let newIndex = focusedIndex

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        newIndex = Math.min(focusedIndex + 1, maxIndex)
        break
      case 'ArrowUp':
        e.preventDefault()
        newIndex = Math.max(focusedIndex - 1, 0)
        break
      case ' ':
        e.preventDefault()
        if (focusedIndex >= 0 && hasSelection) {
          const id = String(keyExtractor(data[focusedIndex]))
          toggleRow(id)
        }
        return
      case 'Enter':
        e.preventDefault()
        if (focusedIndex >= 0) {
          const row = tableRef.current?.querySelector(`[data-row-index="${focusedIndex}"]`) as HTMLElement
          row?.querySelector('[data-primary-action]')?.click()
        }
        return
      case 'Home':
        e.preventDefault()
        newIndex = 0
        break
      case 'End':
        e.preventDefault()
        newIndex = maxIndex
        break
      default:
        return
    }

    setFocusedIndex(newIndex)
    const rowEl = tableRef.current?.querySelector(`[data-row-index="${newIndex}"]`) as HTMLElement
    rowEl?.scrollIntoView({ block: 'nearest' })
  }, [focusedIndex, data, keyExtractor, toggleRow, hasSelection])

  if (isMobile && mobileCard) {
    return (
      <div className={cn('space-y-4', className)}>
        {renderToolbar()}
        {error && <ErrorBanner message={error} />}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4 space-y-2 animate-pulse">
                <SkeletonLine className="h-5 w-3/4" />
                <SkeletonLine className="h-4 w-1/2" />
                <SkeletonLine className="h-4 w-2/3" />
              </div>
            ))
          ) : data.length === 0 ? (
            <EmptyState title={emptyMessage} action={emptyAction as any} />
          ) : (
            data.map((item) => (
              <div key={String(keyExtractor(item))} className="bg-card border border-border rounded-lg overflow-hidden">
                {mobileCard(item)}
              </div>
            ))
          )}
        </div>
        {renderPagination()}
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {renderToolbar()}
      {error && <ErrorBanner message={error} />}
      <div
        ref={tableRef}
        className="overflow-auto rounded-lg border border-border"
        style={{ maxHeight: 'calc(100vh - 320px)' }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="grid"
        aria-label="Data table"
        aria-rowcount={data.length}
      >
        <table className="w-full text-sm border-collapse" style={{ minWidth: 500 }}>
          <thead className="sticky top-0 z-20">
            <tr className="bg-muted/80 backdrop-blur-sm">
              {hasSelection && (
                <th className="w-10 px-3 py-3 text-left border-b border-border" scope="col">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleSelectAll}
                    ref={useCallback((el: HTMLInputElement | null) => {
                      if (el) el.indeterminate = someVisibleSelected
                    }, [someVisibleSelected])}
                    className="rounded border-gray-300 dark:border-gray-600"
                    aria-label={allVisibleSelected ? 'Deselect all rows' : 'Select all rows'}
                  />
                </th>
              )}
              {visibleColumns.map(col => {
                const isActiveSort = sortField === col.key
                const width = colWidths.current.get(col.key)
                return (
                  <th
                    key={col.key}
                    className={cn(
                      'px-3 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider select-none border-b border-border relative',
                      col.sortable && 'cursor-pointer hover:text-foreground transition-colors',
                      col.className,
                    )}
                    style={{ width: width ? `${width}px` : col.width, minWidth: col.minWidth || 80 }}
                    onClick={() => col.sortable && onSort?.(col.key)}
                    aria-sort={isActiveSort ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                    tabIndex={col.sortable ? 0 : undefined}
                    onKeyDown={col.sortable ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort?.(col.key) } } : undefined}
                    scope="col"
                  >
                    <div className="flex items-center gap-1 pr-4">
                      {col.header}
                      {col.sortable && isActiveSort && (
                        sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </div>
                    {col.sortable && (
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, col.key)}
                        role="separator"
                        aria-label={`Resize column ${col.header}`}
                      />
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={colCount} className="p-4">
                  <TableSkeleton rows={5} cols={colCount} />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={colCount}>
                  <EmptyState title={emptyMessage} action={emptyAction as any} />
                </td>
              </tr>
            ) : (
              data.map((item, idx) => {
                const id = String(keyExtractor(item))
                const checked = selectedIds.includes(id)
                const isFocused = focusedIndex === idx
                return (
                  <tr
                    key={id}
                    data-row-index={idx}
                    className={cn(
                      'border-t border-border transition-colors group',
                      checked && 'bg-primary/5',
                      isFocused && 'ring-1 ring-inset ring-primary',
                      !checked && 'hover:bg-muted/30',
                    )}
                    aria-selected={checked}
                  >
                    {hasSelection && (
                      <td className="w-10 px-3 py-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRow(id)}
                          className="rounded border-gray-300 dark:border-gray-600"
                          aria-label={`Select row ${id}`}
                        />
                      </td>
                    )}
                    {visibleColumns.map(col => (
                      <td key={col.key} className={cn('px-3 py-3', col.className)} style={{ width: colWidths.current.get(col.key) ? `${colWidths.current.get(col.key)}px` : undefined }}>
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1">
                            {col.render ? col.render(item) : ((item as any)[col.key] ?? '-')}
                          </span>
                          {rowActions && idx === data.length - 1
                            ? null
                            : rowActions && (
                              <span className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                {rowActions(item)}
                              </span>
                            )}
                        </div>
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {renderPagination()}
      {showColumnMenu && renderColumnMenu()}
    </div>
  )

  function renderToolbar() {
    const hasToolbarContent = onSearchChange || filters || toolbarActions || exportFn || (hasSelection && selectedIds.length > 0 && bulkActions?.length)
    if (!hasToolbarContent && !columnVisibilityProp) return null

    const hideableColumns = columns.filter(col => col.hideable !== false)

    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {hasSelection && selectedIds.length > 0 && bulkActions?.length ? (
          <div className="flex items-center gap-2 flex-wrap w-full">
            <span className="text-sm text-muted-foreground whitespace-nowrap font-medium">{selectedIds.length} selected</span>
            {bulkActions.map((action, i) => (
              <Button
                key={i}
                variant={action.variant === 'destructive' ? 'destructive' : 'secondary'}
                size="sm"
                onClick={() => action.onClick(selectedIds)}
              >
                {action.label}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => onSelectionChange?.([])} className="ml-auto">
              <X className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
          </div>
        ) : (
          <>
            {onSearchChange && (
              <div className="relative flex-1 max-w-md w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery || ''}
                  onChange={e => onSearchChange(e.target.value)}
                  className="w-full h-9 pl-10 pr-4 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                />
              </div>
            )}
            {filters && <div className="flex items-center gap-2 flex-wrap">{filters}</div>}
            <div className="flex items-center gap-2 ml-auto">
              {toolbarActions}
              {hideableColumns.length > 0 && (
                <div className="relative">
                  <Button variant="secondary" size="sm" onClick={() => setShowColumnMenu(!showColumnMenu)}>
                    <Columns className="w-4 h-4 mr-1.5" />
                    Columns
                  </Button>
                </div>
              )}
              {(exportFn || columns.length > 0) && (
                <Button variant="secondary" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  function renderColumnMenu() {
    const hideableColumns = columns.filter(col => col.hideable !== false)
    if (hideableColumns.length === 0) return null

    return (
      <div
        ref={colMenuRef}
        className="absolute z-50 mt-1 bg-card border border-border rounded-lg shadow-lg p-2 min-w-[160px] right-0"
        style={{ position: 'fixed' }}
      >
        <div className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase tracking-wider">Columns</div>
        {hideableColumns.map(col => {
          const isVisible = !columnVisibilityProp || columnVisibilityProp[col.key] !== false
          return (
            <button
              key={col.key}
              onClick={() => toggleColumnVisibility(col.key)}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-left"
            >
              {isVisible ? <Eye className="w-3.5 h-3.5 text-muted-foreground" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
              {col.header}
            </button>
          )
        })}
      </div>
    )
  }

  function renderPagination() {
    if (!totalPages || totalPages <= 1 || !currentPage || !onPageChange) return null

    const startItem = (currentPage - 1) * pageSize + 1
    const endItem = Math.min(currentPage * pageSize, totalItems || 0)

    return (
      <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
        <span className="text-xs">
          {startItem}-{endItem} of {totalItems || 0}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1.5 hover:bg-accent rounded-lg disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="hidden sm:flex items-center gap-1">
            {getPageNumbers(currentPage, totalPages).map((pageNum, i) =>
              pageNum === '...' ? (
                <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">...</span>
              ) : (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum as number)}
                  className={cn(
                    'w-7 h-7 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    currentPage === pageNum
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent text-muted-foreground',
                  )}
                  aria-label={`Page ${pageNum}`}
                  aria-current={currentPage === pageNum ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              )
            )}
          </span>
          <span className="sm:hidden px-2 text-xs">
            {currentPage} / {totalPages}
          </span>
          <div className="flex items-center gap-1 ml-2">
            <ListEnd className="w-3 h-3 text-muted-foreground" />
            <select
              value={pageSize}
              onChange={(e) => onPageChange(1)}
              className="text-xs bg-transparent border border-input rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Page size"
            >
              {[15, 25, 50, 100].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1.5 hover:bg-accent rounded-lg disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }
}

function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn('bg-muted rounded animate-pulse', className)} />
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
      {message}
    </div>
  )
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}
