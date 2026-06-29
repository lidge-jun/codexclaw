# L15 (Decade 150) -- Dev-Frontend + Dev-UIUX-Design Real-Content Port

Status: ANALYZED
Cluster: 2 (part A) - Phase: expansion - Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/110_dev_skills_porting.md, 024.3_skill_conversion_delta.md, 024.2_cli_jaw_conflict_analysis.md, 021.1_codex_rs_skill_mechanism.md

## Goal (one slice)
Port frontend implementation and UI/UX design guidance into real codexclaw
skill bodies, absorbing omo frontend and visual QA rules without creating
separate designpower router skills in this loop.

## Why now / dependencies
- Upstream: L12 gives universal development discipline; L13 gives boundaries;
  L14 stabilizes backend/data contracts that UI work consumes.
- Frontend is medium/high conflict because the cli-jaw source includes some
  structure/devlog coupling and role-injection phrasing.
- Downstream: L16 needs frontend visual-verification hooks and L17 needs secure
  delivery/scaffolding to reference UI conventions consistently.

## Scope (decision-complete)
Files to add/edit:
- `plugins/codexclaw/skills/dev-frontend/SKILL.md`
- `plugins/codexclaw/skills/dev-frontend/agents/openai.yaml`
- `plugins/codexclaw/skills/dev-frontend/scripts/README.md`
- `plugins/codexclaw/skills/dev-frontend/scripts/init-artifact.sh`
- `plugins/codexclaw/skills/dev-frontend/scripts/bundle-artifact.sh`
- `plugins/codexclaw/skills/dev-frontend/examples/README.md`
- `plugins/codexclaw/skills/dev-uiux-design/SKILL.md`
- `plugins/codexclaw/skills/dev-uiux-design/agents/openai.yaml`
- `plugins/codexclaw/skills/dev-uiux-design/references/*.md`

Concrete source -> target map:
- `/Users/jun/.cli-jaw-3459/skills/dev-frontend/SKILL.md` -> `plugins/codexclaw/skills/dev-frontend/SKILL.md`
- `/Users/jun/.cli-jaw-3459/skills/dev-frontend/scripts/*` -> `plugins/codexclaw/skills/dev-frontend/scripts/`
- `/Users/jun/.cli-jaw-3459/skills/dev-frontend/examples/*` -> `plugins/codexclaw/skills/dev-frontend/examples/`
- `/Users/jun/.cli-jaw-3459/skills/dev-uiux-design/SKILL.md` -> `plugins/codexclaw/skills/dev-uiux-design/SKILL.md`
- `/Users/jun/.cli-jaw-3459/skills/dev-uiux-design/references/*` -> `plugins/codexclaw/skills/dev-uiux-design/references/`
- `/Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/frontend/SKILL.md` -> `plugins/codexclaw/skills/dev-frontend/SKILL.md` and cross-link to `dev-uiux-design`
- `/Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/visual-qa/SKILL.md` -> `plugins/codexclaw/skills/dev-frontend/SKILL.md` visual-fidelity notes and L16 testing verification
- `/Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/visual-qa/references/agent-browser-setup.md` -> `plugins/codexclaw/skills/dev-frontend/SKILL.md` or `dev-testing` cross-reference, not a new router
- `/Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/frontend/` designpower routing concepts -> `plugins/codexclaw/skills/dev-uiux-design/` where they are design-judgment, not implementation

Exact behavior:
- L4 stubs are router shells; L15 ports full content and references.
- `dev-frontend` owns component architecture, styling, responsive layout,
  animation, accessibility, SEO, performance, anti-slop UI, CJK layout, and
  production-surface verification.
- `dev-uiux-design` owns intent discovery, product vocabulary, product
  personalities, UX states, typography line breaks, favicon/logo, color, visual
  hierarchy, and design judgment.
- omo `frontend` contributes DESIGN.md gate, real-browser verification,
  Lighthouse/Playwright posture, brand/taste references, and no-emoji icon
  cautions.
- omo `visual-qa` contributes objective screenshot/TUI evidence, dual-oracle
  review, image-diff/TUI diff concepts, and CJK clipping/alignment checks.

Must-NOT-Have:
- No top-level `keywords` or unsupported frontmatter.
- No "Injected when role=frontend" wording.
- No hard cli-jaw `structure/` or `devlog/` requirements.
- No separate codexclaw `frontend`, `visual-qa`, or designpower skill family in
  this loop.

## IPABCD micro-cycle
- I: not interview-bearing except when design intent is ambiguous; then
  `dev-uiux-design` asks focused intent questions before implementation.
- P: map frontend implementation sections and UI/UX design references, then
  identify exactly which omo frontend/visual-qa concepts are absorbed.
- A: audit angle = "does design judgment stay in UIUX while implementation and
  verification stay in frontend/testing?" Reviewer checks C1/C2/C5/C8/C9.
- B: normalize frontmatter, port bodies/references/scripts/examples, rewrite
  cross-refs to codexclaw names, and add visual-verification integration text.
- C: run loader validation, forbidden-token grep, and route prompts such as
  "redesign this page" and "make the empty state better" against skill discovery.
- D: done = frontend/UIUX real content is present, design/implementation roles
  are distinct, and visual QA is absorbed/cross-linked without a new router.

## Acceptance (1-3 testable criteria)
1. Both skills parse with implicit false and trigger-rich descriptions covering
   frontend implementation and UI/UX design intent.
2. `dev-uiux-design/references/` contains the cli-jaw design reference set, and
   `dev-frontend` keeps scripts/examples only where portable.
3. Grep under both dirs finds no cli-jaw runtime commands and no new `frontend`
   or `visual-qa` skill directory.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- node:test frontmatter/openai.yaml validation.
- CLI stdout from `cxc doctor skills` or equivalent loader diagnostic.
- Grep dump for forbidden runtime tokens and required reference filenames.

## Commit unit (one atomic conventional commit)
`feat(skills): port frontend and uiux design guidance`

## Blocked-on (jun decision id, if any)
None.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/110_dev_skills_porting.md
- 260629_codexclaw_mvp/024.3_skill_conversion_delta.md
- 260629_codexclaw_mvp/024.2_cli_jaw_conflict_analysis.md
- 260629_codexclaw_mvp/021.1_codex_rs_skill_mechanism.md
- /Users/jun/.cli-jaw-3459/skills/dev-frontend/SKILL.md
- /Users/jun/.cli-jaw-3459/skills/dev-frontend/scripts/
- /Users/jun/.cli-jaw-3459/skills/dev-frontend/examples/
- /Users/jun/.cli-jaw-3459/skills/dev-uiux-design/SKILL.md
- /Users/jun/.cli-jaw-3459/skills/dev-uiux-design/references/
- /Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/frontend/SKILL.md
- /Users/jun/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/visual-qa/SKILL.md
