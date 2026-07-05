# 040 — D close-out (2026-07-05)

Terminal outcome: **DONE** (all three phases shipped in one PABCD cycle after the
audit folded its findings into the phase docs; phases were small enough that one
B pass covered the audited roadmap — recorded as a deliberate collapse, not a skip).

## Shipped (3 atomic commits)

- `dc4cade` Phase 1: `setBindingWorkdir` (db.ts), `runOne` execs in
  `binding.workdir || req.workdir`, mid-turn guard skips `setBindingThread` when
  the workdir changed during the turn (audit major 2 — also fixes /reset's race).
  fake-codex gained `FAKE_CODEX_ECHO_CWD` (audit major 1).
- `70d47c2` Phase 2: `/cwd` — show current; set with `~` expansion +
  `realpathSync` + `isDirectory` validation; rejection changes nothing and never
  creates directories; success repoints binding + clears thread (session reset).
  Registered in setMyCommands + /help.
- `3738b39` Phase 3: `/delete` two-step confirm (`deleteConfirmTtlMs` seam,
  60s default) → `deleteBindingCascade` (transactional) + allowlist removal;
  forum-topic invocations also call new `TelegramApi.deleteForumTopic`
  (best-effort, failure still wipes local state). makeFetch gained per-method
  overrides. Fixed heartbeat fixture (`/x` fake workdir → real cwd) — the one
  regression the new exec-cwd semantics surfaced.

## Evidence

- Tests: 151 pass / 0 fail across all 20 suites (per-file runs; full-run tap
  reporter wedges on runner hang-mode suite — pre-existing harness quirk).
  New coverage: 2 agent-service (cwd echo), 6 /cwd, 5 /delete, 2 db.
- Build: `npm run build` → 88 files compiled, layout validated.

## What did not improve / open edges (LOOP-PESSIMIST-01)

- No allowed-roots confinement: paired chat = full-permission exec anywhere an
  existing dir is named. Accepted by user decision (000); revisit if exposure changes.
- Private-DM `/delete` cannot clear the visible Telegram history (no Bot API for
  it) — only bot-side state. Reply wording reflects this.
- Pending-delete flag is chat-scoped, so topic A's prompt can be confirmed from
  topic B of the same supergroup (audit finding 8, accepted).
- Discord has no /cwd //delete parity (declared non-goal).
- Per-topic sessions (message_thread_id in the binding key) remain the natural
  next unit; this cycle deliberately kept the binding key untouched.
