import { useState, useEffect, createElement, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings, User, Building2, Bell, Palette, Puzzle, Shield,
  Save, Plus, Trash2, Loader2, Lock, Globe, Smartphone, Monitor, History,
} from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
import { MicrosoftPanel } from '@/components/integrations/MicrosoftPanel'
import { toast } from 'sonner'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import {
  settingsApi,
  type ProfileData,
  type OrganizationData,
  type UserPreferenceData,
} from '@/api/settings'
import { queryKeys } from '@/lib/react-query'
import { useAuthStore } from '@/store/authStore'

// ── Tab definition ──────────────────────────────────────────────────────

interface Tab { id: string; label: string; icon: typeof User }

const tabs: Tab[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'organization', label: 'Organization', icon: Building2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'integrations', label: 'Integrations', icon: Puzzle },
  { id: 'security', label: 'Security', icon: Shield },
]

// ── Shared UI ───────────────────────────────────────────────────────────

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div onClick={() => onChange(!value)}
        className={`relative w-10 h-6 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-input'}`}>
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
      <span className="text-sm">{label}</span>
    </label>
  )
}

function LoadingSection() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
    </div>
  )
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: typeof User; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Icon className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function SaveButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button onClick={onClick} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      {loading ? 'Saving...' : 'Save Changes'}
    </button>
  )
}

function Input({ label, type = 'text', value, onChange, required, readOnly, placeholder }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean; readOnly?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} readOnly={readOnly} placeholder={placeholder}
        className={`w-full px-3 py-2 border border-input rounded-lg bg-background ${readOnly ? 'opacity-60' : ''}`} />
    </div>
  )
}

// ── 1. PROFILE TAB ─────────────────────────────────────────────────────

function ProfileTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: queryKeys.settings.profile(), queryFn: settingsApi.getProfile })
  const mutation = useMutation({
    mutationFn: (d: Partial<ProfileData & { new_password?: string }>) => settingsApi.updateProfile(d),
    onSuccess: (res) => {
      qc.setQueryData(queryKeys.settings.profile(), res)
      useAuthStore.getState().setUser(res as any)
      toast.success('Profile updated')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to update profile'),
  })
  const [f, setF] = useState({ name: '', email: '', phone: '', new_password: '', confirm_password: '' })
  const [initial, setInitial] = useState('')

  useEffect(() => {
    if (data) {
      const key = JSON.stringify({ name: data.name || '', email: data.email, phone: data.phone || '' })
      setF({ name: data.name || '', email: data.email, phone: data.phone || '', new_password: '', confirm_password: '' })
      setInitial(key)
    }
  }, [data])

  const dirty = useMemo(() => JSON.stringify({ name: f.name, email: f.email, phone: f.phone }) !== initial, [f, initial])
  useUnsavedChanges(dirty)

  if (isLoading) return <LoadingSection />

  const handleSave = () => {
    if (f.new_password && f.new_password !== f.confirm_password) {
      toast.error('Passwords do not match'); return
    }
    const payload: any = { username: f.name, email: f.email, phone: f.phone || null }
    if (f.new_password) payload.new_password = f.new_password
    mutation.mutate(payload)
  }

  return (
    <SectionCard title="Profile" icon={User}>
      <div className="flex items-center gap-4 mb-4">
        {data?.avatar_url ? (
          <img src={data.avatar_url} alt="" loading="lazy" className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold text-xl">{(f.name || '?').charAt(0).toUpperCase()}</span>
          </div>
        )}
        <div className="text-sm text-muted-foreground">
          <div className="font-medium text-foreground">{f.name || data?.username}</div>
          <div>{data?.role || '—'}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Name" value={f.name} onChange={v => setF(p => ({ ...p, name: v }))} required />
        <Input label="Email" type="email" value={f.email} onChange={v => setF(p => ({ ...p, email: v }))} required />
        <Input label="Phone" value={f.phone} onChange={v => setF(p => ({ ...p, phone: v }))} />
        <div />
        <Input label="New Password (leave blank to keep current)" type="password" value={f.new_password} onChange={v => setF(p => ({ ...p, new_password: v }))} />
        <Input label="Confirm New Password" type="password" value={f.confirm_password} onChange={v => setF(p => ({ ...p, confirm_password: v }))} />
      </div>
      <div className="pt-3"><SaveButton onClick={handleSave} loading={mutation.isPending} /></div>
    </SectionCard>
  )
}

