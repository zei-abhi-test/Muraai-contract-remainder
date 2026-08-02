import api, { setAccessToken, clearTokens } from './axios'

// Types
export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  username: string
  email: string
  password: string
}

export interface AuthResponse {
  user: User
  token: string
}

export interface User {
  id: number
  username: string
  email: string
  name: string
  phone: string | null
  department: string | null
  avatar_url: string | null
  role: string
  status: string
  last_login: string | null
  created_at: string
  updated_at: string
}

// Auth API functions
export const authApi = {
  // Login
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', credentials)
    const data = response.data as AuthResponse
    
    // Store token
    setAccessToken(data.token)
    
    return data
  },

  // Register
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', data)
    const authData = response.data as AuthResponse
    
    // Store token
    setAccessToken(authData.token)
    
    return authData
  },

  // Logout
  logout: async (): Promise<void> => {
    clearTokens()
  },

  // Get current user
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/auth/me')
    return response.data as User
  },
}

export default authApi
