---
name: cxc-dev-code-reviewer
description: "MUST USE for code review and review-readiness — review process, quality thresholds, antipattern detection, review verdicts, and giving/receiving feedback. Activates by change-surface for PR review, diff review, pre-merge checks, refactor audits, and high-risk changes. Triggers: 'review this', 'code review', 'PR review', 'check my diff', 'before merge', 'antipattern', '리뷰', '코드 리뷰', '머지 전에 확인'."
metadata:
  last-verified: "2026-07-02"
  short-description: "Code review router: findings, severity, verdicts, and review workflow."
  keywords: ["review", "PR", "pull request", "diff", "merge", "feedback", "approve", "code quality"]
---

# Dev-Code-Reviewer — Code Review Guide

> **C0/C1 work (small local patches):** See `dev` §0.0 Work Classifier + §0.1 Patch Fast-Path before reading references.
> **Read the `dev` skill first** for project-wide conventions before applying review rules.

Systematic code review patterns for finding real issues, not bikeshedding.
This skill activates by change-surface for review requests, pre-merge checks, or independent audit passes.

## Review Posture (REVIEW-POSTURE-01)

Review as a skeptical, independent outsider. Executor claims, passing tests, AI summaries, and
user-facing "done" prose are untrusted until you confirm them yourself — assume the work may have
failed and look for the regression or false-confidence test that proves it. Inspect artifacts
before believing them; a green run you did not read is not evidence.

---
## Modular References

| File | When to Read | What It Covers |
|------|-------------|----------------|
| `references/tech-debt.md` | Tech debt inventory or paydown | Debt quadrant, inventory template, review integration, paydown budget |
| `references/ai-assisted-review.md` | Using AI review tools in PR workflow | AI review workflow, severity classification, re-review policy, exclusions, metrics |

## External/current review evidence

For dependency CVEs, release-note claims, package maintainer/source checks,
provider behavior, or other current/public evidence used in a review, read the
active `search` skill and follow its query-rewrite, source-fetch, and
evidence-status rules. Browser fetch/open/text/get-dom/snapshot is downstream
verification after candidate URLs exist, not a raw-query search substitute.

---

## 1. Code Review Process

### Automated Pre-Scan

Run repo-native lint, type checks, and tests first.

1. Errors block review readiness.
2. Warnings are non-blocking but must be reported.
3. Tool findings appear before manual findings.
4. Unavailable tools are skipped with the gap stated; absence is non-blocking.

Routing: linters catch style, imports, and simple bugs; type checkers catch type
and null-safety errors; SAST catches common injection/auth patterns; dependency
audits catch known CVEs. Errors block, warnings inform. Manual review remains
responsible for architecture, correctness, business intent, and cross-file impact.

### Review Order (by impact, not preference)

1. **Architecture** — Does the approach make sense? Right layer? Right abstraction? Is this the right place for this code?
2. **Correctness** — Logic errors, edge cases, off-by-one, null/undefined handling, error paths
3. **Security** — Input validation, injection risks, auth checks, secrets exposure
4. **Performance** — N+1 queries, unbounded collections, missing indexes, unnecessary computation
5. **Maintainability** — Naming, structure, complexity, test coverage, documentation
6. **Style** — Last priority. Don't bikeshed formatting when there are real issues.

Delegation: coupling classification belongs to `dev-architecture` §3; boundary and
validation-location findings belong to `dev-architecture` §4.

### Review Mindset

- **Be specific.** "This could fail" → "This throws if `user` is null on line 42"
- **Suggest, don't demand.** Unless it's a security or correctness issue.
- **Explain why.** Not just "change X to Y" but "X causes N+1 queries because..."
- **Acknowledge good work.** If a complex problem is solved elegantly, say so briefly.

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

Compact finding example:

```yaml
severity: High
title: Missing ownership check permits cross-account access
location: src/routes/accounts.ts:42
trigger: Authenticated caller supplies another account ID
impact: Caller can read another user's account data
evidence: Handler loads by ID without constraining owner_id
remediation: Scope the query to the authenticated owner
verification: verified
```

### Regression & false-confidence tests (REVIEW-REGRESS-01)

Run a dedicated pass: what previously-working behavior can now break, and do the tests cover that
surface? Flag deletion-only "fixes", tautological tests, tests that merely mirror the
implementation, and scope-drift abstractions added beyond the request.

### Pre-Review Checklist

- Build passes.
- Tests pass.
- The change explains what changed and why.
- The diff is small and structured enough to review.

---

## 2. Quality Thresholds

### Severity Definitions

| Severity | Definition |
|----------|------------|
| Critical | Exploitable security flaw, data loss, or production outage |
| High | Correctness or security defect affecting users |
| Medium | Bounded defect or material maintainability risk |
| Low | Minor risk with limited impact |
| Style | Convention-only issue with no behavioral risk |

Flag these during review:

