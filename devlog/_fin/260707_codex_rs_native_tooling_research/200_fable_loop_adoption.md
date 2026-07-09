# 200 - Fable Field Guide and Loop Adoption Notes

## Source Classification

Verified target:

- Thariq Shihipar, Anthropic, `A Field Guide to Claude Fable: Finding Your Unknowns`, Claude blog, dated 2026-07-06: `https://claude.com/blog/a-field-guide-to-claude-fable-finding-your-unknowns`
- Companion examples page: `https://thariqs.github.io/html-effectiveness/unknowns/`

Adjacent official sources:

- Claude Platform docs, `Prompting Claude Fable 5`: `https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5`
- Claude blog, `Getting started with loops`: `https://claude.com/blog/getting-started-with-loops`
- Claude Code docs, scheduled tasks / `/loop`: `https://code.claude.com/docs/en/scheduled-tasks`

Ambiguity:

- The verified Thariq source is a Fable field guide, not a page titled "loop engineering."
- The loop-engineering guidance below combines that guide with official Claude loop material and the Fable prompting page.

## Practices To Port Into Codexclaw

### 1. Unknown taxonomy belongs in I/P

The Fable guide frames agentic coding as finding unknowns before, during, and after implementation. Codexclaw already has Interview and PABCD. The missing improvement is to make unknown class explicit:

- Known knowns: what the user already specified.
- Known unknowns: decisions the user or agent knows are unresolved.
- Unknown knowns: expectations visible only through references, screenshots, examples, local conventions, or taste.
- Unknown unknowns: risks only a codebase search, web search, blindspot pass, or prototype exposes.

Adoption:

- Add an "unknowns ledger" section to C3/C4 `000_plan.md` files.
- In P, require at least one blindspot pass for unfamiliar code or external APIs.
- In A, ask the reviewer to challenge unknowns, not just file paths.

### 2. Blindspot pass before build

The companion examples page includes a pre-implementation blindspot pass, interview, reference-port semantics map, design directions, and tweakable plan examples.

Adoption:

- For C3+ P, run a codebase-grounded "blindspot pass" before writing diff-level docs.
- For external or porting work, require a reference-understanding artifact before implementation.
- For UI or product-shape ambiguity, deliberately use divergence in P: design directions or a mock before wiring.

### 3. Implementation notes during B

The Fable examples include a running implementation log for deviations from plan.

Adoption:

- During B, append "Plan Deviations" to the active unit, not only at D.
- Every deviation records: original plan line, code reality, conservative choice, and follow-up for the next cycle.
- This strengthens `LOOP-CONTINUITY-01`: the next P starts from recorded deviations instead of transcript momentum.

### 4. Pitch doc and quiz before merge

The examples include post-implementation artifacts that pre-answer reviewer objections and quiz the implementer.

Adoption:

- For C3/C4 D, add a "reviewer objections answered" section when docs/contracts changed.
- For risky changes, add a short self-quiz or reviewer checklist that points back to evidence paths.
- This is useful for Codexclaw because it catches shallow understanding even when tests pass.

### 5. Fable prompting guidance maps to loop discipline

The Fable prompting docs emphasize harder tasks, effort tuning, grounding progress in tool results, boundaries, parallel subagents, and memory from prior runs.

Adoption:

- Keep HOTL objectives long and explicit. The current `cxc-loop` 500+ character host-goal rule is aligned.
- In P, state effort/resource bounds and proof artifacts before dispatching subagents.
- In C/D, reject progress claims that are not grounded in actual command output or file evidence.
- Record memory-worthy lessons in the devlog unit or a skill doc, not only in chat.

### 6. Use loop types precisely

The official Claude loop guidance distinguishes verifiable goals, recurring scheduled loops, and dynamic workflows. Codexclaw already distinguishes HITL PABCD, HOTL goal loops, and scheduled/automation-like work.

Adoption:

- Use HOTL `create_goal` only when DONE can be verified.
- Use schedule/automation only for time-triggered recurring work.
- Use dynamic multi-agent loops only when the plan has cross-checking or coordination requirements.
- Avoid turning every research task into a forever-loop. Budget exhaustion is a valid terminal state.

## Concrete Codexclaw Changes To Consider Later

1. Add an optional `Unknowns` section template to implementation-unit docs.
2. Add A-phase reviewer prompt language: "Find unknown knowns and unknown unknowns."
3. Add B-phase `implementation_notes.md` or a section in each active decade doc for deviations.
4. Add C/D "objections and quiz" guidance for high-risk docs/contracts.
5. Add a small `cxc loop show` rendering field for open unknowns and deviations if goalplan schema grows.

## What Not To Port

- Do not copy Fable-specific model guidance into generic Codexclaw rules as if it applies to every model/provider.
- Do not make the tweakable-plan ordering override PABCD dependency ordering. Codexclaw phase docs still order by dependency and architecture, while recording tweakable decisions inside the phase.
- Do not require visual/mock artifacts for every backend or docs-only task. Use them when ambiguity is visual or product-shaped.

