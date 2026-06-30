# codexclaw MVP-HARD — Parity Hardening Plan (mvp_hard)

Status: CANONICAL INDEX · 2026-06-30 · parity-hardening track that follows `../mvp_res/`

> `mvp_res/` shipped L1-L28 (the codex-native MVP). `mvp_hard/` is the **parity-hardening**
> track: it closes the gap between codexclaw's current `$`-mention + UserPromptSubmit-hook UX
> and the cli-jaw / jawcode harness experience (notably the `orchestrate I/P/A/B/C/D/reset`
> state-control surface), *without* re-adding a server runtime. Codex-native means: `$cxc-*`
> autocomplete (skill mentions) + hooks + file state + `cxc` CLI only — no SlashCommand enum
> edits to codex-rs, no external orchestrator.

## Naming convention (LOCKED — inherited from mvp_res)

- `000-009` = research / parity audit (this INDEX + inbound findings).
- Each hardening **loop Ln** owns a **decade**: `010=L1`, `020=L2`, ...
- Decade head doc is `0X0_L<n>_<slug>.md`; finer sub-passes are `0X1_L<n>.1_<slug>.md`.
- Directory sort order == execution order.
- Project shorthand `cxc` is primary in all examples; full `codexclaw` shown once per doc max.

## Why this track exists (one-liner)

cli-jaw exposes an explicit, user-drivable PABCD state machine via `cli-jaw orchestrate <phase>`
(a server CLI). This track ports that control surface using the codex-native `$ + hook` model:
chat-side `$cxc-orchestrate` / `orchestrate <phase>` writes the same `.codexclaw/` FSM state,
and the terminal `cxc orchestrate` path is agent-gated by attest evidence.

## Constraints (LOCKED)

- No codex-rs fork. `/`-slash commands are a hardcoded `SlashCommand` enum and are OUT.
- `$cxc-*` is the project UX shorthand. In the current Codex plugin runtime, native plugin skill
  mentions render as `$codexclaw:cxc-*`; raw `$cxc-*` must be treated as a hook-parsed shorthand
  unless codex-rs gains a plugin alias/namespace feature.
- State transitions are driven by the existing `UserPromptSubmit` hook parsing submitted prompt
  text, plus the `cxc` CLI (`bin/codexclaw.mjs`) for terminal-side control.
- File-based state only (`.codexclaw/sessions/<id>.json` + `ledger.jsonl`).
- SUB-CLOSE discipline + atomic conventional commits (inherited from mvp_res).

## Loop ledger — L1.. (filled as research lands)

| Ln | decade | scope | decision-state | impl-state |
|----|--------|-------|----------------|-----------|
| L1 | 010 | Parity audit: cli-jaw/jawcode/omo vs codexclaw, `$`+hook UX gap map | DONE | DONE |
| L1.1 | 011 | cli-jaw 10-surface parity matrix (engine PARITY/stricter; server surfaces intentional non-goals; loop⇄goal defect -> L14) | DONE | DONE |
| L2 | 020 | FSM legal-transition table + four-transition attest gate | DONE | DONE |
| L3 | 030 | `$cxc-orchestrate` grammar (030/L3a) + hook wiring to `transition()` — the missing wire (031/L3b) | DONE | DONE |
| L4 | 040 | `cxc orchestrate` CLI over the same file state (agent-gated path) | DONE | DONE |
| L5 | 050 | `status` / `reset` / `D` chat affordances + phase footer directive + ledger-on-transition | DONE | DONE |
| L6 | 060 | Stop-continuation loop with omo termination guards + bounded stagnation guard | DONE | DONE |
| L7 | 070 | `$cxc-goalplan` + `$cxc-loop` + orchestrate skill-doc reconciliation with shipped L3-L6 reality | DONE | DONE |
| L8 | 080 | Post-loop UX hardening + truth sweep: stale docs, status ledger rows, Stop next-command wording | DONE | DONE |
| L9 | 090 | Subagent/model hardening: spawn-wrapper (L9.1/091), catalog slug parity (L9.2/092), operator CLI (L9.3/093) all shipped+tested | DONE | DONE |
| L10 | 100 | Memory/chat/project/task/worklog parity decision: codex-native scope vs explicit non-goals (chat-search retired L13/WP1) | DONE | DONE |
| L11 | 110 | Developer docs source-of-truth reconciliation + public docs website design record | DONE | PLANNED |
| L12 | 120 | Skill-internal hardening + interview runtime: PostToolUse answer capture (L12.1/121) + rescan-coordinator & goal=PABCD-only boundary (L12.2/122) shipped+tested; I-phase Stop guard dropped (no valid domain) | DONE | DONE |
| L13 | 130 | Truthfulness + interview hardening: chat-search retire (WP1), scan-evidence + soft-gate (WP2), 2-axis status (WP3) | DONE | DONE |
| L14 | 140 | Follow-up patch plan: loop⇄goal activation handoff + `cxc-loop` FSM wiring + dev-* routing enforcement (root-caused, fix deferred to a post-Interview loop) | PLANNED | PLANNED |
| L15 | 150 | Subagent skill-routing attachment (`SpawnPayload.items` + E3/E5 dispatch) — decomposed in 141 | PLANNED | PLANNED |
| L16 | 160 | dev routing STRICT + selective implicit visibility — decomposed in 141 | PLANNED | PLANNED |
| L17 | 170 | Interview runtime honesty + trigger breadth + helper wire/retire — decomposed in 141 | PLANNED | PLANNED |
| L18 | 180 | Status-sync + forbidden-claims + count gates (E8) — decomposed in 141 | PLANNED | PLANNED |
| L19 | 190 | dist packaging contract + test (E8) — decomposed in 141 | PLANNED | PLANNED |
| L20 | 200 | Install/deploy hardening: npx viability, plugin+CLI split, dev symlink, packaging tests | ANALYZED | PLANNED |

