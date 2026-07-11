# 00 Research — Diagram Ecosystem Audit

**Date:** 2026-07-11
**Scope:** cli-jaw diagram parsing + skill + CDN versions + Mermaid ecosystem

## CDN Version Audit (from Gauss subagent)

| Library | Old Version | Current Stable | Status |
|---|---|---|---|
| Mermaid.js | 11.x (generic) | 11.16.0 | Update pin |
| Chart.js | 4.x | 4.5.1 | Minor bump |
| ECharts | 5.x | **6.1.0** | **MAJOR UPGRADE** |
| D3.js | 7.x | 7.9.0 | Minor bump |
| Three.js | 0.170 | **0.185.1** | **15 revisions behind** |
| Leaflet | 1.x | 1.9.4 | Same major |
| p5.js | 1.x | **2.3.0** | **MAJOR UPGRADE** |
| Matter.js | 0.20 | 0.20.0 | Same |
| Tone.js | 15.x | 15.1.22 | Same major |

## Mermaid Beta Status (from Gauss subagent)

| Diagram Type | Previous | Current (11.16.0) | Action |
|---|---|---|---|
| `radar-beta` | beta | **Still beta** | Keep as-is |
| `architecture-beta` | beta | **Still beta** | Keep as-is |
| `block-beta` | beta | **Graduated → `block`** | Update everywhere |
| `treemap-beta` | beta | **Still beta** | Keep as-is |
| `kanban` | stable | Stable | Keep as-is |

## New Mermaid Diagram Types (since 11.0)

Added to Mermaid since the skill was last updated:
- Packet (`packet-beta`)
- Venn (`venn`)
- Ishikawa (`ishikawa`)
- Wardley Maps
- TreeView
- Event Modeling
- Cynefin
- Swimlanes

## Breaking Changes

### ECharts 5 → 6
- Default theme, palette, component sizing changed
- New chart types: chord, beeswarm, scatter jitter, broken axes, matrix coordinates
- Dynamic theme switching / dark mode built-in
- `v5.js` compatibility theme available
- Upgrade guide: https://echarts.apache.org/handbook/en/basics/release-note/v6-upgrade-guide/

### p5.js 1 → 2
- Promise-based loading: `async setup()` + `await` replaces `preload()`
- New shader system: p5.strands
- WebGPU build available
- npm `latest` tag is 2.x

### Three.js 0.170 → 0.185
- `PostProcessing` renamed to `RenderPipeline`
- WebGPU premultiplied-alpha behavior changed
- Old global `three.min.js` build removed at r161

## Investigation Targets

- [ ] cli-jaw src/ — diagram parsing code locations
- [ ] cli-jaw src/ — CDN version references
- [ ] cli-jaw src/ — mermaid type detection/enum
- [ ] cli-jaw skills_ref/diagram/reference/ — all 10 files audited
- [ ] codexclaw dev-diagram-viewer — CDN versions verified (done by Volta)

## Next Steps

→ Unit 10: Update cli-jaw parsing logic
→ Unit 20: Update cli-jaw diagram skill + references
→ Unit 30: Finalize codexclaw diagram skill

## Source Code Audit (from Tesla subagent + direct investigation)

### cli-jaw Parsing Code Locations

| File | Role | Changes Needed |
|---|---|---|
| `public/js/render/mermaid-config.ts:62` | `WIDE_MERMAID_TYPES` layout classifier | Remove `block-beta` (keep `block`) |
| `public/js/render/mermaid-config.ts:50` | Mermaid init config | No change needed |
| `src/cli/tui/markdown.ts:71` | TUI fence handler | No change needed (generic handler) |
| `src/lib/tui/components/markdown.ts` | TUI mermaid ASCII rendering | No change needed |
| `src/prompt/templates/a1-system.md` | System prompt template | References diagram skill, no version pins |
| `package.json:158` | Mermaid dependency | `^11.14.0` → consider `^11.16.0` |

### cli-jaw Skill Files CDN Audit

| File | Lines | Current | Target |
|---|---|---|---|
| `module-widget.md` | 191,224 | `three@0.172.0` | `three@0.185` |
| `module-widget.md` | 246 | `three@0.180.0` | `three@0.185` |
| `module-widget.md` | 292 | cdnjs `p5.js/1.11.10` | jsdelivr `p5@2` |
| `module-chart.md` | 7,58 | cdnjs Chart.js `4.4.1` | jsdelivr `chart.js@4` |
| `module-chart.md` | 8,396 | cdnjs ECharts `6.0.0` | jsdelivr `echarts@6` |
| `module-map.md` | 9-10,16,21,28 | cdnjs Leaflet `1.9.4` | jsdelivr `leaflet@1` |
| `SKILL.md` | 69 | `block-beta` | `block` |
| `SKILL.md` | 52 | missing `venn` | add routing row |
| `SKILL.md` | 195 | cdnjs Chart.js | jsdelivr |

### Key Architecture Insight

Mermaid rendering in cli-jaw is delegation-based: no TypeScript enum or allowlist
restricts supported diagram types. Mermaid.js itself parses the syntax and renders.
The only code-level concern is `WIDE_MERMAID_TYPES` which controls layout width, not
type acceptance. This means new Mermaid types (venn, packet, etc.) work automatically
once Mermaid is updated — only the skill documentation and layout hints need updating.

## Status: Research COMPLETE → dispatched workers for Units 10, 20, 30
