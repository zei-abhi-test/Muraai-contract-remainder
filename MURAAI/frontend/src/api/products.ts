import api from './axios'

// Types
export interface Product {
  id: number
  name: string
  code: string | null
  sku: string
  category: string | null
  rate: number
  price: number | null
  description: string | null
  status: string
  created_at: string
  updated_at: string
  user_id: number
}

export interface CreateProductData {
  name: string
  code?: string
  sku?: string
  category?: string
  rate: number
  price?: number
  description?: string
  status?: string
}

// Products API
export const productsApi = {
  // Get all products
  getProducts: async (): Promise<Product[]> => {
    const response = await api.get('/products')
    return response.data as Product[]
  },

  // Get single product by ID
  getProduct: async (id: number): Promise<Product> => {
    const response = await api.get(`/products/${id}`)
    return response.data as Product
  },

  // Create new product
  createProduct: async (data: CreateProductData): Promise<Product> => {
    const response = await api.post('/products', data)
    return response.data as Product
  },

  // Update product
  updateProduct: async (id: number, data: Partial<CreateProductData>): Promise<Product> => {
    const response = await api.put(`/products/${id}`, data)
    return response.data as Product
  },

  // Delete product. Backend soft-deactivates instead of deleting when the
  // product is still referenced by contract line item history.
  deleteProduct: async (id: number): Promise<{ message: string; deactivated: boolean; product?: Product }> => {
    const response = await api.delete(`/products/${id}`)
    return response.data
  },
}

export default productsApi
