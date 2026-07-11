# opencodex GUI Component Audit — Findings

**Date**: 2026-07-09
**Method**: Playwright sweep — 8 pages (dashboard/providers/models/subagents/
logs/usage/codex-auth/api) x light/dark fullPage screenshots (`/tmp/ocx-audit/`),
narrow 700px check, computed-token contrast math, accessible-name scan on all
buttons/links. Rules applied: product-density D8, consistency-locks,
FE-COLOR-CONTRAST-01, a11y-patterns, typography-wrapping, FE-GRADIENT-02.

## Findings

| # | Sev | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| 1 | P1 | `--faint` fails text contrast: 2.78:1 light (#9b9b9b on #fff surface), 3.01:1 dark (#6f6f6f on #262626 surface), 2.53:1 on light `--raised`, 2.63:1 on dark `--raised`. Used for REAL text: `.faint`, `.card-right`, `.model-group-head .count`, disabled model ids (Dashboard.tsx:462, Models.tsx:303) | contrast math (reviewer-recomputed) | light -> #707070 (4.95:1 white, >=4.5 on raised), dark -> #9a9a9a (5.38:1 surface, 4.69:1 raised) |
| 2 | P2 | `.toggle` button has no accessible name (CodexAuth auto-switch) | a11y scan: `toggle on` in codex-auth | add `aria-label` + `title` in CodexAuth.tsx |
| 3 | P2 | `.tbl-wrap` has no background — ambient wash bleeds under Logs/Usage tables, violating content-layer opacity (FE-GRADIENT-02 spirit) | logs-light.png warm tint under rows | `background: var(--surface)` on `.tbl-wrap` |
| 4 | P3 | Inputs show only a 1px border-color change on mouse focus; keyboard gets outline but pointer focus is nearly invisible | api-light.png Generate key input | add soft ring `box-shadow: 0 0 0 3px var(--accent-soft)` on `.input:focus`/`.select-sm:focus` |
| 5 | P2 | SYSTEMIC (reviewer escalation): 5 pages bypass the existing `EmptyState` primitive (ui.tsx:23) with bare string-in-box empties — CodexAuth.tsx:179, Logs.tsx:126, Usage.tsx:254, Dashboard.tsx:457, Subagents.tsx:79. D8 requires clear empty states and the primitive already exists | reviewer file refs | route the 5 bare empties through `EmptyState` (title + body, icon where natural) |
| 6 | P3 | `NEXT SESSION` badge uppercase mono | codex-auth-light.png | WAIVED — mono badge caps are a deliberate console idiom here, consistent across badges |
| 7 | P3 | `.badge-amber` light text #b45309 on composited amber-soft (~#f8eee6) = 4.39:1, below AA for 11px text (dark ok, 6.75:1) | reviewer composited math | darken light amber to ~#9a4a08-#8f4506 range so the tinted-bg ratio clears 4.5:1; verify green/red badges too |

## Review synthesis (A-gate round 1, reviewer Ramanujan FAIL -> accepted)

Accepted: #1 evidence corrections (dark pair is surface not bg; dark-raised
2.63:1 also fails; "subagents unselected rows" claim removed — those keep
`--text`, only adornments are faint); #5 escalated to P2 systemic with the
`EmptyState` primitive as the fix vehicle; #7 un-waived with composited-bg
math. No rebuttals.

## Passing checks (no finding)

- Consistency locks: one monochrome accent + semantic trio; documented radius
  scale (buttons=pill, cards=12, inputs/rows=8); one theme per page, light-dark
  token-driven.
- Hover states change color only — no layout shift (borders constant 1px).
- Icon-only `.btn-icon`s carry accessible names everywhere except finding #2.
- Mono ids wrap/overflow handled (`overflow-wrap: anywhere` on card heads,
  `.api-code` scrolls horizontally).
- Narrow 700px: sidebar collapses to chip-grid nav, stats 2-col; no overflow.
- D8 dashboard defaults: tables + compact metric rows + visible timestamps +
  clear 200/400 status with Details affordance; no decorative card stacks.
- 0 console errors on all 8 pages.
