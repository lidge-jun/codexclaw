# 110 — D Close-Out

- Date: 2026-07-10
- Terminal outcome: DONE (verified)

## What shipped

1. `spawn-attach-hook.ts`: `normalizeSkillMentions` — conservative line-based
   scanner (FAILSAFE-SPAN-01: protect on any ambiguity). Bare `$cxc-<f>` /
   `$codexclaw:cxc-<f>` tokens on plain lines rewrite to the canonical
   `[$cxc-<f>](skill://<abs SKILL.md>)`; standalone broken-target cxc links are
   repaired; existing /SKILL.md targets, code, and mixed lines are untouched.
   Wired into both v1 (model routing) and v2 (leaf guard) envelope paths; D1
   deny unchanged. skillsDir: CXC_SKILLS_DIR override -> script-relative.
2. `spawn-wrapper.ts`: link-unsafe fallback -> `$codexclaw:cxc-<f>`; mention
   block restored in `resolveSpawnPayloadWithSkills`/`routeDispatch`; research
   intent extras = ["search"].
3. pabcd-state A/B/C directives teach prefixed/link forms; "hook fills in
   missing baselines" claim deleted; directive-form regression test added.
4. Docs/doctrine re-taught across skills (dev/pabcd/search/sparksearch),
   structure (10/20/40/INDEX), docs-site (skills/subagents/hooks).

## Evidence chain

- Probes A-G (live gpt-5.6-sol children) isolated the root cause and proved the
  fix end-to-end (000_plan.md, 050_check_evidence.md).
- A-gate: Galileo 5 rounds -> PASS. C-gate: Kierkegaard 6 rounds -> PASS
  (syntheses 020-100).
- Final `npm test`: 1029/1029, exit 0.

## Pessimistic close-out (LOOP-PESSIMIST-01)

- The CommonMark-faithful scanner DIED (3 rounds of new High blockers);
  markdown fidelity in a hook is a bug farm. Falsifier for the conservative
  design: any reviewer-found false-positive rewrite of protected content.
- Normalization does NOT rescue mentions on mixed lines (link+mention, backtick
  lines) by design — the fixed emitters are the primary channel.
- D1 v1 recursion gate remains v2-only (pre-existing user design, out of
  scope); flagged as a residual observation for the user.
- Worktree carries unrelated user edits (gui, cli.ts, orchestrate-cli,
  browse/QA skill work) — left uncommitted by scope policy; dev/SKILL.md
  carried pre-existing browse/QA description edits that ride along in the
  commit (same file as our delegation-guidance rewrite).
