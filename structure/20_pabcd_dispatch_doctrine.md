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
- A->B additionally requires a pasted `auditOutput` (the dispatched reviewer subagent's
  verdict tail — WP3) plus `auditVerdict` (`pass|near-pass|fail`, the MAIN agent's own
  judgment; `near-pass` also needs `auditResidual` naming each residual blocker's
  disposition). A declared `fail` never advances, and a tail whose final verdict line
  says FAIL is rejected (AUDIT-LOOP-01). This is a form-only gate: it checks that
  `auditOutput` and `auditVerdict` are present and valid, but cannot verify the paste's
  provenance. The discipline requires a real reviewer dispatch and judged loop exit;
  the runtime gate cannot enforce that dispatch.
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
- **DISPATCH-AGENT-TYPE-01 (DEFAULT).** The role-to-agent-type mapping above is the
  canonical dispatch classifier for the SubagentStop evidence gate: only
  `agent_type:"worker"` triggers the evidence-receipt gate (hook matcher `^worker$` +
  runtime `GATED_AGENT_TYPES`). Read-only audit, research, and review dispatches MUST
  use `agent_type:"explorer"` to avoid conflicting evidence-persistence directives.
- **Audit (A) is never skipped.** Before B, the main session must dispatch an independent
  reviewer subagent via `spawn_agent` for an adversarial review pass. Untested code is
  not "done"; C must run real tsc/tests.
- **Write scope is opt-in and bounded.** A read-only investigation spawns an `explorer`;
  only a deliberate implementation slice spawns a `worker`, with an explicit write scope
  in its task. Do not hand a broad write mandate to a subagent by default.
- **The plan travels with the dispatch.** cli-jaw's server auto-injects the approved
  plan into every worker task. codexclaw has no server, so the main agent must inline
  the relevant plan/context into the spawn message — a subagent must never reconstruct
  the plan from a thin task description.
- **LEAF-TOPOLOGY-01 (hook-enforced, 260709).** Subagents are star-topology leaves:
  they never spawn their own subagents. The spawn PreToolUse hook applies on both
  surfaces: (1) a spawn issued BY a subagent (stdin `agent_id` present) is DENIED
  unless the message carries `CXC-SUBSPAWN-ALLOWED`; (2) every spawn message gets the
  `[CXC-LEAF-GUARD]` block. For a non-full-history fork, configured role `model` and
  `reasoning_effort` from `.codexclaw/subagents.json` are independently injected when
  the caller omits them; otherwise each omitted field inherits. Recursion is a
  deliberate per-dispatch grant, never a default. Evidence + design:
  `devlog/_plan/260709_multi_agent_v2_switch/060_leaf_agent_hardening.md`.
- **DISPATCH-ACTOR-01 (reuse).** Follow-up rounds in the same role and work context
  reuse the existing agent instead of spawning fresh: V2 `followup_task` to its
  task_name (triggers a turn when idle; `send_message` is context-only delivery), or
  V1 `send_input` to its agent_id. V1 alone supports `resume_agent` after close.
  The point is context preservation — the reviewer or
  worker keeps what it already read. Do NOT justify reuse with "same provider = prompt
  cache reuse"; that assumption was tested and rejected in the jawcode lineage
  (`../jawcode/devlog/_fin/260614_subagent_cache_actor_lifecycle/95_d_cycle2_done_summary.md`,
  implementation-verified). Carve-out: the final C adversarial gate — and any reviewer
  that has already shaped the fix through synthesis rounds — gets a FRESH reviewer or a
  direct independent file:line audit, so anchoring never grades its own influence.
- **Lifecycle wait + concurrency.** V1 `wait_agent` returns final status plus content;
  V2 `wait_agent` is a no-content mailbox. The concurrency controls are V1
  `agents.max_threads` (default 6) and V2 `max_concurrent_threads_per_session`
  (default 4, including the root).
