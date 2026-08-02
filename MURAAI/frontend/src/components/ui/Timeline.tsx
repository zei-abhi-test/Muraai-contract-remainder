import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { ElementType, ReactNode } from 'react'

interface TimelineItemProps {
  icon?: ElementType
  iconColor?: string
  iconBgColor?: string
  title: string
  description?: string
  time?: string
  status?: 'active' | 'completed' | 'pending'
  children?: ReactNode
  className?: string
}

interface TimelineProps {
  children: ReactNode
  className?: string
}

const statusBarColors = {
  active: 'bg-primary',
  completed: 'bg-green-500',
  pending: 'bg-muted-foreground/30',
}

const statusIconColors = {
  active: 'text-primary bg-primary/10',
  completed: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-950/30',
  pending: 'text-muted-foreground bg-muted',
}

export const TimelineItem = memo(function TimelineItem({
  icon: Icon,
  iconColor,
  iconBgColor,
  title,
  description,
  time,
  status,
  children,
  className,
}: TimelineItemProps) {
  return (
    <li className={cn('relative flex gap-4 pb-8 last:pb-0', className)}>
      <div className="flex flex-col items-center">
        <div className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 z-10',
          iconBgColor || (status ? statusIconColors[status]?.split(' ').slice(1).join(' ') : 'bg-muted'),
        )}>
          {Icon && (
            <Icon className={cn(
              'w-4 h-4',
              iconColor || (status ? statusIconColors[status]?.split(' ')[0] : 'text-muted-foreground'),
            )} />
          )}
        </div>
        <div className={cn(
          'w-0.5 flex-1 mt-1',
          status ? statusBarColors[status] : 'bg-border',
        )} />
      </div>
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {time && <span className="text-xs text-muted-foreground ml-auto">{time}</span>}
        </div>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        {children && <div className="mt-2">{children}</div>}
      </div>
    </li>
  )
})

export const Timeline = memo(function Timeline({ children, className }: TimelineProps) {
  return (
    <ul className={cn('', className)}>
      {children}
    </ul>
  )
})
