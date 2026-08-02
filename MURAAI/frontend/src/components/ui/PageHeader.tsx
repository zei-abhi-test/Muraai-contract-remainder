import { memo } from 'react'
import { cn } from '@/lib/utils'
import { Breadcrumbs } from './Breadcrumbs'

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumbs?: { label: string; page?: string; params?: Record<string, any> }[]
  action?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export const PageHeader = memo(function PageHeader({
  title,
  description,
  breadcrumbs,
  action,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn(className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {(action || children) && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {action}
            {children}
          </div>
        )}
      </div>
    </div>
  )
})
