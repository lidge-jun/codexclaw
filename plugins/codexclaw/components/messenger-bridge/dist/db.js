/**
 * db.ts — bridge state substrate (messenger-bridge Phase 1).
 *
 * One SQLite database per project at `<cwd>/.codexclaw/bridge.db`, opened with
 * node:sqlite DatabaseSync (zero third-party deps, per the build soundness
 * contract in scripts/build.mjs). The file holds bot tokens, so it is chmod
 * 600 on open. Transactions use exec BEGIN/COMMIT/ROLLBACK — DatabaseSync has
 * no transaction() helper (A-audit finding 1; convention:
 * components/recall/src/ingest.ts).
 *
 * Schema v1 (PRAGMA user_version = 1):
 *   channels  — one row per messenger kind; single-active invariant enforced
 *               by setActiveChannel's transaction.
 *   allowlist — chat ids admitted via the /start (or Discord) handshake.
 *   bindings  — chat ↔ codex thread 1:1 (UNIQUE channel_kind+chat_id).
 *   jobs      — per-turn run log; result_preview feeds the Phase 2 re-seed.
 */
import { DatabaseSync } from "node:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";






























/** One named agent: a dedicated bot token + per-agent settings card (v4). */





























export const AGENT_EFFORTS = ["default", "minimal", "low", "medium", "high", "xhigh"]         ;























const SCHEMA_V1 = `
CREATE TABLE channels (
  kind TEXT PRIMARY KEY CHECK (kind IN ('telegram','discord')),
  token TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE allowlist (
  channel_kind TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  added_at TEXT NOT NULL,
  PRIMARY KEY (channel_kind, chat_id)
);
CREATE TABLE bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_kind TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  thread_id TEXT,
  workdir TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'idle',
  updated_at TEXT NOT NULL,
  UNIQUE (channel_kind, chat_id)
);
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  binding_id INTEGER NOT NULL,
  prompt_preview TEXT NOT NULL,
  result_preview TEXT,
  state TEXT NOT NULL DEFAULT 'queued',
  thread_id TEXT,
  error TEXT,
  started_at TEXT,
  ended_at TEXT,
  created_at TEXT NOT NULL
);
`;

function nowIso()         {
  return new Date().toISOString();
}

const JOB_PATCH_COLUMNS = [
  "state",
  "thread_id",
  "error",
  "result_preview",
  "started_at",
  "ended_at",
]         ;

export class BridgeDb {
          db              ;

  constructor(file        ) {
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.migrate();
  }