// ── 2. ORGANIZATION TAB ────────────────────────────────────────────────

const TIMEZONES = ['UTC', 'Asia/Jakarta', 'Asia/Singapore', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'IDR', 'SGD', 'AUD', 'CAD', 'CHF', 'INR']

function OrganizationTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: queryKeys.settings.organization(), queryFn: settingsApi.getOrganization })
  const mutation = useMutation({
    mutationFn: (d: Partial<OrganizationData>) => settingsApi.updateOrganization(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.settings.organization() }); toast.success('Organization updated') },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to update organization'),
  })
  const [f, setF] = useState<OrganizationData>({ company_name: '', address: '', logo_url: '', default_currency: 'USD', timezone: 'UTC', fiscal_year: '' })

  useEffect(() => { if (data) setF(data) }, [data])

  if (isLoading) return <LoadingSection />

  return (
    <SectionCard title="Organization" icon={Building2}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Input label="Company Name" value={f.company_name || ''} onChange={v => setF(p => ({ ...p, company_name: v }))} />
        </div>
        <div className="md:col-span-2">
          <div><label className="block text-sm font-medium mb-1">Logo URL</label></div>
          <div className="flex gap-2">
            <input value={f.logo_url || ''} onChange={e => setF(p => ({ ...p, logo_url: e.target.value }))} placeholder="https://example.com/logo.png"
              className="flex-1 px-3 py-2 border border-input rounded-lg bg-background" />
            {f.logo_url && <img src={f.logo_url} alt="" loading="lazy" className="w-10 h-10 rounded object-contain border" />}
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea value={f.address || ''} onChange={e => setF(p => ({ ...p, address: e.target.value }))} rows={3}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Default Currency</label>
          <select value={f.default_currency} onChange={e => setF(p => ({ ...p, default_currency: e.target.value }))}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Timezone</label>
          <select value={f.timezone} onChange={e => setF(p => ({ ...p, timezone: e.target.value }))}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background">
            {TIMEZONES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <Input label="Fiscal Year (e.g. 2024-2025)" value={f.fiscal_year || ''} onChange={v => setF(p => ({ ...p, fiscal_year: v }))} />
        </div>
      </div>
      <div className="pt-3"><SaveButton onClick={() => mutation.mutate(f)} loading={mutation.isPending} /></div>
    </SectionCard>
  )
}

// ── 3. NOTIFICATIONS TAB ──────────────────────────────────────────────

function NotificationsTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: queryKeys.settings.preferences(), queryFn: settingsApi.getPreferences })
  const mutation = useMutation({
    mutationFn: (d: Partial<UserPreferenceData>) => settingsApi.updatePreferences(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.settings.preferences() }); toast.success('Notification preferences updated') },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to update preferences'),
  })
  const [f, setF] = useState({ notification_email: true, notification_push: true, reminder_days: 7, invoice_reminder_days: 7, approval_notifications: true })

  useEffect(() => { if (data) setF({ notification_email: data.notification_email, notification_push: data.notification_push, reminder_days: data.reminder_days, invoice_reminder_days: data.invoice_reminder_days, approval_notifications: data.approval_notifications }) }, [data])

  if (isLoading) return <LoadingSection />

  return (
    <SectionCard title="Notifications" icon={Bell}>
      <div className="space-y-4">
        <Toggle value={f.notification_email} onChange={v => setF(p => ({ ...p, notification_email: v }))} label="Email notifications" />
        <Toggle value={f.notification_push} onChange={v => setF(p => ({ ...p, notification_push: v }))} label="Push notifications" />
        <Toggle value={f.approval_notifications} onChange={v => setF(p => ({ ...p, approval_notifications: v }))} label="Approval notifications" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-sm font-medium mb-1">Renewal Reminder Days</label>
            <input type="number" min={1} max={90} value={f.reminder_days ?? 7} onChange={e => setF(p => ({ ...p, reminder_days: Number(e.target.value) }))}
              className="w-full max-w-xs px-3 py-2 border border-input rounded-lg bg-background" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Invoice Reminder Days</label>
            <input type="number" min={1} max={90} value={f.invoice_reminder_days ?? 7} onChange={e => setF(p => ({ ...p, invoice_reminder_days: Number(e.target.value) }))}
              className="w-full max-w-xs px-3 py-2 border border-input rounded-lg bg-background" />
          </div>
        </div>
      </div>
      <div className="pt-4"><SaveButton onClick={() => mutation.mutate(f)} loading={mutation.isPending} /></div>
    </SectionCard>
  )
}

