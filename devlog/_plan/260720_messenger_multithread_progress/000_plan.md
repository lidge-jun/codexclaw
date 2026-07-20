# messenger-bridge — Multi-thread progress UX (research + design)

Status: P (plan) · class C3 · docs-only cycle (no runtime code changes in this unit)

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
