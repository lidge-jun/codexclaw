---
created: 2026-08-26
workPhase: wp4
---

# 030 — Doctrine, security SOT, and docs sync

Status: PLANNED

Runtime and prose must agree. wp2 reverses a policy stated in the security SOT, so the
SOT has to be amended in the same unit — otherwise the next reader sees a shipped
behavior contradicting a shipped document and cannot tell which is authoritative.

## `docs/security-hardening.md:22-26`

Exact current sentence: "Worker evidence verification likewise ignores child-authored
exemption text and remains fail-closed after its retry budget."

Replace with the shipped contract: it still ignores child-authored exemption text, and
after the retry budget it records an unresolved verification against the session and
releases the child. Completion of the parent goal is then denied by
GOAL-COMPLETE-GATE-01 until that record is resolved or the goal is marked blocked.

State the distinction plainly, because it is the whole argument: fail-closed on the
VERDICT (an unverified result can never be certified as complete), bounded on the
CONTROL FLOW (the child is never trapped). The old wording implied the block itself was
the safety property. It was not — a child that cannot write the receipt gains nothing
from being asked again forever, and the parent learns nothing.

## Stale source comments (audit finding 8)

`src/subagent-evidence.ts:4-8` and the `MAX_ATTEMPTS` comment at :43-44 both promise
post-budget fail-closed blocking. Both must be rewritten in wp2 with the code, not left
for wp4 — a comment contradicting the function under it is how this defect survived.

## `structure/20_pabcd_dispatch_doctrine.md` §3

DISPATCH-AGENT-TYPE-01 stays as-is and becomes MORE load-bearing: it is now the ONLY
read-only routing mechanism (020 deleted the marker). Strengthen it with the failure
mode actually observed: dispatching a read-only packet to a `worker` puts the child
into an evidence gate it cannot satisfy. Name the symptom (repeated identical
SubagentStop blocks) so the next person recognizes it in one read.

Append EVIDENCE-TERMINAL-01: the evidence gate blocks at most MAX_ATTEMPTS times per
agent, then releases with an unresolved record that blocks parent goal completion.
State the bound honestly — the release is guaranteed, including on I/O failure.

## `plugins/codexclaw/skills/`

`rg -l 'EVIDENCE_RECORDED' plugins/codexclaw/skills/` to find every skill teaching the
receipt contract (known: `skills/qa/SKILL.md`). Each must state that read-only lanes are
dispatched as `explorer`. There is no capability declaration — that design was audited
out as forgeable; do not reintroduce it in prose.

## `docs-site/src/content/docs/reference/hooks.md`

Update the SubagentStop row to describe bounded termination and the unresolved-verdict
record in session state. **No new directories exist** — `evidence-unverified/` and
`dispatch-capability/` were both audited out and must not appear in any doc.

## Accept criteria (c6)

- No shipped doc claims unbounded fail-closed blocking.
- `rg -n 'fail-closed' docs/ structure/ plugins/codexclaw/skills/` reviewed line by line.
- `npm run gate` passes (it scans skills/structure prose for forbidden claims).
