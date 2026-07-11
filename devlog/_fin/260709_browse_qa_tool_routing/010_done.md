# 010 — Done: Browse / QA Tool Routing added to cxc-dev

**Date:** 2026-07-09
**Terminal outcome:** DONE
**Work class:** C2
**Session:** 019f4760-79bf-7081-a1e1-b3157495cc86

## Summary

Added a `### Browse / QA Tool Routing` subsection to `cxc-dev` SKILL.md
(lines 182-200) so every implicit-visible session sees the four native browser
tool names and the two scoped ladders without needing to load `dev-testing` or
`cxc-search`.

## What changed

- **`plugins/codexclaw/skills/dev/SKILL.md`** (+21 lines)
  - New subsection after Capability Routing Hub, before Skill Ownership Map
  - STRICT rule `DEV-BROWSE-NATIVE-01`: no direct Playwright/puppeteer install
    for ad-hoc browse/QA — use `tool_search` for native browser tools first
  - Two-ladder table naming exact tool ids and canonical owners:
    - Search: `agbrowse` → `browser:control-in-app-browser` → `chrome:control-chrome` → `computer-use:computer-use` (cxc-search SEARCH-BROWSE-01)
    - QA: `browser:control-in-app-browser` → `chrome:control-chrome` → `computer-use:computer-use` → `agbrowse` shape-only (dev-testing QA-TOOL-LADDER-01)
  - Skill Ownership Map row: canonical owners = `dev-testing` §4.6 + `cxc-search`, stub = `dev`

## Audit

- gpt-5.5 reviewer (Cicero): GO-WITH-FIXES (blockers=2)
  - B1: Ownership row — dev should be stub, not canonical. **Folded.**
  - B2: STRICT rule too broad — exclude intentional Playwright test suites. **Folded.**

## What did not change

- `structure/60_native_capabilities.md` — reviewed, already cross-references both
  ladders with correct scoping. No update needed.
- No hook code, agent configs, or openai.yaml changes.

## Verification

- grep confirmed all four tool ids present at correct lines
- Section placement verified: after Capability Routing Hub (178), before Skill Ownership Map (202)
- File grew from ~560 to 581 lines (+21)
- Existing agbrowse hint at lines 274-276 is complementary, not duplicative
