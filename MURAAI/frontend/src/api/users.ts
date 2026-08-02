import api from './axios'
import type { User } from './auth'

export interface CreateUserData {
  name: string
  email: string
  password: string
  phone?: string
  department?: string
  role?: string
  status?: string
}

export interface UpdateUserData {
  name?: string
  phone?: string
  department?: string
  avatar_url?: string
  role?: string
  status?: string
}

export interface InviteUserData {
  name: string
  email: string
  department?: string
  role?: string
}

export interface InviteResponse extends User {
  temp_password: string
}

export const usersApi = {
  list: async (): Promise<User[]> => {
    const r = await api.get('/users')
    return r.data as User[]
  },

  get: async (id: number): Promise<User> => {
    const r = await api.get(`/users/${id}`)
    return r.data as User
  },

  create: async (data: CreateUserData): Promise<User> => {
    const r = await api.post('/users', data)
    return r.data as User
  },

  invite: async (data: InviteUserData): Promise<InviteResponse> => {
    const r = await api.post('/users/invite', data)
    return r.data as InviteResponse
  },

  update: async (id: number, data: UpdateUserData): Promise<User> => {
    const r = await api.put(`/users/${id}`, data)
    return r.data as User
  },

  disable: async (id: number): Promise<User> => {
    const r = await api.post(`/users/${id}/disable`)
    return r.data as User
  },

  enable: async (id: number): Promise<User> => {
    const r = await api.post(`/users/${id}/enable`)
    return r.data as User
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`)
  },
}
