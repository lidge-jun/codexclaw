# WP4 — UX States + Typography + Anti-Slop Audit

## Diff-Level Plan

### globals.css
- Add `@keyframes shimmer` + `.skeleton` class for loading skeletons
- Add `focus-visible:ring-2 ring-accent` global utility
- Add `.skip-link` class (visually hidden, visible on focus)
- Add `@media (prefers-reduced-motion: reduce)` to disable animations
- Add `text-wrap: balance` to `.page-title`
- Add `text-wrap: balance` to blockquote, h1, h2 headings

### layout.tsx
- Add skip-link `<a href="#main-content">본문으로 건너뛰기</a>`
- Add `id="main-content"` to main element

### BottomNav.tsx (DashboardClient)
- Replace "로딩 중..." with 3 skeleton cards (pulse animation)
- Add icon to empty workout state ("아직 오늘의 운동 기록이 없습니다")

### workout/page.tsx
- Replace "로딩 중..." with skeleton rows (3 shimmer bars)
- Upgrade empty state: add DumbbellIcon + "첫 운동을 기록해 보세요" CTA

### weight/page.tsx
- Replace loading text with skeleton stat + skeleton bars
- Upgrade empty state with ScaleIcon + actionable message

### habits/page.tsx
- Replace loading with skeleton form cards
- Upgrade empty state with CheckIcon + message

### photos/page.tsx
- Replace loading with skeleton grid (2x2 aspect-ratio boxes)
- Already has good empty state with CameraIcon

### community/page.tsx
- Replace loading with skeleton feed cards
- Already has good empty state with UsersIcon

### page.tsx (landing)
- Add 3 value prop items below CTA (운동 기록, 습관 추적, 함께 성장) with SVG icons
- Not cards — use simple icon+text rows for visual variety

## Scope
- IN: globals.css, layout.tsx, all page components
- OUT: API routes, db/schema, worker/index
