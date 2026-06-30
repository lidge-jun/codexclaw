# L1 / 010 — Parity Audit: `$ + hook` Chat-Driven PABCD Control

Status: DONE · 2026-06-30 · parity audit complete; feeds L2+ hardening loops

> Source: two parallel read-only research dispatches (gpt-5.5 parity auditor + cross-reference
> researcher) against cli-jaw, jawcode, and lazycodex/omo. All findings are file:line backed.
> Goal: map what it takes to give codexclaw a **user-drivable PABCD control surface in chat**,
> using the codex-native `$cxc-*` mention + hook + `cxc` CLI model only (no codex-rs fork,
> no server runtime).

## The core finding

codexclaw already owns every **primitive** (FSM `transition()`, attest validation, per-session
file state, ledger, directive-injection hook) but has **no wire** connecting a user command to a
real phase transition. The current `UserPromptSubmit` hook detects loose triggers (`plan this`,
`orchestrate p`) and injects a directive, but it never calls `transition()` and never changes
`state.phase` — it only flips `orchestrationActive`/`lastInjectedPhase`
([hook.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/hook.ts:189)).
So "the agent is told to act like it's in Plan" but the state machine itself never moves. That is
the parity gap.

## A. cli-jaw user-drivable surface (the parity target)

- `jaw orchestrate <I|P|A|B|C|D|status|reset>` — full phase set + status + reset, as a server CLI
  ([bin/commands/orchestrate.ts](/Users/jun/Developer/new/700_projects/cli-jaw/bin/commands/orchestrate.ts:14)).
- `/orchestrate` (alias `/pabcd`) chat slash command across cli/web/telegram/discord
  ([src/cli/commands.ts](/Users/jun/Developer/new/700_projects/cli-jaw/src/cli/commands.ts:272)); handler covers STATUS/RESET/phases
  ([handlers-runtime.ts](/Users/jun/Developer/new/700_projects/cli-jaw/src/cli/handlers-runtime.ts:447)).
- Explicit legal transition table: `IDLE->I|P`, `I->P|IDLE`, `P->I|A`, `A->I|B`, `B->I|C`,
  `C->I|D|B|P`, `D->I|IDLE`
  ([state-machine.ts](/Users/jun/Developer/new/700_projects/cli-jaw/src/orchestrator/state-machine.ts:600)).
- Agent evidence gate on ALL four forward transitions `P>A, A>B, B>C, C>D`; `C>D` also needs
  `checkOutput` and rejects non-zero `exitCode`
  ([attestation.ts](/Users/jun/Developer/new/700_projects/cli-jaw/src/orchestrator/attestation.ts:36)).
- Human vs agent split: verified boss token = agent (gated); no token = human (free pass)
  ([routes/orchestrate.ts](/Users/jun/Developer/new/700_projects/cli-jaw/src/routes/orchestrate.ts:803)).
- State lives in `jaw.db` `orc_state`; CLI and server share one DB. (codexclaw equivalent = files.)

## B. codexclaw today

Present primitives:
- State shape with `phase`/flags/`orchestrationActive`, persisted at `.codexclaw/sessions/<id>.json`;
  `appendLedger()` exists ([state.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/state.ts:18)).
- Pure FSM `transition()` flips `auditPassed` on A>B, `checkPassed` on C>D, resets on D>IDLE
  ([fsm.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/fsm.ts:78)).
- Attest validation exists but only gates A>B and C>D
  ([attest.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/attest.ts:27)).
- Directive-injection hook + passive continuation
  ([hook.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/hook.ts:224)).

Not wired / not parity:
- No command parses a transition and calls `transition()+writeState()+appendLedger()`.
- No `D`, `status`, or phase-`reset` chat affordance in `detectTrigger()`.
- `canEnter("A")`/`canEnter("C")` are unconditionally true — no adjacency table, so `IDLE->A`
  type jumps are not blocked the way cli-jaw blocks them
  ([fsm.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/fsm.ts:8)).
- `cxc` CLI has no `orchestrate` subcommand; its `reset` is cxc-ops file cleanup, not a phase reset
  ([bin/codexclaw.mjs](/Users/jun/Developer/new/700_projects/codexclaw/bin/codexclaw.mjs:56),
  [reset.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/cxc-ops/src/reset.ts:52)).
- Stop hook is a no-op — no continuation loop yet
  ([hook.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/hook.ts:247)).

## C. The serverless precedent (omo / jawcode) — the template to copy

omo proves the exact `$ + hook` pattern works with no server. Each hook is a short Node process:
read stdin JSON, read/write a file, print one JSON line.

