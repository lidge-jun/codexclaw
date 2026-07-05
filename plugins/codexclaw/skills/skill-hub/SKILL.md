---
name: cxc-skill-hub
description: "Read when a task needs a capability beyond the always-on dev discipline — architecture, debugging, backend, data, frontend, UI/UX, testing, code review, security, devops, scaffolding, PABCD planning, or web search. Open references/catalog.md, find the on-demand skill by load_when, then explicitly load it. Triggers: which skill, what skills exist, capability beyond dev, skill catalog, load a skill."
metadata:
  short-description: "On-demand catalog router: maps a need to the right explicit skill, then tells you to load it."
---

# skill-hub — Capability Catalog Router

The bootstrap pointer for capability that lives outside the always-on `dev`
hub. This skill is prose plus a catalog. It does not inspect the filesystem at
runtime, mutate Codex config, or dynamically inject skills — Codex renders skill
metadata natively each turn.

## How skill exposure works (two axes)

Two independent switches decide whether a skill is reachable:

- `allow_implicit_invocation` (in `agents/openai.yaml`) controls **automatic
  visibility**. `true` lists the skill in the auto-rendered
  `<skills_instructions>` block; `false` removes it from that list but keeps
  explicit `$skill` / SKILL.md-path mention working. Call this "explicit
  discovery": not auto-listed by default, still loadable on purpose.
- `enabled` (config `[[skills.config]]`) is the hard switch. `enabled=false`
  blocks **both** the implicit and the explicit path.

On-demand skills must be **implicit-off, never disabled** — disabling them
would break grep discovery and make them unreachable.

## The default implicit set

The implicit set is `{dev, search, interview, pabcd, recall, skill-hub, loop}`.
`dev` carries the always-on development discipline; the other six are
lightweight metadata rows so the agent knows they exist and loads them on
intent (search facts, I-phase, PABCD planning, past-session recall, capability
discovery, loop continuation). Everything else stays on-demand: reached by an
explicit trigger word or by `dev`-hub routing. `pdf` is host-provided by Codex
(not a codexclaw skill) and is not in the implicit set.

## How to use the catalog

1. Identify the capability the task needs (a surface like backend, a method like
   debugging, a workflow like PABCD, or web search).
2. Open `references/catalog.md` and find the row whose `load_when` matches.
3. Explicitly load that skill (by `$name` or its SKILL.md path). Do not expect it
   to appear automatically — on-demand skills are implicit-off by design.
4. For renderer/diagram needs, read `references/renderers.md` first: some cli-jaw
   renderers have no codex-native equivalent.

## Routing rubric (which skill now)

Quick forks for the common ambiguous cases (the catalog says what exists; this says which to pick):

- Repo fact-finding -> stay in `dev` + repo tools (`rg`, code search); load `search` only when the
  answer depends on current/external/public/release/provider facts.
- Code-shape / structural query or codemod -> `ast-grep`; byte/text search -> `rg`.
- Multi-step plan, gated execution, interview-first discovery -> `pabcd`; repeated work-phases -> `loop`.
- Review / audit -> `dev-code-reviewer`; runtime failure / RCA -> `dev-debugging`; module boundaries -> `dev-architecture`.
- Search ownership: `search` owns current/external/public evidence policy. Other skills POINT to
  `search` for that path; they must not restate the tier ladder. If material facts may have
  changed, load `search` before answering from memory.

- Deferred/native surfaces: skills are not the only capability channel. Deferred tools
  (e.g. the `multi_agent_v1.*` collab tools) are discovered with `tool_search`; installable
  plugins/connectors are discovered with `list_available_plugins_to_install` and installed
  with `request_plugin_install`. When a task needs a capability no skill covers, check
  those two surfaces (and `structure/60_native_capabilities.md`) before concluding it
  does not exist.
- Dormant/external skills: beyond this catalog, a remote pool (cli-jaw-skills 231,
  Hermes ~175, ClawHub, GitHub-wide) is searchable with `cxc skill search <query>`
  and loadable with `cxc skill show <id>` (adapter preamble applied; `cxc-dev`
  discipline wins on conflict). The runner is a CLI, not a hub engine — this
  skill remains documentation-only.

## Notes

- No runtime hub engine or dynamic loader lives here; this is documentation.
- The catalog is the source of truth for "what exists and when to load it."
