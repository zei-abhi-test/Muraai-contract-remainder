import { cn } from '@/lib/utils'
import { FILTER_CONFIG, type NotificationFilter } from './types'

interface NotificationFilterBarProps {
  active: NotificationFilter
  onChange: (filter: NotificationFilter) => void
  unreadCount: number
}

export function NotificationFilterBar({ active, onChange, unreadCount }: NotificationFilterBarProps) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-none border-b border-border">
      {FILTER_CONFIG.map(f => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={cn(
            'whitespace-nowrap px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex-shrink-0',
            active === f.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent',
          )}
          aria-pressed={active === f.value}
        >
          {f.label}
          {f.value === 'unread' && unreadCount > 0 && (
            <span className="ml-1 px-1 py-0.5 text-[9px] rounded-full bg-primary-foreground/20">{unreadCount}</span>
          )}
        </button>
      ))}
    </div>
  )
}
