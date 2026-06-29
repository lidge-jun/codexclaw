# L19 (Decade 190) -- skill_hub REWRITE (codexclaw-specific)

Status: BLOCKED(L12-L17)
Cluster: 2 (part B) · Phase: expansion · Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/100_skill_hub.md (J2), 090.1 J-6/J-11, J-4/H4

## Goal (one slice)
Rewrite the skill hub for codexclaw as an on-demand catalog, not an
implicit-visible router. The default implicit invocation set is exactly `dev`;
`search`, host-provided `pdf`, `skill-hub`, every dev-* router, and other
on-demand skills stay implicit-off and are reached by explicit trigger or
`dev` hub routing. No runtime "hub engine" -- the hub is a router skill plus
per-skill `allow_implicit_invocation` toggles.

## Why now / dependencies (BLOCKED reasoning)
This loop is BLOCKED on L12-L17 because the hub rewrite cannot be authored until
the codexclaw skill set actually exists and is final. L12-L17 change the skill
set wholesale:
- L12 ports the `dev` hub + `pabcd` workflow content -- `dev` is the only always-on core skill, while `pabcd` is explicit/hook-driven.
- L13-L17 port the 11 role-specific dev-* skills (architecture, debugging,
  backend, data, frontend, uiux-design, testing, code-reviewer, security,
  devops, scaffolding) absorbing the omo skills.
The hub catalog must enumerate exactly these ported skills with their final
names, paths, `load_when` triggers, and native-gap notes. Authoring the catalog
before L12-L17 land would hard-code names that may still drift, so L19 stays
BLOCKED until L12-L17 reach D. L18 (`search`) is cataloged as on-demand, not
implicit. Downstream: L19 finalizes Cluster 2; it is the entry point that
makes on-demand skills (diagram, pptx, xlsx, video, telegram, etc.) reachable.

## Scope (decision-complete)
Files to add/edit (after L12-L17 land):
- `plugins/codexclaw/skills/skill-hub/SKILL.md` (on-demand catalog router)
- `plugins/codexclaw/skills/skill-hub/agents/openai.yaml`
  (`allow_implicit_invocation: false` -- explicit trigger or `dev` hub routing)
- `plugins/codexclaw/skills/skill-hub/references/catalog.md` (central registry of
  default_implicit + on_demand skills, each with path + load_when + native_gap)
- `plugins/codexclaw/skills/skill-hub/references/renderers.md` (diagram/html
  native-gap note: no diagram-html/mermaid/chart-json renderer in codex-rs)
- `plugins/codexclaw/skills/*/agents/openai.yaml` edits to enforce the implicit
  policy: `dev` = true; `search`, host-provided `pdf`, `skill-hub`, and all others = false.

Exact behavior (the two-axis distinction is the whole design):
- `allow_implicit_invocation: false` removes a skill from the auto-rendered
  `<skills_instructions>` list (path 1 blocked) but keeps explicit `$skill` /
  SKILL.md-path mention working (path 2 open) -- "grep-only discovery".
- `disabled` (`[[skills.config]] enabled=false`) blocks BOTH paths. On-demand
  skills must be implicit-off, NOT disabled, or grep discovery breaks.
- `skill-hub` is on-demand and may be reached through an explicit trigger or
  `dev` hub routing. Its description is the bootstrap pointer: "for capability
  beyond dev, read references/catalog.md and grep the on-demand skill name,
  then explicitly load it."

Must-NOT-Have:
- No runtime hub engine / dynamic loader code (codex renders SkillMetadata each
  turn natively).
- No on-demand skill set to `disabled` (would kill grep discovery).
- No frontmatter `keywords`/`search_terms`/`default_prompt`; frontmatter holds
  only `name`, `description`, `metadata.short-description`.
- `policy.allow_implicit_invocation` lives in `agents/openai.yaml`, never in
  SKILL.md frontmatter.

## IPABCD micro-cycle
- I: not interview-bearing.
- P: flip per-skill openai.yaml policy flags to the final dev-only implicit set;
  author catalog.md from the L12-L17 manifest; add renderers.md native-gap note.
- A: audit angle = "does the implicit set equal exactly {dev}, and is every on-demand skill grep-discoverable (off, not disabled)?"
  reviewer cross-checks H4 three-way (100/110/STATUS) is reconciled.
- B: edit openai.yaml across skills; write catalog.md + renderers.md; ensure
  skill-hub description names the catalog as entry point.
- C: `codex debug prompt-input` -> assert implicit list = 1 skill; grep an
  on-demand name (e.g. diagram), explicit-mention it, assert it injects.
- D: done = implicit set is exactly `dev`, on-demand skills hidden-but-greppable, and
  the hub catalog enumerates every L12-L17 skill.

## Acceptance (1-3 testable criteria)
1. `codex debug prompt-input` implicit skills == {dev}.
2. An on-demand skill (implicit-off) is absent from the implicit list but injects
   on explicit `$name` mention.
3. `catalog.md` lists every ported L12-L17 skill with path + load_when.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- `codex debug prompt-input` JSON dump of implicit set.
- node:test asserting each skill's openai.yaml policy matches the catalog's
  default_implicit vs on_demand classification.

## Commit unit (one atomic conventional commit)
`feat(skill-hub): rewrite hub router with dev-only implicit set`

## Blocked-on (jun decision id, if any)
BLOCKED(L12-L17): cannot author the catalog until the dev skill set is final.
No open jun decision -- J-6 (dev-only implicit set) and J-11 (skill-hub bootstrap is non-implicit) are
resolved; the block is a loop-ordering dependency, not a product question.

## Resolved (jun 2026-06-30)
- Decision: default implicit invocation is `dev` only; `search`, host-provided `pdf`, and `skill-hub` remain on-demand with `allow_implicit_invocation: false`.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/100_skill_hub.md (J2 full analysis, §2.1 two-path proof)
- codex-rs/core-skills/src/render.rs:160,165 (implicit list filter)
- codex-rs/core-skills/src/model.rs:25,105 (allow_implicit_invocation default true)
- codex-rs/core-skills/src/injection.rs:322 (explicit mention ignores implicit flag)
- codex-rs/core-skills/src/loader.rs:710,836 (policy read from agents/openai.yaml)
- codex-rs/config/src/skills_config.rs:24 (disable selector)
- https://developers.openai.com/codex/skills , /codex/config-reference
