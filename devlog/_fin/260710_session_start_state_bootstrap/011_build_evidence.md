# Phase 1 build evidence

## Implementation delta

### `components/pabcd-state/src/state.ts`

- Added `ensureState(cwd, sessionId)` at the existing state owner.
- Writes a complete default IDLE JSON to a UUID-named same-directory temp file, then publishes with an exclusive hard link.
- Returns `false` on destination `EEXIST`, preserving valid or corrupt existing bytes; all other IO errors reach the CLI's existing fail-open hook boundary.
- Preserved the user's unrelated dirty IDLE reconstruction change.

### `components/pabcd-state/src/{hook,parse,cli}.ts`

- Added the narrow SessionStart payload/parser/side-effect handler and dispatcher branch.
- Empty/whitespace identity or cwd is rejected; valid strings are preserved.
- Existing `isSubagentHookPayload` runs before dispatch, so synthetic child fields remain silent.
- The handler emits no stdout; provider/map SessionStart envelopes remain unchanged.

### Hook and manifest

- Added `hooks/session-start-bootstrapping-pabcd-state.json`.
- Registered it next to the existing SessionStart hooks without changing G2/G3 or the `cli` terminal key.
- Preserved the user's diagnostic `pre-tool-use-attaching-skills.json` and ignored `diag-hook.mjs`.

### Tests and generated runtime

- Added unit coverage in `test/state.test.ts` and the existing untracked `test/parse.test.ts` without deleting their pre-existing content.
- Added five compiled process-boundary scenarios in `test/hook-e2e.test.mjs`.
- Generated only `pabcd-state/dist/{state,hook,parse,cli}.js` back into the real tree from an isolated clone build.
- Synced the control-surface contract in `skills/pabcd/SKILL.md`.

## Pre-write search and reuse decision

Searches: `linkSync|EEXIST|writeFileSync flag`, `SessionStart|session_id`, `runMapAffordanceSessionStart`, `readState|writeState`, `sessionFileExists`, manifest hook-count assertions, and existing temp-workspace hook E2E helpers.

Decision: extend the existing state owner, defensive parser, hook dispatcher, and compiled E2E harness. Rejected duplicating the state schema in `cxc-ops`, weakening the CLI unknown-session guard, adding a generic utility module, or treating reserved `cli` as a Codex fallback.

## RED → GREEN evidence

Before implementation, the compiled reproduction emitted the SessionStart binding, left the exact file missing, and exited 1 on immediate real-ID `orchestrate P`.

After test authoring but before dist regeneration:

```text
SessionStart E2E: 3 pass / 2 fail
Failures: fresh compiled bootstrap, concurrent compiled bootstrap
```

After isolated-clone dist regeneration:

```text
state + parse unit: 34/34 pass
compiled SessionStart E2E: 5/5 pass
G2/G3 focused: 8/8 pass
dist freshness + packaging: 4/4 pass
```

Manual source-boundary activation also observed:

```text
session_start_stdout_bytes=0
orchestrate P: current=IDLE -> P
race_exit=0,0 phase=IDLE tmp_count=0
enotdir_exit=0 stdout_bytes=0 stderr_bytes=0
```

## Isolated full-gate evidence

Build root: `/tmp/codexclaw-session-bootstrap.csmo3Y/repo` (independent local clone, no hardlinks/alternates, current dirty/untracked/ignored overlay with tracked deletions).

- `node plugins/codexclaw/scripts/build.mjs`: exit 0, 102 temp files compiled after the clone-only diagnostic source shim.
- freshness + packaging: 4/4 pass.
- `npm run gate`: exit 0.
- `npm test`: 1,070 tests, 1,065 pass, exactly five pre-existing failures, no new failure name.

The temp-only diagnostic shim was necessary because the full builder deletes component dist before validation. It copied the current ignored diagnostic into clone-only `subagent-config/src/diag-hook.ts`, pointed only the clone hook at generated `dist/diag-hook.js`, and recreated the clone's root dependency symlink after the deletion-aware overlay. No temp verifier file was copied back.

Full-test artifact: `/tmp/codexclaw-session-bootstrap-isolated-npm-test.tap`.

## Dirty-tree preservation

Current ignored diagnostic SHA-256 after generated transfer:

```text
32a5c1f18794e97e294bb9545caadac0e91056a060e0cd42d58e271b3c7e965e
```

Only the four planned generated `pabcd-state` files returned from the isolated build. No Git staging, commit, push, issue mutation, release, or destructive cleanup occurred.

## C-review identity repair

The first C reviewer found one Medium issue: `parseSessionStart` accepted a padded ID while persistence rewrote it through `sanitizeKey`, so the exact accepted identity was not reachable through G2. The repair establishes one canonical identity boundary:

- `isCanonicalSessionId` requires a nonempty value whose state-path key is byte-for-byte unchanged;
- `ensureState` rejects a noncanonical ID before `mkdirSync`;
- `parseSessionStart` rejects padded, slash/path-shaped, Unicode-rewritten, and empty IDs;
- source and compiled tests prove these inputs create no state, while a rejected padded ID remains unknown to immediate `orchestrate P`.

Activation evidence was preserved: the new source tests passed 7/7 while the old compiled artifact failed the expanded E2E 1/5; after isolated regeneration the compiled E2E passed 5/5. Only the newly changed `dist/state.js` and `dist/parse.js` were transferred for this repair.

During the repair, the unrelated diagnostic hook command returned externally to the standard tracked `spawn-attach-hook.js` form. The final isolated build therefore compiled 101 files without the earlier clone-only shim. Its full run counted 1,071 tests, 1,070 passing, with only the pre-existing `L11: inactive goal allows I-trigger (interview directive injected)` failure. The four diagnostic-command failures from the earlier five-name snapshot now pass; this task did not modify that hook. No new failure was introduced, and the ignored diagnostic artifact retained the same SHA-256.
