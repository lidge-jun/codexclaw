## 1. Code Review Process

### Automated Pre-Scan

Run the smallest repo-native checks that observe the requested review scope.
Docs-only reviews use document/contract checks; a diagnostic review does not authorize
installs, product changes, or a repository-wide suite prohibited by the user.

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

### Pre-Review Checklist

- Build passes.
- Tests pass.
- The change explains what changed and why.
- The diff is small and structured enough to review.
- If the PR is one layer of a stack, follow `DEV-STACK-05` in `cxc-dev`
  `stacked-prs.md` — review scope, standalone judgment, base-ref and
  force-push checks, and the merge boundary all live there.

## Routing Role

Systematic code review patterns for finding real issues, not bikeshedding.
This skill activates by change-surface for review requests, pre-merge checks, or independent audit passes.
