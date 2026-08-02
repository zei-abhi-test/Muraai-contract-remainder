import { AlertTriangle, Clock, RefreshCw, CheckCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface TodayMetric {
  value: string
  label: string
  detail: string
  icon: LucideIcon
  color: string
  bg: string
  accent: string
}

export interface CompactInboxItem {
  id: string
  title: string
  summary: string
  type: string
  priority: string
  timestamp: string
  actionable: boolean
}

export interface CompactActivityItem {
  id: string
  actor: string
  action: string
  target: string
  timestamp: string
  type: string
}

export interface DeadlineItem {
  id: string
  label: string
  entity: string
  days: number
  type: string
}

export interface AIRecommendation {
  id: string
  title: string
  description: string
  action: string
  priority: 'high' | 'medium' | 'low'
  page: string
  params?: Record<string, any>
}

export interface MissionControlData {
  todayMetrics: TodayMetric[]
  inboxItems: CompactInboxItem[]
  recentActivity: CompactActivityItem[]
  deadlines: DeadlineItem[]
  aiRecommendations: AIRecommendation[]
}

function hoursAgo(h: number): string {
  if (h === 0) return 'Just now'
  if (h === 1) return '1h ago'
  return `${h}h ago`
}

export const mockMissionControlData: MissionControlData = {
  todayMetrics: [
    { value: '6', label: 'Renewals Need Attention', detail: '3 at risk, 2 expiring this week, 1 overdue', icon: RefreshCw, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20', accent: 'bg-red-500' },
    { value: '3', label: 'Waiting on Vendor', detail: '2 pricing quotes, 1 compliance document', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20', accent: 'bg-amber-500' },
    { value: '2', label: 'SLA Breaches', detail: 'Response time exceeded on 2 enterprise accounts', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/20', accent: 'bg-orange-500' },
    { value: '1', label: 'Approval Required', detail: 'Pricing revision for Enterprise License — VP Finance', icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/20', accent: 'bg-purple-500' },
  ],
  inboxItems: [
    { id: 'i1', title: 'Contract approval needed', summary: 'Delta Services Enterprise Agreement v3 — requires your review before quarterly close', type: 'approval', priority: 'urgent', timestamp: hoursAgo(0), actionable: true },
    { id: 'i2', title: 'Invoice overdue — 15 days', summary: 'INV-2024-0092 from TechCorp — ₹4,50,000. Second reminder sent.', type: 'invoice', priority: 'urgent', timestamp: hoursAgo(1), actionable: true },
    { id: 'i3', title: 'Renewal action required', summary: 'Acme Corp Enterprise License expires in 7 days — renew or terminate', type: 'renewal', priority: 'high', timestamp: hoursAgo(2), actionable: true },
    { id: 'i4', title: 'PO pending approval', summary: 'PO-2024-0045 from GlobalTech — ₹12,00,000 for infrastructure upgrade', type: 'approval', priority: 'high', timestamp: hoursAgo(3), actionable: true },
    { id: 'i5', title: 'Document awaiting signature', summary: 'NDA with Startify Labs — pending your e-signature', type: 'document', priority: 'normal', timestamp: hoursAgo(5), actionable: true },
  ],
  recentActivity: [
    { id: 'a1', actor: 'Priya S.', action: 'created', target: 'contract for Startify Labs', timestamp: hoursAgo(1), type: 'created' },
    { id: 'a2', actor: 'Vikram M.', action: 'approved', target: 'Delta Services Enterprise Agreement', timestamp: hoursAgo(2), type: 'approved' },
    { id: 'a3', actor: 'System', action: 'paid', target: 'INV-2024-0085 — ₹3,20,000 from Acme Corp', timestamp: hoursAgo(3), type: 'paid' },
    { id: 'a4', actor: 'Ananya K.', action: 'updated', target: 'Beta Inc SaaS subscription terms', timestamp: hoursAgo(4), type: 'updated' },
    { id: 'a5', actor: 'Ravi', action: 'uploaded', target: 'signed NDA for Gamma LLC partnership', timestamp: hoursAgo(6), type: 'uploaded' },
  ],
  deadlines: [
    { id: 'd1', label: 'Enterprise License Renewal', entity: 'Acme Corp', days: 3, type: 'renewal' },
    { id: 'd2', label: 'SaaS Subscription Expiry', entity: 'Beta Inc', days: 7, type: 'expiry' },
    { id: 'd3', label: 'Managed Services Review', entity: 'Gamma LLC', days: 14, type: 'renewal' },
    { id: 'd4', label: 'Office Space Lease', entity: 'Prime Properties', days: 15, type: 'expiry' },
    { id: 'd5', label: 'Quarterly Compliance Filing', entity: 'Legal', days: 21, type: 'compliance' },
  ],
  aiRecommendations: [
    { id: 'r1', title: 'Review pricing on 3 renewals', description: 'Market analysis suggests 5-8% uplift is feasible for Enterprise tier contracts renewing this quarter.', action: 'Open Renewals', priority: 'high', page: 'renewals' },
    { id: 'r2', title: 'Schedule QBR with Acme Corp', description: 'Acme engagement score dropped 12% this month. Early QBR recommended to address concerns.', action: 'Schedule Meeting', priority: 'high', page: 'operational-inbox' },
    { id: 'r3', title: 'Send proposal to TechCorp', description: 'TechCorp expressed interest in Advanced Analytics module. Draft proposal ready for review.', action: 'Review Proposal', priority: 'medium', page: 'contracts' },
    { id: 'r4', title: 'Update vendor pricing sheets', description: '3 vendor quotes have expired. Request updated pricing before next PO generation.', action: 'View Vendors', priority: 'medium', page: 'purchase-orders' },
  ],
}
