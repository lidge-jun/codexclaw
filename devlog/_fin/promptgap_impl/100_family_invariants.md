# 100 — Family Invariants (promptgap WP1 impl)

Status: IN PROGRESS (PABCD WP1, session `cli`) · 2026-07-01 · class C2 (skill-text)

> Source: `../promptgap/109_cross_cutting_invariants.md` + `../promptgap/000_INDEX.md` pattern 5.
> Native ground truth: explorer Dirac (glm-5.2) confirmed against codex-rs — see "Native binding"
> below. This decade lands the family-wide invariants as REAL skill-body text, canonical in
> `dev` + `pabcd`, referenced (not duplicated) elsewhere.

## What ships in WP1

1. `dev/SKILL.md` — a compact **Family Invariants** block (anti-slop family law + file:line
   output contract + completion-proof one-liner). `dev` is the always-on implicit skill, so it
   is the right canonical home; other routers reference it in one line.
2. `pabcd/SKILL.md` — a **Subagent TASK packet** contract in the existing Delegation Model
   section (TASK / SCOPE / MUST-DO / MUST-NOT / PROOF / RETURN), bound to the real v1 spawn
   `items` surface.

Deliberately NOT doing (per 109 + jaw/cli-jaw no-bloat finding, INDEX non-goals): no per-skill
authority marker stamped into all 20 bodies (the injected directive layer already carries
`[codexclaw: …]` markers — Dirac Q4), no duplicated walls, no new skills/roles.

## Native binding (confirmed by Dirac, codex-rs file:line)

- **TASK packet → v1 spawn `items`.** `multi_agents/spawn.rs:219-228` `SpawnAgentArgs.items:
  Option<Vec<UserInput>>`, NO `deny_unknown_fields`; `UserInput::Skill{name,path}` at
  `protocol/src/user_input.rs:38-41`. v2 (`multi_agents_v2/spawn.rs:243-253`) is
  `deny_unknown_fields` with no `items` → injection rejected. The PreToolUse hook sees bare
  `spawn_agent` for BOTH (`hook_names.rs:41-48`); v1/v2 is told apart by input shape, not name.
  So skill text says: TASK packet travels in the spawn message always, and as structured
  `items` only on the v1 surface.
- **file:line is a doctrine, not a runtime gate** (`structure/00_philosophy.md:135-141`); the
  invariant is agent-followed wording.
- **No goal-write from the skill/hook layer** (`core/src/goals.rs:435,582` are `pub(crate)`;
  only model tools `create_goal`/`update_goal` or app-server RPC write). Skill text must keep
  goal-set as a main-session model-tool action.
- **web_search is hosted + feature-gated** (`hosted_spec.rs:20-58`), never "always available".

## A-gate plan

gpt-5.5 reviewer challenges: (1) is the new `dev` block duplicating existing §6 quality
signals or §1.5 search? (2) does the TASK packet overstate v1/v2 native behavior? (3) any
bloat that violates the no-walls rule? Fix, then B verify (build/test/gate), then D.

## Status

P plan written. Editing dev + pabcd next, then A.
