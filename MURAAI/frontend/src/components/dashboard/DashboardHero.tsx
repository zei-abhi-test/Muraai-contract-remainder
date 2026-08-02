import { useEffect, useState } from 'react'
import { FileText, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import type { FullDashboardData } from '@/hooks/useFullDashboard'

interface DashboardHeroProps {
  data: FullDashboardData | undefined
}

const cards = [
  { label: 'Total Contracts', key: 'total_contracts' as const, icon: FileText, subtitle: 'Total active contracts', bg: 'bg-blue-500/10', iconColor: 'text-blue-500' },
  { label: 'Renewals Due', key: 'renewals_due' as const, icon: RefreshCw, subtitle: 'Contracts needing renewal', bg: 'bg-amber-500/10', iconColor: 'text-amber-500' },
  { label: 'Pending Approvals', key: 'pending_approvals' as const, icon: CheckCircle, subtitle: 'Awaiting your decision', bg: 'bg-purple-500/10', iconColor: 'text-purple-500' },
  { label: 'Overdue Invoices', key: 'overdue_invoices' as const, icon: AlertTriangle, subtitle: 'Payments past due', bg: 'bg-rose-500/10', iconColor: 'text-rose-500' },
]

export function DashboardHero({ data }: DashboardHeroProps) {
  const { user } = useAuthStore()
  const s = data?.summary

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const name = user?.name || user?.username || 'User'

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const attentionCount =
    (s?.renewals_due || 0) + (s?.pending_approvals || 0) + (s?.overdue_invoices || 0)

  const [minutesAgo, setMinutesAgo] = useState<number | null>(null)

  useEffect(() => {
    const update = () => {
      if (data?.health?.timestamp) {
        const diff = Math.floor((Date.now() - new Date(data.health.timestamp).getTime()) / 60000)
        setMinutesAgo(diff)
      }
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [data?.health?.timestamp])

  return (
    <section>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{greeting}, {name} 👋</h1>
          <p className="text-sm text-muted-foreground">{today}</p>
          <p className="text-sm text-muted-foreground">
            {attentionCount > 0 ? (
              <>You have <span className="font-semibold text-foreground">{attentionCount}</span> contracts requiring attention today.</>
            ) : (
              <>Everything looks healthy today.</>
            )}
          </p>
        </div>
        {minutesAgo !== null && (
          <span className="text-xs text-muted-foreground/60 whitespace-nowrap">
            Last updated {minutesAgo === 0 ? 'just now' : `${minutesAgo} min ago`}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        {cards.map(card => {
          const Icon = card.icon
          const value = s?.[card.key] ?? 0
          return (
            <div
              key={card.label}
              className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className={`p-1.5 rounded-lg w-fit ${card.bg} mb-3`}>
                <Icon className={`w-4 h-4 ${card.iconColor}`} />
              </div>
              <div className="text-xl font-bold">{value.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{card.label}</div>
              <div className="text-[10px] text-muted-foreground/70">{card.subtitle}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
