# 40 Deferred Audit Fixes — PABCD Loop

**Date:** 2026-07-11
**Goal:** Fix all 6 deferred findings from Einstein/Laplace/Aquinas review
**Loop mode:** HOTL (goal active + PABCD cycling)
**Session:** 019f4a07-70d9-7fc3-bdcb-9276fa5f2522

## Work Phases

### WP1: Security (Poincare)
- Mermaid iframe CSP: add `img-src 'self' data: blob:` to block external image exfiltration (#7645)
- OSM tile URL: `{s}.tile.openstreetmap.org` → `tile.openstreetmap.org` (current policy)
- Leaflet popup XSS: remove false sanitization claim, add HTML injection warning
- Files: iframe-renderer.ts, module-map.md

### WP2: Three.js Contradictions (Cicero)
- Static vs dynamic import contradiction → both supported via ES modules
- Texture loading contradiction → CSP-dependent, not Three.js limitation
- Version date error: r171 Nov 2024, not Sep 2025
- ES module mandatory since r161, not r172
- PostProcessing → RenderPipeline rename
- Files: module-widget.md

### WP3+WP4: SRI + Accessibility + Theme (James)
- SRI hashes for all CDN script tags (integrity + crossorigin)
- ARIA attributes for all visualization containers
- Theme toggle re-render for Chart.js/ECharts/Mermaid
- aria-pressed on theme toggle button
- Files: html-templates.md, diagram-to-html.sh

## Evidence (to be filled per work-phase)
- [ ] WP1: typecheck pass + rg for old OSM URL
- [ ] WP2: no contradictory statements scan
- [ ] WP3+WP4: bash -n + integrity attr grep
