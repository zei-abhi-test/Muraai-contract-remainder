import api from './axios'

export interface Document {
  id: number
  contract_id: number | null
  invoice_id: number | null
  po_id: number | null
  file_name: string
  stored_file_name: string
  content_type: string | null
  file_size: number | null
  file_type: string | null
  category: string | null
  storage_provider: string | null
  storage_reference: string | null
  version_group_id: string | null
  version: number | null
  is_latest_version: boolean | null
  uploaded_at: string
  uploaded_by_id: number | null
  uploaded_by_name: string | null
  created_at: string | null
  updated_at: string | null
}

export interface PaginatedDocuments {
  documents: Document[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface UploadResult {
  documents: Document[]
  errors: { file: string; error: string }[]
}

export interface DocumentFilters {
  search?: string
  file_type?: string
  category?: string
  entity_type?: string
  page?: number
  per_page?: number
}

export const documentsApi = {
  getDocuments: async (params?: DocumentFilters): Promise<PaginatedDocuments> => {
    const response = await api.get('/documents', { params })
    return response.data as PaginatedDocuments
  },

  getDocument: async (id: number): Promise<Document> => {
    const response = await api.get(`/documents/${id}`)
    return response.data as Document
  },

  getContractDocuments: async (contractId: number): Promise<Document[]> => {
    const response = await api.get(`/contracts/${contractId}/documents`)
    return response.data as Document[]
  },

  uploadDocument: async (
    file: File,
    entityType?: string,
    entityId?: number,
    category?: string,
    onProgress?: (progress: number) => void,
  ): Promise<UploadResult> => {
    const formData = new FormData()
    formData.append('file', file)
    if (category) formData.append('category', category)

    const params: Record<string, string | number> = {}
    if (entityType) params.entity_type = entityType
    if (entityId) params.entity_id = entityId

    const response = await api.post('/documents/upload', formData, {
      params,
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total))
        }
      },
    })
    return response.data as UploadResult
  },

  uploadContractDocument: async (
    contractId: number,
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<Document> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post(`/contracts/${contractId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total))
        }
      },
    })
    return response.data as Document
  },

  deleteDocument: async (id: number): Promise<void> => {
    await api.delete(`/documents/${id}`)
  },

  getPreviewUrl: async (id: number): Promise<string> => {
    const baseUrl = api.defaults.baseURL || ''
    return `${baseUrl}/documents/${id}/preview`
  },

  downloadDocument: async (id: number): Promise<Blob> => {
    const response = await api.get(`/documents/${id}/download`, {
      responseType: 'blob',
    })
    return response.data as Blob
  },

  replaceDocument: async (id: number, file: File): Promise<Document> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post(`/documents/${id}/replace`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data as Document
  },

  getVersionHistory: async (id: number): Promise<Document[]> => {
    const response = await api.get(`/documents/${id}/versions`)
    return response.data as Document[]
  },
}

export default documentsApi
