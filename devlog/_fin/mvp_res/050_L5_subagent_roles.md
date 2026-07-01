# L5 (Decade 050) -- Subagent Roles

Status: DONE
Cluster: 1 - Phase: 1 - Shorthand: cxc
Source-of-record: 025_subagent_as_employee.md; 025.1_pass5_P_plan.md; STATUS.md

## Goal (one slice)
Ship the Phase 1 subagent role source files for `explorer`, `reviewer`, and `executor`, using B-opt2
inline instructions rather than relying on plugin-provided role auto-registration.

## Why now / dependencies
L5 depends on L4 because each role references `dev` and the matching dev-* router skills. It unblocks
L7 S5, which verifies that role configs are spawn-valid on the default model and that the inline
injection contract is documented.

## Scope (decision-complete)
- Files added/edited:
  - `plugins/codexclaw/agents/explorer.toml`
  - `plugins/codexclaw/agents/reviewer.toml`
  - `plugins/codexclaw/agents/executor.toml`
  - `plugins/codexclaw/agents/README.md`
- Role shape:
  - `name`
  - `description`
  - `nickname_candidates`
  - `model = "default"`
  - `developer_instructions`
- Role mapping:
  - `explorer` maps to Codex built-in `explorer` agent_type, read-only.
  - `reviewer` maps to Codex built-in `explorer` agent_type, read-only adversarial review.
  - `executor` maps to Codex built-in `worker` agent_type, scoped writes.
- B-opt2 contract:
  - these TOML files are canonical prompt sources.
  - Phase 1 injects their content inline in `spawn_agent({ agent_type, message })`.
  - plugin manifest role discovery is not assumed because the manifest has no `agents` field.
- Model policy:
  - Phase 1 inherits the parent model via `model = "default"`.
  - Phase 2 may override role model settings through GUI/ocx catalog work.
- Must-NOT-Have:
  - No invalid `read_only` key.
  - No assumption that plugin roles auto-register.
  - No multi-model selection in Phase 1.
  - No write permission for explorer/reviewer roles.

## IPABCD micro-cycle
- I (if interview-bearing): not interview-bearing; role prompts can support future interview/audit work.
- P: planned three Phase 1 roles with B-opt2 inline injection and default-model inheritance.
- A: audit source-verified that Codex plugin manifests do not expose an `agents` field; this confirmed
  B-opt2 as the robust Phase 1 path and led to README citation/doc fixes.
- B: enriched the three role TOMLs, removed the invalid `read_only` key, and documented the role to
  built-in agent_type mapping.
- C: light verification parsed the TOML-like role fields, checked README contract, and re-ran the
  unchanged pabcd-state regression at 52/52; final Phase 1 total stayed `npm test` 73/73.
- D: done = role source files are present, default-model spawn-valid, and explicitly inline-injected.

## Acceptance (1-3 testable criteria)
- `explorer`, `reviewer`, and `executor` role files contain required metadata and developer instructions.
- `agents/README.md` documents B-opt2 inline injection and role-to-agent_type mapping.
- L7 S5 can truthfully claim spawn-valid default-model config, not live auto-registration.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- Pass 5 light gate: three TOMLs plus README verified for required fields and contract.
- L7 S5: role configs parse with default model and README inline-injection contract holds.
- Final Phase 1 regression: root `npm test` 73/73.

## Commit unit (one atomic conventional commit)
One role commit: enrich explorer/reviewer/executor TOMLs and add the B-opt2 agents README.

## Blocked-on (jun decision id, if any)
None for Phase 1. Plugin role auto-registration remains a future proof point, not a Phase 1 blocker.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- `devlog/_plan/260629_codexclaw_mvp/025_subagent_as_employee.md`
- `devlog/_plan/260629_codexclaw_mvp/025.1_pass5_P_plan.md`
- `plugins/codexclaw/agents/README.md`
- `plugins/codexclaw/agents/explorer.toml`
- `plugins/codexclaw/agents/reviewer.toml`
- `plugins/codexclaw/agents/executor.toml`
- codex-rs `core/src/agent/role.rs` and plugin manifest shape.
