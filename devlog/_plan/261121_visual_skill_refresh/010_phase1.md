# 010 — wp1: color restraint (no side accents, neutral buttons, glyph controls)

Branch `docs/visual-skill-refresh` from `origin/dev` 2915878c. Directive: [004](004_color_restraint_directive.md).
Anchors: [005 §A](005_current_gaps.md). Paths below are under `plugins/codexclaw/skills/`.

## Scope

IN: the files in the change map. OUT: copy rules (wp2), scripts (wp3), new platform features
(wp4), visualizer figure loop (wp5), any rule outside color/emphasis/buttons.

## File change map

| Op | Path | Change |
|---|---|---|
| MODIFY | dev-frontend/references/core/anti-slop.md | NEW section A after FE-GRADIENT-02 block; drop the bar from the channel list (:85) and from the premium-practice note (:96-97); retarget the accent note (:112) |
| MODIFY | dev-frontend/references/core/color-system.md | Remove channel 3 and renumber (:62-68); NEW section B before "Modern Color Functions"; comment on `.button-primary` (:40) |
| MODIFY | dev-frontend/references/core/implementation.md | :6 append where hue may go |
| MODIFY | dev-frontend/references/core/top-bar.md | :56-57 ink-filled CTA |
| MODIFY | dev-frontend/references/core/mobile-ux.md | :47 `bg-foreground text-background` |
| MODIFY | dev-frontend/references/stacks/react.md | :167 `bg-foreground text-background` |
| MODIFY | dev-uiux-design/references/responsive-nav.md | :36 neutral active state |
| MODIFY | dev-uiux-design/references/visual-hierarchy.md | :44, :48 accent spent on focus/data/links, not buttons |
| MODIFY | dev-visualizer/assets/editorial-report.html | :36 ink primary button; :39 `.scenario` full hairline border, no side bar |
| MODIFY | dev-visualizer/assets/paged-report.html | :105 `.note` indentation only |
| MODIFY | dev-visualizer/reference/visual-design.md | :59 "no box and no side rule" |

## A. NEW section in anti-slop.md

~~~~markdown
## One-Sided Accent Ban (FE-SIDE-ACCENT-01, DEFAULT, user contract 2026-11-21)

No colored or heavier edge on one side of a box to mark emphasis, selection or category:
cards, callouts, notes, alerts, quotes, pills, chips, nav items, list rows, stat tiles, table
rows. Every implementation counts: a `border-left` / `border-inline-start` (or any single
side) wider or more saturated than the others, a one-sided `inset` box-shadow, an absolutely
positioned `::before` / `::after` bar, a gradient stripe inside `background`. It reads as a
chatbot answer or a template card, and on a pill it fights the radius.

Use one channel instead: a full 1px neutral border, one neutral surface step, a leading glyph
or run-in label, or weight. Selected states follow FE-COLOR-RESTRAINT-01 in
[color-system.md](color-system.md).

Narrow exception: a per-row marker that encodes data (a diff gutter, a calendar category) is
data, not emphasis, and also carries a non-color cue. The only other documented reason to
deviate is a brief that explicitly asks for a side bar.
~~~~

## B. NEW section in color-system.md

~~~~markdown
## Neutral Controls and Color Budget (FE-COLOR-RESTRAINT-01, DEFAULT, user contract 2026-11-21)

What is clicked stays neutral; what is measured or signalled may carry hue. Reference: a
native macOS utility toolbar (Activity Monitor). Its actions are monochrome glyphs in neutral
circles, its view switcher is a neutral segmented control whose selected segment is one gray
step darker, and color appears only in the CPU chart and the figures that match it.

Color budget per rendered screen:

- Neutrals: ink, one muted text step, two or three surface/border steps.
- At most one accent hue, spent on focus rings, links inside prose, the selected data series
  or the one number that carries the claim.
- Semantic status hues only where a state is shown, each with a non-color cue.
- Check: list every distinct non-neutral hue on the rendered screen. More than one
  non-semantic hue, or a hue that only decorates, fails.

Buttons:

| Tier | Treatment |
|---|---|
| Primary, one per view | Ink fill: foreground color as background, background color as text. Not a brand hue. |
| Secondary | Neutral surface, 1px neutral border, ink text. |
| Tertiary and toolbar | Glyph or text on a transparent or neutral ground; hover moves one neutral step. |
| Destructive | Neutral button with an explicit verb ("Delete 3 files"); the danger hue appears only on the confirming control inside the confirmation surface. |

A hue-filled button is allowed only when the brief names a brand-colored primary: then one per
screen, no gradient, no glow, every other button neutral. Different hues per button and
colored chips used as actions are not allowed.

Icon controls:

- Monochrome SVG glyphs from one library or one authored set, one stroke weight, painted with
  `currentColor` so the control's text color drives them. No multicolor icons or emoji as
  actions.
