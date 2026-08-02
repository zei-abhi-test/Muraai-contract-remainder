import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  FileText, RefreshCw, CheckCircle, Receipt, ShoppingCart, Package,
  Clock, Sun, List, Grid3X3, Loader2, X, Plus, Filter,
  Bell, ClipboardList, Zap, Trash2, AlertTriangle,
} from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import { useUIStore } from '@/store/uiStore'
import {
  useCalendarEvents, useCalendarFilters, useCreateCalendarEvent, useDeleteCalendarEvent,
  useReminderConfigs, useSaveReminderConfigs, useSetDefaultReminders,
} from '@/hooks/useCalendar'
import {
  useTasks, useCreateTask, useUpdateTask, useDeleteTask, useUpdateTaskStatus,
} from '@/hooks/useTasks'
import type { CalendarEvent, CreateEventData, ReminderConfigItem, ReminderConfigData } from '@/api/calendar'
import type { TaskItem, CreateTaskData, UpdateTaskData, TaskStatus, TaskPriority } from '@/api/tasks'

type ViewMode = 'month' | 'week' | 'day' | 'agenda'

const EVENT_COLORS: Record<string, string> = {
  contract_start: 'var(--event-contract-start)',
  contract_end: 'var(--event-contract-end)',
  renewal: 'var(--event-renewal)',
  invoice_due: 'var(--event-invoice-due)',
  invoice_paid: 'var(--event-invoice-paid)',
  po_delivery: 'var(--event-po-delivery)',
  approval_deadline: 'var(--event-approval-deadline)',
  document_expiry: 'var(--event-document-expiry)',
  reminder: 'var(--event-reminder)',
  task: 'var(--event-task)',
}

const EVENT_BG_CLASSES: Record<string, string> = {
  contract_start: 'bg-green-500',
  contract_end: 'bg-red-500',
  renewal: 'bg-blue-500',
  invoice_due: 'bg-amber-500',
  invoice_paid: 'bg-emerald-500',
  po_delivery: 'bg-purple-500',
  approval_deadline: 'bg-pink-500',
  document_expiry: 'bg-orange-500',
  reminder: 'bg-teal-500',
  task: 'bg-indigo-500',
}

const EVENT_LABELS: Record<string, string> = {
  contract_start: 'Start',
  contract_end: 'Expiry',
  renewal: 'Renewal',
  invoice_due: 'Invoice',
  invoice_paid: 'Paid',
  po_delivery: 'PO',
  approval_deadline: 'Approval',
  document_expiry: 'Doc',
  reminder: 'Reminder',
  task: 'Task',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  HIGH: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getMonthDays(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weeks: (number | null)[][] = []
  let week: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) week.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  while (week.length < 7) week.push(null)
  if (week.length) weeks.push(week)
  return weeks
}

function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  const start = new Date(d)
  d.setDate(d.getDate() + 6)
  return { start, end: new Date(d) }
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function eventsForDay(events: CalendarEvent[], date: Date): CalendarEvent[] {
  return events.filter(e => { const d = new Date(e.start); return sameDay(d, date) })
}

