# wp6 A audit — NEAR-PASS

2026-10-09. Read-only except this report. Clone HEAD verified: `2dd28005288be378373427c9157deba4dcb8c41d`. U = devlog/_plan/261009_prompt_reduction; source anchors below are relative to `/tmp/pso.EjTe/repo`. Reviewed U/050 and research/08; no code, Git, fork or outbound writes.

Executability: lock rename consumers are real (tools/pstack_opencodex.py:4,26,44-54; README.md:92; CONTRIBUTING.md:7). Index-only removal preserves the case-colliding directory. Catalog validation owner exists (tools/pstack_runtime.py:49-59); effort projection/mapping contract is used by check-runtime (tools/pstack_opencodex.py:151-162,265-267). The amendment must implement a records-to-efforts helper so check-models reads once; keep load_catalog's mapping API. Catch only acquisition/validation/projection errors, before the banner; leave role-file/programmer errors outside that boundary.

Fresh activation probes: read-only `git ls-files -z` plus prefix/casefold calculation found exactly the UPSTREAM/upstream collision. Failing-collision fixture rejects; shared-parent fixture accepts. CLI subprocess probes using missing path or stdin catalogs found all eight proposed error-contract assertions RED: missing file, malformed JSON, non-object document, non-array models, non-object entry, missing/nonstring slug, malformed effort. Most emit tracebacks; nonstring slug exits without the required catalog-error prefix, so prefix assertion matters. These are baseline probes, not execution of unwritten regression tests or GREEN proof.

Contribution/CI fit: Python tools/tests, English docs, Conventional Commits, generated dist untracked, both MIT notices and untouched vendor content follow CONTRIBUTING.md:7-25. Existing CI preserves Ubuntu/Python 3.11-3.13; one macOS job reuses its steps (.github/workflows/ci.yml:12-32). No live provider access is needed. Concrete, modest fixes are appropriate; avoid citing upstream's closed PR or absence of contributions as evidence that maintainers welcome this specific patch.

Residuals before publication:

1. U/050:37's “independent/either order” contradicts :48's B-on-A/main-base delivery. Replace it: B temporarily includes A, link A and show B-only review range; avoid presenting B as an isolated diff or urging out-of-order merge. Rebase/refresh per-head proof after A merges, or send B afterward. A main-targeted fork PR with disclosed dependency is workable, but it is not a parent-based layered diff.
2. U/050:33 must distinguish RED defect regressions from supplementary positive/helper tests, which should already pass. Record exact baseline failures, then GREEN on patched branches; the new successful clamping test is compatibility proof, not a before-fix failure.

At C also compare base-to-head upstream/ changes; working-tree CI diff alone cannot prove committed vendor preservation. No new safety blocker found.

VERDICT: NEAR-PASS (delivery description; regression versus compatibility proof)
