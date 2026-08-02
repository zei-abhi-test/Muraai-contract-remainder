import { memo } from 'react'
import { motion } from 'framer-motion'
import { X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterOption {
  value: string
  label: string
}

interface Filter {
  id: string
  label: string
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
}

interface FiltersProps {
  filters: Filter[]
  onClearAll?: () => void
  className?: string
}

export const Filters = memo(function Filters({ filters, onClearAll, className }: FiltersProps) {
  const hasActiveFilters = filters.some(f => f.value)

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {filters.map((filter) => {
        const selectedOption = filter.options.find(o => o.value === filter.value)

        return (
          <div key={filter.id} className="relative">
            <select
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              aria-label={filter.label}
              className={cn(
                'appearance-none pl-3 pr-7 py-1.5 text-sm rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
                filter.value
                  ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                  : 'bg-background border-input text-muted-foreground hover:bg-accent',
              )}
            >
              <option value="">{filter.label}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-muted-foreground" />
          </div>
        )
      })}

      {hasActiveFilters && onClearAll && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={onClearAll}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
        >
          <X className="w-3 h-3" />
          Clear
        </motion.button>
      )}
    </div>
  )
})
