# Verification

Base: d811701 (dev). No existing user session, native database, branch or live
worktree was migrated during verification. Fixtures use temporary Git worktrees
and native SQLite databases. The implementation worker was reclaimed before any
worker changes; the main agent implemented the patch. Independent plan review
failed on root-mismatch polarity and QA identity propagation; both amendments
were re-reviewed PASS before integration.

## Reproduction and correction

- A correct native ID/cwd plus changes only in a linked worktree reproduces
  SOURCE-DELTA-01 on the unbound path.
- In an isolated copy, disabling only session source routing reproduces the same
  SOURCE-DELTA-01 failure in the new end-to-end regression. Restoring routing in
  the patched tree passes it.
- Bound/unbound root comparison and QA mixed-root regressions failed before the
  identity changes and pass after them.
- Deleting a binding during C initially allowed a native receipt. The regression
  now refuses it; restoring exactly the pinned root preserves state and succeeds.

## Results

| Check | Result |
| --- | --- |
| Full `npm test`, with task-owned TMPDIR outside a Git ancestor | 2,668 tests: 2,598 pass, 0 fail, 70 existing conditional skips |
| worktree-source-integration.test.ts | 17 pass, including shipped CLI subprocess, native storage, root loss in B/C, restoration, same-size dirty content, final review and v1 loop validation |
| QA evidence contracts | 19 pass, including bound QA receipt through final goalplan validation and rootless/mixed-root refusal |
| `npm run build` | 160 modules compiled; layout validated |
| `npm run gate` | PASS |
| `npm run smoke` | PASS on Linux |
| Packaging regression | 4 pass; both new compiled files are tracked |
| `git diff --check` | PASS |
| Scoped strict TypeScript check | exit 2: same seven diagnostics as untouched base; no added diagnostic in the selected dependency closure |

The host has an unrelated `/tmp/.git`, which breaks four pre-existing GUI
project-root fixtures. Running those unchanged tests with a task-owned TMPDIR
outside that ancestor passes 8/8; the full suite uses that isolation. No host
marker was removed and no test was weakened. Initial packaging failures exposed
the two new dist files being untracked; they are now included.

Strict TypeScript diagnostics are existing interview cast/export errors and an
untyped cxc-resolve dist import. The project build uses Node type stripping, not
a whole-repository typecheck. This patch does not claim those errors are fixed.

Windows/macOS execution is left to upstream CI. Tests and local smoke are Linux
evidence; no merge or release is implied by these results.

## Independent implementation review

PASS, no blockers; reviewer independently ran four affected files (71 assertions
at that review snapshot). Main's later full-suite and 17-case integration run
cover the final code. Residuals: the pre-existing final-review generatedPaths
exclusion mismatch remains; immutable bindings require a new session or restoring
the same path after worktree removal; atomic publication needs hard links. These
are documented limits, not claims of broader platform verification.

## Local installed payload

32 changed runtime/help/skill files were backed up and atomically replaced after
matching each installed preimage to the Git base. Every installed postimage was
hash-verified. The integration and QA contract harnesses were retargeted to the
installed dist/CLI paths: 36 tests pass, 0 fail. One initial harness failure was
an unretargeted QA script-relative path; correcting that test path exercised the
installed validator's real usage exit. No production change was needed.

A real `session current --json` call shows the new sourceCwd field while retaining
the actual native session identity/cwd. Existing blocked sessions were not
advanced or rebound by this patch. Plugin update/reinstall can overwrite a local
cache patch; upstream delivery remains a separate PR, not a release.

## PR CI follow-up

The remote Ubuntu suite ran all 2,668 tests with zero failures (2,597 passed,
71 conditional skips). Its count gate exposed stale published test badges;
`inventory.mjs --write --tests 2668` updates them and the measured-count check passes.

Packed install used the upstream repository with a fork-only head SHA and failed
before installation (`unable to read tree`). The workflow now passes the matching
head repository/SHA via environment variables for head installs, retaining the
upstream release source for the downgrade. YAML and shell syntax checks pass.
An isolated probe with the workflow's exact Codex 0.147.0 successfully resolves
the fork marketplace at the immutable head SHA. No runtime payload file changed.
