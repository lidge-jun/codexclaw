# 010 — wp1: issue sweep and preview cleanup

Order inside the phase follows dependency, not effort: config/policy first (preview),
then the CI contract (#301, inventory.mjs + ci.yml + docs), then test-only fixes
(#297 + worktree-guard), then the #296 verdict (needs the full suite after those
fixes), then docs-only rules (#294), then delivery (PR, CI, merge, issue comments).

## MODIFY map

### 1. preview cleanup (c-1)

- `.github/workflows/ci.yml:5` — `branches: [main, preview, dev]` → `branches: [main, dev]`.
- `.github/workflows/wsl.yml:12` — same edit.
- `.github/scripts/closed-pr-branch-cleanup.cjs:17` —
  `Object.freeze(["main", "dev", "preview", "gh-pages"])` → `Object.freeze(["main", "dev", "gh-pages"])`.
- `.github/scripts/closed-pr-branch-cleanup.test.cjs:44-45` — title
  "protects the integration, release, and prerelease lines" → "protects the integration
  and release lines"; list drops `"preview"` (no new assertion naming it: c-1 requires
  zero hits in this file too — architect reflection gap 1).
- `.github/scripts/closed-pr-branch-cleanup.test.cjs:149` — `branches: ["dev", "main", "preview"]`
  → `branches: ["dev", "main"]`.

### 2. #301 inventory floor mode (c-2)

`plugins/codexclaw/scripts/inventory.mjs`:

- Header usage (L19-24): add
  `node plugins/codexclaw/scripts/inventory.mjs --check --tests <measured-total> --tests-mode floor`.
- `export const TESTS_MODES = Object.freeze(["exact", "floor"]);`
- `check(options)` (L325): destructure `testsMode = "exact"`; throw on a value outside
  TESTS_MODES; keep `notices = []`. Replace the L361-367 block with:
  - exact (unchanged): `published !== expected` → existing violation text.
  - floor: `published > expected` → violation
    `"published tests=P exceeds the measured suite total E — the badge overstates; run inventory.mjs --write --tests E"`;
    `published < expected` → `notices.push("published tests=P lags the measured suite total E — run node plugins/codexclaw/scripts/inventory.mjs --write --tests E (the release gate requires an exact match)")`.
  - return `{ ok, violations, notices, inventory }` (additive field).
- CLI (L416-438): read `--tests-mode`; reject a value outside TESTS_MODES and reject
  `--tests-mode` without `--tests` (exit 1, message names both flags). Print each notice
  as `::notice title=tests badge::<text>` on stdout before the OK/FAIL lines, in both
  outcomes. Success suffix: exact → existing "(tests badge matches the measured N)";
  floor → "(tests badge P does not exceed the measured N)".
- `gate.mjs:332` (bare `check()`) and `release.yml:164` (bare `--check`) unchanged.

`.github/workflows/ci.yml:56-62`: comment updated (lag allowed on PR/dev, release exact);
command becomes
`node plugins/codexclaw/scripts/inventory.mjs --check --tests "${{ steps.suite.outputs.total }}" --tests-mode floor`.

`docs-site/src/content/docs/development/release.md` step 3: add one sentence — PR and
dev CI only fail when the badge exceeds the measured total and print the exact
`--write --tests N` command as a notice when it lags; the release gate compares exactly,
so the release commit regenerates it.

Tests, `plugins/codexclaw/test/inventory.test.mjs` (reuse `scratch()`/`rewriteTestsBadge`):

- floor + lag (badge 4000, measured 4321) → ok, one notice containing `--write --tests 4321`.
- floor + equal → ok, no notice.
- floor + overstatement (badge 4321, measured 4000) → not ok, violation contains "overstates".
- floor + lag + a README surface disagreement (one README's skills badge changed) → not ok
  (surface agreement stays mandatory) AND the lag notice is still returned.
- default mode still exact: lag (4000 vs 4321) → not ok (pins compatibility).
- unknown mode → throws.
- CLI, all against a `scratch()` tree (its copied `scripts/inventory.mjs` resolves the
  scratch roots from its own location, inventory.mjs:31-33), n = published + 5:
  - `--check --tests n --tests-mode floor` → exit 0, stdout has `::notice` and `--write --tests n`.
  - same, after breaking one README's skills badge → exit 1 AND stdout still has the
    lag notice (notice-on-failure, audit r1 note).
  - `--tests-mode bogus --tests n` → exit 1, stderr names the allowed modes.
  - `--tests-mode floor` without `--tests` → exit 1.

Untouched and re-run: `components/pabcd-state/test/release-gate.test.ts` (exact compare at
release-gate.ts:373-380).

### 3. #297 path-independent budgets (c-3)

- `components/subagent-config/test/l1-injections.test.ts:75-81`: keep the absolute-path
  assertion; measure
  `Buffer.byteLength(affordance.replaceAll(resolve("plugins/codexclaw/skills"), "<skills>")) <= 250`.
- `components/pabcd-state/test/worktree-guard.test.ts:277`: keep
  `context.includes(rig.slotRoot)`; measure
  `Buffer.byteLength(context.replaceAll(rig.slotRoot, "<slot>")) <= 250`.
- Normalization check: with the placeholder the measured text no longer depends on the
  root. Synthetic proof (architect reflection gap 2):
  - l1-injections: new test calls the exported `skillAffordanceBlock(dir)`
    (spawn-attach-hook.ts:646) with `/s` and with `"/" + "x".repeat(300)`; both
    normalized lengths are equal and <= 250, and each raw block contains its dir.
  - worktree-guard: `makeRig(pad?: string)` nests an optional extra directory under the
    temp home; the UserPromptSubmit dedupe test runs for `pad = ""` and
    `pad = "p".repeat(200)`, asserting the same normalized budget for both.

### 4. #296 Node 22 timer cancellations (c-4)

Evidence:
- Node 26.12.1, full `npm test`: tests 3869, pass 3862, fail 1 (worktree-guard budget,
  §3), cancelled 0.
- Audit r1 (reviewer, Node 22.22.0 executable invoked directly): tests 3869, pass 3854,
  fail 1, cancelled 8 — exactly #296's named tests (log /tmp/cxc-sweep/reviewer-full-test-n22.log
  L3669, L17192). Main's earlier "Node 22" run was Node 26: `npm` here is the Vite+
  launcher (/Users/jun/.vite-plus/bin/npm), which ignores a PATH-prepended node.
- Main repro, Node 22.22.0 direct: `<n22> plugins/codexclaw/scripts/test.mjs` on
  media-handler.test.ts + rate-limit.test.ts + mcp.test.ts → tests 34, pass 26,
  cancelled 8, exit 1 (/tmp/cxc-sweep/n22-three.log). So "pass alone" in the issue was
  a Node-version difference, not single-process interaction.
- Supported runtime: docs-site troubleshooting.md:50 "Use Node.js 22+".

Root cause: each trigger awaits a promise kept alive only by an `unref()`'d timer —
stream-download.ts:85-86 (`withDownloadTimeout` deadline), rate-limit.ts:63-64
(`rateLimitSleep`), mcp.ts:137 (`STALE_PROBE_MS` race). Node 22's runner sees an empty
loop, cancels that test ("Promise resolution is still pending but the event loop has
already resolved") and every later test in the file (writeAll and the gate test are
collateral). Node 24/26 keep waiting. The `unref()` calls are intended (they must not
hold a hook or CLI process open) and stay.

Fix (test-scoped, architect D6): in each trigger test, hold one referenced handle for
the test's lifetime and bound the test so the handle can never hang the run:

- media-handler.test.ts: local helper
  `function holdEventLoop(t: TestContext): void { const keep = setInterval(() => {}, 60_000); t.after(() => clearInterval(keep)); }`
  with a one-line comment naming Node 22 and #296; tests at L128 and L137 become
  `test(name, { timeout: 10_000 }, async (t) => { holdEventLoop(t); … })`.
  `TestContext` imported as a type from node:test.
- rate-limit.test.ts: same helper; tests at L107, L113, L120.
- mcp.test.ts: same helper; test at L240 (its own `< 5500` ms assertion stays; timeout
  10_000).
- No change to scripts/test.mjs or production sources (no suite-wide keepalive).

Activation: the C run on Node 22.22.0 direct over the three files must show cancelled 0,
fail 0; a red→green check is the r1/main repro above (cancelled 8 before).

### 5. #294 audit guidance (c-5)

`plugins/codexclaw/skills/pabcd/references/phase-audit.md` L3:

- After "Dispatch this reviewer — even a small/mini-model one — to challenge assumptions,
  find blockers (rollback gaps, missing callers, phantom constants), and verify references."
  insert: "A small/mini-model reviewer earns its place on fact checks — missing callers,
  wrong paths, phantom constants, stale references; give its whole-design rewrite
  suggestions little weight, and for substantial design work prefer the strongest
  reviewer available (AUDIT-REVIEWER-ROLE-01)."
- In the near-pass sentence, after "explicitly rebutted with recorded rationale" insert:
  "; a High/Critical rebuttal names a checkable basis when one exists — a command
  actually run with its output tail, or the exact path:line that shows the premise is
  false — and a prose-only 'it is not so' does not qualify for near-pass
  (REBUTTAL-BASIS-01, agent-followed; the gate does not parse it)".
- After "re-audit with the SAME reviewer (V2 `followup_task` … DISPATCH-ACTOR-01);" insert:
  "a re-audit round looks at whether each prior blocker is closed and what the amendment
  itself broke; a new Low/Medium finding outside that becomes a non-blocking residual in
  `auditResidual` instead of a FAIL, while a new High/Critical finding is still folded
  into the plan or rebutted under REBUTTAL-BASIS-01 before A>B, or the work returns to P
  (AUDIT-REAUDIT-SCOPE-01 — this is what lets the loop converge instead of trading one
  round of nits for the next);".

`phase-audit.md` L11-17 (reuse pointer): append "Reuse is the default; the round count
alone does not make a reviewer contaminated."

`loop-engineering.md` REVIEW-SYNTHESIS-01 (~L53-62): after "an explicit accept/rebut decision
per point." insert "Rebuttals follow REBUTTAL-BASIS-01 and re-audit rounds follow
AUDIT-REAUDIT-SCOPE-01 ([phase-audit.md](phase-audit.md))."

No change to attest.ts, gates, config, or the reviewer-tier/rotation/ledger proposals.

### 6. #313 (c-6)

No code. Comment: resolved by #307 (0.2.43 `cxc loop pr-record`) and #319 (gate reads the
record; version skew names the update path); close.

