# 020 — Inventory source-of-truth generator + set-based drift gate

Status: PLANNED — work-phase wp2

## Loop spec

- Archetype: spec-satisfaction repair
- Trigger: 010 corrected the numbers by hand; nothing stops them drifting again
- Goal: inventory facts are derived from the payload and injected into every
  publication surface, with a gate that fails on set mismatch
- Non-goals: release manifest/receipts (030), CI topology (040)
- Verifier: `node plugins/codexclaw/scripts/inventory.mjs --check` (new),
  `npm test` (new unit tests), `gate.mjs`
- Stop condition: `--check` exits 0 on a clean tree and non-zero on each injected
  drift fixture
- Memory artifact: `plugins/codexclaw/inventory.json` + this doc
- Terminal outcomes: DONE on both activation observations captured
- Escalation: if a docs-site page cannot host a marker block without breaking Astro
  build, record it and restrict that page to check-only coverage

## Design

### Artifact: `plugins/codexclaw/inventory.json`

Stores **identities with provenance, never standalone counts** — every count in
generated prose is `array.length` at generation time, so a number cannot be edited
independently of the list it summarizes.

```jsonc
{
  "schemaVersion": 1,
  "generatedFrom": { "commit": "<sha>", "generatedAt": "<RFC3339>" },
  "plugin": { "name": "codexclaw", "manifestVersion": "...", "packageVersion": "...", "latestReleaseTag": "v0.1.0" },
  "skills": [{ "folder": "dev", "name": "cxc-dev", "implicit": true }],
  "hooks":  [{ "file": "...json", "event": "SessionStart", "component": "provider-bridge", "matcher": null }],
  "components": [{ "folder": "cxc-ops", "packageName": "@codexclaw/cxc-ops", "version": "0.1.1", "hasTests": true }],
  "tests": { "command": "npm test", "pass": 1631, "fail": 0, "measuredCommit": "<sha>", "measuredAt": "<RFC3339>" }
}
```

`tests` is written by `--record-tests <pass> <fail>` (invoked from CI after the suite
runs), never guessed by the generator. A `measuredCommit` different from HEAD is
reported as **stale**, which is a distinct failure from **wrong**.

### PLAN-FIELD-CHAIN-01 for `tests.measuredCommit`

| Stage | Path |
| --- | --- |
| creation | `inventory.mjs --record-tests` (CI step after `npm test`) |
| serialization | `inventory.json` `tests` object |
| deserialization | `readInventory()` in `inventory.mjs`; `release-manifest.ts` (030) |
| consumers | badge renderer (tests badge), `--check` staleness rule, 030's `test-suite` receipt |

### Injection mechanism

HTML-comment markers, identical in Markdown/MDX:

```
<!-- codexclaw:inventory:start id=hooks-table -->
...generated...
<!-- codexclaw:inventory:end id=hooks-table -->
```

Block ids and their targets:

| id | Targets |
| --- | --- |
| `badges` | `README.md`, `README.ko.md`, `README.zh.md` (skills/hooks/tests) |
| `tree-counts` | the three READMEs' architecture tree comments |
| `hooks-table` | `docs-site/.../reference/hooks.md`, `.../plugin-manifest.md` |
| `hook-events` | `docs-site/.../concepts/how-it-works.md`, `index.mdx` |
| `skills-catalog` | `docs-site/.../guides/skills.md`, `structure/INDEX.md` skills map |
| `components` | `structure/INDEX.md` component map, `development/build-test.md` |

A target file that contains a marker id the generator does not know, or is missing
a marker it should have, is a `--check` failure — otherwise deleting a marker would
silently disable coverage.

### Set comparison (the actual fix)

```
filesystemHookSet === manifestHookSet          (both directions, no duplicates)
filesystemSkillSet === catalogSkillSet === documentedSkillSet
componentSet === testCommandComponentSet       (package.json test glob)
```

Violations report the symmetric difference by name, not by count. Duplicate manifest
entries are their own violation class.

## File change map

| Path | Change |
| --- | --- |
| `plugins/codexclaw/scripts/inventory.mjs` | NEW — `collectInventory`, `renderBlock`, `applyBlocks`, `checkSets`, CLI `--check` / `--write` / `--record-tests` |
| `plugins/codexclaw/inventory.json` | NEW — generated artifact, committed |
| `plugins/codexclaw/scripts/gate.mjs` | add `checkInventory()` to `runGate()` aggregation |
| `plugins/codexclaw/scripts/sync-readme-badges.mjs` | delegate to `inventory.mjs`; keep the entrypoint for compatibility |
| `plugins/codexclaw/test/inventory.test.mjs` | NEW — set-drift fixtures |
| README ×3, `structure/INDEX.md`, 6 docs-site pages | wrap the corrected 010 content in marker blocks |
| `.github/workflows/ci.yml` | record test totals after `npm test` (full wiring in 040) |

## Bypass record (PLAN-BYPASS-NAMED-01)

- Tier: E8 (repo gate)
- Executing surface: `gate.mjs` in CI + the `inventory.test.mjs` unit tests
- Known bypass: editing generated content and `inventory.json` together, or
  deleting a marker block from a file the generator does not require
- Residual risk: a contributor with push access can land drift by regenerating
- Wording downgrade: **yes** — this is an "early warning gate", not enforcement.
  Final enforcement layer: none (no branch protection exists — see 003).

## Accept criteria + activation scenarios

| # | Criterion | Activation scenario |
| --- | --- | --- |
| 1 | clean tree passes | `inventory.mjs --check` → exit 0 |
| 2 | extra filesystem hook fails | copy a hook JSON into `hooks/`, run `--check`, expect exit 1 naming the file; delete it |
| 3 | manifest-only hook fails | temp-patch manifest with a nonexistent path, expect exit 1 naming it |
| 4 | equal-count substitution fails | swap one manifest entry for another existing file (count stays 21), expect exit 1 — **this is the case `gate.mjs` misses today** |
| 5 | stale test provenance fails | set `measuredCommit` to a random sha, expect a stale violation distinct from a mismatch |
| 6 | missing marker fails | delete a marker pair from a target, expect exit 1 |

Criterion 4 is the load-bearing one: if it does not fail, the new gate is no better
than the old cardinality check and the phase is not done.
