# lazygap — lazycodex(omo) Parity & jaw-Harness Reinforcement

Status: RESEARCH (000-010 parity record; 010 runtime-VERIFIED) · 2026-07-01 · evidence: 3
parity explorers (Darwin/Beauvoir/Plato) + 2 codex-rs verification explorers (Euclid/Descartes)

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

### Second steering lens — the host-native boundary (LOCKED, 2026-06-30)

Before classing any cli-jaw/omo feature as a "gap", ask **who owns it under Codex**.
cli-jaw and omo are their own orchestrators/servers, so they must build goal mode, cwd
resolution, skill discovery, hook dispatch, memory, and worker supervision themselves.
codexclaw runs **on top of the Codex runtime**, which provides those natively. So a
missing `cxc` command is usually **not** a gap — it is a responsibility the host already
owns. codexclaw adds a `cxc` command only where Codex has no equivalent (PABCD attest,
config enable, freeze handoff). Every parity row below is filtered through this lens:
`host-native` (do nothing), `no-server file/hook import` (real work), or
`server-bound non-goal` (the boundary line).

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

## Second sweep — cli-jaw parity (folded into 001/006/007/009)

A 7-explorer parallel sweep (2026-06-30) widened the comparison from omo to **cli-jaw**
itself. The original question was narrow: **can cli-jaw's built-in tools (`bin/commands/`,
37 commands) move into codexclaw?** The portability verdict (A portable / B reshaped /
C server-bound) lives in `009`. The framing answer: cli-jaw needs those commands because
it **is its own orchestrator**; codexclaw runs **on the Codex runtime**, which already owns
goal mode, cwd, skills, and hooks, so most have nothing to port. The orchestrator-internals
and memory parity that fell out of that comparison are folded into `001` (addendum) and
`006` (addendum) to keep this track inside 000-009.

| Layer | cli-jaw has | codexclaw today | doc |
| --- | --- | --- | --- |
| Built-in tool surface | 37 `bin/commands/` (cli-jaw is its own orchestrator) | `cxc` adds only what Codex lacks; goal/cwd/skills/hooks are host-native | `009` (port verdict) |
| Friction ledger | sha256(tool:error) retry->escalate->stop + oscillation | none (PostToolUse hook unused for this) | `001` addendum |
| Seed ontology | structured entity/relationship/invariant + render | label-only string | `001` addendum |
| Workspace-context dispatch path-hint | path-hint + symlink-escape on spawn (NOT a project registry — cwd is host-native) | prose only | `001` addendum |
| Plan auto-inject | server inlines approved plan into each spawn | doctrine only (runtime force impossible) | `001` addendum |
| Memory (3-tier) | History/Flush/Snapshot/index/HTTP/federation | non-goal (mostly server-bound) | `006` addendum |
| Browse/search proof | insane-search engine | **adapt agbrowse** (lazy, no-server) | `007` update |

---

## Document map (000-009)

(The cli-jaw second sweep folded into `001`/`006` addenda + `007`/`009`; this track stays 000-009.)

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
| `010_runtime_capability_verification.md` | codex-rs source-of-truth: SubagentStop (E1) + `^spawn_agent$` (E3 v1 / E5 v2) verified — closes 009's two open questions |

---

## How each gap maps to an enforcement tier (preview; full table in 009)

- E1 PreToolUse deny — already used (goal budget, interview-in-goal).
- E2 Stop block — loop continuation spine (003), needs goalplan state (001).
- E3 PreToolUse input rewrite — VERIFIED lever (`010`): `^spawn_agent$` fires + `updatedInput`
  can add `items` on the v1 spawn surface; v2 rejects it (`deny_unknown_fields`), so E5 fallback.
- **NEW surface — SubagentStop** — codexclaw has zero; RUNTIME-VERIFIED real (`010`) and the
  single highest-value add (002), the omo `lazycodex-executor-verify` pattern translated.
- **NEW surface — SubagentStart** — also confirmed to exist (`010`); unscheduled future entry
  point to inject the attached-skill TASK contract at child-spawn time.
- E8 out-of-band gate — search bias_check, status-sync, count gates (007, and `structure/40`).

## Non-goals reaffirmed (no-server philosophy, `structure/00_philosophy.md` §2)

- No LSP daemon, no codegraph MCP, no search server — ast-grep one-shot stays the answer (005).
- No auto-update / telemetry / provisioning at SessionStart — provider bridge stays detect-only (006).
- No new subagent roles — skill attachment instead (008).
- Goal-DB writes are gated, not banned (REVISED 2026-07-01). The earlier "codexclaw never writes
  the goal DB" was imprecise: the runtime DOES expose `thread/goal/set` (app-server JSON-RPC,
  same channel chat-search used for `thread/search`) — `Session::set_thread_goal` create+update,
  needs `Feature::Goals` on, bound to the current `conversation_id`. So the rule is now: codexclaw
  writes the host goal ONLY at the interview freeze approval boundary (the existing HITL gate),
  NEVER self-arms a goal mid-loop. The decomposed work-item state (workPhases/tasks/criteria/
  evidence) still lives in project-local `.codexclaw/goalplan.json` — the host record only carries
  `{objective, status, token_budget}`, so goalplan stays the local backbone regardless (001).
