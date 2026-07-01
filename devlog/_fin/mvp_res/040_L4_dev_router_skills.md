# L4 (Decade 040) -- dev-* Router Skills

Status: DONE
Cluster: 1 - Phase: 1 - Shorthand: cxc
Source-of-record: 024_dev_skills_conversion.md; 024.3_skill_conversion_delta.md; 024.4_pass4_P_plan.md; STATUS.md

## Goal (one slice)
Ship the Phase 1 Codex-native dev skill set: `dev` as the always-on hub, eleven on-demand router
skills, and `pabcd` as the workflow skill that folds in dev-pabcd discipline.

## Why now / dependencies
L4 depends on the hook/state loops being stable enough to describe the workflow in skills. It unblocks
L5 because the subagent role prompts route through these skills, and it unblocks L7 skill discovery
validation.

## Scope (decision-complete)
- Files added/edited under `plugins/codexclaw/skills/`:
  - `dev/`
  - `dev-architecture/`
  - `dev-backend/`
  - `dev-code-reviewer/`
  - `dev-data/`
  - `dev-debugging/`
  - `dev-devops/`
  - `dev-frontend/`
  - `dev-scaffolding/`
  - `dev-security/`
  - `dev-testing/`
  - `dev-uiux-design/`
  - `pabcd/`
- `dev` policy:
  - `agents/openai.yaml` has `allow_implicit_invocation: true`.
  - This is the only implicit skill after the B3 wiring-gap fix.
- Router policy:
  - surface skills are on-demand and referenced by prompt, role, or trigger.
  - `pabcd/agents/openai.yaml` has `allow_implicit_invocation:false` after B3.
- Conversion rules:
  - frontmatter uses Codex skill schema: `name`, `description`, `metadata.short-description`.
  - cli-jaw runtime paths and boss/employee implementation details are stripped.
  - relevant `references/`, `scripts/`, `assets/`, and `examples/` are copied when part of the skill.
- Recipe anchor:
  - `dev-debugging` locked the conversion pattern before bulk porting.
- Must-NOT-Have:
  - No cli-jaw-only dispatch commands as required runtime behavior.
  - No `keywords` or `search_terms` in frontmatter.
  - No partial subset of the decided 13 skills.
  - No second implicit skill besides `dev`.

## IPABCD micro-cycle
- I (if interview-bearing): not interview-bearing; these are skill routing artifacts.
- P: planned all 13 active dev skills, not a pilot subset, with `dev-debugging` as the recipe anchor.
- A: audits found two blockers before build: imprecise grep gate and incomplete whole-directory copy;
  both were fixed in the Pass 4 plan before implementation completed.
- B: four parallel worker groups ported router skill folders; the main agent handled `dev`, `pabcd`,
  and README/policy alignment.
- C: Pass 4 C-gate verified frontmatter against Codex loader constraints, zero precise cli-jaw gate
  findings, and no dangling copied references; final Phase 1 kept `npm test` 73/73.
- D: done = 13 skill directories are present, valid, and policy-aligned with `dev` as the only
  implicit invocation skill.

## Acceptance (1-3 testable criteria)
- Exactly 13 Phase 1 skills exist, each with `SKILL.md` and valid Codex frontmatter.
- `dev` is implicit; `pabcd` and the router skills are non-implicit/on-demand.
- No shipped skill depends on cli-jaw runtime commands as its execution mechanism.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- Pass 4 C-gate skill validation: frontmatter valid, precise cli-jaw gate empty.
- L7 build validator: skills directory present and every skill dir has `SKILL.md`.
- Final Phase 1 regression: root `npm test` 73/73.

## Commit unit (one atomic conventional commit)
Skill conversion commits were grouped by router surface plus hub/workflow policy; the loop unit is the
complete 13-skill Phase 1 skill set.

## Blocked-on (jun decision id, if any)
None.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- `devlog/_plan/260629_codexclaw_mvp/024_dev_skills_conversion.md`
- `devlog/_plan/260629_codexclaw_mvp/024.3_skill_conversion_delta.md`
- `devlog/_plan/260629_codexclaw_mvp/024.4_pass4_P_plan.md`
- `plugins/codexclaw/skills/README.md`
- `plugins/codexclaw/skills/dev/SKILL.md`
- `plugins/codexclaw/skills/pabcd/SKILL.md`
- codex-rs `core-skills/loader.rs` skill frontmatter constraints.
