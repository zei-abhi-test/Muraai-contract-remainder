import { Card, SectionHeader } from '@/components/ui'
import { Timeline, TimelineItem } from '@/components/ui'
import { formatDate, getActivityStyle } from '../_utils'
import type { RenewalWorkspaceData } from '../renewalWorkspaceMockData'

export function ActivitySection({ data }: { data: RenewalWorkspaceData }) {
  return (
    <Card>
      <SectionHeader title="Activity Log" size="sm" />
      <div className="mt-4" role="log" aria-label="Renewal activity log" aria-live="polite">
        <Timeline>
          {data.activity.map((a) => {
            const s = getActivityStyle(a.type)
            return (
              <TimelineItem
                key={a.id}
                icon={s.icon}
                iconColor={s.color}
                iconBgColor={s.bg}
                title={a.title}
                description={a.description}
                time={formatDate(a.timestamp)}
              />
            )
          })}
        </Timeline>
      </div>
    </Card>
  )
}