// ── 4. APPEARANCE TAB ─────────────────────────────────────────────────

function AppearanceTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: queryKeys.settings.preferences(), queryFn: settingsApi.getPreferences })
  const mutation = useMutation({
    mutationFn: (d: Partial<UserPreferenceData>) => settingsApi.updatePreferences(d),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: queryKeys.settings.preferences() }); useAuthStore.getState().setUser({ ...useAuthStore.getState().user, theme: res.theme } as any); toast.success('Theme updated') },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to update theme'),
  })
  const [theme, setTheme] = useState('system')

  useEffect(() => { if (data) setTheme(data.theme) }, [data])

  if (isLoading) return <LoadingSection />

  const themes = [
    { id: 'light', label: 'Light Mode', icon: SunIcon, desc: 'Clean light interface for daytime use' },
    { id: 'dark', label: 'Dark Mode', icon: MoonIcon, desc: 'Dark theme for reduced eye strain' },
    { id: 'system', label: 'System', icon: Monitor, desc: 'Follow your system preference automatically' },
  ]

  return (
    <SectionCard title="Appearance" icon={Palette}>
      <p className="text-sm text-muted-foreground mb-4">Choose your interface theme preference.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {themes.map(t => (
          <button key={t.id} onClick={() => setTheme(t.id)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${theme === t.id ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'}`}>
            <t.icon className="w-8 h-8 mb-2 text-primary" />
            <div className="font-medium mb-1">{t.label}</div>
            <div className="text-xs text-muted-foreground">{t.desc}</div>
          </button>
        ))}
      </div>
      <div className="pt-4"><SaveButton onClick={() => mutation.mutate({ theme })} loading={mutation.isPending} /></div>
    </SectionCard>
  )
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  )
}

// ── 5. INTEGRATIONS TAB ───────────────────────────────────────────────

