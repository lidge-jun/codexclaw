# WP5 — Visual Polish + Motion + Accessibility

## Diff-Level Plan

### globals.css
- Add bottom nav active indicator (dot below active tab)
- Add form input error state (.input-error)
- Add card hover micro-interaction (subtle lift)
- Refine button active/pressed states
- Add .section-divider utility

### BottomNav.tsx
- Add active tab dot indicator below icon
- Refine DashboardClient: add stagger animation classes to sections

### All pages
- Verify all icon-only buttons have aria-label
- Verify form inputs have associated labels
- Add aria-live="polite" to dynamic content areas
- Ensure proper heading hierarchy (h1 > h2 > h3)

## Scope
- IN: globals.css, BottomNav.tsx, all page components
- OUT: API routes, db/schema, worker/index
