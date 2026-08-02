import { memo } from 'react'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  variant?: 'filled' | 'outlined' | 'soft'
  size?: 'sm' | 'md'
  dot?: boolean
  className?: string
}

const colorMap: Record<string, string> = {
  active: 'green',
  draft: 'gray',
  expired: 'red',
  completed: 'blue',
  cancelled: 'red',
  pending: 'amber',
  paid: 'green',
  overdue: 'red',
  on_hold: 'amber',
  approved: 'green',
  rejected: 'red',
  submitted: 'blue',
  issued: 'blue',
  outstanding: 'amber',
  critical: 'red',
  'in progress': 'blue',
  'in_progress': 'blue',
  signed: 'green',
  executed: 'teal',
  'on track': 'green',
  'needs attention': 'amber',
  'at risk': 'red',
  low: 'gray',
  medium: 'amber',
  high: 'orange',
  healthy: 'green',
  warning: 'amber',
  partial: 'amber',
  renewal: 'purple',
  negotiation: 'amber',
  review: 'blue',
  signature: 'green',
  execution: 'teal',
  completion: 'gray',
}

const filledStyles: Record<string, string> = {
  green: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
}

const outlinedStyles: Record<string, string> = {
  green: 'border border-green-300 text-green-700 dark:border-green-700 dark:text-green-400',
  gray: 'border border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400',
  red: 'border border-red-300 text-red-700 dark:border-red-700 dark:text-red-400',
  blue: 'border border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400',
  amber: 'border border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400',
  purple: 'border border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400',
  teal: 'border border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-400',
  orange: 'border border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-400',
}

const softStyles: Record<string, string> = {
  green: 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400',
  gray: 'bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400',
  red: 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400',
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400',
  purple: 'bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400',
  teal: 'bg-teal-50 text-teal-700 dark:bg-teal-950/20 dark:text-teal-400',
  orange: 'bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400',
}

const dotColors: Record<string, string> = {
  green: 'bg-green-500',
  gray: 'bg-gray-400',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  purple: 'bg-purple-500',
  teal: 'bg-teal-500',
  orange: 'bg-orange-500',
}

function resolveColor(status: string): string {
  const key = status?.toLowerCase().replace(/\s+/g, '_') || ''
  return colorMap[key] || 'gray'
}

export const StatusBadge = memo(function StatusBadge({
  status,
  variant = 'soft',
  size = 'sm',
  dot = false,
  className,
}: StatusBadgeProps) {
  const colorKey = resolveColor(status)
  const variantStyles = variant === 'outlined' ? outlinedStyles : variant === 'soft' ? softStyles : filledStyles

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        variantStyles[colorKey],
        dot && 'pl-2',
        className,
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[colorKey])} />}
      {status}
    </span>
  )
})
