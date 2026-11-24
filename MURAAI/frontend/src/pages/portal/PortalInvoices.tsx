import { useQuery } from '@tanstack/react-query'
import { Download, FileText, Receipt, AlertCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { customerPortalApi } from '@/api/customerPortal'

export function PortalInvoices() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['portal', 'invoices'],
    queryFn: customerPortalApi.getInvoices,
  })

  const handleDownload = async (invoiceId: number) => {
    try {
      const blob = await customerPortalApi.downloadInvoice(invoiceId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${invoiceId}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Invoice downloaded')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Download failed')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">My Invoices</h1>
        <p className="text-sm text-muted-foreground">View and download your invoices</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-12 text-destructive border border-destructive/20 bg-destructive/10 rounded-xl">
          <AlertCircle className="w-10 h-10 mb-3 opacity-80" aria-hidden="true" />
          <p className="font-medium text-sm">Failed to load invoices.</p>
          <button
            onClick={() => refetch()}
            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Receipt className="w-10 h-10 mb-3 opacity-50" aria-hidden="true" />
          <p className="font-medium text-sm">No invoices found.</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl divide-y divide-border">
          {data.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : ''}
                    {inv.due_date ? ` · Due: ${new Date(inv.due_date).toLocaleDateString()}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold">{inv.amount.toLocaleString()}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  inv.status === 'PAID' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  inv.status === 'ISSUED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                  inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  inv.status === 'DRAFT' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
                  'bg-muted text-muted-foreground'
                }`}>{inv.status}</span>
                <button
                  onClick={() => handleDownload(inv.id)}
                  className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                  title="Download CSV"
                  aria-label={`Download invoice ${inv.invoice_number}`}
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}