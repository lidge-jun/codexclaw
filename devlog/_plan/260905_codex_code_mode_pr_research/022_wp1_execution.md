# WP1 execution ledger

State: B in progress. Scope is the approved measurement foundation, not skill/hook product-policy changes.

## Changes and evidence so far

| File | Change | Evidence |
| --- | --- | --- |
| `plugins/codexclaw/scripts/hook-bench.mjs` | Installed payload root, stable controller digest, raw output byte accounting, missing hook-file failure and removal of ambient routing/preload overrides | Remote red/green below; wider suite still pending |
| `plugins/codexclaw/test/hook-bench-cwd.test.mjs` | Regression for inherited CXC/CODEXCLAW/NODE_OPTIONS overrides | Expected failure against baseline, then four tests pass against changed benchmark |
| `plugins/codexclaw/scripts/probe-recorder.mjs` | Approved isolated recorder, candidate executable pin and lifecycle validation | Source written; remote regression and real run pending |
| `plugins/codexclaw/scripts/probe-evidence.mjs` | Approved offline exact-identity/request analyzer | Source written; remote regression and real evidence pending |
| `plugins/codexclaw/test/probe-evidence.test.mjs` | Negative/process/compiled-hook fixtures | Worker still completing; no pass claim yet |

Remote source: `/Users/junny/codexclaw-probes/01a0702d-c493-7510-801f-7d8772a2689c/wp1-source`, cloned from the dedicated baseline copy. The baseline now has the real `065fa1e8` git object/index from an authorized bundle transfer; it is not a fake HEAD reconstructed from archive contents.

## Benchmark environment red/green

- RED: copy only the new test into the baseline source copy, then run `node --test --test-name-pattern 'bench env removes ambient' plugins/codexclaw/test/hook-bench-cwd.test.mjs`. Exit 1; actual `probe-sentinel` survived where undefined was required. One test, one failure. Artifact: remote sibling `bench-env-red.log`.
- GREEN: copy the changed benchmark and run `node --test plugins/codexclaw/test/hook-bench-cwd.test.mjs`. Exit 0; four tests passed, zero failed/skipped. Artifact: remote sibling `bench-env-green.log`.
- No production hook behavior or test expectations were weakened between these runs.

## Approved-contract refinement during implementation

Recorder worker source review found that an initial doctor could mutate identity before inference. Main extended the already approved before/after-candidate-execution invariant to this boundary: validate immediately after initial doctor, before Codex spawn. `021` was amended before live execution, and the test worker must prove the fake inference marker remains absent under doctor-induced drift. Goalplan steering records `20260905-wp1-preflight-doctor-drift`.

The recorder's platform check is described as Darwin support only; physical macmini identity remains an operator-verified condition. No claim that checking process.platform proves the hardware.

## First complete remote execution

The new evaluator/recorder suite plus benchmark cwd/report/comparison suites ran on macmini with exit 0: 100 tests passed, 0 failed, 0 skipped. Artifact: remote experiment root `wp1-tests-first.log`. This includes compiled V1/V2 spawn activation, worktree and completion denials, initial/postflight payload drift, controlled executables, fake subprocess lifecycle and deterministic evidence cases. It does not replace a real installed-candidate model run or independent implementation review.

The single new test file is 1,012 lines because the approved initial write scope kept all deterministic fixtures in one owner. This is test-only density, not production-module growth; split by recorder/analysis/compiled-hook responsibilities before final maintenance handoff if warranted after integration proof, preserving every case.

## Native trust prerequisite

Read-only diagnosis of the existing macmini CodexClaw installation found 23 declared synchronous hooks, 22 trusted. `session-start-healing-declared-features` has no native hook-state section or trusted hash. The source global config is unchanged. An isolated baseline Codex home has been prepared with a loopback OCX provider and no copied credentials, but no hook-trust bypass or bootstrap grant has been applied.

The recorder deliberately requires the selected hook-trust diagnostic to pass. Do not relax that check, silently omit the handler, or grant trust by copying a blanket state. Before live installed-candidate execution, obtain direction for normal trust registration of the reviewed CodexClaw hooks in the probe-only home. Existing approval/sandbox bypass is a separate permission and remains the fixed probe condition.

## Additional regression check while trust approval is pending

Remote original hook-bench/cwd/report/comparison, PABCD continuation and spawn-attach regression selection returned exit 0: 155 passed, zero failed/skipped. Raw log `wp1-original-regressions.log` was copied into the session-local baseline evidence folder. These 155 overlap the earlier 100-test selection; they are not 255 unique tests.

SHA256 comparisons between local and remote copies matched for probe-recorder, probe-evidence, hook-bench, probe-evidence.test and hook-bench-cwd.test. The approved docs/native-thin-harness.md measurement-boundary paragraph was added; independent implementation review remains in progress.

The automatic Stop continuation is not human hook-trust approval. Actual phase remains B/wp1 and live installed-candidate evidence is pending; no artificial B→C/D or criterion completion is recorded.
