import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { overlayFade, scaleIn } from '@/lib/motion-utils'
import { useRef } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface ConfirmDeleteModalProps {
  isOpen: boolean
  title: string
  description?: string
  isDeleting?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDeleteModal({
  isOpen,
  title,
  description = 'This action cannot be undone.',
  isDeleting = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const titleId = 'confirm-delete-title'
  const descId = 'confirm-delete-desc'

  useFocusTrap(modalRef, isOpen)
  useEscapeKey(isOpen, onCancel)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="confirm-delete-overlay"
          variants={overlayFade}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
        >
          <motion.div
            ref={modalRef}
            key="confirm-delete-modal"
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
            className="bg-card border border-border rounded-xl w-full max-w-sm p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
                <p id={descId} className="text-sm text-muted-foreground mt-1">{description}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={isDeleting}
                className="px-4 py-2 border border-input rounded-lg hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isDeleting}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
