# Architect consultation and selective execution

The owning implementation task should be able to develop directly. Executor-first
wording in PR #177 made this an exception even when another coordination layer
already delegated the issue to an independent task. Consolidate #177 and #179,
retain required formal-P architect consultation and independent review, and use
executors selectively for independent parallel work or bounded routine work.

## Scope and execution

Class: C3 policy/hint integration; previously reviewed ciphertext and recovery
implementations are carried unchanged. Compact plan, architect consultation,
independent audit, main implementation, checks and delivery; no new runtime gate.
Loop archetype: satisfy-spec. Trigger: explicit request to consolidate both PRs,
withdraw executor-first policy, and organize related issues. Goal: one replacement
PR plus matching local source and installed payload. Non-goals: upstream merge,
release, model-setting changes, or automatic patch reapplication.
Verifier: existing phase hook/CLI tests observe injected instructions and actual
phase state; recovery/ciphertext regressions protect the retained behavior; build,
full root suite, gate and inventory check integration. Baseline phase tests at
19afc764: 185 pass, 0 fail. Policy semantics require independent source review.
Stop: replacement PR published and checked, predecessor PRs closed with links,
issue #178 updated, local/installed state verified and patch backup preserved.
Memory artifact: this unit; raw receipts remain outside Git. Expected outcomes:
verified delivery, or a concrete unresolved blocker. Escalation: scope beyond the
authorized repositories/install paths; no arbitrary time or token budget is set.

## Decisions and file map

Main implements all edits; architect and reviewer are read-only. The user explicitly
selected direct implementation with optional executors, so this task needs no
executor. Original branch histories and local edits remain preserved.

- D1 accepted: `skills/dev/SKILL.md` Implementation delegation defaults to direct
  work by the owning task's main, including an independently delegated task.
  Executor use is optional for disjoint parallel or bounded routine work. No
  justification is required for direct work. Keep headings/links, scoped packets,
  diff verification, and dispatch safety. State the child-task rule generically;
  do not couple CXC to Linear or a model vendor.
- D1 accepted: `skills/pabcd/references/plan-output.md` records executor assignments
  only when selected; main owns other in-scope work without a special exception.
  B follows assigned scopes and new handoffs remain plan amendments. Update the B
  sentence in `skills/pabcd/SKILL.md` consistently. Architect sections stay intact.
- D2 accepted: `components/pabcd-state/src/hook.ts` and `orchestrate-cli.ts` P/B
  hints say main implements by default and executor work is optional. Preserve
  formal-P architect sequence, A recheck, user limits, and phase state behavior.
  Build matching `dist/` files. No change to dispatch/permission algorithms.
- D3 accepted with correction: update existing `test/hook.test.ts` and
  `test/orchestrate-cli.test.ts` assertions on actual injected output. Preserve
  all transition, independent-review and architect checks. Assertions do not
  increase the test inventory; regenerate badges only from the measured total.
  Synchronize `structure/20_pabcd_dispatch_doctrine.md` and `structure/INDEX.md`.
- D4 accepted: carry the union at 19afc764 relative to upstream 03541398, excluding
  old executor-first devlog additions. Preserve ciphertext guards, tests and
  documentation; preserve `task_failed`, waiting and reconciliation contracts.
  Add missing architect/optional-executor/ciphertext CHANGELOG entries and a short
  public-guide explanation. Original author thisisjun786 retains credit in the
  replacement PR. Old PRs and backup patches retain historical evidence.

## Acceptance and delivery

1. Direct single-task/independent-child implementation needs no executor or excuse.
2. Optional parallel work has disjoint write scope; routine work has a clear check.
3. Formal P requires architect proposal, main plan, same-architect reflection, then
   independent A; C0/C1 and explicit user limits retain their existing precedence.
4. Choosing optional dispatch never bypasses a live child's reconciliation or a
   terminal stop; `main-direct` still governs managed reclaim.
5. All carried runtime files match reviewed 19afc764 bytes. New P/B instructions are
   exercised through existing hook and real CLI paths; no new automatic spawn.
6. Publish one ordinary PR to dev. Only then link/close #177 and #179; organize
   #178 with the replacement and current acceptance criteria, leave it open pending
   upstream merge. Preserve remote/local predecessor branches.
7. Apply the policy delta to local dev and the installed plugin with original-file
   backups, drift checks, regenerated dist and actual installed CLI/hook checks.

## Consultation

Architect proposal D1-D4 received and dispositions recorded above. The same
architect returned ALIGNED against plan e9c4484d. Independent audit returned PASS
with no blockers before implementation, retaining the public-guide clarification
that managed reclaim requires `main-direct`. Proposal, reflection and audit
receipts remain in private local execution evidence.
