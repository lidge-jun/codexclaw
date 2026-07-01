# L7 / 070 — `$cxc-goalplan` + `$cxc-loop` Skills + pabcd Skill-Doc Rewrite

Status: DONE · 2026-06-30 · mvp_hard loop L7 · class C3 (discoverable skills + doc truth)

> Final parity loop. Two new discoverable `$cxc-*` skills give the autonomous goal loop a
> chat entry surface, and the pabcd skill doc is reconciled with the now-shipped L3/L4/L5/L6
> reality (chat + CLI orchestrate live, footer, Stop-continuation). NO new runtime code —
> the loop mechanics already exist (goal-active gate L11/earlier + Stop-continuation L6 +
> orchestrate wire L3/L4). L7 is the discoverable-surface + documentation layer.

## Goal (L7)

1. **`$cxc-goalplan` skill** — the setGoal-equivalent entry: a discoverable skill that
   tells the agent how to (a) establish/refine a goal objective for the repo and (b) hand
   off to the PABCD loop. codexclaw has no goal *store* of its own (goal state is the
   host `goals_1.sqlite` that the goal-active gate already reads), so this skill is the
   DISCIPLINE doc for goal planning + how it arms the Stop-continuation loop — not a new DB.
2. **`$cxc-loop` skill** — the continuation discipline: documents how the L6 Stop-loop
   self-advances PABCD work-phases under an active goal, the two termination guards + the
   stagnation cap, and the "one work-phase = one full PABCD cycle" invariant.
3. **pabcd skill-doc reconciliation** — fix the remaining stale claim
   (`planned cxc orchestrate terminal parity` → it SHIPPED in L4) and add a short
   "Control surfaces" section: chat `$cxc-orchestrate` (human free-pass), `cxc orchestrate`
   CLI (agent-gated), the IPABCD phase footer, and the Stop-continuation loop. Cross-link
   the two new skills.

## Hard constraints (from the filesystem-derived tests)

- Each new skill dir MUST have `SKILL.md` (frontmatter: only name/description/metadata —
  NO `license:`/`keywords:`) AND `agents/openai.yaml`.
  ([build.test.mjs](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/test/build.test.mjs:63),
   [manifest-policy.test.mjs](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/test/manifest-policy.test.mjs:33))
- `agents/openai.yaml` MUST set `allow_implicit_invocation: false` — exactly ONE implicit
  skill (`dev`) is allowed; a new implicit skill breaks the S3 test
  ([manifest-policy.test.mjs](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/test/manifest-policy.test.mjs:48)).
- `display_name` mirrors the frontmatter `name` (e.g. `cxc-goalplan`) so the `$` popup
  title matches (skills_helpers display_name precedence).
- Skills auto-load from `./skills/` (manifest `"skills": "./skills/"`); no per-skill
  manifest entry needed.

## File change map (IN scope)

1. NEW `plugins/codexclaw/skills/goalplan/SKILL.md` + `agents/openai.yaml`
   - frontmatter `name: cxc-goalplan`, description with triggers (goal, objective,
     자율, goal mode, 목표 설정, loop this, keep going).
   - body: how to set/refine a goal objective, the HITL(interactive)/HOTL(goal-auto)
     boundary, how an active goal arms the Stop-continuation loop, and that the agent
     self-advances PABCD with `cxc orchestrate <phase> --attest` (gated) each turn.
   - `openai.yaml`: display_name `cxc-goalplan`, allow_implicit_invocation: false.
2. NEW `plugins/codexclaw/skills/loop/SKILL.md` + `agents/openai.yaml`
   - frontmatter `name: cxc-loop`, description with triggers (loop, 루프, continue,
     self-advance, keep iterating, multi-pass).
   - body: the L6 continuation contract — Stop blocks while a cycle is in flight under an
     active goal; the two termination guards (stop_hook_active, IDLE/inactive) + the
     bounded stagnation cap; one work-phase = one full PABCD cycle; D closes to IDLE then
     re-enter P for the next work-phase.
   - `openai.yaml`: display_name `cxc-loop`, allow_implicit_invocation: false.
3. MODIFY `plugins/codexclaw/skills/pabcd/SKILL.md`
   - line 10: drop "planned `cxc orchestrate` terminal parity" → state it is live
     (agent-gated terminal CLI), chat surface is human free-pass.
   - add a compact "Control surfaces" subsection (chat free-pass / CLI gated / footer /
     Stop-loop) and cross-link `cxc-goalplan` + `cxc-loop`.
   - mark any remaining "planned" interview-ledger path honestly (still planned) — do not
     overclaim.