## Track status

**mvp_hard parity track — control surface SHIPPED, hardening track ongoing** (2026-06-30).
Status is two-axis (decision-state | impl-state); `DONE` impl means shipped + tested.
L2-L8 are impl-DONE; L9/L11/L12 are decision-DONE with impl PLANNED; L10 is a decision loop
(decision DONE). The cli-jaw `$ + hook` PABCD
control-surface gap from the L1 audit is closed: FSM adjacency + 4-edge attest gate (L2),
chat `$cxc-orchestrate` wire (L3), agent-gated `cxc orchestrate` CLI (L4), phase footer +
chat D-close (L5), bounded Stop-continuation loop (L6), and skill-doc reconciliation (L7).
Tests grew 223 → 281, all green; `cxc doctor` PASS.

**L8 COMPLETE** (2026-06-30). Post-loop UX hardening removed stale shipped-state claims
from README/structure/L5-L7 docs and replaced the Stop-continuation `<next>` placeholder
with concrete phase-specific commands, including `cxc orchestrate reset` for D-close.

**L9 — DONE (impl shipped)** (2026-06-30). The subagent/model hardening runtime is shipped across
three sub-loops: L9.1/091 production spawn-wrapper (`spawn-wrapper.ts` consumes
`resolveSpawnConfig` to build the real `spawn_agent` payload; default mode omits `model`,
override replaces the prompt), L9.2/092 catalog slug parity (`readNativeCacheDefault` reads
`id`||`slug` with dedup; routed `provider/model` ocx slugs selectable), and L9.3/093 operator CLI
(`cxc subagents` get/set over the store + `cxc provider` read-only status). All tested; impl DONE.

