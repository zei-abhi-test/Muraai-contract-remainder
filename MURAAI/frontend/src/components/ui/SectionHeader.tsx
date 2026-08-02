import { memo } from 'react'
import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const titleStyles = {
  sm: 'text-sm font-semibold',
  md: 'text-base font-semibold',
  lg: 'text-lg font-semibold',
}

const descStyles = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
}

export const SectionHeader = memo(function SectionHeader({
  title,
  description,
  action,
  size = 'md',
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="min-w-0">
        <h3 className={cn('text-foreground', titleStyles[size])}>{title}</h3>
        {description && (
          <p className={cn('text-muted-foreground mt-0.5', descStyles[size])}>{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
})
