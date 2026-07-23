# 020 — README optimization (phase 2, diff-level plan)

Files: `README.md` (source of truth), `README.ko.md`, `README.zh.md` (mirror edits,
translated; keep section order + code fences identical).
Verifier: re-run count commands, check every linked path/URL exists, confirm 3-file
structural parity, run `node plugins/codexclaw/scripts/gate.mjs`.

## E1 — badge row (all 3 files)

- `tests-1%2C110_passing` → `tests-1%2C201_passing`; alt "1,201 tests passing".
- `skills-29` → `skills-27`.
- `hooks-14` → `hooks-18`.
- Docs badge href `https://lidge-jun.github.io/pabcd_initiative/` →
  `https://lidge-jun.github.io/codexclaw/`; badge text `docs-codexclaw`.

## E2 — Features §Dev Skill Family (all 3 files)

- "13 surface-specific routers" → "**12 surface-specific routers**" (list stays as
  written — it already names 12 — plus canonical parent `dev`).
- "146 unique rule IDs, 33 bidirectional cross-reference pairs, zero
  contradictions" → replace with "155 unique rule IDs across the family."
  (Locked research: 001 #12 — file-prefix-stripped dedup = 155; re-run the 001
  command at B and use the fresh value. The pairs/contradictions clause is dropped
  as unsubstantiated.)

## E3 — Architecture tree (all 3 files)

- `├── dev-*/                     13 surface routers` → `12 surface routers`.
- `skills/  29 skills` → `27 skills`.
- Hook block — EXACT replacement (before = README.md L70-77, same anchors in
  ko/zh). Before:
  ```
  ├── hooks/                       14 hooks across the session lifecycle
  │   ├── session-start-*          provider bridge, PABCD bootstrap, map affordance
  │   ├── user-prompt-submit-*     PABCD trigger detection
  │   ├── pre-tool-use-*           skill attach, goal guards, patch lint, interview guard
  │   ├── post-tool-use-*          interview capture, render observation
  │   ├── stop-*                   PABCD continuation under active goals
  │   ├── subagent-stop-*          evidence verification for worker dispatches
  │   └── post-compact-*           cursor reinject after context compaction
  ```
  After:
  ```
  ├── hooks/                       18 active hooks across the session lifecycle
  │   ├── session-start-*          provider bridge, PABCD bootstrap, map affordance, recall context
  │   ├── user-prompt-submit-*     PABCD trigger detection, recall intent
  │   ├── pre-tool-use-*           skill attach, goal guards, patch lint, interview guard
  │   ├── post-tool-use-*          interview capture, render observation
  │   ├── stop-*                   PABCD continuation under active goals
  │   ├── subagent-stop-*          evidence verification for worker dispatches
  │   └── post-compact-*           cursor reinject, recall context, bg-terminal affordance
  ```
  (Covers the 4 registrations the old tree missed: session-start-injecting-
  recall-context, user-prompt-submit-detecting-recall-intent, post-compact-
  injecting-recall-context, post-compact-injecting-bg-terminal-affordance.
  Metric: 18 active manifest registrations; 3 deprecated JSONs under
  `hooks/_deprecated/` not counted — 001 #13.)
- Replace the bogus tail `└── cli/  cxc orchestrate | map | loop | skill | ...`
  (no such dir inside `plugins/codexclaw/`) with an explicit ownership boundary:
  ```
  └── gui/                         local dashboard (Vite + React)

  Repo-only (outside the plugin payload): bin/codexclaw.mjs + cli/ workspace
  provide the `cxc` CLI — cxc orchestrate | map | loop | skill | ...
  ```
- `├── gui/   local dashboard (Vite + React)` — subject to E6 marking.

## E4 — Install section (all 3 files)

Expand from 2 lines to the full lifecycle (verified against live CLI 2026-07-23):

```bash
codex plugin marketplace add https://github.com/lidge-jun/codexclaw
codex plugin add codexclaw@codexclaw

# update
codex plugin marketplace upgrade codexclaw

# uninstall
codex plugin remove codexclaw@codexclaw
```

Plus one prose line: after an upgrade Codex marks hooks **Modified** — re-approve
them to reactivate (content-hash trust model).
Plus one scoping line: the `cxc` CLI ships with a repository checkout
(`bin/codexclaw.mjs`); the marketplace install activates skills/hooks/MCP without
it (decision D6, 010).

## E5 — Documentation section (all 3 files)

- Primary link → plugin docs site `https://lidge-jun.github.io/codexclaw/`.
- Keep pabcd_initiative as the methodology/research reference (one sentence,
  it already lives in Ecosystem too — dedupe: Documentation = codexclaw site
  primary + one line pointing to pabcd_initiative for methodology provenance).
- Dependency: this switch is honest only after WP3 (`030_docssite_sync.md`) lands;
  if WP2 ships first, note "docs site sync in progress" is NOT added — instead WP3
  must land in the same push. Sequence: WP2 and WP3 land together.

## E6 — GUI caveat (conditional on D1)

- If D1 (commit gui/dist) is done before WP2 B-phase: no marking needed.
- Else mark EVERY GUI/dashboard claim, not one paragraph: (a) Multi-Model
  Subagents feature paragraph — append "(dashboard: repo checkout build for now;
  bundled in a follow-up release)"; (b) architecture tree `gui/` line — append
  "build from source"; (c) docs-site GUI claims — handled in WP3/030 sweep.

## E7 — i18n mirror

- Apply E1–E6 to `README.ko.md` / `README.zh.md` translated, same anchors.
- Parity check (strengthened at A): diff normalized extractions across all three
  files — badge values, install/command code blocks, architecture numeric claims,
  destination URLs, and top-level section count/order must match exactly; prose
  may differ by translation only.

## E8 — explicitly NOT changed

- No npm install instructions (repo is private-on-npm by design).
- No CHANGELOG promise in README until D3 lands.
- Ecosystem table untouched (pabcd_initiative/cli-jaw/ima2-gen roles still true).
