import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileText, Package, RefreshCw, FolderOpen, Clock, History, DollarSign, Calendar, Building2, Loader2 } from 'lucide-react'
import { useContract, useContractLineItems, useContractDocuments, useRenewalHistory } from '@/hooks/useContracts'

interface ContractDetailsProps {
  isOpen: boolean
  onClose: () => void
  contractId: number
}

export function ContractDetails({ isOpen, onClose, contractId }: ContractDetailsProps) {
  const [activeTab, setActiveTab] = useState('overview')

  const { data: contract, isLoading: contractLoading } = useContract(contractId)
  const { data: lineItems, isLoading: lineItemsLoading } = useContractLineItems(contractId)
  const { data: documents, isLoading: documentsLoading } = useContractDocuments(contractId)
  const { data: renewalHistory, isLoading: historyLoading } = useRenewalHistory(contractId)

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'timeline', label: 'Timeline', icon: History },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'documents', label: 'Documents', icon: FolderOpen },
  ]

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getDaysUntil = (dateString: string) => {
    const today = new Date()
    const targetDate = new Date(dateString)
    const diffTime = targetDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const renderTabContent = () => {
    if (contractLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Total Value</span>
                </div>
                <div className="text-2xl font-bold">₹{contract?.total_contract_value?.toLocaleString() || '0'}</div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">End Date</span>
                </div>
                <div className="text-2xl font-bold">{contract?.end_date ? formatDate(contract.end_date) : 'N/A'}</div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Days Left</span>
                </div>
                <div className="text-2xl font-bold">{contract?.end_date ? getDaysUntil(contract.end_date) : 'N/A'}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 border border-border rounded-lg">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Customer Information
                </h3>
                  <div className="space-y-2 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> {contract?.company_name || 'N/A'}</div>
                  <div><span className="text-muted-foreground">Customer ID:</span> {contract?.customer_id || 'N/A'}</div>
                  <div><span className="text-muted-foreground">Contact Person ID:</span> {contract?.contact_person_id || 'N/A'}</div>
                </div>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Contract Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div><span className="text-muted-foreground">Contract Number:</span> {contract?.contract_number || 'N/A'}</div>
                  <div><span className="text-muted-foreground">Status:</span> {contract?.status || 'N/A'}</div>
                  <div><span className="text-muted-foreground">Payment Terms:</span> {contract?.payment_terms || 'N/A'}</div>
                  <div><span className="text-muted-foreground">Currency:</span> {contract?.currency || 'INR'}</div>
                </div>
              </div>
            </div>

            <div className="p-4 border border-border rounded-lg">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Line Items
              </h3>
              {lineItemsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : lineItems && lineItems.length > 0 ? (
                <div className="space-y-2">
                  {lineItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <div>
                        <div className="font-medium">{item.product_name || 'No description'}</div>
                        <div className="text-sm text-muted-foreground">{item.quantity} x ₹{item.rate?.toFixed(2) || '0.00'}</div>
                      </div>
                      <div className="font-semibold">₹{item.line_total?.toFixed(2) || '0.00'}</div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-border font-bold">
                    <span>Total</span>
                    <span>₹{contract?.total_contract_value?.toLocaleString() || '0'}</span>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">No line items found</p>
              )}
            </div>
          </div>
        )

      case 'timeline':
        return (
          <div className="space-y-4">
            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : renewalHistory && renewalHistory.length > 0 ? (
              renewalHistory.map((event, index) => (
                <div key={event.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white bg-blue-500`}>
                      <FileText className="w-4 h-4" />
                    </div>
                    {index < renewalHistory.length - 1 && (
                      <div className="w-0.5 flex-1 bg-border mt-2" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="font-medium">Contract {event.status || 'Updated'}</div>
                    <div className="text-sm text-muted-foreground">
                      {event.start_date ? formatDate(event.start_date) : 'N/A'} - {event.end_date ? formatDate(event.end_date) : 'N/A'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">No timeline events found</p>
            )}
          </div>
        )

      case 'products':
        return (
          <div className="space-y-4">
            {lineItemsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : lineItems && lineItems.length > 0 ? (
              lineItems.map((item) => (
                <div key={item.id} className="p-4 border border-border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{item.product_name || 'No description'}</div>
                      <div className="text-sm text-muted-foreground">Quantity: {item.quantity}</div>
                      <div className="text-sm text-muted-foreground">Rate: ₹{item.rate?.toFixed(2) || '0.00'}</div>
                    </div>
                    <div className="font-semibold">₹{item.line_total?.toFixed(2) || '0.00'}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">No line items found</p>
            )}
          </div>
        )

      case 'documents':
        return (
          <div className="space-y-4">
            {documentsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : documents && documents.length > 0 ? (
              documents.map((doc) => (
                <div key={doc.id} className="p-4 border border-border rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{doc.file_name}</div>
                      <div className="text-sm text-muted-foreground">{doc.content_type}</div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {doc.uploaded_at ? formatDate(doc.uploaded_at) : 'N/A'}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">No documents found</p>
            )}
          </div>
        )

      default:
        return null
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full bg-card border-l border-border z-50 w-[800px] flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">{contract?.contract_name || 'Contract Details'}</h2>
              <p className="text-muted-foreground">{contract?.contract_number || 'N/A'}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              contract?.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              {contract?.status || 'Unknown'}
            </span>
            <span className="text-sm text-muted-foreground">{contract?.company_name || 'N/A'}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <nav className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderTabContent()}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex items-center justify-between">
          <button className="px-4 py-2 border border-input rounded-lg hover:bg-accent">
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Renew Contract
          </button>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 border border-input rounded-lg hover:bg-accent">
              Edit
            </button>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              Print
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
