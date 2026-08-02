import { Mail, MessageSquare, Phone, Users, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, commStyle, directionBadge } from './_utils'
import type { RenewalCommEntry } from './renewalWorkspaceMockData'

interface CommunicationPanelProps {
  vendorComms: RenewalCommEntry[]
  customerComms: RenewalCommEntry[]
  className?: string
}

const typeIcons: Record<string, typeof Mail> = {
  email: Mail,
  note: MessageSquare,
  meeting: Users,
  call: Phone,
}

export function CommunicationPanel({ vendorComms, customerComms, className }: CommunicationPanelProps) {
  const allComms = [...vendorComms, ...customerComms].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  if (allComms.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-6 text-muted-foreground', className)}>
        <Mail className="w-6 h-6 mb-2 opacity-50" />
        <p className="text-sm">No communications yet</p>
        <p className="text-xs">Start a conversation to track communication here</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {allComms.map((comm) => {
        const style = commStyle[comm.type]
        const Icon = typeIcons[comm.type]
        return (
          <div key={comm.id} className="flex items-start gap-2.5 py-2 px-2 rounded-lg hover:bg-accent/30 transition-colors">
            <div className={cn('p-1.5 rounded-full flex-shrink-0', style.bg)}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium truncate">{comm.subject}</p>
                <span className={cn('text-[10px] px-1 py-0.5 rounded font-medium', directionBadge[comm.direction])}>
                  {comm.direction}
                </span>
                <span className="text-[10px] text-muted-foreground capitalize ml-auto">{comm.type}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{comm.summary}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                <span>{comm.from} → {comm.to}</span>
                <span>{formatDate(comm.timestamp)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
