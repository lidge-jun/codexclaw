# 005 — Current gaps with anchors (tree 2915878c, read 2026-11-21)

Paths are under `plugins/codexclaw/skills/`.

## A. Recipes that teach the rejected look (wp1)

| Anchor | Current text | Conflict |
|---|---|---|
| `dev-frontend/references/core/color-system.md:62-64` | Emphasis channel 3 "Left/top accent bar … `border-left: 3px solid var(--brand)`; Stripe Apps pattern" | Recommends the one-sided bar |
| `dev-frontend/references/core/anti-slop.md:85` | Decision rule channel list includes "left/top accent bar" | Same, as an allowed channel |
| `dev-frontend/references/core/anti-slop.md:96-97` | "Stripe Apps neutral panel body + small accent bar" | Cited as premium practice |
| `dev-frontend/references/core/anti-slop.md:112` | ONE accent "(primary CTA, active states, key data)" | Spends hue on buttons and active states |
| `dev-uiux-design/references/responsive-nav.md:36` | Sidebar active state "8% primary color background + 3px left accent border" | Both a tint and a side bar on nav |
| `dev-uiux-design/references/visual-hierarchy.md:44,48` | Accent "reserved for ONE interactive element per viewport"; "CTA + link" | Spends hue on the CTA |
| `dev-frontend/references/core/top-bar.md:56` | "one filled pill CTA is allowed" | Does not say the fill is neutral |
| `dev-frontend/references/core/mobile-ux.md:47` | `bg-primary text-white` sticky CTA sample | Hue-filled button sample |
| `dev-frontend/references/stacks/react.md:167` | `variant === 'primary' && 'bg-emerald-500 text-white'` | Hue-filled button sample (also a default Tailwind hue) |
| `dev-frontend/references/core/implementation.md:6` | "Max 1 accent" summary | Does not say where the accent may go |
| `dev-visualizer/assets/editorial-report.html:36,39` | `button.primary` blue fill; `.scenario` 3px blue left border on a tint | Both patterns in a shipped asset |
| `dev-visualizer/assets/paged-report.html:105` | `.note` 0.5pt left rule | One-sided rule on notes |
| `dev-visualizer/reference/visual-design.md:59` | "indented paragraph with a run-in bold heading and a hairline" | Ambiguous; the asset reads it as a left rule |

Already aligned and kept: `dev-uiux-design/references/design-read.md:105` lists "tinted
callouts with a colored left border" as a default to avoid; `anti-slop.md:38-48` bans
gradient buttons and pastel rainbows; `color-system.md` FE-COLOR-ACCENT-SURFACE-01 options
1, 2, 4, 5 are neutral-compatible.

## B. Missing entirely

- Neutral button and icon-control rule; per-screen color budget (wp1).
- Copy drafting procedure, second-generation tells, over-correction table, Korean landing
  copy tells, kwrite routing from dev-frontend (wp2).
- Any script that checks rendered UI or copy (wp3). dev-frontend `scripts/` holds only
  `init-artifact.sh` and `bundle-artifact.sh`.
- Baseline 2026 features: `rg -l 'anchor posit|@starting-style|base-select|text-box-trim|field-sizing|interestfor'`
  over the three skills returns nothing (wp4).
- Agent action UX: `rg -ic 'confirm|approval|tool call|plan' dev-uiux-design/references/conversational-ai.md` = 0 (wp4).
- Trend files dated 2026-07-07..07-14; `design-trends.md` observed_at 2026-07-14 (wp4).
- Rendered look loop for visualizer HTML figures; diagram type catalog; first-use brand gate (wp5).

## C. Budgets (check-prompt-architecture, 2026-11-21)

Router bytes: dev-frontend 4,241 / 10,240; dev-uiux-design 4,073 / 10,240; dev-visualizer
3,746 / 10,240. Gate exit 0. New rule ids must be defined in exactly one file (check 4).
