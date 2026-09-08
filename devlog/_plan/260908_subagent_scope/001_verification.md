# Implementation and verification

The serve route and Vite/MCP now share settings-api.ts, including effort validation and persistence. store.ts resolves whole roles project > global > session, retains explicit null/default entries, writes only the edited role, preserves unrelated JSON, and exposes effective sources plus project-trust warnings. CLI supports a trailing --global and role reset. The GUI shows scope/source/reset, rejects failed loads, serializes saves, and saves prompt drafts explicitly to avoid overlapping writes.

## Evidence (2026-09-08, Linux / Node 24.20.0)

- Before implementation, subagent-effort.test.ts failed: saving low returned null. The initial log is /home/jun/tmp/cxc-serve-effort-01a07d17/red.log.
- Final full suite: 2,684 tests; 2,614 passed, 70 existing conditional skips, zero failures. Command: TMPDIR=/var/tmp/cxc-effort-check-01a07d17 CODEX_HOME=/var/tmp/cxc-effort-check-01a07d17/codex-home npm test. The isolated TMPDIR avoids an unrelated /tmp/.git affecting root-discovery fixtures.
- Core strict TypeScript and GUI tsc passed; component and GUI builds passed. New dist/settings-api.js is tracked for clone/marketplace parity; packaging/freshness checks passed.
- HTTP child-process regressions cover low/medium/high/xhigh/null, omitted effort, malformed effort/scope/reset rejection without writes, model preservation, and new server processes reading the same files. Separate fixtures cover global/project/reset precedence and legacy all-default roles.
- Compiled CLI/MCP roundtrips and actual spawn-hook input/output passed, including global model/effort injection on both payload surfaces and full-history fork exclusions. Vite query and trust metadata match spawn resolution; global CSRF is rejected.
- Chromium browser smoke against the built GUI and real serve CLI passed: effort save/reload/restart; model preservation; global/project/reset/null; failed save retaining state; prompt persistence; load failure/retry; desktop 1280px and mobile 390px without horizontal overflow or page errors. Screenshots and script: /home/jun/tmp/cxc-serve-effort-01a07d17/.
- Independent reviewer: core PASS and final GUI PASS. Final fixes preserve the Dashboard’s non-throwing client and disable ignored project edits on both GUI surfaces while retaining reset. After these fixes, GUI strict tsc, build, 27 GUI tests, and browser checks for ignored settings and Dashboard load failure passed. Repository gate and diff whitespace check passed.

## Boundaries

All preference changes were isolated fixtures. No model or effort was selected for Lina or user-global settings. No installed plugin/service was modified or restarted; no inference, push, PR, merge or deployment was performed. Changes are recorded in a local commit only. The implementation is on fix/serve-subagent-effort in /home/jun/code-worktrees/codexclaw/serve-subagent-effort. Other worktrees remain untouched.
