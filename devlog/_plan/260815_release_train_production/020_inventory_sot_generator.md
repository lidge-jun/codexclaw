# 020 — Inventory source-of-truth generator + set-based drift gate

Status: PLANNED — work-phase wp2 (amended at the A gate, see `004_audit_amendments.md`)

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
- Terminal outcomes: DONE on all activation observations captured
- Escalation: if a docs-site page cannot host a marker block without breaking the
  Astro build, record it and restrict that page to check-only coverage

## Design

### Artifact: `plugins/codexclaw/inventory.json`

Stores **identities only — never standalone counts, never a commit SHA**. Every
count in generated prose is `array.length` at generation time, so a number cannot
be edited independently of the list it summarizes.

> **Amended (004 #1).** The original design stored `tests.pass` and
> `measuredCommit` in this committed file. That cannot converge: committing the SHA
> changes HEAD, which instantly makes the file stale. Test provenance now lives
> only in the CI-produced candidate manifest (030 `testSuite`), so the inventory is
> commit-independent.

```jsonc
{
  "schemaVersion": 1,
  "plugin": { "name": "codexclaw", "manifestVersion": "...", "packageVersion": "...", "latestReleaseTag": "v0.1.0" },
  "skills": [{ "folder": "dev", "name": "cxc-dev", "implicit": true }],
  "hooks":  [{ "file": "...json", "event": "SessionStart", "component": "provider-bridge", "matcher": null }],
  "components": [{ "folder": "cxc-ops", "packageName": "@codexclaw/cxc-ops", "version": "0.1.1", "hasTests": true }]
}
```

The tests badge is therefore not generated from this file. It is written only by
`inventory.mjs --write --tests <n>`, where `<n>` comes from a suite run that just
happened — during 010's correction and again at 050's release-prep step, after every
test-adding phase has landed. No committed file ever claims to know the current suite
size on its own, and a stale badge is caught by the release gate's `publishedCounts`
rule (030). `inventory.mjs --hash` prints `sha256:<canonical json>` for 030's
`inventoryHash` receipt, and `inventory.mjs --published` parses every registered marker
surface and prints the measured `{tests, skills, hooks}` triple for 030's
`publishedCounts` — failing if two surfaces disagree, so the release gate's comparison
is measured rather than self-asserted (004r3 #3).

### Injection mechanism

HTML-comment markers, identical in Markdown and MDX:

```
<!-- codexclaw:inventory:start id=hooks-table -->
...generated...
<!-- codexclaw:inventory:end id=hooks-table -->
```

| id | Targets |
| --- | --- |
| `badges` | `README.md`, `README.ko.md`, `README.zh.md` |
| `tree-counts` | the three READMEs' architecture tree comments |
| `hooks-table` | `docs-site/.../reference/hooks.md`, `.../reference/plugin-manifest.md` |
| `hook-events` | `docs-site/.../concepts/how-it-works.md`, `index.mdx` |
| `skills-catalog` | `docs-site/.../guides/skills.md`, `structure/INDEX.md` skills map |
| `components` | `structure/INDEX.md` component map, `.../development/build-test.md` |
| `install-hooks` | `docs-site/.../getting-started/installation.md` |
| `skill-lanes` | `docs-site/.../guides/native-tools.md` |
| `skills-readme` | `plugins/codexclaw/skills/README.md` |

Target list extended at the A gate (004 #8) — the first three ids left four
surfaces from 002 unprotected. `docs/*.md` carries no inventory today, but the
generator still scans it and fails on an unregistered inventory-shaped claim, so a
future count added there cannot slip in unprotected.

A target containing a marker id the generator does not know, or missing a marker it
should have, is a `--check` failure — otherwise deleting a marker silently disables
coverage.

### Set comparison (the actual fix)

```
filesystemHookSet === manifestHookSet          (both directions, no duplicates)
filesystemSkillSet === catalogSkillSet === documentedSkillSet
componentSet === testCommandComponentSet       (package.json test glob)
```

Violations report the symmetric difference by name. Duplicate manifest entries are
their own violation class.

## File change map

| Path | Change |
| --- | --- |
| `plugins/codexclaw/scripts/inventory.mjs` | NEW — `collectInventory`, `renderBlock`, `applyBlocks`, `checkSets`, `readPublished`; CLI `--check` / `--write` / `--hash` / `--published` |
| `plugins/codexclaw/inventory.json` | NEW — generated artifact, committed |
| `plugins/codexclaw/scripts/gate.mjs` | add `checkInventory()` to `runGate()` |
| `plugins/codexclaw/scripts/sync-readme-badges.mjs` | delegate to `inventory.mjs`; keep the entrypoint |
| `plugins/codexclaw/test/inventory.test.mjs` | NEW — set-drift fixtures |
| README x3, `structure/INDEX.md`, `skills/README.md`, 8 docs-site pages | wrap 010's corrected content in marker blocks |
| `.github/workflows/ci.yml` | add `inventory.mjs --check` (full wiring in 040) |

## Bypass record (PLAN-BYPASS-NAMED-01)

- Tier: E8 (repo gate)
- Executing surface: `gate.mjs` in CI plus `inventory.test.mjs`
- Known bypass: regenerating `inventory.json` alongside edited content, or deleting
  a marker block from a file the generator does not require
- Residual risk: a contributor with push access can land drift by regenerating
- Wording downgrade: yes — this is an early-warning gate, not enforcement. Final
  enforcement layer: **none** (no branch protection exists; see 003).

## Accept criteria + activation scenarios

| # | Criterion | Activation scenario |
| --- | --- | --- |
| 1 | clean tree passes | `inventory.mjs --check` exits 0 |
| 2 | extra filesystem hook fails | copy a hook JSON into `hooks/`, expect exit 1 naming it, then delete |
| 3 | manifest-only hook fails | temp-patch the manifest with a nonexistent path, expect exit 1 |
| 4 | equal-count substitution fails | swap one manifest entry for another existing file (count stays 21), expect exit 1 |
| 5 | missing marker fails | delete a marker pair from a target, expect exit 1 |
| 6 | unknown marker id fails | add a marker with an unregistered id, expect exit 1 |
| 7 | surface disagreement fails | hand-edit one README badge away from the others, run `--published`, expect a non-zero exit naming both surfaces |

Criterion 4 is load-bearing: it is precisely the case `gate.mjs:277` misses today.
If it does not fail, the new gate is no better than the cardinality check it
replaces and the phase is not done.
