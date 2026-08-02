import { motion } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ElementType } from 'react'

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
  icon?: ElementType
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  retryLabel = 'Try again',
  icon: Icon,
  className,
}: ErrorStateProps) {
  const IconComponent = Icon || AlertCircle

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('flex flex-col items-center justify-center py-16', className)}
    >
      <div className="p-4 bg-destructive/10 rounded-full mb-4">
        <IconComponent className="w-10 h-10 text-destructive" />
      </div>
      <p className="font-semibold text-foreground text-lg mb-1">{title}</p>
      {message && <p className="text-sm text-muted-foreground mb-6 max-w-sm text-center">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          {retryLabel}
        </button>
      )}
    </motion.div>
  )
}
