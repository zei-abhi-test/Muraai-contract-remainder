import type { Notification, GroupKey, GroupedNotifications, NotificationFilter } from './types'
import { BUSINESS_OBJECT_TO_FILTER, GROUP_LABELS } from './types'

function ts(agoMinutes: number): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - agoMinutes)
  return d.toISOString()
}

function daysAgo(days: number, hours = 9): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hours, Math.floor(Math.random() * 60), 0, 0)
  return d.toISOString()
}

export const mockNotifications: Notification[] = [
  {
    id: 'n1', priority: 'critical', businessObject: 'approval',
    title: 'Pricing approval overdue — 3 days',
    description: 'Priya Sharma (VP Finance) has not responded to pricing revision request for Enterprise License renewal. Escalation recommended.',
    timestamp: ts(25), isRead: false, isArchived: false,
    primaryAction: { label: 'View Approval', page: 'renewal-workspace', params: { renewalId: 1 } },
    secondaryAction: { label: 'Send Reminder', page: 'renewal-workspace', params: { renewalId: 1 } },
  },
  {
    id: 'n2', priority: 'critical', businessObject: 'renewal',
    title: 'Enterprise License expiring in 3 days',
    description: 'Acme Corp — Year 3 renewal window closing. Current stage: Pricing Approval. Action required before 14 Jan 2026.',
    timestamp: ts(45), isRead: false, isArchived: false,
    primaryAction: { label: 'Open Renewal', page: 'renewal-workspace', params: { renewalId: 1 } },
  },
  {
    id: 'n3', priority: 'warning', businessObject: 'contract',
    title: 'SLA response time breached',
    description: 'Enterprise tier SLA response time exceeded on 2 accounts: Acme Corp (4.2h vs 2h target) and Beta Inc (3.8h vs 2h target).',
    timestamp: ts(65), isRead: false, isArchived: false,
    primaryAction: { label: 'View Contracts', page: 'contracts' },
  },
  {
    id: 'n4', priority: 'warning', businessObject: 'document',
    title: '3 compliance documents expiring soon',
    description: 'Compliance certifications for Enterprise License, SaaS Agreement, and Data Processing Addendum expire within 30 days.',
    timestamp: ts(120), isRead: false, isArchived: false,
    primaryAction: { label: 'View Documents', page: 'documents' },
  },
  {
    id: 'n5', priority: 'success', businessObject: 'invoice',
    title: 'INV-2025-0042 marked as paid',
    description: 'Payment of $750,000 received from Acme Corp and reconciled against PO-2025-0003. Cash flow updated.',
    timestamp: ts(150), isRead: false, isArchived: false,
    primaryAction: { label: 'View Invoice', page: 'invoices' },
  },
  {
    id: 'n6', priority: 'info', businessObject: 'system',
    title: 'SLA countdown: 45 days remaining',
    description: 'Renewal window for Enterprise License closes in 45 days. Current progress: 55% complete.',
    timestamp: ts(200), isRead: false, isArchived: false,
    primaryAction: { label: 'View Renewal', page: 'renewal-workspace', params: { renewalId: 1 } },
  },
  {
    id: 'n7', priority: 'info', businessObject: 'task',
    title: 'Task assigned: Schedule customer presentation',
    description: 'Ravi Kumar assigned you "Schedule QBR slot with Acme procurement" — due in 5 days.',
    timestamp: ts(300), isRead: false, isArchived: false,
    primaryAction: { label: 'View Task', page: 'operational-inbox' },
  },
  {
    id: 'n8', priority: 'critical', businessObject: 'invoice',
    title: 'INV-2024-0092 overdue — 15 days',
    description: 'TechCorp invoice for ₹4,50,000 is 15 days overdue. Second reminder sent. Late payment penalty of 2% applicable.',
    timestamp: daysAgo(0, 8), isRead: false, isArchived: false,
    primaryAction: { label: 'View Invoice', page: 'invoices' },
    secondaryAction: { label: 'Send Reminder', page: 'invoices' },
  },
  {
    id: 'n9', priority: 'warning', businessObject: 'po',
    title: 'PO-2025-0003 still in draft',
    description: 'Purchase order for Advanced Analytics add-on module has been in draft for 5 days. Requires pricing finalisation.',
    timestamp: daysAgo(0, 10), isRead: true, isArchived: false,
    primaryAction: { label: 'Edit PO', page: 'purchase-orders' },
  },
  {
    id: 'n10', priority: 'success', businessObject: 'renewal',
    title: 'Renewal proposal sent to Acme Corp',
    description: 'Final proposal with 8% uplift, 3-year commitment, and tiered add-on pricing delivered to procurement team.',
    timestamp: daysAgo(0, 11), isRead: true, isArchived: false,
    primaryAction: { label: 'Track Renewal', page: 'renewal-workspace', params: { renewalId: 1 } },
  },
  {
    id: 'n11', priority: 'info', businessObject: 'document',
    title: 'Compliance certification uploaded',
    description: 'Ravi Kumar uploaded Compliance_Certification_2025.pdf — valid through July 2027. Document requirement resolved.',
    timestamp: daysAgo(1, 9), isRead: true, isArchived: false,
    primaryAction: { label: 'View Document', page: 'documents' },
  },
  {
    id: 'n12', priority: 'warning', businessObject: 'system',
    title: 'Budget utilisation at 87%',
    description: 'Enterprise Sales department budget at 87% with Q4 remaining. Additional PO approvals may be restricted.',
    timestamp: daysAgo(1, 11), isRead: true, isArchived: false,
    primaryAction: { label: 'View Budget', page: 'reports' },
  },
  {
    id: 'n13', priority: 'success', businessObject: 'approval',
    title: 'VP Sales approved discount exception',
    description: 'Ananya K. approved exception to standard discount ceiling — allows up to 12% for strategic deals above $2M ACV.',
    timestamp: daysAgo(1, 14), isRead: true, isArchived: false,
    primaryAction: { label: 'View Approval', page: 'approvals' },
  },
  {
    id: 'n14', priority: 'critical', businessObject: 'po',
    title: 'Vendor quote expired — request new pricing',
    description: 'Q4 technology vendor quote for pass-through costs has expired. Updated pricing required before PO generation.',
    timestamp: daysAgo(2, 8), isRead: true, isArchived: false,
    primaryAction: { label: 'Request Quote', page: 'purchase-orders' },
  },
  {
    id: 'n15', priority: 'info', businessObject: 'system',
    title: 'Auto-reminder: Q3 review pending',
    description: 'Quarterly contract portfolio review is due. 12 active contracts need compliance status update by end of week.',
    timestamp: daysAgo(2, 10), isRead: true, isArchived: false,
    primaryAction: { label: 'Start Review', page: 'reports' },
  },
  {
    id: 'n16', priority: 'success', businessObject: 'contract',
    title: 'Amendment #3 digitally signed',
    description: 'Acme Corp authorised representative signed Amendment #3 for auto-renewal clause update. Effective immediately.',
    timestamp: daysAgo(2, 14), isRead: true, isArchived: false,
    primaryAction: { label: 'View Contract', page: 'contract-workspace', params: { contractId: 101 } },
  },
  {
    id: 'n17', priority: 'warning', businessObject: 'task',
    title: 'Pricing proposal task overdue',
    description: '"Finalise pricing proposal document" was due yesterday. Customer presentation scheduled this week depends on it.',
    timestamp: daysAgo(3, 7), isRead: true, isArchived: false,
    primaryAction: { label: 'Complete Task', page: 'operational-inbox' },
  },
  {
    id: 'n18', priority: 'info', businessObject: 'approval',
    title: 'New approval request from Ravi Kumar',
    description: 'Step 3 pricing approval for Enterprise License Renewal routed to Priya Sharma (VP Finance).',
    timestamp: daysAgo(3, 13), isRead: true, isArchived: false,
    primaryAction: { label: 'Review', page: 'approvals' },
  },
  {
    id: 'n19', priority: 'success', businessObject: 'document',
    title: 'Q3 Usage Report generated',
    description: 'Automated Q3 Usage Analytics Report for Acme Corp — 94% adoption, 99.9% uptime, 4.5/5 satisfaction.',
    timestamp: daysAgo(3, 15), isRead: true, isArchived: false,
    primaryAction: { label: 'View Report', page: 'documents' },
  },
  {
    id: 'n20', priority: 'warning', businessObject: 'contract',
    title: 'Competitor risk detected',
    description: 'Competitor XYZ reaching out to Acme procurement. Monitor engagement closely. Consider scheduling executive check-in.',
    timestamp: daysAgo(4, 10), isRead: true, isArchived: false,
    primaryAction: { label: 'View Contract', page: 'contract-workspace', params: { contractId: 101 } },
  },
  {
    id: 'n21', priority: 'info', businessObject: 'system',
    title: 'Document expiry alert generated',
    description: 'System flagged 3 expiring certifications. Automated renewal reminders queued for document owners.',
    timestamp: daysAgo(4, 16), isRead: true, isArchived: false,
    primaryAction: { label: 'View Alerts', page: 'documents' },
  },
  {
    id: 'n22', priority: 'success', businessObject: 'renewal',
    title: 'Renewal workflow initiated for TechStart Inc',
    description: 'Early renewal process started for TechStart Inc — current contract expires January 2027. 12-month planning window.',
    timestamp: daysAgo(5, 10), isRead: true, isArchived: true,
    primaryAction: { label: 'Track Renewal', page: 'renewals' },
  },
  {
    id: 'n23', priority: 'info', businessObject: 'task',
    title: 'Headcount verification completed',
    description: 'Support Team verified 1,240 licenses against current employee roster — 100% match. No adjustments needed.',
    timestamp: daysAgo(5, 15), isRead: true, isArchived: true,
    primaryAction: { label: 'View Details', page: 'operational-inbox' },
  },
  {
    id: 'n24', priority: 'warning', businessObject: 'invoice',
    title: 'Monthly reconciliation: 12 invoices matched',
    description: 'Finance team completed monthly reconciliation — 12 invoices matched against 8 POs. Zero discrepancies.',
    timestamp: daysAgo(6, 14), isRead: true, isArchived: true,
    primaryAction: { label: 'View Report', page: 'reports' },
  },
  {
    id: 'n25', priority: 'critical', businessObject: 'contract',
    title: 'NDA addendum requires renewal',
    description: 'Signed NDA with Gamma LLC partnership scope has expired. Updated addendum with 2026 scope needs execution.',
    timestamp: daysAgo(7, 9), isRead: true, isArchived: true,
    primaryAction: { label: 'Renew NDA', page: 'contracts' },
  },
  {
    id: 'n26', priority: 'info', businessObject: 'system',
    title: 'Bulk approval: 6 pricing revisions',
    description: 'System generated 6 approval requests for Q4 pricing revisions across enterprise renewals. VP Finance approval required.',
    timestamp: daysAgo(7, 14), isRead: true, isArchived: true,
    primaryAction: { label: 'View All', page: 'approvals' },
  },
]

export function groupNotifications(items: Notification[]): GroupedNotifications[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const groups: Record<GroupKey, Notification[]> = { today: [], yesterday: [], week: [], older: [] }

  const sorted = [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  for (const item of sorted) {
    const d = new Date(item.timestamp)
    if (d >= today) groups.today.push(item)
    else if (d >= yesterday) groups.yesterday.push(item)
    else if (d >= weekAgo) groups.week.push(item)
    else groups.older.push(item)
  }

  return (Object.entries(GROUP_LABELS) as [GroupKey, string][])
    .map(([key, label]) => ({ key, label, items: groups[key] }))
    .filter(g => g.items.length > 0)
}

export function filterNotifications(items: Notification[], filter: NotificationFilter, search: string): Notification[] {
  let filtered = items

  if (filter === 'unread') {
    filtered = filtered.filter(n => !n.isRead)
  } else if (filter !== 'all') {
    filtered = filtered.filter(n => BUSINESS_OBJECT_TO_FILTER[n.businessObject] === filter)
  }

  if (search.trim()) {
    const q = search.toLowerCase()
    filtered = filtered.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.description.toLowerCase().includes(q) ||
      n.businessObject.toLowerCase().includes(q)
    )
  }

  return filtered
}

export function formatNotificationTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
