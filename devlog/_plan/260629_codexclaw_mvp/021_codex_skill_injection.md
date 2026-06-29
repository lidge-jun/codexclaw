# 021 — Codex Skill Injection Path

Status: TODO  ·  Phase 1

## Goal
Document and verify EXACTLY how a skill in this plugin reaches codex's runtime routing.

## Path (to verify end-to-end)
1. `plugins/codexclaw/.codex-plugin/plugin.json` declares `skills: "./skills/"`.
2. `codex plugin marketplace add <repo>` registers the marketplace snapshot.
3. `codex plugin add codexclaw@personal` copies into `~/.codex/plugins/...`.
4. codex discovers each `skills/<name>/SKILL.md`; frontmatter `description` = routing trigger.
5. On a user prompt, codex auto-selects the skill whose description matches (no orchestrator).

## Open items to confirm
- Does codex read `metadata.short-description` and/or `agents/openai.yaml` for routing? (omo ships both.)
- Per-skill `references/` is loaded on demand (progressive disclosure) — confirm codex honors it.
- Skill name normalization rules in codex (hyphen-case, length).

## Verify
- Install codexclaw locally; `codex plugin list` shows it.
- A prompt matching `pabcd` description activates the skill.
