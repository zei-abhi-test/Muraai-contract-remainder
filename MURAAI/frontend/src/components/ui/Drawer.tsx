import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  position?: 'right' | 'left'
  className?: string
}

const sizeStyles = {
  sm: 'w-96',
  md: 'w-[600px]',
  lg: 'w-[800px]',
}

const positionAnim = {
  right: { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } },
  left: { initial: { x: '-100%' }, animate: { x: 0 }, exit: { x: '-100%' } },
}

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  position = 'right',
  className,
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const titleId = 'drawer-title'
  const anim = positionAnim[position]

  useFocusTrap(drawerRef, isOpen)
  useEscapeKey(isOpen, onClose)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            aria-hidden="true"
          />
          <motion.div
            ref={drawerRef}
            initial={anim.initial}
            animate={anim.animate}
            exit={anim.exit}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              'fixed top-0 h-full bg-card border-l border-border z-50',
              'flex flex-col shadow-2xl',
              position === 'right' ? 'right-0 border-l' : 'left-0 border-r',
              sizeStyles[size],
              className,
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
          >
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-accent rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Close drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
