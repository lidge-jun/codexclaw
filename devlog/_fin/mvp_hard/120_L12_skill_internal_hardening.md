# L12 / 120 - Skill Internal Hardening + Continuous Interview Contract

Status: DONE (skill surfaces validated; Interview runtime shipped via 121/122) - 2026-06-30 - mvp_hard loop L12

> L11 is already occupied by developer docs + website planning. This loop uses
> L12 to avoid overwriting that track. Install/deploy/npx/symlink work is moved
> to L20 / 200.

## Interview Decisions

The user selected these defaults during the Interview phase:

- Goal model: persistent contradiction loop.
- Control surface: main-session-owned Interview loop, assisted by hooks.
- Canonical runtime evidence: session-scoped append-only interview ledger at
  `.codexclaw/interviews/<sessionId>.jsonl`.
- Human-readable evidence: append each round to this devlog plan.
- Answer capture: `PostToolUse` auto-capture for `request_user_input`.
- Stop guard: block only when I phase has a pending question or high contradiction.
- Question owner: subagents produce contradiction/question candidates; the main
  session aggregates and asks 1-3 focused questions.
- Scan cadence: rerun contradiction scan after every answer round.
- L split: L12 validates and reconciles the discoverable skill surfaces; runtime
  capture/guard lands in later loops.
- Skill surface set: `cxc-interview`, `cxc-orchestrate`, `cxc-loop`,
  `cxc-goalplan`.
- I->P policy: user can explicitly transition; agent can auto-advance only in
  mode-guarded HOTL/goal/loop contexts after the exit gate passes.
- Exit gate: no pending question and no high contradiction; medium/low
  contradictions must be recorded as OPEN ASSUMPTIONS.

## Findings Integrated

Parallel read-only explorers found the same core gaps:

1. `InterviewTracker` is bounded and fail-closed, but it has no durable
   question/answer history or pending-question model.
2. `request_user_input` is prompted by `hook.ts`, but no `PostToolUse` recorder
   currently captures the question/options/answer.
3. `minds.ts` and `triage.ts` provide contradiction primitives, but no continuous
   main-session loop wires dispatch -> triage -> question -> record -> rescan.
4. `pabcd/SKILL.md` previously had stale `.codexclaw/state.json` and "no external
   phase commands" wording; live state is session-scoped, chat orchestrate wiring
   exists after L3, and terminal `cxc orchestrate` exists after L4.
5. `$cxc-interview`, `$cxc-orchestrate`, `$cxc-loop`, and `$cxc-goalplan` now exist
   as discoverable, on-demand Codex skill surfaces with `agents/openai.yaml` metadata.

## Scope

### Completed In L12

- Validate and reconcile four existing on-demand skill surfaces:
  - `plugins/codexclaw/skills/interview/`
  - `plugins/codexclaw/skills/orchestrate/`
  - `plugins/codexclaw/skills/loop/`
  - `plugins/codexclaw/skills/goalplan/`
- Confirm skill catalog, skill README, and `structure/INDEX.md` already expose the
  current on-demand surfaces after L11 reconciliation.
- Confirm `pabcd/SKILL.md` and `cxc-orchestrate` describe live chat + terminal
  phase control, including `D` as a close-to-IDLE transition.
- Update `mvp_hard/000_INDEX.md`:
  - preserve L11 docs-site track,
  - mark skill surface reconciliation complete at L12,
  - move install/deploy hardening to L20.

### Out Of L12

- No `PostToolUse` hook implementation.
- No `.codexclaw/interviews/<sessionId>.jsonl` writer implementation.
- No narrow I-phase Stop guard for pending/high Interview work.
- No new `cxc orchestrate` CLI implementation; the existing L4 CLI is live and
  only documented/reconciled here.
- No new goal database; `cxc-goalplan` intentionally reuses host Codex goal state
  and records discipline/evidence, while loop arming remains the shipped L6 Stop
  continuation.
- No codex-rs slash command or plugin namespace alias work.

## Runtime Design For Follow-Up Loops

### L13 - Interview ledger + answer capture

Add a small interview runtime module under `pabcd-state`:

- `interview-ledger.ts`
  - session-scoped JSONL path: `.codexclaw/interviews/<sessionId>.jsonl`;
  - event ids derived from `(sessionId, roundId, questionId, eventKind)`;
  - event kinds: `question_asked`, `answer_recorded`,
    `contradiction_added`, `contradiction_resolved`,
    `assumption_recorded`, `readiness_changed`.
- `PostToolUse` hook matcher for `^request_user_input$`;
  - read `tool_input` for question metadata;
  - read `tool_response` for selected/free-form answers;
  - append an answer event;
  - update hot session state with pending pointer cleared.
- tests:
  - records question and answer;
  - dedups repeated tool response by event id;
  - malformed response fails open but records no false readiness.

