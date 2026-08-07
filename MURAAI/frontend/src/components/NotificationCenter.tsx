import { useCallback, useRef, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, BellOff, Clock, CheckCheck, FileText, Send, X, Package,
  ShoppingCart, Receipt, AlertCircle, CheckCircle, Ban, Search,
  Archive, ArchiveRestore, Inbox, Filter, Loader2, ChevronDown,
} from 'lucide-react'
import { useActivityList, useUnreadCount, useMarkRead, useMarkAllRead, useArchive, useArchiveAll } from '@/hooks/useActivity'
import { ACTIVITY_CATEGORIES, ACTIVITY_TYPE_CATEGORY, type ActivityItem } from '@/api/activity'
import { useNotificationCenterStore, type NotificationFilter } from '@/store/notificationCenterStore'
import { useUIStore } from '@/store/uiStore'
import { EmptyState } from '@/components/ui'
import { fadeInUp } from '@/lib/motion-utils'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 30

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  contract_created: FileText, contract_updated: FileText,
  contract_submitted: Send, contract_approved: CheckCheck,
  contract_rejected: X, contract_activated: FileText,
  contract_completed: FileText, contract_renewed: FileText,
  contract_expiring: AlertCircle, renewal_due: Clock,
  product_added: Package,
  po_created: ShoppingCart, po_updated: ShoppingCart,
  po_deleted: ShoppingCart, po_submitted: Send,
  po_cancelled: X, po_completed: CheckCheck, po_mark_received: CheckCheck,
  invoice_created: Receipt, invoice_updated: Receipt,
  invoice_deleted: Receipt, invoice_issued: Send,
  invoice_paid: CheckCheck, invoice_cancelled: X,
  invoice_sent: Send, invoice_due: Clock, invoice_overdue: AlertCircle,
  document_uploaded: FileText,
  approval_requested: Send, approval_cancelled: Ban,
}

const ACTIVITY_COLORS: Record<string, string> = {
  contract_created: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  contract_updated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  contract_submitted: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  contract_approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  contract_rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  contract_activated: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  contract_completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  contract_renewed: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  contract_expiring: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  renewal_due: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  product_added: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  po_created: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  po_updated: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  po_deleted: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  po_submitted: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  po_cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  po_completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  po_mark_received: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  invoice_created: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  invoice_updated: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  invoice_deleted: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  invoice_issued: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  invoice_paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  invoice_cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  invoice_sent: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  invoice_due: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  invoice_overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  document_uploaded: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approval_requested: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  approval_cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
}

const GROUP_LABELS: Record<string, string> = {
  today: 'Today', yesterday: 'Yesterday', week: 'This Week', earlier: 'Earlier',
}

function formatTime(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getEntityRoute(item: ActivityItem) {
  if (item.contract_id) {
    return { page: 'contract-workspace', params: { contractId: item.contract_id } }
  }
  if (item.entity_type === 'invoice' && item.entity_id) {
    return { page: 'invoices', params: { id: String(item.entity_id) } }
  }
  if (item.entity_type === 'purchase_order' && item.entity_id) {
    return { page: 'purchase-orders', params: { id: String(item.entity_id) } }
  }
  return { page: 'contracts', params: {} }
}

function groupActivities(activities: ActivityItem[]) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)
  const groups: Record<string, ActivityItem[]> = { today: [], yesterday: [], week: [], earlier: [] }
  for (const item of activities) {
    const d = new Date(item.created_at)
    if (d >= today) groups.today.push(item)
    else if (d >= yesterday) groups.yesterday.push(item)
    else if (d >= weekAgo) groups.week.push(item)
    else groups.earlier.push(item)
  }
  return Object.entries(groups).filter(([, items]) => items.length > 0)
}

function NotificationIcon({ type }: { type: string }) {
  const Icon = ACTIVITY_ICONS[type] || Bell
  return <Icon className="w-5 h-5" />
}

