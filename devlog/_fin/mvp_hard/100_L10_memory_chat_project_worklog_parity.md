# L10 / 100 - Memory, Chat, Project, Task, and Worklog Parity Decision

Status: DONE (decision boundary) - 2026-06-30 - mvp_hard loop L10

> SUPERSEDED-IN-PART (L13/WP1, 2026-06-30): the `cxc chat-search` wrapper described below
> was later RETIRED (D1'). Codex app-server `thread/search` has no native CLI/agent surface,
> so wrapping it made codexclaw a self-implemented search surface. Chat lookups now route
> through the `cxc-search` skill. The text below is the original L10 decision record and is
> kept for history; for the live command surface see `structure/INDEX.md` (CLI Surface).
>
> SUPERSEDED-IN-PART (owner directive, 2026-07-02, `devlog/_plan/260702_codex_recall/`):
> the "no `cxc memory`/no chat search" boundary below is re-scoped via L10's own escape
> hatch ("unless a later loop explicitly designs a Codex-native replacement"). The
> `recall` component ships `cxc chat search` / `cxc memory search` as read-only readers
> of Codex-native disk artifacts (`sessions/*.jsonl`, `state_<N>.sqlite`, `memories/`).
> The app-server `thread/search` wrapper remains a non-goal, and codexclaw still owns no
> memory/chat store of its own.

> Scope: record the codex-native boundary for cli-jaw memory/chat/project/task/worklog
> parity. This is a docs-only decision pass. It does not add runtime commands, stores,
> dashboard integrations, or fallback services.

## Verdict

Do not claim aggregate "memory/chat/project/task/worklog parity" with cli-jaw.
codexclaw is a Codex plugin layer, not a jaw server. Each surface must be documented
as either a Codex-native delegation, a thin wrapper over a Codex runtime endpoint, or
an explicit non-goal.

The allowed model is:

- public/current lookup -> `cxc-search`;
- prior Codex thread snippets -> `cxc chat-search`, backed only by Codex app-server
  `thread/search`;
- per-turn task sequencing -> native Codex `update_plan`;
- project state -> project-local `.codexclaw/` files under the current repo;
- PABCD work evidence -> `devlog/_plan/` plus `.codexclaw/ledger.jsonl`.

Everything else from cli-jaw's server-backed memory, dashboard, project registry, task
store, and worklog systems is out of scope unless a later loop explicitly designs a
Codex-native replacement.

## Surface Decisions

| Surface | codexclaw in-scope | Explicitly out of scope |
|---|---|---|
| Memory | Native Codex memory, when the host runtime exposes it. codexclaw does not wrap or store it. | No `cxc memory`; no `memory search/read/save/context`; no `.codexclaw/memory`; no dashboard or cross-instance federation. |
| Chat search | RETIRED (D1', L13/WP1): the `cxc chat-search` wrapper and `cxc-ops/src/chat-search.ts` were removed. Codex's native `thread/search` has no codexclaw CLI/agent surface (non-goal); use the `cxc-search` skill for public-web lookups instead. | No `cxc chat-search`; no local chat indexer; no chat database; no fallback to `cli-jaw chat search`; no hidden app-server startup; no dashboard chat federation. |
| Public/current search | `cxc-search` skill for external, current, real-time, and public-web lookup discipline. | Not a memory or chat search tool; no cli-jaw progrok/web-AI/Exa/Tavily/Perplexity/Brave provider promise. |
| Project root | Resolve from the active repo/cwd and write project-local `.codexclaw/sessions/<id>.json`, `.codexclaw/ledger.jsonl`, `.codexclaw/subagents.json`. | No global `cxc project set/list/clear`; no codexclaw server-side project registry; no durable project selection outside the repo. |
| Tasks | Use Codex `update_plan` for current-turn planning and progress visibility. | No `cxc task`; no `.codexclaw/tasks.json`; no owner assignment, ordering DAG, cross-session task list, or dashboard task board. |
| Worklog | Use numbered `devlog/_plan/` docs for durable plan/decision records and `.codexclaw/ledger.jsonl` for PABCD transition evidence. | No general cli-jaw worklog database; no automatic per-task worklog command; no dashboard notes connector; no channel delivery system. |

## Required Wording Rules

Use these phrases:

- "delegated to native Codex memory" instead of "memory parity";
- "`thread/search` wrapper only" instead of "chat parity";
- "project-local `.codexclaw/` state" instead of "project parity";
- "`update_plan` only; no persistence" instead of "task parity";
- "PABCD transition ledger and repo docs" instead of "worklog parity";
- "public/current lookup" for `cxc-search`, never "memory search".

Terms such as server-owned, daemon, dashboard, cross-instance, global registry, and
persistent task store are allowed only in explicit OUT/future/deferred sections.

## Evidence Anchors

- Task mapping decision: `devlog/_plan/mvp_res/201_L20.1_task_update_plan_mapping.md`
- Chat wrapper decision (now RETIRED): `devlog/_plan/mvp_res/204_L20.4_cxc_chat_search_wrapper.md`
- Chat wrapper source: REMOVED (was `plugins/codexclaw/components/cxc-ops/src/chat-search.ts`; retired D1', L13/WP1)
- Search skill scope: `plugins/codexclaw/skills/search/SKILL.md`
- Architecture/state source: `structure/INDEX.md`
- PABCD state source: `plugins/codexclaw/components/pabcd-state/src/state.ts`
- PABCD transition/ledger source: `plugins/codexclaw/components/pabcd-state/src/fsm.ts` (`transition()`/`nextPhase()`) + `appendLedger()` in `state.ts`

## Verification Contract

L10 is complete when the following pass:

```bash
test -f devlog/_plan/mvp_hard/100_L10_memory_chat_project_worklog_parity.md
rg -n "L10|100_L10_memory_chat_project_worklog_parity" devlog/_plan/mvp_hard/000_INDEX.md
rg -n 'No `cxc memory`|thread/search|No local chat indexer|project-local `.codexclaw/`|No `cxc task`|PABCD transition ledger' devlog/_plan/mvp_hard/100_L10_memory_chat_project_worklog_parity.md
! rg -n 'case "(memory|task|project|worklog)"|cxc (memory|task|project|worklog)' bin/codexclaw.mjs plugins/codexclaw/components
node --test plugins/codexclaw/components/cxc-ops/test/cxc-ops.test.ts
# chat-search retired (D1', L13/WP1): assert it is GONE, not callable
! rg -n 'case "chat-search"' bin/codexclaw.mjs
test ! -f plugins/codexclaw/components/cxc-ops/src/chat-search.ts
git diff --check
```

Expected grep result for forbidden CLI registrations: no matches. Expected
`chat-search` failure result with port `1`: a clear `chat-search unavailable: ...`
message, with no fallback to jaw, filesystem grep, dashboard APIs, or local indexing.

## Follow-Up Boundaries

- L11 may document these decisions in public developer docs, but must preserve the
  shipped/planned distinction.
- L12+ may harden skill guidance around Interview and loop surfaces, but must not
  introduce memory/task/project/worklog commands by implication.
- L20 may handle install/deploy/npx/symlink packaging, but package installation must not
  silently configure memory, dashboard, task, or project registries.
