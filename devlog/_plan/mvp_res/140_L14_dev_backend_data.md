# L14 (Decade 140) -- Dev-Backend + Dev-Data Real-Content Port

Status: ANALYZED
Cluster: 2 (part A) - Phase: expansion - Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/110_dev_skills_porting.md, 024.3_skill_conversion_delta.md, 024.2_cli_jaw_conflict_analysis.md, 021.1_codex_rs_skill_mechanism.md

## Goal (one slice)
Port backend/API/database and data engineering guidance from cli-jaw into
codexclaw real skill content, while absorbing the relevant omo `programming`
rules for strict typing, boundary validation, and parse-don't-validate.

## Why now / dependencies
- Upstream: L12 supplies the universal `dev` classifier and static-analysis
  owner; L13 supplies architecture boundary rules used by backend and data work.
- Backend and data skills are medium-conflict ports: the core content is
  reusable, but role-injection and subagent wording must be normalized.
- Downstream: L15 frontend integration, L16 test/review gates, and L17 security
  and DevOps need stable API/data ownership boundaries.

## Scope (decision-complete)
Files to add/edit:
- `plugins/codexclaw/skills/dev-backend/SKILL.md`
- `plugins/codexclaw/skills/dev-backend/agents/openai.yaml`
- `plugins/codexclaw/skills/dev-backend/scripts/README.md`
- `plugins/codexclaw/skills/dev-backend/scripts/scaffold-audit.sh`
- `plugins/codexclaw/skills/dev-data/SKILL.md`
- `plugins/codexclaw/skills/dev-data/agents/openai.yaml`
- `plugins/codexclaw/skills/dev-data/references/governance.md`
- `plugins/codexclaw/skills/dev-data/references/ml-pipeline.md`
- `plugins/codexclaw/skills/dev-data/references/streaming.md`
- `plugins/codexclaw/skills/dev-data/references/tools.md`

Concrete source -> target map:
- `/Users/jun/.cli-jaw-3459/skills/dev-backend/SKILL.md` -> `plugins/codexclaw/skills/dev-backend/SKILL.md`
- `/Users/jun/.cli-jaw-3459/skills/dev-backend/scripts/*` -> `plugins/codexclaw/skills/dev-backend/scripts/`
- `/Users/jun/.cli-jaw-3459/skills/dev-data/SKILL.md` -> `plugins/codexclaw/skills/dev-data/SKILL.md`
- `/Users/jun/.cli-jaw-3459/skills/dev-data/references/*` -> `plugins/codexclaw/skills/dev-data/references/`
- `/Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/programming/SKILL.md` -> `plugins/codexclaw/skills/dev-backend/SKILL.md` and `plugins/codexclaw/skills/dev-data/SKILL.md`
- `/Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/programming/references/code-smells.md` -> backend/data review notes only when language-level smells affect API or pipeline boundaries

Exact behavior:
- L4 router stubs define activation; L14 ports the real backend/data bodies and
  references.
- `dev-backend` description routes endpoint, REST, GraphQL, schema, migration,
  query, cache, OTel, Result pattern, and worker-queue surfaces.
- Keep process-isolation `worker` language only as runtime worker/queue concept,
  explicitly not cli-jaw employee dispatch.
- `dev-data` description routes ETL/ELT, pipeline, warehouse, SQL performance,
  validation, backfill, schema drift, and metrics surfaces.
- omo `programming` adds strict types, boundary-only validation, branded/domain
  primitives, exhaustive matching, and parse-don't-validate. It does not become
  a separate `dev-language` skill.

Must-NOT-Have:
- No "Injected when role=backend/data" wording.
- No cli-jaw employee, orchestrator, or dispatch assumptions.
- No unsupported frontmatter keys.
- No language router skill split; language-specific rules stay absorbed into
  `dev`, `dev-testing`, `dev-architecture`, and this loop's backend/data skills.

## IPABCD micro-cycle
- I: not interview-bearing.
- P: define target backend and data sections, identify copied scripts/references,
  and mark which programming rules belong to API/data boundaries.
- A: audit angle = "does validation ownership stay boundary-only and does data
  guidance avoid backend overreach?" Reviewer checks conflicts C1/C2/C4/C8/C9.
- B: normalize frontmatter, port bodies and references, rewrite cross-skill refs
  to codexclaw names, and add `programming` absorption paragraphs where they
  affect typed contracts and validation placement.
- C: run loader/frontmatter validation, forbidden-token grep, and route prompts
  such as "add REST endpoint" and "debug ETL backfill" against skill discovery.
- D: done = backend/data content is real, target references exist, and the docs
  clearly separate L4 routing from L14 source-content porting.

## Acceptance (1-3 testable criteria)
1. `dev-backend` and `dev-data` parse with implicit false and trigger-rich
   descriptions.
2. Data reference files from cli-jaw are present in codexclaw; backend scripts
   are present or deliberately documented as omitted if not portable.
3. Grep under both target dirs finds no cli-jaw runtime terms and no standalone
   `programming` skill was added.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- node:test frontmatter/openai.yaml validation.
- CLI stdout from `cxc doctor skills` or equivalent loader diagnostic.
- Grep dump for forbidden runtime tokens and required source-reference files.

## Commit unit (one atomic conventional commit)
`feat(skills): port backend and data development guidance`

## Blocked-on (jun decision id, if any)
None.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/110_dev_skills_porting.md
- 260629_codexclaw_mvp/024.3_skill_conversion_delta.md
- 260629_codexclaw_mvp/024.2_cli_jaw_conflict_analysis.md
- 260629_codexclaw_mvp/021.1_codex_rs_skill_mechanism.md
- /Users/jun/.cli-jaw-3459/skills/dev-backend/SKILL.md
- /Users/jun/.cli-jaw-3459/skills/dev-backend/scripts/
- /Users/jun/.cli-jaw-3459/skills/dev-data/SKILL.md
- /Users/jun/.cli-jaw-3459/skills/dev-data/references/
- /Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/programming/SKILL.md
- /Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/programming/references/code-smells.md
