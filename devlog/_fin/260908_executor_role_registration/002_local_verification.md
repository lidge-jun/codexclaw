# Local verification and activation boundary

## Verified candidate
- Full `TMPDIR=/var/tmp/cxc-executor-01a07d17 npm test`: 2681 total, 2611 passed, 0 failed, 70 existing conditional skips.
- `npm run build`: 161 files compiled, layout validated. `npm run gate`: OK. `npm run smoke`: platform smoke OK on linux.
- New registration CLI/module strict tsc: exit 0. Broader touched import graph: 10 diagnostics, all reproduced unchanged on untouched 6d70ef4; no typecheck-clean claim for the whole repository.
- Registration tests cover native command invocation in a temporary CODEX_HOME, concurrent publication, idempotence, user file/config preservation, malformed arguments, conflicting directory/file, symlink rejection (host capability gated).
- Shipped SubagentStop entrypoint: executor and legacy worker without receipt block; a valid receipt releases. This is an invoked-entrypoint test, not native hook delivery proof.

## Local application
17 payload files applied after checking each old byte sequence against base 6d70ef4. Backup and SHA manifest: /home/jun/tmp/cxc-update-20260908-01a07d17/executor-backup/manifest.json.
`cxc subagents register executor` created /home/jun/.codex/agents/executor.toml; repeated invocation reported Already registered. Python TOML parse confirms name executor, no model or sandbox override. Existing worker.toml and project subagents.json untouched. Global AGENTS.md implementation role now executor; previous global file backed up.

## Native probe
New Codex 0.153.4 exec session 01a07f97-60f6-70f1-a685-e963f93e3d62 spawned child 01a07f97-a468-7963-b658-d321e26e91a4 after checking exposed executor role. Child wrote exactly EXECUTOR_NATIVE_OK, parent read back and closed child. Child confirmed native Role: scoped executor instructions plus INLINE_EXECUTOR_PROBE. Trace: /home/jun/tmp/cxc-update-20260908-01a07d17/native-executor-smoke/run.jsonl. Ephemeral execution does not retain session_meta; effective role is recorded by the probe's tool use/report, not independently recovered from persistent metadata.

## Pending user activation
Before patch: doctor overall PASS, 24 trusted hook hashes. After patch:
`[FAIL] hook-trust: drifted codexclaw@codexclaw:hooks/subagent-stop-verifying-evidence.json:subagent_stop:0:0 expected=sha256:84e1bb4945bc1f0c31d20ff1cfd3dc555eb266362cc159182962fc6c71f2e6d8 actual=sha256:9afd7aeccc4c240163001eec376823a6566ce30572fafcc300ceb1d6bb4c6290`
`overall: FAIL`
Normal hook reapproval and session restart are required. No trust records were edited. Actual executor SubagentStop delivery is UNVERIFIED until that approval; unit/dist tests do not substitute for it. Native probe did not change hook trust, role registration or FSM state. All task-owned subprocesses and probe child finished.

## QA matrix
| Surface/scenario | Result | Evidence |
|---|---|---|
| CLI first register + repeat | PASS | installed CLI output and role TOML |
| CLI conflict + symlink + concurrent registration | PASS | role-registration.test.ts and suite log |
| v1/v2 executor model/effort vs review keywords | PASS | spawn-attach-hook.test.ts |
| canonical/legacy exit evidence | PASS (entrypoint) | hook-e2e.test.mjs |
| native executor dispatch + scoped file readback | PASS (probe report) | native trace and executor-proof.txt |
| native changed hook activation | PENDING user reapproval | doctor output above |

Final independent code review: 01a07f96-ca60-7e60-bae4-0b6dcbb4615e VERDICT: PASS, no blockers; reviewer independently ran219 focused tests +2 dist exit tests. Nonblocking README.zh and QA canonical-name guidance fixed; hard-link support documented. Same-user race EEXIST wording remains a nonblocking usability residual.
