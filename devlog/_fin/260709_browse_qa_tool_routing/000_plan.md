# 000 — Browse / QA Tool Routing (cxc-dev addition)

**Date:** 2026-07-09
**Work class:** C2 (single-file skill edit, local behavior, one new subsection)
**Loop archetype:** Spec-satisfaction (one PABCD cycle)
**Verifier:** Read-back of edited file + grep for tool ids and rule id
**Stop condition:** All acceptance criteria met
**Non-goals:** Rewriting the full ladder protocols (they stay in their owners)

## Objective

Add a "Browse / QA Tool Routing" subsection to `cxc-dev` SKILL.md so every
session sees native browser tool names without needing to load `dev-testing`
or `cxc-search`. This stops the model from defaulting to raw Playwright
installation for browse tasks.

## Problem

The model keeps trying to `npm install playwright` or `pip install playwright`
for browse/QA tasks because:
1. Neither `cxc-qa` nor `cxc-dev-testing` is implicit-visible
2. `cxc-search` teaches agbrowse-first but only for public-web proof
3. Without any browse routing in context, the base instinct is raw Playwright

## File Change Map

### MODIFY: `plugins/codexclaw/skills/dev/SKILL.md`

Insert a new `### Browse / QA Tool Routing` subsection after line 180
(Capability Routing Hub paragraph) and before line 182 (Skill Ownership Map).

Content (~18 lines):
- STRICT rule DEV-BROWSE-NATIVE-01: no direct Playwright/puppeteer install
- Table with two scoped ladders (search vs QA) naming exact tool ids
- Explanatory note on why the orderings differ
- Pointers to full protocol owners

Also add a row to the Skill Ownership Map table:
- `Browse / QA tool routing` | `dev` (this section) | `dev-testing` §4.6, `cxc-search` SEARCH-BROWSE-01

### REVIEW: `structure/60_native_capabilities.md`

Check §3 "Relationship to agbrowse" paragraph. It already documents both
ladders and their scoping. No edit needed — the new cxc-dev section is a
routing summary that points to the canonical owners, and 60_native already
cross-references both. Confirm no stale references.

## Acceptance Criteria

1. Section placed after Capability Routing Hub, before Skill Ownership Map
2. All four tool ids named: `browser:control-in-app-browser`,
   `chrome:control-chrome`, `computer-use:computer-use`, `agbrowse`
3. STRICT rule `DEV-BROWSE-NATIVE-01` present and actionable
4. Two ladders clearly scoped with ownership pointers
5. No full protocol duplication — routing summary only
6. Skill Ownership Map updated with browse routing row
7. Devlog unit recorded

## Scope Boundary

- **IN:** `plugins/codexclaw/skills/dev/SKILL.md`
- **IN (review only):** `structure/60_native_capabilities.md`
- **OUT:** All other skill files, hook code, agent configs, openai.yaml files