| Issue | Threshold | Severity |
|-------|-----------|----------|
| Long function | >50 lines | Medium |
| Large file | >400 lines | Medium; apply `dev-architecture` §1 canonical split rule |
| God class | >20 methods | High |
| Too many parameters | >5 | Medium |
| Deep nesting | >4 levels | Medium |
| High cyclomatic complexity | >10 branches | High |
| Missing error handling | any unhandled async | High |
| Hardcoded secrets | API keys, passwords in source | **Critical** |
| SQL injection | string concatenation in queries | **Critical** |
| Debug statements | console.log, debugger left in | Low |
| TODO/FIXME | unresolved in production code | Low |
| TypeScript `any` | bypassing type safety | Medium |

### File Size Guidance

Canonical rule imported from `dev-architecture` §1: **>400 LOC -> split (DEFAULT)**.

| Range | Interpretation |
|-------|---------------|
| 200-400 lines | Healthy — easy to navigate and review |
| 400-500 lines | Should split unless the author states a concrete reason |
| >500 lines | Blocking review finding unless already being split in this diff |

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

---

## 3. Common Antipatterns

### Structural

| Pattern | Symptom | Fix |
|---------|---------|-----|
| God class | One class does everything | Split by single responsibility |
| Long method | Function does 5+ distinct things | Extract named helper functions |
| Deep nesting | 4+ levels of if/for/try | Guard clauses, early returns, extraction |
| Feature envy | Method uses another object's data more than its own | Move method to the data owner |
| Shotgun surgery | One change requires edits in 10+ files | Consolidate related logic |

### Dead Code

| Pattern | Detection | Fix |
|---------|-----------|-----|
| Unreachable code after return/throw | `no-unreachable`, compiler warnings | Delete the dead branch |
| Unused imports / variables | `no-unused-vars`, `@typescript-eslint/no-unused-vars` | Remove |
| Commented-out code blocks | Manual review | Delete — use version control history |
| Unused exports | `ts-prune`, `knip`, grep for import sites | Remove export; delete if no internal use |
| Stale feature-flagged code | Check flag status in flag service | Remove dead branch and the flag check |

Dead code is a maintenance tax — remove rather than comment out.

### Logic

| Pattern | Symptom | Fix |
|---------|---------|-----|
| Boolean blindness | `doThing(true, false, true)` | Named options object or enum |
| Stringly typed | `status === 'actve'` (typo = silent bug) | Define enum or union type |
| Magic numbers | `if (retries > 3)` | Named constant: `MAX_RETRIES = 3` |
| Primitive obsession | Passing 5 related strings around | Create a data object/type |
| Direct mutation | `user.name = 'x'`, `arr.push(y)` | Immutable: `{...obj, name: 'x'}`, `[...arr, y]` |
| Missing boundary validation | Business logic handles raw user input | Delegate placement to `dev-architecture` §4; schema/content depth to `dev-security` |

### Security

Security review items are canonical in §3.5. Use that checklist for hardcoded
secrets, injection, validation, auth, authorization, and logging findings.

---

## 3.5 Security Review Quick-Check

For every review, scan these OWASP-aligned red flags.

### Must-Check Every PR

| Check | Red Flag | Severity |
|-------|----------|----------|
| Hardcoded secrets | API keys, passwords, tokens, or DB URLs in source | **Critical** |
| Injection | User-controlled strings composed into SQL, NoSQL, shell, or templates | **Critical** |
| Missing validation | Untrusted input reaches logic without schema/content checks | **High** |
| Missing auth/authz | Endpoint lacks authentication or permission enforcement | **High** |
| BOLA / ownership | Object access does not verify caller ownership | **High** |
| Sensitive logging | Tokens, passwords, credentials, or private payloads enter logs | **High** |

### Conditional Checks

| Check | Trigger | Red Flag |
|-------|---------|----------|
| SSRF | User controls an outbound URL | No allowlist or host/protocol validation |
| Path traversal | User controls a file path | No canonicalization or containment check |
| Mass assignment | Request object populates a model | No explicit field allowlist |
| Dependency audit | Dependencies are added or updated | No repo-native vulnerability audit |
| Lockfile | Lockfile changes | Unexpected or unexplained resolution changes |

Load `dev-security` for deep analysis. Security routing is required when the diff
touches auth, credentials, untrusted input, sensitive data, dependencies, agent
tools, or trust boundaries.

---

## 3.6 Performance Review Quick-Check

Scan every PR for these common performance pitfalls:

### Database & API

| Check | Red Flag | Fix |
|-------|----------|-----|
| N+1 queries | Loop containing DB call or API fetch | Batch with `WHERE IN (...)` or DataLoader |
| Missing pagination | `.findAll()` or `SELECT *` without LIMIT | Add cursor-based or offset pagination |
| Missing index | New WHERE/JOIN column without index | `CREATE INDEX` on filtered/joined columns |
| Unbounded query | No LIMIT on user-facing list endpoints | Always set max page size |

### Frontend-Specific

| Check | Red Flag | Fix |
|-------|----------|-----|
| Unnecessary re-renders | State updates in parent causing child re-render cascade | `React.memo`, `useMemo`, extract state down |
| Bundle size impact | New large dependency (>50KB gzipped) | Check `bundlephobia.com`, consider alternatives or lazy loading |
| Missing `key` prop | List rendering without stable keys | Use unique ID, never array index for dynamic lists |
| Unoptimized images | Large images without `next/image`, `loading="lazy"`, or srcset | Use framework image optimization |

