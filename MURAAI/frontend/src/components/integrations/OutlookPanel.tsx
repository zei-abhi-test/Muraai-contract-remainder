import { useState } from 'react'
import { useSendOutlookEmail, useCreateOutlookEvent } from '@/hooks/useMicrosoft'

interface Props {
  configured: boolean
}

export function OutlookPanel({ configured }: Props) {
  const [tab, setTab] = useState<'email' | 'event'>('email')

  if (!configured) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Configure Azure environment variables to send emails and create calendar events via Microsoft Graph.
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('email')}
          className={`text-xs px-3 py-1.5 rounded-lg ${
            tab === 'email' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          Send Email
        </button>
        <button
          onClick={() => setTab('event')}
          className={`text-xs px-3 py-1.5 rounded-lg ${
            tab === 'event' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          Create Event
        </button>
      </div>

      {tab === 'email' ? <EmailForm /> : <EventForm />}
    </div>
  )
}

function EmailForm() {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const mutation = useSendOutlookEmail()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const recipients = to.split(',').map((s) => s.trim()).filter(Boolean)
    if (recipients.length === 0) return
    mutation.mutate({ to: recipients, subject, body })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-medium mb-1 block">To (comma-separated)</label>
        <input
          type="text" value={to} onChange={(e) => setTo(e.target.value)}
          placeholder="user@example.com, user2@example.com"
          className="w-full px-3 py-1.5 text-xs border border-input rounded-lg bg-background"
        />
      </div>
      <div>
        <label className="text-xs font-medium mb-1 block">Subject</label>
        <input
          type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
          className="w-full px-3 py-1.5 text-xs border border-input rounded-lg bg-background"
        />
      </div>
      <div>
        <label className="text-xs font-medium mb-1 block">Body (HTML)</label>
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)} rows={4}
          className="w-full px-3 py-1.5 text-xs border border-input rounded-lg bg-background resize-none"
        />
      </div>
      <button
        type="submit" disabled={mutation.isPending}
        className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
      >
        {mutation.isPending ? 'Sending...' : 'Send Email'}
      </button>
    </form>
  )
}

function EventForm() {
  const [subject, setSubject] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [location, setLocation] = useState('')
  const mutation = useCreateOutlookEvent()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({ subject, start, end, location: location || undefined })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-medium mb-1 block">Subject</label>
        <input
          type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
          className="w-full px-3 py-1.5 text-xs border border-input rounded-lg bg-background"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium mb-1 block">Start</label>
          <input
            type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-input rounded-lg bg-background"
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">End</label>
          <input
            type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-input rounded-lg bg-background"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium mb-1 block">Location</label>
        <input
          type="text" value={location} onChange={(e) => setLocation(e.target.value)}
          className="w-full px-3 py-1.5 text-xs border border-input rounded-lg bg-background"
        />
      </div>
      <button
        type="submit" disabled={mutation.isPending}
        className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
      >
        {mutation.isPending ? 'Creating...' : 'Create Event'}
      </button>
    </form>
  )
}
