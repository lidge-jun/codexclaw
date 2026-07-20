# messenger-bridge — Multi-thread progress UX (Hermes-level parity roadmap)

Status: HOTL loop active · class C3 · WP0 docs cycle locked 2026-07-20

## Roadmap (locked at WP0 D; APPEND-friendly per LOOP-UNIT-CHAIN-01)

Goal: bring every attended Telegram/Discord ingress to Hermes-agent-level
progress UX (ack → coalesced tool/status progress → edited response → durable
final; silent intermediates, notifying finals). Dependency-ordered work-phase
map (one full PABCD cycle each):

| Work-phase | Decade doc | Deliverable | Depends on |
|------------|-----------|-------------|------------|
| WP1 | `010_phase1_thread_progress_ux.md` | Shared Telegram progress controller; webhook/long-poll/`/retry` wiring; Discord `!cxc retry` embed | — (foundation: renderer + event plumbing) |
| WP2 | `020_phase2_discord_interaction_progress.md` | Slash `/ask` `/review` + component retry progress via interaction-token edits | WP1 (event surface patterns, shared doctrine) |
| WP3 | `030_phase3_tool_progress_modes.md` | `agents.tool_progress` setting (off/new/all/verbose) + command/API surface + renderer gating + notification policy | WP1/WP2 (gates the renderers they ship) |
| WP4 | `040_phase4_lifecycle_signals.md` | Telegram pin-triggering-message during turn; Discord reactions lifecycle (running/done/error) | WP1 (turn lifecycle hooks) |

Grounding facts verified at WP0 P (2026-07-20):
- `telegram-api.ts` has NO pin methods → WP4 adds
  `pinChatMessage`/`unpinChatMessage` (Bot API methods exist upstream).
- `discord-api.ts` has NO reaction methods → WP4 adds
  `createReaction`/`deleteOwnReaction`
  (`PUT|DELETE /channels/:c/messages/:m/reactions/:emoji/@me`).
- `discord-api.ts:155-160` already has `editOriginalInteractionResponse`
  (`PATCH /webhooks/:app/:token/messages/@original`) → WP2 builds on it.
- `db.ts` agents migrations use idempotent `ALTER TABLE ADD COLUMN` (latest:
  v8 `thread_mode` at :399) → WP3 adds v9 `tool_progress` the same way.

Subagent policy (user directive 2026-07-20): sol medium + priority tier for
ALL dispatches, including A-gate reviewers (supersedes REVIEW-DECORRELATE-01
for this loop; the main agent compensates with direct anchor verification
at C).

## WP0 A-phase amendments (folded blockers, VERDICT: GO-WITH-FIXES blockers=8)

All eight are mandatory content requirements for the decade docs:

1. [High] Migration version: v9 already exists (`agent_pairing_codes`,
   `db.ts:411-432`). 030 must use v10+. Migrations are version-guarded
   (`if (version < N)`), NOT intrinsically idempotent — no `IF NOT EXISTS`.
2. [High] 020 must mandate an interaction-token expiry handoff: Discord
   tokens die at 15 min; queue+turn can exceed that. Design: pre-expiry
   (~14 min) edit the original to point at a bot-authenticated channel
   progress message, continue/finalize via `sendMessage`/`editMessage`.
   Webhook followup is NOT a post-expiry fallback. Every edit/defer result
   must be checked (current helpers discard `DiscordApiResult`,
   `discord-interactions.ts:96-107`).
3. [Med] Phase-dependency correction: WP2 does not consume WP1's Telegram
   controller (Discord already has `createProgressWindow`,
   `discord-adapter.ts:334-377`). WP1/WP2 are parallel renderer phases; the
   real contract is that 010 and 020 must EACH declare a mode-gating
   extension seam + declared default so WP3 gates renderers without a
   retrofit. Roadmap order kept (foundation-first), dependency column read
   as "shared doctrine", not code dependency.
4. [High] 030 cannot ship 4 meaningful modes by renderer gating alone:
   `RunnerEvent.tool_call` has no lifecycle phase/call-id/result, and
   `parseExecEvent` maps `item.started` and `item.completed` to the same
   event (`runner.ts:111-123`). 030 MUST include a runner-event schema +
   parser change (phase, stable call id, completion/result summary) as its
   first work item, or explicitly redefine modes below Hermes parity.
