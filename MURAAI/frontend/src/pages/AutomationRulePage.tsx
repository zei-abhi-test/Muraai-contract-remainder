import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Trash2, Copy, ToggleLeft, ToggleRight,
  X, Save, Play, ChevronDown, ChevronRight, Zap,
  Mail, Bell, Calendar, CheckSquare, RefreshCw,
  Receipt, ShoppingCart, Globe, Activity,
  Clock, AlertTriangle, FileText, CheckCircle,
  DollarSign, Package,
} from 'lucide-react'
import {
  useAutomationRules, useCreateAutomationRule, useUpdateAutomationRule,
  useDeleteAutomationRule, useDuplicateAutomationRule,
  useToggleAutomationRule, useTestAutomationRule,
  useAutomationMeta,
} from '@/hooks/useAutomation'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { toast } from 'sonner'
import type { AutomationRule, AutomationAction } from '@/api/automation'
import { TRIGGER_TYPES, ACTION_TYPES } from '@/api/automation'

const TRIGGER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  contract_created: FileText,
  contract_approved: CheckCircle,
  contract_renewed: RefreshCw,
  contract_expired: Clock,
  invoice_created: Receipt,
  invoice_paid: DollarSign,
  invoice_overdue: AlertTriangle,
  purchase_order_created: Package,
  document_uploaded: FileText,
  approval_completed: CheckCircle,
  reminder_due: Bell,
}

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  send_email: Mail,
  create_notification: Bell,
  create_calendar_event: Calendar,
  assign_task: CheckSquare,
  generate_renewal: RefreshCw,
  generate_invoice: Receipt,
  generate_purchase_order: ShoppingCart,
  call_webhook: Globe,
  log_activity: Activity,
}

const TRIGGER_DESCRIPTIONS: Record<string, string> = {
  contract_created: 'When a new contract is created',
  contract_approved: 'When a contract is approved',
  contract_renewed: 'When a contract is renewed',
  contract_expired: 'When a contract expires',
  invoice_created: 'When a new invoice is created',
  invoice_paid: 'When an invoice is marked as paid',
  invoice_overdue: 'When an invoice becomes overdue',
  purchase_order_created: 'When a new purchase order is created',
  document_uploaded: 'When a document is uploaded',
  approval_completed: 'When an approval is completed',
  reminder_due: 'When a reminder is due',
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

function ActionBadge({ action }: { action: AutomationAction }) {
  const Icon = ACTION_ICONS[action.type]
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {ACTION_TYPES[action.type] || action.type}
    </span>
  )
}

