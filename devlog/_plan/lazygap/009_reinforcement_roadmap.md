# 009 — Reinforcement Roadmap (synthesis)

Status: PLANNED (decision input; no code this pass) · evidence: 001-008

> Synthesis of the lazygap parity sweep into a priority-ordered reinforcement plan, each
> gap mapped to an enforcement tier (`structure/40_enforcement_methods.md`) and a proposed
> loop. The steering principle holds throughout: reinforce by skill attachment + hook
> surfaces, never by adding subagent roles.

## Priority matrix

| Rank | Gap (doc) | Tier | New surface? | Why this rank |
| --- | --- | --- | --- | --- |
| 1 | Subagent evidence gate (`002`) | E1 (SubagentStop block) | YES — SubagentStop | biggest hole; makes every dispatch trustworthy; unblocks `008` |
| 2 | Skill-attached dispatch (`008`) | E3/E5 | maybe (`^spawn_agent$`) | the user's core ask; turns the rich `$cxc-*` family into real routing |
| 3 | Loop/goalplan state (`001`) | E2 + E8 | no (file) | substrate for work-aware Stop + quality gate |
| 4 | Stop continuation depth (`003`) | E2 | no | makes the loop actually know what's left; needs `001` |
| 5 | Compaction recovery (`006`) | E4 | YES — PostCompact | cheap, high-value resilience |
| 6 | Rules + edit checks (`004`) | E4 + E1 | maybe (edit PostToolUse) | discipline becomes runtime, not prose |
| 7 | Search engine + research (`007`) | E1/E8 + E5 | no (bundled script) | large but self-contained; ast-grep-style port |
| 8 | Code intelligence (`005`) | N/A | no | confirmed non-goal; discoverability nudge only |

## Proposed loops (extends the L14-L19 plan in mvp_hard/141)

| Loop | Decade | lazygap source | Slice |
| --- | --- | --- | --- |
| L15 | 150 | `008` | `SpawnPayload.items` + role/intent->skill map + builder routing |
| (within L15) | | `002` | SubagentStop evidence-receipt gate (the trust half of dispatch) |
| L17 | 170 | `003` honesty | loop/interview prose downgraded to match the hook |
| L21 | 210 | `001` | durable `.codexclaw/goalplan.json` + criterion evidence + quality-gate validate |
| L22 | 220 | `003` | work-aware Stop continuation on goalplan remaining tasks |
| L23 | 230 | `006` | PostCompact recovery hook |
| L24 | 240 | `004` | rule-injector + comment-lint PostToolUse |
| L25 | 250 | `007` | **agbrowse adapt** (lazy proof helper + Tier-2 rewrite) + ultraresearch protocol reference |
| L27 | 270 | `011` | friction ledger (E1/E2 gate) + workspace-context block + seed ontology schema |

> L15/L17 already exist in `mvp_hard/141`; `002` folds into L15 as its trust half.
> L21-L25 are the new lazygap-driven loops. Sequencing: `002`+`008` first (trust +
> routing), then `001`->`003` (loop substrate -> work-aware Stop), then `006`/`004`/`007`.
>
> L27 is the cli-jaw second-sweep loop. `011`'s friction ledger is the single new
> **runtime** gate (E1/E2) and the PostToolUse hook already exists, so it ranks high.
> The chat-search drift fix (`012`) folds into the next L17-class honesty pass — it's a
> doc edit backed by an already-passing test, not its own loop.

## Enforcement-tier ledger (what becomes truly enforced)

- New SubagentStop hook -> E1 receipt block (`002`).
- New PostCompact hook -> E4 recovery directive (`006`).
- New edit PostToolUse -> E1 comment-lint block (`004`).
- `^spawn_agent$` input-rewrite -> E3 skill attach (`008`) IF the matcher exists; verify first.
- goalplan validate + search bias gate -> E8 (`001`, `007`).
- Everything still prose-only today is E7 and must stop being called "enforced".

## Hard non-goals (carried from `structure/00_philosophy.md` §2)

- No LSP daemon / codegraph MCP / search server (`005`).
- No SessionStart auto-update / telemetry / provisioning (`006`).
- No new subagent roles — skill attachment instead (`008`).
- No goal-DB writes — goalplan state is project-local `.codexclaw/` (`001`).