1. Entry: UserPromptSubmit matches a trigger and emits
   `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":<directive>}}`,
   guarded by context-pressure bail + transcript-dedup so it injects exactly once
   ([ultrawork/codex-hook.ts](/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/ultrawork/src/codex-hook.ts:31)).
2. Durable state in files (`.omo/boulder.json` status `active|paused|completed` + plan checklist +
   `ledger.jsonl`); nothing runs between turns
   ([boulder-reader.ts](/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/start-work-continuation/src/boulder-reader.ts:76)).
3. Continuation: Stop hook returns `{"decision":"block","reason":<rendered next-step directive>}`
   to keep the agent going, and returns `""` (allow stop) when `stop_hook_active` is set OR
   `checklist.remaining === 0`. Those **two termination guards** are the non-obvious must-copy:
   without them the Stop-block loop either never ends or never starts
   ([start-work-continuation/codex-hook.ts](/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/start-work-continuation/src/codex-hook.ts:6)).
   jawcode independently lands on the same shape (`buildSkillStopOutput` returns null to release,
   blocks otherwise — [skill-state.ts](/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/hooks/skill-state.ts:578)) — strong cross-confirmation.
4. Steering: an inline token in the user prompt mutates the plan file under a lock with idempotency
   dedup, rejecting "weaken tests / mark complete" payloads
   ([ulw-loop/steering.ts](/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/ulw-loop/src/steering.ts:232)).

## D. Gap list → hardening loops (ranked)

Must-have for chat-driven parity (proposed L2-L6):

1. `$cxc-orchestrate` command grammar — parse `$cxc-orchestrate <I|P|A|B|C|D|status|reset>
   [--attest <json>]` from the submitted prompt. New parser module + `hook.ts`. Mirrors
   `jaw orchestrate <phase>`. (Inline-token style like omo's steering token, since the hook can
   only append context, not swallow the turn.)
2. Wire the command to the FSM — `readState() -> transition() -> writeState() -> appendLedger()
   -> emit directive/status`. This is the missing wire.
3. Legal transition table in `fsm.ts` — port cli-jaw `VALID_TRANSITIONS`; stop target-only
   `canEnter()` from allowing illegal jumps.
4. Full four-transition attest gate (`P>A, A>B, B>C, C>D`) for agent-driven transitions
   (currently only A>B, C>D).
5. Human free-pass vs agent-gated split — chat-submitted `$cxc-orchestrate X` = free pass;
   `cxc orchestrate X` invoked by the agent/tool = gated, `--attest` required for forward moves.
   (Codex has no boss-token equivalent, so the discriminator must be invocation-source, not a token.)
6. `D` / `status` / phase-`reset` chat affordances; `reset` returns phase to IDLE + ledger entry
   (distinct from cxc-ops file cleanup).
7. `cxc orchestrate <phase|status|reset> [--session][--cwd][--attest][--json]` CLI writing the
   same `.codexclaw` state (new `pabcd-state/src/orchestrate-cli.ts`, wired in `bin/codexclaw.mjs`).
8. Stop-continuation loop with the two omo termination guards (`stop_hook_active` + remaining/idle).
9. Ledger entry on every successful transition (chat or CLI) — `appendLedger()` is currently unused.

Nice-to-have:
- `--json` status formatting.
- `skills/pabcd/SKILL.md` rewrite: document `$cxc-orchestrate` + `cxc orchestrate` (it currently
  says "no external phase commands") and fix the stale `.codexclaw/state.json` path (real path is
  `.codexclaw/sessions/<id>.json`).

## Non-goals (server-only — explicitly fenced off)

Do NOT chase these; they fundamentally need a live server/process and have no codex-native form:
- jaw employee dispatch / virtual employees (codexclaw uses codex subagents instead).
- live build budgets, broadcast/event-bus, `bgtask` durable background work.
- server-side prompt interception that *replaces/swallows* a user turn (hooks can only append
  context or block a stop).
- progrok / web-AI search tiers (already removed in `cxc-search`; do not re-add).
- codex `/`-slash commands (hardcoded Rust enum; not plugin-extensible).

## Proposed loop decomposition (to be split into 020+ docs)

- L2 / 020 — FSM legal-transition table + four-transition attest gate (`fsm.ts`, `attest.ts`).
- L3 / 030 — `$cxc-orchestrate` grammar + hook wiring via `applyHumanTransition()` (the missing wire).
- L4 / 040 — `cxc orchestrate` CLI over the same file state.
- L5 / 050 — `status` / `reset` / `D` affordances + ledger-on-transition.
- L6 / 060 — Stop-continuation loop with omo termination guards.
- L7 / 070 — human free-pass vs agent-gated discriminator + skill-doc rewrite.
