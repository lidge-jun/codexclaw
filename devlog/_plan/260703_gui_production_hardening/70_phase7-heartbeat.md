# 70 — Phase 7: per-agent heartbeat (DOD 6)

- Class: C3 (new autonomous spend-generating loop) · A: employee audit.
- GUI fields (minutes + prompt) landed in slice 60; agents.heartbeat_* columns in 40.

## Part 1 — plain

Each agent can run a periodic task: every N minutes the serve process feeds the
agent its heartbeat prompt in its own codex session and forwards the answer to the
paired chat — silently skipping when the agent reports nothing (HEARTBEAT_OK), is
busy, unpaired, disabled, or has auto-send off.

## Part 2 — diff-level

### NEW `src/heartbeat.ts` — `HeartbeatScheduler`
- Single MASTER interval (default 60s, injectable `tickMs` + `now()` for tests) —
  no per-agent timer diffing, no reload plumbing: every tick reads agents FRESH.
- Per agent, a tick runs when ALL hold (else skip, each with a distinct log/skip
  reason): `enabled=1` · `heartbeat_minutes>0` · `heartbeat_prompt` non-empty ·
  `auto_send=1` (off = the run would go nowhere — skip entirely, no token spend) ·
  ≥1 paired chat in agent_allowlist · `now - lastRun >= minutes` (lastRun is
  in-memory; restart = one fresh interval before the first run) · the target
  binding is not `running` (skip-if-busy: never stack heartbeats behind a live turn).
- Target = FIRST paired chat (v1); the turn runs through the SHARED AgentService
  (`handleIncoming({agentId, chatId, text: prompt})`) so model/effort/binding
  serialization all apply exactly like a user message.
- Silence convention: result text whose trimmed form contains `HEARTBEAT_OK` or
  starts with `[SILENT]` is NOT forwarded (run still recorded in jobs).
- Forwarding: injectable `send(agent, chatId, text)`; default = TelegramApi
  (markdownToTelegramHtml + chunk, HTML fallback plain) / DiscordApi
  (chunkDiscordMessage), same rendering as the adapters.
- `start()` / `stop()` (clearInterval; in-flight tick finishes naturally).

### MODIFY `src/bridge-controller.ts`
- `service(): AgentService` getter (creates lazily, same instance reload uses) so
  the scheduler shares the child registry and queues.

### MODIFY `src/cli.ts` (serve)
- After the boot `controller.reload()`: `scheduler = new HeartbeatScheduler({db,
  service: () => controller.service(), workdir, log})`; `scheduler.start()`;
  shutdown stops scheduler → controller → server.

### Tests — NEW `test/heartbeat.test.ts` (fake codex bin + captured send)
- due agent runs and forwards (send captured with chatId + text)
- `HEARTBEAT_OK` reply suppressed (send NOT called; job recorded)
- auto_send=0 → no run at all · unpaired → no run · disabled → no run
- busy binding (status running) → skipped this tick
- interval respected: second tick before N minutes → no second run

## Risks
- Token spend loop: every gate above fails CLOSED (skip). Master tick is 60s of
  sqlite reads only when idle.
- lastRun in memory: a crash-looping serve could run heartbeats more often than
  N minutes — bounded by one run per process boot; acceptable v1 (documented).
