import { memo, useState } from 'react'
import { cn } from '@/lib/utils'

interface AvatarProps {
  src?: string
  alt?: string
  fallback?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  status?: 'online' | 'away' | 'busy' | 'offline'
  className?: string
}

const sizeStyles = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
  xl: 'w-14 h-14 text-lg',
}

const statusColors = {
  online: 'bg-green-500',
  away: 'bg-amber-500',
  busy: 'bg-red-500',
  offline: 'bg-gray-400',
}

const statusSizes = {
  sm: 'w-2 h-2 border',
  md: 'w-2.5 h-2.5 border-2',
  lg: 'w-3 h-3 border-2',
  xl: 'w-3.5 h-3.5 border-2',
}

export const Avatar = memo(function Avatar({
  src,
  alt = '',
  fallback,
  size = 'md',
  status,
  className,
}: AvatarProps) {
  const [imgError, setImgError] = useState(false)
  const initials = fallback || alt?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <span className={cn('relative inline-flex flex-shrink-0', className)}>
      {src && !imgError ? (
        <img
          src={src}
          alt={alt}
          onError={() => setImgError(true)}
          className={cn('rounded-full object-cover', sizeStyles[size])}
        />
      ) : (
        <span
          className={cn(
            'rounded-full bg-primary/10 text-primary font-medium flex items-center justify-center',
            sizeStyles[size],
          )}
          aria-hidden="true"
        >
          {initials}
        </span>
      )}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-background',
            statusColors[status],
            statusSizes[size],
          )}
          aria-label={status}
        />
      )}
    </span>
  )
})
