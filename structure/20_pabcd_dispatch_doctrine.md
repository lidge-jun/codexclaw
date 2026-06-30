---
created: 2026-06-30
tags: [codexclaw, pabcd, dispatch, routing, doctrine, sot, cli-jaw-lineage]
aliases: [PABCD Dispatch Doctrine, cli-jaw lineage, codexclaw orchestration philosophy]
---

# PABCD + Dispatch + Routing Doctrine (SOT)

> Where `00_philosophy.md` states the invariants, this file states the *operating
> doctrine* codexclaw inherits from cli-jaw and how it is translated to a serverless
> Codex plugin. cli-jaw is the design ancestor; codexclaw keeps its discipline and
> drops its server.
>
> Reference ancestors (read-only, in `../cli-jaw/`):
> `src/prompt/templates/orchestration.md`, `structure/agent_spawn.md`,
> `structure/prompt_flow.md`, `src/orchestrator/attestation.ts`.

---

## 0. The translation table (cli-jaw -> codexclaw)

cli-jaw is a multi-runtime server with employees, a dashboard, and a DB. codexclaw is
a single Codex plugin with hooks and `.codexclaw/` files. The doctrine survives the
move; the machinery does not.

| cli-jaw concept | codexclaw translation |
| --- | --- |
| Boss agent | the main Codex session (you) |
| Employee (`cli-jaw dispatch --agent`) | a Codex `spawn_agent` subagent (`explorer`/`worker`) |
| Employee registry (server) | role TOMLs in `plugins/codexclaw/agents/` (prompt sources only) |
| `cli-jaw orchestrate I/P/A/B/C/D` (HTTP) | `cxc orchestrate I/P/A/B/C/D` (agent-gated CLI over `.codexclaw/`) |
| `--attest` gate (`orchestrator/attestation.ts`) | `cxc orchestrate <phase> --attest` (same JSON gate) |
| Shared Plan auto-inject (server pipeline) | main agent inlines the plan into each spawn (no server to inject it) |
| Worklog `## Plan` SSOT | `.codexclaw/` session files + devlog evidence path |
| Goal autonomy (`src/goal/`) | native Codex goal DB, read-only to codexclaw |

The honesty rule from `00_philosophy.md` §1 governs every row: where cli-jaw enforced
something server-side, codexclaw can only enforce it if a hook owns the surface;
otherwise it is doctrine the main agent follows, not a runtime guarantee.

---

## 1. PABCD: explicit entry, no auto-advance

cli-jaw's load-bearing rule (`orchestration.md`): **YOU advance phases by running the
exact command. Narrating "현재는 B입니다" does nothing.** codexclaw keeps this exactly.

- Entry is explicit: the user invokes the orchestrate/interview surface, or the agent
  runs `cxc orchestrate P` (task needs structure) / `cxc orchestrate I` (request
  unclear). codexclaw additionally parses `$cxc-orchestrate` / `$codexclaw:cxc-orchestrate`
  shorthand in the prompt hook.
- **No auto-advance.** A phase advances only when the exact `cxc orchestrate <phase>`
  command runs. There is no hook that silently moves P->A. The Stop hook can *block*
  premature termination under a goal, but it does not transition phases.
- The IPABCD ladder: **I** (Interview, optional) -> **P** (Plan) -> **A** (Plan Audit)
  -> **B** (Build) -> **C** (Check) -> **D** (Done, closes to IDLE).

### Honesty note (L14 RESOLVED 2026-06-30)
The `loop` / `goalplan` / `dev` skills previously claimed the Stop hook re-enters `P`
and auto-advances `I -> P`. L14 corrected that prose: the docs now state plainly that
the AGENT advances every phase via explicit `cxc orchestrate <phase>`, and `handleStop`
only blocks premature termination (it never transitions phase). Verified against
`hook.ts:391-415`. Register rows A1/A2/A3 are closed.

---

## 2. The attest evidence gate

cli-jaw's `attestation.ts` requires forward transitions to carry evidence; narration is
rejected. codexclaw mirrors this as the one place the agent path is genuinely gated:

- Forward transitions (P->A->B->C->D) require `--attest '{"from","to","did"}'`.
- C->D additionally requires a pasted `checkOutput` (tsc/test tail) and `exitCode: 0`.
- A bare agent `cxc orchestrate <phase>` without attest is rejected (409-style).
- Human/chat-submitted commands are a free-pass source; the agent/CLI path is gated.
  This split is the codexclaw analogue of cli-jaw's "user slash command vs agent
  command" distinction.

This gate is real because the orchestrate CLI owns it. Treat it as the spine of "DONE
means shipped + tested" — D cannot close without verification output.

---

