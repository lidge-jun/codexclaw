---
name: cxc-dev-code-reviewer
description: "Use for code/PR/diff review and refactor audits. Triggers: review this, before merge, antipattern, 리뷰, 코드 리뷰, 머지 전에 확인."
metadata:
  last-verified: "2026-07-02"
  short-description: "Code review router: findings, severity, verdicts, and review workflow."
  keywords: ["review", "PR", "pull request", "diff", "merge", "feedback", "approve", "code quality", "stacked PR", "stack review", "스택 PR 리뷰"]
---
# Dev-Code-Reviewer — Code Review Guide

Read [dev](../dev/SKILL.md) first for project-wide conventions.

Class, fast path, rule authority, proof, and safety: [dev](../dev/SKILL.md). Current/public evidence: [dev routing](../dev/SKILL.md#conditional-routes).

`dev-testing` owns test adequacy and QA execution. `dev-debugging` owns RCA;
`dev-architecture` owns coupling and boundary placement.

## Review Posture (REVIEW-POSTURE-01)

Review as a skeptical, independent outsider. Executor claims, passing tests, AI summaries, and
user-facing "done" prose are untrusted until you confirm them yourself — assume the work may have
failed and look for the regression or false-confidence test that proves it. Inspect artifacts
before believing them; a green run you did not read is not evidence.

### Output Contract (REVIEW-OUTPUT-01)

Tool findings go first (Automated Pre-Scan item 3); then manual findings sorted
`Critical > High > Medium > Low > Style`; then a dedicated `blocking_issues` block; verdict last.
For dispatched plan-audit (PABCD A-gate) reviews the verdict is additionally
machine-scannable: end the reply with a final line `VERDICT: PASS`,
`VERDICT: GO-WITH-FIXES (blockers=N)`, or `VERDICT: FAIL` (mapping:
Approve -> PASS; Approve-with-suggestions -> GO-WITH-FIXES; Request-changes /
Block -> FAIL). The dispatching agent's exit rule is AUDIT-LOOP-01
(`cxc-pabcd` §A): FAIL always triggers another round.
Every finding carries a concrete `trigger`, `impact`, and `path:line` (FAMILY-CITE-01) — no
finding on a hunch. Do not file pre-existing debt unless the patch worsened it. When a change
introduces a value/type/message crossing a module boundary, trace the consumer side before
declaring it correct, rather than reviewing the emitting hunk alone.

### Regression & false-confidence tests (REVIEW-REGRESS-01)

Run a dedicated pass: what previously-working behavior can now break, and do the tests cover that
surface? Flag deletion-only "fixes", tautological tests, tests that merely mirror the
implementation, and scope-drift abstractions added beyond the request.

## 2. Quality Thresholds

### Severity Definitions

| Severity | Definition |
|----------|------------|
| Critical | Exploitable security flaw, data loss, or production outage |
| High | Correctness or security defect affecting users |
| Medium | Bounded defect or material maintainability risk |
| Low | Minor risk with limited impact |
| Style | Convention-only issue with no behavioral risk |

### Review Verdict

| Indicator | Verdict | Action |
|-----------|---------|--------|
| No high/critical issues | ✅ Approve | Merge |
| Only Medium/Low/Style issues | 🔧 Approve with suggestions | Fix Medium before merge unless the author explicitly marks it non-blocking with a stated reason and tracked follow-up |
| Any unresolved High issue | ⚠️ Request changes | Author must address before merge |
| Any Critical issue | 🚫 Block | Cannot merge until resolved |

Deterministic blocker semantics (REVIEW-BLOCK-01): any unresolved Critical or High blocks the
merge. Medium findings should be fixed before merge. When explicitly marked non-blocking by the
author with a stated reason, Medium may pass with a tracked follow-up. Style never affects the verdict.

## 3. Common Antipatterns

Before writing or reviewing code smells, read [common antipatterns](references/common-antipatterns.md).

## Modular References

| Condition | Reference |
|---|---|
| Any review: pre-scan, impact order, mindset, readiness | [review-process.md](references/review-process.md) |
| Classify quality signals or file-size findings | [quality-thresholds.md](references/quality-thresholds.md) |
| Code-smell scan (dev §6) | [common-antipatterns.md](references/common-antipatterns.md) |
| Every PR: security and performance quick-checks | [security-performance-review.md](references/security-performance-review.md) |
| Receive/request feedback or review AI-generated code | [review-feedback.md](references/review-feedback.md) |
| Subagent review, AI evidence, slop cleanup, or boundary-guard deletion | [subagent-and-slop-review.md](references/subagent-and-slop-review.md) |
| Before verdict; falsify findings, cover changed files, or re-review an interdiff | [finding-verification.md](references/finding-verification.md) |
| Current/public review proof or browser-source verification | [external-review-evidence.md](references/external-review-evidence.md) |
| Tech debt inventory/paydown | [tech-debt.md](references/tech-debt.md) |
| AI review tool coordination | [ai-assisted-review.md](references/ai-assisted-review.md) |
