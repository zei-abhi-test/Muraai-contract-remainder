import { useEffect, useCallback } from 'react'

export function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  isActive: boolean,
) {
  const getFocusable = useCallback(() => {
    if (!ref.current) return []
    const elements = ref.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    return Array.from(elements)
  }, [ref])

  useEffect(() => {
    if (!isActive) return
    const el = ref.current
    if (!el) return

    const focusable = getFocusable()
    if (focusable.length > 0) {
      focusable[0].focus()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = getFocusable()
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [isActive, ref, getFocusable])
}
