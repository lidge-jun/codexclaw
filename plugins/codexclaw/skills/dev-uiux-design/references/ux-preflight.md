# UX Preflight Checklist

Run this checklist **before delivery** of any UI feature. Each item is a binary pass/fail.

---

## 1. State Coverage

| State | Check | Pass? |
|-------|-------|-------|
| Empty | First-time user sees helpful guidance, not a blank screen | |
| Loading | Skeleton or spinner matches final layout shape | |
| Error | User knows what failed AND how to recover | |
| Partial | Mixed loaded/pending content is visually coherent | |
| Success | Confirmation is visible without being disruptive | |
| Offline | Graceful degradation or clear "offline" indicator | |

## Onboarding

- [ ] First-run experience guides without blocking
- [ ] Progressive disclosure: advanced features hidden until needed
- [ ] Empty states include a clear primary action ("Create your first...")
- [ ] No dead-end screens (every state has a next action)

## Error States

- [ ] Error messages are specific (not "Something went wrong")
- [ ] Recovery action is available (retry, go back, contact support)
- [ ] Form errors appear inline, not only as toast/alert
- [ ] Network errors distinguish timeout from server error

## Loading States

- [ ] Skeleton loaders match actual content layout
- [ ] No layout shift when content loads
- [ ] Long operations show progress (determinate > indeterminate)
- [ ] Optimistic UI used where safe (toggling, starring, archiving)

## Interaction Feedback

- [ ] Every clickable element has hover + active states
- [ ] Destructive actions require confirmation
- [ ] Undo available for reversible actions
- [ ] Focus states visible for keyboard navigation

## Responsive Verification

- [ ] Test at 390px (mobile), 768px (tablet), 1440px (desktop)
- [ ] No horizontal scroll at any viewport
- [ ] Touch targets ≥ 44px on mobile
- [ ] Navigation is accessible at all breakpoints

## Typography

- [ ] Headings render balanced (no orphaned single word)
- [ ] Body text max-width ≤ 65ch
- [ ] Line height comfortable for body (1.5-1.7) and headings (1.1-1.3)
- [ ] CJK text uses `word-break: keep-all` where appropriate

## Accessibility Minimum

- [ ] All images have meaningful `alt` text (or `alt=""` for decorative)
- [ ] Color contrast passes WCAG AA (4.5:1 text, 3:1 large text)
- [ ] Skip-to-content link present
- [ ] Forms have associated labels
