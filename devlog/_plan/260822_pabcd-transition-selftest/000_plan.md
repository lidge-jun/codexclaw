# 000 — pabcd-transition-selftest: Plan

> DIFFLEVEL-ROADMAP-01: write this doc to full diff-level precision (exact paths,
> NEW/MODIFY/DELETE, before/after diffs) BEFORE P -> A. An empty scaffold does not
> satisfy the rule; the A-phase reviewer FAILS outline-only phase docs.

## Objective

Verify the persisted PABCD FSM transitions end-to-end in session 01a02962:
IDLE -> P -> A -> B -> C -> D -> IDLE, including negative gate tests
(no-attest rejection on gated edges). Evidence: per-edge exit codes and output.

## Loop-spec

- Loop archetype: verifier-defined
- Write scope: devlog/_plan/260822_pabcd-transition-selftest/ only (no source changes)
- Out-of-scope: any src/ edits
- Budget / bounds: single cycle, this turn

## Work-phase map (one phase = one full PABCD cycle)

| WP | Doc | Slice | Depends on |
|----|-----|-------|------------|
| wp1 | 010_phase1.md | run one full FSM cycle and record each edge result | - |

## Accept criteria

- Each edge P->A, A->B, B->C, C->D returns exit 0 with correct phase echo
- Gated edge without attest returns exit 1 with actionable error
- Final state after D is IDLE
