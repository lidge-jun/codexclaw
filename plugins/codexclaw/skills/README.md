# codexclaw skills

This directory holds Codex `SKILL.md` skills.

## Migration plan

- `pabcd/` — PABCD workflow (present, MVP guide).
- `dev-*` — the cli-jaw `dev-*` family (architecture, code-reviewer, debugging, testing,
  security, backend, frontend, data, devops, scaffolding, uiux-design) will be normalized
  here to Codex convention: `name`/`description` frontmatter with "MUST USE" trigger
  phrasing, progressive disclosure via `references/`, project-agnostic content only.
  cli-jaw-specific paths (`dist/`, `verify-counts.sh`, `devlog/`) are stripped during migration.

See `devlog/_plan/` for the migration sequence.
