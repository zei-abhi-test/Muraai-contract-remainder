import { FileSearch } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'

export function AuditLogsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="View system activity and audit trails."
        breadcrumbs={[{ label: 'Audit Logs' }]}
      />

      <div className="bg-card border border-border rounded-xl p-6">
        <EmptyState
          icon={FileSearch}
          title="No audit logs available"
          description="System activity logs will appear here once actions are performed."
        />
      </div>
    </div>
  )
}
