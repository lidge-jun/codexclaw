# 003 — wp1 receipt (docs-first roadmap)

Work-phase wp1 / layer L0. Closed on `codex/memory-recall-roadmap`, based on
`origin/dev` (`a267b398`).

## Conclusion

The roadmap for the ten issues the Windows sweep does not own is locked. Seven
layers, one PR each, merged bottom-up by the user. No production file was touched
in this cycle, by design.

## What changed

Ten documents, ~215KB, in `devlog/_plan/260911_memory_recall_sweep/`:

| doc | content |
|---|---|
| `000_plan.md` | objective, constraints, stack topology, work-phase map, criteria, risks |
| `001_audit_trail.md` | three audit rounds, seven blockers, how each was folded |
| `002_host_verification_baseline.md` | the two environmental test failures every later layer must expect |
| `010`-`060` | one diff-level PRD per implementation layer, before/after blocks and named tests |
| `070` | publication: read `dev`, push seven branches, open seven PRs, prove CI per layer |

Commits: `ed7f9fc0` (unit), `3723072a` (audit round 1 fold), `dc1aca69` (round 2
fold), `5c52ef31` (audit trail + host baseline).

## Evidence

```text
npm run build                exit 0   179 files compiled, layout validated
receipt test (recall + pabcd-state)   tests 1410, pass 1408, fail 0, skipped 2, exit 0
git diff --stat a267b398 HEAD          only devlog/_plan/260911_memory_recall_sweep/ paths
```

Receipt: `.codexclaw/evidence/01a0901a-b763-7e33-912d-f81565bcf7bd/test-receipt.json`.

Full `npm test` is exit 1 on this host with exactly two pre-existing environmental
failures; see `002`. That baseline was measured on the untouched `dev` tree before
this unit added anything.

## What did not improve, and what would show this is wrong

- **Two of five round-1 blockers were tests that could not have passed.** The
  documents read as precise and still specified a bind mismatch and a CRLF
  assertion that contradicted its own AFTER block. Diff-level precision did not
  prevent either. The implementer of wp2-wp7 must run each named test RED before
  trusting the document that specified it; a PRD's test is a claim, not a result.
- **The fold was initially scoped to the documents a blocker NAMED, not the
  documents it was ABOUT.** That is why round 2 found `030` still contradicting
  three other documents. Any future cross-document finding gets a grep across the
  whole unit before it is called folded.
- **The base moved under the plan while the plan was being written.** `dev` was
  deleted, then restored by a peer session at a different commit than the one this
  unit measured. Every layer re-reads `origin/dev` before it pushes; a layer that
  trusts this document's SHA without checking is the failure mode to watch.
- **What would show the direction is wrong:** if wp2's implementer finds that
  `canonicalCwdSql` cannot be expressed without a SQLite UDF, the L1 design is
  wrong and the whole scan-vs-index parity approach needs replanning rather than
  patching — `RwDb` exposes no `function()` (`sqlite.ts:19-23`), which is the
  constraint that forced the string-SQL twin in the first place.

## Next

wp2 / L1 / #138 on `codex/fix-recall-cwd-normalization`, based on this branch.
Its P re-verifies `010_wp2_recall_cwd_normalization.md` against the tree before any
edit, per LOOP-CONTINUITY-01.

