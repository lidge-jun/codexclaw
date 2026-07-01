# 024 — dev-* Skills Conversion Rules

Status: TODO  ·  Phase 1

## Goal
Convert cli-jaw `dev-*` into codex-native skills. (Full list + table also in 060/000_research.)

## Source (ACTIVE skills — decision 015)
Canonical source: `/Users/jun/.cli-jaw-3459/skills/dev*` (all 13 active skills), NOT skills_ref.
dev, dev-architecture, dev-backend, dev-code-reviewer, dev-data, dev-debugging, dev-devops,
dev-frontend, dev-pabcd, dev-scaffolding, dev-security, dev-testing, dev-uiux-design.

## Grounding (MUST read before converting)
- 021.1 — codex-rs skill mechanism (EXACT frontmatter schema, openai.yaml, routing, deny_unknown_fields).
- 024.2 — cli-jaw conflict analysis (conflict classes C1-C8, per-skill severity, porting order).
- Exemplar: `devlog/.lazycodex/plugins/omo/skills/*` (working codex skills).

## Exact target frontmatter (codex-rs SkillFrontmatter)
```yaml
---
name: <name>
description: "MUST USE for ... <trigger phrases>"
metadata:
  short-description: <one-liner>
---
```
Optional sidecar `openai.yaml` for interface(display_name/default_prompt) +
`policy.allow_implicit_invocation` + `dependencies.tools`. NO `keywords`, NO `search_terms` in
frontmatter (ignored / may error under deny_unknown_fields).

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

## dev-* skills = subagent ROUTER roles (jun, 2026-06-29)
- All 13 dev skills ship in Phase 1 (not a subset). They serve as ROUTER roles that subagents
  reference for discipline: a debugging subagent routes through `dev-debugging`, frontend through
  `dev-frontend`, review through `dev-code-reviewer`, etc.
- `dev/SKILL.md` stays the always-on universal-discipline entry (work classifier C0-C5 + build-verify),
  exactly as in cli-jaw; the surface-specific dev-* are referenced on demand by surface/role.
- B-opt2 link (see 025): a spawned subagent's INLINE instructions name which dev-* router(s) apply
  to its surface, so routing happens via skill description + explicit reference, not a runtime
  role-file registry.

## Decisions to confirm with jun
- Q-DEV-1: RESOLVED — port all 13 (decision 015).
- Q-DEV-2: Reconcile dev-pabcd with codexclaw's own pabcd skill (fold into one)?

## Verify
- Migrated skill validates; routes from representative prompts; no cli-jaw paths remain.
