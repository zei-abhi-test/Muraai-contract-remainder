import { motion, AnimatePresence } from 'framer-motion'
import { useState, useCallback, useRef } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dropdownIn } from '@/lib/motion-utils'
import { useEscapeKey } from '@/hooks/useEscapeKey'

export interface ActionMenuItem {
  label: string
  onClick: () => void
  destructive?: boolean
}

interface ActionMenuProps {
  items: ActionMenuItem[]
}

export function ActionMenu({ items }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState(-1)
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEscapeKey(open, () => { setOpen(false); setFocusIndex(-1); btnRef.current?.focus() })

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIndex(p => Math.min(p + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIndex(p => Math.max(p - 1, 0)) }
    else if (e.key === 'Enter' || e.key === ' ') {
      if (focusIndex >= 0 && focusIndex < items.length) {
        e.preventDefault()
        items[focusIndex].onClick()
        setOpen(false)
        setFocusIndex(-1)
        btnRef.current?.focus()
      }
    }
  }, [items, focusIndex])

  const close = useCallback(() => {
    setOpen(false)
    setFocusIndex(-1)
    btnRef.current?.focus()
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={btnRef}
        onClick={e => { e.stopPropagation(); setOpen(!open); setFocusIndex(open ? -1 : 0) }}
        className="p-1 rounded-md hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Actions"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={close} aria-hidden="true" />
            <motion.div
              key="action-menu"
              variants={dropdownIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute right-0 top-full mt-1 z-20 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[130px]"
              role="menu"
              aria-orientation="vertical"
              onKeyDown={handleKeyDown}
            >
              {items.map((item, i) => (
                <button
                  key={item.label}
                  ref={i === focusIndex ? (el: HTMLButtonElement | null) => el?.focus() : undefined}
                  onClick={e => { e.stopPropagation(); item.onClick(); close() }}
                  onMouseEnter={() => setFocusIndex(i)}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors focus-visible:outline-none focus-visible:bg-accent',
                    item.destructive && 'text-destructive',
                    focusIndex === i && 'bg-accent',
                  )}
                  role="menuitem"
                >
                  {item.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
