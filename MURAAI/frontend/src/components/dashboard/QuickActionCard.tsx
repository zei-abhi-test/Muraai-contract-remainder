import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ElementType } from 'react'

interface QuickActionCardProps {
  label: string
  icon: ElementType
  color: string
  onClick: () => void
}

export function QuickActionCard({ label, icon: Icon, color, onClick }: QuickActionCardProps) {
  const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setRipple({ x, y })
    setTimeout(() => setRipple(null), 600)
    onClick()
  }

  return (
    <motion.button
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      type="button"
      onClick={handleClick}
      className="relative overflow-hidden flex flex-col items-center gap-3 p-5 bg-card border border-border rounded-xl shadow-sm hover:shadow-lg hover:border-primary/20 transition-all cursor-pointer w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <AnimatePresence>
        {ripple && (
          <motion.span
            initial={{ scale: 0, opacity: 0.4 }}
            animate={{ scale: 6, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute pointer-events-none rounded-full bg-white/30"
            style={{
              left: ripple.x - 25,
              top: ripple.y - 25,
              width: 50,
              height: 50,
            }}
          />
        )}
      </AnimatePresence>
      <div className={`p-3.5 ${color} rounded-xl`}>
        <Icon className="w-7 h-7 text-white" />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </motion.button>
  )
}
