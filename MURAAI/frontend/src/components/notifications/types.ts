export type NotificationPriority = 'critical' | 'warning' | 'success' | 'info'

export type BusinessObject = 'contract' | 'renewal' | 'invoice' | 'po' | 'approval' | 'task' | 'document' | 'system'

export type NotificationFilter = 'all' | 'unread' | 'contracts' | 'renewals' | 'finance' | 'tasks' | 'approvals' | 'documents' | 'system'

export interface NotificationAction {
  label: string
  page: string
  params?: Record<string, any>
}

export interface Notification {
  id: string
  priority: NotificationPriority
  businessObject: BusinessObject
  title: string
  description: string
  timestamp: string
  isRead: boolean
  isArchived: boolean
  primaryAction: NotificationAction
  secondaryAction?: NotificationAction
}

export type GroupKey = 'today' | 'yesterday' | 'week' | 'older'

export interface GroupedNotifications {
  key: GroupKey
  label: string
  items: Notification[]
}

export const PRIORITY_CONFIG: Record<NotificationPriority, { label: string; dot: string; bg: string; border: string }> = {
  critical: { label: 'Critical', dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-950/10', border: 'border-l-red-500' },
  warning: { label: 'Warning', dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/10', border: 'border-l-amber-500' },
  success: { label: 'Success', dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/10', border: 'border-l-emerald-500' },
  info: { label: 'Info', dot: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/10', border: 'border-l-blue-500' },
}

export const FILTER_CONFIG: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'contracts', label: 'Contracts' },
  { value: 'renewals', label: 'Renewals' },
  { value: 'finance', label: 'Finance' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'approvals', label: 'Approvals' },
  { value: 'documents', label: 'Documents' },
  { value: 'system', label: 'System' },
]

export const BUSINESS_OBJECT_TO_FILTER: Record<BusinessObject, NotificationFilter> = {
  contract: 'contracts',
  renewal: 'renewals',
  invoice: 'finance',
  po: 'finance',
  approval: 'approvals',
  task: 'tasks',
  document: 'documents',
  system: 'system',
}

export const GROUP_LABELS: Record<GroupKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Earlier This Week',
  older: 'Older',
}
