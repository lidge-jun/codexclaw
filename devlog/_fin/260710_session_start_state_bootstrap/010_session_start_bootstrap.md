# Phase 1 — SessionStart state bootstrap

## Dependency order

State ownership → payload/handler contract → CLI dispatch → manifest registration → unit/process tests → generated artifact → SoT sync. No later edit may bypass `pabcd-state` by reimplementing the state schema in `cxc-ops`.

## Diff-level file map

### MODIFY `plugins/codexclaw/components/pabcd-state/src/state.ts`

- Extend the existing `node:fs` import only with primitives needed for same-directory temporary write, exclusive hard-link publication, and cleanup.
- Add `ensureState(cwd: string, sessionId: string): boolean` next to `statePath`/`readState`.
- Require `sessionId` to be a canonical state key (`sanitizeKey(sessionId) === sessionId`) before creating the sessions directory. This keeps the persisted filename identical to the literal key later checked by G2 and rejects padded, path-shaped, Unicode-rewritten, or colliding identities.
- Create `.codexclaw/sessions/` recursively; write the complete default JSON to a unique same-directory temp file; publish it with `linkSync(temp, final)` so final-path creation is atomic and no-clobber; remove the temp in `finally`.
- Return `true` only when this invocation linked the file; return `false` on final-path `EEXIST` without reading, normalizing, timestamping, or rewriting any existing bytes, including corrupt bytes; rethrow other IO errors so the hook dispatcher's existing fail-open boundary can swallow them.
- Do not change `readState`, `writeState`, the schema, G2/G3, or the user's existing dirty IDLE reconstruction line.

### MODIFY `plugins/codexclaw/components/pabcd-state/src/hook.ts`

- Import `ensureState` from the state owner.
- Add a narrow `SessionStartPayload` interface with `hook_event_name`, `session_id`, and `cwd`.
- Add `handleSessionStart(payload): string`: reject a wrong event defensively, call `ensureState`, and always return `""` so the existing provider/map SessionStart envelopes remain the only context output.
- No goal lookup, ledger event, phase transition, Stop counter, or directive injection occurs at SessionStart.

### MODIFY `plugins/codexclaw/components/pabcd-state/src/parse.ts`

- Import the `SessionStartPayload` type.
- Add `parseSessionStart(raw)` using the existing `asObject`/`str` helpers.
- Accept only `hook_event_name === "SessionStart"` with a canonical, nonempty `session_id` and `cwd.trim().length > 0`; preserve accepted strings after validation. Malformed, wrong-event, empty, whitespace-only, padded, path-shaped, or Unicode-rewritten identities return `null`.
- Leave existing event parsers and `isSubagentHookPayload` unchanged.

### MODIFY `plugins/codexclaw/components/pabcd-state/src/cli.ts`

- Import `handleSessionStart` and `parseSessionStart`.
- In the generic fail-open hook dispatcher, add `event === "session-start"` before UserPromptSubmit; parse and invoke the side-effect handler.
- Keep the existing early child-payload guard ahead of this branch so `agent_id`/`agent_type` inputs cannot create root state.
- Update the entrypoint comment to name SessionStart bootstrap.

### NEW `plugins/codexclaw/hooks/session-start-bootstrapping-pabcd-state.json`

- Register one `SessionStart` command: `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook session-start`.
- Use the existing 10–15 second synchronous hook timeout convention and a status message that names session-state bootstrap.
- The command is side-effect-only and emits no context envelope.

### MODIFY `plugins/codexclaw/.codex-plugin/plugin.json`

- Insert the new bootstrap hook alongside the two existing SessionStart hooks, before any turn-level PABCD hooks.
- Do not reorder or modify unrelated hook rows.

### MODIFY `plugins/codexclaw/components/pabcd-state/test/state.test.ts`

- Import `ensureState`.
- Add a fresh-create test that reads the created JSON and checks exact session ID, `phase=IDLE`, inactive orchestration, and no temporary files.
- Add existing-valid and existing-corrupt tests that capture raw bytes, call `ensureState` again, expect `false`, and check byte-for-byte identity. The corrupt case documents the no-overwrite policy; later legal FSM mutation owns normalization.
- Add direct canonical-ID and noncanonical no-write assertions through the public boundary; do not export private paths for tests.

### MODIFY `plugins/codexclaw/components/pabcd-state/test/parse.test.ts`

- Add valid SessionStart parsing.
- Add malformed, wrong-event, missing, empty, and whitespace-only `session_id`/`cwd` cases.
- Retain the current root/child discriminator tests.

### MODIFY `plugins/codexclaw/test/hook-e2e.test.mjs`

