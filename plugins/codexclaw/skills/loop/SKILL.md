---
name: cxc-loop
description: "Use for Codexclaw PABCD work-loop planning: HITL phase discipline, HOTL goal activation, cxc-pabcd activation, repeated work-phases, divergence/collapse policy, Stop-continuation policy, and evidence checkpoints. Triggers: cxc-loop, loop, autonomous continuation, continue until done, HOTL, HITL PABCD, repeated PABCD, work-phase loop."
metadata:
  short-description: "PABCD continuation + divergence/collapse loop contract."
---

# cxc-loop

Use this skill for Codexclaw work loops that span one or more PABCD work-phases.
It covers both HITL PABCD (manual/user-confirmed phase movement) and HOTL goal
loops (Stop-hook continuation after D/IDLE).

## Contract

- `cxc-loop` is an overlay on `cxc-pabcd`, not a replacement. Before claiming a
  loop is active, follow `cxc-pabcd` phase semantics and enter a real PABCD state
  with `cxc orchestrate I|P` (or the human free-pass chat surface).
- Choose the execution mode before the first work-phase:
  - **HITL loop:** PABCD is active, no ACTIVE host goal is required, and P/A/B
    remain human-confirmed pause points. The Stop-continuation hook will not arm.
  - **HOTL goal loop:** an ACTIVE host goal must exist AND a PABCD cycle must be
    in flight. The main session owns `create_goal`/`update_goal`; subagents never
    create or update host goals. If the user did not explicitly ask for
    autonomous / continue-until-done execution, stay HITL rather than silently
    creating a goal.
- Goal active without PABCD active is not a work loop; PABCD active without a
  goal is HITL, not HOTL. If either half is missing, activate the missing half or
  state the preflight failure instead of pretending Stop-continuation is armed.
- One work-phase maps to one full PABCD cycle.
- D closes the current work-phase and returns the phase to `IDLE`.
- If work remains and a goal is active, **the agent** starts the next work-phase by
  running `cxc orchestrate P` after recording evidence. Nothing transitions the phase
  automatically — the Stop hook only blocks premature termination so the agent does
  this; it never re-enters `P` for you (see Stop-continuation below).
- There is no I -> P auto-advance. The agent advances every phase, including I -> P,
  by running the explicit `cxc orchestrate <phase> --attest` command. The hook does
  not move phases AUTONOMOUSLY. (It does persist a transition when the agent submits an
  explicit chat `orchestrate <verb>` command — that is the agent acting, not the hook
  advancing on its own. Nothing transitions without an explicit agent/CLI command.)
- The Stop guard blocks termination based on coarse state signals (active goal +
  in-flight cycle + stagnation budget), not a content check for "pending work." It
  keeps the turn alive so the agent can self-advance; the agent decides whether real
  work remains.
- When a goalplan is bound to the session (`cxc goalplan init --session`), the block
  reason MAY also name the next concrete task + the evidence it should produce + the
  goalplan ledger path. This is text enrichment only: it does not gate on that content,
  does not change when the hook blocks vs releases, and never transitions a phase. With
  no bound goalplan the reason is unchanged.
- Goal mode is PABCD-only: while a goal is active the Interview NEVER fires (entry is
  suppressed and `request_user_input` is hard-denied). The Interview is HITL-only and
  runs only with no active goal; the Stop hook never drives the Interview.

## Continuation doctrine (LOOP-CONTINUE-01)

The Stop hook keeps the turn alive, but the agent decides what "remaining work" means. When
re-entering a loop or after a `D` close:

- **Do not redefine the objective downward.** The success criteria recorded at P (or in the
  bound goalplan `criteria[]`) are the bar; shrinking scope to escape the loop is not allowed.
- **Audit completion against current repo state, not memory.** Before any `D`/completion claim,
  inspect the actual tree/build/tests — a remembered "it passed" is not evidence (see `dev`
  FAMILY-PROOF-01).
- **Read durable state first.** When a goalplan is bound, use `cxc goalplan show` for the summary
  and inspect `.codexclaw/goalplans/<slug>/goalplan.json` + `ledger.jsonl` directly for full state,
  to recover which work-phases/criteria remain before planning the next pass.
