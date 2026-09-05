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
