# 000 — Loop-Discipline Hard Gates: Plan

## Objective

Close the three observed harness failures with deterministic gates instead of prose:

1. "PABCD 여러 번 돌려" arms nothing → agent patches immediately (regex miss, zero injected bytes).
2. Multiple plan units (010/020/030) batched into one B phase (attest is scope-blind).
3. Shallow ~20-line plans (runtime never reads `devlog/_plan/`; no scaffold; P>A accepts one sentence).

Evidence base: session 019f6012 investigation (4 parallel explorers, 2026-07-14). Key
admissions in code: `goalplan.ts:4` "prose contract today"; `attest.ts` `validateAttest`
is form-only; `detectLoopArmRequest` (hook.ts:150) lacks `pabcd` and `여러 번/반복` tokens.

## Loop-spec header

- Loop archetype: verifier-defined (bun test + standalone hook execution + exit codes).
- Unattended scope: local repo only; write scope = `plugins/codexclaw/components/{pabcd-state,cxc-ops}/`,
  `plugins/codexclaw/skills/{loop,pabcd}/`, `plugins/codexclaw/hooks/`, this devlog unit,
  plus `bin/codexclaw.mjs` + `test/cli-usage.test.mjs` for wp2's `plan` verb routing
  (audit round 1 blocker #1: subcommand dispatch lives in the bin, not component cli.ts).
- Budget: this session's context; checkpoint via goalplan ledger on compaction.
- Out of scope: other repos, existing devlog units, wholesale skill rewrites, cli-jaw parity ports.

## Dependency-ordered work-phase map (one phase = one full PABCD cycle)

| WP | Doc | Slice | Depends on |
|----|-----|-------|------------|
| wp1 | 010 | Trigger + visibility: `detectLoopArmRequest`/`detectTrigger` patterns, skill description triggers, session affordance loop line | — |
| wp2 | 020 | P>A on-disk plan verification (`planUnit`/`planPaths`) + `cxc plan init` scaffold | wp1 (ships the arming path that makes P>A reachable in practice) |
| wp3 | 030 | IDLE-edit PreToolUse advisory on `apply_patch`/`Write`/`Edit` | wp1 (advisory names the arming command wp1 makes reachable) |
| wp4 | 040 | attest `workPhaseId` binding + B directive context starvation | wp2 (binding validates against the goalplan/plan docs wp2 gates) |

Strictly sequential. NEVER implement two WPs in one B. Each later cycle's P re-verifies
its decade doc against the then-current tree (files below may drift after earlier WPs land).

## Accept criteria (goalplan `criteria[]` cr1–cr5 mirror these)

- cr1: `detectLoopArmRequest("pabcd 여러 번 돌려서 해결해") === true`; standalone hook run injects `LOOP_ARM_DIRECTIVE`.
- cr2: loop/pabcd descriptions carry Korean triggers; SessionStart affordance includes a loop-arming line.
- cr3: P>A attest fails (exit≠0) when the referenced plan unit/decade docs are missing; `cxc plan init` scaffolds a valid unit.
- cr4: `apply_patch` PreToolUse while FSM is IDLE injects an advisory naming `cxc orchestrate`.
- cr5: attest `workPhaseId` mismatching goalplan `activeWorkPhaseId` is rejected; B directive names ONLY the active work-phase.

## Verification per cycle (C phase) — corrected by audit round 1

Repo-root `npm run build` (plugins/codexclaw/scripts/build.mjs, zero-toolchain node
type-stripping) then repo-root `npm test` (node --test; includes plugin-level
hook-e2e / dist-freshness / loop-activation-doc-sync / cli-usage guards). Standalone
reproduction with captured exit codes, then commit (D). NOTE: build.mjs PLACEHOLDER_RE
rejects literal TODO/FIXME/TBD in shipped sources — scaffold templates must avoid them.
