## Classify the loop before Plan

Before leaving Interview, identify whether the verifier defines done (specification
or repair) or only better (open-ended optimization), and record the corresponding
loop archetype. Ground the distinction in the repository and the user's outcome.
For a load-bearing architecture or workflow choice, explain the concrete trade-offs
before narrowing it; include a materially different approach when it helps expose
an assumption. When evidence cannot settle a cheap, bounded comparison, offer a
parallel spike and evidence-based selection. Do not invent irrelevant feature or
technology choices that the project already settles.

## Rescan + readiness (INTERVIEW-SCAN-01)

- Run a contradiction rescan after every answer, AND one final rescan before any proceed/close
  decision — surface what still remains. (This final rescan is process discipline; the runtime
  does not encode scan recency.)
- Runtime readiness has two halves. **Shape** (`isInterviewReady`): every dimension at `high` or
  `max` + contradictions empty + assumptions recorded + `scanRounds >= 1`. **Provenance**
  (the I -> P gate on the agent CLI path): every dimension counted at `high` must trace to a
  question that was asked, answered, and attributed with `--map`. `max` needs no ledger backing
  because no writer can produce it.
- The practical consequence: `--known` alone never opens I -> P. Ask the question, let the
  `PostToolUse` hook capture the answer, then `cxc scan record --derive --map <qid>=<dimension>`.
- Treat readiness as a coverage claim on top of that: each dimension has concrete knowns, no
  unresolved unknown changes scope, and every contradiction has exited into an answer or a
  recorded assumption. Before claiming I -> P readiness, summarize in two groups: confirmed
  requirements with their answer references, then the remaining `proposed` and `open`
  assumptions with their `if wrong` consequences (INTERVIEW-ASSUME-01).

## Closeout fork (INTERVIEW-FORK-01)

In non-goal HITL Interview only (under an active goal the Interview is suppressed and
`request_user_input` is hard-denied — see [Goal firewall](runtime-status.md#runtime-status-shipped)), after a scan round do not drift forward
silently. Show the two-group summary from INTERVIEW-SCAN-01, then present a numbered choice and
let the user pick: `1. Proceed to Plan` ·
`2. Keep interviewing` · `3. Record assumptions and pause`. Do not offer a question BUDGET
("ask 2-3 more"): no tracker field persists it, so the number is unenforceable across turns,
and INTERVIEW-INDEPENDENT-01 governs batching by independence rather than count.
There is no build/execute path out of Interview — the only forward move is Plan, normally after
the readiness gate passes, unless the human explicitly overrides (override is recorded as an
audit entry); the agent CLI path also supports override via
an attest carrying `{"from":"I","to":"P","did":"<reason>","override":true}` with
equivalent ledger transparency (`from`/`to` are coerced before the override is
read, so `{"override":true}` alone is refused — ATTEST-SHAPE-01).
`proceed` means "advance to Plan", not permission to implement; the evolving
plan/devlog stay draft interview artifacts until then.
A chosen `proceed` executes as a real transition — `cxc orchestrate P --session <id>` (or the
chat free-pass `orchestrate p`) — never as narration alone: a "moving to Plan" sentence without
the persisted I->P edge is not Plan entry (ORCH-MANDATE-01, canonical in `cxc-loop`).
