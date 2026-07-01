# Pass 1 (P) - Post-L28 parity audit

Status: P - Goal 45ab94c7-ba6 - 2026-06-30 - cxc
Scope: docs-only parity assessment after `mvp_res/` L1-L28 shipped.

## Goal
Turn the user's "L28까지 구현됐는데 parity 한번 파악" request into a committed,
bounded parity audit track. The output is not implementation yet; it is a
decision-complete gap map between the shipped codexclaw MVP and the cli-jaw /
jawcode harness experience.

## Why now
The final `mvp_res/` audit proved L1-L28 are shipped and internally consistent.
That closes the MVP doc-hardening objective, but it also exposes the next
question: which cli-jaw/jawcode affordances remain missing in codexclaw despite
the shipped FSM, hooks, skills, CLI helpers, provider bridge, and GUI?

## Diff-level plan
1. Keep the new track under `devlog/_plan/mvp_hard/` so it is clearly separate
   from canonical `mvp_res/` implementation evidence.
2. Add `010_L1_parity_audit.md` with:
   - current implemented parity by surface,
   - exact gap findings grounded in repo files,
   - severity/priority,
   - proposed follow-up loops,
   - non-goals so this does not expand into implementation inside the audit pass.
3. Update `000_INDEX.md`:
   - keep the track definition and constraints,
   - mark L1 as `DONE`,
   - replace the research inbox with a result pointer,
   - add a concrete follow-up loop ledger with statuses.
4. Commit the parity-audit docs and the gate-review evidence that identified
   the untracked parity track as a completion blocker.

## Acceptance
1. `devlog/_plan/mvp_hard/010_L1_parity_audit.md` exists and names exact repo
   files for each implemented/missing parity surface.
2. `devlog/_plan/mvp_hard/000_INDEX.md` no longer contains an `IN PROGRESS`
   loop; L1 is DONE and follow-up work is explicitly PLANNED/DEFERRED.
3. `git status --short --untracked-files=all` contains no untracked plan or
   evidence files after the commit.

## QA channel
- `git diff --check`
- static `rg` over `devlog/_plan/mvp_hard`
- `npm run build`
- `npm test`

## Commit unit
`docs(plan): add post-L28 parity hardening audit`