- Update the declared manifest-hook count for the new row.
- Add a test that resolves the new manifest command, snapshots the real compiled `pabcd-state/dist`, runs SessionStart in an empty temp cwd, asserts exit 0/empty stdout/exact state file, then runs `orchestrate P` through the same compiled CLI and asserts exit 0 plus persisted phase P.
- In adjacent tests, preseed valid and corrupt bytes and prove repeated SessionStart preserves them.
- Launch two compiled hook processes concurrently for the same fresh ID and prove one complete file/no temp leak.
- Force `ENOTDIR` by making `<cwd>/.codexclaw` a regular file; prove exit 0, empty stdout, and no state file.
- Add whitespace, padded, path-shaped, and Unicode-rewritten identity cases plus a synthetic defensive child payload with `agent_id`/`agent_type`; prove none creates a file, and prove the rejected padded identity remains unknown to immediate `orchestrate P`.

### MODIFY generated install artifacts

- `plugins/codexclaw/components/pabcd-state/dist/state.js`
- `plugins/codexclaw/components/pabcd-state/dist/hook.js`
- `plugins/codexclaw/components/pabcd-state/dist/parse.js`
- `plugins/codexclaw/components/pabcd-state/dist/cli.js`

Regenerate mechanically from the four source files in a copied worktree, then transfer only these four outputs. Inspect the resulting diff and reject any unrelated dist byte change.

### MODIFY `plugins/codexclaw/skills/pabcd/SKILL.md`

- In the terminal control-surface/state contract, state that the registered root SessionStart hook eagerly creates the default IDLE file for its own ID.
- Keep `cli` documented as a reserved terminal key, not a fallback for Codex sessions.
- State that repeated SessionStart is resume-safe and never resets an existing FSM.

### UPDATE this implementation unit in C/D

- Record red/green commands, source/dist parity, failure delta, reviewer verdict, and terminal outcome in a new numbered document within this unit.
- Move the unit to `_fin/` only after C/D evidence and goalplan criteria are complete.

## Verification commands

Targeted real-tree checks (never invoke the destructive full builder here):

```bash
node --test --test-concurrency=1 \
  plugins/codexclaw/components/pabcd-state/test/state.test.ts \
  plugins/codexclaw/components/pabcd-state/test/parse.test.ts \
  plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts \
  --test-name-pattern='SessionStart|G2|G3|ensureState'

node --test --test-concurrency=1 plugins/codexclaw/test/hook-e2e.test.mjs \
  --test-name-pattern='SessionStart state bootstrap'

node --test --test-concurrency=1 \
  plugins/codexclaw/test/dist-freshness.test.mjs \
  plugins/codexclaw/test/packaging.test.mjs
```

Isolated VCS-bearing build/full-gate protocol:

1. Create an independent local clone with `git clone --local --no-hardlinks <real-root> <temp-root>`. Do not use a linked worktree, shared-object alternates, or a copied `.git` pointer.
2. Overlay the current real worktree onto `<temp-root>` with deletion-aware `rsync -a --delete`, explicitly excluding/protecting `.git/` and `node_modules/`. This carries tracked dirt, tracked deletions, untracked plan/hook files, and ignored `diag-hook.mjs` while preserving the clone's independent Git metadata. Recreate the temp-root `node_modules` symlink after the overlay (the deletion pass removes a destination symlink); dependency bytes remain read-only.
3. Before mutation, assert `git -C <temp-root> rev-parse --show-toplevel` resolves exactly to `<temp-root>`, `git -C <temp-root> rev-parse --git-dir` resolves inside `<temp-root>/.git`, no alternates file exists, and `git -C <temp-root> ls-files plugins/codexclaw/components/pabcd-state/dist/cli.js` returns the tracked artifact. Abort if any assertion fails.
4. Only inside the isolated clone, copy the diagnostic executable to a clone-only `components/subagent-config/src/diag-hook.ts` and point the cloned diagnostic hook command at its generated `components/subagent-config/dist/diag-hook.js`. This keeps both build validation and the manifest-dist test structurally valid across repeated temp builds. Do not change the real hook or copy this shim back.
5. Run `node plugins/codexclaw/scripts/build.mjs`, freshness, packaging, `npm run gate`, and `npm test` in the isolated clone.
6. Compare the complete failing-test name set with the five-name baseline above. No new name is permitted.
7. Transfer only the four planned `pabcd-state/dist/*.js` outputs from the isolated clone to the real tree as a mechanical generated-artifact update.
8. Re-run read-only freshness/packaging and targeted behavior tests in the real tree.

Before and after transfer, capture `git status --short`, ignored-file existence/hash, and the relevant `git diff`; only the planned source/test/hook/manifest/docs plus four matching generated files may be attributed to this task.
