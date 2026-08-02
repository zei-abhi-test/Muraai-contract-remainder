import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentsApi } from '@/api/documents'
import { queryKeys } from '@/lib/react-query'
import { getApiErrorMessage } from '@/lib/errors'
import { toast } from 'sonner'
import type { DocumentFilters } from '@/api/documents'
import { activityKeys } from '@/hooks/useActivity'

function invalidateAllDocRelated(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.documents.lists() })
  queryClient.invalidateQueries({ queryKey: queryKeys.documents.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() })
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() })
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() })
  queryClient.invalidateQueries({ queryKey: activityKeys.all })
}

export function useDocuments(filters: DocumentFilters = {}) {
  return useQuery({
    queryKey: queryKeys.documents.list(filters),
    queryFn: () => documentsApi.getDocuments(filters),
  })
}

export function useDocument(id: number) {
  return useQuery({
    queryKey: queryKeys.documents.detail(id),
    queryFn: () => documentsApi.getDocument(id),
    enabled: !!id,
  })
}

export function useContractDocuments(contractId: number) {
  return useQuery({
    queryKey: queryKeys.contracts.documents(contractId),
    queryFn: () => documentsApi.getContractDocuments(contractId),
    enabled: !!contractId,
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ file, entityType, entityId, category, onProgress }: {
      file: File
      entityType?: string
      entityId?: number
      category?: string
      onProgress?: (p: number) => void
    }) => documentsApi.uploadDocument(file, entityType, entityId, category, onProgress),
    onSuccess: () => {
      toast.success('Document uploaded successfully')
      invalidateAllDocRelated(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to upload document'))
    },
  })
}

export function useUploadContractDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ contractId, file, onProgress }: {
      contractId: number
      file: File
      onProgress?: (p: number) => void
    }) => documentsApi.uploadContractDocument(contractId, file, onProgress),
    onSuccess: () => {
      toast.success('Document uploaded successfully')
      invalidateAllDocRelated(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to upload document'))
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => documentsApi.deleteDocument(id),
    onSuccess: () => {
      toast.success('Document deleted successfully')
      invalidateAllDocRelated(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete document'))
    },
  })
}

export function useDocumentPreview(id: number) {
  return useQuery({
    queryKey: queryKeys.documents.preview(id),
    queryFn: () => documentsApi.getPreviewUrl(id),
    enabled: !!id,
  })
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: (id: number) => documentsApi.downloadDocument(id),
    onSuccess: (blob, id) => {
      try {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `document-${id}`
        a.click()
        URL.revokeObjectURL(url)
      } catch {
        toast.error('Failed to prepare document download')
      }
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to download document'))
    },
  })
}

export function useReplaceDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) =>
      documentsApi.replaceDocument(id, file),
    onSuccess: () => {
      toast.success('Document replaced successfully')
      invalidateAllDocRelated(queryClient)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to replace document'))
    },
  })
}

export function useDocumentVersions(id: number) {
  return useQuery({
    queryKey: queryKeys.documents.versions(id),
    queryFn: () => documentsApi.getVersionHistory(id),
    enabled: !!id,
  })
}
