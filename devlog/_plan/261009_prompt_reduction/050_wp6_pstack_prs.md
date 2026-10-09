# wp6 — pstack / pstack-opencodex: two outbound fixes

The user asked, mid-goal, to compare Lauren Tan's pstack and foxytanuki/pstack-opencodex and to send a PR where codexclaw's maintainer can contribute something that fits the PABCD initiative. Evidence: research/50_pstack_comparison.md (from three Aside exec reports, `~/.aside/u/0/artifacts/codexclaw-prompt-research/07-09`). Upstream Cursor pstack gets nothing: no external pstack change has been merged there (#424 closed unmerged) and worktree fixes are already in flight (#492, #523). pstack-opencodex invites PRs (CONTRIBUTING.md) and has none yet, so two small fixes for defects reproduced on this Mac go there. The fit with the initiative is the method rather than any codexclaw machinery: each PR fixes an observed failure, carries a regression test that fails before the fix, and is verified with fresh output. No FSM, hooks or codexclaw rules are imported.

Loop spec: satisfy-spec, one cycle. Trigger: the user's request above. Goal: two PRs open on foxytanuki/pstack-opencodex from the lidge-jun fork, each green in the repo's own checks. Non-goals: upstream `upstream/` content (must stay identical), Cursor's repo, the LATER/REJECT ideas in research/50, codexclaw changes (the three local adoptions go to wp3's delegation.md lane). Verifier: `python3 -m unittest discover -s tests -v`, `python3 tools/pstack_opencodex.py build` with the two `cmp` license checks, `git diff --check`, `git diff --exit-code -- upstream/` (the repo's CI steps), run on a fresh macOS clone of the PR branch; the PR's hosted CI. Stop: both PRs open with green checks, or a recorded reason. Memory: this doc. Outcomes: DONE (PRs open), BLOCKED (fork/push refused), NOOP (a defect no longer reproduces at the PR-time HEAD). Escalation: none expected; authority is the user's explicit "pr 날려줘". Bounds: `/tmp/pso.*` clones, `gh` with the user's account; no token/time bound stated.

Reproduced at foxytanuki/pstack-opencodex `2dd2800` on macOS (APFS, case-insensitive), Python 3.14.7:

- A: a fresh clone shows `git status` ' D UPSTREAM' and `build` fails with `IsADirectoryError: ... /UPSTREAM`. The tracked lock file `UPSTREAM` and the tracked directory `upstream/` (158 files) differ only by case, so one of them cannot exist on a case-insensitive filesystem (default macOS and Windows).
- B: `check-models --catalog /nonexistent.json` ends in a Python traceback (`FileNotFoundError`). `check-runtime` already turns bad input into a `BLOCKED` report (`test_bad_input_fails_with_json_instead_of_traceback`); `check-models` has no such boundary, and `load_catalog` also raises `KeyError` for a model without `slug` and `AttributeError` for a non-object document.

## PR A — `fix: rename the upstream lock so it does not collide with upstream/` (branch `fix/upstream-lock-case`)

| File | Change |
|---|---|
| `UPSTREAM` → `UPSTREAM.lock` | rename, content unchanged (done from the index: `git show HEAD:UPSTREAM > UPSTREAM.lock`, `git rm --cached UPSTREAM`, `git add UPSTREAM.lock`, because the working tree cannot hold `UPSTREAM` on macOS) |
| `tools/pstack_opencodex.py` | `LOCK_FILE = REPO / "UPSTREAM.lock"`; module docstring "at the ref in UPSTREAM.lock" |
| `README.md` | layout table row `UPSTREAM` → `UPSTREAM.lock` |
| `CONTRIBUTING.md` | "the source pinned in `UPSTREAM.lock`" |
| `tests/test_repository.py` (NEW) | test: no two tracked paths (including every directory prefix) are equal after `casefold()`; uses `git ls-files -z`; skips when git or the work tree is unavailable |
| `.github/workflows/ci.yml` | add a `macos-15` job (Python 3.13) running the same steps, plus `test -z "$(git status --porcelain)"` right after checkout so a case collision fails at the first step |

Activation: the new test fails on `2dd2800` (it finds `UPSTREAM` vs `upstream`) and passes after the rename; the macOS job reproduces the clone failure on the old tree. Rejection risk: the maintainer may prefer another name; the PR says so and keeps the change mechanical.

## PR B — `fix: report unreadable model catalogs without a traceback` (branch `fix/check-models-catalog-errors`)

| File | Change |
|---|---|
| `tools/pstack_opencodex.py` `load_catalog` | reject a non-object document and a model without a string `slug` with `ValueError` (message names the catalog path), matching `pstack_runtime.catalog_records` |
| `tools/pstack_opencodex.py` `cmd_check_models` | read the catalog once inside `try`; on `OSError` / `ValueError` (includes `json.JSONDecodeError`) exit 1 with `cannot read model catalog <path>: <reason>`; reuse the parsed records for the disabled-model check instead of a second `json.loads` |
| `tests/test_runtime.py` | `RuntimeCLI` cases: missing file, `not-json`, `[]`, `{"models": [{}]}` → return code 1, the message on stderr, no `Traceback`, catalog bytes unchanged; existing valid and disabled-model cases unchanged |

Activation: the three new negative cases fail on `2dd2800` (traceback / exit code) and pass after the fix; `test_disabled_child_fails_name_check_and_runtime_check` proves the valid path still resolves.

## Delivery

Fork `lidge-jun/pstack-opencodex`; one branch per PR from `main`; commits in Conventional Commits; each PR body states the observed behavior, the cause, the change, the verification commands with their output, and that no live delegation is involved. Both PRs are independent and can merge in either order.

## Accept criteria

Both PR branches: the repo's four CI steps pass on a fresh macOS clone of the branch (and PR A's test fails on `main`); hosted CI green on each PR head; PR URLs recorded here and in goalplan c-8.


