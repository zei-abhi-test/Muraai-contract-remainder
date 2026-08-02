import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useActivityList, useMarkRead, useMarkAllRead, useArchive, useArchiveAll } from '@/hooks/useActivity'
import { NotificationCard } from './NotificationCard'
import { NotificationFilterBar } from './NotificationFilterBar'
import { NotificationEmptyState } from './NotificationEmptyState'
import { NotificationSkeleton } from './NotificationSkeleton'
import { groupNotifications, filterNotifications } from './notificationData'
import { type NotificationFilter, type Notification, type NotificationPriority, type BusinessObject } from './types'
import type { ActivityItem } from '@/api/activity'

function toNotification(item: ActivityItem): Notification {
  const p = item.activity_type
  const priority: NotificationPriority = p.includes('overdue') || p.includes('expiring') ? 'critical' : p.includes('due') || p.includes('pending') ? 'warning' : p.includes('paid') || p.includes('approved') || p.includes('completed') || p.includes('signed') ? 'success' : 'info'
  const bo: BusinessObject = p.startsWith('contract') ? 'contract' : p.startsWith('invoice') ? 'invoice' : p.startsWith('po_') ? 'po' : p.startsWith('approval') ? 'approval' : p.startsWith('renewal') ? 'renewal' : p.startsWith('document') ? 'document' : 'system'
  const pageMap: Record<string, string> = { contract: 'contract-workspace', renewal: 'renewal-workspace', invoice: 'invoices', po: 'purchase-orders', approval: 'approvals', document: 'documents' }
  return {
    id: String(item.id), priority, businessObject: bo,
    title: item.title, description: item.description || '',
    timestamp: item.created_at, isRead: item.is_read,
    isArchived: item.is_archived || false,
    primaryAction: {
      label: 'View Details',
      page: pageMap[bo] || 'activity-timeline',
      params: item.entity_id ? { [bo === 'renewal' ? 'renewalId' : 'contractId']: item.entity_id } : undefined,
    },
  }
}

interface NotificationPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const [search, setSearch] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const titleId = 'notification-panel-title'

  const { data: activities, isLoading: listLoading } = useActivityList({ limit: 50 })
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()
  const archive = useArchive()
  const archiveAll = useArchiveAll()

  const notifications = useMemo(() => (activities || []).map(toNotification), [activities])

  useFocusTrap(panelRef, isOpen)
  useEscapeKey(isOpen, onClose)

  // Reset search/filter when panel closes
  useEffect(() => {
    if (!isOpen) { setSearch(''); setFilter('all') }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications])

  const filtered = useMemo(() => filterNotifications(notifications, filter, search), [notifications, filter, search])
  const grouped = useMemo(() => groupNotifications(filtered), [filtered])

  const handleMarkRead = useCallback((id: string) => {
    markRead.mutate(Number(id))
  }, [markRead])

  const handleMarkAllRead = useCallback(() => {
    markAllRead.mutate()
  }, [markAllRead])

  const handleArchive = useCallback((id: string) => {
    archive.mutate(Number(id))
  }, [archive])

  const handleDelete = useCallback((_id: string) => {
    // No backend delete endpoint for activities
  }, [])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              'fixed top-0 right-0 h-full bg-card z-50 shadow-2xl flex flex-col',
              'w-screen md:w-[420px]',
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <h2 id={titleId} className="text-sm font-semibold">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 rounded transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Mark all read</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-accent rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Close notification panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 py-2 border-b border-border flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search notifications..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Search notifications"
                />
              </div>
            </div>

            {/* Filter Bar */}
            <NotificationFilterBar active={filter} onChange={setFilter} unreadCount={unreadCount} />

            {/* Content */}
            <div className="flex-1 overflow-y-auto" role="list" aria-label="Notification list">
              {listLoading ? (
                <NotificationSkeleton count={6} className="pt-2" />
              ) : filtered.length === 0 ? (
                <NotificationEmptyState filter={filter} search={search} />
              ) : (
                <div className="divide-y divide-border/0">
                  {grouped.map(group => (
                    <div key={group.key} role="group" aria-label={group.label}>
                      <div className="sticky top-0 bg-card/95 backdrop-blur z-10 px-4 py-2 border-b border-border/50">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                          {group.label}
                        </span>
                      </div>
                      <div className="divide-y divide-border/30">
                        {group.items.map(item => (
                          <NotificationCard
                            key={item.id}
                            notification={item}
                            onMarkRead={handleMarkRead}
                            onArchive={handleArchive}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
