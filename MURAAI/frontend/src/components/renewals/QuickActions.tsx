import { Send, FileText, RefreshCw, MessageSquare, CheckCircle, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import { toast } from 'sonner'

interface QuickAction {
  label: string
  icon: typeof Send
  action: string
  variant?: 'primary' | 'secondary'
}

interface QuickActionsProps {
  className?: string
}

const actions: QuickAction[] = [
  { label: 'Send Quote Request', icon: Send, action: 'send-quote', variant: 'primary' },
  { label: 'Upload Document', icon: FileText, action: 'upload-doc', variant: 'secondary' },
  { label: 'Log Communication', icon: MessageSquare, action: 'log-comm', variant: 'secondary' },
  { label: 'Add Task', icon: Plus, action: 'add-task', variant: 'secondary' },
  { label: 'Approve Pricing', icon: CheckCircle, action: 'approve-pricing', variant: 'primary' },
  { label: 'Send Renewal', icon: RefreshCw, action: 'send-renewal', variant: 'secondary' },
]

export function QuickActions({ className }: QuickActionsProps) {
  const handleAction = (action: string, label: string) => {
    toast.success(`${label}: action triggered`)
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {actions.map((a) => {
        const Icon = a.icon
        return (
          <button
            key={a.action}
            onClick={() => handleAction(a.action, a.label)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left',
              a.variant === 'primary'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                : 'bg-secondary text-secondary-foreground hover:bg-accent border border-border',
            )}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            {a.label}
          </button>
        )
      })}
    </div>
  )
}
