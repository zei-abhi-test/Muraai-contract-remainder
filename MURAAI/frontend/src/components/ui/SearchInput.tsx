import { useRef, forwardRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  variant?: 'default' | 'ghost'
  size?: 'sm' | 'md'
  onClear?: () => void
  autoFocus?: boolean
  shortcut?: string
  className?: string
}

const variantStyles = {
  default: 'bg-background border border-input focus-within:ring-2 focus-within:ring-ring',
  ghost: 'bg-secondary/50 border border-transparent focus-within:bg-background focus-within:border-input hover:bg-secondary/80',
}

const sizeStyles = {
  sm: 'h-8 text-xs',
  md: 'h-9 text-sm',
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  variant = 'default',
  size = 'md',
  onClear,
  autoFocus = false,
  shortcut,
  className,
}, ref) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClear = () => {
    onChange('')
    onClear?.()
    inputRef.current?.focus()
  }

  return (
    <div
      className={cn(
        'relative flex items-center rounded-lg transition-colors',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      role="search"
    >
      <Search className="absolute left-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        ref={ref || inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        aria-label={placeholder}
        className="w-full bg-transparent pl-8 pr-8 outline-none text-foreground placeholder:text-muted-foreground"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-2.5 p-0.5 hover:bg-accent rounded transition-colors"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}
      {!value && shortcut && (
        <kbd className="absolute right-2.5 px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded text-muted-foreground">
          {shortcut}
        </kbd>
      )}
    </div>
  )
})
