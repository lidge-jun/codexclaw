# codexclaw MVP — Overview

Date: 2026-06-29
Status: PLANNING

## What codexclaw is

A single Codex plugin that **reuses the OpenAI `codex` runtime** (no custom harness) and layers on cli-jaw-style development discipline plus multi-model subagents.

Three layers, each minding its own job:

1. **Harness** — OpenAI `codex` (unchanged, reused as-is).
2. **Provider routing (optional)** — `opencodex` (`ocx`), an external dependency. codexclaw never bundles it; it only *ensures* it when present and degrades gracefully when absent.
3. **codexclaw plugin** — skills (`dev-*` + `pabcd`), hooks (session/prompt/stop), subagent role agents, file-based PABCD state, and a local GUI.

## Reference

`devlog/.lazycodex/` (cloned from code-yeongyu/lazycodex → omo) is the structural reference: single-plugin namespace, `components/` isolation, hook-driven state transitions, build aggregation.

## Non-goals (MVP)

- No custom agent harness (reuse codex).
- No TUI / no install wizard (CLI + GUI only).
- No vendoring of opencodex (external dependency, tracked upstream).
- No forced deny-gates yet (text directives first; gates later).

## Design decisions (confirmed with jun)

- D1: Reuse codex runtime, not an opencodex fork. opencodex is a *provider proxy*, not a harness.
- D2: opencodex is optional. Users who don't want it must still get full dev-skills + PABCD + default-model subagents.
- D3: Interfaces are CLI commands + a web GUI. No TUI.
- D4: codexclaw ships its own GUI (subagent default/multi-model config + prompt tuning), and shows a link bar to `localhost:10100` when ocx is detected.

## Build sequence

See the numbered step files in this folder:
- 01_repo_and_plugin_skeleton.md   (DONE in this session)
- 02_provider_bridge.md
- 03_pabcd_state_machine.md
- 04_subagent_config.md
- 05_gui.md
- 06_dev_skills_migration.md
- 07_packaging_and_marketplace.md
