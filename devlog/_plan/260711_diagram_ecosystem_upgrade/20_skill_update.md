# 20 cli-jaw Diagram Skill Update

**Date:** 2026-07-11
**Worker:** Rawls (gpt-5.6-sol)
**Status:** DONE

## Changes

### skills_ref/diagram/SKILL.md
- Line 8: Added Mermaid `block` and `venn` to capabilities list
- Lines 69-70: `block-beta` → `block` (graduated); added Venn routing row
- Lines 104-105: Updated beta guidance — removed `block-beta` from beta list
- Line 197: Chart.js CDN → jsdelivr `chart.js@4/dist/chart.umd.min.js`

### skills_ref/diagram/reference/module-widget.md
- Lines 36-38: Updated library version references
- Lines 191, 224, 231, 246, 266, 278-279: Three.js `0.172.0`/`0.180.0` → `0.185`
- Line 292: p5.js cdnjs `1.11.10` → jsdelivr `p5@2`
- Line 320: Added p5.js 2.x breaking changes doc (async setup, p5.strands, WebGPU)

### skills_ref/diagram/reference/module-chart.md
- Lines 7-8: Chart.js/ECharts CDN → jsdelivr major-pinned
- Line 58: Chart.js template CDN updated
- Lines 222, 363: ECharts 6 new capabilities (chord, beeswarm, scatter jitter, broken axes)
- Line 365: ECharts 6 native dark mode / dynamic theme switching
- Line 398: ECharts template CDN updated
- Lines 514-515: Exact `6.0.0` assertions → `6.x` major-pin language

### skills_ref/diagram/reference/module-map.md
- Lines 9-10, 16, 21, 28: Leaflet cdnjs → jsdelivr `leaflet@1`
- Line 61: "core 1.9.4 only" → "core 1.x only"

## Verification
- `git diff --check` — clean
- Stale URL/version scan — no remaining legacy strings
