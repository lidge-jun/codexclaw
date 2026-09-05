# Verification and delivery

Code reviewed at `fac6f5095c5117e445ad4d6bbf71f77eabc81886`; the following archive
commit changes records only. PR: https://github.com/lidge-jun/codexclaw/pull/64
(base `dev`, head `codex/stack-awareness`). No merge or installed-plugin refresh.

## Fresh checks

- Before implementation, the expanded regression had **3 failures / 14 passes**:
  missing global pointer, missing fallback pointer, missing shipped-CLI pointer.
- After implementation and native-default clarification: focused hook/manifest tests
  **17 passed / 0 failed / 0 skipped**.
- Full affected cxc-ops suite + manifest policy + dist freshness: **195 passed / 0 failed / 0 skipped**.
  Command: `node --test plugins/codexclaw/components/cxc-ops/test/*.test.ts plugins/codexclaw/test/manifest-policy.test.mjs plugins/codexclaw/test/dist-freshness.test.mjs`.
- `node plugins/codexclaw/scripts/build.mjs`: **156 files**, exit 0, layout valid.
  This is type stripping, not typechecking. Dist byte parity passed independently.
- `node plugins/codexclaw/scripts/gate.mjs` and `git diff --check`: exit 0.
- Real `components/cxc-ops/dist/cli.js hook post-compact` output contains the native
  delivery and registration-verification pointer, with the existing event/envelope.
- No repository-wide local suite. PR CI was queued/in progress at handoff preparation;
  no cross-platform-green claim. Optional skill-creator validator could not import
  local PyYAML; repository manifest-policy checks were used instead, no install.

## Independent verification

Carver (`01a0716c-4608-7041-a492-dd3e90e402a0`) reviewed all **11/11 changed files**
against `01c2bc2a..fac6f509`, including the native-default interdiff. Independently ran
17 focused tests, gate and diff check, inspected manifest→CLI→both lifecycle handlers,
and confirmed source/dist parity. Reviewer reported five in-memory mutants killed
(removing source/dist lifecycle emissions or the native-default clause).
`blocking_issues: []`; **VERDICT: PASS**. Independent context, inherited model.

Gauss (`01a0716c-46a3-75e0-8975-49b8db426fac`) read only the latest dev skill and
canonical reference, not plans/reviews. Seven simulated decision scenarios:

| Fixture | Observed decision |
|---|---|
| Chain + Can Stack + successful empty membership | Manual chain; no registration/CI mutation under status-only authority |
| Confirmed native membership + per-PR CI | Native stack; separate CI is expected |
| Membership HTTP403 | Unknown, not unregistered; review accessible layer diff only |
| CSS stack / error stack trace | No PR-stack workflow |
| Async merge accepted then protection failure | Not merged; no unauthorized bypass |
| Native creation authorized, extension absent, API available | Use API without installing; require membership read-back |
| Explicit native request, endpoint unavailable | Not complete; investigate supported native alternatives, no silent manual fallback |

The first evaluation packet accidentally prohibited commands needed to read the
reference; that partial result was not accepted. After permitting only the two named
file reads, all scenarios were reevaluated. This is decision evidence, not live GitHub
execution or a guarantee that every future model follows guidance.

## Outcome and limits

Requested CodexClaw implementation and PR delivery are complete, with no unresolved
review findings. The persisted D transition and final-head test receipt live in the
session ledger/goalplan, not hand-written phase marks. Native registration is the
GitHub publishing default; a manual chain is not a substitute for an explicit native
request. The hook only exposes guidance; actual membership inspection is on demand.

What did not change: OpenCodex PRs/workflows, running CI, permissions, global Git config,
or the installed plugin. Hypothesis rejected: per-layer CI means stacking is broken.
Remaining limit: this patch does not deduplicate CI or enforce model compliance.
