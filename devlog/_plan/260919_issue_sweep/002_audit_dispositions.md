# 002 — Audit dispositions (A phase)

An independent read-only reviewer returned **FAIL** with six blockers, and the architect
reflection returned **MISALIGNED**. Both were `gpt-6-astra`, dispatched separately from
the six cluster advisors. Every blocker below was re-verified by main against the
repository before being accepted; none was taken on the reviewer's word.

## Blockers — accepted

**B1. The release is not triggered by the promotion merge.** Verified:
`.github/workflows/release.yml:12-30` accepts `workflow_dispatch` with **required**
`version` and `expected_sha` inputs, or a `push` of tags `v*`. Merging `dev` into
`main` triggers neither. `070` step 6 described a release that would never start.
Corrected in `070`.

**B2. The version bump spans more than `package.json`.** Verified:
`plugins/codexclaw/scripts/check-versions.mjs` `collectSurfaces()` reads
`package.json`, `plugins/codexclaw/.codex-plugin/plugin.json`, every
`plugins/codexclaw/components/*/package.json`, and `inventory.json`
(`inventory.plugin.packageVersion`). Corrected in `070`.

**B3. Every test-adding phase must regenerate the published test count.** Verified:
`.github/workflows/ci.yml:62` runs
`node plugins/codexclaw/scripts/inventory.mjs --check --tests "${{ steps.suite.outputs.total }}"`,
and `README.md:16` carries the badge `tests-3,150_passing`. wp2, wp3, wp4 and wp7 all add
tests, so each of their PRs must regenerate the inventory and the three README badges or
its own CI fails. This makes `README.md`, `README.ko.md`, `README.zh.md` and
`inventory.json` shared surfaces across almost every phase — the single most likely cause
of red PRs in this unit. Added to the shared-file list.

**B4. #200 leaves competing universal instructions in place.** The planned edit to
`SKILL.md:77-82` does not cover `SKILL.md:75-76`, which still requires answer-first and
claim headings universally, nor the recovered `report-pipeline.md:15` storyline mandate
and its editorial-review action requirement at `:101`, nor the page-role catalog's
decision-oriented defaults. Scope extended in `060`.

**B5. #199's receipt has no producer, schema or verifier.** The recovered PDF receipt
binds review checks to artifact hashes; it does not carry route, contract version, skill
version or completed/omitted checks. The issue's "snippets are leads" and
source-independence requirements were also dropped. Scope extended in `060`.

**B6. Partly addressed issues may not be closed as done.** `000:24,29` defines DONE as
merged-or-NOOP-with-evidence. #191's route-aware extraction, #188's context-size remedy,
#193's desktop-wrapper transition and #186's execution evidence all remain unimplemented.
`060:21` additionally permitted dropping #199/#200 merely because recovery is large.

Disposition: each remainder becomes a **new tracked issue** opened at wp8 and linked from
the original, and the original closes only when its remainder is transferred. An issue
whose remainder is the whole substance stays open. "Recorded in prose" is not a
disposition. Corrected in `070`.

## Architect structural corrections — accepted

- **wp2 splits.** Deletion protection (#175) is a wp8 precondition and ships alone;
  lane coordination (#184) is separate work that consumes wp6's CI-evidence contract, so
  it moves after wp6.
- **wp4 splits.** Read-only observability (#187, #185, #190) ships separately from the
  C4 native-state requeue (#188), which mutates the host's database.
- **#189 moves from wp4 to wp5.** It edits `delegation.md`, so keeping it in wp4 would
  pull PR #180's prerequisite forward into the memory phase for no reason.
- **wp7 splits three ways**: recovery (plus #181), research and genre extension
  (#199, #200), then standalone integration (#182, #183). #183's portable copy must
  synchronize **after** #200's canonical edits, not before.
- **wp3 must precede wp4**, because both modify `cxc-ops/src/doctor.ts`.

## Blocker partially rebutted

**#191's verdict.** The reviewer argues PARTIALLY-REAL is insufficient to justify closure.
Main agrees on the conclusion and rejects the framing: the verdict describes the issue's
*proposed remedy* being unworkable, not the defect being half-fixed. The routing/auth
mismatch at `memories/write/src/guard.rs` versus `runtime.rs` is fully real and fully
unfixed here. Under B6 the issue therefore stays **open**, with only the diagnostic
improvement referenced. No closure is claimed.

## Errata — host anchors corrected

The A4 advisor cited host lines from the reference checkout's working tree
(`fde7de4d04`), while this unit pins `78245b47af`. The reviewer re-read the pinned
revision and found eight mismatches. The pinned-revision lines are authoritative:

| Cited in `001`/`030` | Actual at `78245b47af` |
| --- | --- |
| `memories/write/src/start.rs:65` | quota guard and counter at **79-85** |
| `memories/write/src/phase1.rs:159` | interactive-source selection at **130-133** |
| `memories/write/src/phase1.rs:411` | retained inter-agent communication at **404-405** |
| `memories/write/src/phase1.rs:444` | assistant retention is in `rollout_input.rs:276-277` |
| `state/src/runtime/memories.rs:728` | retry reset at **766-781** |
| `state/src/runtime/memories.rs:996` | retry decrement at **1040** |
| `memories/write/src/runtime.rs:256` | provider creation at **146-148** |
| `hooks/src/schema.rs:485` | SessionStart input at **499-509** |
| `cxc-ops/src/doctor.ts:464` | quoted diagnostic at **497**, severity downgrade at **489** |

The substantive claims survive the correction; only the line numbers were wrong. This is
recorded rather than silently patched, because the same mistake would otherwise repeat
whenever an advisor reads a checkout whose HEAD differs from the pinned revision.

## Non-blocking fixes — accepted

1. **Fixing the lint in this checkout does not fix the lint running against me.** The
   active hook invokes `${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js` from the
   installed plugin cache, not from this worktree. So wp3 does not unblock this session's
   own Markdown edits; main continues avoiding the three scanned patterns in prose, and
   the wp3 completion claim proves the fix through its tests, not through an unblocked
   `apply_patch`.
2. **#191's threshold-zero wording is too absolute.** With `rate_limit_reached_type`
   present the guard rejects regardless of threshold; with the field absent, threshold
   zero does permit a numeric 100% window. The source disproves a *reliable universal*
   bypass, not every effect of zero.
3. **PR #180 facts corrected.** Head is `7c328045`, OPEN/CLEAN/MERGEABLE, all checks
   green — verified directly. It changes `phase-plan.md` and `plan-output.md` too, which
   wp5 does not plan to edit. Its `delegation.md` hunk starts near old line 97 while the
   #189 insertion is at line 18, so there is **no direct hunk conflict**; the ordering
   rationale is "it already does the work and adds sections wp5 must preserve", not
   "the files collide".
4. `000:39` said the `dev/SKILL.md` overlap is wp6 and wp7; it is **wp5 and wp6**.
5. `report-export.test.mjs` already exists in `60a07328` and must be extended, preserving
   its invalid-argument, input-overwrite and missing-tool regressions.
6. #185 explicitly asks for a warning when cwd is absent from the injected global summary.
   `030` only forbade the false "no memories" message. The warning is added to scope.

## Re-audit

The corrections above are recorded amendments to the P-phase plan under
LOOP-UNIT-CHAIN-01, not a new plan. The gate exits at **justified near-pass**: every
blocker is either folded into `060`/`070`/this document, or explicitly rebutted with
reasons (#191's framing). No blocker is deferred unaddressed.
