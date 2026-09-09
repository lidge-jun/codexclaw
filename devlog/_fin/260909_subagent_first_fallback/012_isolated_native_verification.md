# Isolated native verification — fallback acceptance failed

Tested implementation: `701c17d`, Codex CLI `0.153.4`, 2026-09-09.

This is the pre-fix failure record. See `013_native_error_fix.md` for the subsequent repair and verification.

The earlier synthetic CLI checks did not establish native error compatibility. This run found that quota and server errors are rewritten by Codex before `wait_agent` returns. The current decoder does not recognize these strings, so every tested eligible failure stops at `reconcile` instead of selecting the fallback. The feature is not ready to claim working native fallback.

## Results

Each row ran for executor, explorer and reviewer using the role's persisted dispatch record.

| Injected provider response | Native wait error/result | Current dispatch result |
| --- | --- | --- |
| Successful response | `CHILD_OK` | `complete`, passes |
| HTTP 429, `insufficient_quota` | `exceeded retry limit, last status: 429 Too Many Requests` | `reconcile`, fails fallback acceptance |
| SSE `response.failed`, `insufficient_quota`, generic message | `Quota exceeded. Check your plan and billing details.` | `reconcile`, fails fallback acceptance |
| Same SSE code with canonical usage-limit message | Same quota text | `reconcile`, fails fallback acceptance |
| SSE `response.failed`, `rate_limit_exceeded` | `rate limit exceeded: Cursor rate limit exceeded: fixture exhausted` | `reconcile`, fails fallback acceptance |
| HTTP 500, `upstream_server_error` | `We're currently experiencing high demand, which may cause temporary errors.` | `reconcile`, fails fallback acceptance |
| HTTP 403, `permission_denied` | `unexpected status 403 Forbidden: Fixture provider rejected, url: ...` | `reconcile`, passes conservative no-fallback criterion; does not establish explicit `stop` classification |

21 cases: 6 acceptance passes, 15 acceptance failures. No case reached the configured `cursor/grok-4.6` fallback or `main-direct`. This is an acceptance failure even though the fixture processes exited normally.

All 21 cases observed SessionStart guidance in native model input, claimed-marker consumption with `spawnIssued: true`, and outgoing native child requests for `xai/grok-4.6` at `high`. The fixture omitted model and effort from spawn arguments, so those values came from the real PreToolUse hook. Reviewer dispatches retained `independentReviewRequired: true`. Native wait and close ran before failure reports; no child was allowed to perform file edits.

Independent full repository suite: `env TMPDIR=/var/tmp/cxc-fallback-native-701c17d/tmp npm test`, exit 0, 2,721 tests total, 2,650 passed, 0 failed, 71 skipped. This does not override the failed native acceptance cases.

## Isolation and evidence boundary

Fixtures, CODEX_HOME, CODEXCLAW_HOME, TMPDIR and project state live under `/var/tmp/cxc-fallback-native-701c17d`. The native binary was launched directly with a minimal environment and no credentials. Its provider URL was an ephemeral loopback HTTP server. The operator's OCX service and installed plugin/settings were not modified or used for inference.

The two production hook commands and matchers were loaded as isolated user hooks, with native-reported hashes explicitly trusted in that isolated config. `hooks/list` confirmed both trusted. This verifies those hook entrypoints in the real host, not a full plugin-marketplace installation. The fixture reused model catalog metadata with direct tools and v1 enabled; code-mode execution and native custom-role behavior were not covered. Logical CXC role selection came from the managed dispatch, not native `agent_type`.

The main's protocol actions were scripted by the loopback fixture using real compiled CLI subprocesses and actual native session IDs. Native spawn/wait/close and their returned errors were real. This does not test whether an unscripted main model follows the protocol, downstream OCX routing/retries, paid provider behavior, mid-task edit recovery, or actual main-agent completion.

Local artifacts:

- `/var/tmp/cxc-fallback-native-701c17d/acceptance.json`: all acceptance verdicts.
- `/var/tmp/cxc-fallback-native-701c17d/<role>-<case>/`: outgoing requests, native stdout/stderr, dispatch input/output trace and final result.
- `/var/tmp/cxc-fallback-native-701c17d/full-test.log`: complete repository test output.
- `/var/tmp/cxc-fallback-native-701c17d/matrix.py`: native fixture; run with `FIXTURE_ROLE` and `FIXTURE_CASE` environment variables. It depends on the catalog and isolated hook trust setup captured alongside it.
- `/var/tmp/cxc-fallback-native-701c17d/hooks-list.json`: final trusted hook metadata.

All fixture servers and subprocesses exited; only evidence and isolated state remain. Production code was not changed by this verification.

## Required follow-up

`plugins/codexclaw/components/subagent-config/src/fallback-errors.ts:9` must account for verified native transport transformations, with narrow matching and retained permission/unknown-error negatives. `fallback-dispatch.ts:173` currently returns `reconcile` for these unclassified strings. Add regression coverage from the captured native outputs, then repeat native acceptance to prove primary -> fallback -> main-direct, including fallback effort and reviewer independence. Do not treat the prior passing synthetic tests as proof of that transition.
