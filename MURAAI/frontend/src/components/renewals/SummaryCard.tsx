import { cn } from '@/lib/utils'

interface SummaryRow {
  label: string
  value: string
  href?: string
  onClick?: () => void
  color?: 'default' | 'muted'
}

interface SummaryCardProps {
  items: SummaryRow[]
  className?: string
}

export function SummaryCard({ items, className }: SummaryCardProps) {
  return (
    <dl className={cn('divide-y divide-border/50', className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className={cn(
            'text-xs font-medium text-right',
            item.color === 'muted' ? 'text-muted-foreground' : 'text-foreground',
            (item.href || item.onClick) && 'text-primary hover:underline cursor-pointer',
          )}>
            {item.href ? (
              <span onClick={() => window.open(item.href, '_blank')}>{item.value}</span>
            ) : item.onClick ? (
              <span onClick={item.onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && item.onClick?.()}>{item.value}</span>
            ) : item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
