import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { queryKeys } from '@/lib/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { getAccessToken } from '@/api/axios'

export function useLogin() {
  const queryClient = useQueryClient()
  const { setUser } = useAuthStore()
  const navigate = useNavigate()
  
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setUser(data.user)
      toast.success('Login successful')
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.user() })
      navigate('/')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Login failed')
    },
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  const { setUser } = useAuthStore()
  const navigate = useNavigate()
  
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      setUser(data.user)
      toast.success('Registration successful')
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.user() })
      navigate('/')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Registration failed')
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      logout()
      toast.success('Logged out successfully')
      queryClient.clear()
      navigate('/login')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Logout failed')
    },
  })
}

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.auth.user(),
    queryFn: authApi.getCurrentUser,
    enabled: !!getAccessToken(),
    retry: false,
  })
}
