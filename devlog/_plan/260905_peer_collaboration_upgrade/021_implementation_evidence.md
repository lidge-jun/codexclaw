# wp1 implementation and scenario evidence

Fresh A reviewer Lovelace returned PASS at 03573b1, zero blockers. Main entered B
with that current-plan attestation, applied the exact 8-file patch, and ran payload
comparison successfully. Source commit: 20e0d7e. Product delta: 176 added lines.
Skill frontmatter and skill/hook counts were unchanged.

## Independent forward tests

Raw fixture: evidence/cases.json. No real peer calls, edits or scenario commands ran.
Actors read the cases and proposed next actions in isolated contexts, without
answer keys or other actors' results:

- Baseline Hypatia, 01a07049-f0f7-7b83-9b66-03bb74cd21e0: raw cases only.
- Guided Mill, 01a07049-f5b6-7560-8c7a-1912763fd155: raw cases and delivered canonical reference.
- B reviewer Fermat, 01a07049-f659-7c00-ab81-57eac01b31df: independent code/prose scrutiny,
  no scenario results supplied to that review.

The complete actor returns are baseline.json and guided.json. check-scenarios.mjs
compares action kinds/IDs to accepted scenario boundaries, not phrase presence in
the skill. It is a small supplemental check, not a substitute for semantic review.

Guided choices covered 12 cases: eligible idle question, explicit stop, unknown
intent, absent tools, trivial work, active impact notification, incoming question
on a stopped goal, ACK without agreement, missing exception, advisory idle FYI,
active authorized self-goal, and deliberately blind audit.

Both actors respected most safety boundaries. In the ACK case, baseline proposed
an immediate clarification send; guided recorded the unresolved promise, deferred
the dependency and continued independent work without another message. This is
an observed action/cost difference, not proof baseline was universally wrong.
The guided actor explicitly attributed its choice to the no-ACK-loop guidance.
There is no claim of statistically established improvement or model-independent enforcement.

## Verification state

After implementation: payload byte comparison PASS; inventory --check PASS;
three focused existing suites 20/20 PASS, exit 0. No repository-wide suite, build,
runtime installation, global configuration, peer test messages or push occurred.
Final C review/receipt remains required before D; this section does not certify it.

## B review synthesis

Fermat returned GO-WITH-FIXES (blockers=1), Medium: when the sender knows host
auto-continuation cannot preserve a question-only wake, merely reporting the risk
does not explicitly prohibit the send. Accepted as a real guidance gap. Amend 020
before the reference, make no-send explicit, preserve active authorized self-goal
continuation, and run an additional isolated known-unsafe-wake scenario. No runtime
or permission-model implementation is added.

Same-reviewer closure at 4e86953: VERDICT: PASS, blocking_issues empty; actual
payload checker passed. Additional guided-unsafe.json selected defer/read/record/
continue, with no send or unauthorized execution. The untouched original 12 cases
and their outputs remain available rather than being refreshed to match a fix.

Guided follow-up: after a simulated API revision3 reply, the actor changed the UI
decision from unresolved cancel semantics to non-destructive pause with a 24-hour
checkpoint expiry and separate admin deletion. It preserved exceptions and labeled
the source peer-reported/not independently verified. Full response: guided-followup.json.
This demonstrates a concrete simulated decision update, not a live integration test.