**L10 — decision DONE** (2026-06-30). Memory/chat/project/task/worklog parity is now bounded
surface-by-surface: `cxc-search` is public/current lookup, `cxc chat-search` was RETIRED
(D1', L13/WP1) because Codex app-server `thread/search` has no native CLI/agent surface to
wrap and a self-implemented wrapper crosses the L10 "native-only" boundary, tasks map to
native `update_plan`, project state is repo-local `.codexclaw/`, and work evidence remains
devlog plus PABCD ledger. This was a decision/boundary loop; the decision shipped and no
deferred runtime remains in its scope, so impl-state is DONE.

**L11 — decision DONE, impl PLANNED** (2026-06-30). The developer-docs website artifact remains a
research/design record, NOT a shipped docs-site (no astro/starlight build exists), so impl-state
is PLANNED. Source-of-truth wording was reconciled with the current runtime: live `cxc
orchestrate`, Stop continuation, on-demand `cxc-*` skills, detect-only provider bridge, and real
subagent MCP tools.

**L12 — DONE (impl shipped)** (2026-06-30). Skill surfaces validated (L12 base) and the interview
runtime shipped: L13/WP2 added the `.codexclaw/interviews/<sessionId>.jsonl` scan-evidence ledger,
`scanRounds` readiness gate, and the I→P soft-gate; L12.1/121 added `PostToolUse` answer capture
(question_asked/answer_recorded, idempotent by `(turnId,questionId,kind)`); L12.2/122 added the
`rescan-coordinator` signal helper and an explicit goal=PABCD-only interview boundary (regression
guarded). The originally-planned narrow I-phase Stop guard was DROPPED — it had no valid domain
(goal active suppresses the interview; goal inactive must pause for the human per L6). impl DONE.

## Research result

- `010_L1_parity_audit.md` — synthesized parity-gap findings. Original verdict: L1-L28 MVP
  was shipped, but cli-jaw parity was incomplete because chat/CLI phase-control was not wired
  to the FSM. L2-L7 closed that control-surface gap; L8 reconciled the docs and Stop UX.
- `021_L2.1_parallel_parity_sweep.md` — 20-agent read-only sweep across Codex runtime,
  cli-jaw, jawcode, OMO/LazyCodex, opencodex, and codexclaw. Verdict: L2 core FSM/attest
  is no longer the principal gap; highest-leverage work is `$cxc-orchestrate`/`cxc orchestrate`
  state wiring, Stop continuation, then goalplan/loop and deployment/subagent parity.
- `090_L9_subagent_model_hardening.md` — subagent/model parity implementation plan.
  Verdict: current resolver/persistence/MCP/GUI evidence is real, but production spawn-wrapper
  consumption, catalog slug parity, and operator CLI/provider surfaces remain deferred runtime
  work.
- `100_L10_memory_chat_project_worklog_parity.md` — decision boundary for cli-jaw
  memory/chat/project/task/worklog parity. Verdict: no aggregate parity claim; each surface is
  delegated to native Codex, a thin Codex runtime wrapper, project-local state, or an explicit
  non-goal.
- `110_L11_developer_docs_website.md` — 10-agent read-only sweep plus source-of-truth
  reconciliation for developer docs and website design. Verdict: keep the docs-site as a
  deferred Astro/Starlight-style implementation while current docs accurately distinguish
  shipped control surfaces from planned/deferred surfaces.
- `120_L12_skill_internal_hardening.md` — Interview-driven skill hardening record.
  Verdict: `cxc-interview`, `cxc-orchestrate`, `cxc-loop`, and `cxc-goalplan` already exist
  as on-demand Codex skill surfaces; implement `PostToolUse` answer capture,
  session-scoped interview ledger, and narrow I-phase Stop guard in later runtime loops.
- `140_L14_loop_goal_routing_followup.md` — root-cause diagnosis (file:line) of the
  loop⇄goal arming gap, `cxc-loop` prose-vs-runtime contradiction, and narrow dev routing.
- `141_L14_L19_contradiction_patch_plan.md` — decomposition of the
  `structure/30_contradiction_register.md` findings into per-loop work-phases L14-L19,
  each tagged with the strongest available enforcement tier (E1-E8) from
  `structure/40_enforcement_methods.md`. Implementation waits for the L14 Interview round.

## Interview decisions (2026-06-30, locked)

- **Control surface**: `$cxc-orchestrate` ships as a real skill (so `$` autocomplete lists it),
  and the UserPromptSubmit hook parses an inline `orchestrate <phase> [--attest {...}]` token to
  drive `transition()`. Plus `$cxc-loop` + `$cxc-goalplan` skills for the autonomous goal loop.
- **Human vs agent split = invocation source** (cli-jaw uses a boss token; codexclaw has none).
  A chat-submitted `$cxc-orchestrate X` is the human free-pass (advisory, no attest required);
  an agent/CLI-invoked transition is gated (forward edges require `--attest`). The hook can tell
  the two apart because a chat submission and an agent tool-call enter through different paths.
- **Phase footer**: codex has no status UI, so the resting phase is surfaced by a hook-injected
  directive asking the model to print `IPABCD: <phase>` at the end of each reply. The stable
  resting states are `IDLE` and the work phases `I/P/A/B/C`; `D` is a transition that closes a
  work-phase back to IDLE, so it is shown only on the closing turn, never as a resting badge.
- **Architecture hub**: `structure/INDEX.md` documents the codex-runtime → plugin → skills/hooks/CLI
  → `.codexclaw/` state model (created this loop).
- **Continuous Interview**: I phase is main-session-owned. Subagents find contradiction/question
  candidates only; the main session asks via `request_user_input`, records answers, and reruns
  contradiction scans. Runtime answer capture will use `PostToolUse` and a session-scoped
  `.codexclaw/interviews/<sessionId>.jsonl` ledger; Stop guard blocks only pending/high I-phase work.