## Architect consultation (research/08_architect_wp6.md: W1-W6, reflection MISALIGNED)

Dispositions: W1, W3, W5 accepted as planned. W2 accepted: the collision test lists `git ls-files -z`, adds every directory prefix, deduplicates identical spellings and fails only on distinct spellings with the same `casefold()`; a unit-level helper is tested with the three fixtures (`UPSTREAM` + `upstream/x` fails, `upstream/a` + `upstream/b` passes) and against the real index. W4 accepted: `load_catalog` validates through `pstack_runtime.catalog_records` (object, `models` array, object entries, string slugs) and keeps its mapping return; the effort projection is unchanged. W6 accepted: negatives are missing file, malformed JSON, non-object document, non-array `models`, non-object entry, missing slug, malformed effort; plus a successful `check-models` case with exit 0 and a clamped effort.

Gap P1 (delivery dependency) resolved: PR B is stacked on PR A's branch (base `main` in the PR, with a note that it contains A's commit until A merges), so its fresh macOS proof runs on a tree where A's rename exists. If A merges first, B is rebased onto `main`. Gap P2 and P3 folded above.


## wp6 P revalidation and A residuals (2026-10-09)

Continuity, quoting the wp5 D summary: "Next: wp6 (pstack-opencodex PRs) per 050." Upstream `main` is still `2dd2800` with no PRs, so both defects and the plan stand. Fork: `lidge-jun/pstack-opencodex` (created during wp5 wait, no branches pushed).

Residual 1 (research/09): the delivery line "independent, either order" is replaced. PR A targets `main`. PR B is branched from PR A's branch and also targets `main`; its description says it contains A's commit until A merges, links A, and names its own review range (the last commit). After A merges, B is rebased onto `main` and re-verified.

Residual 2: tests are labeled by role. RED regression tests must fail on `2dd2800` and pass after the fix: the case-collision test against the real index (A); the eight catalog error-contract cases (B: missing file, malformed JSON, non-object document, non-array `models`, non-object entry, missing slug, non-string slug, malformed effort). Compatibility tests pass before and after: the collision helper's shared-parent fixture (A) and the successful `check-models` run with a clamped effort (B). C records the RED run on `2dd2800` and the GREEN run on each branch, plus `git diff --exit-code 2dd2800 HEAD -- upstream/`.


## wp6 B record

Implemented in a clone of foxytanuki/pstack-opencodex (`/tmp/pso.EjTe/repo`, base `2dd2800`); the exact patches are in `evidence/pstack-opencodex/` (`0001-…` = PR A, `0002-…` = PR B, stacked).

- PR A, branch `fix/upstream-lock-case` (`1ee7f61`): `UPSTREAM` → `UPSTREAM.lock` (bytes unchanged, renamed through the index), readers updated (`LOCK_FILE`, module docstring, README layout row, CONTRIBUTING), NEW `tests/test_repository.py` (case-collision helper over tracked paths and their directory prefixes; real-index test), `.github/workflows/ci.yml` adds a `macos-15` job that first checks the checkout is complete. The macOS run exposed an existing failure on `2dd2800`: `test_explicit_catalog_override_wins_over_config` compares an unresolved temp path with the CLI's resolved one (`/var` → `/private/var`); the test now resolves its temp root (one line).
- PR B, branch `fix/check-models-catalog-errors` (`80ea77c`, on top of A): `catalog_efforts(records)` split out of `load_catalog`, which now validates through `pstack_runtime.catalog_records` and keeps its return shape; `check-models` reads the catalog once inside one `(OSError, ValueError)` boundary and exits 1 with `cannot read model catalog <path>: <reason>`; the disabled-model set reuses the validated records.
- RED on `2dd2800` (this Mac): the real-index collision test fails with `[['UPSTREAM', 'upstream']]` (both helper fixtures pass); the eight catalog cases fail (tracebacks or wrong exit/prefix); the clamp compatibility case passes. GREEN: A 25/25, B 27/27; build (46 skills), both license `cmp`, `git diff --check` and `git diff --exit-code 2dd2800 -- upstream/` pass on both branches.

