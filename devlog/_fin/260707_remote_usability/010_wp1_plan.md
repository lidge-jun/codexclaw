# WP1 Plan — cxc-remote skill (agent-driven remote setup ladder)

Date: 2026-07-07. Phase: P (cycle 1 of goal loop).

## Why

The functional gap matrix vs OpenClaw/Hermes closed in
`260707_messenger_bridge_native_commands` (wp1-wp9, 257 tests). The remaining
gap is ACCESS: Hermes-level usability means the user says "텔레그램 연결해줘"
and the agent performs setup end-to-end. codexclaw's idiom for that is a skill.

## Deliverables

- `plugins/codexclaw/skills/remote/SKILL.md` — front-matter (name `cxc-remote`,
  description with EN+KO triggers, `metadata.short-description`) following
  sibling conventions (see `skills/recall/SKILL.md`, `skills/search/SKILL.md`).
- `references/telegram.md` — TG setup ladder.
- `references/discord.md` — DC setup ladder.
- `references/troubleshooting.md` — distilled incident/ops knowledge.

## Grep-verified surface inventory (2026-07-07)

Skill may reference ONLY these; anything else is an invented surface (C-gate FAIL).

### CLI (`src/cli.ts`)
- `messenger-bridge serve [--port <n>] [--cwd <path>]` — boots HTTP server, GUI + JSON API.
- `messenger-bridge service <install|uninstall|status> [--port <n>]` — daemon management.

### HTTP API (`src/connect-routes.ts`)
- `POST /api/connect/validate` — token check (TG `getMe` / DC `users/@me` via `token-validate.ts`).
- `POST /api/connect/activate`, `POST /api/connect/deactivate`
- `POST /api/connect/handshake/open`, `GET /api/connect/handshake/status` — pairing window.
- `GET /api/channels`, `GET /api/bindings`, `GET /api/bindings/jobs`

### Messenger command surface (`gateway-commands.ts`, `telegram-commands.ts`, `discord-commands.ts`)
- Shared gateway verbs: status, sessions, jobs, agent, context, new, reset,
  cwd, model, effort, stop, retry, approve, mode, help.
- TG-only: start (allowUnpaired), id (allowUnpaired), pause, resume, kick, delete.
- DC native slash commands incl. options: prompt, review target, jobs limit,
  `/model [id|list|reset]`, `/cwd [path|reset]`.

### Validation internals (`token-validate.ts`)
- `validateToken(kind, token)` → TG `TelegramApi.getMe()`, DC `DiscordApi.getMe()`.

## Skill design

SKILL.md = router + setup ladder skeleton; per-platform detail in references.
Ladder shape (agent-followed, each step has a verify command):

1. Preflight: bridge serve/service status; GUI URL (default port 7717).
2. Token acquisition guidance (BotFather / Discord Developer Portal) — the ONLY
   human-required steps; everything after is agent-run.
3. Validate: `POST /api/connect/validate` (never echo the token into logs).
4. Activate channel: `POST /api/connect/activate`.
5. Pair: handshake/open → user sends `/start` in TG (or DC slash command
   registration + invite URL guidance) → handshake/status poll.
6. Smoke: confirm binding via `GET /api/bindings`; test message via the
   channel's own command surface (`/status`).
7. Troubleshooting router → references/troubleshooting.md.

troubleshooting.md distills from `260707_messenger_bridge_native_commands`:
429/retry_after handling, webhook vs long-poll (webhook opt-in, dual
timing-safe secret), permission gate semantics (full_access=0 pre-turn gate,
10min fail-closed, /approve fallback), forum-topic/thread session scoping,
DC 3s ack/defer-first, idle sweep + archive semantics.

## Out of scope (wp1)

No code changes to messenger-bridge; no new endpoints (that is wp2); no README
(wp3 — references may point forward with a relative path but must not assume
its existence for correctness).

## Verification (C-gate inputs)

- Grep table: every command/endpoint mentioned in skill files exists in src.
- Front-matter parity with sibling skills.
- Adversarial review by fresh subagent: invented surfaces, secret-leak
  guidance, steps without verify commands, KO/EN trigger coverage.

## AMENDMENT A1 (post-audit, 2026-07-07)

Audit round 1 FAIL (11 findings, see 020_wp1_audit_synthesis.md). Inventory
and ladder above are SUPERSEDED where they conflict with the synthesis:

- All mutating API examples carry `content-type: application/json` +
  `x-codexclaw-local: 1` (403 otherwise).
- Primary surface = named-agent API `/api/agents/*` (list/create/update/
  enable/delete/handshake open+status/statuses); `/api/connect/*` is legacy.
- CLI = `cxc serve` / `cxc service install|uninstall|status`; liveness via
  `GET /api/health`; launchd cwd foot-gun warned.
- DC pairing = invite (scope=bot&permissions=3072) + Message Content intent +
  handshake open + `!cxc start` text trigger + status poll. Slash commands
  reject unpaired channels.
- TG webhook = agent `webhookUrl` (HTTPS, `/webhook/telegram/<secret>`),
  fallback long-poll.
- Front-matter adopts `metadata.last-verified`.
