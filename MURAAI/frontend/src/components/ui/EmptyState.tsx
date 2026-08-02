import { motion } from 'framer-motion'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ElementType, ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ElementType
  iconBg?: string
  title?: string
  description?: string
  action?: { label: string; onClick: () => void } | ReactNode
  secondary?: { label: string; onClick: () => void }
  className?: string
}

export function EmptyState({
  icon: Icon,
  iconBg,
  title = 'No data found',
  description,
  action,
  secondary,
  className,
}: EmptyStateProps) {
  const IconComponent = Icon || Package

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('flex flex-col items-center justify-center py-16 text-muted-foreground', className)}
    >
      <div className={cn('p-4 bg-muted/50 rounded-full mb-4', iconBg)}>
        <IconComponent className="w-10 h-10" />
      </div>
      <p className="font-semibold text-foreground text-lg mb-1">{title}</p>
      {description && <p className="text-sm text-muted-foreground mb-6 max-w-sm text-center">{description}</p>}
      {action && (
        action && typeof action === 'object' && 'label' in action ? (
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            {action.label}
          </button>
        ) : (
          <div className="mt-4">{action}</div>
        )
      )}
      {secondary && (
        <button onClick={secondary.onClick} className="text-sm text-primary hover:underline mt-3">
          {secondary.label}
        </button>
      )}
    </motion.div>
  )
}