5. [Med] 030 surface list (mandatory): db.ts (AgentRow/AgentPatch/enum/v10
   migration/updateAgent allowlist), agent-routes.ts (publicAgent + PATCH
   validation), gateway-commands.ts (registry + /status + setter),
   telegram-commands.ts + telegram-interactive.ts (registration/picker),
   discord-commands.ts choices (+ discord-components/interactions if
   interactive), every attended renderer (WP1 Telegram controller, Discord
   progress window, WP2 interaction progress, retry paths), and tests for
   each. connect-routes.ts and cli.ts explicitly OUT (recorded decision).
6. [Med] 040 Telegram pin rules: requires admin `can_pin_messages`; pin
   with `disable_notification: true`; unpin the EXACT owned message_id
   (omission unpins the most recent pin — forbidden); cleanup in `finally`
   for success/error/cancel/queue-reject/shutdown; define behavior when the
   message was already pinned before the turn; account for overlapping
   queued turns in one topic (progress starts before `handleIncoming`
   resolves).
7. [Med] 040 Discord reaction rules: scope to gateway messages ONLY (the
   local `Interaction` model has no user-message id,
   `discord-interactions.ts:32-39`); target the ORIGINAL message
   (`msg.id`/`msg.channelId`), never `replyChannelId` when auto-threading;
   URL-encoded emoji; best-effort transitions (add running → in `finally`
   remove running + add exactly one terminal done/error); reaction failure
   must never mask turn delivery; test partial failures.
8. [Med] DIFFLEVEL-ROADMAP-01 applies to ALL decade docs: 020/030/040 must
   each name exact NEW/MODIFY files+functions, before/after behavior,
   activation scenarios, failure cleanup, tests, and manual verification —
   outline-only docs are an A-gate FAIL.

## Original loop-spec header (WP0 docs cycle)

## Loop-spec header

- **Loop archetype:** spec-satisfaction (docs deliverable)
- **Trigger:** user report — in Telegram multi-thread (topic/thread) mode, no
  intermediate response and no tool-use visibility; Discord status unknown.
- **Goal:** a devlog unit that (a) pins the RCA with verbatim code anchors,
  (b) records verified external patterns (NousResearch/hermes-agent,
  openai/codex, Telegram Bot API constraints, comparable bots), and
  (c) delivers a diff-level Phase-1 design doc for fixing thread-mode
  progress UX.
- **Non-goals:** implementing the fix (future unit), switching the runner to
  codex app-server, Discord redesign beyond a parity assessment.
- **Verifier:** docs exist at the numbered paths, carry verbatim anchors/URLs,
  and the 010 doc names exact NEW/MODIFY targets with activation scenarios.
- **Stop condition:** both docs written and reviewed; A-gate pass or
  near-pass with residuals recorded.
- **Memory artifact:** this unit folder.
- **Expected terminal outcomes:** DONE (docs complete) or BLOCKED (external
  claims unverifiable — did not happen; research returned VERDICT: COMPLETE).

## Work-phase map (dependency-ordered)

This unit is a single docs work-phase; document order is the build order:

| Doc | Range | Purpose |
|-----|-------|---------|
| `000_plan.md` | 000 | this plan |
| `001_research.md` | 000 | RCA + external survey, no diffs |
| `010_phase1_thread_progress_ux.md` | 010 | Phase-1 implementation design, diff-level |

## RCA summary (to be expanded with verbatim anchors in 001)

Two Telegram ingress paths behave differently in thread/topic mode:

1. `telegram-webhook.ts` (`acceptMessage`, ~line 158): `onEvent` is wired
   ONLY when `msg.chat.type === "private"`. In group/supergroup topics the
   turn runs with `onEvent: undefined` — every runner event (thinking,
   tool_call, file_change, partial message) is silently dropped. This is the
   primary match for the reported symptom.
