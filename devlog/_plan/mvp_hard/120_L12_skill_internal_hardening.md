# L12 / 120 - Skill Internal Hardening + Continuous Interview Contract

Status: PLANNED (plan + skeleton record) - 2026-06-30 - mvp_hard loop L12

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
- L split: L12 is plan + skill skeleton; runtime capture/guard lands in a later loop.
- Skill skeleton set: `cxc-interview`, `cxc-orchestrate`, `cxc-loop`,
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
4. `pabcd/SKILL.md` had stale `.codexclaw/state.json` and "no external phase
   commands" wording; live state is session-scoped and chat orchestrate wiring
   exists after L3.
5. `$cxc-interview`, `$cxc-orchestrate`, `$cxc-loop`, and `$cxc-goalplan` were
   planned but not discoverable skill surfaces.

## Scope

### In L12

- Add four on-demand skill skeletons:
  - `plugins/codexclaw/skills/interview/`
  - `plugins/codexclaw/skills/orchestrate/`
  - `plugins/codexclaw/skills/loop/`
  - `plugins/codexclaw/skills/goalplan/`
- Update skill catalog and skill README.
- Update `pabcd/SKILL.md` stale state/command wording.
- Update `structure/INDEX.md` so the new skill surfaces are visible without
  claiming runtime features that are still planned.
- Update `mvp_hard/000_INDEX.md`:
  - preserve L11 docs-site track,
  - place skill hardening at L12,
  - move install/deploy hardening to L20.

### Out Of L12

- No `PostToolUse` hook implementation.
- No `.codexclaw/interviews/<sessionId>.jsonl` writer implementation.
- No Stop guard implementation.
- No `cxc orchestrate` CLI implementation.
- No goalplan/loop runtime engine.
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

Discoverable help surface for chat-side `$cxc-orchestrate` and future
`cxc orchestrate`. It must not claim the terminal CLI is shipped until L4 lands.

### `cxc-loop`

User-facing loop discipline for HOTL autonomous continuation. It depends on
goalplan and Interview evidence but does not own the schema in L12.

### `cxc-goalplan`

Durable goalplan/checkpoint/quality-gate contract for later L7/L13+ runtime work.
It remains a skeleton in L12.

## Verification Contract

L12 verification:

- `node --test plugins/codexclaw/test/manifest-policy.test.mjs`
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
- Runtime split: L12 plan+skeleton, later loops implement recorder/guard.
- Question model: main session asks; subagents report candidates.
- Ledger model: `.codexclaw/interviews/<sessionId>.jsonl` is canonical runtime
  evidence; devlog is human-readable appendix.

Remaining assumptions:

- The future `PostToolUse` hook can safely match `request_user_input` in this
  plugin without conflicting with the current PreToolUse goal-mode deny hook.
- The exact ledger event schema should be finalized in L13 before code changes.
