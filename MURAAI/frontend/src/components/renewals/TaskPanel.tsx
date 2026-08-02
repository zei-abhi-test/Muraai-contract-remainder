import { useState } from 'react'
import { Circle, CheckCircle, Clock, AlertTriangle, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, daysUntil, priorityBadge } from './_utils'
import type { RenewalTask } from './renewalWorkspaceMockData'

interface TaskPanelProps {
  tasks: RenewalTask[]
  className?: string
}

const groupOrder = ['Overdue', 'Today', 'Upcoming', 'Completed']

function getTaskGroup(task: RenewalTask): string {
  if (task.status === 'completed') return 'Completed'
  const days = daysUntil(task.dueDate)
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Today'
  return 'Upcoming'
}

export function TaskPanel({ tasks, className }: TaskPanelProps) {
  const [showCompleted, setShowCompleted] = useState(false)

  const grouped = groupOrder.map(group => ({
    group,
    tasks: tasks.filter(t => getTaskGroup(t) === group && (group !== 'Completed' || showCompleted)),
  }))

  return (
    <div className={cn('space-y-3', className)}>
      {grouped.map(({ group, tasks: groupTasks }) => {
        if (groupTasks.length === 0) return null
        const isOverdue = group === 'Overdue'
        const isToday = group === 'Today'
        const isCompleted = group === 'Completed'

        return (
          <div key={group}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn(
                'text-[10px] uppercase tracking-wider font-semibold',
                isOverdue && 'text-red-500',
                isToday && 'text-amber-500',
                !isOverdue && !isToday && 'text-muted-foreground',
              )}>{group}</span>
              <span className="text-[10px] text-muted-foreground bg-muted/60 px-1 rounded-full">{groupTasks.length}</span>
              {isCompleted && (
                <button onClick={() => setShowCompleted(!showCompleted)} className="text-[10px] text-muted-foreground hover:text-foreground ml-auto">
                  {showCompleted ? 'Hide' : 'Show'}
                </button>
              )}
            </div>
            <div className="space-y-1">
              {groupTasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-accent/30 transition-colors">
                  {task.status === 'completed' ? (
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={cn('text-sm', task.status === 'completed' && 'line-through text-muted-foreground')}>{task.title}</span>
                    {task.description && (
                      <p className="text-xs text-muted-foreground">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{task.assignee}</span>
                      {task.dueDate && (
                        <span className={cn('text-[10px]', daysUntil(task.dueDate) < 0 ? 'text-red-500' : 'text-muted-foreground')}>
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                      {task.status !== 'completed' && (
                        <span className={cn('text-[10px] px-1 py-0.5 rounded font-medium', priorityBadge[task.priority])}>
                          {task.priority}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {tasks.filter(t => t.status !== 'completed').length === 0 && (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <CheckCircle className="w-6 h-6 mb-2 opacity-50" />
          <p className="text-sm">All tasks completed</p>
          <p className="text-xs">No pending tasks for this renewal</p>
        </div>
      )}
      {tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <Plus className="w-6 h-6 mb-2 opacity-50" />
          <p className="text-sm">No tasks yet</p>
          <p className="text-xs">Create the first task for this renewal</p>
        </div>
      )}
    </div>
  )
}