## TESTS

- `.github/scripts/closed-pr-branch-cleanup.test.cjs` (modified cases above).
- `plugins/codexclaw/test/inventory.test.mjs` (six API cases + four CLI cases above).
- `media-handler.test.ts`, `rate-limit.test.ts`, `mcp.test.ts` (#296 holds + timeouts).
- `l1-injections.test.ts`, `worktree-guard.test.ts` (modified assertions).
- No test for #294 prose (TEST-PROMPT-SEAM-01 in manifest-policy.test.mjs: prose-phrase
  tests are review, not tests).

## Verification (C) — run in P with exit codes

| Command | P result | Reads the target |
|---|---|---|
| `node plugins/codexclaw/scripts/test.mjs .github/scripts/closed-pr-branch-cleanup.test.cjs` | to run in B/C | file is the direct argument |
| `node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/test/inventory.test.mjs` | to run in B/C | direct argument; imports ../scripts/inventory.mjs |
| `node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/pabcd-state/test/worktree-guard.test.ts` | exit 1 now (budget 250 exceeded) | direct argument |
| `node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/subagent-config/test/l1-injections.test.ts` | to run in B/C | direct argument |
| `node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/pabcd-state/test/release-gate.test.ts` | to run in C | direct argument (release exactness unchanged) |
| `node plugins/codexclaw/scripts/inventory.mjs --check` | to run in C | reads READMEs + inventory.json |
| `node plugins/codexclaw/scripts/gate.mjs` | to run in C | calls check() (gate.mjs:332) |
| `npm test` (full, Node 26) | exit 1 (1 fail, §3) | package.json test globs include every changed test file |
| `<n22> plugins/codexclaw/scripts/test.mjs` media-handler + rate-limit + mcp (n22 = /private/tmp/cxc-sweep/n22/node_modules/node/bin/node) | exit 1, cancelled 8 (target: exit 0, cancelled 0) | direct arguments; runtime = Node 22.22.0 |
| `<n22>` full suite: `<n22> plugins/codexclaw/scripts/test.mjs <package.json test globs>` | r1: exit 1, cancelled 8 (target: exit 0) | same globs as npm test, Node 22 |
| `rg -n preview .github/workflows/ci.yml .github/workflows/wsl.yml .github/scripts/closed-pr-branch-cleanup.cjs .github/scripts/closed-pr-branch-cleanup.test.cjs` | exit 0, hits at ci.yml:5, wsl.yml:12, cjs:17, test.cjs:45,149 (target: exit 1, no hits) | direct arguments |
| #294 prose | human review (no command observes prose) | — |
| Hosted CI on the PR head | after push | runs ci.yml with --tests-mode floor |

## Reflection

Same architect (01a17d54…, gpt-6.1-sol): **MISALIGNED** with four gaps; D1–D7 mapped to
§1–§5. Main dispositions:

1. D1 contradiction (new `preview` assertion vs c-1) — ACCEPT; assertion dropped, rg
   verifier now includes the test file.
2. D5 long synthetic roots not actually tested — ACCEPT; direct `skillAffordanceBlock`
   short/long test and padded `makeRig` added.
3. D7 "new High/Critical still blocks" could reopen whole-design review — ACCEPT in
   part; superseded by audit r1 B2: only new Low/Medium findings become residuals, a new
   High/Critical is folded, rebutted under REBUTTAL-BASIS-01, or returns to P (§5).
4. D2/D3 missing floor + surface-disagreement and notice-on-failure coverage — ACCEPT;
   case added.

#313 disposition is main-verified (PR #307 merged 2026-10-21, #319 merged 2026-10-23;
`cxc loop pr-record` present in 0.2.44 dist pr-record.js:183), outside the architect's scope.
No material gap remains open before A.
