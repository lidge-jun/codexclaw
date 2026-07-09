# 004 — Project Rules + Edit-Time Checks

Gap class: HARNESS (missing surfaces) · evidence: explorer Beauvoir

> omo loads project rules at runtime and lints edits after they happen. codexclaw has
> neither — coding discipline lives entirely in `dev/SKILL.md` prose (E7).

## Parity table

| omo 실측 | codexclaw 실측 | 격차 | jaw식 보강 |
| --- | --- | --- | --- |
| `rules/hooks/hooks.json:3-52` + `rules/src/static-injection.ts:19-80` + `rules/src/codex-hook.ts:73-239` (load/match project rules on SessionStart + UserPromptSubmit + PostToolUse) | registered hooks cover provider-bridge + PABCD only (`plugin.json:19-28`) | omo injects project rules at runtime; codexclaw has no rule loader/matcher | a lightweight, daemon-free `rule-injector` on SessionStart/UserPromptSubmit/PostToolUse; scope = file scan + dedup only |
| `comment-checker/hooks/hooks.json:3-16` + `comment-checker/src/codex-hook.ts:48-190` (PostToolUse after edits, `decision:"block"`) | `dev/SKILL.md:432-452,489-495` (prose) + the lone PostToolUse returns `""` (`hook.ts:435-455`) | omo blocks bad comments at edit time; codexclaw only documents the rule | edit-like PostToolUse comment-lint hook: forbidden patterns / missing justification comment, static only |

## Reinforcement shape (no-server)

Two small additions, both daemon-free, both fail-open:

1. `rule-injector` — on SessionStart scan a `.codexclaw/rules/` (or project `AGENTS.md`)
   and inject as `additionalContext`; re-inject on UserPromptSubmit when relevant. Scope
   capped at file scan + dedup. This is E4 (directive), not enforcement.
2. `comment-lint` PostToolUse — match edit-like tools, run a static check for forbidden
   patterns (e.g. `as any` without a justification comment), block on violation. E1-class
   on the PostToolUse surface.

## Non-goals

- Semantic AI-slop judgement or external-binary comment analysis — out (no-server,
  determinism). The check stays a static pattern lint.
- LSP/codegraph-backed rule matching — out (see `005`).

## Enforcement tier

Rules: E4 (inject). Comment-lint: E1-class PostToolUse block. Both currently E7 (prose).