- The glyph sits in a neutral shape (circle or rounded square in the chrome's own gray) that
  moves one neutral step on hover and press; 44x44px target; an accessible name, plus a
  tooltip when the glyph is not self-evident.
- Related actions share one neutral capsule instead of separate colored buttons.

Selected and active states (tabs, segmented controls, nav items, chips): one neutral step
darker (lighter in dark mode) plus weight or a filled glyph. Never a hue tint, never a side bar
(FE-SIDE-ACCENT-01 in [anti-slop.md](anti-slop.md)).

```css
:root { --fg: oklch(0.21 0 0); --bg: oklch(0.99 0 0); --surface-2: oklch(0.955 0 0);
        --surface-3: oklch(0.92 0 0); --line: oklch(0.88 0 0); --focus: var(--accent); }
.btn         { background: var(--bg); color: var(--fg); border: 1px solid var(--line); }
.btn:hover   { background: var(--surface-2); }
.btn-primary { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.icon-btn    { inline-size: 44px; block-size: 44px; border: 0; border-radius: 999px;
               display: grid; place-items: center; background: var(--surface-2); color: var(--fg); }
.icon-btn:hover { background: var(--surface-3); }
.icon-btn svg   { inline-size: 20px; block-size: 20px; fill: none; stroke: currentColor; stroke-width: 1.75; }
.segmented [aria-selected="true"] { background: var(--surface-3); font-weight: 600; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
```
~~~~

## C. Edits to existing lines (exact replacements)

1. anti-slop.md:85 `flat alpha/step tint | 1px accent border or ring | left/top accent bar |`
   -> `flat alpha/step tint | 1px accent border or ring |` (next line unchanged), and add
   after the code fence: `A one-sided accent bar is not a channel (FE-SIDE-ACCENT-01).`
2. anti-slop.md:96-97 `Geist neutral surface + accent border on selected; Stripe Apps` /
   `neutral panel body + small accent bar. Korean premium services (Toss, Kakao,` ->
   `Geist neutral surface + accent border on selected. Korean premium services (Toss, Kakao,`.
3. anti-slop.md:112 `(primary CTA, active states, key data)` -> `(focus rings, links in prose,
   key data; buttons and active states stay neutral per FE-COLOR-RESTRAINT-01 in
   color-system.md)`.
4. color-system.md:62-68: delete item 3 (left/top accent bar); renumber Elevation to 3 and
   Semantic status token to 4; add after the list `One-sided accent bars are not a channel
   (FE-SIDE-ACCENT-01 in anti-slop.md).`
5. color-system.md:40 add `/* --primary resolves to ink unless the brief names a brand
   primary (FE-COLOR-RESTRAINT-01) */` above `.button-primary {`.
6. implementation.md:6 append: `Buttons, tabs and nav stay neutral (ink primary, glyph-only
   toolbar actions); hue goes to data, focus and links ([color-system.md](color-system.md)
   FE-COLOR-RESTRAINT-01).`
7. top-bar.md:56-57 -> `- CTA: one filled CTA is allowed, filled with ink (inverted neutral),
   not a hue. It must not create a row of competing primary actions.`
8. mobile-ux.md:47 `bg-primary text-white` -> `bg-foreground text-background`.
9. react.md:167 `'bg-emerald-500 text-white'` -> `'bg-foreground text-background'`.
10. responsive-nav.md:36 -> `- Active state: one neutral surface step darker, medium-weight
    label and a filled glyph. No hue tint and no side bar (FE-COLOR-RESTRAINT-01 in
    dev-frontend's color-system.md).`
11. visual-hierarchy.md:44 `reserved for ONE interactive element per viewport` -> `reserved
    for focus, links in prose and the data that carries the claim`; :48 -> `- Accent color on
    max 1-2 elements per viewport (focus plus one data series or link); a button fill only
    when the brief names a brand-colored primary`.
12. editorial-report.html:36 -> `button.primary { background: var(--ink); color: white;
    border-color: var(--ink); }`; :39 -> `.scenario { padding: 12px 16px; border: 1px solid
    var(--line); }`.
13. paged-report.html:105 -> `.note { margin: 3mm 0 3mm 6mm; max-width: 118mm; break-inside:
    avoid }`.
14. visual-design.md:59 last cell -> `an indented paragraph with a run-in bold heading, no box
    and no side rule`.

## Acceptance

- `rg -n 'border-left: ?[0-9]|left/top accent bar|small accent bar|left accent border' plugins/codexclaw/skills/dev-*` -> no hits.
- `rg -n 'bg-(primary|emerald-500) text-white' plugins/codexclaw/skills/dev-*` -> no hits.
- `rg -c 'FE-SIDE-ACCENT-01|FE-COLOR-RESTRAINT-01'` shows each defined once (heading) and
  referenced elsewhere; `check-prompt-architecture.mjs` exit 0 (check 4 enforces one
  definition, check 3 the new relative links).
- `node plugins/codexclaw/scripts/gate.mjs` exit 0.
- editorial-report.html rendered once at 1280: primary button ink, scenario box with a full
  hairline, no blue side bar.
