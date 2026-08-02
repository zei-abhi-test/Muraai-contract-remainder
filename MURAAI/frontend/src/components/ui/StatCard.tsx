import { memo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ElementType, ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  icon?: ElementType
  iconColor?: string
  iconBgColor?: string
  trend?: { value: number; direction: 'up' | 'down'; label?: string }
  formatter?: (value: string | number) => string
  onClick?: () => void
  className?: string
  children?: ReactNode
}

export const StatCard = memo(function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-primary',
  iconBgColor = 'bg-primary/10',
  trend,
  formatter,
  onClick,
  className,
  children,
}: StatCardProps) {
  const displayValue = formatter ? formatter(value) : value

  return (
    <motion.button
      whileHover={onClick ? { scale: 1.02 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={cn(
        'bg-card border border-border rounded-xl p-5 text-left w-full',
        onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : '',
        className,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className={cn('p-2.5 rounded-lg', iconBgColor)}>
            <Icon className={cn('w-5 h-5', iconColor)} />
          </div>
        )}
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full',
            trend.direction === 'up' ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950/30' : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30',
          )}>
            {trend.direction === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{trend.value}%</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold mb-0.5 truncate">{displayValue}</div>
      <div className="text-xs text-muted-foreground truncate">{label}</div>
      {trend?.label && (
        <div className="text-[10px] text-muted-foreground mt-1">{trend.label}</div>
      )}
      {children}
    </motion.button>
  )
})
