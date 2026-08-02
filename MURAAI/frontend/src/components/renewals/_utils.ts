import type { LucideIcon } from 'lucide-react'
import {
  Plus, Edit3, Upload, CheckCircle, XCircle, Clock,
  FileText, RefreshCw, Circle, Mail, MessageSquare, Phone, Users, AlertTriangle,
  ShoppingCart, Bell, MessageCircle,
} from 'lucide-react'
import type { RenewalCommEntry } from './renewalWorkspaceMockData'

export function formatDate(d: string): string {
  if (!d) return '\u2014'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function daysUntil(d: string): number {
  if (!d) return 0
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

export interface ActivityStyle {
  icon: LucideIcon
  color: string
  bg: string
}

const activityMap: Record<string, ActivityStyle> = {
  renewal_initiated:      { icon: Plus,         color: 'text-blue-500',   bg: 'bg-blue-100 dark:bg-blue-950/30' },
  performance_reviewed:   { icon: FileText,     color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-950/30' },
  proposal_sent:          { icon: Upload,       color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-950/30' },
  approval_submitted:     { icon: Clock,        color: 'text-amber-500',  bg: 'bg-amber-100 dark:bg-amber-950/30' },
  approval_granted:       { icon: CheckCircle,  color: 'text-green-500',  bg: 'bg-green-100 dark:bg-green-950/30' },
  approval_rejected:      { icon: XCircle,      color: 'text-red-500',    bg: 'bg-red-100 dark:bg-red-950/30' },
  proposal_updated:       { icon: Edit3,        color: 'text-teal-500',   bg: 'bg-teal-100 dark:bg-teal-950/30' },
  document_uploaded:      { icon: FileText,     color: 'text-blue-500',   bg: 'bg-blue-100 dark:bg-blue-950/30' },
  task_completed:         { icon: CheckCircle,  color: 'text-green-500',  bg: 'bg-green-100 dark:bg-green-950/30' },
  reminder_sent:          { icon: Bell,         color: 'text-amber-500',  bg: 'bg-amber-100 dark:bg-amber-950/30' },
  po_generated:           { icon: ShoppingCart, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-950/30' },
  comment_added:          { icon: MessageCircle, color: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-950/30' },
  invoice_paid:           { icon: CheckCircle,  color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-950/30' },
  contract_signed:        { icon: Edit3,        color: 'text-green-500',  bg: 'bg-green-100 dark:bg-green-950/30' },
}

const defaultStyle: ActivityStyle = { icon: Circle, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' }

export function getActivityStyle(type: string): ActivityStyle {
  return activityMap[type] || defaultStyle
}

export interface StageStyle {
  icon: LucideIcon
  label: string
  color: string
  bg: string
  ring: boolean
}

export function getStageStyle(status: string): StageStyle {
  switch (status) {
    case 'completed':
      return { icon: CheckCircle, label: 'Completed', color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-950/30', ring: false }
    case 'active':
      return { icon: Clock, label: 'In Progress', color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-950/30', ring: true }
    case 'blocked':
      return { icon: XCircle, label: 'Blocked', color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-950/30', ring: false }
    default:
      return { icon: Circle, label: 'Pending', color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', ring: false }
  }
}

export const priorityBadge: Record<string, string> = {
  high:   'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-950/30',
  medium: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/30',
  low:    'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-950/30',
}

export const poStatusBadge: Record<string, string> = {
  completed: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-950/30',
  partial:   'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/30',
  draft:     'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800',
  cancelled: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-950/30',
}

export const invoiceStatusBadge: Record<string, string> = {
  paid:    'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-950/30',
  pending: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/30',
  draft:   'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800',
  overdue: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-950/30',
}

export const directionBadge: Record<string, string> = {
  outbound: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30',
  inbound:  'bg-purple-100 text-purple-600 dark:bg-purple-950/30',
}

export interface CommStyle {
  icon: LucideIcon
  bg: string
}

export const commStyle: Record<string, CommStyle> = {
  email:   { icon: Mail,        bg: 'bg-blue-100 text-blue-600 dark:bg-blue-950/30' },
  note:    { icon: FileText,    bg: 'bg-amber-100 text-amber-600 dark:bg-amber-950/30' },
  meeting: { icon: Users,       bg: 'bg-green-100 text-green-600 dark:bg-green-950/30' },
  call:    { icon: Phone,       bg: 'bg-purple-100 text-purple-600 dark:bg-purple-950/30' },
}

const healthScoreColorMap: Record<string, string> = {
  excellent: 'text-green-500',
  good:      'text-blue-500',
  fair:      'text-amber-500',
}

const healthScoreBgMap: Record<string, string> = {
  excellent: 'bg-green-500',
  good:      'bg-blue-500',
  fair:      'bg-amber-500',
}

export function healthScoreColor(level: string): string {
  return healthScoreColorMap[level] || 'text-red-500'
}

export function healthScoreBg(level: string): string {
  return healthScoreBgMap[level] || 'bg-red-500'
}

export function healthFactorStyle(status: string): { icon: LucideIcon; color: string; bg: string } {
  switch (status) {
    case 'healthy':  return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-950/30' }
    case 'warning':  return { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-950/30' }
    default:         return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-950/30' }
  }
}

export function riskBorder(severity: string): string {
  switch (severity) {
    case 'critical': return 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
    case 'high':     return 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20'
    case 'medium':   return 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'
    default:         return 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20'
  }
}

export function urgencyBorder(urgency: string): string {
  switch (urgency) {
    case 'high':   return 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
    case 'medium': return 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'
    default:       return 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20'
  }
}
