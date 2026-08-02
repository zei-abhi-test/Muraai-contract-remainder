import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Filter, X, ChevronDown, ChevronRight,
  Clock, AlertTriangle, CheckCircle, Trash2, MessageSquare, Paperclip,
  User, Calendar as CalendarIcon, ArrowUpDown, Loader2,
  ListTodo, Play, Ban, FileText, ClipboardList,
} from 'lucide-react'
import {
  useTasks, useTask, useCreateTask, useUpdateTask,
  useDeleteTask, useUpdateTaskStatus, useTaskStats,
  useAddComment, useDeleteComment,
  useUploadAttachment, useDeleteAttachment,
} from '@/hooks/useTasks'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { cn, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import type { TaskItem, TaskDetail, TaskStatus, TaskPriority, CreateTaskData, UpdateTaskData } from '@/api/tasks'

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  TODO: ListTodo,
  IN_PROGRESS: Play,
  BLOCKED: Ban,
  COMPLETED: CheckCircle,
  CANCELLED: X,
}

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  BLOCKED: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  COMPLETED: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  CANCELLED: 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  HIGH: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const TABS = [
  { id: 'all', label: 'All Tasks' },
  { id: 'my', label: 'My Tasks' },
  { id: 'assigned', label: 'Assigned by Me' },
  { id: 'completed', label: 'Completed' },
  { id: 'overdue', label: 'Overdue' },
]

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </motion.div>
    </div>
  )
}

