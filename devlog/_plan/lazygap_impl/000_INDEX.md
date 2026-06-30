# lazygap_impl — Harness Reinforcement Implementation Track (CANONICAL INDEX)

Status: CANONICAL INDEX (scaffolding; no code shipped yet) · 2026-07-01 · follows `../lazygap/` research

> `../lazygap/` (000-010) is the read-only parity sweep + the codex-rs capability verification.
> This track turns the two **trust+routing** gaps it ranked #1/#2 into shippable PABCD loops.
> Runtime feasibility is no longer assumed — it is verified in `../lazygap/010` against codex-rs.
>
> Scope of THIS track (locked by user): the dispatch spine only.
>   - decade 010 = SubagentStop evidence-receipt gate (`../lazygap/002`)
>   - decade 020 = skill-attached base-role dispatch (`../lazygap/008`, the core ask)
> Decades 030+ (goalplan/Stop-depth/compaction/rules/search/friction) stay PROPOSED in
> `../lazygap/009`; they are NOT scaffolded here until 010/020 ship.

## Naming convention (inherited from mvp_hard)

- `000` = this INDEX. Each loop owns a decade: `010`, `020`, ...
- Decade head doc `0X0_<slug>.md`; finer sub-passes `0X1_<slug>.md`.
- Directory sort order == execution order. `cxc` is the primary shorthand in examples.
- DONE = shipped + tested only. No doc-only "done".

## Constraints (LOCKED — inherited from philosophy + mvp_hard)

- No codex-rs fork. No server / daemon. No new subagent roles (skill attachment instead).
- No goal-DB writes. All new state is project-local under `.codexclaw/`.
- Every new hook must FAIL-OPEN (or fail-closed only where R-9 already mandates it): a hook
  error must never trap a session or break a spawn it cannot rewrite.
- A-phase of every loop MUST dispatch a gpt-5.4 explorer for contradiction/blocker review.
- Atomic conventional commits; push/reset/force forbidden without explicit approval.

## Dependency order (why 010 before 020)

`020` (skill-attached dispatch) is only trustworthy if a dispatched child cannot fake "done".
`010` (SubagentStop receipt gate) supplies that trust. So 010 ships first, 020 second, and
020's acceptance includes "a skill-attached reviewer returns a receipt the 010 gate accepts".

Known coupling to resolve in P (verified by review): `010` matches on the child's `agent_type`,
but codexclaw only emits `worker` (executor) and `explorer` (BOTH explorer AND reviewer) —
`ROLE_AGENT_TYPE` (`spawn-wrapper.ts:27-31`). So `agent_type` alone can't separate a write-review
from a read-only explore. 010 starts by gating `^worker$`; if reviewers must also be gated, `020`
stamps a distinguishing marker the gate reads. Decide jointly before either loop ships.

## Loop ledger

| Loop | decade | scope | lazygap src | surface | tier | impl-state |
| --- | --- | --- | --- | --- | --- | --- |
| 010 | 010 | SubagentStop evidence-receipt gate (7th hook) | `lazygap/002` + `010` | SubagentStop | E1 | DONE |
| 020 | 020 | Skill-attached base-role dispatch (`items` + role×intent map + E3 hook) | `lazygap/008` + `010` | PreToolUse `^spawn_agent$` (v1) / E5 builder | E3+E5 | DONE |

## Runtime facts both loops rely on (from `../lazygap/010`, codex-rs verified)

- `SubagentStop` is a real hook event; fires on plugin thread-spawned children; stdin carries
  `agent_type`, `agent_id`, `transcript_path`, `last_assistant_message`; `decision:"block"` +
  `reason` forces the child to continue. (`protocol.rs:1355`, `schema.rs:578-595`,
  `hook_runtime.rs:294-355`, `stop.rs:263-274`.)
- `^spawn_agent$` PreToolUse fires for `multi_agent_v1__spawn_agent` + default v2; `updatedInput`
  is applied pre-dispatch but ONLY on `permissionDecision == allow`. v1 accepts an injected
  `items` field; v2 is `deny_unknown_fields` and rejects it. (`registry.rs:502,523,727-734`,
  `output_parser.rs:162`, `multi_agents/spawn.rs:218-221`, `multi_agents_v2/spawn.rs:243-244`.)

## What already exists (do not rebuild)

- `subagent-config/src/spawn-wrapper.ts` already ships the E5 builder half of 020:
  `SURFACE_SKILL`, `ROLE_BASE_SKILLS`, `buildSpawnItems`, `SpawnPayload.items`,
  `resolveSpawnPayloadWithSkills`. 020 EXTENDS this (role×intent map + the E3 hook), it does
  not start from zero. See `structure/10_subagent_skill_routing.md`.
- The pabcd-state CLI hook dispatcher (`components/pabcd-state/src/cli.ts`) is the pattern for
  adding a new `hook subagent-stop` event branch.
- `.codexclaw/` evidence/ledger conventions exist (`freeze.ts`, interview ledger); 010 reuses
  the `--evidence` convention rather than inventing a new one.