## Open questions for the L14 Interview (carried forward)

1. Does the Codex runtime expose a `^spawn_agent$` (or `multi_agent_v1__spawn_agent`)
   PreToolUse matcher? Decides E3 vs E5 for `008`.
2. Does `SubagentStop` fire for plugin-spawned subagents in this Codex build, with the
   child's final text available? Decides whether `002` is E1 or only doctrine.
3. Evidence-receipt convention: reuse omo's `EVIDENCE_RECORDED: <path>`, or codexclaw's
   existing `--evidence` ledger convention?

---

## cli-jaw built-in tools — can we port them? (the original question)

> Not a lazycodex/omo comparison. cli-jaw's real tool surface is `bin/commands/` (37
> commands). codexclaw's is `cxc` (`bin/codexclaw.mjs`: enable/uninstall/status/doctor/
> reset/orchestrate/freeze/gui/subagents/provider) + the hook layer. The question is which
> cli-jaw commands can move into codexclaw's single-plugin, no-server model — and which are
> structurally bound to cli-jaw being a server + agent-CLI orchestrator.

Three buckets, grounded in what each command needs to run:

### A. Portable (no-server, fits codexclaw today)

| cli-jaw command | what it does | codexclaw target |
| --- | --- | --- |
| `orchestrate [P/A/B/C/D/status/reset]` | PABCD phase transitions + attest | **already ported** — `cxc orchestrate` + attest gate (parity DONE, see `011`) |
| `doctor` | environment/health checks | **already present** — `cxc doctor` |
| `reset` | clear local workflow state | **already present** — `cxc reset` |
| `goal [set/plan/status/update/done]` | goal lifecycle | partial — codexclaw uses host goal mode + `.codexclaw/`; the *plan/criteria* half maps to `001` goalplan, not a goal-DB write |
| `skill` | list/inspect skills | portable — read `plugins/codexclaw/skills/*`; thin `cxc skill list` is in-philosophy |
| `project [set/list]` | project-root registry | portable as **stateless** resolver (workspace-context, `011`); cli-jaw's durable registry is the non-goal part |
| `init` | scaffold local config | portable — maps to `cxc enable` install flow |
| `hooks` | list/inspect hooks | portable — read `.codex-plugin/plugin.json`; diagnostic only |

### B. Partial / reshaped (capability fits, mechanism changes)

| cli-jaw command | why it can't move as-is | codexclaw shape |
| --- | --- | --- |
| `dispatch` / `worker` | spawn + monitor + session-resume of agent-CLI workers via a run-store | replaced by Codex `spawn_agent` subagents; no worker run-store/monitor (`011` table, by design) |
| `history` / `chat-search` | query the `messages`/thread index (server + SQLite) | host Codex owns thread search; codexclaw's own `chat-search` was retired (`012` drift fix) |
| `task` | durable task DB | mapped to host `update_plan` (decided in `mvp_res/201`), not a DB |
| `browser` / `browser-web-ai` | cli-jaw browse layer | **adapt agbrowse** lazily instead of reimplementing (`007` update) |

### C. Non-portable (structurally server / external-agent bound)

`serve` / `service` / `dashboard` / `dashboard-chat` / `dashboard-memory` (HTTP server +
federation), `memory` / `reminders` (server + index + scheduler), `employee` / `clone`
(persistent agent-CLI roster), `bgtask` / `launchd` (OS daemon/long-running tasks),
`connector` / `mcp` (MCP server management), `lock` (server-side concurrency), `provider`
(codexclaw keeps this **detect-only**, not management). These all assume cli-jaw is a
running server that spawns and supervises agent CLIs — exactly the boundary
`structure/00_philosophy.md` §2 rules out.

### Takeaway

The valuable, in-philosophy carry-overs are mostly **already done** (`orchestrate`/
`doctor`/`reset`) or already planned under a different name (`goal`/`project`->goalplan +
workspace-context in `001`/`011`, `browser`->agbrowse in `007`). The big remaining
*command-shaped* item is the friction/dispatch discipline, which lands as hook logic
(`011`), not a new `cxc` subcommand. Bucket C is not a backlog — it's the no-server line.
