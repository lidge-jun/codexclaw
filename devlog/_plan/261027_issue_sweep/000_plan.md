# 000 — issue_sweep: Plan

Five open issues (#313 #301 #297 #296 #294) and a dead `preview` branch name in CI
config get closed out in one pass. Contributors stop paying a badge-bump commit per PR
(#301), the full local suite stops failing on machines with long checkout or temp paths
(#297, and the same bug in worktree-guard found while reproducing #296), and the
PABCD Audit phase gains three rules that keep re-audits converging. `main` is kept:
`codex plugin marketplace add` without `--ref` installs the default branch, so `main`
is the release channel.

## Loop-spec

- Loop archetype: spec-satisfaction (tests, inventory check, hosted CI define done).
- Trigger: user request in session 01a17d48 (cxc-loop, merge into dev, no preview).
- Goal: issues closed, preview references gone, PR merged into dev with green CI.
- Non-goals: deleting `main`; release-flow changes; version bump; new config settings;
  reviewer-tier rule, fresh-reviewer rotation, rebuttal-outcome ledger, mechanical
  rebuttal-evidence gate (#294 items rejected with the user); open PRs #305 #312.
- Verifier: see 010 §Verification (commands run in P or audit r1 carry their exit codes;
  rows marked "to run in B/C" have not run against the change yet).
- Stop condition: PR merged into dev, issues closed with comments.
- Memory artifact: this unit + goalplan `codexclaw-issue-sweep-lidge-jun-codexclaw-hotl-v`.
- Expected terminal outcomes: DONE (merged, closed); BLOCKED (CI red for out-of-scope
  reasons); NEEDS_HUMAN (a decision beyond the agreed rules).
- Escalation: any change to release.yml / release-gate.ts semantics, or #296
  reproducing in a way that needs harness changes beyond tests.
- Write scope: files listed in 010. Push, PR and merge into dev authorized by the user
  this session. Budget: none stated; host limits apply.
- Class: wp1 is C3 (CI contract change in inventory.mjs, docs contract). Release
  semantics are untouched, so not C4 (architect flagged #301 as release-sensitive;
  main disposition: the release gate path is unchanged and re-verified by its tests).

## Work-phase map

| WP | Doc | Slice | Depends on |
|----|-----|-------|------------|
| wp1 | 010_phase1.md | preview cleanup, #301, #297 (+worktree-guard), #296 verdict, #294 docs, #313 close | — |

## Architect consultation

- Handle: agent 01a17d54-21dc-71e2-99f7-96a4985b73b5 (gpt-6.1-sol, high), read-only,
  cxc-dev + cxc-dev-architecture attached. Proposal D1–D7 (PROPOSAL-END received).
- D1 branch policy stays with existing owners — ACCEPT.
- D2 `--tests-mode exact|floor`, default exact, used only by ci.yml — ACCEPT
  (over `--tests-floor N`: one measured-value interface).
- D3 `check()` returns additive `notices[]`; the CLI prints `::notice::` with the literal
  write command; floor success text no longer claims "matches" — ACCEPT.
- D4 release.yml / release-gate.ts untouched; release.md step 3 explains lag — ACCEPT.
- D5 placeholder-normalized affordance budget — ACCEPT, AMENDED: the same fix applies
  to worktree-guard.test.ts:277 (context embeds `rig.slotRoot` under os.tmpdir(); fails
  alone on this mac, tmpdir = /var/folders/.../goat-threads-*/…). Precedent for
  path-aware budgets: git-write-guard.test.ts:124.
- D6 diagnose before choosing test vs harness — ACCEPT. Evidence: see 010 §#296.
- D7 guidance in phase-audit.md + loop-engineering.md only — ACCEPT.
- Reflection: see 010 §Reflection.

## Audit synthesis (REVIEW-SYNTHESIS-01)

Round 1, reviewer 01a17d5a-54d4-7ad3-89b4-e26e711ceb88 (gpt-6.1-sol, high): FAIL, 2 blockers.

- B1 High — #296 reproduces on real Node 22.22.0 (8 cancelled). Root cause of the miss:
  main's "Node 22" run went through the Vite+ `npm` launcher and ran Node 26. ACCEPT.
  Main reproduced it (3 files, cancelled 8) and found the cause (unref'd awaited timers
  under Node 22's runner). 010 §4 now fixes it test-scoped per architect D6. This stays
  inside the plan's escalation boundary (no harness change needed).
- B2 High — AUDIT-REAUDIT-SCOPE-01 draft let a new High/Critical survive near-pass
  without fold or rebuttal, contradicting phase-audit.md:3 and attest.ts:191. ACCEPT.
  Wording now bounds only Low/Medium to residuals; a new High/Critical is folded,
  rebutted under REBUTTAL-BASIS-01, or sends the work back to P. No conflict between
  B1 and B2; neither conflicts with the user's rules (the nit-loop guard is preserved).
- Notes folded: CLI unknown-mode and notice-on-failure subprocess cases; 000 verifier
  wording; test-count wording in 010.
- Architect recheck: not triggered — the #296 fix is the shape D6 already proposed; no
  design decision changed.

## Accept criteria (mirrors goalplan c-1..c-6)

- c-1 `rg -n preview` over ci.yml, wsl.yml, closed-pr-branch-cleanup.{cjs,test.cjs} → no hits.
- c-2 floor mode: lag passes with a notice naming `--write --tests <N>`, overstatement
  fails, default `--tests` stays exact; release-gate tests unchanged and green.
- c-3 l1-injections + worktree-guard budgets pass with long synthetic roots.
- c-4 full local `npm test` exit 0 on this mac (Node 26), plus a #296 verdict on Node 22.
- c-5 phase-audit.md / loop-engineering.md carry the three rules; same-reviewer reuse kept.
- c-6 PR merged into dev with green CI on its head; five issues closed with comments.