### General

| Check | Red Flag | Fix |
|-------|----------|-----|
| Missing timeout | External HTTP call without timeout | Set timeout on all network requests |
| Sync blocking | CPU-intensive work on main thread/event loop | Offload to worker/queue |
| Memory leak | Event listeners/subscriptions without cleanup | Add cleanup in `useEffect` return / `finally` block |

---

## 4. Receiving Code Review

Read all feedback, restate the technical requirement, and verify it against the
codebase before accepting it. Evaluate stack fit, existing architecture, tests,
and actual usage rather than treating reviewer claims as authority.

Clarify ambiguous items first, then handle blockers, simple fixes, and complex
changes in that order. Implement one item at a time and test each change.

Push back with concrete tests, code, or documented decisions when advice breaks
behavior, lacks context, violates YAGNI, is technically incorrect, or conflicts
with established architecture. Respond with the verified result and avoid
performative agreement.

---

## 5. Requesting Code Review

Request review before merging, after major features, and before large refactors;
also request it for complex fixes or when the approach is uncertain. Small,
non-impactful config/docs changes may skip review.

A review request must include passing build/tests, the base-to-head diff range,
a concise change and behavior summary, and requested focus areas. Keep diffs
under 500 changed lines or split them into reviewable units.

Fix Critical findings immediately and re-request review; fix High before other
work and Medium before merge. Low and Style findings follow impact and team
conventions.

### Reviewing AI-Generated Code

Run this in addition to the normal review when the diff is substantially AI-generated:

| Check | Typical failure | Required action |
|-------|-----------------|-----------------|
| Invented APIs | Plausible but nonexistent methods/options | Verify against installed-version docs |
| Hallucinated dependencies | Nonexistent or impersonated packages | Verify existence, maintainer, and provenance |
| Missing authz edges | Happy path lacks ownership checks | Trace endpoints against the BOLA check |
| Shallow tests | Tests mirror implementation | Require behavior-level assertions |
| Scope drift | Unrequested abstractions/refactors | Flag and restore one logical change per PR |

---

## 6. Subagent Review Mode

Parallelize review only when domain breadth exceeds one reviewer's context (e.g., frontend + backend + infra in a single diff, or when the diff spans too many unrelated domains for a single pass). Each subagent receives its file subset, the review process from sections 1-5, and outputs structured findings. The main agent deduplicates, normalizes severity, and presents a unified review.

### AI Tool Integration Awareness

Read `references/ai-assisted-review.md` for tool coordination, AI-generated-code
checks, re-review policy, and agentic security triggers. Focus manual review on
architecture, intent, and cross-system impact. **STRICT
(REVIEW-AI-EVIDENCE-01):** de-duplicate, reproduce, and severity-normalize AI
findings; they are evidence to inspect, not authority.

### AI Slop Cleanup Checklist (REVIEW-SLOP-01)

Activate for explicit slop cleanup or >=3 slop findings. Lock behavior with green
tests before deletion.

| # | Category | Flag |
|---|----------|------|
| 1 | Obvious comments | Restatement, dead code, vague TODOs |
| 2 | Over-defense | Impossible guards, broad/empty catches |
| 3 | Excess complexity | Deep nesting, nested ternaries, god functions |
| 4 | Needless abstraction | Pass-through or speculative indirection |
| 5 | Boundary violations | Wrong-layer imports or misplaced logic |
| 6 | Oversized modules | >250 pure LOC smell; >400 split rule is canonical |
| 7 | Performance equivalents | Avoidable quadratic work or allocation |
| 8 | Scope leaks | Mutable globals or scattered environment reads |
| 9 | Missing behavior tests | Changed behavior without regression coverage |

---

## Changed-File Coverage Ledger (REVIEW-COVERAGE-01, DEFAULT)

Account for every changed file as `reviewed`, `skipped (reason)`, or
`out-of-scope (reason)` before verdict. Generated, lock, vendored, binary, and
outside-domain files may be skipped only with an explicit reason. Any
unaccounted file makes the verdict incomplete.

## Finding Falsification (REVIEW-FALSIFY-01, DEFAULT)

Before reporting a finding:

1. State it as a testable claim.
2. Search tests, guards, caller context, and docs for contradictory evidence.
3. Downgrade or retract the claim when contradictory evidence disproves it.
4. Retain the claim when it survives the falsification attempt.

Every finding includes `verification: verified|unverified`. Use `unverified`
when the falsification attempt could not be completed or evidence is incomplete.

## Interdiff Re-Review (REVIEW-INTERDIFF-01, DEFAULT)

Anchor the re-review to both the previous reviewed commit/range and the new head;
record those anchors in the review. Review only the interdiff, preserve unresolved
findings, verify each claimed fix, and process new findings normally. Revisit
unchanged code when a cross-file dependency changed. If either anchor is missing,
history was rewritten ambiguously, or the interdiff cannot be trusted, fall back
to a full review of the current base-to-head diff.
