const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

class ApiService {
  private token: string | null = null

  constructor() {
    this.token = localStorage.getItem('muraai_token')
  }

  setToken(token: string) {
    this.token = token
    localStorage.setItem('muraai_token', token)
  }

  clearToken() {
    this.token = null
    localStorage.removeItem('muraai_token')
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }))
      throw new Error(error.message || error.error || 'Request failed')
    }

    return response.json()
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async register(username: string, email: string, password: string) {
    return this.request<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    })
  }

  // Customers
  async getCustomers() {
    return this.request<any[]>('/customers')
  }

  async createCustomer(data: any) {
    return this.request<any>('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getCustomer(id: string) {
    return this.request<any>(`/customers/${id}`)
  }

  async updateCustomer(id: string, data: any) {
    return this.request<any>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteCustomer(id: string) {
    return this.request<any>(`/customers/${id}`, {
      method: 'DELETE',
    })
  }

  // Contacts
  async getContacts() {
    return this.request<any[]>('/contacts')
  }

  async createContact(customerId: string, data: any) {
    return this.request<any>(`/customers/${customerId}/contacts`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Contracts
  async getContracts() {
    return this.request<any[]>('/contracts')
  }

  async getContract(id: string) {
    return this.request<any>(`/contracts/${id}`)
  }

  async createContract(data: any) {
    return this.request<any>('/contracts', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateContract(id: string, data: any) {
    return this.request<any>(`/contracts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteContract(id: string) {
    return this.request<any>(`/contracts/${id}`, {
      method: 'DELETE',
    })
  }

  async getContractLineItems(contractId: string) {
    return this.request<any[]>(`/contracts/${contractId}/line-items`)
  }

  async getContractDocuments(contractId: string) {
    return this.request<any[]>(`/contracts/${contractId}/documents`)
  }

  async getContractRenewalHistory(contractId: string) {
    return this.request<any[]>(`/contracts/${contractId}/renewal-history`)
  }

  async renewContract(contractId: string, data: any) {
    return this.request<any>(`/contracts/${contractId}/renew`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async uploadContractDocument(contractId: string, file: File) {
    const formData = new FormData()
    formData.append('document', file)

    const url = `${API_BASE_URL}/contracts/${contractId}/documents`
    const headers: HeadersInit = {}

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }))
      throw new Error(error.message || 'Upload failed')
    }

    return response.json()
  }

  // Dashboard
  async getDashboard() {
    return this.request<any>('/contracts/dashboard')
  }

  // Notifications
  async getNotifications() {
    return this.request<any[]>('/notifications')
  }

  async markNotificationAsRead(id: string) {
    return this.request<any>(`/notifications/${id}/read`, {
      method: 'PUT',
    })
  }

  // Import/Export
  async importContracts(csvFile: File) {
    const formData = new FormData()
    formData.append('file', csvFile)

    const url = `${API_BASE_URL}/contracts/import`
    const headers: HeadersInit = {}

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Import failed' }))
      throw new Error(error.message || 'Import failed')
    }

    return response.json()
  }

  async exportContracts(format: 'csv' | 'excel' = 'csv') {
    const url = `${API_BASE_URL}/contracts/export?format=${format}`
    const headers: HeadersInit = {}

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(url, {
      headers,
    })

    if (!response.ok) {
      throw new Error('Export failed')
    }

    return response.blob()
  }
}

export const apiService = new ApiService()
