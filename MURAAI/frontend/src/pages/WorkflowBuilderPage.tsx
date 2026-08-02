import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, ChevronDown, ChevronUp, Trash2, Copy, ToggleLeft, ToggleRight,
  X, Save, Settings, Layers, ArrowDown, ArrowUp, FileText, Receipt,
  ShoppingCart, RefreshCw, FolderOpen,
} from 'lucide-react'
import {
  useWorkflows, useWorkflow, useCreateWorkflow, useUpdateWorkflow,
  useDeleteWorkflow, useDuplicateWorkflow, useWorkflowMeta,
  useAddStage, useUpdateStage, useDeleteStage,
  useAddRule, useUpdateRule, useDeleteRule,
} from '@/hooks/useWorkflows'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { queryClient } from '@/lib/react-query'
import { queryKeys } from '@/lib/react-query'
import { toast } from 'sonner'
import type { Workflow, WorkflowStage, WorkflowRule } from '@/api/workflows'

const WORKFLOW_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  contract_approval: FileText,
  invoice_approval: Receipt,
  purchase_order_approval: ShoppingCart,
  renewal_approval: RefreshCw,
  document_approval: FolderOpen,
}

const WORKFLOW_TYPE_LABELS: Record<string, string> = {
  contract_approval: 'Contract Approval',
  invoice_approval: 'Invoice Approval',
  purchase_order_approval: 'Purchase Order Approval',
  renewal_approval: 'Renewal Approval',
  document_approval: 'Document Approval',
}

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'CONTRACT_MANAGER', 'FINANCE', 'APPROVER', 'LEGAL', 'SALES', 'VIEWER']

const RULE_FIELD_LABELS: Record<string, string> = {
  contract_value: 'Contract Value',
  department: 'Department',
  contract_type: 'Contract Type',
  currency: 'Currency',
  customer: 'Customer',
  region: 'Region',
  product_category: 'Product Category',
}

const OPERATOR_LABELS: Record<string, string> = {
  eq: 'Equals',
  neq: 'Not Equals',
  gt: 'Greater Than',
  gte: 'Greater Or Equal',
  lt: 'Less Than',
  lte: 'Less Or Equal',
  in: 'In (comma-separated)',
  contains: 'Contains',
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </motion.div>
    </div>
  )
}

function WorkflowTypeBadge({ type }: { type: string }) {
  const Icon = WORKFLOW_TYPE_ICONS[type]
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {WORKFLOW_TYPE_LABELS[type] || type}
    </span>
  )
}

