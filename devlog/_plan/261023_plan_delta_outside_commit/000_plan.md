# 261023 Plans outside the commit satisfy SOURCE-DELTA-01 (#315)

## Problem

LOOP-DOCS-FIRST-01 asks for a docs-only roadmap cycle whose plans live under
`devlog/_plan/<slug>/`. Some repositories forbid committing plans; GOAT keeps
them in a scratch folder outside the worktree. Git cannot see those docs, so
B>C refused: "the source is unchanged since B began ... (SOURCE-DELTA-01)".

## Design

- `state-root.ts` (all five byte-identical copies): `CODEXCLAW_PLANS_DIR` >
  config `state.plansDir`, absolute, moves `devlogDir` to
  `<plansDir>/<projectId>` in every mode but none. Relative or in-checkout
  values are ignored with a warning. `plansDirSource` feeds `devlog path --explain`.
- `plan-delta.ts`: `planUnitDigest` (sorted relative path + sha256 of each regular
  file; symlinks skipped; bounded walk), `capturePlanEntry`, `planDeltaSince`.
- State `phaseEntryPlan` is captured on entry to B from `state.planUnit` (A>B) or the
  previous entry (C>B rework), kept through C, null elsewhere on read.
- B>C (orchestrate CLI and chat hook): an unchanged source still passes when the
  plan unit digest changed; the ledger row records `planDelta`; the refusal names
  the unchanged unit.

## Verification

`test/plan-delta.test.ts` drives `plan init`, P>A, A>B and B>C through the real
CLIs for a repository that keeps plans outside the commit (env and config), one
that commits plans (still refused when idle), plans excluded from git in local
mode, the chat path, and an in-checkout plans dir. With only the B>C logic reverted,
the gate cases fail with the issue's SOURCE-DELTA-01 refusal.
