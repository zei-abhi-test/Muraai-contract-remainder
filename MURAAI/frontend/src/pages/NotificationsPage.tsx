import { PageHeader } from '@/components/ui'
import { NotificationCenter } from '@/components/NotificationCenter'
import { useUnreadCount, useMarkAllRead } from '@/hooks/useActivity'
import { useNotificationCenterStore } from '@/store/notificationCenterStore'
import { CheckCheck, Bell } from 'lucide-react'

export function NotificationsPage() {
  const { data: unreadCount = 0 } = useUnreadCount()
  const markAllRead = useMarkAllRead()
  const setFilter = useNotificationCenterStore((s) => s.setFilter)
  const setView = useNotificationCenterStore((s) => s.setView)
  const view = useNotificationCenterStore((s) => s.view)
  const filter = useNotificationCenterStore((s) => s.filter)

  const handleMarkAllRead = () => {
    markAllRead.mutate()
    setFilter('all')
    setView('inbox')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay updated with contract and invoice activity."
        breadcrumbs={[{ label: 'Notifications' }]}
        action={
          unreadCount > 0 && view === 'inbox' ? (
            <button onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read ({unreadCount})
            </button>
          ) : (
            <button
              onClick={() => setView(view === 'inbox' ? 'archived' : 'inbox')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-input bg-background rounded-lg hover:bg-accent transition-colors"
            >
              <Bell className="w-4 h-4" />
              {view === 'inbox' ? 'View archived' : 'Back to inbox'}
            </button>
          )
        }
      />
      <NotificationCenter />
    </div>
  )
}