- **IDLE is not the end while work remains.** After `D` closes to IDLE, if any work-phase or
  unmet criterion remains under an active goal, start the next work-phase at `P`.

## Emergence / Divergence Layer

PABCD is convergence-first by default. For ordinary build or bug-fix goals, keep one
strategy and execute it. Divergence is a **PABCD-layer mode**, not a standing habit:
it can be selected deliberately in HITL PABCD during I/P, or automatically prompted
in goal mode when a maximize objective records non-improving metrics (`cxc metric`)
and the Stop hook emits the objective-plateau directive. The plateau-triggered mode
is the shipped automatic entry, not the only valid entry.

In HITL PABCD, use deliberate I/P divergence when the user's intent is open, the
algorithmic approach is genuinely uncertain, the objective is maximize/deceptive, or
the user explicitly asks to compare alternatives. The P/A/B pause semantics remain:
no hook builds candidates, races worktrees, or bypasses confirmation. In goal mode,
the Stop hook can only keep the turn alive and tell the agent to re-plan; it still
does not ask the user or move phases by itself.

When divergence is ON:

- Record mode explicitly: `cxc divergence mode --session <id> on --collapse P|D --reason <why>`.
- I/P records at least two candidates in the archive. If the user intent is clear, do
  not ask a fake menu question; record `strong-1` plus `add-1` silently. If intent is
  genuinely open, ask the user to choose or constrain the candidates.
- Every candidate must carry `cxc-search` provenance: `strong-1` should be Tier 2
  proven; `add-1` must be at least Tier 1 discovered. Record it with
  `cxc divergence candidate add ... --source <url>`.
- When candidate work happens in a git worktree, record archive entries into the owner
  worktree, not the child. Run `cxc divergence ... --cwd <owner-repo-root>` from child
  worktrees so the collapse owner sees every candidate.
- Collapse early at P for satisfy-spec work (pass/fail, locally checkable). Collapse
  late at D for maximize-metric work where the local metric can deceive: build
  candidates in isolated worktrees, run the same `evaluate.sh`, then keep/discard by
  the recorded metric.
- For maximize goals, build or validate `evaluate.sh` before any candidate build. It
  must be deterministic, use fixed seeds/folds, and emit `METRIC name=value`; ingest
  with `cxc metric ingest --session <id>`.
- If local metrics improve while holdout/true metrics stall or fall, treat it as an
  overfitting stop signal. Do not celebrate or keep the candidate without a re-plan.
- After the plateau is broken or a candidate is kept/discarded, turn divergence off:
  `cxc divergence mode --session <id> off --reason resolved`, then return to the
  normal N=1 loop.

This section is E7 doctrine plus project-local evidence files. The only shipped E2
lever is the goal-mode Stop hook's plateau block; HITL divergence entry is valid but
human/agent selected, not hook-enforced. Worktree creation, harness execution, and
candidate races are still agent-executed work, not background automation. The
`.codexclaw/divergence/` files are durable evidence, not an automatic control source;
forgotten active mode cannot move phases or build candidates by itself.

## Stop-continuation (shipped, L6)

The continuation is enforced by the active Stop hook (`handleStop`), not just this
discipline doc. It returns `{"decision":"block","reason":...}` to keep the agent
advancing while a PABCD cycle is in flight under an ACTIVE goal. Termination is total
via:

- **Guard 1** — `stop_hook_active`: codex is already in a continuation → release.
- **Guard 2** — phase is `IDLE` / orchestration inactive / no active goal → release
  (a plain interactive session never enters the loop; it pauses for the human at P/A/B).
- **Context-pressure bail** — don't pile on during compaction recovery.
- **Stagnation cap** — a bounded `stopBlockCount` per phase; after `MAX_STOP_BLOCKS`
  consecutive blocks at the same phase with no transition, the loop releases so it can
  never trap a session. A real transition (chat or CLI) resets the counter, so each
  phase of a healthy P→A→B→C→D gets a fresh budget.
- **Objective plateau block** — for active maximize goals with session-scoped metrics,
  two non-improving same-metric rows switch the block reason from plain continuation
  to "step back and re-plan with divergence." This still uses the same bounded
  `MAX_STOP_BLOCKS` release path and never asks the user inside goal mode.
