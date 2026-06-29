# L13 (Decade 130) -- Dev-Architecture + Dev-Debugging Real-Content Port

Status: ANALYZED
Cluster: 2 (part A) - Phase: expansion - Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/110_dev_skills_porting.md, 024.3_skill_conversion_delta.md, 024.2_cli_jaw_conflict_analysis.md, 021.1_codex_rs_skill_mechanism.md

## Goal (one slice)
Port the structural and runtime-diagnosis routers beyond the L4 activation
stubs: `dev-architecture` owns boundaries/cycles/coupling, and
`dev-debugging` owns root-cause investigation with omo runtime-truth rules
absorbed.

## Why now / dependencies
- Upstream: L12 must land first so these routers can reference the `dev` work
  classifier, verification gate, and surface-router rules.
- `dev-architecture` is a low/medium-conflict port; `dev-debugging` is the
  recipe anchor from 024.3 and should be used to validate the conversion method.
- Downstream: L14-L17 depend on boundary placement, root-cause discipline, AST
  search guidance, and post-edit feedback handling.

## Scope (decision-complete)
Files to add/edit:
- `plugins/codexclaw/skills/dev-architecture/SKILL.md`
- `plugins/codexclaw/skills/dev-architecture/agents/openai.yaml`
- `plugins/codexclaw/skills/dev-architecture/references/circular-dependencies.md`
- `plugins/codexclaw/skills/dev-architecture/references/coupling-taxonomy.md`
- `plugins/codexclaw/skills/dev-architecture/references/barrel-discipline.md`
- `plugins/codexclaw/skills/dev-debugging/SKILL.md`
- `plugins/codexclaw/skills/dev-debugging/agents/openai.yaml`
- `plugins/codexclaw/skills/dev-debugging/references/async-debugging.md`
- `plugins/codexclaw/skills/dev-debugging/references/methodologies.md`
- `plugins/codexclaw/skills/dev-debugging/references/postmortem-template.md`
- `plugins/codexclaw/skills/dev-debugging/references/tool-guides.md`

Concrete source -> target map:
- `/Users/jun/.cli-jaw-3459/skills/dev-architecture/SKILL.md` -> `plugins/codexclaw/skills/dev-architecture/SKILL.md`
- `/Users/jun/.cli-jaw-3459/skills/dev-architecture/references/*` -> `plugins/codexclaw/skills/dev-architecture/references/`
- `/Users/jun/.cli-jaw-3459/skills/dev-debugging/SKILL.md` -> `plugins/codexclaw/skills/dev-debugging/SKILL.md`
- `/Users/jun/.cli-jaw-3459/skills/dev-debugging/references/*` -> `plugins/codexclaw/skills/dev-debugging/references/`
- `devlog/.lazycodex/plugins/omo/skills/debugging/SKILL.md` -> `plugins/codexclaw/skills/dev-debugging/SKILL.md` and debugging references
- `devlog/.lazycodex/plugins/omo/skills/ast-grep/SKILL.md` -> `plugins/codexclaw/skills/dev-architecture/SKILL.md` AST-aware search guidance, not a new skill
- `devlog/.lazycodex/plugins/omo/skills/ast-grep/references/*` -> architecture reference notes only when structural search examples are needed
- `devlog/.lazycodex/plugins/omo/skills/comment-checker/SKILL.md` -> cross-link to review feedback handling, with completion gate owned by `dev` and detailed review owned by L16

Exact behavior:
- L4 router stubs remain the activation shell; L13 fills the body and
  references with real rules.
- `dev-architecture` keeps module boundary, circular dependency, coupling, and
  barrel discipline nearly verbatim after frontmatter normalization.
- `dev-debugging` uses a trigger-rich omo-style description and keeps the
  five-phase RCA method.
- omo `debugging` adds runtime truth, leave-no-trace debugging, reference gates,
  and debugger/tool routing.
- omo `ast-grep` is absorbed as a technique for AST-aware structural search;
  it must not create a separate codexclaw skill in this loop.

Must-NOT-Have:
- No `metadata.keywords`, top-level `keywords`, or `license` frontmatter.
- No cli-jaw employee, dispatch, or injected-role wording.
- No unconditional mandate to use AST tools for trivial C0/C1 patches.
- No separate `ast-grep`, `debugging`, or `comment-checker` codexclaw skills.

## IPABCD micro-cycle
- I: not interview-bearing.
- P: convert `dev-debugging` first as recipe anchor, then `dev-architecture`;
  list references copied/rewritten and define exact omo absorption paragraphs.
- A: audit angle = "does the port preserve mechanical architecture/debugging
  guidance without importing cli-jaw runtime mechanics?" Reviewer checks C1/C2/C4/C8.
- B: normalize frontmatter, add `openai.yaml` with implicit false, port
  references, rewrite path-based cross-refs to codexclaw skill names, and add
  AST/runtime-truth integration text.
- C: run schema validation, forbidden-token grep, and route prompts such as
  "debug this flaky test" and "find circular imports" against skill discovery.
- D: done = both routers load, references are present, and their bodies clarify
  L4 stub versus L13 real-content expansion.

## Acceptance (1-3 testable criteria)
1. Both skills parse with implicit false and contain trigger-rich descriptions
   for architecture and debugging surfaces.
2. Architecture references cover circular dependencies, coupling taxonomy, and
   barrel discipline; debugging references cover async, methodology, postmortem,
   and tool guides.
3. Grep under both skill dirs finds no cli-jaw runtime commands and no separate
   omo skill directory created for `debugging`, `ast-grep`, or `comment-checker`.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- node:test frontmatter/openai.yaml validation.
- CLI stdout from `cxc doctor skills` or equivalent loader diagnostic.
- Grep dump for forbidden tokens and for required reference filenames.

## Commit unit (one atomic conventional commit)
`feat(skills): port architecture and debugging routers`

## Blocked-on (jun decision id, if any)
None.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/110_dev_skills_porting.md
- 260629_codexclaw_mvp/024.3_skill_conversion_delta.md
- 260629_codexclaw_mvp/024.2_cli_jaw_conflict_analysis.md
- 260629_codexclaw_mvp/021.1_codex_rs_skill_mechanism.md
- /Users/jun/.cli-jaw-3459/skills/dev-architecture/SKILL.md
- /Users/jun/.cli-jaw-3459/skills/dev-architecture/references/
- /Users/jun/.cli-jaw-3459/skills/dev-debugging/SKILL.md
- /Users/jun/.cli-jaw-3459/skills/dev-debugging/references/
- devlog/.lazycodex/plugins/omo/skills/debugging/SKILL.md
- devlog/.lazycodex/plugins/omo/skills/ast-grep/SKILL.md
- devlog/.lazycodex/plugins/omo/skills/comment-checker/SKILL.md
