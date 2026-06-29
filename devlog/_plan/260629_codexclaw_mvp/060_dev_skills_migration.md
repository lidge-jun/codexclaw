# 060 — dev-* Skills Migration

Status: TODO

## Goal
Bring the cli-jaw `dev-*` family into codexclaw as project-agnostic Codex skills, converting
format so codex auto-routes them.

## Source (cli-jaw `skills_ref/`)
`dev`, `dev-architecture`, `dev-backend`, `dev-code-reviewer`, `dev-data`, `dev-debugging`,
`dev-devops`, `dev-frontend`, `dev-pabcd`, `dev-scaffolding`, `dev-security`, `dev-testing`,
`dev-uiux-design`. (Review `claude-devfleet` for relevance — likely skip.)

## Format conversion (per skill)
| Field | cli-jaw source | codex target |
|-------|----------------|--------------|
| `description` | feature prose ("Common development guidelines...") | **"MUST USE for ..." trigger dictionary** (drives auto-routing) |
| `metadata` | `{ "keywords": [...] }` | `short-description: ...` |
| body | assumes `cli-jaw orchestrate`, orchestrator injection | runtime-agnostic pure guide |
| routing | orchestrator injects | codex selects via description triggers |

Steps per skill:
1. Rewrite `description` into trigger phrases (what user prompts should activate it).
2. Convert `metadata.keywords` → `metadata.short-description`.
3. Strip cli-jaw-only paths/commands: `dist/`, `verify-counts.sh`, `devlog/`,
   `cli-jaw orchestrate`, boss/employee dispatch wording.
4. Keep universal discipline (work classifier C0–C5, build-verify habits, module boundaries).
5. Move long content into `references/` (progressive disclosure) where a skill is large.

## PABCD note
`dev-pabcd` overlaps with codexclaw's own `skills/pabcd/SKILL.md`. Reconcile: keep one PABCD
skill (the codexclaw-native one), fold any unique `dev-pabcd` guidance into it.

## Verify
- Each migrated skill passes plugin validation (skill frontmatter shape).
- Representative prompts route to the right skill via description triggers.
- No cli-jaw-specific command/path remains in migrated bodies.
