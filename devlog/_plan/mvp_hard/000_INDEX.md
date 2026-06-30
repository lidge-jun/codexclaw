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

| Ln | decade | scope | status |
|----|--------|-------|--------|
| L1 | 010 | Parity audit: cli-jaw/jawcode/omo vs codexclaw, `$`+hook UX gap map | DONE |
| L2 | 020 | FSM legal-transition table + four-transition attest gate | DONE |
| L3 | 030 | `$cxc-orchestrate` grammar (030/L3a) + hook wiring to `transition()` — the missing wire (031/L3b) | DONE |
| L4 | 040 | `cxc orchestrate` CLI over the same file state (agent-gated path) | DONE |
| L5 | 050 | `status` / `reset` / `D` chat affordances + phase footer directive + ledger-on-transition | DONE |
| L6 | 060 | Stop-continuation loop with omo termination guards + bounded stagnation guard | DONE |
| L7 | 070 | `$cxc-goalplan` + `$cxc-loop` + orchestrate skill-doc reconciliation with shipped L3-L6 reality | DONE |
| L8 | 080 | Post-loop UX hardening + truth sweep: stale docs, status ledger rows, Stop next-command wording | DONE |
| L9 | 090 | Subagent/model hardening: OMO role variants, spawn-wrapper config application, ocx catalog read-only integration | PROPOSED |
| L10 | 100 | Memory/chat/project/worklog parity decision: codex-native scope vs explicit non-goals | PROPOSED |
| L11 | 110 | Developer docs + public docs website: Starlight-style IA, jawdev-style reference docs, visual system, verification gates | PLANNED |
| L12 | 120 | Skill-internal hardening: cxc-interview/orchestrate/loop/goalplan skeletons + continuous Interview runtime plan | PLANNED |
| L20 | 200 | Install/deploy hardening: npx viability, plugin+CLI split, dev symlink, packaging tests | PROPOSED |

## Track status

**mvp_hard parity track L2-L7 COMPLETE** (2026-06-30). The cli-jaw `$ + hook` PABCD
control-surface gap from the L1 audit is closed: FSM adjacency + 4-edge attest gate (L2),
chat `$cxc-orchestrate` wire (L3), agent-gated `cxc orchestrate` CLI (L4), phase footer +
chat D-close (L5), bounded Stop-continuation loop (L6), and skill-doc reconciliation (L7).
Tests grew 223 → 281, all green; `cxc doctor` PASS.

**L8 COMPLETE** (2026-06-30). Post-loop UX hardening removed stale shipped-state claims
from README/structure/L5-L7 docs and replaced the Stop-continuation `<next>` placeholder
with concrete phase-specific commands, including `cxc orchestrate reset` for D-close.

## Research result

- `010_L1_parity_audit.md` — synthesized parity-gap findings. Original verdict: L1-L28 MVP
  was shipped, but cli-jaw parity was incomplete because chat/CLI phase-control was not wired
  to the FSM. L2-L7 closed that control-surface gap; L8 reconciled the docs and Stop UX.
- `021_L2.1_parallel_parity_sweep.md` — 20-agent read-only sweep across Codex runtime,
  cli-jaw, jawcode, OMO/LazyCodex, opencodex, and codexclaw. Verdict: L2 core FSM/attest
  is no longer the principal gap; highest-leverage work is `$cxc-orchestrate`/`cxc orchestrate`
  state wiring, Stop continuation, then goalplan/loop and deployment/subagent parity.
- `110_L11_developer_docs_website.md` — 10-agent read-only sweep for developer docs and
  website design. Verdict: build an Astro/Starlight-style docs site with a codexclaw-specific
  developer-control visual system, source-checked reference pages, explicit current/planned
  badges, and docs/site verification gates.
- `120_L12_skill_internal_hardening.md` — Interview-driven skill hardening plan and skeleton
  record. Verdict: add discoverable `cxc-interview`, `cxc-orchestrate`, `cxc-loop`, and
  `cxc-goalplan` surfaces now; implement `PostToolUse` answer capture, session-scoped
  interview ledger, and narrow Stop guard in later runtime loops.

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
