# lazygap — lazycodex(omo) Parity & jaw-Harness Reinforcement

Status: RESEARCH (000-009 parity record) · 2026-06-30 · evidence: 3 parallel explorers (Darwin/Beauvoir/Plato)

> This track answers one question: **where does codexclaw's jaw-style harness fall
> short of lazycodex/omo, and how do we reinforce it within the no-server philosophy?**
> Every gap row is backed by file:line evidence from a read-only sweep of both trees.
>
> omo tree: `devlog/.lazycodex/plugins/omo/`
> codexclaw tree: `plugins/codexclaw/`
> Philosophy + enforcement vocabulary: `structure/00_philosophy.md`,
> `structure/40_enforcement_methods.md` (tiers E1-E8).

---

## Steering principle (LOCKED by user, 2026-06-30)

**Do NOT grow the subagent role roster. Reinforce by attaching `$cxc-*` skills to the
three base roles.** omo specializes by inventing many roles (librarian/plan/momus/metis/
gate-reviewer/qa-executor/...). codexclaw already has a rich `$cxc-*` skill family, so
specialization travels as a **skill attachment**, not a new role.

> The dispatch pattern we want: "act as a reviewer, **red-team this per `cxc-dev` +
> `cxc-dev-frontend`**" — the expertise is the attached skill, the role stays one of the
> three base roles (`explorer`/`reviewer`/`executor`).

So any "add roles" suggestion from the sweep (Plato's role-split row) is explicitly
**rejected** for codexclaw. The gap it points at (reviewer overloaded) is real, but the
fix is skill attachment (L15 routing), not more TOMLs.

---

## The three harness layers omo enforces and codexclaw mostly documents

| Layer | omo enforcement | codexclaw today | doc |
| --- | --- | --- | --- |
| Loop / goalplan state | durable `UlwLoopPlan` + checkpoint + quality-gate (code) | single FSM `State`; goalplan/quality-gate are prose | `001` |
| Subagent evidence | `SubagentStop` receipt gate (`.omo/evidence`, block on missing) | no `SubagentStop` hook at all | `002` |
| Stop continuation | task-unit + remaining-work aware, also on `SubagentStop` | coarse FSM-only (`phase/goal/stopBlockCount`) | `003` |
| Project rules | rules-engine load/match on 3 hook events | none | `004` |
| Edit-time checks | `comment-checker` PostToolUse block | prose in `dev/SKILL.md` only | `004` |
| Code intelligence | LSP daemon + codegraph MCP | ast-grep one-shot (deliberate) | `005` |
| Compaction recovery | 3 `PostCompact` hooks | none (UserPromptSubmit re-inject only) | `006` |
| Search / browsing | insane-search engine + R1-R7 + bias_check CI | 3-tier prose ladder | `007` |
| Deep research | ultraresearch EXPAND swarm + journal | Tier 3 one paragraph | `007` |
| Prompt guardrails | first-line marker + authority override + CI gate | prose invariants only | `008` |

## Second sweep — cli-jaw parity (010-012)

A 7-explorer parallel sweep (2026-06-30) widened the comparison from omo to **cli-jaw**
itself: `skills_ref/` meta-skills, `src/orchestrator/*`, and `src/memory/*`.

| Layer | cli-jaw has | codexclaw today | doc |
| --- | --- | --- | --- |
| Context-economy meta-skills | context-budget / agent-harness / compression / eval | none (dev-family only) | `010` |
| Friction ledger | sha256(tool:error) retry->escalate->stop + oscillation | none (PostToolUse hook unused for this) | `011` |
| Seed ontology | structured entity/relationship/invariant + render | label-only string | `011` |
| Workspace-context | project-root resolve + path-hint + symlink-escape block | prose only | `011` |
| Plan auto-inject | server inlines approved plan into each spawn | doctrine only (runtime force impossible) | `011` |
| Memory (3-tier) | History/Flush/Snapshot/index/HTTP/federation | non-goal (mostly server-bound) | `012` |
| Browse/search proof | insane-search engine | **adapt agbrowse** (lazy, no-server) | `007` update |

---

## Document map (000-009)

(010-012 added by the cli-jaw second sweep; see the table above.)

| Doc | Scope |
| --- | --- |
| `000_INDEX.md` | this file: steering principle + parity matrix + reading order |
| `001_loop_goalplan_state.md` | durable goalplan/checkpoint/quality-gate schema gap |
| `002_subagent_evidence_gate.md` | `SubagentStop` evidence receipt gate (the biggest harness hole) |
| `003_stop_continuation_depth.md` | task-unit + work-remaining aware Stop continuation |
| `004_rules_and_edit_checks.md` | project-rules injector + comment/edit-time checks |
| `005_code_intelligence.md` | LSP/codegraph vs ast-grep (mostly a confirmed non-goal) |
| `006_compaction_recovery.md` | `PostCompact` recovery hook |
| `007_search_and_research.md` | insane-search engine port + ultraresearch depth |
| `008_skill_attached_dispatch.md` | skill-attached base-role dispatch (the user's core ask) |
| `009_reinforcement_roadmap.md` | synthesis: gap -> E-tier -> proposed loop, with non-goals |
| `010_cli_jaw_skill_backlog.md` | cli-jaw `skills_ref` meta-skill import backlog (context-economy) |
| `011_pabcd_orchestration_parity.md` | Seed / Friction / workspace-context / plan-inject parity |
| `012_memory_parity_nongoal.md` | memory = confirmed non-goal + chat-search drift fix |

---

## How each gap maps to an enforcement tier (preview; full table in 009)

- E1 PreToolUse deny — already used (goal budget, interview-in-goal).
- E2 Stop block — loop continuation spine (003), needs goalplan state (001).
- E3 PreToolUse input rewrite — the untapped lever: `^spawn_agent$` to attach skills (008).
- **NEW surface — SubagentStop** — codexclaw has zero; this is the single highest-value
  add (002), and it is the omo `lazycodex-executor-verify` pattern translated.
- E8 out-of-band gate — search bias_check, status-sync, count gates (007, and `structure/40`).

## Non-goals reaffirmed (no-server philosophy, `structure/00_philosophy.md` §2)

- No LSP daemon, no codegraph MCP, no search server — ast-grep one-shot stays the answer (005).
- No auto-update / telemetry / provisioning at SessionStart — provider bridge stays detect-only (006).
- No new subagent roles — skill attachment instead (008).
- codexclaw never writes the goal DB — goalplan state lives in `.codexclaw/`, not `thread_goals` (001).
