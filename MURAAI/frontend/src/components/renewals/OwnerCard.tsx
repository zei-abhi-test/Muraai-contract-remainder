import { Mail, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OwnerCardProps {
  name: string
  email: string
  role: string
  label?: string
  className?: string
}

export function OwnerCard({ name, email, role, label = 'Owner', className }: OwnerCardProps) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{email}</span>
          </div>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Briefcase className="w-2.5 h-2.5" />{role}</span>
        </div>
      </div>
    </div>
  )
}
