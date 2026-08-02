import { memo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  variant?: 'simple' | 'full'
  className?: string
}

export const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  variant = 'full',
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className={cn('flex items-center justify-between text-sm text-muted-foreground', className)}>
      <span className={variant === 'simple' ? 'hidden' : ''}>
        {startItem}-{endItem} of {totalItems}
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

        {variant === 'full' && (
          <>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 7) {
                pageNum = i + 1
              } else if (currentPage <= 4) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i
              } else {
                pageNum = currentPage - 3 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={cn(
                    'w-8 h-8 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
            })}
          </>
        )}

        {variant === 'simple' && (
          <span className="px-3 text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
        )}

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
})
