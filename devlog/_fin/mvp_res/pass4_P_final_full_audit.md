# Pass 4 (P) - Final full mvp_res audit

Status: P - Goal 45ab94c7-ba6 - 2026-06-30 - cxc
Scope: read-only-first final audit over every `mvp_res/` loop doc and provenance doc.

## Goal
Prove the active goal's completion condition: all canonical `mvp_res/` loop docs are
decision-complete, internally consistent, evidence-backed, and committed.

## Why now
Cluster passes have closed:

- Cluster 1 L8-L11 hardening and implementation evidence.
- Cluster 2 L12-L19 hardening and shipped docs-close evidence.
- Cluster 3 L20-L22 shipped docs-close evidence.
- Cluster 4 L23-L28 shipped docs-close evidence.
- Residual parity sweep aligned stale sub-loop status through L28 and clarified
  old decade docs as historical inputs only.

The remaining risk is not an implementation gap but an objective-level proof gap:
an independent final reviewer must challenge whether any loop doc still violates
the status legend, source/reference grounding, Scope/IPABCD/Acceptance/QA/Commit
template, or deferred-loop semantics.

## Diff-level plan
1. No source/code change planned.
2. Run mechanical scans:
   - Status legend scan over all top-level `mvp_res/*.md`.
   - L1-L28 stale status scan constrained to `^Status:` lines in explicit loop
     ranges `010-281` only. Do not glob `2*.md` broadly because `290-292` are
     intentionally deferred Phase-3 docs.
   - `000_INDEX.md` table-column scan for L1-L28 rows to prove the ledger agrees
     with doc heads.
   - L29-L31 deferred/non-DONE scan.
   - Dead source path scan for old omo cache paths, excluding explicit warning
     and historical audit prose.
   - `git diff --check`.
   - `git status --short --untracked-files=all` before staging and after commit,
     so collapsed directories cannot hide untracked files. Known unrelated
     local helper `/Users/jun/Developer/new/700_projects/codexclaw/scripts/dev-symlink.sh`
     must remain unstaged unless a separate user request explicitly scopes it in.
3. Dispatch independent read-only final reviewer over:
   - `devlog/_plan/mvp_res/000_INDEX.md`
   - `devlog/_plan/mvp_res/000_BUILD_LOG.md`
   - all `010`-`311` loop/sub-loop docs
   - pass docs and current git log/diff
4. If reviewer finds blockers: fix them in B, re-run checks, and commit.
5. If reviewer passes: add reviewer evidence under `.omo/evidence/`, update
   `000_BUILD_LOG.md` with the final audit result, run `npm test` + `npm run build`,
   selectively stage only planned docs/evidence files, including this plan file
   (`devlog/_plan/mvp_res/pass4_P_final_full_audit.md`), and commit final audit
   evidence. Do not stage unrelated untracked files such as local helper scripts.

## Acceptance
1. Independent final reviewer returns PASS/CLEAR with no blockers for all canonical
   `mvp_res` loop docs.
2. Mechanical scans show L1-L28 have no stale non-DONE status while L29-L31 remain
   intentionally deferred/planned.
3. `npm test` and `npm run build` pass after final evidence docs are written.
4. Final evidence is committed, and `git status --short` after commit contains
   no planned evidence files. Any unrelated pre-existing/untracked file is
   explicitly named with `--untracked-files=all` and left unstaged.

## QA channel
- `.omo/evidence/*final*mvp_res*`
- `rg` status/dead-path scan output
- `git status --short` before/after selective staging and final commit
- `npm test`
- `npm run build`

## Commit unit
`docs(plan): record final mvp_res audit evidence`
