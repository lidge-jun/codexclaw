# 040 — Publish receipt (WP4)

Delivered against 010/020 rev2:

- `plugins/codexclaw/components/pabcd-state/src/worktree-guard.ts` (NEW) +
  `src/cli.ts` wiring (`hook worktree-guard` in the fail-open dispatch;
  `hook worktree-guard-pretool` ABOVE the subagent early-exit) +
  `test/worktree-guard.test.ts` (19 cases).
- Hooks: `session-start-detecting-managed-worktree.json`,
  `user-prompt-submit-guiding-worktree-rename.json`,
  `pre-tool-use-guarding-managed-worktree-deletion.json` (matcher `^Bash$`);
  plugin.json now declares 21 hooks.
- Skill `skills/worktree-guardian/` (+ `agents/openai.yaml`, on-demand) with
  skills/README.md, README badge (skills 27→28, hooks 18→21), structure/INDEX
  hook table + skill map rows.
- Deliberate pin updates: hook-e2e 18→21 declared hooks; manifest-targets
  11→14 pabcd-state cli.js references.

Verification evidence:
- `npm test` (full repo suite): 1472 pass / 0 fail (24.5s).
- `npm run build`: 118 files compiled, layout validated.
- `npm run gate`: OK (counts 21 == 21 on disk).
- Live-fire against dist (7 probes, tmp CODEX_HOME probe slot): GUARD-01
  SessionStart envelope names checkoutRoot; GUARD-02 rename guidance injects once
  then dedupes; GUARD-03 denies `git worktree remove <own>` and `rm -rf <own
  slot>` including a subagent-stamped payload; `git status` and non-managed cwd
  are silent.

Publish: dev push + main merge per the user's explicit pre-authorization for
this goal (2026-08-04 request). Remote heads recorded in the WP4 D attestation.
