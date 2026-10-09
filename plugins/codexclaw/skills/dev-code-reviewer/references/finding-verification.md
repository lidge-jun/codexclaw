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

**REVIEW-WORKTREE-01 (DEFAULT).** Never check out another review ref in the worktree you
were handed. If the review target is already checked out in the worktree the dispatcher
assigned, review it there; otherwise create or attach a dedicated named worktree and run the
checkout, tests and QA in that one. Record `pwd -P` and the target `HEAD` alongside the
anchors above.

The condition is observable state, not ownership: a reviewer — often a subagent — cannot know
which branch the parent session "owns", but it can always see what is checked out where it
stands.
