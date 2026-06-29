# L17 (Decade 170) -- Dev-Security + Dev-DevOps + Dev-Scaffolding Real-Content Port

Status: ANALYZED
Cluster: 2 (part A) - Phase: expansion - Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/110_dev_skills_porting.md, 024.3_skill_conversion_delta.md, 024.2_cli_jaw_conflict_analysis.md, 021.1_codex_rs_skill_mechanism.md

## Goal (one slice)
Finish Cluster-2 part A by porting the high-risk security, production delivery,
and scaffolding routers as real codexclaw content, absorbing omo refactor,
init-deep, git-master, and the review-work security lane.

## Why now / dependencies
- Upstream: L12-L16 define the universal hub, architecture/debugging,
  backend/data, frontend/UIUX, and quality gates that security/devops/scaffold
  work must obey.
- Security is low-conflict but high-risk; DevOps and scaffolding are higher
  conflict because of cli-jaw task_tags and project-specific structure rules.
- Downstream: L18 unified search can cross-link current external evidence after
  dev-skill real content is stable; L19 rewrites the skill hub after the full
  dev family exists.

## Scope (decision-complete)
Files to add/edit:
- `plugins/codexclaw/skills/dev-security/SKILL.md`
- `plugins/codexclaw/skills/dev-security/agents/openai.yaml`
- `plugins/codexclaw/skills/dev-security/references/*.md`
- `plugins/codexclaw/skills/dev-devops/SKILL.md`
- `plugins/codexclaw/skills/dev-devops/agents/openai.yaml`
- `plugins/codexclaw/skills/dev-devops/references/*.md`
- `plugins/codexclaw/skills/dev-scaffolding/SKILL.md`
- `plugins/codexclaw/skills/dev-scaffolding/agents/openai.yaml`
- `plugins/codexclaw/skills/dev-scaffolding/references/api-docs.md`
- `plugins/codexclaw/skills/dev-scaffolding/references/monorepo-tooling.md`
- `plugins/codexclaw/skills/dev-scaffolding/assets/str_func_template.md`
- `plugins/codexclaw/skills/dev-scaffolding/scripts/scaffold-audit.sh`

Concrete source -> target map:
- `/Users/jun/.cli-jaw-3459/skills/dev-security/SKILL.md` -> `plugins/codexclaw/skills/dev-security/SKILL.md`
- `/Users/jun/.cli-jaw-3459/skills/dev-security/references/*` -> `plugins/codexclaw/skills/dev-security/references/`
- `/Users/jun/.cli-jaw-3459/skills/dev-devops/SKILL.md` -> `plugins/codexclaw/skills/dev-devops/SKILL.md`
- `/Users/jun/.cli-jaw-3459/skills/dev-devops/references/*` -> `plugins/codexclaw/skills/dev-devops/references/`
- `/Users/jun/.cli-jaw-3459/skills/dev-scaffolding/SKILL.md` -> `plugins/codexclaw/skills/dev-scaffolding/SKILL.md`
- `/Users/jun/.cli-jaw-3459/skills/dev-scaffolding/references/*` -> `plugins/codexclaw/skills/dev-scaffolding/references/`
- `/Users/jun/.cli-jaw-3459/skills/dev-scaffolding/assets/*` -> `plugins/codexclaw/skills/dev-scaffolding/assets/`
- `/Users/jun/.cli-jaw-3459/skills/dev-scaffolding/scripts/*` -> `plugins/codexclaw/skills/dev-scaffolding/scripts/`
- `/Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/review-work/SKILL.md` -> `plugins/codexclaw/skills/dev-security/SKILL.md` security review lane
- `/Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/refactor/SKILL.md` -> `plugins/codexclaw/skills/dev-scaffolding/SKILL.md` and cross-links to L13/L16 for codemap/test/review gates
- `/Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/init-deep/SKILL.md` -> `plugins/codexclaw/skills/dev-scaffolding/SKILL.md`
- `/Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/git-master/SKILL.md` -> `plugins/codexclaw/skills/dev-devops/SKILL.md` only where local release/history discipline affects delivery; remote GitHub remains default `github` skill

