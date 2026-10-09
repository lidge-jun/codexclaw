## 6. Performance Guardrails
Animate only `transform` and `opacity`; isolate perpetual animation, remove temporary `will-change`, reserve z-index for systemic layers.
Keep grain/noise filters off scrolling containers. Centralize polling/subscriptions; clean up SSE/WebSocket on unmount.
Never open unbounded per-component connections; prefer one multiplexed connection.
For detailed budgets and browser connection limits, read `performance-budget.md`.
---

## 7. Accessibility Baseline

- Semantic HTML (`<button>`, `<nav>`, `<main>`)
- Keyboard navigation for all interactive elements
- WCAG AA minimum (4.5:1 normal text, 3:1 large text)
- Visible focus indicators (`focus-visible:ring-2`)
- `prefers-reduced-motion` support
- Skip link or equivalent bypass for repeated navigation
- Focus must not be hidden by sticky headers, sticky bottom bars, sheets, or overlays
- Icon-only buttons need accessible names (`aria-label`, visible text, or labelled-by)
- Charts, status messages, loading progress, and AI streaming states need screen-reader labels or live regions where appropriate
- Do not encode meaning by color alone
- Modals, menus, comboboxes, bottom sheets, and command palettes must have a complete keyboard path
- Stress-test Korean long labels and screen-reader names; clipped Hangul is a failure
- Pointer targets follow WCAG 2.2 AA target-size rules; 44×44px is a conservative product baseline, not the only legal minimum

### A11y polish (FE-A11Y-POLISH-01)

- CTA text fits on one line at target breakpoints; if it wraps, shorten the label or change the layout.
- Inputs need visible boundaries against their background in default, focus, error, and disabled states.
- Duplicate CTA intent on the same screen should merge or clearly differ by outcome.
- Button contrast is checked during visual review, not left to palette intent.

---

## 8. React, Forms, and Accessibility
For React hooks, state ownership, performance, and Compiler, read `../stacks/react.md`.
Custom hooks: only for reusable behavior with explicit inputs, small outputs, honest dependencies, justified effects, correct cleanup. Do not hide server/router/form ownership inside generic hooks.
For forms: follow repo stack and schema-validation conventions; expose field errors accessibly with `role="alert"`.
For widget keyboard paths, focus trapping, ARIA state, and screen-reader testing, enforce `a11y-patterns.md`.
The objective accessibility baseline in §7 remains mandatory.
---

## 12. Frontend Platform Rules
Prefer project conventions; detect installed framework/version before changing configuration.
Read `../stacks/react.md` for React 19.2+ features, Compiler, Suspense, Effects, state.
Read `../stacks/nextjs.md` for Next.js 16 App Router, caching, Server Actions, RSC.
Prefer native CSS (container queries, `:has()`, nesting, subgrid, View Transitions, `dvh/svh/lvh`) before JS observers.
Do not introduce Webpack-era config unless the existing app is Webpack-bound.
Never cache user/session data without an explicit user-scoped key.
Classify state using the table below before adding a store, Effect, or cache.
### State Classification
Before adding state, classify it:
| State type | Owner | Default tool |
|---|---|---|
| render-local UI | nearest component | `useState` / `useReducer` |
| derived | render calculation | expression / `useMemo` if expensive |
| form draft | form boundary | native form, React Hook Form, TanStack Form |
| server/cache | server/cache layer | RSC, Next cache, TanStack Query, SWR |
| URL/navigation | router | path params, search params |
| global client UI | external store | Zustand, Jotai, context |
| optimistic mutation | mutation boundary | `useOptimistic`, mutation library |
| AI stream | conversation boundary | append-only message model + stream status |

Rules: Do not store derived state just to sync with Effect. Do not put server state in Zustand. Do not put URL-shareable state only in component state. Keep optimistic state reversible.

Before creating tokens, run Design System Detection (MANDATORY): check `package.json` for installed systems, existing tokens/themes, and the brief.
**Aesthetic honesty (FE-AESTHETIC-HONESTY-01):** aesthetic directions are not official design systems.
For shadcn/ui, inspect local components and follow `components.json`, aliases, tokens, and registry.
AI-native interfaces must represent real states; never fake streaming, citations, or tool calls.
---

## 13. Error Boundaries

React Error Boundary pattern:
- Wrap each major section (not the entire app) in an Error Boundary
- Error boundary renders: friendly message + retry button + report link
- Log error to monitoring service (Sentry, etc.) in componentDidCatch
- Never show stack traces to end users

Error state hierarchy:
1. Field-level: inline validation message
2. Form-level: summary at top of form
3. Section-level: Error Boundary with retry
4. Page-level: `error.tsx` / error page
5. App-level: root Error Boundary → offline/crash page

---
