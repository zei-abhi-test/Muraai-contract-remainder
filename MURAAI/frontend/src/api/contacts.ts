import api from './axios'

// Types
export interface Contact {
  id: number
  customer_id: number
  contact_name: string
  contact_number: string
  email: string | null
  designation: string | null
  created_at: string
  updated_at: string
  user_id: number
}

export interface CreateContactData {
  contact_name: string
  contact_number: string
  email?: string
  designation?: string
}

// Contacts API
export const contactsApi = {
  // Get all contacts
  getContacts: async (customerId?: number): Promise<Contact[]> => {
    const params = customerId ? { customer_id: customerId } : {}
    const response = await api.get('/contacts', { params })
    return response.data as Contact[]
  },

  // Get contacts for specific customer
  getCustomerContacts: async (customerId: number): Promise<Contact[]> => {
    const response = await api.get(`/customers/${customerId}/contacts`)
    return response.data as Contact[]
  },

  // Create contact for customer
  createCustomerContact: async (customerId: number, data: CreateContactData): Promise<Contact> => {
    const response = await api.post(`/customers/${customerId}/contacts`, data)
    return response.data as Contact
  },

  // Update contact
  updateContact: async (contactId: number, data: Partial<CreateContactData>): Promise<Contact> => {
    const response = await api.put(`/contacts/${contactId}`, data)
    return response.data as Contact
  },

  // Delete contact
  deleteContact: async (contactId: number): Promise<void> => {
    await api.delete(`/contacts/${contactId}`)
  },
}

export default contactsApi
