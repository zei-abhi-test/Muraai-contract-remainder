import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Info, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { overlayFade, scaleIn } from '@/lib/motion-utils'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { ElementType } from 'react'

interface ConfirmDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  isLoading?: boolean
  icon?: ElementType
  children?: React.ReactNode
}

const variantStyles = {
  danger: {
    iconBg: 'bg-destructive/10',
    iconColor: 'text-destructive',
    Icon: AlertTriangle,
    confirmBg: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  },
  warning: {
    iconBg: 'bg-amber-100 dark:bg-amber-950/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    Icon: AlertTriangle,
    confirmBg: 'bg-amber-600 text-white hover:bg-amber-700',
  },
  info: {
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    Icon: Info,
    confirmBg: 'bg-primary text-primary-foreground hover:bg-primary/90',
  },
}

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  icon: CustomIcon,
  children,
}: ConfirmDialogProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const titleId = 'confirm-dialog-title'
  const descId = 'confirm-dialog-desc'
  const styles = variantStyles[variant]
  const Icon = CustomIcon || styles.Icon

  useFocusTrap(modalRef, isOpen)
  useEscapeKey(isOpen, onCancel)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="confirm-overlay"
          variants={overlayFade}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
        >
          <motion.div
            ref={modalRef}
            key="confirm-dialog"
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
            className="bg-card border border-border rounded-xl w-full max-w-sm p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={message ? descId : undefined}
          >
            <div className="flex items-start gap-4 mb-4">
              <div className={cn('p-2.5 rounded-lg flex-shrink-0', styles.iconBg)}>
                <Icon className={cn('w-5 h-5', styles.iconColor)} />
              </div>
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
                {message && (
                  <p id={descId} className="text-sm text-muted-foreground mt-1">{message}</p>
                )}
                {children && <div className="mt-2">{children}</div>}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="px-4 py-2 text-sm border border-input rounded-lg hover:bg-accent disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className={cn(
                  'px-4 py-2 text-sm rounded-lg disabled:opacity-50 transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  styles.confirmBg,
                )}
              >
                {isLoading ? `${confirmLabel}...` : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
