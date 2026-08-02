import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  UserPlus, Eye, Pencil, ToggleLeft, ToggleRight, Trash2, X, Save, Loader2, Mail,
} from 'lucide-react'
import { useUsers, useCreateUser, useUpdateUser, useDisableUser, useEnableUser, useDeleteUser, useInviteUser } from '@/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { PageHeader, DataTable, StatusBadge, type Column } from '@/components/ui'
import { toast } from 'sonner'
import { queryClient } from '@/lib/react-query'
import { queryKeys } from '@/lib/react-query'
import type { User } from '@/api/auth'

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'CONTRACT_MANAGER', 'FINANCE', 'APPROVER', 'LEGAL', 'SALES', 'VIEWER'] as const

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CONTRACT_MANAGER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  APPROVER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  FINANCE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  LEGAL: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  SALES: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  VIEWER: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[role] || ROLE_COLORS.VIEWER}`}>
      {role.replace(/_/g, ' ')}
    </span>
  )
}

function Avatar({ user }: { user: User }) {
  const initials = (user.name || user.username || '?').charAt(0).toUpperCase()
  return (
    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
      <span className="text-primary font-semibold text-sm">{initials}</span>
    </div>
  )
}

// ── Modal wrapper ───────────────────────────────────────────────────────

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </motion.div>
    </div>
  )
}

// ── Create / Edit form ──────────────────────────────────────────────────

type FormState = {
  name: string; email: string; phone: string; department: string; role: string; status: string; password: string
}

const emptyForm: FormState = { name: '', email: '', phone: '', department: '', role: 'VIEWER', status: 'active', password: '' }

function UserForm({ user, onSubmit, loading }: { user?: User | null; onSubmit: (d: FormState) => void; loading: boolean }) {
  const [f, setF] = useState<FormState>(emptyForm)

  useEffect(() => {
    if (user) {
      setF({ name: user.name || '', email: user.email, phone: user.phone || '', department: user.department || '', role: user.role, status: user.status, password: '' })
    } else {
      setF(emptyForm)
    }
  }, [user])

  const isEdit = !!user

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(f) }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} required
          className="w-full px-3 py-2 border border-input rounded-lg bg-background" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input type="email" value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} required={!isEdit} readOnly={isEdit}
          className={`w-full px-3 py-2 border border-input rounded-lg bg-background ${isEdit ? 'opacity-60' : ''}`} />
      </div>
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium mb-1">Temporary Password</label>
          <input type="password" value={f.password} onChange={e => setF(p => ({ ...p, password: e.target.value }))} required
            className="w-full px-3 py-2 border border-input rounded-lg bg-background" />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium mb-1">Phone</label>
        <input value={f.phone} onChange={e => setF(p => ({ ...p, phone: e.target.value }))}
          className="w-full px-3 py-2 border border-input rounded-lg bg-background" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Department</label>
        <input value={f.department} onChange={e => setF(p => ({ ...p, department: e.target.value }))}
          className="w-full px-3 py-2 border border-input rounded-lg bg-background" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <select value={f.role} onChange={e => setF(p => ({ ...p, role: e.target.value }))}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background">
            {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select value={f.status} onChange={e => setF(p => ({ ...p, status: e.target.value }))}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background">
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEdit ? 'Update' : 'Create'} User
        </button>
      </div>
    </form>
  )
}

// ── Invite form ──────────────────────────────────────────────────────────

function InviteForm({ onSubmit, loading }: { onSubmit: (d: { name: string; email: string; department: string; role: string }) => void; loading: boolean }) {
  const [f, setF] = useState({ name: '', email: '', department: '', role: 'VIEWER' })

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(f) }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} required
          className="w-full px-3 py-2 border border-input rounded-lg bg-background" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input type="email" value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} required
          className="w-full px-3 py-2 border border-input rounded-lg bg-background" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Department</label>
        <input value={f.department} onChange={e => setF(p => ({ ...p, department: e.target.value }))}
          className="w-full px-3 py-2 border border-input rounded-lg bg-background" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Role</label>
        <select value={f.role} onChange={e => setF(p => ({ ...p, role: e.target.value }))}
          className="w-full px-3 py-2 border border-input rounded-lg bg-background">
          {ROLES.filter(r => r !== 'SUPER_ADMIN').map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          Send Invite
        </button>
      </div>
    </form>
  )
}

// ── Main page ───────────────────────────────────────────────────────────

export function UsersPage() {
  const { data: users = [], isLoading } = useUsers()
  const createMut = useCreateUser()
  const updateMut = useUpdateUser()
  const disableMut = useDisableUser()
  const enableMut = useEnableUser()
  const deleteMut = useDeleteUser()
  const { user: currentUser } = useAuthStore()

  const inviteMut = useInviteUser()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [viewUser, setViewUser] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [sortField, setSortField] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const filtered = users.filter(u =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => {
    if (!sortField) return 0
    const aVal = a[sortField as keyof typeof a]
    const bVal = b[sortField as keyof typeof b]
    if (aVal == null) return 1
    if (bVal == null) return -1
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  })

  const userColumns: Column<User>[] = [
    {
      key: 'name',
      header: 'User',
      sortable: true,
      render: u => (
        <div className="flex items-center gap-3">
          <Avatar user={u} />
          <span className="font-medium">{u.name || u.username}</span>
        </div>
      ),
    },
    { key: 'email', header: 'Email', sortable: true },
    { key: 'phone', header: 'Phone', hideable: true, render: u => <span className="text-muted-foreground">{u.phone || '—'}</span> },
    { key: 'department', header: 'Department', hideable: true, render: u => <span className="text-muted-foreground">{u.department || '—'}</span> },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: u => <RoleBadge role={u.role} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: u => <StatusBadge status={u.status} />,
    },
    {
      key: 'last_login',
      header: 'Last Login',
      hideable: true,
      render: u => <span className="text-xs text-muted-foreground">{u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}</span>,
    },
    {
      key: 'created_at',
      header: 'Created',
      hideable: true,
      render: u => <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage user accounts and permissions."
        breadcrumbs={[{ label: 'Users' }]}
        action={
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
            <UserPlus className="w-4 h-4" /> Add User
          </button>
        }
      >
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-accent">
          <Mail className="w-4 h-4" /> Invite User
        </button>
      </PageHeader>

      <DataTable
        columns={userColumns}
        data={filtered}
        keyExtractor={u => u.id}
        isLoading={isLoading}
        error={null}
        emptyMessage={search ? 'No users match your search.' : 'No users found.'}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search users..."
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
        rowActions={(u) => (
          <div className="flex items-center gap-0.5">
            <button onClick={() => setViewUser(u)} title="View" className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground" aria-label={`View ${u.name || u.username}`}>
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setEditUser(u)} title="Edit" className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground" aria-label={`Edit ${u.name || u.username}`}>
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {u.status === 'active' ? (
              <button onClick={() => disableMut.mutate(u.id)} title="Disable" className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-yellow-600" aria-label={`Disable ${u.name || u.username}`}>
                <ToggleRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button onClick={() => enableMut.mutate(u.id)} title="Enable" className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-green-600" aria-label={`Enable ${u.name || u.username}`}>
                <ToggleLeft className="w-3.5 h-3.5" />
              </button>
            )}
            {currentUser && u.id !== currentUser.id && (
              <button onClick={() => setDeleteTarget(u)} title="Delete" className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-destructive" aria-label={`Delete ${u.name || u.username}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        mobileCard={(u) => (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar user={u} />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{u.name || u.username}</p>
                <p className="text-sm text-muted-foreground truncate">{u.email}</p>
              </div>
              <StatusBadge status={u.status} />
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{u.department || '—'} · <RoleBadge role={u.role} /></span>
              <span className="text-xs">{u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}</span>
            </div>
            <div className="flex items-center gap-1 pt-1 border-t border-border">
              <button onClick={() => setViewUser(u)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-muted rounded-md hover:bg-accent">
                <Eye className="w-3 h-3" /> View
              </button>
              <button onClick={() => setEditUser(u)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-muted rounded-md hover:bg-accent">
                <Pencil className="w-3 h-3" /> Edit
              </button>
              {u.status === 'active' ? (
                <button onClick={() => disableMut.mutate(u.id)} className="flex items-center justify-center px-2 py-1.5 text-xs bg-muted rounded-md hover:bg-accent">
                  <ToggleRight className="w-3 h-3" />
                </button>
              ) : (
                <button onClick={() => enableMut.mutate(u.id)} className="flex items-center justify-center px-2 py-1.5 text-xs bg-muted rounded-md hover:bg-accent">
                  <ToggleLeft className="w-3 h-3" />
                </button>
              )}
              {currentUser && u.id !== currentUser.id && (
                <button onClick={() => setDeleteTarget(u)} className="flex items-center justify-center px-2 py-1.5 text-xs bg-muted rounded-md hover:bg-destructive/10 text-destructive">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      />

      {/* Invite Modal */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite User">
        <InviteForm onSubmit={d => inviteMut.mutate(d, {
          onSuccess: () => { toast.success('Invitation sent'); setShowInvite(false); queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() }) },
          onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to invite user'),
        })} loading={inviteMut.isPending} />
      </Modal>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create User">
        <UserForm onSubmit={d => createMut.mutate(d, {
          onSuccess: () => { toast.success('User created'); setShowCreate(false); queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() }) },
          onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to create user'),
        })} loading={createMut.isPending} />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
        {editUser && (
          <UserForm user={editUser} onSubmit={d => updateMut.mutate({ id: editUser.id, data: d }, {
            onSuccess: () => { toast.success('User updated'); setEditUser(null); queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() }) },
            onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to update user'),
          })} loading={updateMut.isPending} />
        )}
      </Modal>

      {/* View Modal */}
      <Modal open={!!viewUser} onClose={() => setViewUser(null)} title="User Details">
        {viewUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-border">
              <Avatar user={viewUser} />
              <div>
                <div className="font-semibold text-lg">{viewUser.name || viewUser.username}</div>
                <div className="text-sm text-muted-foreground">@{viewUser.username}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Email:</span><div>{viewUser.email}</div></div>
              <div><span className="text-muted-foreground">Phone:</span><div>{viewUser.phone || '—'}</div></div>
              <div><span className="text-muted-foreground">Department:</span><div>{viewUser.department || '—'}</div></div>
              <div><span className="text-muted-foreground">Role:</span><div><RoleBadge role={viewUser.role} /></div></div>
              <div><span className="text-muted-foreground">Status:</span><div><StatusBadge status={viewUser.status} /></div></div>
              <div><span className="text-muted-foreground">Last Login:</span><div>{viewUser.last_login ? new Date(viewUser.last_login).toLocaleString() : 'Never'}</div></div>
              <div><span className="text-muted-foreground">Created:</span><div>{new Date(viewUser.created_at).toLocaleString()}</div></div>
              <div className="col-span-2"><span className="text-muted-foreground">Updated:</span><div>{new Date(viewUser.updated_at).toLocaleString()}</div></div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title={`Delete ${deleteTarget?.name || deleteTarget?.username}?`}
        description={deleteTarget?.role === 'ADMIN' ? 'Cannot delete the last active ADMIN.' : 'This will permanently delete this user account.'}
        isDeleting={deleteMut.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMut.mutate(deleteTarget.id, {
            onSuccess: () => { toast.success('User deleted'); setDeleteTarget(null); queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() }) },
            onError: (e: any) => { toast.error(e?.response?.data?.error || 'Failed to delete user'); setDeleteTarget(null) },
          })
        }}
      />
    </div>
  )
}

