import api from './axios'

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  type: string
  event_type: string
  entity_type: string
  entity_id: number
  status: string
  description: string
  company_name?: string
  amount?: number
  color?: string
  priority?: string
  approval_id?: number
  contract_name?: string
}

export interface CalendarEventsResponse {
  events: CalendarEvent[]
  total: number
}

export interface CalendarFilters {
  start: string
  end: string
  types?: string
  customer_id?: number
  contract_id?: number
  status?: string
}

export interface TaskItem {
  id: number
  user_id: number
  title: string
  description: string | null
  due_date: string | null
  priority: string
  status: string
  completed_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface CreateTaskData {
  title: string
  description?: string
  due_date?: string
  priority?: string
  status?: string
}

export interface UpdateTaskData {
  title?: string
  description?: string
  due_date?: string | null
  priority?: string
  status?: string
}

export interface CreateEventData {
  title: string
  description?: string
  event_type: string
  start: string
  end?: string
  all_day?: boolean
  color?: string
  entity_type?: string
  entity_id?: number
  priority?: string
  status?: string
}

export interface ReminderConfigItem {
  id: number
  user_id: number
  event_type: string
  days_before: number
  enabled: boolean
  notification_method: string
  last_triggered_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface ReminderConfigData {
  event_type: string
  days_before: number
  enabled: boolean
  notification_method: string
}

export interface CalendarFilterOptions {
  customers: { id: number; name: string }[]
  contracts: { id: number; name: string }[]
  event_types: { key: string; label: string; color: string }[]
  contract_types: { id: number; name: string }[]
}

export const calendarApi = {
  getEvents: async (filters: CalendarFilters): Promise<CalendarEventsResponse> => {
    const response = await api.get('/calendar/events', { params: filters })
    return response.data as CalendarEventsResponse
  },
  createEvent: async (data: CreateEventData): Promise<any> => {
    const response = await api.post('/calendar/events', data)
    return response.data
  },
  updateEvent: async (id: number, data: Partial<CreateEventData>): Promise<any> => {
    const response = await api.put(`/calendar/events/${id}`, data)
    return response.data
  },
  deleteEvent: async (id: number): Promise<void> => {
    await api.delete(`/calendar/events/${id}`)
  },
  // Tasks
  getTasks: async (filters?: { status?: string; priority?: string }): Promise<TaskItem[]> => {
    const response = await api.get('/tasks', { params: filters })
    return response.data as TaskItem[]
  },
  createTask: async (data: CreateTaskData): Promise<TaskItem> => {
    const response = await api.post('/tasks', data)
    return response.data as TaskItem
  },
  updateTask: async (id: number, data: UpdateTaskData): Promise<TaskItem> => {
    const response = await api.put(`/tasks/${id}`, data)
    return response.data as TaskItem
  },
  completeTask: async (id: number): Promise<TaskItem> => {
    const response = await api.put(`/tasks/${id}/complete`)
    return response.data as TaskItem
  },
  deleteTask: async (id: number): Promise<void> => {
    await api.delete(`/tasks/${id}`)
  },
  // Reminder Configs
  getReminderConfigs: async (): Promise<ReminderConfigItem[]> => {
    const response = await api.get('/reminders/config')
    return response.data as ReminderConfigItem[]
  },
  saveReminderConfigs: async (data: ReminderConfigData[]): Promise<ReminderConfigItem[]> => {
    const response = await api.post('/reminders/config', data)
    return response.data as ReminderConfigItem[]
  },
  setDefaultReminders: async (): Promise<ReminderConfigItem[]> => {
    const response = await api.post('/reminders/defaults')
    return response.data as ReminderConfigItem[]
  },
  // Filters
  getFilters: async (): Promise<CalendarFilterOptions> => {
    const response = await api.get('/calendar/filters')
    return response.data as CalendarFilterOptions
  },
}

export default calendarApi
