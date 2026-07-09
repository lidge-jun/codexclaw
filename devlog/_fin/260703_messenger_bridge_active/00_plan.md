# messenger_bridge — Overall plan (slice map MOC)

Status: ALL 9 PHASES SHIPPED (2026-07-03) · class C3 overall, security slice C4
· multi-work-phase: one full PABCD cycle per phase, each D-closed.

Progress: ①serve+SQLite ②exec runner (live memory continuity proven) ③Telegram
④Discord ⑤connect/manage API ⑥GUI foundation ⑦GUI channels+agents ⑧service
daemon ⑨ security hardening (5 gaps fixed: codex flag-injection + 4 from
dev-security review) — all SHIPPED. messenger-bridge suite 65/65, GUI 8/8,
build+gate+doctor PASS, live codex e2e green.

Accepted residual (Phase 9): Discord has no persisted per-message offset like
Telegram's poll_offset, so a crash mid-turn during a gateway RESUME could in
principle redeliver a MESSAGE_CREATE (Telegram's full-perm replay is closed).
Lower risk (Discord only replays after the acked seq within a session, not on a
fresh identify); message-id dedup is a possible follow-up if it matters.

## Part 1 — what will be built (plain)

codexclaw grows a resident bridge server (`cxc serve`) that connects chat
messengers to stock Codex. Both Telegram and Discord adapters ship; the GUI
activates exactly one at a time. Each chat room auto-binds 1:1 to its own Codex
session: the first message spawns `codex exec --json` with the default model,
the thread id is captured and persisted in SQLite, and every following message
resumes that session (`codex exec resume`). Sessions that hit context limits
auto-compact and continue. All runs are full-permission
(`--dangerously-bypass-approvals-and-sandbox`), so the /start-handshake chat
allowlist and token custody are the security boundary and get a dedicated
hardening phase. The GUI is overhauled to production grade (dev-uiux-design +
dev-frontend discipline) and gains a Channels connect wizard (paste token →
Connect → "press /start" spinner → pass/fail) and an Agents management view.
`cxc service` installs serve as a background daemon. `cxc gui` stays a separate
command; serve exposes API + GUI static on one port (single origin).

## Architecture sketch

```
Telegram (grammY, long-poll) ─┐                       ┌─ codex exec --json (new)
Discord (discord.js, gateway) ─┤→ cxc serve ──────────┤
        [one active channel]  │   ├ allowlist gate    └─ codex exec resume <id>
GUI (Vite build, static) ─────┘   ├ per-chat serial queue      │
        └ /api (connect wizard,   ├ SQLite (bindings, tokens,  └ ~/.codex rollouts
          agents, SSE status)     │  allowlist, job log)          (shared with
                                  └ exec runner (JSONL parser)     interactive codex)
```

New component: `plugins/codexclaw/components/messenger-bridge/` (src+dist+test
convention). CLI: `serve` + `service` subcommands registered in
`bin/codexclaw.mjs` delegator. GUI work in `plugins/codexclaw/gui/`.

## Work-phase slice map (one PABCD cycle each; decade docs)

| Phase | Doc | Outcome (user-visible exit criteria) |
| --- | --- | --- |
| 1 serve + state | `10_phase1-serve-state.md` | `cxc serve` boots one port serving GUI static + /api/health; SQLite substrate with schema v1 (channels, allowlist, bindings, jobs); state survives restart |
| 2 exec runner | `20_phase2-exec-runner.md` | Library API: send(prompt, binding) → spawns exec/resume, parses JSONL, captures thread id, serializes per binding, auto-compact config; unit tests incl. failure/re-seed |
| 3 Telegram adapter | `30_phase3-telegram-adapter.md` | Message in an allowlisted Telegram chat gets a Codex reply with typing + status edits; /start handshake registers chat; 409 defense |
| 4 Discord adapter | `40_phase4-discord-adapter.md` | Same contract on Discord (DM + guild channel); one-active-channel rule enforced at serve level |
| 5 connect/manage API | `50_phase5-connect-api.md` | /api endpoints: token validate, handshake wait (SSE), channel activate/deactivate, bindings list/detail; curl-driveable end to end |
| 6 GUI foundation | `60_phase6-gui-foundation.md` | Production shell: routing, design tokens, nav, UX states (loading/empty/error); Subagents page migrated with no regression |
| 7 GUI channels + agents | `70_phase7-gui-channels-agents.md` | Connect wizard (token → Connect → /start spinner → pass/fail retry/close); Agents view listing chat↔session bindings with status; channel switch |
| 8 service daemon | `80_phase8-service-daemon.md` | `cxc service install/uninstall/status` (launchd), log files, serve auto-restart; docs |
| 9 hardening | `90_phase9-hardening.md` | dev-security review of C4 slice (token custody, allowlist, full-perm exec), failure drills (token revoke, 409, sqlite recovery/compaction), e2e pass |

Order rationale: runner before adapters (adapters are thin over one contract);
GUI foundation before GUI wizard (connect UX built once on the new shell);
hardening last but security constraints stated per-phase from the start.

## Contracts (draft, finalized in each phase's P)

- SQLite (better-sqlite3): `channels(id, kind, token_enc, active, created_at)`,
  `allowlist(channel_id, chat_id, label, added_at)`,
  `bindings(id, channel_id, chat_id, thread_id, workdir, model, status, updated_at)`,
  `jobs(id, binding_id, prompt_preview, result_preview, state, thread_id, started_at, ended_at, error)`
  — result_preview feeds the Phase 2 re-seed fallback.
- Runner events (from `codex exec --json` JSONL): `thread.started` → persist
  thread_id; `item.*` → status line stream (adapter renders typing/status
  edits); `turn.completed`/`turn.failed` → final text / error reply.
- Adapter interface: `init(config)`, `shutdown()`, `onMessage(binding, text, meta)`,
  `send(target, chunks, status?)` — Telegram/Discord implement the same shape
  (cli-jaw `registerTransport` pattern, simplified).

## Dependencies — ZERO new runtime deps (decision 2026-07-03)

The build system compiles components with Node built-in type-stripping and is
"sound only because every component has zero third-party runtime deps and
imports only node:* + relative ./x.ts" (`plugins/codexclaw/scripts/build.mjs:6-8`).
Adding grammy/discord.js/better-sqlite3 would force a bundler switch. Instead,
Node 24 built-ins cover everything (verified on v24.14.1, 2026-07-03):

- SQLite → `node:sqlite` `DatabaseSync` (works; prints ExperimentalWarning —
  cosmetic, documented) replaces better-sqlite3.
- Telegram → raw Bot API over global `fetch` (getMe, getUpdates long poll,
  sendMessage, sendChatAction, editMessageText) replaces grammy. The needed
  grammy behaviors (per-chat serialization, allowlist, 409 defense) are
  hand-rolled from the cli-jaw reference patterns.
- Discord → global `WebSocket` client (gateway identify/heartbeat/dispatch)
  + REST over `fetch` replaces discord.js.

This keeps the repo's no-toolchain/no-network build philosophy intact and
dissolves the dependency-approval question (nothing to approve).

## Interpretation flags to confirm at approval

1. "sqlite 자동 압축후 지속" implemented as: codex auto-compact via
   `-c model_auto_compact_token_limit` on every spawn + unrecoverable-resume
   fallback (new thread seeded with summarized history), binding survives.
2. Serve/GUI single-port topology (Q5 default adopted).
3. Full-permission runs accepted → allowlist strictness: ONLY /start-handshaked
   chat ids, no wildcard, group chats require @mention (cli-jaw parity).

## Risks

- Remote full-perm code execution: mitigations = allowlist-only ingress, token
  custody in SQLite with file perms 600, no token in logs, Phase 9 review.
- better-sqlite3 native build friction on some machines → prebuild check in
  doctor (cxc-ops) during Phase 1.
- Discord gateway intents (message content) need bot-portal toggles → document
  in Phase 4; connect wizard must surface misconfig clearly.
- One-active-channel invariant lives at serve level, not GUI, so CLI/API abuse
  cannot double-poll (Telegram 409s guard this too).
