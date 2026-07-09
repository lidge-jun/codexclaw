# Cycle-2 Audit Synthesis — wp3 (Gateway Commands) + wp9 (Webhook Mode)

Date: 2026-07-07. Auditor: independent gpt-5.5-xhigh "Heisenberg".
Round 1 FAIL (6 blockers, 2 advisories) -> AMENDMENT A2 -> round 2 PASS.
Cycle shape: ONE worker ("Avicenna"), wp3 then wp9 sequentially; main session
pre-landed db.ts v6 so the worker's set is db-free.

## Main-session pre-work (P phase, diff level)
- db.ts v6 migration: `ALTER TABLE bindings ADD effort TEXT NOT NULL DEFAULT
  'default'`; `ADD topic_id TEXT`; `CREATE INDEX idx_bindings_topic(channel_kind,
  chat_id, topic_id)`; `ALTER TABLE agents ADD full_access INTEGER NOT NULL
  DEFAULT 1`; `ADD webhook_url TEXT NOT NULL DEFAULT ''` (BEGIN/COMMIT guarded,
  user_version 5->6).
- BindingRow += effort, topic_id; AgentRow += full_access, webhook_url; AgentPatch
  + updateAgent column allowlist += full_access, webhook_url.
- New accessors setBindingModel(id, model) / setBindingEffort(id, effort) next to
  setBindingWorkdir. Test: db-migration.test.ts "v6: ..." (13/13 green).
- Rationale: wp3 needs binding model/effort setters, wp4 needs topic_id, wp6 needs
  full_access, wp9 needs webhook_url — landing all four in ONE migration keeps
  every later worker out of db.ts (no migration-array merge conflicts).

## Accepted blockers -> A2 decisions
1. WP3 spec drift: cycle 1 already extracted command dispatch; unification is now
   AROUND a new gateway-commands.ts (neutral handlers), platform files keep
   rendering + platform-only commands (/start /id /delete TG; slash defs DC).
2. /model + /effort wrote the AGENT card at six call sites; switch to binding
   setters (chat-level override, matches OpenClaw per-conversation settings).
3. runOne resolution order: binding non-default > agent non-default > default.
4. cancelTurn: reuse RunTurnOptions.register seam (runner.ts:39/:171) with a
   binding-keyed registry in AgentService; /stop finally becomes real.
5. ApiRoute table is exact-match under /api/ and handlers cannot see headers ->
   webhook needs a prefix dispatch BEFORE the table with raw req access.
6. bridge-controller reload diffing ignores webhook_url -> RunningAdapter tracks
   mode; registration failure falls back to long-poll + lifecycle error event.
7. telegram-api lacks setWebhook -> add with secret_token + allowed_updates;
   dedup via existing poll_offset; 200 only after enqueue; turn must not block
   the response (enqueue-only seam over handleIncoming).

## Incident log (cycle 1, carried for the record)
- Orphaned repo-wide `node --test` from a worker degraded spawn-based tests.
- macOS syspolicyd cached a SIGKILL verdict for test/fixtures/fake-codex.mjs
  (unsigned script exec under Gatekeeper pressure; shell exec 137, node exec ok).
  Fixes: fixture inode swap + hermetic runner.ts guard (script bins spawn via
  process.execPath). Suite deterministic since: 194/0.
