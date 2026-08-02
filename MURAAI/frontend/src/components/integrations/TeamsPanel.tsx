import { useState } from 'react'
import { useTeams, useTeamsChannels, useSendTeamsMessage } from '@/hooks/useMicrosoft'

interface Props {
  configured: boolean
}

export function TeamsPanel({ configured }: Props) {
  const { data: teamsData } = useTeams()
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const { data: channelsData } = useTeamsChannels(selectedTeam)
  const [selectedChannel, setSelectedChannel] = useState<string>('')
  const [message, setMessage] = useState('')
  const sendMutation = useSendTeamsMessage()

  if (!configured) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Configure Azure environment variables to list Teams and send messages via Microsoft Graph.
      </div>
    )
  }

  const handleSend = () => {
    if (!selectedTeam || !selectedChannel || !message.trim()) return
    sendMutation.mutate({
      teamId: selectedTeam,
      channelId: selectedChannel,
      payload: { message },
    })
    setMessage('')
  }

  const teams = teamsData?.teams ?? []
  const channels = channelsData?.channels ?? []

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium mb-1 block">Team</label>
        <select
          value={selectedTeam}
          onChange={(e) => { setSelectedTeam(e.target.value); setSelectedChannel('') }}
          className="w-full px-3 py-1.5 text-xs border border-input rounded-lg bg-background"
        >
          <option value="">Select a team...</option>
          {teams.map((t: any) => (
            <option key={t.id} value={t.id}>{t.displayName}</option>
          ))}
        </select>
      </div>

      {selectedTeam && (
        <div>
          <label className="text-xs font-medium mb-1 block">Channel</label>
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-input rounded-lg bg-background"
          >
            <option value="">Select a channel...</option>
            {channels.map((c: any) => (
              <option key={c.id} value={c.id}>{c.displayName}</option>
            ))}
          </select>
        </div>
      )}

      {selectedChannel && (
        <>
          <div>
            <label className="text-xs font-medium mb-1 block">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Type your message..."
              className="w-full px-3 py-1.5 text-xs border border-input rounded-lg bg-background resize-none"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={sendMutation.isPending || !message.trim()}
            className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {sendMutation.isPending ? 'Sending...' : 'Send to Channel'}
          </button>
        </>
      )}
    </div>
  )
}
