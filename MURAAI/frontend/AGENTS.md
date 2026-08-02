# Agent Instructions

## Code Review Protocol
After making changes, run these commands in order:
1. `npx tsc --noEmit` — verify zero TypeScript errors
2. `npx eslint . --max-warnings 0` (if eslint configured) — verify zero lint warnings

## UX Design Standards (Linear/Stripe/Notion/GitHub tier)
- Page titles: `text-xl font-semibold tracking-tight`, never `text-3xl`
- Status badges default to `variant="soft"`, never `filled`
- Card: `rounded-lg` (not `rounded-xl`), moderate padding, subtle shadows
- Dashboard: compact (2-3 grid columns max), no greeting decoration, no stagger/motion on mount
- Motion animations only for **user-initiated** interactions (modals, toasts, transitions), never for page-load content
- `PageLayout` wrapper for consistent loading/empty/error states on all pages
- `<StatusBadge status={...} dot />` is the single source of truth; no inline status-color strings
- Max content width: `--max-content-width: 1280px`

## Required Review Passes
1. **Functionality pass** — does it work? Are there edge cases? Loading/empty/error states?
2. **Design at Linear pass** — is the spacing tight? Colors subtle? Typography restrained? No "demo app" feel?
3. **TypeScript/Lint pass** — zero errors, zero warnings, no `any`, no unused imports
