import { useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  FileText, RefreshCw, Receipt, ShoppingCart, CheckCircle,
  ClipboardList, FolderOpen, Bell, ExternalLink, CheckCheck,
  Archive, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/uiStore'
import { PRIORITY_CONFIG, type BusinessObject, type Notification } from './types'
import { formatNotificationTime } from './notificationData'

const BUSINESS_ICONS: Record<BusinessObject, React.ElementType> = {
  contract: FileText, renewal: RefreshCw, invoice: Receipt,
  po: ShoppingCart, approval: CheckCircle, task: ClipboardList,
  document: FolderOpen, system: Bell,
}

interface NotificationCardProps {
  notification: Notification
  onMarkRead: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
}

export function NotificationCard({ notification, onMarkRead, onArchive, onDelete }: NotificationCardProps) {
  const setActivePage = useUIStore(s => s.setActivePage)
  const config = PRIORITY_CONFIG[notification.priority]
  const Icon = BUSINESS_ICONS[notification.businessObject]

  const handlePrimary = useCallback(() => {
    const action = notification.primaryAction
    setActivePage(action.page, action.params)
  }, [notification.primaryAction, setActivePage])

  const handleSecondary = useCallback(() => {
    if (!notification.secondaryAction) return
    const action = notification.secondaryAction
    setActivePage(action.page, action.params)
  }, [notification.secondaryAction, setActivePage])

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group relative flex items-start gap-3 px-4 py-3 transition-colors',
        'border-l-2',
        config.border,
        !notification.isRead ? config.bg : 'hover:bg-accent/30',
        !notification.isRead && 'bg-primary/[0.01]',
      )}
    >
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
        !notification.isRead
          ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground',
      )}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={cn(
                'text-xs leading-5',
                !notification.isRead ? 'font-semibold text-foreground' : 'text-foreground',
              )}>
                {notification.title}
              </span>
              {!notification.isRead && (
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', config.dot)} />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
              {notification.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1.5">
          <span className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded',
            config.dot.replace('bg-', 'text-').replace('-500', '-600') + ' ' + config.bg.replace('dark:bg-', 'dark:bg-').replace('-50', '-100').replace('/10', '/20'),
          )}>
            {config.label}
          </span>
          <span className="text-[10px] text-muted-foreground/50">·</span>
          <span className="text-[10px] text-muted-foreground capitalize">{notification.businessObject}</span>
          <span className="text-[10px] text-muted-foreground/50">·</span>
          <span className="text-[10px] text-muted-foreground">{formatNotificationTime(notification.timestamp)}</span>
        </div>

        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handlePrimary}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10 rounded transition-colors"
          >
            {notification.primaryAction.label}
            <ExternalLink className="w-3 h-3" />
          </button>
          {notification.secondaryAction && (
            <button
              onClick={handleSecondary}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent rounded transition-colors"
            >
              {notification.secondaryAction.label}
            </button>
          )}
          {!notification.isRead && (
            <button
              onClick={() => onMarkRead(notification.id)}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Mark as read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onArchive(notification.id)}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Archive"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(notification.id)}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
