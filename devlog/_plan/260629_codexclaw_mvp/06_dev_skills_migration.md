# 06 — dev-* Skills Migration

Status: TODO

## Goal
Bring the cli-jaw `dev-*` family into codexclaw as project-agnostic Codex skills.

## Source
cli-jaw `skills/dev-*` (architecture, code-reviewer, debugging, testing, security,
backend, frontend, data, devops, scaffolding, uiux-design, dev).

## Rules
- Normalize to Codex `SKILL.md` (name/description frontmatter, "MUST USE" triggers).
- Progressive disclosure via `references/`.
- Strip cli-jaw-specific paths/commands (`dist/`, `verify-counts.sh`, `devlog/`,
  `cli-jaw orchestrate`). Keep universal discipline only.

## Verify
- Each skill validates; descriptions route correctly on representative prompts.
