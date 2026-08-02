import api from './axios'

export interface MicrosoftServiceStatus {
  provider: string
  available: boolean
  configured: boolean
}

export interface MicrosoftStatus {
  configured: boolean
  services: MicrosoftServiceStatus[]
}

export interface OneDriveFile {
  id: string
  name: string
  size: number
  webUrl: string
  lastModifiedDateTime: string
  folder?: { childCount: number }
  file?: { mimeType: string }
}

export interface TeamsTeam {
  id: string
  displayName: string
  description?: string
}

export interface TeamsChannel {
  id: string
  displayName: string
  description?: string
}

export interface EntraUser {
  id: string
  displayName: string
  userPrincipalName: string
  mail: string | null
  jobTitle: string | null
  department: string | null
}

export interface EntraGroupMember {
  id: string
  displayName: string
  userPrincipalName?: string
}

export interface SendEmailPayload {
  to: string[]
  subject: string
  body: string
  cc?: string[]
  bcc?: string[]
  attachments?: { name: string; contentBytes: string; contentType: string }[]
}

export interface CreateEventPayload {
  subject: string
  start: string
  end: string
  attendees?: string[]
  body?: string
  location?: string
}

export interface SendMessagePayload {
  message: string
}

export const microsoftApi = {
  getStatus: async (): Promise<MicrosoftStatus> => {
    const r = await api.get('/microsoft/status')
    return r.data as MicrosoftStatus
  },

  // OneDrive
  listOneDriveFiles: async (folder?: string): Promise<{ files: OneDriveFile[]; available: boolean }> => {
    const r = await api.get('/microsoft/onedrive/files', { params: { folder } })
    return r.data as { files: OneDriveFile[]; available: boolean }
  },

  uploadToOneDrive: async (file: File, destination?: string): Promise<any> => {
    const form = new FormData()
    form.append('file', file)
    if (destination) form.append('destination', destination)
    const r = await api.post('/microsoft/onedrive/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return r.data
  },

  downloadFromOneDrive: async (fileId: string): Promise<Blob> => {
    const r = await api.get(`/microsoft/onedrive/download/${fileId}`, { responseType: 'blob' })
    return r.data
  },

  deleteOneDriveFile: async (fileId: string): Promise<void> => {
    await api.delete(`/microsoft/onedrive/files/${fileId}`)
  },

  getOneDriveShareLink: async (fileId: string, type?: string): Promise<{ webUrl: string }> => {
    const r = await api.get(`/microsoft/onedrive/share-link/${fileId}`, { params: { type } })
    return r.data as { webUrl: string }
  },

  // Outlook
  sendOutlookEmail: async (payload: SendEmailPayload): Promise<void> => {
    await api.post('/microsoft/outlook/send', payload)
  },

  createOutlookEvent: async (payload: CreateEventPayload): Promise<any> => {
    const r = await api.post('/microsoft/outlook/events', payload)
    return r.data
  },

  // Teams
  listTeams: async (): Promise<{ teams: TeamsTeam[]; available: boolean }> => {
    const r = await api.get('/microsoft/teams')
    return r.data as { teams: TeamsTeam[]; available: boolean }
  },

  listTeamsChannels: async (teamId: string): Promise<{ channels: TeamsChannel[]; available: boolean }> => {
    const r = await api.get(`/microsoft/teams/${teamId}/channels`)
    return r.data as { channels: TeamsChannel[]; available: boolean }
  },

  sendTeamsMessage: async (teamId: string, channelId: string, payload: SendMessagePayload): Promise<any> => {
    const r = await api.post(`/microsoft/teams/${teamId}/channels/${channelId}/messages`, payload)
    return r.data
  },

  // Entra ID
  listEntraUsers: async (filter?: string, top?: number): Promise<{ users: EntraUser[]; available: boolean }> => {
    const r = await api.get('/microsoft/entra/users', { params: { filter, top } })
    return r.data as { users: EntraUser[]; available: boolean }
  },

  getEntraUser: async (userId: string): Promise<EntraUser> => {
    const r = await api.get(`/microsoft/entra/users/${userId}`)
    return r.data as EntraUser
  },

  listEntraGroupMembers: async (groupId: string): Promise<{ members: EntraGroupMember[]; available: boolean }> => {
    const r = await api.get(`/microsoft/entra/groups/${groupId}/members`)
    return r.data as { members: EntraGroupMember[]; available: boolean }
  },
}