function formatMonthYear(year: number, month: number): string {
  return new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function isToday(date?: Date | null): boolean {
  if (!date) return false
  return sameDay(date, new Date())
}

export function CalendarPage() {
  const today = new Date()
  const [currentDate, setCurrentDate] = useState(today)
  const [view, setView] = useState<ViewMode>('month')
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set([
    'contract_start', 'contract_end', 'renewal', 'invoice_due', 'invoice_paid',
    'po_delivery', 'approval_deadline', 'document_expiry', 'reminder', 'task',
  ]))
  const [customerFilter, setCustomerFilter] = useState<number | undefined>()
  const [contractFilter, setContractFilter] = useState<number | undefined>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [showFilters, setShowFilters] = useState(false)

  // Modal state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)

  const setActivePage = useUIStore(s => s.setActivePage)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const dateRange = useMemo(() => {
    if (view === 'month') {
      const start = new Date(year, month, 1); start.setDate(start.getDate() - start.getDay())
      const end = new Date(year, month + 1, 0); end.setDate(end.getDate() + (6 - end.getDay()))
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
    }
    if (view === 'week') {
      const { start, end } = getWeekRange(currentDate)
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
    }
    if (view === 'day') {
      const d = currentDate.toISOString().split('T')[0]
      return { start: d, end: d }
    }
    const start = new Date(currentDate); start.setDate(start.getDate() - 15)
    const end = new Date(currentDate); end.setDate(end.getDate() + 45)
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
  }, [view, year, month, currentDate])

  const typesParam = useMemo(() => Array.from(filterTypes).join(','), [filterTypes])

  const { data, isLoading } = useCalendarEvents({
    start: dateRange.start, end: dateRange.end, types: typesParam,
    customer_id: customerFilter, contract_id: contractFilter, status: statusFilter,
  })

  const { data: filtersData } = useCalendarFilters()
  const { data: tasks } = useTasks()
  const { data: reminderConfigs } = useReminderConfigs()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const updateTaskStatusMut = useUpdateTaskStatus()
  const deleteTask = useDeleteTask()
  const createEvent = useCreateCalendarEvent()
  const deleteEvent = useDeleteCalendarEvent()
  const saveReminderConfigs = useSaveReminderConfigs()
  const setDefaultReminders = useSetDefaultReminders()

  const events = data?.events || []

  const toggleFilter = useCallback((type: string) => {
    setFilterTypes(prev => { const n = new Set(prev); n.has(type) ? n.delete(type) : n.add(type); return n })
  }, [])

  const navigate = useCallback((dir: -1 | 1) => {
    setCurrentDate(prev => {
      const d = new Date(prev)
      if (view === 'month') d.setMonth(d.getMonth() + dir)
      else if (view === 'week') d.setDate(d.getDate() + 7 * dir)
      else d.setDate(d.getDate() + dir)
      return d
    })
  }, [view])

  const goToday = useCallback(() => setCurrentDate(new Date()), [])

  const handleEventClick = useCallback((event: CalendarEvent) => {
    if (event.entity_type === 'contract' && event.entity_id) {
      setActivePage('contract-workspace', { contractId: event.entity_id })
    } else if (event.entity_type === 'invoice' && event.entity_id) {
      setActivePage('invoices', { id: String(event.entity_id) })
    } else if (event.entity_type === 'purchase_order' && event.entity_id) {
      setActivePage('purchase-orders', { id: String(event.entity_id) })
    } else if (event.entity_type === 'calendar_event' && event.entity_id) {
      setSelectedEvent(event)
    } else {
      setSelectedEvent(event)
    }
  }, [setActivePage])

  const filteredEvents = useMemo(() => events.filter(e => filterTypes.has(e.type)), [events, filterTypes])

  const todayEvents = useMemo(() => eventsForDay(filteredEvents, today), [filteredEvents])

  // Create default reminders on first load
  useEffect(() => {
    if (reminderConfigs && reminderConfigs.length === 0) {
      setDefaultReminders.mutate()
    }
  }, [reminderConfigs])

  // ── Task Modal Handlers ──
  const [taskForm, setTaskForm] = useState<{ title: string; description: string; due_date: string | null; priority: string }>({
    title: '', description: '', due_date: null, priority: 'MEDIUM'
  })

  const openCreateTask = () => {
    setEditingTask(null)
    setTaskForm({ title: '', description: '', due_date: currentDate.toISOString().split('T')[0], priority: 'MEDIUM' })
    setShowTaskModal(true)
  }

const openEditTask = (task: TaskItem) => {
    setEditingTask(task)
    setTaskForm({
      title: task.title, description: task.description || '',
      due_date: task.due_date || null, priority: task.priority as string,
    })
    setShowTaskModal(true)
  }

const handleSaveTask = () => {
    if (!taskForm.title.trim()) return
    if (editingTask) {
      updateTask.mutate({ id: editingTask.id, data: { ...taskForm, priority: taskForm.priority as string } })
    } else {
      createTask.mutate({ ...taskForm, priority: taskForm.priority as string })
    }
    setShowTaskModal(false)
      }

  const handleCompleteTask = (task: TaskItem) => {
    updateTaskStatusMut.mutate({ id: task.id, status: 'COMPLETED' as TaskStatus })
  }

  const handleDeleteTask = (id: number) => {
    deleteTask.mutate(id)
  }

  // ── Event Modal ──
  const [eventForm, setEventForm] = useState<CreateEventData>({
    title: '', description: '', event_type: 'reminder',
    start: '', end: '', all_day: false, color: '#14b8a6', priority: 'medium',
  })

  const openCreateEvent = () => {
    const start = currentDate.toISOString().split('T')[0]
    setEventForm({
      title: '', description: '', event_type: 'reminder',
      start, end: '', all_day: true, color: '#14b8a6', priority: 'medium',
    })
    setShowEventModal(true)
  }

  const handleSaveEvent = () => {
    if (!eventForm.title.trim() || !eventForm.start) return
    createEvent.mutate(eventForm)
    setShowEventModal(false)
  }

  const handleDeleteCalendarEvent = (id: number) => {
    deleteEvent.mutate(id)
    setSelectedEvent(null)
  }

  // ── Reminder Modal ──
  const [reminderForm, setReminderForm] = useState<ReminderConfigData[]>([])

  const openReminderModal = () => {
    if (reminderConfigs) {
      setReminderForm(reminderConfigs.map(c => ({
        event_type: c.event_type, days_before: c.days_before,
        enabled: c.enabled, notification_method: c.notification_method,
      })))
    }
    setShowReminderModal(true)
  }

  const handleSaveReminders = () => {
    saveReminderConfigs.mutate(reminderForm)
    setShowReminderModal(false)
  }

  const updateReminderItem = (index: number, updates: Partial<ReminderConfigData>) => {
    setReminderForm(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item))
  }

  // ── Subcomponents ──

  const EventBadge = ({ event, compact }: { event: CalendarEvent; compact?: boolean }) => (
    <button
      onClick={(e) => { e.stopPropagation(); handleEventClick(event) }}
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-white truncate w-full text-left hover:opacity-90 transition-opacity',
        compact ? 'mb-0.5' : 'mb-0.5',
      )}
      style={{ backgroundColor: EVENT_COLORS[event.type] || '#6b7280' }}
      title={`${event.title}${event.description ? ` - ${event.description}` : ''}`}
    >
      {compact ? (
        <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
      ) : (
        <span className="truncate text-[10px]">{event.title}</span>
      )}
    </button>
  )

  // Month View
  const renderMonthView = () => {
    const weeks = getMonthDays(year, month)
    return (
      <div>
        <div className="grid grid-cols-7 mb-1">
          {DAYS_SHORT.map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-t border-l border-border">
          {weeks.flat().map((day, i) => {
            if (day === null) return <div key={`e-${i}`} className="border-r border-b border-border bg-muted/20 min-h-[90px] p-1" />
            const date = new Date(year, month, day)
            const isT = sameDay(date, today)
            const dayEvents = eventsForDay(filteredEvents, date)
            return (
              <button
                key={day}
                onClick={() => { setCurrentDate(date); setView('day') }}
                className={cn(
                  'border-r border-b border-border min-h-[90px] p-1.5 text-left transition-colors hover:bg-muted/30',
                  isT && 'bg-primary/5'
                )}
              >
                <span className={cn(
                  'inline-flex items-center justify-center w-6 h-6 text-xs rounded-full',
                  isT && 'bg-primary text-primary-foreground font-bold'
                )}>
                  {day}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 3).map(e => (
                    <EventBadge key={e.id} event={e} compact={dayEvents.length > 2} />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[10px] text-muted-foreground pl-1">
                      +{dayEvents.length - 3} more
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Week View
  const renderWeekView = () => {
    const { start } = getWeekRange(currentDate)
    const days: Date[] = []
    for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(d.getDate() + i); days.push(d) }
    return (
      <div>
        <div className="grid grid-cols-7 mb-1">
          {days.map((d, i) => {
            const isT = sameDay(d, today)
            return (
              <div key={d.toISOString()} className={cn('text-center py-2', isT && 'bg-primary/5 rounded-lg')}>
                <div className="text-xs text-muted-foreground">{DAYS_SHORT[i]}</div>
                <div className={cn('inline-flex items-center justify-center w-7 h-7 text-sm rounded-full mt-0.5', isT && 'bg-primary text-primary-foreground font-bold')}>
                  {d.getDate()}
                </div>
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-7 border-t border-l border-border">
          {days.map((d, i) => {
            const isT = sameDay(d, today)
            const dayEvents = eventsForDay(filteredEvents, d)
            return (
              <button key={d.toISOString()} onClick={() => { setCurrentDate(d); setView('day') }}
                className={cn('border-r border-b border-border min-h-[200px] p-1.5 text-left transition-colors hover:bg-muted/30', isT && 'bg-primary/5')}
              >
                <div className="space-y-0.5">
                  {dayEvents.map(e => (<EventBadge key={e.id} event={e} compact />))}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Day View
  const renderDayView = () => {
    const dayEvents = eventsForDay(filteredEvents, currentDate)
    return (
      <div className="space-y-3">
        <div className="text-center py-4">
          <div className="text-lg font-semibold">{currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
          <div className="text-sm text-muted-foreground">{dayEvents.length} events</div>
        </div>
        {dayEvents.length === 0 ? (
          <EmptyState icon={CalendarIcon} title="No events for this day" description="Add an event or task to get started." />
        ) : (
          <div className="space-y-2 max-w-2xl mx-auto">
            {dayEvents.map(e => (
              <button key={e.id} onClick={() => handleEventClick(e)}
                className="flex items-start gap-3 w-full p-4 rounded-xl border border-border hover:bg-muted/30 transition-colors text-left"
              >
                <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: EVENT_COLORS[e.type] || '#6b7280' }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{e.title}</div>
                  <div className="text-sm text-muted-foreground truncate">{e.description}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: EVENT_COLORS[e.type] || '#6b7280' }}>
                      {EVENT_LABELS[e.type] || e.type}
                    </span>
                    <span className="text-xs text-muted-foreground">{e.status}</span>
                    {e.amount !== undefined && e.amount > 0 && (
                      <span className="text-xs font-medium">${e.amount.toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Agenda View
  const renderAgendaView = () => {
    const grouped = filteredEvents.reduce((acc, e) => {
      const key = e.start.split('T')[0]
      if (!acc[key]) acc[key] = []
      acc[key].push(e)
      return acc
    }, {} as Record<string, CalendarEvent[]>)
    const sortedKeys = Object.keys(grouped).sort()
    return (
      <div className="space-y-6">
        {sortedKeys.length === 0 ? (
          <EmptyState icon={List} title="No events in this period" />
        ) : sortedKeys.map(key => {
          const date = new Date(key)
          const dayEvents = grouped[key]
          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold">{date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                <span className="text-xs text-muted-foreground">{dayEvents.length} events</span>
              </div>
              <div className="space-y-1.5 pl-2 border-l-2 border-border">
                {dayEvents.map(e => (
                  <button key={e.id} onClick={() => handleEventClick(e)}
                    className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-muted/30 transition-colors text-left"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: EVENT_COLORS[e.type] || '#6b7280' }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate">{e.title}</span>
                      <span className="text-xs text-muted-foreground ml-2 truncate">{e.description}</span>
                    </div>
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium text-white shrink-0" style={{ backgroundColor: EVENT_COLORS[e.type] || '#6b7280' }}>
                      {EVENT_LABELS[e.type] || e.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Tasks Panel
  const renderTasksPanel = () => {
    const pending = (tasks || []).filter(t => !['COMPLETED', 'CANCELLED'].includes(t.status))
    const completed = (tasks || []).filter(t => t.status === 'COMPLETED')
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tasks ({pending.length})</h3>
          <button onClick={openCreateTask} className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90">
            <Plus className="w-3 h-3" /> Add Task
          </button>
        </div>
        {(tasks || []).length === 0 ? (
          <EmptyState icon={ClipboardList} title="No tasks yet" description="Create your first task!" />
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {pending.map(t => (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors group">
                <input type="checkbox" checked={false} onChange={() => handleCompleteTask(t)}
                  className="w-3.5 h-3.5 rounded border-border accent-primary cursor-pointer shrink-0" />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEditTask(t)}>
                  <span className="text-sm truncate block">{t.title}</span>
                  {t.due_date && <span className="text-[10px] text-muted-foreground">{formatDate(t.due_date)}</span>}
                </div>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0', PRIORITY_COLORS[t.priority] || 'bg-gray-100 dark:bg-gray-800')}>{t.priority}</span>
                <button onClick={() => handleDeleteTask(t.id)} className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all">
                  <Trash2 className="w-3 h-3 text-red-500" />
                </button>
              </div>
            ))}
            {completed.length > 0 && (
              <>
                <div className="text-[10px] text-muted-foreground pt-2 pb-1 uppercase tracking-wider font-semibold">Completed ({completed.length})</div>
                {completed.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg opacity-60">
                    <input type="checkbox" checked readOnly className="w-3.5 h-3.5 accent-primary shrink-0" />
                    <span className="text-sm line-through truncate">{t.title}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Calendar & Scheduler"
        description="Manage contracts, invoices, POs, approvals, reminders, and personal tasks."
        breadcrumbs={[{ label: 'Calendar' }]}
        action={
          <button onClick={openCreateEvent}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> Event
          </button>
        }
      >
        <button onClick={openCreateTask}
          className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Task
        </button>
      </PageHeader>

      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={goToday} className="px-3 py-2 rounded-lg border border-border hover:bg-secondary transition-colors text-sm font-medium">Today</button>
          <button onClick={() => navigate(1)} className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors"><ChevronRight className="w-4 h-4" /></button>
          <div className="flex items-center gap-2 ml-2">
            <h2 className="text-lg font-semibold hidden sm:block">
              {view === 'month' ? formatMonthYear(year, month) :
               view === 'week' ? `${getWeekRange(currentDate).start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${getWeekRange(currentDate).end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` :
               view === 'day' ? currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) :
               'Agenda'}
            </h2>
            <span className="text-xs text-muted-foreground hidden sm:inline">({filteredEvents.length} events)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(!showFilters)}
            className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors', showFilters ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary')}>
            <Filter className="w-3.5 h-3.5" /> Filters
          </button>
          <button onClick={openReminderModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-border hover:bg-secondary transition-colors">
            <Bell className="w-3.5 h-3.5" /> Reminders
          </button>
          <div className="flex items-center gap-0.5 bg-card border border-border rounded-lg p-0.5">
            {(['month', 'week', 'day', 'agenda'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs transition-colors', view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {v === 'month' && <Grid3X3 className="w-3 h-3" />}
                {v === 'week' && <Sun className="w-3 h-3" />}
                {v === 'day' && <Clock className="w-3 h-3" />}
                {v === 'agenda' && <List className="w-3 h-3" />}
                <span className="hidden sm:inline capitalize">{v}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground mr-1">Event Types:</span>
                {Object.entries(EVENT_COLORS).map(([key, color]) => (
                  <button key={key} onClick={() => toggleFilter(key)}
                    className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors', filterTypes.has(key) ? 'border-border bg-card text-foreground' : 'border-transparent bg-muted/40 text-muted-foreground line-through opacity-60')}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="hidden sm:inline">{EVENT_LABELS[key] || key}</span>
                    <span className="sm:hidden">{key === 'contract_start' ? 'Start' : key === 'contract_end' ? 'End' : key === 'approval_deadline' ? 'App' : key === 'document_expiry' ? 'Doc' : key === 'invoice_due' ? 'Inv' : key === 'invoice_paid' ? 'Paid' : key === 'po_delivery' ? 'PO' : key.slice(0, 4)}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {filtersData && (
                  <>
                    <select value={customerFilter || ''} onChange={e => setCustomerFilter(e.target.value ? Number(e.target.value) : undefined)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-card">
                      <option value="">All Customers</option>
                      {filtersData.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select value={contractFilter || ''} onChange={e => setContractFilter(e.target.value ? Number(e.target.value) : undefined)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-card">
                      <option value="">All Contracts</option>
                      {filtersData.contracts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select value={statusFilter || ''} onChange={e => setStatusFilter(e.target.value || undefined)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-card">
                      <option value="">All Statuses</option>
                      <option value="Active">Active</option>
                      <option value="Draft">Draft</option>
                      <option value="Expired">Expired</option>
                      <option value="Pending Approval">Pending Approval</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar + Tasks Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Calendar Area */}
        <div className="lg:col-span-3">
          <div
            className="bg-card border border-border rounded-xl p-4"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                {view === 'month' && renderMonthView()}
                {view === 'week' && renderWeekView()}
                {view === 'day' && renderDayView()}
                {view === 'agenda' && renderAgendaView()}
              </>
            )}
          </div>
        </div>

        {/* Tasks Sidebar */}
        <div className="lg:col-span-1">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            {renderTasksPanel()}
          </motion.div>
        </div>
      </div>

      {/* Event Detail Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: EVENT_COLORS[selectedEvent.type] || '#6b7280' }} />
                  <h3 className="font-semibold">{selectedEvent.title}</h3>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="p-1 hover:bg-muted rounded-lg transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3 text-sm">
                {selectedEvent.description && <p className="text-muted-foreground">{selectedEvent.description}</p>}
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: EVENT_COLORS[selectedEvent.type] || '#6b7280' }}>
                    {EVENT_LABELS[selectedEvent.type] || selectedEvent.type}
                  </span>
                  <span className="text-xs text-muted-foreground self-center">{selectedEvent.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{formatDate(selectedEvent.start)}</span></div>
                  {selectedEvent.company_name && <div><span className="text-muted-foreground">Company:</span> <span className="font-medium">{selectedEvent.company_name}</span></div>}
                  {selectedEvent.amount !== undefined && selectedEvent.amount > 0 && <div><span className="text-muted-foreground">Amount:</span> <span className="font-medium">${selectedEvent.amount.toLocaleString()}</span></div>}
                </div>
                <div className="flex gap-2 pt-2">
                  {selectedEvent.entity_type === 'contract' && selectedEvent.entity_id && (
                    <button onClick={() => { setSelectedEvent(null); setActivePage('contract-workspace', { contractId: selectedEvent.entity_id }) }}
                      className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium text-center">View Contract</button>
                  )}
                  {selectedEvent.entity_type === 'invoice' && selectedEvent.entity_id && (
                    <button onClick={() => { setSelectedEvent(null); setActivePage('invoices', { id: String(selectedEvent.entity_id) }) }}
                      className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium text-center">View Invoice</button>
                  )}
                  {selectedEvent.entity_type === 'purchase_order' && selectedEvent.entity_id && (
                    <button onClick={() => { setSelectedEvent(null); setActivePage('purchase-orders', { id: String(selectedEvent.entity_id) }) }}
                      className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium text-center">View PO</button>
                  )}
                  {selectedEvent.entity_type === 'calendar_event' && selectedEvent.entity_id && (
                    <button onClick={() => { handleDeleteCalendarEvent(Number(selectedEvent.id.split('-').pop())); setSelectedEvent(null) }}
                      className="px-3 py-2 bg-red-500 text-white rounded-lg text-xs font-medium">Delete</button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Modal */}
      <AnimatePresence>
        {showTaskModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={() => setShowTaskModal(false)}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="font-semibold mb-4">{editingTask ? 'Edit Task' : 'New Task'}</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Title *</label>
                  <input value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm" placeholder="Task title" autoFocus />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Description</label>
                  <textarea value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm resize-none" rows={2} placeholder="Optional description" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Due Date</label>
                    <input type="date" value={taskForm.due_date || ''} onChange={e => setTaskForm(p => ({ ...p, due_date: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Priority</label>
                    <select value={taskForm.priority} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value as TaskPriority }))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm">
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setShowTaskModal(false)}
                    className="flex-1 px-3 py-2 rounded-lg border border-border text-sm">Cancel</button>
                  <button onClick={handleSaveTask}
                    className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">{editingTask ? 'Update' : 'Create'}</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event (Reminder/Task) Creation Modal */}
      <AnimatePresence>
        {showEventModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={() => setShowEventModal(false)}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="font-semibold mb-4">New Calendar Event</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Title *</label>
                  <input value={eventForm.title} onChange={e => setEventForm(p => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm" placeholder="Event title" autoFocus />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Type</label>
                  <select value={eventForm.event_type} onChange={e => setEventForm(p => ({ ...p, event_type: e.target.value, color: EVENT_COLORS[e.target.value] || '#14b8a6' }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm">
                    <option value="reminder">Reminder</option>
                    <option value="task">Task</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Start *</label>
                    <input type="date" value={eventForm.start} onChange={e => setEventForm(p => ({ ...p, start: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">End</label>
                    <input type="date" value={eventForm.end || ''} onChange={e => setEventForm(p => ({ ...p, end: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="allDay" checked={eventForm.all_day} onChange={e => setEventForm(p => ({ ...p, all_day: e.target.checked }))}
                    className="w-3.5 h-3.5 accent-primary" />
                  <label htmlFor="allDay" className="text-xs text-muted-foreground">All day</label>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Description</label>
                  <textarea value={eventForm.description} onChange={e => setEventForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm resize-none" rows={2} placeholder="Optional description" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setShowEventModal(false)}
                    className="flex-1 px-3 py-2 rounded-lg border border-border text-sm">Cancel</button>
                  <button onClick={handleSaveEvent}
                    className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Create</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reminder Config Modal */}
      <AnimatePresence>
        {showReminderModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={() => setShowReminderModal(false)}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Reminder Settings</h3>
                <button onClick={() => setShowReminderModal(false)} className="p-1 hover:bg-muted rounded-lg"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Configure when you want to receive reminders for upcoming events.</p>
              {reminderForm.length === 0 ? (
                <EmptyState icon={Bell} title="No reminder settings configured" description="Add reminder settings to get notified about upcoming events." />
              ) : (
                <div className="space-y-3">
                  {reminderForm.map((item, idx) => (
                    <div key={`${item.event_type}-${item.days_before}`} className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-border/50">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: EVENT_COLORS[item.event_type] || '#6b7280' }} />
                        <span className="text-xs font-medium capitalize">{item.event_type.replace(/_/g, ' ')}</span>
                      </div>
                      <select value={item.days_before} onChange={e => updateReminderItem(idx, { days_before: Number(e.target.value) })}
                        className="text-xs px-2 py-1.5 rounded border border-border bg-card">
                        {[1, 2, 3, 7, 14, 30].map(d => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''} before</option>)}
                      </select>
                      <select value={item.notification_method} onChange={e => updateReminderItem(idx, { notification_method: e.target.value })}
                        className="text-xs px-2 py-1.5 rounded border border-border bg-card">
                        <option value="email">Email</option>
                        <option value="notification">In-App</option>
                        <option value="both">Both</option>
                      </select>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer ml-auto">
                        <input type="checkbox" checked={item.enabled} onChange={e => updateReminderItem(idx, { enabled: e.target.checked })}
                          className="w-3 h-3 accent-primary" />
                        Enabled
                      </label>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-4">
                <button onClick={() => setShowReminderModal(false)}
                  className="flex-1 px-3 py-2 rounded-lg border border-border text-sm">Cancel</button>
                <button onClick={handleSaveReminders}
                  className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Save Settings</button>
              </div>
            </motion.div>
          </motion.div>
)}
      </AnimatePresence>
    </div>
  );
}
