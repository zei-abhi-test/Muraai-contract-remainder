import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { calendarApi, type CalendarFilters, type CreateTaskData, type UpdateTaskData, type CreateEventData, type ReminderConfigData } from '@/api/calendar'
import { queryKeys } from '@/lib/react-query'
import { toast } from 'sonner'

export function useCalendarEvents(filters: CalendarFilters) {
  return useQuery({
    queryKey: queryKeys.calendar.events(filters),
    queryFn: () => calendarApi.getEvents(filters),
  })
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEventData) => calendarApi.createEvent(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.calendar.all })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Event created')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to create event'),
  })
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateEventData> }) =>
      calendarApi.updateEvent(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.calendar.all })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Event updated')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to update event'),
  })
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => calendarApi.deleteEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.calendar.all })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Event deleted')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to delete event'),
  })
}

export function useTasks(filters?: { status?: string; priority?: string }) {
  return useQuery({
    queryKey: queryKeys.calendar.tasks(filters),
    queryFn: () => calendarApi.getTasks(filters),
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTaskData) => calendarApi.createTask(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.calendar.all })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Task created')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to create task'),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTaskData }) =>
      calendarApi.updateTask(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.calendar.all })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Task updated')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to update task'),
  })
}

export function useCompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => calendarApi.completeTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.calendar.all })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Task completed')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to complete task'),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => calendarApi.deleteTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.calendar.all })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Task deleted')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to delete task'),
  })
}

export function useReminderConfigs() {
  return useQuery({
    queryKey: queryKeys.calendar.reminderConfigs,
    queryFn: () => calendarApi.getReminderConfigs(),
  })
}

export function useSaveReminderConfigs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ReminderConfigData[]) => calendarApi.saveReminderConfigs(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.calendar.reminderConfigs })
      toast.success('Reminder settings saved')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to save reminder settings'),
  })
}

export function useSetDefaultReminders() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => calendarApi.setDefaultReminders(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.calendar.reminderConfigs })
      toast.success('Default reminders configured')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to set defaults'),
  })
}

export function useCalendarFilters() {
  return useQuery({
    queryKey: queryKeys.calendar.filterOptions,
    queryFn: () => calendarApi.getFilters(),
    staleTime: 10 * 60 * 1000,
  })
}
