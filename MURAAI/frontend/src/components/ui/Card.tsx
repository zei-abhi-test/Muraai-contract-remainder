import { memo } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'elevated' | 'outlined' | 'interactive'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  as?: 'div' | 'button'
  onClick?: () => void
}

const variantStyles = {
  default: 'bg-card border border-border',
  elevated: 'bg-card border border-border shadow-sm',
  outlined: 'border border-border bg-transparent',
  interactive: 'bg-card border border-border hover:border-primary/30 hover:bg-accent/50 cursor-pointer transition-all',
}

const paddingStyles = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
}

export const Card = memo(function Card({
  children,
  className,
  variant = 'default',
  padding = 'md',
  as = 'div',
  onClick,
}: CardProps) {
  const Component = as === 'button' ? 'button' : 'div'
  const typeProp = as === 'button' ? { type: 'button' as const } : {}

  return (
    <Component
      onClick={onClick}
      {...typeProp}
      className={cn(
        'rounded-lg',
        variantStyles[variant],
        paddingStyles[padding],
        onClick && 'cursor-pointer text-left w-full',
        className,
      )}
    >
      {children}
    </Component>
  )
})

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex items-center justify-between mb-4', className)}>{children}</div>
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex items-center justify-between mt-4 pt-4 border-t border-border', className)}>{children}</div>
}
