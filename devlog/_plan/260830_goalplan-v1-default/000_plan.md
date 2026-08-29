# 260830 goalplan v1 default — objective, constraints, work-phase map

## Objective

A newly created goalplan must be completable. Today it is not: every plan
`buildGoalplan()` produces declares `schemaVersion: 3`, and every version >= 2
demands a `finalGate` that no shipped code path can produce. The goal is to make
the v1 flow — the shape the overwhelming majority of runs actually use — the
working default, without weakening the v2/v3 gate for plans that opt into it.

## Measured state (HEAD 05db9d07, v0.2.15)

```
schemaVersion 1  ok = true
schemaVersion 2  ok = false   schemaVersion 2 requires a finalGate ...
schemaVersion 3  ok = false   (same, plus task-outcome reasons)
```

That transcript comes from calling `validateGoalplan` directly on a plan whose
work phases and criteria are all satisfied. The only remaining reason is the
gate. See `001_root_cause.md` for the full chain.

## Constraints

- IN: `pabcd-state/src/goalplan.ts`, `pabcd-state/src/goalplan-cli.ts`,
  `pabcd-state/test/`, `CHANGELOG.md`, version/inventory surfaces, this unit.
- OUT: hand-writing `finalGate` into any `goalplan.json` (that is forgery, not a
  fix); deleting or loosening the v2/v3 gate for plans that declare v2/v3;
  building the whole `--lane final_gate` lifecycle in this unit; the 19
  pre-existing dirty worktree paths, which belong to the user.
- The gate must keep refusing a declared-v2/v3 plan with no approved gate. A fix
  that makes everything pass is indistinguishable from deleting the gate.

## Work-phase map (dependency-ordered, PHASE-SPLIT-01)

| Phase | Doc | Depends on | Deliverable |
|-------|-----|-----------|-------------|
| wp1 | this unit | — | research + diff-level decade docs (docs-only cycle) |
| wp2 | `010_default_v1.md` | wp1 | `buildGoalplan` defaults to v1; explicit opt-in for higher versions |
| wp3 | `020_remediation_text.md` | wp2 | the finalGate message stops naming a flag that does not exist |
| wp4 | `030_release.md` | wp2, wp3 | build, version bump, changelog, commit, install-verify |

The order is the build order, not a schedule: wp3's wording depends on what wp2
decides the default is, and wp4 can only ship what wp2/wp3 landed.

## Why not "just implement --lane final_gate"

That is the larger fix, and it does not help the majority case. Even with a
working `--lane final_gate` verb, every ordinary v1-shaped run would have to
dispatch a final-gate reviewer and record a verdict before `update_goal`
complete could pass — ceremony the v1 flow never asked for. The lane work
remains a legitimate follow-up unit for plans that genuinely want v2/v3; it is
not the fix for "new plans cannot complete".

## Verifier (PLAN-VERIFIER-REAL-01)

| Command | Exit | Reads this unit's target? |
|---------|------|---------------------------|
| `npm test` | 0 at HEAD | yes — the glob includes `pabcd-state/test/*.test.ts`, quoted in `package.json:24` |
| `npm run build` | 0 at HEAD | yes — compiles `pabcd-state/src` into `dist` (`scripts/build.mjs`) |
| `cxc loop validate --slug <slug>` | non-zero today | yes — it is the surface the bug appears on |

All three were run before being written here.