export function NotificationCenter() {
  const {
    search, setSearch, category, setCategory, filter, setFilter,
    view, setView, selectedIds, toggleSelection, clearSelection,
  } = useNotificationCenterStore()
  const setActivePage = useUIStore((s) => s.setActivePage)

  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loadedCount, setLoadedCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [search])

  const params = useMemo(() => ({
    per_page: loadedCount,
    search: debouncedSearch || undefined,
    category: category !== 'all' ? category : undefined,
    archived: view === 'archived' || undefined,
    unread_first: view === 'inbox',
  }), [loadedCount, debouncedSearch, category, view])

  const { data, isLoading, isFetching } = useActivityList(params)
  const activities = data?.items ?? []
  const { data: unreadCount = 0 } = useUnreadCount()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()
  const archive = useArchive()
  const archiveAll = useArchiveAll()

  useEffect(() => {
    setLoadedCount(PAGE_SIZE)
  }, [debouncedSearch, category, view])

  const filtered = useMemo(() => {
    let items = activities
    if (filter === 'unread') items = items.filter((a) => !a.is_read)
    else if (filter === 'read') items = items.filter((a) => a.is_read)
    return items
  }, [activities, filter])

  const groups = useMemo(() => groupActivities(filtered), [filtered])
  const totalCount = data?.total ?? 0
  const hasMore = totalCount > loadedCount

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetching) {
          setLoadedCount((prev) => prev + PAGE_SIZE)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isFetching])

  const handleItemClick = useCallback((item: ActivityItem) => {
    const route = getEntityRoute(item)
    setActivePage(route.page, route.params)
    if (!item.is_read) markRead.mutate(item.id)
  }, [setActivePage, markRead])

  const handleMarkRead = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    markRead.mutate(id)
  }, [markRead])

  const handleArchive = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    archive.mutate(id)
  }, [archive])

  const handleBulkMarkRead = useCallback(() => {
    selectedIds.forEach((id) => markRead.mutate(id))
    clearSelection()
  }, [selectedIds, markRead, clearSelection])

  const handleBulkArchive = useCallback(() => {
    selectedIds.forEach((id) => archive.mutate(id))
    clearSelection()
  }, [selectedIds, archive, clearSelection])

  const handleMarkAllRead = useCallback(() => {
    markAllRead.mutate()
  }, [markAllRead])

  const handleArchiveAll = useCallback(() => {
    archiveAll.mutate()
  }, [archiveAll])

  const showBulkBar = selectedIds.size > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text" placeholder="Search notifications..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-10 pr-4 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
          {(['inbox', 'archived'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                view === v ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {v === 'inbox' ? <Inbox className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
              {v === 'inbox' ? 'Inbox' : 'Archived'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {ACTIVITY_CATEGORIES.map((cat) => (
          <button key={cat.id} onClick={() => setCategory(cat.id)}
            className={cn(
              'whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              category === cat.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['all', 'unread', 'read'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent'
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'unread' && unreadCount > 0 && (
                <span className="ml-1 px-1 py-0.5 text-[10px] rounded-full bg-primary-foreground/20">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
        {view === 'inbox' && unreadCount > 0 && (
          <button onClick={handleMarkAllRead}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent rounded-lg transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </button>
        )}
        {view === 'archived' && activities.length > 0 && (
          <button onClick={handleArchiveAll}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent rounded-lg transition-colors"
          >
            <ArchiveRestore className="w-3.5 h-3.5" /> Unarchive all
          </button>
        )}
      </div>

      <AnimatePresence>
        {showBulkBar && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-lg"
          >
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <div className="flex items-center gap-2 ml-auto">
              {view === 'inbox' && (
                <button onClick={handleBulkMarkRead}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Mark read
                </button>
              )}
              <button onClick={handleBulkArchive}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border bg-background rounded-lg hover:bg-accent transition-colors"
              >
                <Archive className="w-3.5 h-3.5" /> {view === 'archived' ? 'Unarchive' : 'Archive'}
              </button>
              <button onClick={clearSelection}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-muted rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={view === 'archived' ? 'No archived notifications' : filter === 'unread' ? 'No unread notifications' : filter === 'read' ? 'No read notifications' : 'No notifications yet'}
          description={
            search ? 'Try a different search term.' :
            view === 'archived' ? 'Archived notifications will appear here.' :
            'Notifications about contract approvals, renewals, invoices, and more will appear here.'
          }
        />
      ) : (
        <div className="space-y-8">
          {groups.map(([groupKey, items]) => (
            <div key={groupKey}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                {GROUP_LABELS[groupKey]}
              </h3>
              <div className="space-y-1.5">
                {items.map((item) => {
                  const colorClass = ACTIVITY_COLORS[item.activity_type] || 'bg-muted text-muted-foreground'
                  const cat = ACTIVITY_TYPE_CATEGORY[item.activity_type] || 'contracts'
                  return (
                    <motion.div
                      key={item.id}
                      variants={fadeInUp}
                      initial="hidden"
                      animate="visible"
                      className={cn(
                        'group relative flex items-start gap-3 p-3 rounded-xl cursor-pointer',
                        'transition-all hover:bg-accent/50',
                        !item.is_read ? 'bg-primary/[0.02] border border-primary/10' : 'border border-transparent',
                      )}
                      onClick={() => handleItemClick(item)}
                    >
                      <label className="relative z-10 mt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelection(item.id)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                        />
                      </label>

                      <div className={cn('p-2 rounded-lg shrink-0', colorClass)}>
                        <NotificationIcon type={item.activity_type} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className={cn('text-sm', !item.is_read && 'font-semibold')}>
                              {item.title}
                            </span>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                            )}
                          </div>
                          {!item.is_read && (
                            <span className="shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-muted-foreground">{formatTime(item.created_at)}</span>
                          <span className="text-[11px] text-muted-foreground/50">&#183;</span>
                          <span className="text-[11px] text-muted-foreground capitalize">{cat.replace('_', ' ')}</span>
                        </div>
                      </div>

                      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                        {!item.is_read && (
                          <button
                            onClick={(e) => handleMarkRead(e, item.id)}
                            className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Mark as read"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleArchive(e, item.id)}
                          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title={view === 'archived' ? 'Unarchive' : 'Archive'}
                        >
                          {view === 'archived' ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}

          <div ref={sentinelRef} className="h-4" />
          {isFetching && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

