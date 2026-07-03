# 40 — Phase 4: named-agent entity + schema migration (DOD 3 prereq) — REV 2

- Class: C3 (schema migration + new public API surface; persistence risk) ·
  A: independent audit REQUIRED (rev 1 audit: FAIL, 7 findings — all applied below).
- Interview decisions binding this design (01_interview_findings.md):
  agent = {name, dedicated bot token, channel kind, model, effort, auto-send,
  mention-only, heartbeat} · NO per-agent workdir (shared serve cwd) · bot token
  per agent (N pollers, no routing table).

## Part 1 — plain

Introduce the "agent" as a first-class DB entity with its own bot token and settings.
Storage + API only: the old single-channel flow keeps working untouched; the
multi-adapter runtime (50) and the GUI cards (60) build on it.

## Part 2 — diff-level (rev 2, audit findings applied)

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/db.ts`

Migration v4 — same ladder pattern as v1-v3 (`if (version < 4)` + manual
BEGIN/COMMIT/ROLLBACK + `PRAGMA user_version = 4` inside the tx):

1. `CREATE TABLE agents` (audit fix #3: handshake column in the DDL, not a note):
   ```sql
   CREATE TABLE agents (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL UNIQUE,
     kind TEXT NOT NULL CHECK (kind IN ('telegram','discord')),
     token TEXT NOT NULL DEFAULT '',
     enabled INTEGER NOT NULL DEFAULT 0,
     model TEXT NOT NULL DEFAULT 'default',
     effort TEXT NOT NULL DEFAULT 'default'
       CHECK (effort IN ('default','minimal','low','medium','high','xhigh')),
     auto_send INTEGER NOT NULL DEFAULT 1,
     mention_only INTEGER NOT NULL DEFAULT 1,
     heartbeat_minutes INTEGER NOT NULL DEFAULT 0,
     heartbeat_prompt TEXT NOT NULL DEFAULT '',
     poll_offset INTEGER NOT NULL DEFAULT 0,
     handshake_open_until TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   ```
2. `ALTER TABLE allowlist ADD COLUMN agent_id INTEGER;` (nullable; legacy rows keep
   channel_kind semantics).
3. **REBUILD `bindings`** (audit fix #1 — SQLite can't drop the legacy
   `UNIQUE(channel_kind, chat_id)`, which would reject a second same-kind agent
   binding the same chat):
   ```sql
   CREATE TABLE bindings_v4 (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     channel_kind TEXT NOT NULL,
     chat_id TEXT NOT NULL,
     agent_id INTEGER,                -- NULL = legacy single-channel binding
     thread_id TEXT,
     workdir TEXT NOT NULL,
     model TEXT NOT NULL DEFAULT 'default',
     status TEXT NOT NULL DEFAULT 'idle',
     updated_at TEXT NOT NULL,
     UNIQUE (agent_id, chat_id)       -- NULL agent_id rows: SQLite treats NULLs as
   );                                 -- distinct → legacy dedupe stays lookup-first
   INSERT INTO bindings_v4 (id, channel_kind, chat_id, agent_id, thread_id, workdir, model, status, updated_at)
     SELECT id, channel_kind, chat_id, NULL, thread_id, workdir, model, status, updated_at FROM bindings;
   DROP TABLE bindings;
   ALTER TABLE bindings_v4 RENAME TO bindings;
   CREATE INDEX idx_bindings_kind_chat ON bindings (channel_kind, chat_id);
   ```
   - `jobs.binding_id` keeps pointing at the SAME id space (ids copied verbatim) —
     one bindings+jobs pipeline for legacy and agent flows alike; no agent_jobs fork.
   - Old v3 dist on a v4 file (downgrade window): `getOrCreateBinding` is
     lookup-first-then-INSERT with explicit columns → still works; it only loses the
     redundant unique safety net (audit finding #2 confirmed old reads/writes survive).
4. Seed: for each channels row with a non-empty token → insert agent `"<kind>-1"`
   (token, enabled = channels.active, poll_offset = channels.poll_offset,
   handshake NULL, timestamps now); backfill `allowlist.agent_id` and
   `bindings.agent_id` for rows of that kind to the seeded agent's id.
5. New `AgentRow` interface + CRUD (validated column allowlist for updates, same
   pattern as `updateJob`): `createAgent`, `getAgent`, `getAgentByName`, `listAgents`,
   `updateAgent`, `deleteAgent` (refuses while enabled), `setAgentEnabled`,
   per-agent allowlist (`addAgentAllowlist`/`isAgentAllowed`/`listAgentAllowlist`),
   `getOrCreateAgentBinding(agentId, kind, chatId, workdir)` (writes channel_kind AND
   agent_id), per-agent handshake open/is-open/close, `setAgentPollOffset`.

### NEW `plugins/codexclaw/components/messenger-bridge/src/token-validate.ts`
(audit fix #4 — `validateToken` is currently module-local in connect-routes.ts:27-36)
- Move the existing `validateToken(kind, token)` here, export it; `connect-routes.ts`
  imports it (behavior identical); `agent-routes.ts` accepts an injectable
  `validate` dep defaulting to it (tests stub the dep, no network).

### NEW `plugins/codexclaw/components/messenger-bridge/src/agent-routes.ts`
- Registry-shaped routes (server.ts ApiRoute: exact method+path, handler(ctx, body, url));
  controller optional (GUI-only mode tolerated):
  - `GET  /api/agents` → `{ agents: [{id,name,kind,hasToken,enabled,model,effort,autoSend,mentionOnly,heartbeatMinutes,heartbeatPrompt,allowlistCount}] }` — token NEVER returned (parity with /api/channels hasToken).
  - `POST /api/agents` `{name, kind, token}` → validate name/kind/token (validator dep) → createAgent (enabled=0).
  - `POST /api/agents/update` `{id, ...patch}` — effort validated against the enum; token change re-validates via dep.
  - `POST /api/agents/delete` `{id}` → 400 while enabled.
  - `POST /api/agents/enable` `{id, enabled}` → flips flag (runtime reload lands in 50).
  - `POST /api/agents/handshake/open` `{id, seconds}` / `GET /api/agents/handshake/status?id=`.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/server.ts`
- `baseRoutes()` appends `agentRoutes()`.

### Effort column consumer contract (audit fix #6 — concrete, wired in slice 60)
- `RunTurnOptions.effort?: string \| null` → `buildExecArgs` appends
  `["-c", "model_reasoning_effort=<effort>"]` when effort && effort !== 'default'.
- Flow: agents.effort → (50) adapter passes agent → AgentService `runOne` passes
  binding's agent effort → runner. API layer enforces the enum (DDL CHECK is the
  backstop). Slice 60 doc stub records this contract; the column is not dead schema —
  its consumer is specified and scheduled.

