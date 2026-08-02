import { Activity } from 'lucide-react'

interface DashboardHeaderProps {
  title: string
  description?: string
  statusLabel?: string
  statusLive?: boolean
}

export function DashboardHeader({ title, description, statusLabel, statusLive }: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-1">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {statusLabel && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50">
          <Activity className="w-3.5 h-3.5" />
          {statusLive ? statusLabel : 'Loading...'}
        </div>
      )}
    </div>
  )
}
