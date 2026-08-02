import { BellOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NotificationEmptyStateProps {
  filter: string
  search?: string
  className?: string
}

export function NotificationEmptyState({ filter, search, className }: NotificationEmptyStateProps) {
  const title = search
    ? 'No notifications match your search'
    : filter === 'unread'
      ? 'No unread notifications'
      : 'No notifications yet'

  const description = search
    ? 'Try a different search term or filter.'
    : filter === 'unread'
      ? 'You are all caught up. New notifications will appear here.'
      : 'Notifications about approvals, renewals, invoices, tasks, and system alerts will appear here.'

  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-muted-foreground px-6', className)}>
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <BellOff className="w-7 h-7 opacity-50" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      <p className="text-xs text-center max-w-[240px] leading-relaxed">{description}</p>
    </div>
  )
}
