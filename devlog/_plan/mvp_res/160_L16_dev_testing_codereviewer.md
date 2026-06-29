# L16 (Decade 160) -- Dev-Testing + Dev-Code-Reviewer Real-Content Port

Status: ANALYZED
Cluster: 2 (part A) - Phase: expansion - Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/110_dev_skills_porting.md, 024.3_skill_conversion_delta.md, 024.2_cli_jaw_conflict_analysis.md, 021.1_codex_rs_skill_mechanism.md

## Goal (one slice)
Port test strategy and code-review guidance as real codexclaw content, absorbing
omo review-work, remove-ai-slops, comment-checker, and shared visual/regression
verification rules.

## Why now / dependencies
- Upstream: L12 supplies verification gates; L13-L15 supply architecture,
  debugging, backend/data, and UI surfaces that tests and reviews evaluate.
- L16 is the quality gate for the whole dev-skill port: it defines regression
  locks, visual QA ownership, review verdicts, and post-edit feedback handling.
- Downstream: L17 security/devops/scaffolding relies on test/review gates for
  high-risk release and structure changes.

## Scope (decision-complete)
Files to add/edit:
- `plugins/codexclaw/skills/dev-testing/SKILL.md`
- `plugins/codexclaw/skills/dev-testing/agents/openai.yaml`
- `plugins/codexclaw/skills/dev-testing/references/backend-testing.md`
- `plugins/codexclaw/skills/dev-testing/references/ci-pipeline.md`
- `plugins/codexclaw/skills/dev-testing/references/edge-first-testing.md`
- `plugins/codexclaw/skills/dev-testing/references/load-testing.md`
- `plugins/codexclaw/skills/dev-testing/references/ml-evaluation.md`
- `plugins/codexclaw/skills/dev-testing/scripts/with_server.py`
- `plugins/codexclaw/skills/dev-testing/examples/*.py`
- `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md`
- `plugins/codexclaw/skills/dev-code-reviewer/agents/openai.yaml`
- `plugins/codexclaw/skills/dev-code-reviewer/references/ai-assisted-review.md`
- `plugins/codexclaw/skills/dev-code-reviewer/references/tech-debt.md`

Concrete source -> target map:
- `/Users/jun/.cli-jaw-3459/skills/dev-testing/SKILL.md` -> `plugins/codexclaw/skills/dev-testing/SKILL.md`
- `/Users/jun/.cli-jaw-3459/skills/dev-testing/references/*` -> `plugins/codexclaw/skills/dev-testing/references/`
- `/Users/jun/.cli-jaw-3459/skills/dev-testing/scripts/*` -> `plugins/codexclaw/skills/dev-testing/scripts/`
- `/Users/jun/.cli-jaw-3459/skills/dev-testing/examples/*` -> `plugins/codexclaw/skills/dev-testing/examples/`
- `/Users/jun/.cli-jaw-3459/skills/dev-code-reviewer/SKILL.md` -> `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md`
- `/Users/jun/.cli-jaw-3459/skills/dev-code-reviewer/references/*` -> `plugins/codexclaw/skills/dev-code-reviewer/references/`
- `devlog/.lazycodex/plugins/omo/skills/review-work/SKILL.md` -> `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md`, `dev-testing/SKILL.md`, and L17 `dev-security`
- `devlog/.lazycodex/plugins/omo/skills/remove-ai-slops/SKILL.md` -> `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md` anti-pattern catalog plus `dev-testing` regression-first invariant
- `devlog/.lazycodex/plugins/omo/skills/comment-checker/SKILL.md` -> `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md` feedback handling
- `devlog/.lazycodex/plugins/omo/skills/visual-qa/SKILL.md` -> `plugins/codexclaw/skills/dev-testing/SKILL.md` visual/TUI verification procedure
- `devlog/.lazycodex/plugins/omo/skills/programming/SKILL.md` -> `plugins/codexclaw/skills/dev-testing/SKILL.md` red-green-refactor and regression lock rules

Exact behavior:
- L4 router stubs only activated the skills; L16 ports full testing and review
  process content.
- `dev-testing` owns test strategy, TDD, regression locking, backend/API
  harnesses, contract verification, Playwright/E2E, CI, coverage, visual QA,
  and browser/TUI verification.
- `dev-code-reviewer` owns review process, severity, verdicts, anti-pattern
  catalog, tech debt, AI-assisted review, context mining, and feedback response.
- omo `review-work` is split: goal/code-quality/context mining to reviewer,
  hands-on QA to testing, security lane to L17 security.
- omo `remove-ai-slops` is split: taxonomy to reviewer, boundary cleanup to L13
  architecture, regression-first cleanup to testing.

Must-NOT-Have:
- No "orchestrated sub-agents" or "Injected when testing task_tags" phrasing.
- No separate `review-work`, `remove-ai-slops`, `comment-checker`, or
  `visual-qa` skill directories in this loop.
- No review rubber-stamping: inconclusive remains a valid C/D outcome when proof
  is missing.
- No unsupported frontmatter keys.

## IPABCD micro-cycle
- I: not interview-bearing.
- P: map test/reference files and review/reference files, then mark omo
  absorption by ownership lane.
- A: audit angle = "does each quality rule have one owner, and are visual QA and
  slop cleanup regression-first?" Reviewer checks C1/C2/C4/C6/C8/C9.
- B: normalize frontmatter, port testing/review bodies and references, add
  regression-first and feedback-handling sections, and cross-link security lane
  to L17.
- C: run loader validation, forbidden-token grep, and route prompts such as
  "add tests", "review this diff", and "remove AI slop" against skill discovery.
- D: done = tests/review routers contain real content, omo quality rules are
  absorbed in the right owners, and no obsolete router skill is added.

## Acceptance (1-3 testable criteria)
1. `dev-testing` and `dev-code-reviewer` parse with implicit false and
   trigger-rich descriptions.
2. Testing references/scripts/examples and review references are present or any
   non-portable artifact is explicitly omitted with rationale in the skill text.
3. Grep under both dirs finds no cli-jaw runtime commands and no new absorbed
   omo skill directories.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- node:test frontmatter/openai.yaml validation.
- CLI stdout from `cxc doctor skills` or equivalent loader diagnostic.
- Grep dump for forbidden runtime tokens and required testing/review files.

## Commit unit (one atomic conventional commit)
`feat(skills): port testing and code review guidance`

## Blocked-on (jun decision id, if any)
None.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/110_dev_skills_porting.md
- 260629_codexclaw_mvp/024.3_skill_conversion_delta.md
- 260629_codexclaw_mvp/024.2_cli_jaw_conflict_analysis.md
- 260629_codexclaw_mvp/021.1_codex_rs_skill_mechanism.md
- /Users/jun/.cli-jaw-3459/skills/dev-testing/SKILL.md
- /Users/jun/.cli-jaw-3459/skills/dev-testing/references/
- /Users/jun/.cli-jaw-3459/skills/dev-code-reviewer/SKILL.md
- /Users/jun/.cli-jaw-3459/skills/dev-code-reviewer/references/
- devlog/.lazycodex/plugins/omo/skills/review-work/SKILL.md
- devlog/.lazycodex/plugins/omo/skills/remove-ai-slops/SKILL.md
- devlog/.lazycodex/plugins/omo/skills/comment-checker/SKILL.md
- devlog/.lazycodex/plugins/omo/skills/visual-qa/SKILL.md
