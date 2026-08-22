# 010 — Phase 1 (pabcd-transition-selftest)

> DIFFLEVEL-ROADMAP-01: write this doc to full diff-level precision (exact paths,
> NEW/MODIFY/DELETE, before/after diffs) BEFORE P -> A. An empty scaffold does not
> satisfy the rule; the A-phase reviewer FAILS outline-only phase docs.

## MODIFY / NEW / DELETE map

(fill in: exact file paths with before/after diffs — a copy-paste-executable PRD)

## TESTS

- Negative: orchestrate A without --attest must exit 1 (already observed)
- Positive: each attested edge exits 0 and echoes the correct from/to phases

Edge attests:
- P->A: did="wrote plan docs to diff level", planUnit=devlog/_plan/260822_pabcd-transition-selftest, workPhaseId=wp1
- A->B: did="audited plan docs, scope ok"
- B->C: did="docs-only build, nothing to compile"
- C->D: did="verified per-edge exit codes"

## Verification (C)

- cxc orchestrate status --session <id> => phase matches the last completed edge
- After D: phase=IDLE, exit 0