### Tests
- NEW `test/agent-store.test.ts`: fresh-db v4 migration; v3→v4 seed (drive a real
  BridgeDb at v3 by re-creating the ladder state via a fixture db built with the
  CURRENT code path? no — build a v3 file by executing the v1-v3 SQL directly +
  `PRAGMA user_version = 3`, then open with BridgeDb to trigger only v4); CRUD;
  enabled-delete refusal; allowlist/binding backfill; per-agent handshake;
  **negative test (audit fix #7): two same-kind agents bind the SAME chat_id —
  both bindings coexist (no UNIQUE collision), while the same agent re-binding the
  same chat stays idempotent.**
- NEW `test/agent-routes.test.ts`: CRUD via handlers with stubbed validator;
  token-leak assertion (response JSON stringified contains no token substring);
  effort enum rejection; delete-while-enabled 400.
- MODIFY `test/db.test.ts` expectations only if the bindings rebuild changes
  observable behavior (it should not — assert suite stays green).

### Migration rehearsal (audit fix #5 — WAL-safe procedure, live file never touched)
1. Live db (verified via lsof): `/Users/jun/Developer/new/700_projects/jawcode/.codexclaw/bridge.db`
   with active WAL/SHM held by PID 4518.
2. Safe copy: `sqlite3 <live>/bridge.db ".backup /tmp/cxc-rehearse/bridge.db"`
   (online backup API takes a read lock and folds WAL pages in — plain `cp` is
   forbidden while the writer is live).
3. Open the copy with the NEW BridgeDb → assert: user_version 4; agent telegram-1
   seeded with hasToken/enabled/poll_offset; allowlist row backfilled; binding
   backfilled with preserved id; jobs rows intact and still joined by binding_id.
4. Delete the rehearsal copy afterwards (it contains a real bot token; 0600 perms).

## Risks
- Live serve keeps the v3 dist until the user restarts it; migration of the real
  file happens on that restart. Rebuild-of-bindings runs inside one tx — rollback
  restores v3 on any failure.
- Token exposure: rehearsal copy handled 0600 + deleted; API responses expose
  hasToken only.
