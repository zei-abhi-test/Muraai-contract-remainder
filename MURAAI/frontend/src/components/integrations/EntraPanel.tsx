import { useState } from 'react'
import { useEntraUsers, useEntraGroupMembers } from '@/hooks/useMicrosoft'

interface Props {
  configured: boolean
}

export function EntraPanel({ configured }: Props) {
  const [tab, setTab] = useState<'users' | 'groups'>('users')
  const [filter, setFilter] = useState('')
  const [groupId, setGroupId] = useState('')

  if (!configured) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Configure Azure environment variables to browse Entra ID users and groups via Microsoft Graph.
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('users')}
          className={`text-xs px-3 py-1.5 rounded-lg ${
            tab === 'users' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          Users
        </button>
        <button
          onClick={() => setTab('groups')}
          className={`text-xs px-3 py-1.5 rounded-lg ${
            tab === 'groups' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          Group Members
        </button>
      </div>

      {tab === 'users' ? (
        <UserSearch filter={filter} onFilterChange={setFilter} />
      ) : (
        <GroupMembers groupId={groupId} onGroupIdChange={setGroupId} />
      )}
    </div>
  )
}

function UserSearch({ filter, onFilterChange }: { filter: string; onFilterChange: (v: string) => void }) {
  const { data, isLoading } = useEntraUsers(filter || undefined)

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        placeholder="Filter by displayName, userPrincipalName..."
        className="w-full px-3 py-1.5 text-xs border border-input rounded-lg bg-background"
      />
      {isLoading && <p className="text-xs text-muted-foreground">Loading users...</p>}
      {data && data.users.length === 0 && !isLoading && (
        <p className="text-xs text-muted-foreground py-4 text-center">No users found.</p>
      )}
      {data && data.users.length > 0 && (
        <div className="border border-border rounded-lg divide-y divide-border max-h-64 overflow-y-auto">
          {data.users.map((user: any) => (
            <div key={user.id} className="px-3 py-2">
              <p className="text-xs font-medium">{user.displayName || user.userPrincipalName}</p>
              {user.mail && <p className="text-xs text-muted-foreground">{user.mail}</p>}
              {user.jobTitle && <p className="text-xs text-muted-foreground">{user.jobTitle}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GroupMembers({ groupId, onGroupIdChange }: { groupId: string; onGroupIdChange: (v: string) => void }) {
  const { data, isLoading } = useEntraGroupMembers(groupId)

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={groupId}
        onChange={(e) => onGroupIdChange(e.target.value)}
        placeholder="Group ID (objectId)..."
        className="w-full px-3 py-1.5 text-xs border border-input rounded-lg bg-background"
      />
      {isLoading && <p className="text-xs text-muted-foreground">Loading members...</p>}
      {data && data.members.length === 0 && !isLoading && groupId && (
        <p className="text-xs text-muted-foreground py-4 text-center">No members found.</p>
      )}
      {data && data.members.length > 0 && (
        <div className="border border-border rounded-lg divide-y divide-border max-h-64 overflow-y-auto">
          {data.members.map((member: any) => (
            <div key={member.id} className="px-3 py-2">
              <p className="text-xs font-medium">{member.displayName || member.userPrincipalName}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
