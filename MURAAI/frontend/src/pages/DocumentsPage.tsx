import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileText, Download, Trash2, RefreshCw, X, Eye,
  Loader2, FolderOpen, Image, FileSpreadsheet,
  AlertCircle, Clock,
} from 'lucide-react'
import {
  useDocuments, useUploadDocument, useDeleteDocument,
  useDownloadDocument, useReplaceDocument, useDocumentVersions,
} from '@/hooks/useDocuments'
import { toast } from 'sonner'
import { PageHeader, DataTable, type Column } from '@/components/ui'

const FILE_TYPE_ICONS: Record<string, any> = {
  pdf: FileText,
  docx: FileText,
  doc: FileText,
  png: Image,
  jpg: Image,
  jpeg: Image,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
}

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: 'text-red-500 bg-red-100 dark:bg-red-900/30',
  docx: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
  doc: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
  png: 'text-green-500 bg-green-100 dark:bg-green-900/30',
  jpg: 'text-green-500 bg-green-100 dark:bg-green-900/30',
  jpeg: 'text-green-500 bg-green-100 dark:bg-green-900/30',
  xlsx: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30',
  csv: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30',
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

function formatDate(dateString: string | null) {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function FileIcon({ fileType }: { fileType: string | null }) {
  const Icon = FILE_TYPE_ICONS[fileType || ''] || FileText
  const cls = FILE_TYPE_COLORS[fileType || ''] || 'text-gray-500 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30'
  return (
    <div className={`p-2 rounded-lg ${cls}`}>
      <Icon className="w-5 h-5" />
    </div>
  )
}

function UploadZone({ onFilesSelected, isUploading, progress }: {
  onFilesSelected: (files: File[]) => void
  isUploading: boolean
  progress: number
}) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files))
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-muted/30'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.xlsx,.csv"
        onChange={(e) => {
          if (e.target.files) onFilesSelected(Array.from(e.target.files))
          e.target.value = ''
        }}
        className="hidden"
      />
      <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
      <p className="font-medium mb-1">Drop files here or click to upload</p>
      <p className="text-sm text-muted-foreground">
        PDF, DOCX, DOC, PNG, JPG, XLSX, CSV (max 50 MB)
      </p>
      {isUploading && (
        <div className="mt-4 max-w-xs mx-auto">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Uploading... {progress}%</p>
        </div>
      )}
    </div>
  )
}

function PreviewModal({ docId, onClose }: { docId: number; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const baseUrl = '/api'
  const previewUrl = `${baseUrl}/documents/${docId}/preview`

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold">Document Preview</h3>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 bg-muted/30 min-h-[60vh] relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <AlertCircle className="w-6 h-6 mr-2" /> Preview not available
            </div>
          ) : (
            <iframe
              src={previewUrl}
              className="w-full h-full min-h-[60vh]"
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setError(true) }}
              title="Document Preview"
            />
          )}
        </div>
      </motion.div>
    </div>
  )
}

