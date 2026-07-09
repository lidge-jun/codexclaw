# 010 — Patch Plan: dev-frontend + dev-uiux-design (Liquid Glass / Chip Motion)

Derived from `000_research.md`. Ownership per `dev/SKILL.md` map:
implementation → `dev-frontend`, design judgment → `dev-uiux-design`.

## Gap analysis (current state, verified 2026-07-07)

- `dev-frontend/references/core/motion.md` (164 L): Creative Arsenal names
  "Mac OS Dock magnification, Magnetic buttons" (motion.md:144) but ships NO
  implementation pattern; bans `window.addEventListener('scroll')`
  (motion.md:34) but offers no CSS scroll-driven-animations replacement;
  no pointer-proximity/icon-chip guidance.
- `dev-frontend/references/core/aesthetics.md`: glassmorphism = 4 lines
  (aesthetics.md:148-152); no Liquid Glass functional-layer rules, no
  pill-geometry system, no glass-without-blur alternative.
- `dev-uiux-design/references/design-isms.md`: 1.3 Glassmorphism is the 2020
  recipe; no Liquid Glass (2025-2026) ism with layer discipline.
- `dev-uiux-design/references/product-personalities.md`: Apple entry exists
  (:70-77) with one-line liquid_glass token; no 2026 AI-product pastel-pill
  profile (aside.com class).
- dcinside color nuggets (HSL-derived tokens, tinted neutrals, brand-first
  theming): candidate home `dev-uiux-design/references/color-system.md`
  (inspect during WP3).

## WP2 — dev-frontend (implementation owner)

1. NEW `references/core/liquid-glass.md`:
   - Layer discipline (HIG-sourced): functional layer only, never content
     layer, use sparingly, regular vs clear variants.
   - Named rule IDs per repo convention (audit fix #2): `FE-LIQUID-LAYER-01`
     (DEFAULT), `FE-LIQUID-PERF-01` (DEFAULT), `FE-LIQUID-A11Y-01` (STRICT
     for reduced-transparency honor), pill geometry as STYLE_SAMPLE.
   - CSS recipes: regular glass (backdrop-filter + luminosity + inner border
     refraction), clear glass, scroll-edge legibility, and the measured
     aside.com "glass without blur" alternative (translucent white pills over
     rich/pastel backgrounds — 0 backdrop-filter on the whole page).
   - Perf gates: phrased as conservative local guidance (audit fix #3 —
     Tier-2 promotion attempted 2026-07-07: MDN backdrop-filter reference has
     no performance section; web.dev claim stays Tier 1). No exact public
     performance numbers; budget = small surfaces, low radius, no scrolling
     containers, per-viewport count cap.
   - A11y gates: `prefers-reduced-transparency`, `prefers-contrast`,
     contrast-on-translucency verification.
   - Pill-geometry system: 3-tier radius + pill class (aside.com measured
     8.4/11.2/16.8 + 9999px pills).
2. EXTEND `references/core/motion.md`:
   - New section "Pointer-Proximity Motion (Icon Chips, Magnetic, Dock)" —
     shared rAF + CSS-variable pattern, magnetic strength, dock falloff,
     `hover:hover`+`pointer:fine` gate, reduced-motion behavior, touch
     fallback.
   - New section "CSS Scroll-Driven Animations" — `animation-timeline:
     scroll()/view()`, `animation-range`, when it replaces JS scroll
     listeners, support-check caveat.
3. WIRE `dev-frontend/SKILL.md` Modular References table: add liquid-glass.md
   row; update motion.md row description.
4. DE-DUP (audit fix #1): convert `aesthetics.md:148-152` "Glassmorphism
   (when used)" block and `iterative-design.md:83` "True glassmorphism"
   bullet into short cross-refs to `liquid-glass.md` so the new file is the
   single glass owner inside dev-frontend.

## WP3 — dev-uiux-design (judgment owner)

1. EXTEND `references/design-isms.md`: add "1.12 Liquid Glass (2025-2026)"
   with CSS signature + Use/Avoid + layer-discipline judgment + relation to
   1.3 glassmorphism.
2. EXTEND `references/product-personalities.md`: enrich Apple entry with HIG
   variant/layer rules; add "Aside-class AI-product pastel" profile with
   measured tokens (Geist, pill chips as content, radius tiers, pastel washes,
   sentence-period headlines, glass-without-blur).
3. dcinside color nuggets → `references/color-system.md` (HSL-derived token
   families, tinted neutrals beyond off-black, brand-first theming, tools:
   Adobe Color / tweakcn / coolors) — additive, no duplication of
   dev-frontend accent-budget rules.
4. WIRE `dev-uiux-design/SKILL.md` reference table only if descriptions need
   the new keywords (no new files planned).

## Cross-cutting rules

- Every trend claim carries `(verified 2026-07-07)` or cites the research doc.
- STYLE_SAMPLE class for tokens/palettes; DEFAULT for gates; STRICT only
  where HIG/a11y demands (reduced-transparency honor).
- No edits outside the two skills + this devlog folder.

## Verification per phase

- `rg -n "liquid-glass|Liquid Glass|animation-timeline|proximity" plugins/codexclaw/skills/dev-frontend` shows wiring.
- `rg -n "Liquid Glass|1.12|Aside" plugins/codexclaw/skills/dev-uiux-design` shows wiring.
- `git status --short` scope review each D-close.
