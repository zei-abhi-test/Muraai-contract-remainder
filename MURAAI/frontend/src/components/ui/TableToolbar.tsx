import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface TableToolbarProps {
  children: ReactNode
  className?: string
}

export function TableToolbar({ children, className }: TableToolbarProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4 mb-6', className)}>
      {children}
    </div>
  )
}
