import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown, ChevronRight, Clock, User, FileText,
  X, SlidersHorizontal, Inbox, Pin, PinOff,
  BellOff, CheckSquare, Square,
  FileSignature, RefreshCw, Receipt, ShoppingCart,
  File, Activity, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader, StatusBadge, EmptyState } from '@/components/ui'
import { SearchInput } from '@/components/ui'
import { Skeleton } from '@/components/ui'
import { inboxItems } from '@/components/operations/inboxMockData'
import type {
  InboxItem, Priority, Stage, BusinessObject, Team, GroupBy, QuickAction,
} from '@/components/operations/inboxMockData'
import { useUIStore } from '@/store/uiStore'
import { toast } from 'sonner'

const priorityOrder: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 }
const stageOrder: Record<Stage, number> = {
  review: 0, approval: 1, negotiation: 2, signature: 3,
  execution: 4, renewal: 5, completion: 6,
}
const typeOrder: Record<BusinessObject, number> = {
  quote: 0, contract: 1, renewal: 2, invoice: 3,
  purchase_order: 4, document: 5, sla: 6, compliance: 7,
}
const teamOrder: Record<Team, number> = {
  legal: 0, finance: 1, operations: 2, sales: 3, procurement: 4, compliance: 5,
}

const priorityConfig: Record<Priority, { label: string; accent: string; dot: string }> = {
  critical: { label: 'Critical', accent: 'border-l-red-500', dot: 'bg-red-500' },
  high: { label: 'High', accent: 'border-l-orange-500', dot: 'bg-orange-500' },
  medium: { label: 'Medium', accent: 'border-l-blue-500', dot: 'bg-blue-500' },
  low: { label: 'Low', accent: 'border-l-gray-400', dot: 'bg-gray-400' },
}

const typeIcons: Record<BusinessObject, typeof FileText> = {
  quote: FileText, contract: FileSignature, renewal: RefreshCw, invoice: Receipt,
  purchase_order: ShoppingCart, document: File, sla: Activity, compliance: Shield,
}

const typeLabels: Record<BusinessObject, string> = {
  quote: 'Quote', contract: 'Contract', renewal: 'Renewal', invoice: 'Invoice',
  purchase_order: 'PO', document: 'Document', sla: 'SLA', compliance: 'Compliance',
}

function getDueDateLabel(dueDate: string): { label: string; urgent: boolean } {
  const now = new Date()
  const due = new Date(dueDate)
  now.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const diff = Math.ceil((due.getTime() - now.getTime()) / 86400000)
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, urgent: true }
  if (diff === 0) return { label: 'Today', urgent: true }
  if (diff === 1) return { label: 'Tomorrow', urgent: false }
  if (diff <= 7) return { label: `In ${diff}d`, urgent: false }
  return { label: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), urgent: false }
}

function getDueDateGroup(dueDate: string): string {
  const now = new Date()
  const due = new Date(dueDate)
  now.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const diff = Math.ceil((due.getTime() - now.getTime()) / 86400000)
  if (diff < 0) return 'Overdue'
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff <= 7) return 'This Week'
  if (diff <= 30) return 'This Month'
  return 'Future'
}

const groupLabels: Record<string, (key: string) => string> = {
  priority: (k) => k.charAt(0).toUpperCase() + k.slice(1),
  dueDate: (k) => k,
  type: (k) => typeLabels[k as BusinessObject] || k,
  team: (k) => k.charAt(0).toUpperCase() + k.slice(1),
}

const allPriorities: Priority[] = ['critical', 'high', 'medium', 'low']
const allTypes: BusinessObject[] = ['quote', 'contract', 'renewal', 'invoice', 'purchase_order', 'document', 'sla', 'compliance']
const allTeams: Team[] = ['legal', 'finance', 'operations', 'sales', 'procurement', 'compliance']
const allStages: Stage[] = ['review', 'approval', 'negotiation', 'signature', 'execution', 'renewal', 'completion']
const allOwners = [...new Set(inboxItems.map(i => i.owner))].sort()

