import api from './axios'

export interface WorkflowStage {
  id?: number
  workflow_id?: number
  name: string
  stage_order: number
  role_required: string
}

export interface WorkflowRule {
  id?: number
  workflow_id?: number
  field: string
  operator: string
  value: string
  priority: number
}

export interface Workflow {
  id: number
  name: string
  description: string | null
  workflow_type: string
  is_active: boolean
  stages: WorkflowStage[]
  rules: WorkflowRule[]
  created_at: string
  updated_at: string
}

export interface CreateWorkflowData {
  name: string
  description?: string
  workflow_type: string
}

export interface UpdateWorkflowData {
  name?: string
  description?: string
  workflow_type?: string
  is_active?: boolean
}

export interface WorkflowAssignmentStage {
  id: number
  assignment_id: number
  stage_id: number
  stage_name: string
  stage_order: number
  role_required: string
  status: string
  approved_by: number | null
  comments: string | null
  created_at: string
  updated_at: string
}

export interface WorkflowAssignment {
  id: number
  workflow_id: number
  workflow_name: string
  entity_type: string
  entity_id: number
  current_stage_order: number
  status: string
  stages: WorkflowAssignmentStage[]
  created_at: string
  updated_at: string
}

export interface WorkflowMeta {
  types: string[]
  operators: string[]
  fields: string[]
}

export const workflowsApi = {
  list: async (params?: { type?: string; active_only?: boolean }): Promise<Workflow[]> => {
    const r = await api.get('/workflows', { params })
    return r.data as Workflow[]
  },

  get: async (id: number): Promise<Workflow> => {
    const r = await api.get(`/workflows/${id}`)
    return r.data as Workflow
  },

  create: async (data: CreateWorkflowData): Promise<Workflow> => {
    const r = await api.post('/workflows', data)
    return r.data as Workflow
  },

  update: async (id: number, data: UpdateWorkflowData): Promise<Workflow> => {
    const r = await api.put(`/workflows/${id}`, data)
    return r.data as Workflow
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/workflows/${id}`)
  },

  duplicate: async (id: number): Promise<Workflow> => {
    const r = await api.post(`/workflows/${id}/duplicate`)
    return r.data as Workflow
  },

  addStage: async (workflowId: number, data: WorkflowStage): Promise<WorkflowStage> => {
    const r = await api.post(`/workflows/${workflowId}/stages`, data)
    return r.data as WorkflowStage
  },

  updateStage: async (stageId: number, data: Partial<WorkflowStage>): Promise<WorkflowStage> => {
    const r = await api.put(`/workflows/stages/${stageId}`, data)
    return r.data as WorkflowStage
  },

  deleteStage: async (stageId: number): Promise<void> => {
    await api.delete(`/workflows/stages/${stageId}`)
  },

  addRule: async (workflowId: number, data: WorkflowRule): Promise<WorkflowRule> => {
    const r = await api.post(`/workflows/${workflowId}/rules`, data)
    return r.data as WorkflowRule
  },

  updateRule: async (ruleId: number, data: Partial<WorkflowRule>): Promise<WorkflowRule> => {
    const r = await api.put(`/workflows/rules/${ruleId}`, data)
    return r.data as WorkflowRule
  },

  deleteRule: async (ruleId: number): Promise<void> => {
    await api.delete(`/workflows/rules/${ruleId}`)
  },

  evaluate: async (entityType: string, entityData: Record<string, unknown>): Promise<{ workflow: Workflow | null }> => {
    const r = await api.post('/workflows/evaluate', { entity_type: entityType, entity_data: entityData })
    return r.data as { workflow: Workflow | null }
  },

  getAssignments: async (params?: { entity_type?: string; entity_id?: number }): Promise<WorkflowAssignment[]> => {
    const r = await api.get('/workflows/assignments', { params })
    return r.data as WorkflowAssignment[]
  },

  getAssignment: async (id: number): Promise<WorkflowAssignment> => {
    const r = await api.get(`/workflows/assignments/${id}`)
    return r.data as WorkflowAssignment
  },

  getMeta: async (): Promise<WorkflowMeta> => {
    const r = await api.get('/workflows/meta')
    return r.data as WorkflowMeta
  },
}