Exact behavior:
- L4 stubs are activation shells; L17 ports real production/security/scaffold
  content.
- `dev-security` owns auth, authorization, validation policy, secrets,
  dependency trust, PII, supply-chain checks, agentic AI safety, and security
  review lane.
- `dev-devops` owns container builds, CI/CD, Kubernetes, IaC, release pipelines,
  SRE, observability, edge/serverless, and ML infrastructure.
- `dev-scaffolding` owns new project/feature setup, structural audit,
  colocation, public boundary export, source-of-truth docs, and repo-first
  convention reuse.
- omo `refactor` does not become a standalone skill: intent gate/codemap/AST/LSP
  go to architecture/testing/reviewer, while scaffold-level restructuring
  guidance lands here.
- omo `init-deep` is absorbed into scaffolding as existing-repo-first knowledge
  base and AGENTS/convention extraction guidance.
- omo `git-master` contributes only local git/history/commit discipline; remote
  GitHub/PR/CI remains with Codex's default `github` skill.

Must-NOT-Have:
- No hard cli-jaw `task_tags`, `structure/`, `devlog/`, `verify-counts`, or
  `dist/` project-specific mandates.
- No remote GitHub command wrapper inside codexclaw dev skills.
- No separate `refactor`, `init-deep`, or `git-master` codexclaw skills in this
  loop.
- No unsupported frontmatter keys; remove `license` if present in the source or
  current stub frontmatter.

## IPABCD micro-cycle
- I: not interview-bearing unless scaffolding requirements are ambiguous; then
  ask for target project shape before files are created.
- P: map security/devops/scaffold target files and identify all cli-jaw project
  rules to soften into optional repo conventions.
- A: audit angle = "does high-risk guidance preserve safety while avoiding
  cli-jaw-specific project mandates?" Reviewer checks C1/C2/C5/C6/C8/C9.
- B: normalize frontmatter, port bodies/references/assets/scripts, add omo
  absorption paragraphs, and rewrite cross-refs to codexclaw skill names.
- C: run loader validation, forbidden-token grep, and route prompts such as
  "security review", "deploy with Kubernetes", and "scaffold a feature".
- D: done = all three routers contain real content, high-risk gates point to
  L16 testing/review, and no obsolete standalone omo router is created.

## Acceptance (1-3 testable criteria)
1. `dev-security`, `dev-devops`, and `dev-scaffolding` parse with implicit false
   and trigger-rich descriptions.
2. Security, DevOps, and scaffolding reference sets are present or any
   non-portable artifact is explicitly omitted with rationale.
3. Grep under the three dirs finds no cli-jaw runtime/project-specific mandates
   and no new `refactor`, `init-deep`, or `git-master` skill directory.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- node:test frontmatter/openai.yaml validation.
- CLI stdout from `cxc doctor skills` or equivalent loader diagnostic.
- Grep dump for forbidden runtime/project tokens and required reference files.

## Commit unit (one atomic conventional commit)
`feat(skills): port security devops and scaffolding guidance`

## Blocked-on (jun decision id, if any)
None.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/110_dev_skills_porting.md
- 260629_codexclaw_mvp/024.3_skill_conversion_delta.md
- 260629_codexclaw_mvp/024.2_cli_jaw_conflict_analysis.md
- 260629_codexclaw_mvp/021.1_codex_rs_skill_mechanism.md
- /Users/jun/.cli-jaw-3459/skills/dev-security/SKILL.md
- /Users/jun/.cli-jaw-3459/skills/dev-security/references/
- /Users/jun/.cli-jaw-3459/skills/dev-devops/SKILL.md
- /Users/jun/.cli-jaw-3459/skills/dev-devops/references/
- /Users/jun/.cli-jaw-3459/skills/dev-scaffolding/SKILL.md
- /Users/jun/.cli-jaw-3459/skills/dev-scaffolding/references/
- /Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/review-work/SKILL.md
- /Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/refactor/SKILL.md
- /Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/init-deep/SKILL.md
- /Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/git-master/SKILL.md
