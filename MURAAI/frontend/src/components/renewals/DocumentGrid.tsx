import { FileText, Download, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from './_utils'
import type { RenewalDocument } from './renewalWorkspaceMockData'

interface DocumentGridProps {
  documents: RenewalDocument[]
  className?: string
}

const statusStyles: Record<string, { icon: typeof FileText; color: string; bg: string; label: string }> = {
  uploaded: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-950/30', label: 'Uploaded' },
  required: { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-950/30', label: 'Required' },
  missing: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-950/30', label: 'Missing' },
  expired: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-950/30', label: 'Expired' },
}

export function DocumentGrid({ documents, className }: DocumentGridProps) {
  const grouped = {
    uploaded: documents.filter(d => d.status === 'uploaded'),
    required: documents.filter(d => d.status === 'required'),
    missing: documents.filter(d => d.status === 'missing'),
    expired: documents.filter(d => d.status === 'expired'),
  }

  return (
    <div className={cn('space-y-3', className)}>
      {(grouped.missing.length > 0 || grouped.expired.length > 0) && (
        <div className="space-y-1">
          {grouped.missing.map((doc) => (
            <DocRow key={doc.id} doc={doc} />
          ))}
          {grouped.expired.map((doc) => (
            <DocRow key={doc.id} doc={doc} />
          ))}
        </div>
      )}
      {grouped.required.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Required</p>
          {grouped.required.map((doc) => (
            <DocRow key={doc.id} doc={doc} />
          ))}
        </div>
      )}
      {grouped.uploaded.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Uploaded</p>
          {grouped.uploaded.map((doc) => (
            <DocRow key={doc.id} doc={doc} />
          ))}
        </div>
      )}
      {documents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <FileText className="w-6 h-6 mb-2 opacity-50" />
          <p className="text-sm">No documents</p>
          <p className="text-xs">Required documents will appear here</p>
        </div>
      )}
    </div>
  )
}

function DocRow({ doc }: { doc: RenewalDocument }) {
  const ss = statusStyles[doc.status]
  const Icon = ss?.icon || FileText

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-accent/30 transition-colors group">
      <div className={cn('p-1 rounded', ss?.bg || 'bg-muted')}>
        <Icon className={cn('w-3 h-3', ss?.color || 'text-muted-foreground')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{doc.fileName}</p>
        <p className="text-[10px] text-muted-foreground">
          {doc.type}{doc.size ? ` · ${doc.size}` : ''}{doc.uploadedBy ? ` · ${doc.uploadedBy}` : ''}{doc.uploadedAt ? ` · ${formatDate(doc.uploadedAt)}` : ''}
        </p>
      </div>
      {doc.status === 'uploaded' && (
        <button className="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Download ${doc.fileName}`}>
          <Download className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}
      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0', ss?.bg, ss?.color)}>{ss?.label}</span>
    </div>
  )
}
