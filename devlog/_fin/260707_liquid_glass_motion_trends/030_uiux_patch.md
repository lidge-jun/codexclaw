# 030 — WP3 Patch Notes: dev-uiux-design

Executed per `010_plan.md` + WP3 reviewer notes (extend-don't-duplicate,
pointer-only implementation, personality format, STYLE_SAMPLE). Paths
relative to `plugins/codexclaw/skills/dev-uiux-design/`.

### references/design-isms.md — new ism 1.12
- **Changes**: added "1.12 Liquid Glass (Apple, 2025-2026)" after 1.11:
  system-material framing (successor to card-style glassmorphism), CSS
  signature, judgment gate vs 1.3 (functional chrome floats as glass,
  content never does; "glass cards in content layer" = 1.3 and usually
  slop), blur-free variant note, Use/Avoid, implementation pointer to
  dev-frontend liquid-glass.md. HIG-sourced, verified 2026-07-07.
- **Impact**: SKILL.md:45 row updated (11 → 12 movements).

### references/product-personalities.md — Apple enrich + Aside profile
- **Changes**: Apple entry gains a Liquid Glass judgment paragraph (layer
  rule, regular/clear variants, adaptive settings, cross-refs). New "###
  Aside (2026 AI-product pastel)" entry in house format (Essence + yaml),
  tokens measured from live site 2026-07-07 (Geist, pill radius tiers,
  0-backdrop-filter glass feel, chips-as-content, composition), explicitly
  STYLE_SAMPLE.
- **Impact**: SKILL.md:47 row updated (8 → 9 profiles).

### references/color-system.md — practitioner notes
- **Changes**: new subsection "Practitioner Notes — Hue Budget & Tinted
  Neutrals" extending existing scale/neutral-ramp sections (per reviewer
  note #1, no parallel duplicate): Von Restorff hue budget, tinted-neutral
  extremes, brand-first theming, tools (Adobe Color/tweakcn/coolors).
  Source: dcinside 특이점 갤러리 1291953 (2026-07-05 post, Tier-2 text).
- **Impact**: SKILL.md:50 row description updated.

### SKILL.md — table descriptions
- **Changes**: 3 row descriptions updated (counts + new keywords). No new
  rows needed (no new files).
- **Verification**: `rg -n "1.12|Aside|Hue Budget|Liquid Glass" references/ SKILL.md`.
