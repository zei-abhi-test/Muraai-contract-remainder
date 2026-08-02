import { motion } from 'framer-motion'
import { Loader2, Package } from 'lucide-react'

export function LoadingSpinner({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`} role="status" aria-label="Loading">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      >
        <Loader2 className="text-primary" size={size} />
      </motion.div>
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center justify-center py-12 text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      >
        <Loader2 className="w-8 h-8 mb-4 text-primary" />
      </motion.div>
      <p>{message}</p>
    </motion.div>
  )
}

export function EmptyState({
  icon,
  title = 'No data found',
  description,
  action,
  secondary,
}: {
  icon?: React.ElementType
  title?: string
  description?: string
  action?: { label: string; onClick: () => void } | React.ReactNode
  secondary?: { label: string; onClick: () => void }
}) {
  const Icon = icon || Package
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center py-16 text-muted-foreground"
    >
      <div className="p-4 bg-muted/50 rounded-full mb-4">
        <Icon className="w-10 h-10" />
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
