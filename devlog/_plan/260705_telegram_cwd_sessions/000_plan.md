# telegram_cwd_sessions — Remote workdir control on the global Telegram adapter

Status: P · class C3 (public command surface + persistence, promoted from C2)
Unit: devlog/_plan/260705_telegram_cwd_sessions/ (UNIT-RESIDENCE-01)
Base: messenger-bridge v4 (agents runtime, 730+ tests green), E1-E6 shipped.

## Loop-spec header

- **Loop archetype:** spec-satisfaction (verifier = `npm test` + targeted adapter tests)
- **Trigger:** user request — one global adapter steering exec cwd from chat
- **Goal:** `/cwd <path>` sets the per-chat exec working directory (valid existing
  dir only — never created), `/cwd` shows it, `/delete` tears the chat down
  (binding + jobs + allowlist; topic chats also delete the forum topic).
- **Non-goals:** per-topic sessions (message_thread_id in binding key), allowed-roots
  confinement policy, Discord parity, createForumTopic lifecycle, webhook mode.
- **Verifier:** `npm test` in components/messenger-bridge (node --test), all suites.
- **Stop condition:** all phases D-closed, suite green, no regression.
- **Memory artifact:** this unit's docs.
- **Expected terminal outcomes:** DONE.
- **Escalation condition:** schema migration breaking v4 data, or security posture
  change beyond "paired chat may point exec at any existing local dir" → ask user.

## Decision record (from Interview turns)

- User explicitly chose: valid-path-or-reject (`유효한 경로면 거기에 exec 아니면 파지 않기`)
  — NO directory creation, NO allowed-roots restriction requested. The bot already
  runs `fullAccess: true` for paired chats; `/cwd` widens *where*, not *what*.
  Recorded as accepted risk; revisit if a root-allowlist is requested.
- "챗 삭제" = clear the bot-side session state; for forum-topic chats Telegram
  can really delete the room (`deleteForumTopic`); for private DMs the Bot API
  has no clear-history call (research: 001), so /delete = state teardown + confirmation.

## Dependency-ordered phase map (PHASE-SPLIT-01)

| Phase | Doc | Depends on | Delivers |
|-------|-----|-----------|----------|
| 1 | 010 | — | Binding-level workdir as the exec source of truth (db setter + agent-service reads binding.workdir) |
| 2 | 020 | 1 | `/cwd` command: show/set with tilde expansion + realpath existence validation |
| 3 | 030 | 1 | `/delete` command: binding+jobs+allowlist teardown, deleteForumTopic for topic chats |

Each phase closes with `npm test` green + new targeted tests.

## SoT sync target (SOT-SYNC-01)

`devlog/_plan/260703_messenger_bridge_active/00_plan.md` family is the bridge SoT
lineage; the C phase patches `devlog/_fin/mvp_res/` STATUS notes if present, else
records the surface change in this unit's D summary. Command list in adapter
`setMyCommands` + `/help` text are in-code SoT and MUST be updated in the same
phase that adds a command.
