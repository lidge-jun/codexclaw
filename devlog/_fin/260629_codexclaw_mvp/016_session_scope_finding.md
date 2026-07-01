# 016 — State Scoping: per-SESSION, not per-instance/cwd (Finding C)

Status: RESEARCH (source-verified)  ·  Phase 1 · affects 018/022.1
Trigger (jun): cli-jaw state is per-INSTANCE (server-owned). codex is per-SESSION. How to record
IPABCD state so parallel sessions in the same repo do not clobber each other?

## Source ground truth
- omo (`components/lazycodex-executor-verify/src/state.ts`): state path =
  `join(cwd, ".omo", "<component>", sanitize(sessionId) + "-" + sanitize(agentId) + ".json")`.
  `session_id` + `agent_id` come from the hook payload. sanitizeKey strips to [A-Za-z0-9._-].
  Write = tmp(`pid.now.tmp`) + rename (atomic). Missing/corrupt → safe default.
- jawcode/gjc (`docs/memory-jwc.md`, `docs/session-switching-*`): sessions live at
  `~/.jwc/agent/sessions/<encoded-cwd>/<ts>_<uuidv7>.jsonl` — per-cwd dir, per-session file.
- codex runtime: `~/.codex/sessions/YYYY/MM/DD/*.jsonl`; hook payload carries `session_id`,
  `turn_id`, `cwd`, `transcript_path` (verified earlier in hooks/src/events).

## Decision (Finding C resolution)
IPABCD phase state is **session-scoped**, stored in the working tree (gitignored), omo-style:
- State file: `<cwd>/.codexclaw/sessions/<sanitize(sessionId)>.json`  (one phase-state per session).
- Ledger: `<cwd>/.codexclaw/ledger.jsonl` — SHARED append-only, each entry tagged with `sessionId`
  (unified cross-session audit trail for the repo).
- `sessionId` is supplied by the caller (Pass 2 hook reads `session_id` from payload). Pass 1 state
  module takes it as a parameter.

### agentId — NOT part of IPABCD phase key (differs from omo)
- omo keys by agentId because executor-verify tracks per-SUBAGENT retry counts.
- IPABCD phase is owned by the orchestrating SESSION; subagents (explorer/reviewer/executor) do NOT
  drive phase transitions. So phase state = sessionId only. (If a future per-subagent counter is
  needed, add an agentId-keyed file then — not now.)

### Why working-tree `.codexclaw/` (not `~/.codex/...`)
- Keeps IPABCD state next to the repo it describes; matches omo's `<cwd>/.omo`; already gitignored.
- Survives across turns of the same session; isolated per session via the filename key.

## Open (non-blocking)
- Q-SCOPE-1: stale-session GC (old `sessions/*.json`). Defer; cheap cleanup later.
- Q-SCOPE-2: if codex ever runs the same session across two cwds, state follows cwd (acceptable —
  IPABCD is repo-local). No action.
