# L12 (Decade 120) -- Dev Hub + PABCD Real-Content Port

Status: ANALYZED
Cluster: 2 (part A) - Phase: expansion - Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/110_dev_skills_porting.md, 024.3_skill_conversion_delta.md, 024.2_cli_jaw_conflict_analysis.md, 021.1_codex_rs_skill_mechanism.md

## Goal (one slice)
Replace the Phase-1 L4 router-shell treatment for the always-on development
core with real codexclaw content: `dev` becomes the universal discipline hub,
and cli-jaw `dev-pabcd` is absorbed into the existing `pabcd` skill instead of
shipping as a separate `dev-pabcd` skill.

## Why now / dependencies
- Upstream: L4 created the dev-* router skill directories and proved the Codex
  loader shape. L12 starts the real-content port that L13-L17 build on.
- Upstream: L1-L3 provide codexclaw directives and native ThreadGoal integration;
  L5 provides subagent roles that replace cli-jaw employee wording.
- Downstream: L13-L17 need `dev` as the owner of classifier, safety, static
  analysis, verification gate, and local git discipline before they add surface
  rules.

## Scope (decision-complete)
Files to add/edit:
- `plugins/codexclaw/skills/dev/SKILL.md`
- `plugins/codexclaw/skills/dev/agents/openai.yaml`
- `plugins/codexclaw/skills/pabcd/SKILL.md`
- `plugins/codexclaw/skills/pabcd/agents/openai.yaml`

Concrete source -> target map:
- `/Users/jun/.cli-jaw-3459/skills/dev/SKILL.md` -> `plugins/codexclaw/skills/dev/SKILL.md`
- `/Users/jun/.cli-jaw-3459/skills/dev-pabcd/SKILL.md` -> `plugins/codexclaw/skills/pabcd/SKILL.md`
- `/Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/comment-checker/SKILL.md` -> `plugins/codexclaw/skills/dev/SKILL.md` completion-gate sentence only
- `/Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/programming/SKILL.md` -> `plugins/codexclaw/skills/dev/SKILL.md` strict typing/static-analysis discipline
- `/Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/git-master/SKILL.md` -> `plugins/codexclaw/skills/dev/SKILL.md` local git discipline only
- `/Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/ultraresearch/SKILL.md` -> `plugins/codexclaw/skills/dev/SKILL.md` guard separating ordinary context gathering from explicit deep research

Exact behavior:
- `dev` is implicit-on in `openai.yaml`; all other dev surface skills remain
  on-demand unless their own loop says otherwise.
- Keep the C0-C5 classifier as self-assessment, not cli-jaw `task_tags`.
- Rewrite boss/employee/dispatch/bgtask/goal-server wording to main agent,
  subagent, background subagent polling, and codexclaw/codex-native goals.
- `pabcd` absorbs `dev-pabcd`; do not create `plugins/codexclaw/skills/dev-pabcd/`.
- Add dev-pabcd's depth table, work-phase terminology, anti-skip rule,
  delegation model, long verification pattern, and root-resolution rule to
  `pabcd`.

Must-NOT-Have:
- No literal `cli-jaw orchestrate`, `cli-jaw dispatch`, `cli-jaw bgtask`, or
  `cli-jaw project` instructions.
- No hardcoded `/Users/jun/.cli-jaw-3459` paths in shipped skill text.
- No `metadata.keywords`, top-level `keywords`, `license`, or unsupported
  frontmatter fields.
- No separate `dev-pabcd` skill except a future compatibility stub if explicitly
  approved.

## IPABCD micro-cycle
- I: not interview-bearing; source decisions are already resolved in 110 and
  024.3. Ask only if a conflict appears between codex loader schema and source
  content.
- P: diff-level plan = convert `dev` frontmatter/body, add `agents/openai.yaml`
  implicit policy, merge `dev-pabcd` into `pabcd`, and grep for cli-jaw runtime
  leaks.
- A: audit angle = "does the always-on hub preserve universal discipline while
  removing cli-jaw runtime assumptions?" Reviewer role checks C1-C8 conflicts
  from 024.2 and verifies no standalone `dev-pabcd` route exists.
- B: port the body in sections: classifier, fast path, rule classes, overlays,
  pre-write search, verification, safety, static analysis, local git, then
  PABCD additions. Keep L4 router-stub content only where it is already correct.
- C: run frontmatter schema validation, grep for forbidden cli-jaw tokens, and
  inspect `cxc doctor`/skill-presence output once that diagnostic exists.
- D: done = `dev` loads implicitly, `pabcd` contains the merged dev-pabcd
  content, and no unsupported frontmatter or cli-jaw runtime command remains.

## Acceptance (1-3 testable criteria)
1. `dev` and `pabcd` SKILL.md files use only `name`, `description`, and
   `metadata.short-description` frontmatter; `dev` policy is implicit true.
2. `rg "cli-jaw|orchestrate|dispatch|bgtask|devlog/|verify-counts" plugins/codexclaw/skills/dev plugins/codexclaw/skills/pabcd` has no runtime-command leaks except historical references inside plan docs are irrelevant.
3. `pabcd` documents that L4 router stubs were only activation shells and that
   L12 supplies the real discipline content for future loops.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- node:test fixture for SKILL.md frontmatter and `agents/openai.yaml` policy.
- CLI stdout from `cxc doctor skills` or equivalent loader diagnostic.
- Grep data dump for forbidden cli-jaw runtime tokens under the two target dirs.

## Commit unit (one atomic conventional commit)
`feat(skills): port dev hub and merge pabcd discipline`

## Blocked-on (jun decision id, if any)
None. Q-CONV-1 and Q-CONV-2 are resolved by 110: `dev` is always-on, and
`dev-pabcd` folds into `pabcd`.

## Resolved (jun 2026-06-30)
- Decision: codexclaw uses the canonical `pabcd` skill name and Codex built-in ThreadGoal runtime; `dev-pabcd` remains source material only and is not a shipped skill.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/110_dev_skills_porting.md
- 260629_codexclaw_mvp/024.3_skill_conversion_delta.md
- 260629_codexclaw_mvp/024.2_cli_jaw_conflict_analysis.md
- 260629_codexclaw_mvp/021.1_codex_rs_skill_mechanism.md
- /Users/jun/.cli-jaw-3459/skills/dev/SKILL.md
- /Users/jun/.cli-jaw-3459/skills/dev-pabcd/SKILL.md
- /Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/comment-checker/SKILL.md
- /Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/programming/SKILL.md
- /Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/git-master/SKILL.md
- /Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/ultraresearch/SKILL.md
