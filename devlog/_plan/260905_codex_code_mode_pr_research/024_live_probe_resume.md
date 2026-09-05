# WP1 live probe after authorization

User explicitly approved required permissions, including normal hook trust registration in dedicated experiment homes. Existing goalplan/FSM were reused at B/wp1. Native host goal still reports blocked and the exposed goal API cannot reactivate it; creating a duplicate unfinished goal was refused. No direct native goal database mutation or false completion was used.

## First isolated baseline: retained failure

baseline-001 installed the real baseline marketplace copy and registered all23 hooks through the installed cxc hooks retrust command with explicitly authorized bootstrap. Selected manifest/hooks/hook-trust/install-root checks passed. No shared config was modified.

The recorder ran a real read-only pwd/cxc-resolution task. CLI rc0 and requested task succeeded, but recorder correctly returned not-ok: config hash changed during startup. Raw CLI also warned that Astra metadata was absent and priority would be omitted. This is not the known OCX response echo bug: the isolated CLI lacked model metadata before sending the request.

Hypotheses checked: wrong model catalog (confirmed absent from isolated config); OCX default response echo (not the cause of CLI omission; already excluded by user); model fallback (actual selected model stayed Astra, metadata fallback was explicit). Config self-healing added default_mode_request_user_input; payload and launcher hashes stayed unchanged.

Correction: create a fresh baseline-002 home, copy the existing non-secret model catalog as a fixed snapshot, point model_catalog_json to it, and declare the existing required features before timing. Repeat real installation and native trust registration rather than copying trust. Retain baseline-001 artifacts; never overwrite its output or count it as an eligible Fast comparison.

baseline-002 fixed metadata and requested Fast omission, but still failed the unchanged-config gate. Source/config inspection showed native Codex added a project trust section for the disposable work directory; payload and launcher bytes again stayed identical. The recorder is behaving correctly. baseline-003 predeclares the explicitly approved project trust before measurement, retaining the original byte-equality gate and both failed setup specimens. No diagnostic condition is weakened to accept startup mutation.

## Eligible baseline-003

Recorder exit0, ok=true. Analyzer exit0, eligible-for-review/configured-priority-only. Thread `01a07092-14f3-7db0-b1c3-58513c80a705`, two exact digest-correlated OCX requests, source `a687eb735afc7307f902816972c2f8fb522ed2f3`. Both requested/resolved Astra, high, priority wire. The known default response echo remains recorded and does not become a scheduling-confirmation claim.

Actual native command output points to baseline-003/work and its home/probe-bin/cxc. No child delegation was requested. Config/payload/launcher snapshots are identical; all four selected doctor checks pass before/after. Private raw artifacts are under baseline-003/output; proof.json binds original parent rollout and matching usage records by SHA256. A separate verifier is inspecting the raw evidence before WP1 closure.

Installed-root synthetic benchmark also ran with the common controller:23 hooks,5 iterations,0 invocation errors,22,319 raw stdout bytes, harness SHA256 `9193170579d2e08b78f16b11a52a44eb6914484c2714839b696f550709a43e88`. These are synthetic replay quantities, not native hook invocation counts or model tokens. `hook-bench.json` and `analysis.json` are preserved beside the run.

## Independent verification and main provenance check

Banach (`01a07094-bb72-7e92-818e-3ce4f4fab5d7`) inspected the actual remote artifacts and returned PASS. It independently rehashed seven captured artifacts, three input artifacts and four proof sources; checked all23 trust hashes and both14-check doctor reports; reconciled27,745 input/229 output tokens; observed only the two intended command results and no delegation. Recorder elapsed time was11,757ms. This is a baseline observation, not a speed improvement claim.

Main then checked the verifier's out-of-scope provenance gaps: live PID38505 command names `/Users/junny/opencodex`, startup15:29:27KST follows the authorized update, the source remains clean at a687eb735, and rereading the complete usage log finds exactly the same two correlated request IDs. This is operator/source association evidence, not cryptographic attestation of process memory. Native hook invocation counts remain unobserved; synthetic counts are separate.

Reviewed private evidence copy: `.codexclaw/evidence/01a0702d-c493-7510-801f-7d8772a2689c/wp1-baseline-003/`. Failed001/002 remain remote and are not merged into the eligible sample.
