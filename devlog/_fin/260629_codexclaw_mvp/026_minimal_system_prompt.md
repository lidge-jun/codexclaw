# 026 — Minimal System-Prompt Principle

Status: TODO  ·  Phase 1

## Principle
codex already has its own base instructions, and codexclaw runs INSIDE that runtime.
So codexclaw must inject MINIMALLY — never replace or bloat the system prompt.

## Rules
- No giant AGENTS.md-style global directive.
- Discipline is delivered through:
  - skill `description` triggers (routing),
  - per-skill body (loaded only when routed),
  - hook `additionalContext` (small, phase-scoped, idempotent),
  - agent `developer_instructions` (per subagent role, scoped to that spawn).
- Prefer "load on demand" over "always on".

## Anti-goals
- Do not mirror cli-jaw's full AGENTS.md into codex.
- Do not inject context on every turn unconditionally.

## Verify
- Baseline session (no trigger) shows no codexclaw context injected.
- Context appears only when a skill/phase actually activates.
