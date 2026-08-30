# 002 audit round 1 — verdict, blockers, and dispositions

Research/record doc. The A-phase round for wp1, recorded so the next cycle's P
inherits it instead of re-deriving it (LOOP-CONTINUITY-01).

## Round

- Reviewer: independent `explorer` subagent, read-only, dispatched with the
  `cxc-dev-code-reviewer` + `cxc-search` packet.
- Verdict line: `VERDICT: GO-WITH-FIXES (blockers=5)`.
- Main-agent judgment: **near-pass**. Every blocker was folded into the plan; two
  reviewer claims were themselves wrong and are rebutted below.
- Every blocker was re-verified at `file:line` before acceptance. A reviewer's
  claim is evidence, not a verdict.

## Blockers and dispositions

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| 1 | High | `goalplan.test.ts:239` is named "schema v3: buildGoalplan declares schemaVersion 3" and asserts `=== 3`; it fails the moment the default drops. Reviewer simulated the one-line change in a detached worktree: 1097 tests, 1096 pass, 1 fail — only this test. | FOLDED into `010` as a MODIFY hunk retargeting it to the v1 default plus the v3 opt-in. |
| 2 | High | `010`'s two `goalplan-cli.ts` hunks elided real context, deleting the `--criterion` body and unbalancing braces. | FOLDED — both hunks rewritten against the actual file (`:76` field insert, new `else if` after `--outcome` at `:145`). |
| 3 | Med | `check-versions.mjs` `collectSurfaces()` covers 12 surfaces and reads neither `cli/package.json` nor `gui/package.json`, so a partial bump passes at exit 0. | FOLDED — `030` now marks both as manually verified, and its Bypass section no longer claims the script catches a partial bump. |
| 4 | Med | `030`'s "list to mirror" omitted `CHANGELOG.md` from the 15-file release set. | FOLDED — full set listed, with a note that `package-lock.json` moves only when the version strings it mirrors do. |
| 5 | Low | `dist/` is force-tracked and `dist-freshness.test.mjs` requires the rebuilt artifact to be committed, so a `dist` grep before building reports the wrong cause. | FOLDED into `020` AC3 and `030`. |

## Reviewer claims REBUTTED

1. **"The new wording preserves `/requires a finalGate/`."** False, and this one
   mattered: the regex needs the literal `requires a finalGate`, the new text says
   `requires an approved finalGate`. Checked directly — `old: true, new: false`.
   Two more assertions (`final-gate.test.ts:129`, `:337`) therefore break, and
   `020` now carries their MODIFY hunk. Had this been accepted, wp3 would have
   shipped a red suite.
2. **"v3 validates dependency graphs."** Overstated, and the reviewer flagged its
   own version of this. The graph checks are not version-gated; only the
   task-outcome pair at `:1304-1312` is v3-exclusive. `001` corrected.

## Confirmations worth keeping

- No production consumer outside `goalplan.ts` branches on a goalplan's
  `schemaVersion`. `final-gate-guard.ts` keys on `finalGate` presence only and
  early-outs `{ok:true}` for a gateless plan.
- Nothing in shipped code writes `schema-v2.marker`; the only writers are tests.
  So a v1-declaring plan cannot be silently promoted past the default.
- The existing hand-written `schemaVersion: 1` overrides become redundant but not
  vacuous — each still asserts a v1 behavior that is genuinely exercised. Their
  comments explain a v3 default that will no longer exist, so they need updating.
- `goalplan-regression.test.ts:195-237` pins `3` explicitly and would go red if
  the v3 rules stopped firing. That is the standing proof the gate is intact.

## Open question carried to wp2's P

Round 2 raised this same option as a blocker and it is now resolved in `010`:
the finalGate stays on the version ladder, but the task-outcome checks come off
it, so the default path keeps that coverage. See the round 2 section below.

## Audit round 2 (second independent reviewer)

A second `explorer` was dispatched with a narrowed 4-question packet while round 1
was still running. Both completed. Round 2 verdict:
`VERDICT: GO-WITH-FIXES (blockers=3)`.

Round 2 independently confirmed round 1 on the two structural questions — no
production consumer outside `goalplan.ts` branches on `schemaVersion`, and nothing
shipped writes `schema-v2.marker` — and it found `goalplan.test.ts:239` too. It
also added a finding round 1 missed:

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| R2-1 | High | same as round 1 blocker 1 (`goalplan.test.ts:239`) | already folded |
| R2-2 | Med | Defaulting to v1 silently disables the v3 done/pending task-outcome checks at `:1304`, so the change buys completability by reducing validation on the default path. | **ACCEPTED and the design changed** — `010` now unversions those two checks. Measured before accepting: a done task with no outcome yields `[]` at v1 versus a real reason at v3. |
| R2-3 | Med | Three test comments assert "buildGoalplan() declares v3 since wp2 (260829)", a premise this unit inverts. | FOLDED into `010` as a comment-update step. |

R2-2 is the most valuable finding of either round: round 1 verified the fix was
safe, round 2 caught that safe is not the same as complete. Its recommended
alternative (decouple finalGate from the version ladder, keep the newest default)
was rejected on reversibility grounds and the rejection is now recorded in `010` —
that option redefines what v2/v3 mean for plans already on disk, which is a
migration. Lifting the outcome checks out of the version branch captures the
coverage it was protecting without the migration.

Round 2's non-blocking note — assert on the returned reason rather than grepping
built `dist` — is sound and supersedes round 1's blocker 5 mechanics: `020` AC3
keeps the ordering caveat, but the primary assertion is now `assert.doesNotMatch`
on the reason string, which needs no build ordering at all.
