import { MessageSquare, Plus } from 'lucide-react'
import { Card, Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatDate, directionBadge, commStyle } from '../_utils'
import type { RenewalWorkspaceData, RenewalCommEntry } from '../renewalWorkspaceMockData'

interface Props {
  data: RenewalWorkspaceData
  party: 'vendor' | 'customer'
}

const partyConfig = {
  vendor: {
    label: 'Vendor Communication',
    entries: (d: RenewalWorkspaceData) => d.vendorCommunications,
    emptyMsg: 'No vendor communications logged',
    addLabel: 'Log Vendor Communication',
  },
  customer: {
    label: 'Customer Communication',
    entries: (d: RenewalWorkspaceData) => d.customerCommunications,
    emptyMsg: 'No customer communications logged',
    addLabel: 'Log Customer Communication',
  },
}

export function CommunicationSection({ data, party }: Props) {
  const config = partyConfig[party]
  const entries = config.entries(data)

  return (
    <div className="space-y-3" role="list" aria-label={config.label}>
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mb-2 opacity-50" aria-hidden="true" />
          <p className="text-sm">{config.emptyMsg}</p>
        </div>
      ) : (
        entries.map((c) => <CommCard key={c.id} entry={c} />)
      )}
      <Button variant="ghost" className="w-full" icon={<Plus className="w-4 h-4" />}>
        {config.addLabel}
      </Button>
    </div>
  )
}

function CommCard({ entry }: { entry: RenewalCommEntry }) {
  const style = commStyle[entry.type]
  const Icon = style?.icon || MessageSquare

  return (
    <Card variant="interactive" padding="md" role="listitem">
      <div className="flex gap-4">
        <div className={cn('p-2.5 rounded-lg flex-shrink-0', style?.bg || '')} aria-hidden="true">
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{entry.subject}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{entry.type}</span>
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', directionBadge[entry.direction] || '')}>
              {entry.direction}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{entry.summary}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span>{entry.from}</span>
            <span aria-hidden="true">&rarr;</span>
            <span>{entry.to}</span>
            <span>{formatDate(entry.timestamp)}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
