import { type Variants, type Transition } from 'framer-motion'

export const fastTransition: Transition = { duration: 0.2, ease: 'easeOut' }
export const springTransition: Transition = { type: 'spring', damping: 25, stiffness: 200, duration: 0.2 }

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: fastTransition },
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: fastTransition },
}

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: fastTransition },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: fastTransition },
}

export const slideInRight: Variants = {
  hidden: { x: '100%' },
  visible: { x: 0, transition: springTransition },
  exit: { x: '100%', transition: { duration: 0.15, ease: 'easeIn' } },
}

export const slideInLeft: Variants = {
  hidden: { x: -280 },
  visible: { x: 0, transition: { duration: 0.25, ease: 'easeInOut' } },
}

export const overlayFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
}

export const dropdownIn: Variants = {
  hidden: { opacity: 0, y: -4, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: fastTransition },
  exit: { opacity: 0, y: -2, scale: 0.98, transition: { duration: 0.1 } },
}

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03, delayChildren: 0.05 },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
}

export function withReducedMotion(variants: Variants, prefersReduced: boolean): Variants {
  if (!prefersReduced) return variants
  const reduced: Variants = {}
  for (const key of Object.keys(variants) as (keyof Variants)[]) {
    const v = variants[key]
    if (typeof v === 'object' && v !== null && 'transition' in v) {
      reduced[key] = { ...(typeof v === 'object' ? v : {}), transition: { ...(v as any).transition, duration: 0 } }
    } else {
      reduced[key] = v
    }
  }
  return reduced
}

export const buttonHover = { scale: 1.02 }
export const buttonTap = { scale: 0.98 }
export const iconButtonHover = { scale: 1.1 }
export const iconButtonTap = { scale: 0.9 }