function VersionHistoryModal({ docId, onClose }: { docId: number; onClose: () => void }) {
  const { data: versions, isLoading } = useDocumentVersions(docId)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4" /> Version History
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : !versions?.length ? (
            <p className="text-center text-muted-foreground py-8">No version history</p>
          ) : (
            versions.map((v) => (
              <div key={v.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  v.is_latest_version ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  v{v.version || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{v.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(v.uploaded_at)} {v.is_latest_version && '(latest)'}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{formatFileSize(v.file_size)}</span>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  )
}

export function DocumentsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewDocId, setPreviewDocId] = useState<number | null>(null)
  const [versionsDocId, setVersionsDocId] = useState<number | null>(null)

  const { data, isLoading, isError } = useDocuments({ search: search || undefined, page, per_page: 20 })
  const uploadMutation = useUploadDocument()
  const deleteMutation = useDeleteDocument()
  const downloadMutation = useDownloadDocument()
  const replaceMutation = useReplaceDocument()

  const documents = data?.documents || []
  const totalPages = data?.pages || 0
  const total = data?.total || 0

  const handleFilesSelected = useCallback(async (files: File[]) => {
    setSelectedFiles(files)
    setUploading(true)
    setUploadProgress(0)

    for (let i = 0; i < files.length; i++) {
      try {
        await uploadMutation.mutateAsync({
          file: files[i],
          onProgress: (p) => setUploadProgress(Math.round(((i * 100 + p) / files.length))),
        })
      } catch {
        // Error handled in mutation
      }
    }

    setUploading(false)
    setSelectedFiles([])
    setShowUpload(false)
  }, [uploadMutation])

  const handleDownload = (id: number) => {
    downloadMutation.mutate(id)
  }

  const handleDelete = (id: number, fileName: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success(`"${fileName}" deleted`),
      onError: (err: any) => toast.error(err?.response?.data?.error || err?.message || 'Failed to delete document'),
    })
  }

  const handleReplace = (id: number) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.docx,.doc,.png,.jpg,.jpeg,.xlsx,.csv'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) replaceMutation.mutate({ id, file })
    }
    input.click()
  }

  const docColumns: Column<any>[] = [
    {
      key: 'file_name',
      header: 'Name',
      sortable: true,
      render: doc => (
        <div className="flex items-center gap-3">
          <FileIcon fileType={doc.file_type} />
          <div className="min-w-0">
            <div className="font-medium truncate max-w-[250px]">{doc.file_name}</div>
            {doc.category && <span className="text-xs text-muted-foreground">{doc.category}</span>}
          </div>
        </div>
      ),
    },
    { key: 'file_type', header: 'Type', render: doc => <span className="uppercase text-xs font-medium text-muted-foreground">{doc.file_type || '-'}</span> },
    { key: 'file_size', header: 'Size', render: doc => <span className="text-sm text-muted-foreground">{formatFileSize(doc.file_size)}</span> },
    {
      key: 'version',
      header: 'Version',
      render: doc => <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted">v{doc.version || 1}</span>,
    },
    { key: 'uploaded_at', header: 'Uploaded', sortable: true, hideable: true, render: doc => <span className="text-sm text-muted-foreground">{formatDate(doc.uploaded_at)}</span> },
    { key: 'uploaded_by_name', header: 'Uploaded By', hideable: true, render: doc => <span className="text-sm text-muted-foreground">{doc.uploaded_by_name || 'Unknown'}</span> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Manage all your documents across contracts, invoices, and purchase orders."
        breadcrumbs={[{ label: 'Documents' }]}
        action={
          <button onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium">
            <Upload className="w-4 h-4" /> Upload
          </button>
        }
      />

      {/* Upload Zone */}
      <AnimatePresence>
        {showUpload && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <UploadZone onFilesSelected={handleFilesSelected} isUploading={uploading} progress={uploadProgress} />
          </motion.div>
        )}
      </AnimatePresence>

      <DataTable
        columns={docColumns}
        data={documents}
        keyExtractor={doc => doc.id}
        isLoading={isLoading}
        error={isError ? 'Failed to load documents.' : null}
        emptyMessage={search ? 'No documents match your search.' : 'No documents found'}
        emptyAction={!search ? {
          label: 'Upload Document',
          onClick: () => setShowUpload(true),
        } : undefined}
        searchQuery={search}
        onSearchChange={v => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search documents..."
        totalPages={totalPages}
        totalItems={total}
        pageSize={20}
        currentPage={page}
        onPageChange={setPage}
        rowActions={(doc) => (
          <div className="flex items-center gap-0.5">
            <button onClick={() => setPreviewDocId(doc.id)} className="p-1.5 hover:bg-accent rounded" title="Preview" aria-label={`Preview ${doc.file_name}`}>
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleDownload(doc.id)} className="p-1.5 hover:bg-accent rounded" title="Download" aria-label={`Download ${doc.file_name}`}>
              <Download className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleReplace(doc.id)} className="p-1.5 hover:bg-accent rounded" title="Replace" aria-label={`Replace ${doc.file_name}`}>
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setVersionsDocId(doc.id)} className="p-1.5 hover:bg-accent rounded" title="Version History" aria-label={`Version history for ${doc.file_name}`}>
              <Clock className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleDelete(doc.id, doc.file_name)} className="p-1.5 hover:bg-accent rounded text-destructive" title="Delete" aria-label={`Delete ${doc.file_name}`}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      />

      {/* Preview Modal */}
      <AnimatePresence>
        {previewDocId && (
          <PreviewModal docId={previewDocId} onClose={() => setPreviewDocId(null)} />
        )}
      </AnimatePresence>

      {/* Version History Modal */}
      <AnimatePresence>
        {versionsDocId && (
          <VersionHistoryModal docId={versionsDocId} onClose={() => setVersionsDocId(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
