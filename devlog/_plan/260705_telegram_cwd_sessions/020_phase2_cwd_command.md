# 020 — Phase 2: `/cwd` command (show / set with validation)

Class: C3-flavored C2 (remote control of exec cwd — the risk decision is recorded
in 000; implementation itself is a bounded command handler).

## Behavior spec

- `/cwd` (no arg) → reply `Current workdir: <binding.workdir || adapter workdir>`.
- `/cwd <path>`:
  1. Expand leading `~`/`~/` to `os.homedir()`. No other expansion (no env vars).
  2. `fs.realpathSync(path.resolve(expanded))` — resolves symlinks; throws if the
     path does not exist → reply `Not a directory: <input>` and change NOTHING
     (user rule: 아니면 파지 않기 — never mkdir).
  3. `statSync(real).isDirectory()` must be true, else same rejection.
  4. `db.setBindingWorkdir(binding.id, real)` + `db.clearBindingThread(binding.id)`
     (a codex thread is anchored to its old cwd; keeping it would silently mix
     contexts) → reply `Workdir set: <real> (session reset)`.
     Audit finding 2 (accepted race, same as pre-existing `/reset`): if a turn is
     in flight, `runOne` re-persists the old thread id at completion
     (agent-service.ts:144). Mitigation in THIS phase: `runOne` skips
     `setBindingThread` when the binding workdir changed since turn start
     (compare `binding.workdir` captured at turn start vs fresh row before
     persisting). Small, contained, and fixes /reset's race too.
- Allowed only for allowlisted chats (falls after the `isAllowedChat` gate, same
  as /status — command chain position matters).

## Diff plan

### MODIFY `src/telegram-adapter.ts`

- Add `handleCwd(chatId, msg, rawText)` following the `handleModel` pattern
  (binding via `getOrCreateAgentBinding`/`getOrCreateBinding`).
- Register `if (rawText.startsWith("/cwd")) return handleCwd(...)` in `dispatch`
  AFTER the allowlist gate; add `{ command: "cwd", description: "Show or set working directory" }`
  to `setMyCommands` and a `/cwd` line to `handleHelp`.
- Imports: `node:fs` (realpathSync, statSync), `node:path`, `node:os` — first fs
  use in this file; keep sync calls (command path, not hot loop).

### MODIFY `src/discord-adapter.ts` — OUT (non-goal; Telegram only this unit).

## Tests (extend `test/telegram-adapter.test.ts`)

Real tmp dirs via `mkdtempSync` (existing fixture pattern):
- `/cwd` no-arg → replies current workdir.
- `/cwd <tmpdir>` → binding.workdir updated to realpath, thread_id cleared, reply confirms.
- `/cwd <tmpdir>/nope` → rejection reply, binding unchanged, directory NOT created.
- `/cwd ~` → expands to homedir (assert prefix, no literal `~` stored).
- `/cwd <path-to-file>` → rejected (not a directory).
- non-allowlisted chat `/cwd` → silent ignore.

## Accept criteria

- `npm test` green; rejection path provably leaves fs untouched (no mkdir call exists).
