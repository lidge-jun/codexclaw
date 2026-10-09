# wp6 C review

Reviewed both patches and branches: base 2dd2800, A 1ee7f61, B 80ea77c. Source anchors below are relative to /tmp/pso.EjTe/repo. Report-only; no Git/product/outbound writes.

Pre-scan: base-to-B git diff --check and upstream/ diff both exit 0. Fourteen RuntimeRules/collision tests pass without scratch writes. In-memory filesystem probes pass all eight new error contracts and verify one catalog read on the valid path. Full CLI suite/build/hosted CI not rerun here.

1. Medium, verified — B discards earlier duplicate-slug records before checking them (tools/pstack_opencodex.py:154-168,237-251; tools/pstack_runtime.py:54-58). Trigger: two entries for demo, first disabled, last v1. Baseline check-models exits 1 with disabled diagnostic; B exits 0. With malformed efforts on the first duplicate and valid efforts on the last, baseline check-runtime returns BLOCKED/invalid_input (1); B returns CONFIGURATION_OK (0). Reproduced with actual base/head functions and in-memory reads. This changes runtime behavior and weakens validation. Fix: validate every original entry and retain the any-disabled check before deduplication; add both regressions. check-runtime calls modified load_catalog (:280).

Other coverage: A's byte-identical lock rename updates all consumers/docs. Its prefix/casefold test and macOS CI fit the repo. tests/test_runtime.py:94-95 resolves the temp fixture; existing RuntimeCLI assertions are otherwise identical, and runtime diagnostics source is untouched. B's boundary precedes output, uses exit 1 and the requested stderr prefix, and preserves effort/clamping for unique slugs. CONTRIBUTING.md, README.md, lock, CI, repository/runtime tests and tooling were reviewed. English, Conventional Commits, no dependencies and preserved vendor/license sources fit contribution rules. Disclose B's A dependency/review range in its PR body.

blocking_issues: 1 (finding 1; fix before sending PR B). PR A has no blocker.

VERDICT: GO-WITH-FIXES (blockers=1)
