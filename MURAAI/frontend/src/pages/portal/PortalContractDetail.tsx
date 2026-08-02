import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, FileText, Clock, DollarSign, Calendar, RefreshCw, FileIcon } from 'lucide-react'
import { toast } from 'sonner'

import { customerPortalApi } from '@/api/customerPortal'

export function PortalContractDetail() {
  const { contractId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'documents'>('details')

  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'contract', Number(contractId)],
    queryFn: () => customerPortalApi.getContractDetail(Number(contractId)),
    enabled: !!contractId,
  })

  const documentsQuery = useQuery({
    queryKey: ['portal', 'contract', Number(contractId), 'documents'],
    queryFn: () => customerPortalApi.getDocuments(Number(contractId)),
    enabled: activeTab === 'documents' && !!contractId,
  })

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file || !contractId) return
    setUploading(true)
    try {
      await customerPortalApi.uploadDocument(Number(contractId), file)
      toast.success('Document uploaded successfully')
      qc.invalidateQueries({ queryKey: ['portal', 'contract', Number(contractId), 'documents'] })
      if (fileRef.current) fileRef.current.value = ''
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
        <div className="h-7 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <FileIcon className="w-12 h-12 mb-4 opacity-50" aria-hidden="true" />
        <p className="font-medium">Contract not found.</p>
        <button onClick={() => navigate('/portal/contracts')} className="text-sm text-primary hover:underline mt-2">Back to contracts</button>
      </div>
    )
  }

  const daysLeft = data.days_until_end

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/portal/contracts')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" aria-label="Back to contracts">
        <ArrowLeft className="w-4 h-4" /> Back to Contracts
      </button>

      <div>
        <h1 className="text-xl font-bold">{data.contract_name}</h1>
        <p className="text-sm text-muted-foreground">{data.company_name}{data.contract_number ? ` · ${data.contract_number}` : ''}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Calendar className="w-3.5 h-3.5" aria-hidden="true" /> Status</div>
          <span className={`text-sm font-semibold px-2 py-0.5 rounded ${
            data.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
            data.status === 'Expired' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted text-muted-foreground'
          }`}>{data.status}</span>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Clock className="w-3.5 h-3.5" aria-hidden="true" /> Days Remaining</div>
          <p className="text-lg font-bold">{daysLeft !== null ? daysLeft : 'N/A'}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><DollarSign className="w-3.5 h-3.5" aria-hidden="true" /> Value</div>
          <p className="text-lg font-bold">{data.total_contract_value.toLocaleString()} {data.currency}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Renewal</div>
          <p className="text-lg font-bold">{data.renewal_date ? new Date(data.renewal_date).toLocaleDateString() : 'N/A'}</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border" role="tablist" aria-label="Contract detail tabs">
        {(['details', 'documents'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            role="tab"
            aria-selected={activeTab === tab}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >{tab}</button>
        ))}
      </div>

      {activeTab === 'details' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Contract Dates</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Start Date</span><span>{data.start_date ? new Date(data.start_date).toLocaleDateString() : 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">End Date</span><span>{data.end_date ? new Date(data.end_date).toLocaleDateString() : 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Renewal Date</span><span>{data.renewal_date ? new Date(data.renewal_date).toLocaleDateString() : 'N/A'}</span></div>
            </div>

            {data.notes && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Notes</h3>
                <p className="text-sm">{data.notes}</p>
              </div>
            )}

            {data.renewal_info && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Renewal Info</h3>
                <p className="text-sm text-muted-foreground">
                  Renewed on {new Date(data.renewal_info.renewed_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {data.line_items.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Line Items</h3>
              <div className="border border-border rounded-lg divide-y divide-border">
                {data.line_items.map((li: any) => (
                  <div key={li.id} className="px-3 py-2 flex items-center justify-between text-sm">
                    <span className="font-medium">{li.product_name}</span>
                    <span className="text-muted-foreground">{li.quantity} x {Number(li.rate).toLocaleString()} = {Number(li.line_total).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <input ref={fileRef} type="file" className="flex-1 text-sm" aria-label="Select document to upload" />
            <button
              onClick={handleUpload} disabled={uploading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" /> {uploading ? 'Uploading...' : 'Upload Signed Document'}
            </button>
          </div>

          <div className="border border-border rounded-lg divide-y divide-border">
            {documentsQuery.isLoading ? (
              <div className="p-4 space-y-2">{[1, 2].map((i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}</div>
            ) : documentsQuery.data?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText className="w-8 h-8 mb-2 opacity-50" aria-hidden="true" />
                <p className="text-sm">No documents uploaded yet.</p>
              </div>
            ) : (
              documentsQuery.data?.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">{doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString() : ''}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}