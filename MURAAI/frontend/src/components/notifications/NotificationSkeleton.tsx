import { cn } from '@/lib/utils'

interface NotificationSkeletonProps {
  count?: number
  className?: string
}

export function NotificationSkeleton({ count = 5, className }: NotificationSkeletonProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="h-4 w-16 bg-muted rounded animate-pulse mb-3" />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-muted mt-2 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-full" />
            <div className="flex gap-2">
              <div className="h-3 bg-muted rounded w-16" />
              <div className="h-3 bg-muted rounded w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
