# WP6 compact design and reflection

MISALIGNED — fixes fit; delivery acceptance needs a dependency decision.

Citation roots: plan/evidence paths are relative to `/Users/jun/.codex/worktrees/55e8/codexclaw/devlog/_plan/261009_prompt_reduction/`; source paths to `/tmp/pso.EjTe/repo`. Read-only inspection; no tests/builds or Git writes performed.

## Formal P: decisions

**W1 — PR A lock.** Rename `UPSTREAM` to `UPSTREAM.lock`, bytes unchanged; update LOCK_FILE, module help, README and CONTRIBUTING; audit consumers, preserve vendor content (050_wp6_pstack_prs.md:9,16–19; tools/pstack_opencodex.py:23–26,44–54; CONTRIBUTING.md:7). Alternatives: `.upstream.lock` is safe but less visible; vendor-directory rename affects more consumers; dual-name fallback retains ambiguity. Prefer the mechanical rename.

**W2 — PR A regression.** Use `git -C ROOT ls-files -z`, include implied directory prefixes, deduplicate identical spellings, then reject DISTINCT spellings with equal casefold keys. Detect file/directory collisions without rejecting shared parents. Fixtures: `UPSTREAM` + `upstream/x` fails; `upstream/a` + `upstream/b` passes; actual-index test fails before rename. Skip only absent Git/non-worktree; unexpected Git failures fail. Index inspection retains names lost on the affected filesystem (050_wp6_pstack_prs.md:9,20,23). Alternative macOS-only smoke lacks a cheap portable diagnosis; use both.

**W3 — PR A CI.** Keep Ubuntu job identity and Python 3.11–3.13 matrix. Add one macos-15/Python 3.13 job: checkout, immediate clean-status assertion, setup Python, unittest, build/BOTH license comparisons, whitespace/vendor checks. Full OS×Python coverage costs more without adding a distinct lock invariant; Windows remains unverified (.github/workflows/ci.yml:12–32; CONTRIBUTING.md:15–25; research/50_pstack_comparison.md:127,135; 050_wp6_pstack_prs.md:21).

**W4 — PR B snapshot.** Reuse `pstack_runtime.catalog_records`: object → models array → model object/string slug. Extract effort projection over records; preserve `load_catalog(path)`'s mapping return contract for runtime. Check-models reads records once, projects efforts and derives disabled slugs from that snapshot; preserve effort filtering/clamping. `read_object` alone is insufficient: missing files become `{}`. Alternatives: local validation duplicates the owner; a tuple return breaks the caller (tools/pstack_runtime.py:10–16,49–59; tools/pstack_opencodex.py:151–162,186–190,225,236–237,265–266).

**W5 — PR B CLI contract.** Catch `(OSError, ValueError)` only around catalog acquisition/validation/projection; raise SystemExit with `cannot read model catalog <path>: <reason>`: stderr, exit 1, no traceback or success banner. Reasons identify schema/location without dumping contents. JSON/Unicode decode errors fall within ValueError. Avoid catch-all Exception and masking role-file/programmer errors. Preserve valid exit 0, resolution/clamping output and disabled exit 1; no JSON flag (tools/pstack_opencodex.py:224–253,374–379; research/50_pstack_comparison.md:129).

**W6 — PR B proof/delivery.** CLI negatives: missing, malformed JSON, non-object document, missing/nonstring slug, non-array models, non-object entry, malformed effort. Assert stderr prefix/path, exit 1, no traceback/payload, unchanged bytes or continued absence. Add successful check-models exit-0/clamping coverage; retain disabled tests. Positive runtime tests do not establish name-check success (tests/test_runtime.py:110–135,176–185; tools/pstack_opencodex.py:151–162). Keep separate commits/PRs and per-head proof. For fresh macOS builds, temporarily stack B on A or submit B from updated main after A merges. Independent branches with B build proof on a case-sensitive filesystem require an acceptance change (050_wp6_pstack_prs.md:5,37,41).

## Plan reflection

| Remaining gap | Severity / decision | Exact correction |
|---|---|---|
| B from main retains A's macOS failure, yet both branches require fresh macOS builds. | P1 / W6 | Reconcile 050_wp6_pstack_prs.md:37,41 with :9: stack, merge A first, or explicitly exempt B's affected-environment build. Code changes commute; required environment proof depends on A. |
| Shapes omit non-array models/non-object entries; object and slug checks alone leave TypeError/AttributeError outside the narrow boundary. | P2 / W4–W6 | Specify “matching catalog_records” at 050_wp6_pstack_prs.md:29 as all checks in tools/pstack_runtime.py:51–57; add negatives at plan :31. |
| Activation says three negatives while four are listed; disabled failure substitutes for successful name-check proof. | P3 / W6 | Correct 050_wp6_pstack_prs.md:33; add successful/clamped name-check coverage to :31. |

W1/W3/W5 match plan :16–21,30; W2 clarifies :20's prefix-set algorithm. No repository scope expansion is needed; parent must resolve delivery sequencing before declaring both PRs verified.