function StageCard({
  stage, index, total, onMoveUp, onMoveDown, onEdit, onDelete,
}: {
  stage: WorkflowStage; index: number; total: number
  onMoveUp: () => void; onMoveDown: () => void
  onEdit: () => void; onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:bg-accent/20 transition-colors">
      <div className="flex flex-col gap-0.5">
        <button onClick={onMoveUp} disabled={index === 0}
          className="p-0.5 hover:bg-accent rounded disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button onClick={onMoveDown} disabled={index === total - 1}
          className="p-0.5 hover:bg-accent rounded disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{stage.name}</div>
        <div className="text-xs text-muted-foreground">{stage.role_required?.replace(/_/g, ' ')}</div>
      </div>
      <button onClick={onEdit} className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground">
        <Settings className="w-4 h-4" />
      </button>
      <button onClick={onDelete} className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-destructive">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

export function WorkflowBuilderPage() {
  const { data: workflows = [], isLoading } = useWorkflows()
  const meta = useWorkflowMeta()
  const createMut = useCreateWorkflow()
  const updateMut = useUpdateWorkflow()
  const deleteMut = useDeleteWorkflow()
  const duplicateMut = useDuplicateWorkflow()
  const addStageMut = useAddStage()
  const updateStageMut = useUpdateStage()
  const deleteStageMut = useDeleteStage()
  const addRuleMut = useAddRule()
  const updateRuleMut = useUpdateRule()
  const deleteRuleMut = useDeleteRule()

  const [selectedWf, setSelectedWf] = useState<Workflow | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editWf, setEditWf] = useState<Workflow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null)

  const [stageModal, setStageModal] = useState<{ open: boolean; workflowId: number; stage?: WorkflowStage | null }>({ open: false, workflowId: 0 })
  const [ruleModal, setRuleModal] = useState<{ open: boolean; workflowId: number; rule?: WorkflowRule | null }>({ open: false, workflowId: 0 })

  const [stageForm, setStageForm] = useState({ name: '', role_required: 'APPROVER' })
  const [ruleForm, setRuleForm] = useState({ field: 'contract_value', operator: 'gt', value: '', priority: 0 })

  const types = meta.data?.types || []
  const fields = meta.data?.fields || []
  const operators = meta.data?.operators || []

  const handleSelect = (wf: Workflow) => {
    setSelectedWf(prev => prev?.id === wf.id ? null : wf)
  }

  const openStageModal = (workflowId: number, stage?: WorkflowStage) => {
    if (stage) {
      setStageForm({ name: stage.name, role_required: stage.role_required })
    } else {
      setStageForm({ name: '', role_required: 'APPROVER' })
    }
    setStageModal({ open: true, workflowId, stage: stage || null })
  }

  const openRuleModal = (workflowId: number, rule?: WorkflowRule) => {
    if (rule) {
      setRuleForm({ field: rule.field, operator: rule.operator, value: rule.value, priority: rule.priority })
    } else {
      setRuleForm({ field: 'contract_value', operator: 'gt', value: '', priority: 0 })
    }
    setRuleModal({ open: true, workflowId, rule: rule || null })
  }

  const saveStage = () => {
    const wfId = stageModal.workflowId
    const stage = stageModal.stage
    if (!stageForm.name.trim()) { toast.error('Stage name is required'); return }

    if (stage?.id) {
      updateStageMut.mutate({ stageId: stage.id, data: { name: stageForm.name, role_required: stageForm.role_required } }, {
        onSuccess: () => setStageModal({ open: false, workflowId: 0 }),
      })
    } else {
      const stages = selectedWf?.stages || []
      const nextOrder = stages.length + 1
      addStageMut.mutate({
        workflowId: wfId,
        data: { name: stageForm.name, stage_order: nextOrder, role_required: stageForm.role_required },
      }, {
        onSuccess: () => setStageModal({ open: false, workflowId: 0 }),
      })
    }
  }

  const saveRule = () => {
    const wfId = ruleModal.workflowId
    const rule = ruleModal.rule
    if (!ruleForm.value.trim()) { toast.error('Rule value is required'); return }

    if (rule?.id) {
      updateRuleMut.mutate({ ruleId: rule.id, data: ruleForm }, {
        onSuccess: () => setRuleModal({ open: false, workflowId: 0 }),
      })
    } else {
      addRuleMut.mutate({
        workflowId: wfId,
        data: { field: ruleForm.field, operator: ruleForm.operator, value: ruleForm.value, priority: ruleForm.priority },
      }, {
        onSuccess: () => setRuleModal({ open: false, workflowId: 0 }),
      })
    }
  }

  const moveStage = (wf: Workflow, index: number, direction: -1 | 1) => {
    const stages = [...wf.stages].sort((a, b) => a.stage_order - b.stage_order)
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= stages.length) return
    const s = stages[index]
    const swap = stages[newIndex]
    updateStageMut.mutate({ stageId: s.id!, data: { stage_order: s.stage_order + direction } })
    updateStageMut.mutate({ stageId: swap.id!, data: { stage_order: swap.stage_order - direction } })
  }

  const invalidateWorkflows = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.workflows.details() })
  }

  const selected = selectedWf ? (workflows.find(w => w.id === selectedWf.id) || selectedWf) : null
  const sortedStages = selected ? [...selected.stages].sort((a, b) => a.stage_order - b.stage_order) : []

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Workflows' }]} />
      <div
        className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight mb-1">Workflow Builder</h1>
          <p className="text-muted-foreground">Configure approval workflows for contracts, invoices, and more.</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          <Plus className="w-4 h-4" /> New Workflow
        </button>
      </div>

      {/* Workflow List */}
      <div
        className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : workflows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No workflows configured yet.</p>
            <button onClick={() => setShowCreate(true)}
              className="mt-3 text-primary hover:underline text-sm">Create your first workflow</button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {workflows.map(wf => (
              <div key={wf.id}
                className={`transition-colors ${selectedWf?.id === wf.id ? 'bg-accent/20' : 'hover:bg-accent/10'}`}>
                <button onClick={() => handleSelect(wf)} className="w-full flex items-center gap-4 px-4 py-3.5 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{wf.name}</span>
                      <WorkflowTypeBadge type={wf.workflow_type} />
                      {!wf.is_active && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Disabled</span>
                      )}
                    </div>
                    {wf.description && (
                      <div className="text-xs text-muted-foreground mt-0.5">{wf.description}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {wf.stages?.length || 0} stage{(wf.stages?.length || 0) !== 1 ? 's' : ''}
                      {wf.rules?.length > 0 && ` · ${wf.rules.length} rule${wf.rules.length !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={e => { e.stopPropagation(); duplicateMut.mutate(wf.id) }} title="Duplicate"
                      className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setEditWf(wf) }} title="Edit"
                      className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground">
                      <Settings className="w-4 h-4" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setDeleteTarget(wf) }} title="Delete"
                      className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </button>

                {/* Expanded designer */}
                {selectedWf?.id === wf.id && selected && (
                  <div className="px-4 pb-4 border-t border-border pt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Stages */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold flex items-center gap-1.5">
                            <Layers className="w-4 h-4" /> Stages
                          </h3>
                          <button onClick={() => openStageModal(wf.id)}
                            className="flex items-center gap-1 text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20">
                            <Plus className="w-3 h-3" /> Add Stage
                          </button>
                        </div>
                        <div className="space-y-2">
                          {sortedStages.map((stage, i) => (
                            <StageCard
                              key={stage.id}
                              stage={stage}
                              index={i}
                              total={sortedStages.length}
                              onMoveUp={() => moveStage(wf, i, -1)}
                              onMoveDown={() => moveStage(wf, i, 1)}
                              onEdit={() => openStageModal(wf.id, stage)}
                              onDelete={() => stage.id && deleteStageMut.mutate(stage.id, { onSuccess: invalidateWorkflows })}
                            />
                          ))}
                          {sortedStages.length === 0 && (
                            <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
                              No stages yet. Click "Add Stage" to build your workflow.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Rules */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold flex items-center gap-1.5">
                            <FileText className="w-4 h-4" /> Rules
                          </h3>
                          <button onClick={() => openRuleModal(wf.id)}
                            className="flex items-center gap-1 text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20">
                            <Plus className="w-3 h-3" /> Add Rule
                          </button>
                        </div>
                        <div className="space-y-2">
                          {selected.rules.map(rule => (
                            <div key={rule.id} className="flex items-center gap-2 p-2.5 bg-card border border-border rounded-lg text-sm">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-xs">{RULE_FIELD_LABELS[rule.field] || rule.field}</span>
                                <span className="mx-1 text-muted-foreground">{OPERATOR_LABELS[rule.operator] || rule.operator}</span>
                                <span className="font-mono text-xs">{rule.value}</span>
                              </div>
                              <button onClick={() => openRuleModal(wf.id, rule)}
                                className="p-1 hover:bg-accent rounded text-muted-foreground">
                                <Settings className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => rule.id && deleteRuleMut.mutate(rule.id, { onSuccess: invalidateWorkflows })}
                                className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {selected.rules.length === 0 && (
                            <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
                              No rules. This workflow applies to all {WORKFLOW_TYPE_LABELS[wf.workflow_type]?.toLowerCase() || 'requests'}.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Workflow Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Workflow">
        <CreateWorkflowForm
          types={types}
          onSubmit={d => createMut.mutate(d, {
            onSuccess: () => setShowCreate(false),
          })}
          loading={createMut.isPending}
        />
      </Modal>

      {/* Edit Workflow Modal */}
      <Modal open={!!editWf} onClose={() => setEditWf(null)} title="Edit Workflow">
        {editWf && (
          <EditWorkflowForm
            workflow={editWf}
            types={types}
            onSubmit={d => updateMut.mutate({ id: editWf.id, data: d }, {
              onSuccess: () => setEditWf(null),
            })}
            loading={updateMut.isPending}
          />
        )}
      </Modal>

      {/* Stage Modal */}
      <Modal open={stageModal.open} onClose={() => setStageModal({ open: false, workflowId: 0 })} title={stageModal.stage ? 'Edit Stage' : 'Add Stage'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Stage Name</label>
            <input value={stageForm.name} onChange={e => setStageForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Manager Review" className="w-full px-3 py-2 border border-input rounded-lg bg-background" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Required Role</label>
            <select value={stageForm.role_required} onChange={e => setStageForm(p => ({ ...p, role_required: e.target.value }))}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background">
              {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={saveStage} disabled={addStageMut.isPending || updateStageMut.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
              <Save className="w-4 h-4" /> {stageModal.stage ? 'Update' : 'Add'} Stage
            </button>
          </div>
        </div>
      </Modal>

      {/* Rule Modal */}
      <Modal open={ruleModal.open} onClose={() => setRuleModal({ open: false, workflowId: 0 })} title={ruleModal.rule ? 'Edit Rule' : 'Add Rule'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Field</label>
            <select value={ruleForm.field} onChange={e => setRuleForm(p => ({ ...p, field: e.target.value }))}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background">
              {fields.map(f => <option key={f} value={f}>{RULE_FIELD_LABELS[f] || f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Operator</label>
            <select value={ruleForm.operator} onChange={e => setRuleForm(p => ({ ...p, operator: e.target.value }))}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background">
              {operators.map(o => <option key={o} value={o}>{OPERATOR_LABELS[o] || o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Value</label>
            <input value={ruleForm.value} onChange={e => setRuleForm(p => ({ ...p, value: e.target.value }))}
              placeholder="e.g. 1000000" className="w-full px-3 py-2 border border-input rounded-lg bg-background" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Priority (higher = evaluated first)</label>
            <input type="number" value={ruleForm.priority} onChange={e => setRuleForm(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={saveRule} disabled={addRuleMut.isPending || updateRuleMut.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
              <Save className="w-4 h-4" /> {ruleModal.rule ? 'Update' : 'Add'} Rule
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This will permanently delete this workflow and all its stages and rules."
        isDeleting={deleteMut.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMut.mutate(deleteTarget.id, {
            onSuccess: () => { setDeleteTarget(null); setSelectedWf(null) },
          })
        }}
      />
    </div>
  )
}

function CreateWorkflowForm({ types, onSubmit, loading }: { types: string[]; onSubmit: (d: any) => void; loading: boolean }) {
  const [f, setF] = useState({ name: '', description: '', workflow_type: 'contract_approval' })
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(f) }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} required
          className="w-full px-3 py-2 border border-input rounded-lg bg-background" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea value={f.description} onChange={e => setF(p => ({ ...p, description: e.target.value }))} rows={2}
          className="w-full px-3 py-2 border border-input rounded-lg bg-background" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Workflow Type</label>
        <select value={f.workflow_type} onChange={e => setF(p => ({ ...p, workflow_type: e.target.value }))}
          className="w-full px-3 py-2 border border-input rounded-lg bg-background">
          {types.map(t => <option key={t} value={t}>{WORKFLOW_TYPE_LABELS[t] || t}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
          <Save className="w-4 h-4" /> Create Workflow
        </button>
      </div>
    </form>
  )
}

function EditWorkflowForm({ workflow, types, onSubmit, loading }: { workflow: Workflow; types: string[]; onSubmit: (d: any) => void; loading: boolean }) {
  const [f, setF] = useState({ name: workflow.name, description: workflow.description || '', workflow_type: workflow.workflow_type, is_active: workflow.is_active })
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(f) }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} required
          className="w-full px-3 py-2 border border-input rounded-lg bg-background" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea value={f.description} onChange={e => setF(p => ({ ...p, description: e.target.value }))} rows={2}
          className="w-full px-3 py-2 border border-input rounded-lg bg-background" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Workflow Type</label>
        <select value={f.workflow_type} onChange={e => setF(p => ({ ...p, workflow_type: e.target.value }))}
          className="w-full px-3 py-2 border border-input rounded-lg bg-background">
          {types.map(t => <option key={t} value={t}>{WORKFLOW_TYPE_LABELS[t] || t}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Active</label>
        <button type="button" onClick={() => setF(p => ({ ...p, is_active: !p.is_active }))}
          className={`relative w-10 h-5 rounded-full transition-colors ${f.is_active ? 'bg-primary' : 'bg-input'}`}>
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${f.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
          <Save className="w-4 h-4" /> Update Workflow
        </button>
      </div>
    </form>
  )
}