- **DISPATCH-RETIRE-01 (fresh-spawn fallback).** This is the exception to the reuse
  default above: an agent id that failed (error, timeout, unresponsive, nonsense
  output) is retired, not nursed. At most ONE retry against the same task_name; then
  abandon it (V2 has only `interrupt_agent`; V1 has `close_agent` and `resume_agent`)
  and fresh-spawn with the failure summary folded into the new
  TASK packet. Repeated `followup_task`/`send_message` against a broken agent is a
  broken-resume loop — the dispatch analogue of LOOP-REPAIR-01's doom loop. When the
  fresh spawn — a SECOND distinct agent — also fails the SAME task packet, stop
  blaming agents: two independent failures on one packet are evidence the packet
  itself failed the DISPATCH-ECONOMY-01 specifiability bar. The main session
  reclaims that slice and does the work directly instead of dispatching a third
  copy (packet-failure reclaim, 260711 fork-debate verdict #4). Lineage:
  `../jawcode/devlog/_plan/260616_actor_fresh_fallback/_fin/00_moc.md`
  (implementation-verified). Both rules are E7 doctrine (agent-followed); no hook
  observes agent lifecycles.
- **DISPATCH-ECONOMY-01 (delegability + triage economy).** E7 doctrine
  (agent-followed); no hook measures delegation quality. Adopted 260711 from the
  fork-debate verdicts plus Tier-2 arXiv evidence (claim-ledger:
  `devlog/_plan/260711_dispatch_economy_docs_site/005_research_claim_ledger.md`).
  Four clauses:
  - *Three-axis delegability test.* Decide what to delegate by
    **specifiability** (the TASK packet can carry the full spec, including its
    DECISION BOUNDARY — which judgments the subagent may settle vs must return
    unresolved) x **verifiability** (a mechanical check — tests, gate, diff
    inspection — can prove the return) x **judgment ownership** (load-bearing
    decisions stay with the main session: collapse/crux verdicts, API contract
    shape, plan amendments; re-DERIVING a crux may be dispatched per
    SPECIALIST-CRUX-01, the verdict on it may not). Complexity is NOT an axis: a
    complex-but-fully-specified algorithm with a test oracle is a valid worker
    task, while an easy-but-ambiguous naming or boundary decision is not. A slice
    whose packet cannot state its decision boundary fails specifiability and stays
    with the main session.
  - *Triage disposition obligation (output-side).* There is no self-reported
    "how many agents I can honestly judge" cap — that is unauditable. Instead:
    every returned lane gets a RECORDED disposition — accept / reject / merge plus
    a one-line rationale — before the next wave spawns. Wave-granular judgment is
    allowed (so `cxc-search` Tier-3 wave floors are never cut); spawning new lanes
    while returns sit untriaged is a violation, auditable in the ledger/devlog.
    Evidence basis: selector quality outweighs generator diversity
    (arXiv 2603.20324, single-author — low evidence grade), logistic saturation of
    agent scaling (MacNet, arXiv 2406.07155), verification failures as a first-class
    MAS failure category (MAST, arXiv 2503.13657).
  - *Model routing (a DEFAULT, not an override).* Standardized implementation
    slices ride cheap/fast model families by default; crux re-derivation and
    adversarial review default to a decorrelated family. This clause preserves
    DIVERGE-TIER-01's tier selection untouched (conceptual-tier candidate work is
    not force-promoted to strong models) and adds nothing to
    REVIEW-DECORRELATE-01 beyond its existing invariant — family independence
    from the producing model is the requirement; "strong" is a default choice,
    not a mandate.
  - *Batch-spawn preference.* Fan out a full wave, then synthesize once;
    drip-feed spawning taxes the main session's context once per return and
    fragments triage. This extends the "fan out before waiting" lifecycle rule
    from mechanics to economy.

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
  (the L14 message/items channels in `10_subagent_skill_routing.md`) so the subagent loads the
  discipline at launch. "Investigate per `cxc-search`" becomes a real skill attachment,
  not a sentence in the task text.

### Honesty note (updated by WP2)
`cxc-dev` is the only skill with an always-on implicit BODY; all `dev-*` siblings are
`allow_implicit_invocation: false`. So routing for the implicit-visibility surface
collapses to "dev only" unless the agent deliberately reads further. (The 2026-07-05
implicit expansion added six non-dev metadata rows — search/interview/pabcd/recall/
skill-hub/loop — which improves discovery but does not change this dev-* routing
collapse.) The spawn-time
attachment intent is explicit in both payload shapes: L15's production builder emits
resolvable message mentions, while manual V1 callers may use the stronger `items`
channel (`buildSpawnItems`/`SpawnPayload.items`). Prefer `[$cxc-<name>](skill://<abs SKILL.md>)`; use
plugin-native `$codexclaw:cxc-<name>` when a link is unsafe. The WP2 E3
spawn PreToolUse hook normalizes known broken/bare cxc mentions and inlines recognized
skill bodies on V2-shaped spawns only when `message` reaches it as plaintext. Native
ChatGPT-backend V2 presents ciphertext, so both operations are no-ops there. When no body
can be inlined, the hook appends a plaintext `[CXC-SKILL-AFFORDANCE]` block telling the
child to self-load any `$cxc-<folder>` / `$codexclaw:cxc-<folder>` mention from
`<skillsDir>/<folder>/SKILL.md`; fork inheritance remains a secondary channel. The native
V2 hook also carries the leaf guard and configured model/effort injection; it does not add
role baselines or infer surface skills.
Dispatchers remain responsible for naming every required skill (DISPATCH-TASK-01).

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

- No *orchestration* server, no employees-as-processes, no multi-runtime registry.
  (The opt-in loopback messenger bridge — `cxc serve` + `.codexclaw/bridge.db`,
  2026-07-03 — is a scoped exception recorded in `00_philosophy.md` §2; it relays
  chat messages to stock `codex exec` and never dispatches subagents.)
- No goal *write* path: codexclaw reads the native goal DB; only the main session
  calls `create_goal`.
- No `cli-jaw dispatch` HTTP path; subagents are Codex-native `spawn_agent` calls.
- No memory/chat/project/worklog server stores; `.codexclaw/` files (including the
  bridge's project-local `bridge.db`) are the only durable state (user-level
  `~/.codexclaw` holds rebuildable derived caches only — recall FTS index, ast-grep
  runtime — per the 2026-07-02 owner re-scope).
- No provider mutation; the provider bridge is detect-only.

If a future change wants one of these, it is a product-boundary decision, not a routine
feature — raise it against §2 first.

---

## 7. Inherited gate ideas (SHIPPED as the L18 gate)

cli-jaw hardens truth with mechanical gates; codexclaw grew analogues. These shipped as
the L18 E8 gate (`plugins/codexclaw/scripts/gate.mjs` + `gate.test.mjs`, `npm run gate`):

- A **status-sync gate** that diffs each `mvp_hard` ledger row's decision-state against
  its loop-doc `Status:` leading token (`checkStatusSync`).
- A **forbidden-claims scan** that flags false "the hook loads/enforces X skill" sentences
  in `skills/**/SKILL.md` and `structure/*.md` lacking a `gate-ok` escape
  (`checkForbiddenClaims`, extended to `structure/` in L20-WP5).
- A **count check** that fails when the manifest hook count diverges from `hooks/` on disk
  (`checkCounts`).

A complementary **src↔dist freshness** check shipped separately as `dist-freshness.test.mjs`
(L20-WP10). Remaining cli-jaw analogues not yet built (e.g. a broad capability-truth-table
drift check beyond the above) stay doctrine direction, not implemented surfaces.
