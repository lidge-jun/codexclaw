# 030 — WP3 Patch Notes: dev-frontend

Per 010_plan.md §WP3 + reviewer round-4 notes. Paths relative to
`plugins/codexclaw/skills/dev-frontend/`.

### references/core/color-system.md — NEW (token implementation owner)
- **Changes**: FE-COLOR-TOKEN-01 (primitive→semantic→component layering,
  theme-ready enforcement), modern function baselines (oklch 2023, color-mix
  2023, light-dark 2024 + color-scheme; light-dark vs [data-theme] split),
  FE-COLOR-FALLBACK-01 (@supports gating incl. the var()-fallback discard
  pitfall, fallback at primitive layer), framework wiring (Tailwind v4
  @theme, shadcn @theme inline + tweakcn pointer), FE-COLOR-CONTRAST-01
  (STRICT impl gate pointing at §7 WCAG AA baseline; color-mix states count
  as new pairs; APCA advisory until WCAG 3 settles). Ownership header points
  to uiux judgment side + theme-switching runtime side (reviewer note b).
- **Verification**: `rg -n "FE-COLOR" references/core/color-system.md` → 3
  rule IDs; 105 lines.

### references/core/typography-wrapping.md — natural breaks + dvh
- **Changes**: fixed existing bug per Lane-C Tier-2 evidence — global CJK
  `keep-all` (zh/ja/ko) rescoped to `[lang|="ko"]` + overflow-wrap escape
  (global keep-all degrades zh/ja). NEW "Natural Phrase Breaks at Any Width
  (FE-WRAP-NATURAL-01)" — explicit natural-boundary requirement at arbitrary
  widths, Korean facts (auto-phrase ja-only Chrome 119+, KLREQ 금칙,
  Intl.Segmenter render-time wbr tactic + canonical-content warning,
  keep-all overflow risk), and "Dynamic-Viewport Verification" checklist
  (container-width sweep 160-900px @ 8-16px steps, dvh/svh, split-screen
  band, 200% zoom, scrollWidth assert, Korean fixtures, clamp-not-vw).
  Cross-ref to uiux Dynamic Rewrap Judgment. Existing sections :39/:94/:152/
  :186 extended, not restated.
- **Verification**: `rg -n "FE-WRAP-NATURAL-01|auto-phrase|Dynamic-Viewport" references/core/typography-wrapping.md`.

### SKILL.md — routing + anti-slop pointer
- **Changes**: new color-system.md row (verified date); typography-wrapping
  row description updated (natural breaks + dynamic viewport); §5 anti-slop
  gained ONE pointer line to uiux UX-DEFAULT-ISM-01 (no taste duplication,
  constraint 2).

### references/core/theme-switching.md — cross-link
- **Changes**: one line under "custom properties" rule pointing token/oklch
  mechanics to color-system.md (reviewer note b: runtime concerns stay here).
