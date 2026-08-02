import { memo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Info, AlertTriangle, CheckCircle, XCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode, ElementType } from 'react'

interface InfoPanelProps {
  variant?: 'info' | 'warning' | 'success' | 'error'
  title?: string
  message: string
  icon?: ElementType
  dismissible?: boolean
  onDismiss?: () => void
  action?: ReactNode
  className?: string
}

const variantStyles = {
  info: {
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-300',
    icon: 'text-blue-500 dark:text-blue-400',
    Icon: Info,
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800',
    text: 'text-amber-800 dark:text-amber-300',
    icon: 'text-amber-500 dark:text-amber-400',
    Icon: AlertTriangle,
  },
  success: {
    bg: 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800',
    text: 'text-green-800 dark:text-green-300',
    icon: 'text-green-500 dark:text-green-400',
    Icon: CheckCircle,
  },
  error: {
    bg: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800',
    text: 'text-red-800 dark:text-red-300',
    icon: 'text-red-500 dark:text-red-400',
    Icon: XCircle,
  },
}

export const InfoPanel = memo(function InfoPanel({
  variant = 'info',
  title,
  message,
  icon: CustomIcon,
  dismissible = false,
  onDismiss,
  action,
  className,
}: InfoPanelProps) {
  const [dismissed, setDismissed] = useState(false)
  const styles = variantStyles[variant]
  const Icon = CustomIcon || styles.Icon

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className={cn('flex items-start gap-3 border rounded-lg p-4', styles.bg, className)}
        >
          <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', styles.icon)} />
          <div className="flex-1 min-w-0">
            {title && <p className={cn('text-sm font-semibold', styles.text)}>{title}</p>}
            <p className={cn('text-sm', styles.text, title ? 'mt-0.5' : '')}>{message}</p>
            {action && <div className="mt-2">{action}</div>}
          </div>
          {dismissible && (
            <button
              onClick={handleDismiss}
              className={cn('p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0', styles.text)}
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
})