function IntegrationsTab() {
  const qc = useQueryClient()
  const { data: integrations, isLoading } = useQuery({ queryKey: queryKeys.settings.integrations(), queryFn: settingsApi.listIntegrations })
  const delMutation = useMutation({
    mutationFn: (id: number) => settingsApi.deleteIntegration(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.settings.integrations() }); toast.success('Integration removed') },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to remove integration'),
  })
  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => settingsApi.updateIntegration(id, { enabled }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.settings.integrations() }); toast.success('Integration updated') },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to update integration'),
  })
  const addMutation = useMutation({
    mutationFn: (d: { provider: string; config?: any; enabled?: boolean }) => settingsApi.createIntegration(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.settings.integrations() }); toast.success('Integration added'); setShowForm(false) },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to add integration'),
  })
  const [showForm, setShowForm] = useState(false)
  const [newProvider, setNewProvider] = useState('')

  if (isLoading) return <LoadingSection />

  const otherInts = (integrations || []).filter(i => !i.provider.startsWith('microsoft_'))

  return (
    <SectionCard title="Integrations" icon={Puzzle}>
      {/* Microsoft panel */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Smartphone className="w-4 h-4" /> Microsoft 365</h3>
        <MicrosoftPanel />
      </div>

      {/* Other integrations */}
      {otherInts.length > 0 && (
        <div className="pt-3 border-t border-border">
          <h3 className="text-sm font-semibold mb-2">Other</h3>
          <div className="space-y-2">
            {otherInts.map(int => (
              <div key={int.id} className="flex items-center justify-between px-4 py-3 border border-border rounded-lg">
                <div>
                  <span className="font-medium">{int.provider.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded ${int.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>{int.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleMutation.mutate({ id: int.id, enabled: !int.enabled })} className="text-xs px-2 py-1 border border-input rounded hover:bg-accent">{int.enabled ? 'Disable' : 'Enable'}</button>
                  <button onClick={() => delMutation.mutate(int.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add integration */}
      {showForm ? (
        <div className="flex items-center gap-2 mt-4">
          <select value={newProvider} onChange={e => setNewProvider(e.target.value)} className="flex-1 px-3 py-2 border border-input rounded-lg bg-background text-sm">
            <option value="">Select provider...</option>
            <option value="google_drive">Google Drive</option><option value="slack">Slack</option><option value="stripe">Stripe</option>
          </select>
          <button disabled={!newProvider || addMutation.isPending} onClick={() => addMutation.mutate({ provider: newProvider, enabled: true })}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50">Add</button>
          <button onClick={() => setShowForm(false)} className="px-3 py-2 border border-input rounded-lg text-sm hover:bg-accent">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 mt-4 text-sm text-primary hover:underline"><Plus className="w-4 h-4" /> Add Integration</button>
      )}
    </SectionCard>
  )
}

// ── 6. SECURITY TAB ────────────────────────────────────────────────────

function SecurityTab() {
  const { data: sessions, isLoading: sessionsLoading } = useQuery({ queryKey: queryKeys.settings.sessions(), queryFn: settingsApi.getSessions })
  const { data: loginHistory, isLoading: historyLoading } = useQuery({
    queryKey: queryKeys.settings.loginHistory(1),
    queryFn: () => settingsApi.getLoginHistory(1, 10),
  })

  const pwMutation = useMutation({
    mutationFn: (d: { current_password: string; new_password: string }) => settingsApi.changePassword(d),
    onSuccess: () => { toast.success('Password changed successfully'); setPwForm({ current: '', newPw: '', confirm: '' }) },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to change password'),
  })

  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })

  const handleChangePassword = () => {
    if (!pwForm.current || !pwForm.newPw) { toast.error('All fields are required'); return }
    if (pwForm.newPw.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (pwForm.newPw !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    pwMutation.mutate({ current_password: pwForm.current, new_password: pwForm.newPw })
  }

  return (
    <div className="space-y-8">
      {/* Change Password */}
      <SectionCard title="Change Password" icon={Lock}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Current Password" type="password" value={pwForm.current} onChange={v => setPwForm(p => ({ ...p, current: v }))} required />
            <div />
            <Input label="New Password" type="password" value={pwForm.newPw} onChange={v => setPwForm(p => ({ ...p, newPw: v }))} required />
            <Input label="Confirm New Password" type="password" value={pwForm.confirm} onChange={v => setPwForm(p => ({ ...p, confirm: v }))} required />
          </div>
          <SaveButton onClick={handleChangePassword} loading={pwMutation.isPending} />
        </div>
      </SectionCard>

      {/* Recent Sessions */}
      <SectionCard title="Recent Sessions" icon={Globe}>
        {sessionsLoading ? <LoadingSection /> : !sessions || sessions.length === 0 ? (
          <EmptyState icon={Monitor} title="No active sessions" description="Sessions from other devices will appear here." />
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 10).map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 border border-border rounded-lg text-sm">
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <span className="font-mono text-xs">{s.ip_address || 'Unknown IP'}</span>
                    {s.user_agent && <span className="ml-2 text-xs text-muted-foreground truncate max-w-[300px] inline-block align-middle">{s.user_agent}</span>}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Login History */}
      <SectionCard title="Login History" icon={Smartphone}>
        {historyLoading ? <LoadingSection /> : !loginHistory || loginHistory.items.length === 0 ? (
          <EmptyState icon={History} title="No login history available" description="Login activity will appear here once you sign in from different devices." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2 font-medium">Date/Time</th>
                  <th className="px-3 py-2 font-medium">IP Address</th>
                  <th className="px-3 py-2 font-medium">User Agent</th>
                </tr>
              </thead>
              <tbody>
                {loginHistory.items.map(h => (
                  <tr key={h.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-xs">{new Date(h.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-xs">{h.ip_address || '—'}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[300px]">{h.user_agent || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────

const tabComponents: Record<string, React.FC> = {
  profile: ProfileTab,
  organization: OrganizationTab,
  notifications: NotificationsTab,
  appearance: AppearanceTab,
  integrations: IntegrationsTab,
  security: SecurityTab,
}

export function SettingsPage() {
  const [active, setActive] = useState('profile')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure your application settings."
        breadcrumbs={[{ label: 'Settings' }]}
      />

      <div className="flex gap-6 flex-col lg:flex-row">
        <nav className="w-full lg:w-56 flex-shrink-0 space-y-1">
          {tabs.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setActive(t.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  active === t.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'
                }`}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            )
          })}
        </nav>
        <main className="flex-1 bg-card border border-border rounded-xl p-6">
          {tabs.map(t => (
            <div key={t.id} className={active === t.id ? 'block' : 'hidden'}>
              {tabComponents[t.id] ? createElement(tabComponents[t.id]) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Coming soon.</p>
                </div>
              )}
            </div>
          ))}
        </main>
      </div>
    </div>
  )
}
