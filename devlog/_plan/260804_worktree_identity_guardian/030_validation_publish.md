# 030 — WP4: validation, SoT sync, publish (diff-level)

## Gates (fresh output, exit 0 each)

1. `cd plugins/codexclaw/components/pabcd-state && node --test` — full suite incl.
   worktree-guard.test.ts.
2. `node plugins/codexclaw/scripts/build.mjs` — dist regeneration; re-run tests
   against dist where the suite does so (dist-freshness test in-repo).
3. Live-fire (A2/A3 from 010): pipe crafted JSON payloads into
   `plugins/codexclaw/components/pabcd-state/dist/cli.js hook worktree-guard`:
   - SessionStart cwd=/Users/jun/.codex/worktrees/probe-slot/repo → WORKTREE-GUARD-01
   - UserPromptSubmit "워크트리 이름 바꾸자" same cwd → WORKTREE-GUARD-02
   - PreToolUse `git worktree remove /Users/jun/.codex/worktrees/probe-slot` → deny
   - PreToolUse `git status` → empty
   - SessionStart cwd=/Users/jun/Developer/new/700_projects/codexclaw → empty
   Record raw stdout in the D summary.
4. `git diff --stat` scope check: only the files named in 010/020 + this unit.

## SoT sync (SOT-SYNC-01)

Check whether the repo has an INDEX/architecture doc enumerating hooks
(`rg -l "hooks/" README.md docs-site structure`); if a hook list exists, add the
three new hooks; if none exists, note the recommendation in the D summary instead
of creating a new SoT doc inside this unit.

## Publish (pre-authorized by the user for this goal: dev push + main merge)

1. Commits (LOOP-GIT-01, separate): `feat(pabcd-state): worktree-guard hooks...`
   (src+dist+hooks+plugin.json+tests), `feat(skills): worktree-guardian`,
   `docs(devlog): 260804_worktree_identity_guardian unit`.
2. `git push origin dev` (HEAD == local dev, ff-only).
3. `git switch main && git merge --ff-only origin/main && git merge --no-ff dev`
   (or ff if main is strictly behind) && `git push origin main && git switch dev`.
4. Verify: `git ls-remote origin dev main` matches local heads; paste output in D.

## Terminal outcome

D summary names DONE/BLOCKED/... with the evidence list; goalplan criteria
c-research..c-publish each get capturedEvidence before `update_goal complete`
(GOAL-COMPLETE-GATE-01).
