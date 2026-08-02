import { FileText, Download, Upload } from 'lucide-react'
import { Card, Button } from '@/components/ui'
import { formatDate } from '../_utils'
import type { RenewalWorkspaceData } from '../renewalWorkspaceMockData'

export function DocumentsSection({ data }: { data: RenewalWorkspaceData }) {
  return (
    <div className="space-y-3" role="list" aria-label="Renewal documents">
      {data.documents.map((doc) => (
        <Card key={doc.id} variant="interactive" padding="md" role="listitem">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-primary/10 text-primary" aria-hidden="true">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{doc.fileName}</p>
              <p className="text-xs text-muted-foreground">{doc.type} &middot; {doc.size} &middot; {doc.uploadedBy}</p>
            </div>
            <div className="text-xs text-muted-foreground hidden sm:block">{formatDate(doc.uploadedAt)}</div>
            <Button variant="ghost" size="sm" icon={<Download className="w-4 h-4" />} aria-label={`Download ${doc.fileName}`} />
          </div>
        </Card>
      ))}
      <Button variant="ghost" className="w-full" icon={<Upload className="w-4 h-4" />}>
        Upload Document
      </Button>
    </div>
  )
}
