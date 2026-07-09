# 020 — WP2 Patch Notes: dev-frontend

Executed per `010_plan.md` (post-audit round 2). All paths relative to
`plugins/codexclaw/skills/dev-frontend/`.

### references/core/liquid-glass.md — NEW (glass implementation owner)
- **Changes**: 120-line reference. FE-LIQUID-LAYER-01 (DEFAULT, HIG-ported
  functional-layer discipline, regular vs clear variants), CSS recipes
  (regular/clear glass, scroll-edge mask, aside.com-measured glass-without-
  blur pill pattern, 3-tier + pill radius geometry as STYLE_SAMPLE),
  FE-LIQUID-PERF-01 (DEFAULT, conservative local guidance — no public
  benchmark numbers per audit fix #3), FE-LIQUID-A11Y-01 (STRICT:
  prefers-reduced-transparency/contrast, worst-case-background contrast
  verification, @supports fallback).
- **Impact**: routed from SKILL.md; cross-referenced by aesthetics.md and
  iterative-design.md.
- **Verification**: `rg -n "FE-LIQUID" references/core/liquid-glass.md` → 3
  rule IDs; file 120 lines (< 400 limit).

### references/core/motion.md — pointer-proximity + CSS scroll-driven
- **Changes**: new section "Pointer-Proximity Motion — Icon Chips, Magnetic,
  Dock" (FE-PROXIMITY-01: one-listener/CSS-var pattern, hover:hover +
  pointer:fine gate, reduced-motion static fallback, displacement caps,
  magnetic + dock falloff formulas); new subsection "CSS Scroll-Driven
  Animations" (`animation-timeline: scroll()/view()`, `animation-range`,
  support caveat, chip choreography via per-chip ranges). Sources verified
  2026-07-07 (MDN opened; proximity patterns Tier-1-marked in research doc).
- **Impact**: SKILL.md motion row updated; Creative Arsenal items (Dock
  magnification, Magnetic buttons) now have real implementation backing.
- **Verification**: `rg -n "FE-PROXIMITY-01|animation-timeline" references/core/motion.md`; wc -l = 259 (< 400).

### references/core/aesthetics.md — de-dup (audit fix #1)
- **Changes**: "Glassmorphism (when used)" block → cross-ref to
  liquid-glass.md single owner.
- **Impact**: none beyond pointer redirection.

### references/core/iterative-design.md — de-dup (audit fix #1)
- **Changes**: "True glassmorphism" bullet now points at liquid-glass.md.

### SKILL.md — routing wiring
- **Changes**: added liquid-glass.md row (with verified date); motion.md row
  description now names scroll-driven timelines + pointer-proximity chip
  motion.
- **Verification**: `rg -n "liquid-glass" SKILL.md`.
