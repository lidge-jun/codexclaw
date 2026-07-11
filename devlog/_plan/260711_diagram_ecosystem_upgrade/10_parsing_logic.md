# 10 cli-jaw Diagram Parsing Logic Update

**Date:** 2026-07-11
**Worker:** Hubble (gpt-5.6-sol)
**Status:** DONE

## Changes

### public/js/render/mermaid-config.ts
- **Line 62 (`WIDE_MERMAID_TYPES`):** Removed standalone `block-beta` entry.
  `block` remains at line 69. No duplicate.
- **Lines 50-59 (init config):** Verified correct for Mermaid 11.16:
  `startOnLoad: false`, `theme: 'base'`, `themeVariables`. No change needed.

### src/cli/tui/markdown.ts
- **Line 71:** Generic fence handler for `chart-json`, `diagram-html`,
  `diagram-file`, `mermaid` — shows `[lang — open in Web UI]`. No change needed.

### Architecture Note
Mermaid rendering is delegation-based: no allowlist restricts diagram types.
New types (venn, packet, swimlanes, etc.) work automatically once Mermaid
library is updated. Only `WIDE_MERMAID_TYPES` needed cleanup.

## Verification
- `npm run typecheck:frontend` — PASS
- Mermaid runtime test — 1/1 PASS
- `git diff --check` — clean

## Remaining
- package.json mermaid `^11.14.0` → `^11.16.0` bump (deferred, reasonable)
