import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { workflowsApi, type CreateWorkflowData, type UpdateWorkflowData, type WorkflowStage, type WorkflowRule } from '@/api/workflows'
import { queryKeys } from '@/lib/react-query'

export function useWorkflows(params?: { type?: string; active_only?: boolean }) {
  return useQuery({
    queryKey: queryKeys.workflows.list(params),
    queryFn: () => workflowsApi.list(params),
  })
}

export function useWorkflow(id: number) {
  return useQuery({
    queryKey: queryKeys.workflows.detail(id),
    queryFn: () => workflowsApi.get(id),
    enabled: id > 0,
  })
}

export function useWorkflowMeta() {
  return useQuery({
    queryKey: queryKeys.workflows.meta,
    queryFn: workflowsApi.getMeta,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateWorkflowData) => workflowsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.all })
      toast.success('Workflow created')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to create workflow')
    },
  })
}

export function useUpdateWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateWorkflowData }) => workflowsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.all })
      qc.invalidateQueries({ queryKey: queryKeys.workflows.details() })
      toast.success('Workflow updated')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to update workflow')
    },
  })
}

export function useDeleteWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => workflowsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.all })
      toast.success('Workflow deleted')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to delete workflow')
    },
  })
}

export function useDuplicateWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => workflowsApi.duplicate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.all })
      toast.success('Workflow duplicated')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to duplicate workflow')
    },
  })
}

export function useAddStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ workflowId, data }: { workflowId: number; data: WorkflowStage }) => workflowsApi.addStage(workflowId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.details() })
      toast.success('Stage added')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to add stage')
    },
  })
}

export function useUpdateStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ stageId, data }: { stageId: number; data: Partial<WorkflowStage> }) => workflowsApi.updateStage(stageId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.details() })
      toast.success('Stage updated')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to update stage')
    },
  })
}

export function useDeleteStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stageId: number) => workflowsApi.deleteStage(stageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.details() })
      toast.success('Stage deleted')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to delete stage')
    },
  })
}

export function useAddRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ workflowId, data }: { workflowId: number; data: WorkflowRule }) => workflowsApi.addRule(workflowId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.details() })
      toast.success('Rule added')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to add rule')
    },
  })
}

export function useUpdateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ruleId, data }: { ruleId: number; data: Partial<WorkflowRule> }) => workflowsApi.updateRule(ruleId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.details() })
      toast.success('Rule updated')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to update rule')
    },
  })
}

export function useDeleteRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ruleId: number) => workflowsApi.deleteRule(ruleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.details() })
      toast.success('Rule deleted')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to delete rule')
    },
  })
}

export function useWorkflowAssignments(params?: { entity_type?: string; entity_id?: number }) {
  return useQuery({
    queryKey: queryKeys.workflows.assignments(params),
    queryFn: () => workflowsApi.getAssignments(params),
  })
}

export function useWorkflowEvaluate() {
  return useMutation({
    mutationFn: ({ entityType, entityData }: { entityType: string; entityData: Record<string, unknown> }) =>
      workflowsApi.evaluate(entityType, entityData),
  })
}
