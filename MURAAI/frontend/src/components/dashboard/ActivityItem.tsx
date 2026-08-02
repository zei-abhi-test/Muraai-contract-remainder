import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import type { ElementType, ReactNode } from 'react'

interface ActivityItemProps {
  onClick?: () => void
  title: string
  subtitle?: string
  leftDot?: string
  leftIcon?: ElementType
  leftIconClass?: string
  rightChevron?: boolean
  rightText?: string
  rightTextClass?: string
  rightIcon?: ElementType
  rightIconClass?: string
  children?: ReactNode
}

export function ActivityItem({
  onClick, title, subtitle,
  leftDot, leftIcon: LeftIcon, leftIconClass,
  rightChevron, rightText, rightTextClass,
  rightIcon: RightIcon, rightIconClass,
  children,
}: ActivityItemProps) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {leftDot && <div className={cn("w-2 h-2 rounded-full shrink-0", leftDot)} />}
        {LeftIcon && (
          <div className={cn("p-1.5 rounded-lg shrink-0", leftIconClass)}>
            <LeftIcon className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {children}
        {rightText && <span className={cn("text-sm font-semibold", rightTextClass)}>{rightText}</span>}
        {RightIcon && <RightIcon className={cn("w-4 h-4 shrink-0", rightIconClass)} />}
        {rightChevron && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </div>
    </div>
  )
}
