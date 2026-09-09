# Native error compatibility repair

Codex rewrites provider error codes into native wait messages. The decoder now recognizes the exact observed quota, HTTP 429 retry-limit and high-demand messages, plus the native `rate limit exceeded: ` prefix. These select the existing next-candidate behavior; they do not add provider retries or change child reconciliation requirements.

Structured permission codes still take precedence. Quoted task content, similar words, modified exact-message suffixes and HTTP 403 prose do not become eligible for another model. Unknown execution state still requires reconciliation. HTTP 403 remains conservative `reconcile`, not an explicitly decoded `stop`.

Implementation: `plugins/codexclaw/components/subagent-config/src/fallback-errors.ts`, with its tracked compiled output. Four regression tests were added to the existing dispatch suite. The captured native messages failed before the repair; all 18 dispatch tests passed after it. Build compiled 166 files and validated layout; strict TypeScript checking of the decoder passed.

Native verification repeats the isolated setup and limitations documented in `012_isolated_native_verification.md`. The same native binary, real spawn/wait/close, trusted hook commands and compiled dispatch CLI are used. Only provider responses and the main's protocol choices are scripted. The tests verify the `main-direct` decision; they do not prove an unscripted main model's subsequent task execution or a live OCX/provider account.

The expanded matrix runs eight scenarios for each of executor, explorer and reviewer: primary success, generic SSE quota, canonical-message SSE quota, SSE rate limit, HTTP 429, HTTP 500, HTTP 403, and fallback success. Assertions check the final action, exact attempt count, observed outbound model/effort, hook issuance and reviewer independence. Expected routing is `xai/grok-4.6`/high -> `cursor/grok-4.6`/low, then `main-direct` if the fallback also fails. Primary success and HTTP 403 must never issue a second attempt; fallback success must end `complete` after two attempts.

Final result: native matrix 24 passed, 0 failed. Full repository rerun (`env TMPDIR=/var/tmp/cxc-fallback-native-701c17d/tmp npm test`) exited 0: 2,725 total, 2,654 passed, 0 failed, 71 skipped. All fixture servers and native subprocesses exited. Build/typecheck and `git diff --check` passed. These results cover the final source and compiled changes in this repair.

Evidence directory: `/var/tmp/cxc-fallback-native-701c17d/`.

- `regression-red.log` / `regression-green.log`: before/after regression output.
- `fix-build.log`: production build.
- `run-fixed.py`: matrix runner with assertions; `matrix.py`: native fixture.
- `fixed/acceptance.json`: expanded matrix verdicts; each scenario directory contains requests, native events, dispatch traces and results.
- `fix-full-test.log`: full repository test rerun after the repair.

Original failing evidence remains outside `fixed/`. No operator settings, installed plugin or remote Git state were changed.
