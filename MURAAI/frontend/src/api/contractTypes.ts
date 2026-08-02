import api from './axios'

// Types
export interface ContractType {
  id: number
  name: string
  description: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface CreateContractTypeData {
  name: string
  description?: string
  status?: string
}

// Contract Types API
export const contractTypesApi = {
  // Get all contract types
  getContractTypes: async (): Promise<ContractType[]> => {
    const response = await api.get('/contract-types')
    return response.data as ContractType[]
  },

  // Get single contract type by ID
  getContractType: async (id: number): Promise<ContractType> => {
    const response = await api.get(`/contract-types/${id}`)
    return response.data as ContractType
  },

  // Create new contract type
  createContractType: async (data: CreateContractTypeData): Promise<ContractType> => {
    const response = await api.post('/contract-types', data)
    return response.data as ContractType
  },

  // Update contract type
  updateContractType: async (id: number, data: Partial<CreateContractTypeData>): Promise<ContractType> => {
    const response = await api.put(`/contract-types/${id}`, data)
    return response.data as ContractType
  },

  // Delete contract type
  deleteContractType: async (id: number): Promise<void> => {
    await api.delete(`/contract-types/${id}`)
  },
}

export default contractTypesApi
