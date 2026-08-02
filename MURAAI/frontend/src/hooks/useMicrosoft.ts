import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { microsoftApi } from '@/api/microsoft'
import type { SendEmailPayload, CreateEventPayload, SendMessagePayload } from '@/api/microsoft'
import { queryKeys } from '@/lib/react-query'

// ── Status ─────────────────────────────────────────────────────────────

export function useMicrosoftStatus() {
  return useQuery({
    queryKey: queryKeys.microsoft.status(),
    queryFn: microsoftApi.getStatus,
    staleTime: 2 * 60 * 1000,
  })
}

// ── OneDrive ───────────────────────────────────────────────────────────

export function useOneDriveFiles(folder?: string) {
  return useQuery({
    queryKey: queryKeys.microsoft.onedrive.files(folder),
    queryFn: () => microsoftApi.listOneDriveFiles(folder),
    enabled: false,
  })
}

export function useUploadToOneDrive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, destination }: { file: File; destination?: string }) =>
      microsoftApi.uploadToOneDrive(file, destination),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.microsoft.onedrive.all() })
      toast.success('File uploaded to OneDrive')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Upload failed'),
  })
}

export function useDeleteOneDriveFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fileId: string) => microsoftApi.deleteOneDriveFile(fileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.microsoft.onedrive.all() })
      toast.success('File deleted from OneDrive')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Delete failed'),
  })
}

// ── Outlook ────────────────────────────────────────────────────────────

export function useSendOutlookEmail() {
  return useMutation({
    mutationFn: (payload: SendEmailPayload) => microsoftApi.sendOutlookEmail(payload),
    onSuccess: () => toast.success('Email sent via Outlook'),
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to send email'),
  })
}

export function useCreateOutlookEvent() {
  return useMutation({
    mutationFn: (payload: CreateEventPayload) => microsoftApi.createOutlookEvent(payload),
    onSuccess: () => toast.success('Calendar event created'),
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to create event'),
  })
}

// ── Teams ──────────────────────────────────────────────────────────────

export function useTeams() {
  return useQuery({
    queryKey: queryKeys.microsoft.teams.list(),
    queryFn: microsoftApi.listTeams,
    staleTime: 5 * 60 * 1000,
  })
}

export function useTeamsChannels(teamId: string) {
  return useQuery({
    queryKey: queryKeys.microsoft.teams.channels(teamId),
    queryFn: () => microsoftApi.listTeamsChannels(teamId),
    enabled: !!teamId,
  })
}

export function useSendTeamsMessage() {
  return useMutation({
    mutationFn: ({ teamId, channelId, payload }: { teamId: string; channelId: string; payload: SendMessagePayload }) =>
      microsoftApi.sendTeamsMessage(teamId, channelId, payload),
    onSuccess: () => toast.success('Message sent to Teams channel'),
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to send message'),
  })
}

// ── Entra ID ───────────────────────────────────────────────────────────

export function useEntraUsers(filter?: string) {
  return useQuery({
    queryKey: queryKeys.microsoft.entra.users(filter),
    queryFn: () => microsoftApi.listEntraUsers(filter),
    staleTime: 5 * 60 * 1000,
  })
}

export function useEntraUser(userId: string) {
  return useQuery({
    queryKey: queryKeys.microsoft.entra.user(userId),
    queryFn: () => microsoftApi.getEntraUser(userId),
    enabled: !!userId,
  })
}

export function useEntraGroupMembers(groupId: string) {
  return useQuery({
    queryKey: queryKeys.microsoft.entra.groupMembers(groupId),
    queryFn: () => microsoftApi.listEntraGroupMembers(groupId),
    enabled: !!groupId,
  })
}
