# Roadmap audit and lock (wp0)

Independent reviewer: Lovelace, 01a07043-b829-7613-9476-f89449ce81e5.
Actual first verdict: GO-WITH-FIXES (blockers=2), both Medium.

## Findings and main dispositions

1. Checker only verified update files existed; missing anchors and proposed broken
   links could still pass. Accepted: it now projects the complete patch from base,
   checks exact inventory/unique anchors and links in the projected tree, detects
   stale current targets, and compares delivered bytes in payload mode. New negative
   probes exercise wrong anchor, broken projected link and wrong inventory.
2. Question-only idle wake conflicted with outbound FYI guidance. Accepted: every
   outbound message follows wake eligibility; advisory-only idle notifications do
   not wake the task. Independently authorized active HOTL work is not canceled by
   answering a peer. Two explicit scenarios cover these branches.

Main entered B with a near-pass judgment after applying both fixes and passing the
real checker. Same-reviewer closure was requested. This B writes this audit/lock
artifact; it does not apply the product patch or certify wp1.

## Lock scope

000/010/020 define one docs-only cycle followed by one skill implementation cycle.
The latter uses exactly the 8-file patch, scoped packaging checks, model scenarios
and independent final review. Current source remains unchanged. New reviewer-driven
changes amend the appropriate plan rather than silently expanding the B scope.

## Verification

P/A preflight: checker self-tests and roadmap passed; inventory passed; 20 focused
tests passed. These prove file/patch metadata, not model behavior or live delivery.
C must capture a fresh source-bound receipt after commits and any final edits.
No push, hooks/config update, installation, or unrelated worktree change occurred.

Same-reviewer closure: VERDICT: PASS, blocking_issues=0. It ran self-test and roadmap
again (exit 0) and confirmed both findings closed. The payload comparison is inspected
but intentionally not run until wp1. C roadmap receipt succeeded. All nine initially
modified files still match their saved SHA-256 values. wp0 outcome: DONE; next is
wp1 P stale-check and skill implementation, not goal completion.
