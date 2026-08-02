# Design System

## Philosophy

The Muraai design system is built for **information density** and **decision speed**. Enterprise users spend 8+ hours in the platform. Every pixel must earn its place. The design system optimizes for:

- **Scanability** — Users should find what they need in under 3 seconds
- **Clarity** — Every element answers: what is this, what state is it in, what can I do about it
- **Consistency** — The same pattern behaves the same way everywhere
- **Accessibility** — WCAG 2.1 AA minimum

## Design Tokens

### Color Palette

```
--color-primary:        #2563EB  (blue-600)
--color-primary-hover:  #1D4ED8  (blue-700)
--color-primary-soft:   #DBEAFE  (blue-100)

--color-success:        #16A34A  (green-600)
--color-success-soft:   #DCFCE7  (green-100)

--color-warning:        #D97706  (amber-600)
--color-warning-soft:   #FEF3C7  (amber-100)

--color-danger:         #DC2626  (red-600)
--color-danger-soft:    #FEE2E2  (red-100)

--color-info:           #0891B2  (cyan-600)
--color-info-soft:      #CFFAFE  (cyan-100)

--color-neutral-50:    #F9FAFB
--color-neutral-100:   #F3F4F6
--color-neutral-200:   #E5E7EB
--color-neutral-300:   #D1D5DB
--color-neutral-400:   #9CA3AF
--color-neutral-500:   #6B7280
--color-neutral-600:   #4B5563
--color-neutral-700:   #374151
--color-neutral-800:   #1F2937
--color-neutral-900:   #111827

--color-surface:       #FFFFFF
--color-surface-alt:   #F9FAFB
--color-border:        #E5E7EB
--color-text:          #111827
--color-text-secondary:#6B7280
--color-text-disabled: #9CA3AF
```

### Typography

```
--font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif
--font-mono:   'JetBrains Mono', 'Fira Code', monospace

--font-size-xs:     0.75rem   (12px)
--font-size-sm:     0.875rem  (14px)
--font-size-base:   1rem      (16px)
--font-size-lg:     1.125rem  (18px)
--font-size-xl:     1.25rem   (20px)
--font-size-2xl:    1.5rem    (24px)
--font-size-3xl:    1.875rem  (30px)

--font-weight-normal:   400
--font-weight-medium:   500
--font-weight-semibold: 600
--font-weight-bold:     700

--line-height-tight:   1.25
--line-height-normal:  1.5
--line-height-relaxed: 1.625
```

### Spacing

```
--space-1:  0.25rem  (4px)
--space-2:  0.5rem   (8px)
--space-3:  0.75rem  (12px)
--space-4:  1rem     (16px)
--space-5:  1.25rem  (20px)
--space-6:  1.5rem   (24px)
--space-8:  2rem     (32px)
--space-10: 2.5rem   (40px)
--space-12: 3rem     (48px)
--space-16: 4rem     (64px)
```

### Border Radius

```
--radius-sm:    0.25rem  (4px)
--radius-md:    0.375rem (6px)
--radius-lg:    0.5rem   (8px)
--radius-xl:    0.75rem  (12px)
--radius-full:  9999px
```

### Shadows

```
--shadow-sm:    0 1px 2px rgba(0,0,0,0.05)
--shadow-md:    0 4px 6px rgba(0,0,0,0.07)
--shadow-lg:    0 10px 15px rgba(0,0,0,0.1)
--shadow-xl:    0 20px 25px rgba(0,0,0,0.15)
```

## Component Patterns

### Status Badge

Used for entity status, approval status, SLA status.

```
Variant: success / warning / danger / info / neutral / primary
Size:    sm / md / lg
Shape:   rounded-pill

Always includes:
- Background color (soft variant)
- Text label
- Optional: leading icon

Examples:
[● Active]     success
[● Pending]    warning
[● Overdue]    danger
[● Complete]   success
[● Draft]      neutral
```

### Data Table

The primary interaction pattern for list views.

