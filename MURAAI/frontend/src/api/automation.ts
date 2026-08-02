import api from './axios'

export interface AutomationAction {
  type: string
  config: Record<string, unknown>
}

export interface AutomationRule {
  id: number
  name: string
  description: string | null
  trigger_type: string
  trigger_type_label: string
  trigger_config: Record<string, unknown>
  conditions: Record<string, unknown>[]
  actions: AutomationAction[]
  is_enabled: boolean
  last_run_at: string | null
  last_error: string | null
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface CreateAutomationRuleData {
  name: string
  description?: string
  trigger_type: string
  trigger_config?: Record<string, unknown>
  conditions?: Record<string, unknown>[]
  actions?: AutomationAction[]
}

export interface UpdateAutomationRuleData {
  name?: string
  description?: string
  trigger_type?: string
  trigger_config?: Record<string, unknown>
  conditions?: Record<string, unknown>[]
  actions?: AutomationAction[]
  is_enabled?: boolean
}

export interface AutomationMeta {
  trigger_types: Record<string, string>
  action_types: Record<string, string>
}

export const TRIGGER_TYPES: Record<string, string> = {
  contract_created: 'Contract Created',
  contract_approved: 'Contract Approved',
  contract_renewed: 'Contract Renewed',
  contract_expired: 'Contract Expired',
  invoice_created: 'Invoice Created',
  invoice_paid: 'Invoice Paid',
  invoice_overdue: 'Invoice Overdue',
  purchase_order_created: 'Purchase Order Created',
  document_uploaded: 'Document Uploaded',
  approval_completed: 'Approval Completed',
  reminder_due: 'Reminder Due',
}

export const ACTION_TYPES: Record<string, string> = {
  send_email: 'Send Email',
  create_notification: 'Create Notification',
  create_calendar_event: 'Create Calendar Event',
  assign_task: 'Assign Task',
  generate_renewal: 'Generate Renewal',
  generate_invoice: 'Generate Invoice',
  generate_purchase_order: 'Generate Purchase Order',
  call_webhook: 'Call Webhook',
  log_activity: 'Log Activity',
}

export const automationApi = {
  list: async (): Promise<AutomationRule[]> => {
    const r = await api.get('/automation/rules')
    return r.data as AutomationRule[]
  },

  get: async (id: number): Promise<AutomationRule> => {
    const r = await api.get(`/automation/rules/${id}`)
    return r.data as AutomationRule
  },

  create: async (data: CreateAutomationRuleData): Promise<AutomationRule> => {
    const r = await api.post('/automation/rules', data)
    return r.data as AutomationRule
  },

  update: async (id: number, data: UpdateAutomationRuleData): Promise<AutomationRule> => {
    const r = await api.put(`/automation/rules/${id}`, data)
    return r.data as AutomationRule
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/automation/rules/${id}`)
  },

  duplicate: async (id: number): Promise<AutomationRule> => {
    const r = await api.post(`/automation/rules/${id}/duplicate`)
    return r.data as AutomationRule
  },

  toggle: async (id: number): Promise<AutomationRule> => {
    const r = await api.post(`/automation/rules/${id}/toggle`)
    return r.data as AutomationRule
  },

  test: async (id: number, entityData: Record<string, unknown>): Promise<{ message: string; triggered: boolean }> => {
    const r = await api.post(`/automation/rules/${id}/test`, { entity_data: entityData })
    return r.data as { message: string; triggered: boolean }
  },

  getMeta: async (): Promise<AutomationMeta> => {
    const r = await api.get('/automation/meta')
    return r.data as AutomationMeta
  },
}
