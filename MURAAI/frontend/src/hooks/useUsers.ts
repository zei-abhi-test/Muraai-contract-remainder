import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usersApi, type CreateUserData, type UpdateUserData, type InviteUserData } from '@/api/users'
import { queryKeys } from '@/lib/react-query'

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.lists(),
    queryFn: usersApi.list,
  })
}

export function useUser(id: number) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => usersApi.get(id),
    enabled: id > 0,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateUserData) => usersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.lists() })
      toast.success('User created')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to create user')
    },
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserData }) => usersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.lists() })
      qc.invalidateQueries({ queryKey: queryKeys.users.details() })
      toast.success('User updated')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to update user')
    },
  })
}

export function useDisableUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => usersApi.disable(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.lists() })
      qc.invalidateQueries({ queryKey: queryKeys.users.details() })
      toast.success('User disabled')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to disable user')
    },
  })
}

export function useEnableUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => usersApi.enable(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.lists() })
      qc.invalidateQueries({ queryKey: queryKeys.users.details() })
      toast.success('User enabled')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to enable user')
    },
  })
}

export function useInviteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: InviteUserData) => usersApi.invite(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.lists() })
      toast.success('User invited')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to invite user')
    },
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.lists() })
      qc.invalidateQueries({ queryKey: queryKeys.users.details() })
      toast.success('User deleted')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to delete user')
    },
  })
}
