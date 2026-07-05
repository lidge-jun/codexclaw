# messenger_bridge — GUI foundation overhaul

Status: PENDING (scaffolded 2026-07-03; P for this phase fills diff-level detail)
Parent: 00_plan.md slice map

## Scope / exit criteria

production shell per dev-uiux-design + dev-frontend (routing, design tokens, nav, loading/empty/error states); Subagents page migrated without regression

## D record (2026-07-03) — SHIPPED

- Built the production shell (dev-uiux-design + dev-frontend): a token-first
  `styles.css` design system (semantic color/space/type/radius/motion tokens,
  auto light+dark via prefers-color-scheme, visible focus rings, responsive
  sidebar→topbar under 720px), a zero-dep hash `router.ts` (no react-router),
  a reusable UI kit (`ui/kit.tsx`: Card/Button/Field/StatusDot/Badge +
  Loading/Empty/Error states) and a module-level `ui/toast.tsx` host.
- New `App.tsx`: sidebar nav (Channels/Agents/Subagents) + routed content +
  provider footer + toast host. Migrated `pages/Subagents.tsx` onto the kit with
  no behavior regression (same load/save API, now with loading state + toasts).
  `ModelSelect`/`PromptOverrideEditor` moved to shared `.select`/`.textarea`.
- Verification: `vite build` OK (40 modules, 156kB→50kB gz); GUI suite 8/8
  (handlers 6 + new router 2); no type errors in the new code (pre-existing
  @types/react-absent + import.meta.env tsc noise is environmental, unchanged);
  live `cxc serve` hosts the built assets (index 200, correct asset hashes,
  /api/channels 200); server-render smoke (esbuild CJS bundle + renderToString)
  renders the shell without runtime crash (brand + nav + Channels copy present).
- KEY LEARNING: to runtime-verify a React tree headless with no browser, bundle
  App+react+react-dom/server with esbuild as CJS (ESM trips on react-dom/server's
  dynamic require("stream")) and renderToString it — catches hook/import crashes
  the type+build checks can't.

## Design pass (2026-07-03, per dev-frontend + dev-uiux-design skills)

User feedback: "디자인을 dev-frontend랑 uiux 보고 해라." Read both skills; the
glaring violation was **emoji used as UI icons** (dev-frontend §5 STRICT ban —
"#1 AI slop signal").

Design Read: developer management console (Codex plugin GUI) · repeated-work
tool · density D4-D5 · Linear/Vercel/GitHub reference (quiet, dense, trustworthy).
Dials: DESIGN_VARIANCE 3, MOTION 2.

Changes:
- NEW `ui/icons.tsx`: zero-dep inline SVG set — Lucide-style stroke icons
  (link/cpu/sliders/inbox/alert/check-circle/x/arrow-right/shield) +
  simplified Telegram/Discord brand marks (filled). ALL emoji removed from
  App/kit/toast/Channels/Agents (verified: SSR render has zero emoji, 4 SVGs).
- Tokens tightened for dev-console density: radius 14/10/6 → 9/7/5px (less
  pill-round), card/page padding reduced, type scale down (page h1 xl not 2xl),
  sidebar denser. Removed the blue→green logo gradient → single-accent mark.
- A11y: nav is now semantic `<button>` with `aria-current="page"`; toast host
  `role=status aria-live=polite`; icons `aria-hidden` unless labeled;
  `prefers-reduced-motion` disables animation; text-wrap:balance on headings +
  short descriptors (dev-frontend typography rule).
- Brand-tinted channel marks (Telegram #2aabee, Discord #5865f2) as rounded
  squares, not emoji.
- Verification: vite build OK (8kB css / 51.9kB gz js); SSR render clean
  (svg_count=4, nav_buttons=3, has_emoji=false, aria_current present); GUI
  suite still green. NOTE: no headless browser in this env, so screenshot
  verification (dev-frontend STRICT ideal) is a recommended manual follow-up —
  SSR structural render is the strongest check available here.
