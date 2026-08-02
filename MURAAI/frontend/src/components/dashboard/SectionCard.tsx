import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { fadeInUp } from '@/lib/motion-utils'
import type { ReactNode } from 'react'

interface SectionCardProps {
  title: string
  children: ReactNode
  className?: string
  action?: ReactNode
}

export function SectionCard({ title, children, className, action }: SectionCardProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className={cn("bg-card border border-border rounded-xl", className)}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-sm">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </motion.div>
  )
}
