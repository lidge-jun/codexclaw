# WP1 implementation review synthesis

Review anchor: `46eee8e → cb4a5f8e`, plus approved SoT/022 doc additions. Reviewer Mendel `01a0707a-45e8-75b0-9470-f0fc31154adb` returned FAIL. Main accepts the four traced findings; remote100/0 and155/0 do not refute cases not exercised.

| Finding | Cause | Correction and falsifier |
| --- | --- | --- |
| Cross-platform default suite fails | macOS-only physical-process fixtures live in the global `test/*.test.mjs` selection and assert Darwin | Split portable analyzer tests, Darwin recorder/process tests and compiled-hook cases into explicit owners. Use platform-targeted suite registration, no removed cases. macOS must still execute all physical tests; portable tests remain on all OS |
| Same-byte symlink replacement passes | snapshots hash bytes but do not recheck canonical paths after preparation | Validate path/root containment at each identity snapshot. Add same-content config/root replacement tests proving no postflight dispatcher execution and FAILED outcome |
| Positive epsilon baseline falsely eligible | analyzer permits tiny positive values while comparator returns null deltaPct | Reject unusable comparison rows as UNKNOWN, using the comparator result rather than duplicating its threshold. Add epsilon/positive-control pairs |
| Spawn floor includes ambient preload | measureSpawnFloor inherits environment while hook child uses benchEnv; Node executable may differ | Use the same sanitized environment and process.execPath for both measurements. A marker-writing preload must run in neither child; keep source identity and raw stderr/exit reporting |

The test split is an explicit scope amendment to the original single-file authoring constraint, justified by role/platform boundaries and the1000-line test density. No new dependency or normal-session instrumentation. All original cases must remain accounted for.

Trust registration remains pending user direction. No change in this correction grants trust, disables a handler, modifies shared credentials/configuration, or treats the continuation hook as approval. Complete implementation review and regression first; actual installed-model evidence remains a separate prerequisite.

## Benchmark correction evidence

Remote RED used the new marker-preload regression against the prior benchmark: exit1, one failed test, marker unexpectedly present. Artifact `floor-env-red.log`. After using the same benchEnv for spawn-floor and hooks plus process.execPath for both, the benchmark report/cwd/comparison selection passed15/0 with no skips, exit0 (`floor-env-green.log`). This demonstrates environment parity in the tested subprocesses; it is not a model-performance improvement claim.

The epsilon correction consumes compareReports' own deltaPct result. Ordinary missing-hook/regression failures are checked first; only otherwise eligible rows with non-finite percentage become UNKNOWN. No duplicate private epsilon constant or weaker comparison threshold is introduced.

## Relocation and lifecycle verification

The original42 test declarations remain represented exactly once after splitting: portable analyzer54 cases, recorder/process24, benchmark/compiled-hook8, plus unchanged benchmark suite14 made the previous100. Added21 same-byte lifecycle negatives,4 epsilon/control/precedence cases and1 preload test. Actual macmini run:126 passed,0 failed,0 skipped, exit0 (`wp1-review-fixes.log`).

New owners: `probe-evidence.test.mjs`, `probe-recorder.test.mjs`, `probe-compiled-hooks.test.mjs`; shared fixture-only files under `test/probe-fixtures/`. All files are below400 lines.43 physical recorder/process cases explicitly skip outside Darwin and always run on macmini; portable analyzer and compiled-hook contracts remain selected on other OS. Non-Darwin execution has not been claimed or performed in this task.

Identity revalidation covers every snapshot's canonical directory/file ancestry and containment, then bytes. Same-content config, installed root, Codex home, home, launcher directory and both launcher-file symlinks are exercised at preflight, execution and postdoctor boundaries. A linked dispatcher is not executed after drift. The recorder is not a sandbox against a fully privileged concurrent attacker; this is experiment identity hygiene and lifecycle validation.
