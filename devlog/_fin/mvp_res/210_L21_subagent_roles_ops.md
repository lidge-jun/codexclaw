# L21 (Decade 210) -- Subagent Role .toml + Diagnostics/Ops

Status: DONE
Cluster: 3 · Phase: expansion · Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/140_subagent_roles_ops.md (J6), 090.1 J-8/J-9/J-14

## Goal (one slice)
Define how omo agent roles (.toml), teammode, and diagnostics/ops components map
onto the codexclaw subagent role system (Pass 5 B-opt2 inline), and which ops
pieces feed `cxc doctor`/`cxc reset`. MVP keeps three inline roles --
`explorer`, `reviewer`, `executor` -- with omo's 10 roles absorbed as prompt
variants, not new first-class roles.

## Why now / dependencies
- Upstream: L5 (Pass 5 inline subagent roles) and L20 (`cxc doctor`/`reset`
  scaffold) must exist; L18 `search` feeds the librarian/external-research variant.
- Downstream: provides the role taxonomy that Phase 2 (L24 subagent config store,
  L27 GUI subagent page) promotes to first-class registered roles.

## Scope (decision-complete)
Role mapping (J-8 inline-only, J-14 unified taxonomy + prefix):
- omo `.toml` schema (name/description/nickname_candidates/model/
  model_reasoning_effort/service_tier/developer_instructions) maps cleanly to
  codex agent-role files, BUT MVP reads `.toml` as source-of-truth only and
  injects `developer_instructions` inline via `spawn_agent({message})`. No config
  `[agents]` install; no plugin-manifest agents field (unverified pickup).
- explorer <- omo `explorer` (read-only local search; Codex-native tool names).
- explorer (external variant) <- omo `librarian` (OSS/docs, SHA-pinned permalinks;
  wired to L18 search hub).
- reviewer <- omo `metis` (gap/risk), `momus` (plan gate),
  `lazycodex-code-reviewer`, `lazycodex-gate-reviewer`,
  `lazycodex-clone-fidelity-reviewer` (frontend/design variant).
- executor <- omo `lazycodex-executor` (smallest correct change, evidence),
  `lazycodex-qa-executor` (real-surface QA variant, no product edits unless asked).
- omo `plan` role: not a default subagent role; absorbed into the PABCD Plan-phase
  helper.
- Unified taxonomy: ops roles (explorer/reviewer/executor) and Pass-8 `mind-*`
  roles share one namespace via prefix (`mind-*` vs functional role). MVP keeps
  both inline; Phase 2 GUI promotes them to first-class.

teammode: NOT adopted in MVP. It requires durable Codex threads
(`codex_app.create_thread`), `.omo/teams` state, title-hygiene hooks, and
worktree integration -- far beyond MVP scope. MVP uses `spawn_agent`/`wait_agent`
inline subagents only; team mode is a later feature-flagged extension.

Diagnostics/ops absorbed into `cxc doctor`/`cxc reset` (L20):
- From `lcx-doctor`: evidence-bound PASS/WARN/FAIL report template, latest-source
  sync + install/config/plugin/runtime drift comparison, known-issue lookup with
  debugging handoff (no bare "reinstall").
- From telemetry: ONLY the failure-isolation pattern (hook failure logs to local
  JSONL, never blocks startup). No PostHog analytics / daily-active events in MVP
  (no privacy/consent/endpoint policy yet).
- From `test-support`: package/hook/MCP/plugin manifest JSON fixture validators
  reused as codexclaw packaging smoke-test helpers.
- `lcx-report-bug` / `lcx-contribute-bug-fix`: deferred follow-up skills, not
  doctor/reset core.

git-bash / test-support native substitution:
- git-bash: codex-native shell suffices; add a Windows reminder hook only if a
  shell problem is actually observed. `git-bash-mcp` is a binary/vendor component,
  not an MVP design basis.
- test-support: absorb as test utilities rather than replace.

Must-NOT-Have:
- No tool allowlist enforcement of "read-only" (J-9: prompt-only discipline +
  output contract "return findings, do not edit").
- No config `[agents]` role registration in MVP (J-8 inline-only).
- No teammode durable-thread machinery in MVP.
- No telemetry analytics endpoint in MVP.

## IPABCD micro-cycle
- I: not interview-bearing.
- P: encode 3 inline role templates with omo-variant prompt blocks; fold
  lcx-doctor report template into `cxc doctor`; add test-support-style validators.
- A: audit angle = "do read-only roles stay prompt-enforced, and does any role
  path assume config registration codexclaw skipped?" reviewer checks J-8/J-9.
- B: write role prompt templates + variants; extend `cxc doctor` with the
  drift/known-issue sections; port fixture validators into the test harness.
- C: spawn an explorer subagent inline, confirm read-only output contract; run
  `cxc doctor` and confirm lcx-style PASS/WARN/FAIL with drift section.
- D: done = 3 inline roles with documented variants, doctor enriched, teammode
  explicitly deferred.

## Acceptance (1-3 testable criteria)
1. `spawn_agent` with an inline explorer/reviewer/executor template runs and the
   reviewer returns findings only (no edits) -- prompt-enforced.
2. `cxc doctor` includes a source-drift + known-issue section (lcx-doctor pattern).
3. node:test fixture validators (package/hook/MCP/plugin manifest) pass on the
   codexclaw plugin payload.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- node:test for fixture validators + role template presence.
- CLI stdout of `cxc doctor`; transcript dump of an inline subagent run.

## Commit unit (one atomic conventional commit)
`feat(roles): inline explorer/reviewer/executor variants and lcx-doctor ops port`

## Blocked-on (jun decision id, if any)
None. J-8 (inline-only), J-9 (prompt-only read-only), J-14 (unified taxonomy +
prefix) resolved. teammode deferral is a scope decision, not an open question.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/140_subagent_roles_ops.md (J6 full analysis)
- codex-rs/core/src/config/agent_roles.rs:217,295 (role metadata parse)
- codex-rs/core/src/agent/role.rs:32,250 (role layer precedence, locked settings)
- codex-rs/core/src/agent/role_tests.rs:348 (per-role model override)
- devlog/.lazycodex/plugins/omo/components/ultrawork/agents/explorer.toml:1
- devlog/.lazycodex/plugins/omo/skills/lcx-doctor/SKILL.md:12,44,70
- devlog/.lazycodex/plugins/omo/components/teammode/skills/teammode/SKILL.md:14,83
