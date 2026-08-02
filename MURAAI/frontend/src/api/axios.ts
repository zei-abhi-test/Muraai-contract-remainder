import axios, { AxiosError } from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { getApiErrorMessage } from '@/lib/errors'

// Types
export interface ApiError {
  message: string
  code?: string
  details?: any
}

export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Token storage helpers
const getAccessToken = (): string | null => {
  return localStorage.getItem('access_token') || localStorage.getItem('customer_token')
}

const setAccessToken = (token: string): void => {
  localStorage.setItem('access_token', token)
}

const clearTokens = (): void => {
  localStorage.removeItem('access_token')
}

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - Add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken()
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  async (error: AxiosError) => {
    // Handle 401 - Unauthorized
    if (error.response?.status === 401) {
      const token = localStorage.getItem('access_token')
      const customerToken = localStorage.getItem('customer_token')
      if (token) {
        clearTokens()
        window.location.href = '/login'
      } else if (customerToken) {
        localStorage.removeItem('customer_token')
        window.location.href = '/portal/login'
      }
      return Promise.reject(error)
    }

    // Handle 403 - Forbidden
    if (error.response?.status === 403) {
      const apiError: ApiError = {
        message: 'You do not have permission to perform this action',
        code: 'FORBIDDEN',
      }
      return Promise.reject(apiError)
    }

    // Handle 404 - Not Found
    if (error.response?.status === 404) {
      const apiError: ApiError = {
        message: 'Resource not found',
        code: 'NOT_FOUND',
      }
      return Promise.reject(apiError)
    }

    // Handle 500 - Server Error
    if (error.response && error.response.status >= 500) {
      const apiError: ApiError = {
        message: 'Server error. Please try again later',
        code: 'SERVER_ERROR',
      }
      return Promise.reject(apiError)
    }

    // Handle network errors
    if (!error.response) {
      const apiError: ApiError = {
        message: 'Network error. Please check your connection',
        code: 'NETWORK_ERROR',
      }
      return Promise.reject(apiError)
    }

    // Default error handling (covers 400 validation errors, etc.)
    const apiError: ApiError = {
      message: getApiErrorMessage(error, 'An error occurred'),
      code: error.code,
      details: error.response?.data,
    }
    return Promise.reject(apiError)
  }
)

// Helper function to handle API responses
export const handleApiResponse = <T>(response: AxiosResponse<ApiResponse<T>>): T => {
  if (response.data.success) {
    return response.data.data
  }
  throw new Error(response.data.message || 'API request failed')
}

// Helper function to handle paginated responses
export const handlePaginatedResponse = <T>(
  response: AxiosResponse<PaginatedResponse<T>>
): PaginatedResponse<T> => {
  return response.data
}

// Export token helpers for use in auth module
export { getAccessToken, setAccessToken, clearTokens }

export default api
