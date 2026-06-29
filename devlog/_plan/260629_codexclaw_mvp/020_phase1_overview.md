# 020 — Phase 1 (MVP) Overview

Status: PLANNING
Phase: 1 of 3

## Definition
**State management + dev-skill custom injection working, with codex config untouched.**
After phase 1: a user installs codexclaw and gets PABCD + working dev skills + default-model
subagents — without opencodex, without touching `~/.codex/config.toml`.

## Success criteria (testable)
- S1: `codex plugin add codexclaw@personal` installs; skills appear in `codex` skill discovery.
- S2: A PABCD trigger phrase activates the workflow; `.codexclaw/state.json` transitions P→A.
- S3: At least one migrated dev skill (pilot: dev-debugging) routes from a representative prompt.
- S4: `~/.codex/config.toml` byte-identical before/after install + a full session (guard test).
- S5: A subagent role (explorer/reviewer/executor) spawns on the default model.

## Verified facts (research, 2026-06-29)
- codex plugins install to `~/.codex/plugins/` via marketplace snapshots; `config.toml` is separate.
- Supported hook events: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostCompact,
  Stop, SubagentStop (omo uses all).
- codex has a native `create_goal` tool (omo intercepts via `PreToolUse matcher: ^create_goal$`).
- Skill discovery is codex-native: manifest `skills: "./skills/"` + description triggers.
- omo agent definitions come in two shapes:
  - `skills/<skill>/agents/openai.yaml` — skill routing metadata (display/search_terms/default_prompt).
  - `components/<comp>/agents/<role>.toml` — real subagent role (name, model, model_reasoning_effort,
    developer_instructions). THIS is the "subagent as employee" format.
- Skills use progressive disclosure: `SKILL.md` + `references/*.md` + optional `scripts/`.

## Step map (020–029)
- 021 codex skill injection path (precise)
- 022 PABCD native skill + 022.1 state file schema
- 023 goal convention port (cli-jaw goal → codex create_goal)
- 024 dev-* conversion rules + 024.1 pilot (dev-debugging)
- 025 subagent-as-employee injection
- 026 minimal system-prompt principle
- 027 config-untouched guard
- 028 phase 1 integration
- 029 phase 1 verification gate