2. `telegram-adapter.ts` (`runTurn`, ~line 297): `draftStreaming =
   richSupported && msg.chat.type === "private"`; the group/topic fallback is
   a single `🔄` status message coalesced at 1.5s, capped at the last 5 tool
   lines, and deleted at turn end — weak but non-zero progress.
3. Draft streaming cannot be extended to groups: Bot API draft methods
   (`sendMessageDraft` 9.3+, `sendRichMessageDraft`) require a private-chat
   numeric user id as `chat_id` (verified against core.telegram.org).
4. Discord (`discord-adapter.ts` `progressFromEvent`) already renders stage
   embeds (Thinking/Coding/Writing) — different, healthier path; parity
   assessment only.

## External findings (sol-medium research subagent, VERDICT: COMPLETE)

- `NousResearch/hermes-agent`: deterministic session keys per DM/group/topic,
  concurrent per-user sessions, `display.tool_progress` modes
  (off/new/all/verbose), one coalesced status bubble edited in place, silent
  intermediate notifications (`important` mode), pin-triggering-message
  pattern, Discord reactions lifecycle.
- `openai/codex`: thread/turn/item model; `codex exec --json` emits
  thread.started / item.started / item.updated / item.completed /
  turn.completed (no agent-message deltas; those live in app-server
  `item/agentMessage/delta`). Current `exec --json` is sufficient for
  tool-status UX; token-level streaming would require app-server.
- Telegram constraints: drafts private-only + 30s ephemeral; documented
  output limits (1 msg/s per chat, 20/min in groups); `retry_after` on 429;
  no published numeric edit-rate limit — throttle conservatively.
- Comparable bots (OpenClaw, opencode-telegram-bot, untether, OpenACP):
  converge on one editable/pinned status surface per turn, transient progress
  kept separate from the durable final answer.

## Scope boundary

- **IN:** the three docs above; verbatim anchors; design alternatives with a
  chosen direction; rate-limit budget; activation scenarios per conditional
  path; Discord parity note.
- **OUT:** any `src/` change, app-server migration, new dependencies.

## Accept criteria

1. `001_research.md` — every local claim has `path:line` anchor; every
   external claim has URL + quote; unverified items labeled.
2. `010_phase1_thread_progress_ux.md` — names exact NEW/MODIFY files and
   functions, before/after behavior, activation scenario for each new
   conditional path (group vs private, webhook vs adapter, 429 backoff),
   and a verification plan (tests + manual topic-mode checklist).
3. LEXICO-SPLIT-01: numbered docs only; research contains no diffs; design
   doc contains no survey padding.

## A-phase amendments (folded blockers, reviewer VERDICT: GO-WITH-FIXES blockers=4)

1. [Med] Discord progress must be scoped BY INGRESS: message-gateway path has
   stage embeds (`discord-adapter.ts:432`), but slash/interaction turns
   (`/ask`, `/review`, interaction-retry via `discord-commands.ts:249`
   `runTurnFromInteraction`, reached from `discord-interactions.ts:156`) pass
   NO `onEvent` — zero progress on the primary command surface. 001 needs the
   split; 010 must state in/out scope for interaction turns.
2. [Med] `/retry` (`gateway-commands.ts:371` `handleRetry`, reached from
   `telegram-commands.ts:132`) runs a full turn with no `onEvent` on both
   platforms. 001's ingress inventory must include it; it bypasses even the
   adapter's weak status fallback.
3. [Low] State the runtime-mode asymmetry: `bridge-controller.ts` selects
   webhook (~`:223`) vs long-poll adapter (~`:249`) per agent, mutually
   exclusively — webhook groups drop all events, long-poll groups get the
   weak 🔄 bubble. 001 must pin which mode reproduces "nothing at all".
4. [Low] Anchor precision: the onEvent gate is `telegram-webhook.ts:158`
   (`acceptMessage` is defined at `:94`). 001 must use exact claim lines.

Accept-criteria addition: 001 must contain an EXHAUSTIVE ingress table —
every `handleIncoming`/`enqueueIncoming` caller, its platform, and whether
`onEvent` is wired (heartbeat.ts:133 autonomous turns are the documented
exception).
