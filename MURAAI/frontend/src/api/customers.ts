import api from './axios'

// Types
export interface Customer {
  id: number
  name: string
  customer_code: string | null
  phone: string | null
  email: string | null
  address: string | null
  created_at: string
  updated_at: string
  user_id: number
}

export interface CreateCustomerData {
  name: string
  customer_code?: string
  phone?: string
  email?: string
  address?: string
}

export interface UpdateCustomerData extends Partial<CreateCustomerData> {}

// Customers API
export const customersApi = {
  // Get all customers
  getCustomers: async (): Promise<Customer[]> => {
    const response = await api.get('/customers')
    return response.data as Customer[]
  },

  // Get single customer by ID
  getCustomer: async (id: number): Promise<Customer> => {
    const response = await api.get(`/customers/${id}`)
    return response.data as Customer
  },

  // Create new customer
  createCustomer: async (data: CreateCustomerData): Promise<Customer> => {
    const response = await api.post('/customers', data)
    return response.data as Customer
  },

  // Update customer
  updateCustomer: async (id: number, data: UpdateCustomerData): Promise<Customer> => {
    const response = await api.put(`/customers/${id}`, data)
    return response.data as Customer
  },

  // Archive customer (backend enforces dependency safety, returns 409 if referenced)
  archiveCustomer: async (id: number): Promise<void> => {
    await api.delete(`/customers/${id}`)
  },
}

export default customersApi