4. Tests:
   - The existing filesystem-derived tests (build/manifest-policy + skill-hub catalog)
     will now enumerate the two new skills automatically; run them to confirm green.
   - If skill-hub has a catalog/count assertion, update it to include goalplan + loop.

## Scope boundary

- IN: two new skill dirs (SKILL.md + openai.yaml), pabcd SKILL.md doc fix, any catalog
  test update.
- OUT: new runtime code — the goal gate, Stop-continuation, and orchestrate wire already
  exist. No new state, no new hook, no manifest hook change. (If the skill-hub catalog is
  generated from a hardcoded list, update that list; otherwise no code.)

## Accept criteria (testable)

- `skills/goalplan/SKILL.md` + `skills/loop/SKILL.md` exist, each with `agents/openai.yaml`
  setting `allow_implicit_invocation: false` and a matching `display_name`.
- `manifest-policy.test.mjs` S3 still passes (exactly `dev` implicit) and the no-
  license/keywords frontmatter check passes for the new skills.
- `build.test.mjs` skill-structure check passes (every skill dir has SKILL.md).
- pabcd SKILL.md no longer calls the terminal CLI "planned"; it documents the live
  control surfaces.
- `npm test` green (count grows if skill-hub enumerates skills); `npm run build` idempotent.

## Risk / rollback

- Risk: a new implicit skill breaks S3. Mitigation: both new skills set
  allow_implicit_invocation: false; test enforces it.
- Risk: skill-hub catalog test has a hardcoded skill count/list. Mitigation: check and
  update it; otherwise filesystem enumeration absorbs the new dirs.
- Rollback: delete the two skill dirs + revert the pabcd doc edit; no code change.

## Audit focus (for A gate)

- Does any test assert an EXACT skill list/count that the two new dirs would break?
  (skill-hub catalog enumeration — verify it's filesystem-derived, not hardcoded.)
- Are the two new skills correctly NON-implicit (only `dev` implicit)?
- Does the pabcd doc rewrite avoid RE-introducing any cli-jaw/server phrasing (the L1
  audit's zero-jaw-naming goal)?
- Is `$cxc-goalplan` honest that codexclaw reuses the host goal DB rather than claiming a
  new goal store it does not have?

## Audit verdict (A gate — independent reviewer, 2026-06-30) — REQUEST_CHANGES → revised

The audit corrected a wrong premise: `goalplan`, `loop`, `orchestrate`, and `interview`
skill dirs ALREADY EXIST (created as L12 stubs) with correct `agents/openai.yaml`
(display_name + `allow_implicit_invocation:false`). So L7 is NOT skill creation — it is a
**doc-reconciliation rewrite** of stale "planned" SKILL.md bodies + the hardcoded
`skill-hub/references/catalog.md` gap column, to reflect the now-shipped L3/L4/L5/L6
reality. Revised scope (supersedes the "NEW dir" file map above):

1. **Do NOT create or delete skill dirs** — they exist. REWRITE the stale bodies:
   - `skills/orchestrate/SKILL.md` — drop "terminal `cxc orchestrate` planned"; the CLI
     shipped (L4: orchestrate-cli.ts + bin case + tests). Document chat free-pass vs CLI
     gated + footer + D-close.
   - `skills/loop/SKILL.md` — drop "loop engine planned"; the L6 Stop-continuation loop
     shipped (handleStop active + stagnation guard). Document the two guards + cap + the
     one-work-phase=one-cycle invariant.
   - `skills/goalplan/SKILL.md` — drop "goalplan runtime planned"; document that codexclaw
     reuses the host `goals_1.sqlite` (read-only via the goal-active gate) to ARM the
     Stop-loop, and the HITL/HOTL boundary. Be honest: no codexclaw-owned goal store.
   - `skills/pabcd/SKILL.md` — fix line 10 + line ~94 "planned `cxc orchestrate`" → live;
     add a compact "Control surfaces" subsection (chat/CLI/footer/Stop-loop).
   - `skills/interview/SKILL.md` — leave its "runtime ledger + PostToolUse capture planned"
     as-is IF still genuinely planned (do NOT overclaim); only touch if shipped.
2. **Update `skill-hub/references/catalog.md` gap column** for the rows whose gap is now
   closed: orchestrate (planned→none/live), loop (planned→live), goalplan (planned→reuses
   host goal DB), keeping the filesystem-derived row test green (every dir already has a
   row, so no row add/remove — only the "codex-native gap" cell wording changes).
3. **No test add required for display_name** (no test enforces it; it is already correct in
   the existing openai.yaml). Run the existing manifest-policy + build + catalog tests to
   confirm green.

Revised rollback: `git checkout` the touched SKILL.md + catalog.md (doc-only revert); no
dirs created/deleted, no code touched.