### L14 - Interview Stop guard

Extend the passive Stop handler narrowly:

- If phase is not `I`, do nothing.
- If `stop_hook_active` is true, do nothing to avoid recursive Stop blocking.
- If no pending question and no high contradiction, do nothing.
- Otherwise return `decision:"block"` with a concise continuation reason.
- Do not use Stop to inject rich instructions; `UserPromptSubmit` remains the
  context-injection surface.

### L15 - Contradiction rescan coordinator

Document and optionally implement a helper that the main session can call to:

1. collect contradiction candidates from subagents or local lenses;
2. triage severity;
3. ask only the main-session aggregated question;
4. record the answer;
5. append a round appendix to this devlog line of work.

## Skill Surface Contracts

### `cxc-interview`

Entry skill for persistent I phase. It explains that the main session owns
questions and records, while subagents only return contradiction candidates.

### `cxc-orchestrate`

Discoverable help surface for chat-side `$cxc-orchestrate` and the live
agent-gated `cxc orchestrate` terminal path. It must keep the human chat
free-pass and agent/CLI attest-gated paths distinct.

### `cxc-loop`

User-facing loop discipline for HOTL autonomous continuation. It depends on
goalplan and Interview evidence but does not own the schema in L12.

### `cxc-goalplan`

Durable goalplan/checkpoint/quality-gate contract. It is a discipline surface, not
a codexclaw-owned goal database; host Codex goal state arms the shipped L6 loop.

## Verification Contract

L12 verification:

- `test -f` for the four skill `SKILL.md` files and their `agents/openai.yaml`
  metadata;
- `node --test plugins/codexclaw/test/manifest-policy.test.mjs`
- `npm test`
- `git diff --check`

L13+ verification:

- targeted `pabcd-state` tests for ledger/PostToolUse/Stop;
- root `npm test`;
- root `npm run build` when TypeScript source changes.

## Round Appendix

### Round 1 - 2026-06-30

Questions answered:

- L slot: L11 was first proposed, but an existing L11 docs-site plan occupies
  that slot. Decision: use L12 for skill hardening.
- Deployment slot: move install/deploy/npx/symlink hardening to L20.
- Runtime split: L12 validates existing skill surfaces, later loops implement
  recorder/guard.
- Question model: main session asks; subagents report candidates.
- Ledger model: `.codexclaw/interviews/<sessionId>.jsonl` is canonical runtime
  evidence; devlog is human-readable appendix.

Remaining assumptions:

- The future `PostToolUse` hook can safely match `request_user_input` in this
  plugin without conflicting with the current PreToolUse goal-mode deny hook.
- The exact ledger event schema should be finalized in L13 before code changes.

## Completion Evidence

L12 closes only the skill-surface reconciliation slice. The following are current:

- `cxc-interview`, `cxc-orchestrate`, `cxc-loop`, and `cxc-goalplan` each have
  `SKILL.md` plus `agents/openai.yaml` and are on-demand/autocomplete-ready.
- `cxc-orchestrate` documents shipped chat parsing and live agent-gated
  `cxc orchestrate`.
- `cxc-loop` documents shipped L6 Stop-continuation guards.
- `cxc-goalplan` documents host Codex goal state as the loop arming source, with no
  codexclaw goal database.

The following remain deferred to L13+:

- `PostToolUse` answer capture for `request_user_input`;
- `.codexclaw/interviews/<sessionId>.jsonl` append-only interview event writer;
- narrow I-phase Stop guard for pending/high Interview work;
- contradiction-rescan coordinator runtime.

### C-Gate Verification - 2026-06-30

Fresh checks run before closing the L12 PABCD cycle:

- Fixed-string stale-claim scan over this file and `000_INDEX.md`: no matches for
  skeleton-record wording, undiscoverable-surface wording, future-terminal-CLI
  wording, missing-CLI wording, missing-loop-engine wording, or equivalent stale
  markers.
- Skill existence check: `interview`, `orchestrate`, `loop`, and `goalplan` each
  have `SKILL.md` plus `agents/openai.yaml`.
- `node --test plugins/codexclaw/test/manifest-policy.test.mjs`: 6 pass, 0 fail.
- `npm run build`: build OK, 30 files compiled.
- `npm test`: 283 pass, 0 fail.
- `node bin/codexclaw.mjs doctor`: overall PASS.
- `git diff --check`: exit 0.

Independent review results:

- `Mencius`: PASS - `080` through `120` all exist and follow the decade convention.
- `Hegel`: PASS - L12 skill surface claims are accurate and deferred runtime items
  are not overclaimed.
- `Kant`: NEEDS_FIX - requested actual verification evidence in this document before
  accepting the L12 DONE claim; this C-gate evidence section is the fix.
