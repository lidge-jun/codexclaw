# 010 — Phase 1: Skill Document Consolidation

## Objective
Merge goalplan into loop SKILL.md; merge ultraresearch into search SKILL.md.
Deprecate goalplan and ultraresearch as standalone skills.

## File Change Map

### MODIFY `skills/loop/SKILL.md` (currently 210 lines)

**Before (current structure):**
```
frontmatter (name: cxc-loop, 8 lines)
# cxc-loop (contract, HITL/HOTL, goal activation, Stop-continuation)
## HOTL resource bounds
## Continuation doctrine (LOOP-CONTINUE-01)
## Terminal outcomes
## Repair-loop discipline
## Loop archetype by problem type
## Emergence / Divergence Layer
## Stop-continuation (shipped, L6)
```

**After (merged structure):**
```
frontmatter (name: cxc-loop, updated description to include goalplan triggers)
# cxc-loop — Work-Phase Loop + Durable Goalplan

## Contract (existing, unchanged)

## HOTL Goal-Setting Rule (NEW)
  - When entering HOTL mode, the agent MUST call create_goal with an objective
    that is detailed, concrete, and approaches 5000 characters.
  - The objective must include: the concrete outcome, file change scope,
    acceptance criteria, verification commands, and expected terminal outcome.
  - A vague or short objective (< 500 chars) is a discipline violation.
  - After create_goal, run `cxc loop init --objective "<same text>" --session <id>`
    to create the durable local plan.

## Durable Goalplan (ABSORBED from cxc-goalplan)
  ### Shipped schema
  - Copy goalplan SKILL.md lines 24-46 (the schema description: objective, slug,
    workPhases[], criteria[], host GoalplanHostLink)
  ### CLI surface
  - `cxc loop init --objective "<text>" [--session <id>]` — creates local plan
  - `cxc loop show --slug "<text>"` — renders current plan
  - `cxc loop validate --slug "<text>"` — E8 quality gate
  - `cxc goalplan *` — deprecated alias (same behavior)
  ### Optimization-loop discipline
  - Copy goalplan SKILL.md lines 48-55 (plateau discipline reference)
  ### Goal state
  - Copy goalplan SKILL.md lines 57-70 (how goal-active arms the loop)

## HOTL resource bounds (existing, unchanged)
## Continuation doctrine (existing, unchanged)
## Terminal outcomes (existing, unchanged)
## Repair-loop discipline (existing, unchanged)
## Loop archetype by problem type (existing, unchanged)
## Emergence / Divergence Layer (existing, unchanged)
## Stop-continuation (existing, unchanged)
```

### MODIFY `skills/search/SKILL.md` (currently 221 lines)

**Current Tier 3 section (lines ~73-86):**
```markdown
### Tier 3 — Subagent swarm (deep research, opt-in)
For broad, costly, or multi-source research, the main agent may explicitly spawn
a subagent swarm in ultraresearch mode...
The deep-research method ... lives in the on-demand `$cxc-ultraresearch` skill...
```

**After — replace Tier 3 section with inlined ultraresearch protocol:**
```markdown
### Tier 3 — Deep Research Protocol (opt-in, formerly cxc-ultraresearch)

For broad, costly, or multi-source research, the main agent deliberately spawns
an explorer swarm. This is opt-in and must be requested deliberately — it never
auto-fires for ordinary latest/current lookups.

#### EXPAND — query families first
[Copy ultraresearch lines 17-20: expand into distinct query families]

#### Waves
[Copy ultraresearch lines 22-30: wave mechanics, min 2 waves, stop rule]

#### Journal + claim-ledger
[Copy ultraresearch lines 32-39: journal audit trail, claim-ledger, verified-claims]

#### Grounding (no invention)
[Copy ultraresearch lines 41-45: snippet consensus not verification]

#### Boundaries
[Copy ultraresearch lines 47-50: no new role, no server, on-demand]
```

Also remove the `$cxc-ultraresearch` reference on line ~85 and the
"Subagent Skill Attachment" section's reference to ultraresearch (line ~90).

### MODIFY `skills/goalplan/SKILL.md` (currently 70 lines)

**Full replacement:**
```markdown
---
name: cxc-goalplan
description: "DEPRECATED — merged into cxc-loop. Use $cxc-loop for durable goalplans."
metadata:
  deprecated: true
  redirect: cxc-loop
---

# cxc-goalplan (DEPRECATED)

This skill has been merged into `$cxc-loop`. All goalplan concepts (work-phases,
criteria, checkpoints, evidence, CLI surface) now live in the loop skill.

Use `$cxc-loop` instead. The `cxc goalplan` CLI commands still work as deprecated
aliases for `cxc loop`.
```

### MODIFY `skills/ultraresearch/SKILL.md` (currently 66 lines)

**Full replacement:**
```markdown
---
name: cxc-ultraresearch
description: "DEPRECATED — merged into cxc-search Tier 3. Use $cxc-search for deep research."
metadata:
  deprecated: true
  redirect: cxc-search
---

# cxc-ultraresearch (DEPRECATED)

This skill has been merged into `$cxc-search` as the Tier 3 Deep Research Protocol.
All ultraresearch concepts (EXPAND, waves, journal, claim-ledger) now live in the
search skill's Tier 3 section.

Use `$cxc-search` instead.
```

## Scope Boundary
- IN: loop SKILL.md content merge, search SKILL.md Tier 3 inline, deprecation headers
- OUT: runtime code changes (Phase 2-3), test changes (Phase 4)

## Accept Criteria
1. loop SKILL.md contains all goalplan concepts (schema, CLI, optimization, goal state)
2. loop SKILL.md contains 5000-char goal-setting rule in HOTL section
3. search SKILL.md Tier 3 contains full ultraresearch protocol inline
4. No remaining `$cxc-ultraresearch` or `$cxc-goalplan` references in loop/search
5. goalplan + ultraresearch SKILL.md have deprecation headers with redirects
