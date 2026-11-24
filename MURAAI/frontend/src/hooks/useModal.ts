import { useEffect, useRef, useCallback } from 'react'

/**
 * Shared modal accessibility hook.
 *
 * Responsibilities:
 *  - Focus-traps Tab/Shift+Tab so keyboard focus stays inside the modal.
 *  - Closes the modal when Escape is pressed.
 *  - Returns focus to the element that was active when the modal opened.
 *  - Moves initial focus to the first focusable element inside the modal.
 *
 * Usage:
 *   const dialogRef = useRef<HTMLDivElement>(null)
 *   useModal(dialogRef, isOpen, onClose)
 *   <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="modal-title-id">
 */
export function useModal(
  ref: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
) {
  // Remember the element that had focus when the modal opened so we can
  // restore it on close (keyboard & screen-reader UX requirement).
  const triggerRef = useRef<Element | null>(null)

  const getFocusable = useCallback(() => {
    if (!ref.current) return [] as HTMLElement[]
    return Array.from(
      ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), ' +
          'input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )
  }, [ref])

  useEffect(() => {
    if (!isOpen) return

    // Capture the trigger element before we steal focus.
    triggerRef.current = document.activeElement

    // Move focus into the modal.
    const focusable = getFocusable()
    if (focusable.length > 0) {
      focusable[0].focus()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key === 'Tab') {
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
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus to the triggering element when the modal closes.
      if (triggerRef.current && 'focus' in triggerRef.current) {
        ;(triggerRef.current as HTMLElement).focus()
      }
    }
  }, [isOpen, onClose, getFocusable])
}
