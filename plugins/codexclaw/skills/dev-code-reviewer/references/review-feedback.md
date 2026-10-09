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
