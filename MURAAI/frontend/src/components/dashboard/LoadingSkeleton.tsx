import { Skeleton } from '@/components/ui/Skeleton'
import type { ReactNode } from 'react'

interface LoadingSkeletonProps {
  variant?: 'cards' | 'chart' | 'list'
  count?: number
  children?: ReactNode
}

function CardSkeletons({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-12 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="col-span-6 sm:col-span-4 lg:col-span-2">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 lg:col-span-6">
        <div className="bg-card border border-border rounded-xl h-64" />
      </div>
      <div className="col-span-12 lg:col-span-6">
        <div className="bg-card border border-border rounded-xl h-64" />
      </div>
    </div>
  )
}

function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

export function LoadingSkeleton({ variant = 'cards', count, children }: LoadingSkeletonProps) {
  if (children) return <>{children}</>
  switch (variant) {
    case 'cards':
      return <CardSkeletons count={count} />
    case 'chart':
      return <ChartSkeleton />
    case 'list':
      return <ListSkeleton count={count} />
  }
}