          migrate()       {
    const row = this.db.prepare("PRAGMA user_version").get()

                 ;
    let version = row?.user_version ?? 0;
    if (version < 1) {
      this.db.exec("BEGIN");
      try {
        this.db.exec(SCHEMA_V1);
        this.db.exec("PRAGMA user_version = 1");
        this.db.exec("COMMIT");
      } catch (err) {
        this.db.exec("ROLLBACK");
        throw err;
      }
      version = 1;
    }
    if (version < 2) {
      // v2: handshake window on channels (Phase 3 /start pairing).
      this.db.exec("BEGIN");
      try {
        this.db.exec("ALTER TABLE channels ADD COLUMN handshake_open_until TEXT");
        this.db.exec("PRAGMA user_version = 2");
        this.db.exec("COMMIT");
      } catch (err) {
        this.db.exec("ROLLBACK");
        throw err;
      }
      version = 2;
    }
    if (version < 3) {
      // v3: persist the getUpdates offset so a crash/restart never redelivers
      // an already-processed update (would replay a full-permission exec).
      this.db.exec("BEGIN");
      try {
        this.db.exec("ALTER TABLE channels ADD COLUMN poll_offset INTEGER NOT NULL DEFAULT 0");
        this.db.exec("PRAGMA user_version = 3");
        this.db.exec("COMMIT");
      } catch (err) {
        this.db.exec("ROLLBACK");
        throw err;
      }
      version = 3;
    }
    if (version < 4) {
      // v4: named agents (dedicated bot token + settings per agent).
      //  - agents: one row per named agent.
      //  - agent_allowlist: separate table — the legacy allowlist keeps its
      //    PRIMARY KEY (channel_kind, chat_id) AND its ON CONFLICT upsert
      //    compatibility (a rebuild would break the v3 dist in the downgrade
      //    window, plan 260703_gui_production_hardening/40 rev 3).
      //  - bindings: REBUILT — the legacy UNIQUE(channel_kind, chat_id) would
      //    reject two same-kind agents binding one chat. New key is
      //    UNIQUE(agent_id, chat_id); a partial index preserves legacy-row
      //    uniqueness (NULL agent_id) for the downgrade window. Row ids are
      //    copied verbatim so jobs.binding_id keeps joining.
      //  - seed: each token-bearing channels row becomes agent "<kind>-1";
      //    its allowlist rows are COPIED into agent_allowlist and its bindings
      //    adopted via agent_id backfill.
      this.db.exec("BEGIN");
      try {
        this.db.exec(`
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
CREATE TABLE agent_allowlist (
  agent_id INTEGER NOT NULL,
  chat_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  added_at TEXT NOT NULL,
  PRIMARY KEY (agent_id, chat_id)
);
CREATE TABLE bindings_v4 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_kind TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  agent_id INTEGER,
  thread_id TEXT,
  workdir TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'idle',
  updated_at TEXT NOT NULL,
  UNIQUE (agent_id, chat_id)
);
INSERT INTO bindings_v4 (id, channel_kind, chat_id, agent_id, thread_id, workdir, model, status, updated_at)
  SELECT id, channel_kind, chat_id, NULL, thread_id, workdir, model, status, updated_at FROM bindings;
DROP TABLE bindings;
ALTER TABLE bindings_v4 RENAME TO bindings;
CREATE UNIQUE INDEX idx_bindings_legacy_uniq ON bindings (channel_kind, chat_id) WHERE agent_id IS NULL;
`);
        const seeded = this.db
          .prepare("SELECT kind, token, active, poll_offset FROM channels WHERE token != ''")
          .all()                                                                                          ;
        for (const ch of seeded) {
          const res = this.db
            .prepare(
              `INSERT INTO agents (name, kind, token, enabled, poll_offset, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(`${ch.kind}-1`, ch.kind, ch.token, ch.active, ch.poll_offset, nowIso(), nowIso());
          const agentId = Number(res.lastInsertRowid);
          this.db
            .prepare(
              `INSERT INTO agent_allowlist (agent_id, chat_id, label, added_at)
               SELECT ?, chat_id, label, added_at FROM allowlist WHERE channel_kind = ?`,
            )
            .run(agentId, ch.kind);
          this.db
            .prepare("UPDATE bindings SET agent_id = ? WHERE channel_kind = ?")
            .run(agentId, ch.kind);
        }
        this.db.exec("PRAGMA user_version = 4");
        this.db.exec("COMMIT");
      } catch (err) {
        this.db.exec("ROLLBACK");
        throw err;
      }
      version = 4;
    }
  }

  // ── channels ──────────────────────────────────────────
  getChannel(kind             )                    {
    const row = this.db
      .prepare("SELECT kind, token, active, updated_at FROM channels WHERE kind = ?")
      .get(kind)                          ;
    return row ?? null;
  }

  setChannelToken(kind             , token        )       {
    this.db
      .prepare(
        `INSERT INTO channels (kind, token, active, updated_at) VALUES (?, ?, 0, ?)
         ON CONFLICT(kind) DO UPDATE SET token = excluded.token, updated_at = excluded.updated_at`,
      )
      .run(kind, token, nowIso());
  }

  /** Activate one channel and deactivate every other; null deactivates all. */
  setActiveChannel(kind                    )       {
    this.db.exec("BEGIN");
    try {
      this.db.prepare("UPDATE channels SET active = 0, updated_at = ?").run(nowIso());
      if (kind !== null) {
        const updated = this.db
          .prepare("UPDATE channels SET active = 1, updated_at = ? WHERE kind = ?")
          .run(nowIso(), kind);
        if (updated.changes === 0) {
          throw new Error(`cannot activate "${kind}": no token saved for that channel yet`);
        }
      }
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  /** Open a handshake window for `seconds`; /start within it admits a chat. */
  openHandshake(kind             , seconds        )       {
    const until = new Date(Date.now() + seconds * 1000).toISOString();
    // Ensure a channel row exists so a handshake opened before a token is saved
    // is not silently a no-op (the UPDATE would match zero rows).
    this.db
      .prepare("INSERT INTO channels (kind, updated_at) VALUES (?, ?) ON CONFLICT(kind) DO NOTHING")
      .run(kind, nowIso());
    this.db
      .prepare("UPDATE channels SET handshake_open_until = ?, updated_at = ? WHERE kind = ?")
      .run(until, nowIso(), kind);
  }

  isHandshakeOpen(kind             )          {
    const row = this.db
      .prepare("SELECT handshake_open_until FROM channels WHERE kind = ?")
      .get(kind)                                                       ;
    const until = row?.handshake_open_until;
    if (!until) return false;
    return new Date(until).getTime() > Date.now();
  }

  closeHandshake(kind             )       {
    this.db
      .prepare("UPDATE channels SET handshake_open_until = NULL, updated_at = ? WHERE kind = ?")
      .run(nowIso(), kind);
  }

  getPollOffset(kind             )         {
    const row = this.db
      .prepare("SELECT poll_offset FROM channels WHERE kind = ?")
      .get(kind)                                       ;
    return row?.poll_offset ?? 0;
  }

  setPollOffset(kind             , offset        )       {
    this.db.prepare("UPDATE channels SET poll_offset = ? WHERE kind = ?").run(offset, kind);
  }

  getActiveChannel()                    {
    const row = this.db
      .prepare("SELECT kind, token, active, updated_at FROM channels WHERE active = 1")
      .get()                          ;
    return row ?? null;
  }

  // ── allowlist ─────────────────────────────────────────
  addAllowlist(kind             , chatId        , label        )       {
    this.db
      .prepare(
        `INSERT INTO allowlist (channel_kind, chat_id, label, added_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(channel_kind, chat_id) DO UPDATE SET label = excluded.label`,
      )
      .run(kind, chatId, label, nowIso());
  }

  isAllowed(kind             , chatId        )          {
    const row = this.db
      .prepare("SELECT 1 AS ok FROM allowlist WHERE channel_kind = ? AND chat_id = ?")
      .get(kind, chatId);
    return row !== undefined;
  }

  listAllowlist(kind             )             {
    return this.db
      .prepare(
        "SELECT channel_kind, chat_id, label, added_at FROM allowlist WHERE channel_kind = ? ORDER BY added_at",
      )
      .all(kind)                         ;
  }

  removeAllowlist(kind             , chatId        )       {
    this.db
      .prepare("DELETE FROM allowlist WHERE channel_kind = ? AND chat_id = ?")
      .run(kind, chatId);
  }

  // ── bindings ──────────────────────────────────────────
  getOrCreateBinding(kind             , chatId        , workdir        )             {
    const existing = this.db
      .prepare("SELECT * FROM bindings WHERE channel_kind = ? AND chat_id = ?")
      .get(kind, chatId)                          ;
    if (existing) return existing;
    this.db
      .prepare(
        "INSERT INTO bindings (channel_kind, chat_id, workdir, updated_at) VALUES (?, ?, ?, ?)",
      )
      .run(kind, chatId, workdir, nowIso());
    return this.db
      .prepare("SELECT * FROM bindings WHERE channel_kind = ? AND chat_id = ?")
      .get(kind, chatId)                         ;
  }

  setBindingThread(id        , threadId        )       {
    this.db
      .prepare("UPDATE bindings SET thread_id = ?, updated_at = ? WHERE id = ?")
      .run(threadId, nowIso(), id);
  }

  clearBindingThread(id        )       {
    this.db
      .prepare("UPDATE bindings SET thread_id = NULL, updated_at = ? WHERE id = ?")
      .run(nowIso(), id);
  }

  setBindingStatus(id        , status        )       {
    this.db
      .prepare("UPDATE bindings SET status = ?, updated_at = ? WHERE id = ?")
      .run(status, nowIso(), id);
  }

  getBinding(id        )                    {
    const row = this.db.prepare("SELECT * FROM bindings WHERE id = ?").get(id)

                 ;
    return row ?? null;
  }

  listBindings()               {
    return this.db
      .prepare("SELECT * FROM bindings ORDER BY updated_at DESC")
      .all()                           ;
  }

  // ── agents (v4) ───────────────────────────────────────
  createAgent(name        , kind             , token        )           {
    const res = this.db
      .prepare(
        `INSERT INTO agents (name, kind, token, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(name, kind, token, nowIso(), nowIso());
    return this.getAgent(Number(res.lastInsertRowid))            ;
  }

  getAgent(id        )                  {
    const row = this.db.prepare("SELECT * FROM agents WHERE id = ?").get(id)

                 ;
    return row ?? null;
  }

  getAgentByName(name        )                  {
    const row = this.db.prepare("SELECT * FROM agents WHERE name = ?").get(name)

                 ;
    return row ?? null;
  }

  listAgents()             {
    return this.db.prepare("SELECT * FROM agents ORDER BY id").all()                         ;
  }

  /** Column-allowlisted patch (same pattern as updateJob). Throws on UNIQUE name clash. */
  updateAgent(id        , patch            )                  {
    const columns = [
      "name",
      "token",
      "model",
      "effort",
      "auto_send",
      "mention_only",
      "heartbeat_minutes",
      "heartbeat_prompt",
    ]         ;
    const sets           = [];
    const values                         = [];
    for (const col of columns) {
      const value = patch[col];
      if (value !== undefined) {
        sets.push(`${col} = ?`);
        values.push(value);
      }
    }
    if (sets.length > 0) {
      sets.push("updated_at = ?");
      values.push(nowIso());
      values.push(id);
      this.db.prepare(`UPDATE agents SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    }
    return this.getAgent(id);
  }

  setAgentEnabled(id        , enabled         )       {
    this.db
      .prepare("UPDATE agents SET enabled = ?, updated_at = ? WHERE id = ?")
      .run(enabled ? 1 : 0, nowIso(), id);
  }

  /**
   * Delete a disabled agent and everything it owns in ONE transaction:
   * agent_allowlist rows, its bindings, and those bindings' jobs. Never
   * re-parents bindings to legacy (a NULL agent_id row would pollute the
   * legacy lookup). Throws while the agent is enabled.
   */
  deleteAgent(id        )       {
    const agent = this.getAgent(id);
    if (!agent) return;
    if (agent.enabled) throw new Error(`cannot delete enabled agent "${agent.name}" — disable it first`);
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare("DELETE FROM jobs WHERE binding_id IN (SELECT id FROM bindings WHERE agent_id = ?)")
        .run(id);
      this.db.prepare("DELETE FROM bindings WHERE agent_id = ?").run(id);
      this.db.prepare("DELETE FROM agent_allowlist WHERE agent_id = ?").run(id);
      this.db.prepare("DELETE FROM agents WHERE id = ?").run(id);
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  addAgentAllowlist(agentId        , chatId        , label = "")       {
    this.db
      .prepare(
        `INSERT INTO agent_allowlist (agent_id, chat_id, label, added_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(agent_id, chat_id) DO UPDATE SET label = excluded.label`,
      )
      .run(agentId, chatId, label, nowIso());
  }

  isAgentAllowed(agentId        , chatId        )          {
    const row = this.db
      .prepare("SELECT 1 AS ok FROM agent_allowlist WHERE agent_id = ? AND chat_id = ?")
      .get(agentId, chatId);
    return row !== undefined;
  }

  listAgentAllowlist(agentId        )             {
    return this.db
      .prepare(
        "SELECT ? AS agent_id, chat_id, label, added_at FROM agent_allowlist WHERE agent_id = ? ORDER BY added_at",
      )
      .all(agentId, agentId)                         ;
  }

  /** Lookup-first by (agent_id, chat_id); the UNIQUE key is the race backstop. */
  getOrCreateAgentBinding(agentId        , kind             , chatId        , workdir        )             {
    const existing = this.db
      .prepare("SELECT * FROM bindings WHERE agent_id = ? AND chat_id = ?")
      .get(agentId, chatId)                          ;
    if (existing) return existing;
    this.db
      .prepare(
        "INSERT INTO bindings (channel_kind, chat_id, agent_id, workdir, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(kind, chatId, agentId, workdir, nowIso());
    return this.db
      .prepare("SELECT * FROM bindings WHERE agent_id = ? AND chat_id = ?")
      .get(agentId, chatId)                         ;
  }

  openAgentHandshake(id        , seconds        )       {
    const until = new Date(Date.now() + seconds * 1000).toISOString();
    this.db
      .prepare("UPDATE agents SET handshake_open_until = ?, updated_at = ? WHERE id = ?")
      .run(until, nowIso(), id);
  }

  isAgentHandshakeOpen(id        )          {
    const row = this.db
      .prepare("SELECT handshake_open_until FROM agents WHERE id = ?")
      .get(id)                                                       ;
    const until = row?.handshake_open_until;
    if (!until) return false;
    return new Date(until).getTime() > Date.now();
  }

  closeAgentHandshake(id        )       {
    this.db
      .prepare("UPDATE agents SET handshake_open_until = NULL, updated_at = ? WHERE id = ?")
      .run(nowIso(), id);
  }

  setAgentPollOffset(id        , offset        )       {
    this.db.prepare("UPDATE agents SET poll_offset = ? WHERE id = ?").run(offset, id);
  }

  // ── jobs ──────────────────────────────────────────────
  createJob(bindingId        , promptPreview        )         {
    const res = this.db
      .prepare("INSERT INTO jobs (binding_id, prompt_preview, created_at) VALUES (?, ?, ?)")
      .run(bindingId, promptPreview.slice(0, 500), nowIso());
    return Number(res.lastInsertRowid);
  }

  updateJob(id        , patch          )       {
    const sets           = [];
    const values                         = [];
    for (const col of JOB_PATCH_COLUMNS) {
      const value = patch[col];
      if (value !== undefined) {
        sets.push(`${col} = ?`);
        values.push(col === "result_preview" ? value.slice(0, 500) : value);
      }
    }
    if (sets.length === 0) return;
    values.push(id);
    this.db.prepare(`UPDATE jobs SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  }

  getJob(id        )                {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(id)

                 ;
    return row ?? null;
  }

  listJobs(bindingId        , limit = 20)           {
    return this.db
      .prepare("SELECT * FROM jobs WHERE binding_id = ? ORDER BY id DESC LIMIT ?")
      .all(bindingId, limit)                       ;
  }

  close()       {
    this.db.close();
  }
}

/** Open (creating if needed) the project-scoped bridge DB with 600 perms. */
export function openBridgeDb(cwd        )           {
  const dir = join(cwd, ".codexclaw");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "bridge.db");
  const db = new BridgeDb(file);
  // Restrict the DB and its WAL/SHM sidecars — all can hold token-bearing pages
  // (security review finding 3). The -wal/-shm files exist after migration
  // writes under WAL mode; chmod each best-effort.
  for (const target of [file, `${file}-wal`, `${file}-shm`]) {
    try {
      chmodSync(target, 0o600);
    } catch {
      // absent sidecar or non-POSIX platform — keep default perms
    }
  }
  return db;
}
