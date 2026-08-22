# 000 - win-linux-optimization: Plan

## Objective

codexclaw keeps generating Windows-specific defects (issues #29, #30, #31 filed from
real Windows sessions in the last day alone). This campaign runs 10+ PABCD work-phases
that systematically audit and fix the Windows/Linux cross-platform surface, using
../opencodex (which ships hardened win32/wsl handling) as the reference pattern
library. Environment: Windows 11 host, PowerShell, Node 24, WSL2 Ubuntu available.

Evidence base:
- gh issue #31: attest gates reveal required fields one rejection at a time; no
  --attest-file; PowerShell inline JSON quoting effectively impossible.
- gh issue #30: plan init doubles the YYMMDD_ date prefix and rewrites underscores.
- gh issue #29: loop criteria cannot be registered by any CLI path; malformed
  goalplan reads as "no plan found" with no diagnostics.
- wsl.exe output in this session printed as UTF-16LE mojibake, confirming the
  encoding hazard class.

## Loop-spec

- Loop archetype: verifier-defined (component test suites + receipts on win32 and WSL).
- Write scope: plugins/codexclaw/components/**, plugins/codexclaw/scripts/**, cli/,
  bin/, scripts/, .gitattributes, devlog/_plan/260821_win-linux-optimization/**.
- Out of scope: ../opencodex (read-only reference), messenger-bridge feature work,
  docs-site, gui feature work.
- Budget/bounds: 10+ work-phases; each cycle lands one reviewed, test-verified slice;
  new defects out of a cycle's scope get filed as GitHub issues instead of scope creep.
- Subagents: anthropic/claude-opus-5 high for explorer/reviewer/executor lanes.

## Work-phase map (one phase = one full PABCD cycle)

| WP | Doc | Slice | Depends on |
|----|-----|-------|------------|
| wp01-roadmap | 000-009 | research + decade docs to diff-level | - |
| wp02-attest-ux | 010 | issue #31: batch field errors + --attest-file + reviewer wording | 002 audit |
| wp03-plan-init | 020 | issue #30: date-prefix detection, underscore preservation | 002 audit |
| wp04-loop-criteria | 030 | issue #29: criteria write path + loader diagnostics | 002 audit |
| wp05-win-paths | 040 | path-handling audit fixes | 001+002 |
| wp06-spawn-quoting | 050 | child-process spawn/quoting fixes | 001+002 |
| wp07-wsl | 060 | WSL detection, UTF-16LE-safe parsing | 001, wp04 |
| wp08-crlf-encoding | 070 | CRLF/encoding hygiene | 001+002 |
| wp09-ci-lane | 080 | dual-platform test lane + receipts | wp02..wp08 |
| wp10-hook-perf | 090 | win32 hook overhead measurement + trims | 080 |
| wp11-closeout | 100 | final gates, issue-filing sweep, docs | all |

Two edges worth naming explicitly, because they are easy to miss when reading 060 alone:
wp07 appends its test 24 to `steering-ops.test.ts`, a file wp04 CREATES, and wp07 edits
`steering.ts`, which wp04 rewrites. The sequential ordering already satisfies both, but
running wp07 out of order would fail against a file that does not exist yet.

Related executor note: because phases run in sequence and several edit the same files
(`steering.ts`, `goalplan.ts`, `state.ts`, `hook.ts`, `doctor.ts`, `hook-bench.mjs`, `ci.yml`),
line-number citations in later docs drift as earlier phases land. Re-anchor by CONTENT,
not by line number: 030 inserts ~60 lines into `goalplan.ts` near :518 before 040 edits
`goalplan.ts:542`, and 040 adds ~20 lines to `state.ts` near :200 before 070 edits
`state.ts:381`.

## Accept criteria

Mirrored in goalplan criteria[]: crit-attest-ux, crit-plan-init, crit-loop-criteria,
crit-win-paths, crit-spawn, crit-wsl, crit-crlf, crit-tests-green, crit-hook-perf,
crit-issues-filed.

## Research docs

- 001_opencodex_reference_patterns.md - opencodex win32/wsl pattern survey (subagent lane)
- 002_codexclaw_win32_audit.md - ranked defect list in this repo (subagent lane)