## 3. Dispatch doctrine: who spawns whom, and what they may write

cli-jaw: **only the Boss dispatches employees; employees use their own CLI sub-agents;
in B phase the Boss writes code and workers are read-only verifiers unless `--mutable`.**
codexclaw translation:

- The main session is the only dispatcher. A spawned subagent should not fan out
  another orchestration layer; it does its scoped task and returns.
- Role -> built-in agent type: `explorer`/`reviewer` -> `explorer` (read-only),
  `executor` -> `worker` (scoped write). codexclaw cannot register custom roles, so the
  role prompt is injected inline (the B-opt2 pattern).
- **Audit (A) is never skipped.** Before B, an adversarial review pass runs (a reviewer
  subagent or a direct file:line audit). Untested code is not "done"; C must run real
  tsc/tests.
- **Write scope is opt-in and bounded.** A read-only investigation spawns an `explorer`;
  only a deliberate implementation slice spawns a `worker`, with an explicit write scope
  in its task. Do not hand a broad write mandate to a subagent by default.
- **The plan travels with the dispatch.** cli-jaw's server auto-injects the approved
  plan into every worker task. codexclaw has no server, so the main agent must inline
  the relevant plan/context into the spawn message — a subagent must never reconstruct
  the plan from a thin task description.

---

## 4. Skill routing as an attachment (the cli-jaw "dev-pabcd MUST-READ", translated)

cli-jaw routes phase/surface discipline by naming a MUST-READ skill in the prompt
pipeline. codexclaw split the discipline into independent on-demand skills
(`cxc-dev-architecture`, `cxc-search`, ...). The doctrine: **route by attaching the
skill to the work, not by hoping the model loads it.**

- For the main agent: the `cxc-dev` hub names the exact surface skill to read before
  writing in that surface. This is guidance (no hook enforces skill loading), so the
  routing table must be strong and unambiguous.
- For a subagent: the matching `cxc-*` skill should be attached to the spawn payload
  (the L14 `items` design in `10_subagent_skill_routing.md`) so the subagent loads the
  discipline at launch. "Investigate per `cxc-search`" becomes a real skill attachment,
  not a sentence in the task text.

### Honesty note (open defect)
Today only `cxc-dev` is implicit-visible; all `dev-*` siblings are
`allow_implicit_invocation: false`, and the spawn payload has no `items` channel. So
routing currently collapses to "dev only" unless the agent deliberately reads further.
The attachment mechanism is the L14 target, not shipped behavior.

---

## 5. HITL interview vs HOTL goal (the mode firewall)

cli-jaw runs interview-driven planning and goal autonomy as distinct flows. codexclaw
keeps them strictly separated (`00_philosophy.md` §4):

- **Interview (HITL)** gathers requirements, dispatches contradiction-rescan subagents
  (the "1..N minds" idea), and ends by asking the user to proceed or keep interviewing.
- **Goal (HOTL)** drives autonomous PABCD and suppresses the interview —
  `request_user_input` is denied while a goal is active (a real `PreToolUse` hook).
- The firewall: **a goal suppresses the interview.** Never let an interview fire
  mid-goal, and never let the goal loop ask the user a clarification it should have
  settled in the interview.

---

## 6. What codexclaw deliberately does NOT inherit from cli-jaw

Per `00_philosophy.md` §2, these cli-jaw surfaces are non-goals — do not port them:

- No server, no employees-as-processes, no dashboard DB, no multi-runtime registry.
- No goal *write* path: codexclaw reads the native goal DB; only the main session
  calls `create_goal`.
- No `cli-jaw dispatch` HTTP path; subagents are Codex-native `spawn_agent` calls.
- No memory/chat/project/worklog server stores; `.codexclaw/` files are the only state.
- No provider mutation; the provider bridge is detect-only.

If a future change wants one of these, it is a product-boundary decision, not a routine
feature — raise it against §2 first.

---

## 7. Inherited gate ideas worth building (forward pointers, not yet shipped)

cli-jaw hardens truth with mechanical gates. codexclaw should grow analogues, tracked
as future loops (do not claim them DONE until they exist):

- A **capability/status freshness check** (cli-jaw `check-doc-drift.sh` /
  `verify-counts.sh`) that fails when a SOT row diverges from code/tests.
- A **forbidden-claims scan** (cli-jaw `CAPABILITY_TRUTH_TABLE` "Forbidden Claims")
  that flags any "the hook enforces X" sentence lacking a live hook branch.
- A **status-sync gate** that diffs the `mvp_hard` ledger row against each loop doc
  header and this `structure/` SOT.

These are the natural next defenses against the false-DONE pattern; they are noted here
as doctrine direction, not as implemented surfaces.
