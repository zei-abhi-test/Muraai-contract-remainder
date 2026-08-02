import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  tasksApi,
  type CreateTaskData,
  type UpdateTaskData,
  type TaskFilters,
  type TaskStatus,
} from '@/api/tasks'
import { queryKeys } from '@/lib/react-query'

export function useTasks(filters?: TaskFilters) {
  return useQuery({
    queryKey: queryKeys.tasks.list(filters),
    queryFn: () => tasksApi.list(filters),
  })
}

export function useTask(id: number) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(id),
    queryFn: () => tasksApi.get(id),
    enabled: id > 0,
  })
}

export function useTaskStats() {
  return useQuery({
    queryKey: queryKeys.tasks.stats,
    queryFn: tasksApi.getStats,
    refetchInterval: 60000,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTaskData) => tasksApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all })
      qc.invalidateQueries({ queryKey: queryKeys.tasks.stats })
      toast.success('Task created')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to create task')
    },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTaskData }) => tasksApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all })
      qc.invalidateQueries({ queryKey: queryKeys.tasks.details() })
      qc.invalidateQueries({ queryKey: queryKeys.tasks.stats })
      toast.success('Task updated')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to update task')
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => tasksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all })
      qc.invalidateQueries({ queryKey: queryKeys.tasks.stats })
      toast.success('Task deleted')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to delete task')
    },
  })
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: TaskStatus }) =>
      tasksApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all })
      qc.invalidateQueries({ queryKey: queryKeys.tasks.details() })
      qc.invalidateQueries({ queryKey: queryKeys.tasks.stats })
      toast.success('Task status updated')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to update status')
    },
  })
}

export function useAddComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, content }: { taskId: number; content: string }) =>
      tasksApi.addComment(taskId, content),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.detail(vars.taskId) })
      toast.success('Comment added')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to add comment')
    },
  })
}

export function useDeleteComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, commentId }: { taskId: number; commentId: number }) =>
      tasksApi.deleteComment(taskId, commentId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.detail(vars.taskId) })
      toast.success('Comment deleted')
    },
  })
}

export function useUploadAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, file }: { taskId: number; file: File }) =>
      tasksApi.uploadAttachment(taskId, file),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.detail(vars.taskId) })
      toast.success('File uploaded')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to upload file')
    },
  })
}

export function useDeleteAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, attachmentId }: { taskId: number; attachmentId: number }) =>
      tasksApi.deleteAttachment(taskId, attachmentId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.detail(vars.taskId) })
      toast.success('Attachment deleted')
    },
  })
}
