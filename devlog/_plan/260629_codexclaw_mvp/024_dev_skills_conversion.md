# 024 — dev-* Skills Conversion Rules

Status: TODO  ·  Phase 1

## Goal
Convert cli-jaw `dev-*` into codex-native skills. (Full list + table also in 060/000_research.)

## Source (ACTIVE skills — decision 015)
Canonical source: `/Users/jun/.cli-jaw-3459/skills/dev*` (all 13 active skills), NOT skills_ref.
dev, dev-architecture, dev-backend, dev-code-reviewer, dev-data, dev-debugging, dev-devops,
dev-frontend, dev-pabcd, dev-scaffolding, dev-security, dev-testing, dev-uiux-design.

## Per-skill conversion
1. `description` → "MUST USE for ..." trigger dictionary (drives codex auto-routing).
2. `metadata.keywords` → `metadata.short-description` (+ optional `agents/openai.yaml` with
   `search_terms`/`default_prompt`, mirroring omo).
3. Strip cli-jaw-only: `dist/`, `verify-counts.sh`, `devlog/`, `cli-jaw orchestrate`,
   boss/employee dispatch wording.
4. Keep universal discipline (work classifier, build-verify, module boundaries).
5. Large bodies → `references/*.md` (progressive disclosure).

## Layout target (per skill)
```
skills/<name>/
├── SKILL.md
├── references/*.md       (optional, on-demand)
└── agents/openai.yaml    (optional routing metadata)
```

## Decisions to confirm with jun
- Q-DEV-1: RESOLVED — port all 13 (decision 015).
- Q-DEV-2: Reconcile dev-pabcd with codexclaw's own pabcd skill (fold into one)?

## Verify
- Migrated skill validates; routes from representative prompts; no cli-jaw paths remain.
