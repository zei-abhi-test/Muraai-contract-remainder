import api from './axios'

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface TaskItem {
  id: number
  user_id: number
  title: string
  description: string | null
  due_date: string | null
  priority: TaskPriority
  status: TaskStatus
  assigned_to: number | null
  assigned_to_name: string | null
  assigned_by: number | null
  assigned_by_name: string | null
  related_module: string | null
  related_record_id: number | null
  completed_at: string | null
  created_at: string
  updated_at: string
  comment_count: number
  attachment_count: number
}

export interface TaskComment {
  id: number
  task_id: number
  user_id: number
  user_name: string | null
  content: string
  created_at: string
}

export interface TaskAttachment {
  id: number
  task_id: number
  user_id: number
  filename: string
  file_path: string
  file_size: number | null
  created_at: string
}

export interface TaskHistory {
  id: number
  task_id: number
  user_id: number
  user_name: string | null
  field: string
  old_value: string | null
  new_value: string | null
  created_at: string
}

export interface TaskDetail extends TaskItem {
  comments: TaskComment[]
  attachments: TaskAttachment[]
  history: TaskHistory[]
}

export interface TaskStats {
  my_tasks: number
  overdue: number
  critical: number
  today: number
  completed: number
}

export interface CreateTaskData {
  title: string
  description?: string
  priority?: TaskPriority
  due_date?: string | null
  due_days?: number
  assigned_to?: number | null
  related_module?: string
  related_record_id?: number
}

export interface UpdateTaskData {
  title?: string
  description?: string
  priority?: TaskPriority
  status?: TaskStatus
  assigned_to?: number | null
  due_date?: string | null
}

export interface TaskFilters {
  status?: string
  priority?: string
  assigned_to?: number
  module?: string
  search?: string
  view?: 'all' | 'my' | 'assigned'
}

export const tasksApi = {
  list: async (filters?: TaskFilters): Promise<TaskItem[]> => {
    const r = await api.get('/tasks', { params: filters })
    return r.data as TaskItem[]
  },

  get: async (id: number): Promise<TaskDetail> => {
    const r = await api.get(`/tasks/${id}`)
    return r.data as TaskDetail
  },

  create: async (data: CreateTaskData): Promise<TaskItem> => {
    const r = await api.post('/tasks', data)
    return r.data as TaskItem
  },

  update: async (id: number, data: UpdateTaskData): Promise<TaskItem> => {
    const r = await api.put(`/tasks/${id}`, data)
    return r.data as TaskItem
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/tasks/${id}`)
  },

  updateStatus: async (id: number, status: TaskStatus): Promise<TaskItem> => {
    const r = await api.put(`/tasks/${id}/status`, { status })
    return r.data as TaskItem
  },

  getStats: async (): Promise<TaskStats> => {
    const r = await api.get('/tasks/stats')
    return r.data as TaskStats
  },

  getComments: async (taskId: number): Promise<TaskComment[]> => {
    const r = await api.get(`/tasks/${taskId}/comments`)
    return r.data as TaskComment[]
  },

  addComment: async (taskId: number, content: string): Promise<TaskComment> => {
    const r = await api.post(`/tasks/${taskId}/comments`, { content })
    return r.data as TaskComment
  },

  deleteComment: async (taskId: number, commentId: number): Promise<void> => {
    await api.delete(`/tasks/${taskId}/comments/${commentId}`)
  },

  getAttachments: async (taskId: number): Promise<TaskAttachment[]> => {
    const r = await api.get(`/tasks/${taskId}/attachments`)
    return r.data as TaskAttachment[]
  },

  uploadAttachment: async (taskId: number, file: File): Promise<TaskAttachment> => {
    const formData = new FormData()
    formData.append('file', file)
    const r = await api.post(`/tasks/${taskId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return r.data as TaskAttachment
  },

  deleteAttachment: async (taskId: number, attachmentId: number): Promise<void> => {
    await api.delete(`/tasks/${taskId}/attachments/${attachmentId}`)
  },

  getHistory: async (taskId: number): Promise<TaskHistory[]> => {
    const r = await api.get(`/tasks/${taskId}/history`)
    return r.data as TaskHistory[]
  },
}
