# 041 — Combined delegation verification

Verified on 2026-09-15 KST. Worktree: `codex/executor-first-delegation`;
combined base `03541398`, previous executor-only head `14c20791`.

The combined policy/runtime implementation passed independent review. P now
delivers architect consultation and executor ownership together; A reminds only
about changed design decisions; B retains executor ownership. Consultation records
identify the actual proposal, submitted plan revision, main dispositions and
same-architect reflection. No consultation gate or routing change was introduced.

## Build and regression evidence

| Check | Result |
|---|---|
| Existing hook/CLI baseline | 183 passed, 0 failed |
| New regression assertions on a temporary `14c20791` archive | 4 failed as expected; test process exit 1 |
| Current hook/CLI suites | 185 passed, 0 failed |
| `node plugins/codexclaw/scripts/build.mjs` | Exit 0; 181 generated files; only the two expected dist files differ |
| `npm test` | Exit 0; 3,154 total, 3,081 passed, 0 failed, 73 skipped |
| `node plugins/codexclaw/scripts/gate.mjs` | Exit 0 |
| Changed documentation links | 39 local file links resolve; reviewer also checked new fragments |
| `git diff --check` | Exit 0 |

The executor returned its implementation and RED/GREEN report, but its native
lifecycle remained running. Main closed it after delivery, inspected the four-file
diff and independently ran build/full tests/gate. Completion rests on those files
and checks. The initial worker RED wrapper filtered stdout and returned pipeline
exit 0; the separate archive replay captured the actual test process exit 1.

## Isolated installed payload

Installed a real copy with `scripts/dev-install.sh --no-build` into a task-owned
Codex home. Final installation doctor: PASS. The installed hook/CLI module probe
passed 13 observations: P/A/B/C/D hook outputs, CLI P/A/B/C/D, status at P and B,
and I→P override. Initial fixture construction omitted the event name and armed
state and correctly failed on empty output; the fixture was fixed, not production.

The independent reviewer recomputed source→dist output and compared it with both
generated files and the isolated installed bytes. All matched. The real plugin
cache's 1,042 file paths and SHA-256 values stayed unchanged through the final
behavioral trials.

## Actual model behavior: bounded observations

The requests asked for ordinary CXC planning or a one-word correction; they did
not instruct the model to call an architect by name. Native rollouts, not prose
claims or injected tool documentation, were used to identify calls.

| Scenario | Observation | Limit |
|---|---|---|
| One-word typo | Exit 0; model selected C0, changed only that word, no subagent calls | Run after policy updates and before final runtime wiring; the C0 path was unchanged |
| Formal P plan | Model entered P and spawned architect before its final executable plan; one same-context retry and a fresh architect context followed | Both contexts failed; no design proposal or reflection was received; trial ended at its 240-second bound |
| Same formal plan after matching the app's V2-disable setting | Again attempted architect consultation | CLI still exposed the task-name/fork-turns surface; the same error recurred and the owned CLI process group was stopped |
| Formal P with explicit no delegation | Exit 0; no subagent calls, plan files written, consultation gap recorded, source unchanged, no A entry | One observed case, not a general compliance-rate measurement |

The positive trials returned this native error:

```text
stream disconnected before completion: Encrypted function output content could not be decrypted or decoded.
```

This change does not establish the cause of that transport failure. Full autonomous
proposal→plan→same-architect-reflection completion remains **unverified**. So do
live design-amendment rechecks and any improvement in invocation rate, cost or
quality. Main's earlier successful app-native architect consultation is design
evidence in 040, not proof that the patched policy is autonomously followed.

## Independent review

Reviewer `01a0a060-fcb3-75f3-9ec6-7e82f7e4efe2` reviewed the combined base-to-working
diff. Its one preliminary finding was missing exact consultation references in
040. Main added proposal/submitted-plan/reflection message IDs, timestamps,
rollout lines and the submitted packet hash; the reviewer independently reproduced
the hash and closed the finding. Final policy/runtime verdict: PASS, no blockers.
The reviewer covered all 19 pre-receipt changed files, including generated output
and historical evidence; it did not claim complete autonomous adoption.

## Local evidence and reproduction

Task evidence root: `/var/tmp/cxc-architect-01a0a049-aah8dgrt/`.

- `run-checks.py`, `build.log`, `full-tests.log`, `gate.log`.
- `independent-red.log`: four failing regression tests on the old source archive.
- `install-final.log`, `verify-installed.mjs`, `installed-observations.json`.
- `source-manifest.json`: hashes of the 11 changed product/structure files.
- `real-cache-before.json`, `real-cache-after.json`: installation fingerprints.
- `run-behavior.py`, `behavior-summary.json`, and case directories: bounded CLI
  trials and local rollout references. Raw transcripts remain outside Git.

Temporary authentication copies were removed after each trial. The owned CLI
processes were reaped. The evidence directory is retained for inspection.
No changes were installed into the real Codex home and nothing was pushed.
