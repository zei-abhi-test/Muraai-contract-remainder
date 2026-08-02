import { useUIStore } from '@/store/uiStore'
import logoFull from '@/assets/logo/logo.svg'
import logoIcon from '@/assets/logo/logo-icon.svg'

interface AppLogoProps {
  collapsed?: boolean
}

export function AppLogo({ collapsed = false }: AppLogoProps) {
  const { setActivePage } = useUIStore()

  const handleClick = () => {
    setActivePage('dashboard')
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center justify-center w-full"
        aria-label="Go to Dashboard"
      >
        <img
          src={logoIcon}
          alt="Muraai"
          className="h-9 w-auto flex-shrink-0"
        />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex flex-col items-start w-full"
      aria-label="Go to Dashboard"
    >
      <img
        src={logoFull}
        alt="Muraai"
        className="h-[42px] w-auto"
      />
      <span className="text-xs text-muted-foreground mt-1">
        Contract Management Suite
      </span>
    </button>
  )
}