```
Features:
- Column sorting (click header to toggle asc/desc)
- Column filtering (type-ahead dropdown per column)
- Row selection (checkbox for bulk actions)
- Pagination (cursor-based, with page size selector)
- Empty state (contextual illustration + action button)
- Loading state (skeleton rows, not spinners)
- Inline actions (icon buttons on hover or always visible)

Responsive:
- On narrow screens, collapse to card list
- Priority columns (first 3-4 always visible)

Row States:
- Default: white background
- Hover: subtle gray
- Selected: primary-soft background
- Error: danger-soft background (left border accent)
- Row link: entire row clickable (no separate link button)
```

### Detail Panel

Slide-over panel for viewing related entities without navigation.

```
Trigger: Click a row in a table or a link
Position: Right side, overlays content
Width:    480px default, 640px for complex views
Header:  Entity name, status badge, close button
Content: Structured fields (label: value)
Actions: State-dependent buttons in footer
Mobile:  Full-screen overlay on narrow viewports
```

### State Timeline

Visual representation of an entity's lifecycle.

```
Horizontal timeline showing:
- Completed states (green checkmark)
- Current state (blue dot, pulsing)
- Future states (gray, disabled)
- Failed/skipped states (red X)

Each state node is clickable to show:
- Who performed the transition
- When it happened
- Any comments or attachments
- Previous and new values (for financial fields)
```

### Action Bar

Persistent bar showing available actions for the current entity state.

```
Position: Below header, above content
Content: Primary action (button), secondary actions (links), overflow menu for 3+ actions
State-dependent: Actions change based on entity state machine

Example (Renewal in "pending_approval" state):
[Approve] [Reject] [Request Changes] ⋮ [Hold] [Cancel]
```

### Notification Center

Bell icon in global header, dropdown panel.

```
Unread badge: Count of unread notifications
Dropdown: Last 20 notifications, scrollable
Grouping: By entity (renewal) or by type (approval, SLA, invoice)
Actions: Mark as read, navigate to entity
Empty state: "No new notifications"

Notification types:
- Approval required (warning icon)
- SLA breached (danger icon)
- Invoice received (info icon)
- Assignment (info icon)
- Exception (danger icon)
```

### Form Patterns

```
Labels:  Always visible (not placeholders)
Layout:  Single column, full width within content area
Groups:  Logical grouping with section headers
Validation: Inline, on blur, with error message below field
Required: Marked with asterisk, but minimize required fields
Defaults: Pre-populated wherever possible
Autosave: Draft state saves automatically after field blur
```

### Empty States

Every list view has a meaningful empty state.

```
Components:
- Illustration (simple, contextual)
- Title: "No renewals yet" (not "No data")
- Description: "Renewals will appear here when contracts approach their end date."
- Action button: "Import Contracts" or "Add Contract"
- Link to documentation (if applicable)
```

## Layout

### Global Shell

```
┌─────────────────────────────────────────────────────┐
│ Header (logo, search, notification bell, user menu)  │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ Sidebar  │  Main Content Area                        │
│          │                                          │
│ - Nav    │  (breadcrumb)                             │
│ - Links  │  (page title + action bar)                │
│ - Favor. │  (content)                                │
│          │                                          │
│          │                                          │
│          │  Optional: Detail Panel (slide-over)       │
│          │                                          │
├──────────┴──────────────────────────────────────────┤
│ Footer (status, connection health, version)          │
└─────────────────────────────────────────────────────┘

Sidebar width:    240px (collapsible to icon-only: 64px)
Header height:    56px
Content max-width: 1280px (centered)
Detail panel:     480px (640px for complex views)
```

### Responsive Behavior

- ≤768px: Sidebar collapses to bottom navigation bar
- ≤480px: Detail panel becomes full-screen overlay
- Tables: Scroll horizontally, first column pinned

## Motion

- Transitions: 150ms ease-in-out (micro-interactions)
- Panels: 200ms ease-out (slide in/out)
- Modals: 200ms scale + fade
- Page transitions: 150ms fade
- Never animate for the sake of animation — every motion must communicate a state change
- Reduced motion: Respect `prefers-reduced-motion`
