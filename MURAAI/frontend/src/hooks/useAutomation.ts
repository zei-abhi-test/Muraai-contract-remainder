import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  automationApi,
  type CreateAutomationRuleData,
  type UpdateAutomationRuleData,
} from '@/api/automation'
import { queryKeys } from '@/lib/react-query'

export function useAutomationRules() {
  return useQuery({
    queryKey: queryKeys.automation.all,
    queryFn: () => automationApi.list(),
  })
}

export function useAutomationRule(id: number) {
  return useQuery({
    queryKey: queryKeys.automation.detail(id),
    queryFn: () => automationApi.get(id),
    enabled: id > 0,
  })
}

export function useAutomationMeta() {
  return useQuery({
    queryKey: queryKeys.automation.meta,
    queryFn: automationApi.getMeta,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateAutomationRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateAutomationRuleData) => automationApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.automation.all })
      toast.success('Automation rule created')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to create rule')
    },
  })
}

export function useUpdateAutomationRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateAutomationRuleData }) =>
      automationApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.automation.all })
      toast.success('Automation rule updated')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to update rule')
    },
  })
}

export function useDeleteAutomationRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => automationApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.automation.all })
      toast.success('Automation rule deleted')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to delete rule')
    },
  })
}

export function useDuplicateAutomationRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => automationApi.duplicate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.automation.all })
      toast.success('Rule duplicated')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to duplicate rule')
    },
  })
}

export function useToggleAutomationRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => automationApi.toggle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.automation.all })
      toast.success('Rule toggled')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to toggle rule')
    },
  })
}

export function useTestAutomationRule() {
  return useMutation({
    mutationFn: ({ id, entityData }: { id: number; entityData: Record<string, unknown> }) =>
      automationApi.test(id, entityData),
    onSuccess: (data) => {
      if (data.triggered) {
        toast.success('Rule executed successfully')
      } else {
        toast.error('Rule did not trigger')
      }
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to test rule')
    },
  })
}