function QuickActionButton({ action, onClick }: { action: QuickAction; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={cn(
        'px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap',
        action.variant === 'primary'
          ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
          : action.variant === 'destructive'
            ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20'
            : 'bg-secondary text-secondary-foreground hover:bg-accent border border-border',
      )}
    >
      {action.label}
    </button>
  )
}

function InboxItemRow({
  item,
  flatIndex,
  isSelected,
  isPinned,
  bulkMode,
  isChecked,
  onSelect,
  onAction,
  onTogglePin,
  onSnooze,
  onToggleCheck,
  onQuickAction,
}: {
  item: InboxItem
  flatIndex: number
  isSelected: boolean
  isPinned: boolean
  bulkMode: boolean
  isChecked: boolean
  onSelect: () => void
  onAction: () => void
  onTogglePin: () => void
  onSnooze: () => void
  onToggleCheck: () => void
  onQuickAction: (action: QuickAction) => void
}) {
  const priority = priorityConfig[item.priority]
  const TypeIcon = typeIcons[item.type]
  const due = getDueDateLabel(item.dueDate)

  const handleClick = () => {
    if (bulkMode) {
      onToggleCheck()
    } else {
      onSelect()
    }
  }

  return (
    <div
      data-item-index={flatIndex}
      onClick={handleClick}
      onDoubleClick={() => !bulkMode && onAction()}
      className={cn(
        'group flex items-stretch cursor-pointer transition-colors relative',
        isSelected && !bulkMode ? 'bg-accent/50' : 'hover:bg-accent/30',
        bulkMode && isChecked && 'bg-primary/5',
      )}
    >
      <div className={cn('w-1 flex-shrink-0', priority.accent)} />
      <div className="flex-1 flex items-start gap-3 px-4 py-3.5 min-w-0">
        {bulkMode && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleCheck() }}
            className="flex-shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={isChecked ? 'Deselect item' : 'Select item'}
          >
            {isChecked ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
          </button>
        )}
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1.5', priority.dot)} />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{item.title}</span>
            {isPinned && <Pin className="w-3 h-3 text-amber-500 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 flex-shrink-0">
              <TypeIcon className="w-3 h-3" />
              {typeLabels[item.type]}
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span className="truncate">{item.businessObjectName}</span>
          </div>
          <p className="text-xs text-muted-foreground/70 line-clamp-1">{item.context}</p>
          <div className="flex items-center gap-3 pt-0.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="w-3 h-3" />
              {item.owner}
            </span>
            <span className={cn(
              'flex items-center gap-1 text-xs',
              due.urgent ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground',
            )}>
              <Clock className="w-3 h-3" />
              {due.label}
            </span>
            <StatusBadge status={item.stage} size="sm" dot className="capitalize" />
          </div>
        </div>
        <div className="flex items-start gap-1.5 flex-shrink-0 pt-0.5">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            {item.quickActions.slice(0, 2).map((qa, idx) => (
              <QuickActionButton key={idx} action={qa} onClick={() => onQuickAction(qa)} />
            ))}
          </div>
          <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onTogglePin() }}
              className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              aria-label={isPinned ? 'Unpin item' : 'Pin item'}
              title={isPinned ? 'Unpin' : 'Pin'}
            >
              {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onSnooze() }}
              className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Snooze item"
              title="Snooze"
            >
              <BellOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function GroupSection({
  label,
  count,
  children,
  defaultOpen = true,
}: {
  label: string
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group"
      >
        <div className="h-px flex-1 bg-border" />
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span>{label}</span>
        <span className="text-xs font-normal normal-case text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
        <div className="h-px flex-1 bg-border" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Select({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={cn(
        'appearance-none pl-3 pr-7 py-1.5 text-sm rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer bg-background min-w-0 max-w-[140px] truncate',
        value
          ? 'border-primary/30 text-primary font-medium bg-primary/5'
          : 'border-input text-muted-foreground hover:bg-accent',
      )}
    >
      <option value="">{label}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

const statusMessages = [
  'Reviewing your queue...',
  'Fetching priority items...',
  'Loading your daily work queue...',
  'Almost there...',
]

function LoadingSkeleton() {
  const [msgIdx, setMsgIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % statusMessages.length), 4000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="space-y-2 mt-6">
      {[1, 2, 3].map((g) => (
        <div key={g} className="mb-4">
          <div className="flex items-center gap-2 px-4 py-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-6 rounded-full" />
          </div>
          <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border">
            {[1, 2, 3].map((r) => (
              <div key={r} className="flex items-stretch">
                <Skeleton className="w-1 flex-shrink-0" />
                <div className="flex-1 px-4 py-3.5 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                  <div className="flex gap-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="text-center text-xs text-muted-foreground animate-pulse pt-2">
        {statusMessages[msgIdx]}
      </div>
    </div>
  )
}

export function OperationalInboxPage() {
  const { setActivePage } = useUIStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('priority')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [bulkMode, setBulkMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('inbox-pinned') || '[]') } catch { return [] }
  })
  const [snoozedUntil, setSnoozedUntil] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('inbox-snoozed') || '{}') } catch { return {} }
  })
  const [isLoading, setIsLoading] = useState(true)

  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { localStorage.setItem('inbox-pinned', JSON.stringify(pinnedIds)) }, [pinnedIds])
  useEffect(() => { localStorage.setItem('inbox-snoozed', JSON.stringify(snoozedUntil)) }, [snoozedUntil])

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 1200)
    return () => clearTimeout(t)
  }, [])

  const activeFilterCount = [priorityFilter, typeFilter, teamFilter, stageFilter, ownerFilter].filter(Boolean).length
  const hasActiveFilters = searchQuery || activeFilterCount > 0

  const visibleItems = useMemo(() => {
    const now = new Date().toISOString()
    return inboxItems.filter(item => {
      const snoozed = snoozedUntil[item.id]
      return !snoozed || snoozed < now
    })
  }, [snoozedUntil])

  const filtered = useMemo(() => {
    let items = [...visibleItems]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.context.toLowerCase().includes(q) ||
        i.businessObjectName.toLowerCase().includes(q) ||
        i.owner.toLowerCase().includes(q) ||
        i.recommendedAction.toLowerCase().includes(q)
      )
    }

    if (priorityFilter) items = items.filter(i => i.priority === priorityFilter)
    if (typeFilter) items = items.filter(i => i.type === typeFilter)
    if (teamFilter) items = items.filter(i => i.team === teamFilter)
    if (stageFilter) items = items.filter(i => i.stage === stageFilter)
    if (ownerFilter) items = items.filter(i => i.owner === ownerFilter)

    return items
  }, [visibleItems, searchQuery, priorityFilter, typeFilter, teamFilter, stageFilter, ownerFilter])

  const flatItems = useMemo(() => {
    const pinned = filtered.filter(i => pinnedIds.includes(i.id))
    const unpinned = filtered.filter(i => !pinnedIds.includes(i.id))
    const sortFn = (a: InboxItem, b: InboxItem) => {
      const pd = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (pd !== 0) return pd
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    }
    pinned.sort(sortFn)
    unpinned.sort(sortFn)
    return [...pinned, ...unpinned]
  }, [filtered, pinnedIds])

  const grouped = useMemo(() => {
    const groups: Record<string, InboxItem[]> = {}
    const pinned = filtered.filter(i => pinnedIds.includes(i.id))
    const unpinned = filtered.filter(i => !pinnedIds.includes(i.id))

    for (const item of unpinned) {
      let key: string
      switch (groupBy) {
        case 'priority': key = item.priority; break
        case 'dueDate': key = getDueDateGroup(item.dueDate); break
        case 'type': key = item.type; break
        case 'team': key = item.team; break
        default: key = item.priority
      }
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    }

    const orderMap = groupBy === 'priority' ? priorityOrder
      : groupBy === 'type' ? typeOrder
        : groupBy === 'team' ? teamOrder
          : undefined

    const keys = Object.keys(groups)
    if (orderMap) {
      keys.sort((a, b) => (orderMap[a as keyof typeof orderMap] ?? 99) - (orderMap[b as keyof typeof orderMap] ?? 99))
    } else if (groupBy === 'dueDate') {
      const dateOrder = ['Overdue', 'Today', 'Tomorrow', 'This Week', 'This Month', 'Future']
      keys.sort((a, b) => dateOrder.indexOf(a) - dateOrder.indexOf(b))
    }

    const result: { key: string; items: InboxItem[] }[] = []

    if (pinned.length > 0) {
      pinned.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
      result.push({ key: 'Pinned', items: pinned })
    }

    for (const key of keys) {
      result.push({ key, items: groups[key].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]) })
    }

    return result
  }, [filtered, groupBy, pinnedIds])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === '/' && document.activeElement !== searchRef.current) {
      e.preventDefault()
      searchRef.current?.focus()
      return
    }
    if (e.key === 'Escape') {
      if (document.activeElement === searchRef.current) {
        searchRef.current?.blur()
        setSearchQuery('')
      }
      setSelectedIndex(-1)
      setCheckedIds(new Set())
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, flatItems.length - 1))
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
      return
    }
    if ((e.key === 'Enter') && selectedIndex >= 0 && selectedIndex < flatItems.length) {
      e.preventDefault()
      handleAction(flatItems[selectedIndex])
      return
    }
    if (e.key === ' ' && e.target === document.body) {
      if (bulkMode && selectedIndex >= 0 && selectedIndex < flatItems.length) {
        e.preventDefault()
        const item = flatItems[selectedIndex]
        setCheckedIds(prev => {
          const next = new Set(prev)
          if (next.has(item.id)) next.delete(item.id)
          else next.add(item.id)
          return next
        })
      }
      return
    }
    if (e.key === 'p' && selectedIndex >= 0 && selectedIndex < flatItems.length) {
      e.preventDefault()
      const item = flatItems[selectedIndex]
      togglePin(item.id)
      return
    }
    if (e.key === 's' && selectedIndex >= 0 && selectedIndex < flatItems.length) {
      e.preventDefault()
      const item = flatItems[selectedIndex]
      snoozeItem(item.id)
      return
    }
    if (e.key === 'x' && selectedIndex >= 0 && selectedIndex < flatItems.length) {
      if (!bulkMode) {
        setBulkMode(true)
      }
      e.preventDefault()
      const item = flatItems[selectedIndex]
      setCheckedIds(prev => {
        const next = new Set(prev)
        if (next.has(item.id)) next.delete(item.id)
        else next.add(item.id)
        return next
      })
      return
    }
  }, [flatItems, selectedIndex, bulkMode])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    setSelectedIndex(-1)
  }, [searchQuery, priorityFilter, typeFilter, teamFilter, stageFilter, ownerFilter, groupBy])

  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-item-index]')
      if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex])

  const handleAction = (item: InboxItem) => {
    toast.success(`Opening: ${item.title}`)
    if (item.businessObjectId && item.type === 'contract') {
      setActivePage('contract-workspace', { contractId: item.businessObjectId })
    } else if (item.businessObjectId && item.type === 'renewal') {
      setActivePage('renewal-workspace', { renewalId: item.businessObjectId })
    } else if (item.type === 'invoice') {
      setActivePage('invoices')
    } else if (item.type === 'purchase_order') {
      setActivePage('purchase-orders')
    } else if (item.type === 'document') {
      setActivePage('documents')
    } else if (item.type === 'sla' || item.type === 'compliance') {
      setActivePage('dashboard')
    }
  }

  const handleQuickAction = (item: InboxItem, action: QuickAction) => {
    toast.success(`${action.label}: ${item.title}`)
  }

  const togglePin = (id: string) => {
    setPinnedIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
    toast.success(pinnedIds.includes(id) ? 'Unpinned item' : 'Pinned item')
  }

  const snoozeItem = (id: string) => {
    const until = new Date()
    until.setHours(until.getHours() + 4)
    setSnoozedUntil(prev => ({ ...prev, [id]: until.toISOString() }))
    toast.success('Item snoozed for 4 hours')
  }

  const clearAllFilters = () => {
    setSearchQuery('')
    setPriorityFilter('')
    setTypeFilter('')
    setTeamFilter('')
    setStageFilter('')
    setOwnerFilter('')
  }

  const toggleAllChecks = () => {
    if (checkedIds.size === flatItems.length) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(flatItems.map(i => i.id)))
    }
  }

  const bulkAction = (action: string) => {
    const selected = flatItems.filter(i => checkedIds.has(i.id))
    if (action === 'pin') {
      setPinnedIds(prev => [...new Set([...prev, ...selected.map(i => i.id)])])
      toast.success(`Pinned ${selected.length} items`)
    } else if (action === 'snooze') {
      const until = new Date()
      until.setHours(until.getHours() + 4)
      const updates: Record<string, string> = {}
      selected.forEach(i => { updates[i.id] = until.toISOString() })
      setSnoozedUntil(prev => ({ ...prev, ...updates }))
      toast.success(`Snoozed ${selected.length} items`)
    } else if (action === 'assign') {
      toast.success(`Assign dialog would open for ${selected.length} items`)
    } else if (action === 'deselect') {
      setCheckedIds(new Set())
    }
    setCheckedIds(new Set())
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="Operational Inbox"
          description="Your daily work queue — prioritized actions requiring your attention"
        />
        <LoadingSkeleton />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Operational Inbox"
        description="Your daily work queue — prioritized actions requiring your attention"
      />

      <div className="flex flex-col gap-3 mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-56 lg:w-64">
            <SearchInput
              ref={searchRef}
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search items..."
              variant="ghost"
              shortcut="/"
            />
          </div>

          <Select label="Priority" value={priorityFilter} onChange={setPriorityFilter}
            options={allPriorities.map(p => ({ value: p, label: priorityConfig[p].label }))} />
          <Select label="Type" value={typeFilter} onChange={setTypeFilter}
            options={allTypes.map(t => ({ value: t, label: typeLabels[t] }))} />
          <Select label="Team" value={teamFilter} onChange={setTeamFilter}
            options={allTeams.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} />
          <Select label="Stage" value={stageFilter} onChange={setStageFilter}
            options={allStages.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} />
          <Select label="Owner" value={ownerFilter} onChange={setOwnerFilter}
            options={allOwners.map(o => ({ value: o, label: o }))} />

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setBulkMode(!bulkMode)}
              className={cn(
                'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                bulkMode
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-input hover:bg-accent',
              )}
            >
              {bulkMode ? 'Exit Bulk' : 'Bulk'}
            </button>

            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              aria-label="Group by"
              className="appearance-none pl-3 pr-7 py-1.5 text-sm rounded-lg border border-input bg-background text-muted-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              <option value="priority">Group: Priority</option>
              <option value="dueDate">Group: Due Date</option>
              <option value="type">Group: Type</option>
              <option value="team">Group: Team</option>
            </select>

            <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
              {filtered.length} item{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">Active filters:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                Search: &quot;{searchQuery}&quot;
                <button onClick={() => setSearchQuery('')} className="hover:text-primary/70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {priorityFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                {priorityConfig[priorityFilter as Priority].label}
                <button onClick={() => setPriorityFilter('')} className="hover:text-primary/70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {typeFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                {typeLabels[typeFilter as BusinessObject]}
                <button onClick={() => setTypeFilter('')} className="hover:text-primary/70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {teamFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                {teamFilter.charAt(0).toUpperCase() + teamFilter.slice(1)}
                <button onClick={() => setTeamFilter('')} className="hover:text-primary/70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {stageFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                {stageFilter.charAt(0).toUpperCase() + stageFilter.slice(1)}
                <button onClick={() => setStageFilter('')} className="hover:text-primary/70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {ownerFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                {ownerFilter}
                <button onClick={() => setOwnerFilter('')} className="hover:text-primary/70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {activeFilterCount > 1 && (
              <button onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-foreground underline">
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {bulkMode && checkedIds.size > 0 && (
        <div className="sticky top-0 z-10 mt-3 mb-1">
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg text-sm">
            <span className="font-medium text-primary">{checkedIds.size} selected</span>
            <div className="h-4 w-px bg-border mx-1" />
            <button onClick={() => bulkAction('pin')} className="px-2 py-0.5 text-xs rounded-md hover:bg-primary/10 text-primary transition-colors">
              Pin
            </button>
            <button onClick={() => bulkAction('snooze')} className="px-2 py-0.5 text-xs rounded-md hover:bg-primary/10 text-primary transition-colors">
              Snooze
            </button>
            <button onClick={() => bulkAction('assign')} className="px-2 py-0.5 text-xs rounded-md hover:bg-primary/10 text-primary transition-colors">
              Assign
            </button>
            <div className="h-4 w-px bg-border mx-1" />
            <button onClick={() => bulkAction('deselect')} className="px-2 py-0.5 text-xs rounded-md hover:bg-primary/10 text-muted-foreground transition-colors">
              Deselect all
            </button>
          </div>
        </div>
      )}

      <div ref={listRef} className="mt-4" role="listbox" aria-label="Operational inbox items">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Your inbox is clear"
            description={hasActiveFilters ? 'No items match your current filters. Try adjusting or clearing them.' : 'No pending work items. You\'re all caught up!'}
            action={hasActiveFilters ? { label: 'Clear filters', onClick: clearAllFilters } : undefined}
            secondary={hasActiveFilters ? undefined : { label: 'View completed items', onClick: () => toast.info('Completed items view coming soon') }}
          />
        ) : (
          grouped.map(({ key, items: groupItems }) => {
            const label = groupLabels[groupBy]?.(key) || key
            const isOverdueGroup = groupBy === 'dueDate' && key === 'Overdue'
            const isPinnedGroup = key === 'Pinned'

            return (
              <GroupSection key={key} label={label} count={groupItems.length} defaultOpen={isOverdueGroup || isPinnedGroup || groupItems.length <= 5}>
                {groupItems.map((item) => {
                  const flatIdx = flatItems.indexOf(item)
                  const isSelected = flatIdx === selectedIndex && !bulkMode
                  const isPinned = pinnedIds.includes(item.id)
                  const isChecked = checkedIds.has(item.id)

                  return (
                    <InboxItemRow
                      key={item.id}
                      item={item}
                      flatIndex={flatIdx}
                      isSelected={isSelected}
                      isPinned={isPinned}
                      bulkMode={bulkMode}
                      isChecked={isChecked}
                      onSelect={() => setSelectedIndex(flatIdx)}
                      onAction={() => handleAction(item)}
                      onTogglePin={() => togglePin(item.id)}
                      onSnooze={() => snoozeItem(item.id)}
                      onToggleCheck={() => {
                        setCheckedIds(prev => {
                          const next = new Set(prev)
                          if (next.has(item.id)) next.delete(item.id)
                          else next.add(item.id)
                          return next
                        })
                        if (!bulkMode) setBulkMode(true)
                      }}
                      onQuickAction={(action) => handleQuickAction(item, action)}
                    />
                  )
                })}
              </GroupSection>
            )
          })
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">/</kbd> Search</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">j</kbd><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">k</kbd> Navigate</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Enter</kbd> Open</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">p</kbd> Pin</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">x</kbd> Select</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd> Clear</span>
          </div>
        </div>
      </div>
    </div>
  )
}