export function TaskPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TaskItem | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const filters = useMemo(() => {
    const f: any = { view: activeTab === 'completed' ? 'all' : activeTab === 'overdue' ? 'all' : activeTab }
    if (search) f.search = search
    if (statusFilter) f.status = statusFilter
    if (priorityFilter) f.priority = priorityFilter
    if (activeTab === 'completed') f.status = 'COMPLETED'
    return f
  }, [activeTab, search, statusFilter, priorityFilter])

  const { data: tasks = [], isLoading } = useTasks(filters)
  const { data: stats } = useTaskStats()
  const createMut = useCreateTask()
  const updateMut = useUpdateTask()
  const deleteMut = useDeleteTask()
  const updateStatusMut = useUpdateTaskStatus()
  const addCommentMut = useAddComment()
  const deleteCommentMut = useDeleteComment()
  const uploadAttachMut = useUploadAttachment()
  const deleteAttachMut = useDeleteAttachment()

  const { data: selectedTask, refetch: refetchTask } = useTask(selectedTaskId || 0)

  const [form, setForm] = useState<CreateTaskData>({
    title: '', description: '', priority: 'MEDIUM', due_date: null, assigned_to: null, related_module: '', related_record_id: undefined,
  })

  const [commentText, setCommentText] = useState('')

  const openCreate = () => {
    setForm({ title: '', description: '', priority: 'MEDIUM', due_date: null, assigned_to: null, related_module: '', related_record_id: undefined })
    setShowCreate(true)
  }

  const openEdit = (task: TaskItem) => {
    setForm({
      title: task.title, description: task.description || '', priority: task.priority,
      due_date: task.due_date, assigned_to: task.assigned_to,
      related_module: task.related_module || '', related_record_id: task.related_record_id || undefined,
    })
    setSelectedTaskId(task.id)
    setShowCreate(true)
  }

  const handleSave = () => {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    if (selectedTaskId && selectedTask) {
      updateMut.mutate({ id: selectedTaskId, data: form as UpdateTaskData }, {
        onSuccess: () => { setShowCreate(false); setSelectedTaskId(null) },
      })
    } else {
      createMut.mutate(form, {
        onSuccess: () => setShowCreate(false),
      })
    }
  }

  const handleAddComment = () => {
    if (!commentText.trim() || !selectedTaskId) return
    addCommentMut.mutate({ taskId: selectedTaskId, content: commentText }, {
      onSuccess: () => setCommentText(''),
    })
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedTaskId) return
    uploadAttachMut.mutate({ taskId: selectedTaskId, file })
    e.target.value = ''
  }

  const overdueTasks = useMemo(() =>
    (tasks || []).filter(t =>
      !['COMPLETED', 'CANCELLED'].includes(t.status) &&
      t.due_date && new Date(t.due_date) < new Date()
    ), [tasks])

  const displayedTasks = activeTab === 'overdue' ? overdueTasks : tasks

  if (isLoading) return <TableSkeleton />

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs items={[{ label: 'Tasks' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Task Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage, track, and complete tasks</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium">
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-2xl font-bold">{stats.my_tasks}</div>
            <div className="text-xs text-muted-foreground">My Tasks</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-2xl font-bold text-red-500">{stats.overdue}</div>
            <div className="text-xs text-muted-foreground">Overdue</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-500">{stats.critical}</div>
            <div className="text-xs text-muted-foreground">Critical</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-1 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors',
              activeTab === tab.id ? 'bg-card border border-b-0 border-border text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}>
            {tab.label}
            {tab.id === 'my' && stats && <span className="ml-1.5 text-xs text-muted-foreground">({stats.my_tasks})</span>}
            {tab.id === 'overdue' && stats && <span className="ml-1.5 text-xs text-red-500">({stats.overdue})</span>}
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm" placeholder="Search tasks..." />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={cn('inline-flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm', showFilters && 'bg-accent')}>
          <Filter className="w-4 h-4" /> Filters
        </button>
      </div>

      {showFilters && (
        <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
            <option value="">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="BLOCKED">Blocked</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setSelectedTaskId(null) }}
        title={selectedTaskId ? 'Edit Task' : 'Create Task'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" placeholder="Task title" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" rows={3} placeholder="Optional description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as TaskPriority }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Due Date</label>
              <input type="date" value={form.due_date || ''} onChange={e => setForm(p => ({ ...p, due_date: e.target.value || null }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Related Module</label>
            <select value={form.related_module || ''} onChange={e => setForm(p => ({ ...p, related_module: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
              <option value="">None</option>
              <option value="contract">Contract</option>
              <option value="invoice">Invoice</option>
              <option value="purchase_order">Purchase Order</option>
            </select>
          </div>
          {form.related_module && (
            <div>
              <label className="block text-sm font-medium mb-1">Related Record ID</label>
              <input type="number" value={form.related_record_id || ''} onChange={e => setForm(p => ({ ...p, related_record_id: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" placeholder="Record ID" />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowCreate(false); setSelectedTaskId(null) }}
              className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Cancel</button>
            <button onClick={handleSave}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
              <Plus className="w-4 h-4" /> {selectedTaskId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDeleteModal
          isOpen={true}
          title={`Delete "${deleteTarget.title}"?`}
          description="This will permanently delete this task and all its comments and attachments."
          isDeleting={deleteMut.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { deleteMut.mutate(deleteTarget.id); setDeleteTarget(null) }}
        />
      )}

      {/* Main layout: task list + selected task detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task List */}
        <div className="lg:col-span-1 space-y-2">
          {displayedTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No tasks found</p>
              <p className="text-xs mt-1">Create a new task to get started</p>
            </div>
          ) : (
            displayedTasks.map(task => {
              const StatusIcon = STATUS_ICONS[task.status] || ListTodo
              return (
                <motion.div key={task.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'p-3 bg-card border border-border rounded-xl cursor-pointer transition-all hover:shadow-sm',
                    selectedTaskId === task.id && 'ring-2 ring-primary border-primary',
                  )}
                  onClick={() => setSelectedTaskId(task.id)}>
                  <div className="flex items-start gap-3">
                    <div className={cn('p-1.5 rounded-lg mt-0.5', STATUS_COLORS[task.status]?.split(' ')[0] || 'bg-gray-100 dark:bg-gray-800')}>
                      <StatusIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{task.title}</div>
                      {task.description && <div className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</div>}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', PRIORITY_COLORS[task.priority] || '')}>{task.priority}</span>
                        {task.due_date && (
                          <span className={cn('text-[10px] text-muted-foreground flex items-center gap-1',
                            new Date(task.due_date) < new Date() && !['COMPLETED', 'CANCELLED'].includes(task.status) && 'text-red-500')}>
                            <CalendarIcon className="w-3 h-3" /> {formatDate(task.due_date)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        {task.assigned_to_name && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {task.assigned_to_name}</span>}
                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {task.comment_count}</span>
                        <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" /> {task.attachment_count}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                        <button onClick={e => { e.stopPropagation(); updateStatusMut.mutate({ id: task.id, status: 'COMPLETED' }) }}
                          className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600 dark:text-green-400" title="Complete">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={e => { e.stopPropagation(); setSelectedTaskId(task.id); openEdit(task) }}
                        className="p-1 hover:bg-accent rounded text-muted-foreground" title="Edit">
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeleteTarget(task) }}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500 dark:text-red-400" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>

        {/* Task Detail */}
        <div className="lg:col-span-2">
          {selectedTask ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-card border border-border rounded-xl p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_COLORS[selectedTask.status] || '')}>
                      {selectedTask.status}
                    </span>
                    <span className={cn('text-xs px-2 py-0.5 rounded font-medium', PRIORITY_COLORS[selectedTask.priority] || '')}>
                      {selectedTask.priority}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold">{selectedTask.title}</h2>
                  {selectedTask.description && <p className="text-sm text-muted-foreground mt-1">{selectedTask.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <select value={selectedTask.status} onChange={e => updateStatusMut.mutate({ id: selectedTask.id, status: e.target.value as TaskStatus })}
                    className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs">
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-accent/20 rounded-xl">
                <div>
                  <div className="text-xs text-muted-foreground">Assigned To</div>
                  <div className="text-sm font-medium mt-0.5">{selectedTask.assigned_to_name || 'Unassigned'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Due Date</div>
                  <div className="text-sm font-medium mt-0.5">{selectedTask.due_date ? formatDate(selectedTask.due_date) : 'No due date'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Related Module</div>
                  <div className="text-sm font-medium mt-0.5 capitalize">{selectedTask.related_module || 'None'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Created</div>
                  <div className="text-sm font-medium mt-0.5">{selectedTask.created_at ? formatDate(selectedTask.created_at) : '-'}</div>
                </div>
              </div>

              {/* Comments */}
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4" /> Comments ({selectedTask.comments?.length || 0})
                </h3>
                <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                  {(selectedTask.comments || []).map(c => (
                    <div key={c.id} className="flex items-start gap-2 p-2 bg-accent/20 rounded-lg">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-medium text-primary">{c.user_name?.charAt(0) || '?'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{c.user_name || 'User'}</span>
                          <span className="text-[10px] text-muted-foreground">{c.created_at ? formatDate(c.created_at) : ''}</span>
                        </div>
                        <p className="text-sm mt-0.5">{c.content}</p>
                      </div>
                      <button onClick={() => deleteCommentMut.mutate({ taskId: selectedTask.id, commentId: c.id })}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-400 opacity-0 hover:opacity-100">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={commentText} onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm" placeholder="Add a comment..." />
                  <button onClick={handleAddComment}
                    className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90">Send</button>
                </div>
              </div>

              {/* Attachments */}
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Paperclip className="w-4 h-4" /> Attachments ({selectedTask.attachments?.length || 0})
                </h3>
                <div className="space-y-1 mb-3">
                  {(selectedTask.attachments || []).map(a => (
                    <div key={a.id} className="flex items-center justify-between p-2 bg-accent/20 rounded-lg">
                      <span className="text-sm truncate">{a.filename}</span>
                      <button onClick={() => deleteAttachMut.mutate({ taskId: selectedTask.id, attachmentId: a.id })}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-400">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <label className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm cursor-pointer hover:bg-accent">
                  <Paperclip className="w-4 h-4" /> Upload File
                  <input type="file" onChange={handleUpload} className="hidden" />
                </label>
              </div>

              {/* History */}
              {selectedTask.history && selectedTask.history.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4" /> History
                  </h3>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {selectedTask.history.map(h => (
                      <div key={h.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{h.user_name || 'System'}</span>
                        <span>changed <strong>{h.field}</strong></span>
                        {h.old_value && <span>from "{h.old_value}"</span>}
                        {h.new_value && <span>to "{h.new_value}"</span>}
                        <span className="ml-auto">{h.created_at ? formatDate(h.created_at) : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
              <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Select a task</p>
              <p className="text-sm mt-1">Choose a task from the list to view its details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


