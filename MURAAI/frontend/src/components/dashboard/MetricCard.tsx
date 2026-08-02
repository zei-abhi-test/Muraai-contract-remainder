import { motion } from 'framer-motion'
import type { ElementType } from 'react'

interface MetricCardProps {
  label: string
  value: number
  icon: ElementType
  color: string
  formatter?: (value: number) => string
  onClick?: () => void
}

export function MetricCard({ label, value, icon: Icon, color, formatter, onClick }: MetricCardProps) {
  return (
    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
      onClick={onClick} type="button"
      className="bg-card border border-border rounded-xl p-4 hover:shadow-lg transition-all text-left w-full cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 ${color} rounded-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="text-xl font-bold mb-0.5 truncate">
        {formatter ? formatter(value) : value.toLocaleString()}
      </div>
      <div className="text-xs text-muted-foreground truncate">{label}</div>
    </motion.button>
  )
}