export function AutomationRulePage() {
  const { data: rules = [], isLoading } = useAutomationRules()
  const meta = useAutomationMeta()
  const createMut = useCreateAutomationRule()
  const updateMut = useUpdateAutomationRule()
  const deleteMut = useDeleteAutomationRule()
  const duplicateMut = useDuplicateAutomationRule()
  const toggleMut = useToggleAutomationRule()
  const testMut = useTestAutomationRule()

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editRule, setEditRule] = useState<AutomationRule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null)
  const [testRuleId, setTestRuleId] = useState<number | null>(null)
  const [testData, setTestData] = useState('{\n  "contract_id": 1,\n  "contract_name": "Sample"\n}')

  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger_type: 'contract_created',
    trigger_config: '{}',
    actions: '[]' as string,
  })

  const resetForm = () => {
    setForm({ name: '', description: '', trigger_type: 'contract_created', trigger_config: '{}', actions: '[]' })
  }

  const openCreate = () => {
    resetForm()
    setShowCreate(true)
    setEditRule(null)
  }

  const openEdit = (rule: AutomationRule) => {
    setForm({
      name: rule.name,
      description: rule.description || '',
      trigger_type: rule.trigger_type,
      trigger_config: JSON.stringify(rule.trigger_config, null, 2),
      actions: JSON.stringify(rule.actions, null, 2),
    })
    setEditRule(rule)
    setShowCreate(true)
  }

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    let actions: AutomationAction[]
    try {
      actions = JSON.parse(form.actions)
      if (!Array.isArray(actions)) throw new Error()
    } catch {
      toast.error('Actions must be a valid JSON array')
      return
    }
    let triggerConfig: Record<string, unknown> = {}
    if (form.trigger_config.trim()) {
      try { triggerConfig = JSON.parse(form.trigger_config) } catch { toast.error('Trigger config must be valid JSON'); return }
    }
    const payload = {
      name: form.name,
      description: form.description || undefined,
      trigger_type: form.trigger_type,
      trigger_config: triggerConfig,
      actions,
    }

    if (editRule) {
      updateMut.mutate({ id: editRule.id, data: payload }, {
        onSuccess: () => { setShowCreate(false); resetForm() },
      })
    } else {
      createMut.mutate(payload, {
        onSuccess: () => { setShowCreate(false); resetForm() },
      })
    }
  }

  const handleTest = () => {
    if (!testRuleId) return
    let entityData: Record<string, unknown>
    try { entityData = JSON.parse(testData) } catch { toast.error('Test data must be valid JSON'); return }
    testMut.mutate({ id: testRuleId, entityData })
  }

  if (isLoading) return <TableSkeleton />

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs items={[{ label: 'Automation Rules' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            Automation Rules
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create no-code automation rules to trigger actions on events
          </p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium">
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      {/* Create / Edit Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm() }}
        title={editRule ? 'Edit Automation Rule' : 'Create Automation Rule'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" placeholder="e.g., Send email on new contract" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description (optional)</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" rows={2} placeholder="Describe what this rule does" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Trigger</label>
            <select value={form.trigger_type} onChange={e => setForm(p => ({ ...p, trigger_type: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
              {Object.entries(TRIGGER_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">{TRIGGER_DESCRIPTIONS[form.trigger_type]}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Trigger Config (JSON, optional)</label>
            <textarea value={form.trigger_config} onChange={e => setForm(p => ({ ...p, trigger_config: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono" rows={2} placeholder='{"days": 30}' />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Actions (JSON array)</label>
            <textarea value={form.actions} onChange={e => setForm(p => ({ ...p, actions: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono" rows={6}
              placeholder='[{"type": "send_email", "config": {"to": "finance@company.com", "subject": "...", "body": "..."}}]' />
            <p className="text-xs text-muted-foreground mt-1">
              Available actions: {Object.entries(ACTION_TYPES).map(([k, v]) => `${k} (${v})`).join(', ')}
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowCreate(false); resetForm() }}
              className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Cancel</button>
            <button onClick={handleSave}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
              <Save className="w-4 h-4" /> {editRule ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Test Modal */}
      <Modal open={testRuleId !== null} onClose={() => setTestRuleId(null)} title="Test Automation Rule">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Entity Data (JSON)</label>
            <textarea value={testData} onChange={e => setTestData(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono" rows={8} />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setTestRuleId(null)}
              className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Cancel</button>
            <button onClick={handleTest} disabled={testMut.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              <Play className="w-4 h-4" /> Test Rule
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDeleteModal
          isOpen
          title="Delete Automation Rule"
          description={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          onConfirm={() => { deleteMut.mutate(deleteTarget.id); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No automation rules yet</p>
          <p className="text-sm mt-1">Create your first rule to automate workflows</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => {
            const TriggerIcon = TRIGGER_ICONS[rule.trigger_type] || Zap
            const expanded = expandedId === rule.id
            return (
              <motion.div key={rule.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-accent/20 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : rule.id)}>
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <TriggerIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{rule.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {TRIGGER_TYPES[rule.trigger_type] || rule.trigger_type}
                      {rule.description ? ` — ${rule.description}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {rule.last_run_at && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        Last run: {new Date(rule.last_run_at).toLocaleDateString()}
                      </span>
                    )}
                    <div className="flex -space-x-1">
                      {rule.actions.slice(0, 3).map((a, i) => (
                        <ActionBadge key={`${a.type}-${i}`} action={a} />
                      ))}
                      {rule.actions.length > 3 && (
                        <span className="text-xs text-muted-foreground ml-1">+{rule.actions.length - 3}</span>
                      )}
                    </div>
                    <button onClick={e => { e.stopPropagation(); toggleMut.mutate(rule.id) }}
                      className={`p-1.5 rounded hover:bg-accent ${rule.is_enabled ? 'text-green-500' : 'text-muted-foreground'}`}
                      title={rule.is_enabled ? 'Disable' : 'Enable'}>
                      {rule.is_enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {expanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    className="border-t border-border px-4 py-4 space-y-4">
                    {/* Trigger Info */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Trigger</h4>
                      <div className="flex items-center gap-2 text-sm">
                        <TriggerIcon className="w-4 h-4 text-primary" />
                        <span>{TRIGGER_TYPES[rule.trigger_type] || rule.trigger_type}</span>
                        {Object.keys(rule.trigger_config).length > 0 && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {JSON.stringify(rule.trigger_config)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Actions</h4>
                      <div className="space-y-2">
                        {rule.actions.map((action, i) => {
                          const ActionIcon = ACTION_ICONS[action.type] || Zap
                          return (
                            <div key={`${action.type}-${i}`} className="flex items-start gap-3 p-3 bg-accent/20 rounded-lg">
                              <ActionIcon className="w-4 h-4 mt-0.5 text-primary" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium">{ACTION_TYPES[action.type] || action.type}</div>
                                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                                  {JSON.stringify(action.config)}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {rule.last_run_at && <span>Last run: {new Date(rule.last_run_at).toLocaleString()}</span>}
                      {rule.last_error && (
                        <span className="text-destructive flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {rule.last_error}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <button onClick={() => { setEditRule(rule); openEdit(rule) }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-accent">
                        <Save className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button onClick={() => setTestRuleId(rule.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-accent">
                        <Play className="w-3.5 h-3.5" /> Test
                      </button>
                      <button onClick={() => duplicateMut.mutate(rule.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-accent">
                        <Copy className="w-3.5 h-3.5" /> Duplicate
                      </button>
                      <button onClick={() => setDeleteTarget(rule)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

