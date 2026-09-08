# wp3 — independent review verdicts and adjudication

Three `anthropic/claude-opus-5` reviewers, dispatched as independent read-only lanes. Each
received the same packet shape (TASK / SCOPE / MUST DO / MUST NOT / PROOF / RETURN FORMAT /
DECISION BOUNDARY) and reviewed exactly one PR with no access to the other lanes' output.

## PR 92 — test: cover Windows short-path source bindings

**Reviewer verdict: APPROVE-WITH-NITS.** **Adjudication: MERGE FIRST.**

| # | Sev | Finding | Decision |
|---|---|---|---|
| 1 | MAJOR | Badge count is merge-order coupled: `README.md:16` becomes `2,671`, correct only while `dev` measures 2,670. CI's inventory step fails when published count != measured total. | **ACCEPTED.** This is why 92 merges first, and why wp4 re-derives the final count after all three land. |
| 2 | MINOR | Some assertions cannot distinguish canonicalized from non-canonicalized behavior, since a short alias and its long name address the same directory. | Accepted as redundancy, not incorrectness. The discriminating assertions are the `binding.nativeCwd` / `binding.sourceRoot` content checks. No change required. |
| 3 | MINOR | A missing or failing `cmd.exe` throws instead of skipping. | Noted. Narrow Windows-only path; not blocking. |
| 4 | NIT | `realpathSync.native` precondition asserts the tool the implementation uses. | Fixture sanity check. Accepted as-is. |
| 5 | NIT | Scope includes a devlog file and three README badges. | Badges are forced by the inventory gate. Scope discipline satisfied. |

The reviewer independently reached the same CI conclusion this session did: `ci.yml:6`,
`wsl.yml:6` and `packed-install.yml:15` all declare a bare `pull_request:` with no `paths:`
key, so the matrix was never path-filtered. It was gated on fork-contributor approval
(`conclusion: action_required`), which this session approved. Both Windows legs subsequently
passed.

## PR 91 — fix: unify executor registration, dispatch and exit verification

**Reviewer verdict: REQUEST-CHANGES.** **Adjudication: HOLD — do not merge.**

| # | Sev | Finding | Decision |
|---|---|---|---|
| 1 | **BLOCKER** | `ROLE_AGENT_TYPE.executor` unconditionally emits `agent_type: "executor"` (`spawn-wrapper.ts:24`, read with no fallback at `:377`), but `executor` is not a codex-rs built-in. It resolves only after a manual `cxc subagents register executor` plus a session restart. Every existing install's first executor dispatch after upgrade fails with `unknown agent_type 'executor'`. | **ACCEPTED — blocking.** Verified independently: `dev` currently declares `Record<RoleName, "explorer" | "worker">` at `spawn-wrapper.ts:24` and the PR changes it to `"executor"`; `~/.codex/agents/` on this machine is EMPTY, so this host is exactly the affected population. |
| 2 | MAJOR | README registration command uses an unexpanded `<plugin-root>` placeholder and is placed before hook approval. | Accepted; compounds finding 1. |
| 3 | MAJOR | Registration has no upgrade path: byte-inequality is the only "differs" signal, no `--force`, no provenance marker (`role-registration.ts:36`, `cli.ts:39-43`). A later prompt change pins every registered user to the old prompt. | Accepted as a real design gap. |
| 4 | MINOR | After registration the role prompt is delivered twice — natively and inlined (`spawn-wrapper.ts:378`). | Accepted; context waste, not incorrectness. |
| 5 | MINOR | `agents/README.md:15` still says the built-ins are default/explorer/worker, directly below the table declaring executor canonical. | Accepted. |
| 6 | NIT | Comment in `review-observer.ts:61` still says "worker" where the code tests both. | Accepted. |

**What the reviewer confirmed as correct**: the legacy `worker` alias still routes correctly
(`spawn-attach-hook.ts:441`), `GATED_AGENT_TYPES` is a strict superset of the old
single-element set (`subagent-evidence.ts:64`) so the exit gate cannot have lost a case, and the
observer now imports the same constant rather than duplicating a literal
(`review-observer.ts:41`), which structurally guarantees the receipt gate and the review
observer partition children instead of racing.

**Rationale for holding.** The routing and exit-verification half of this PR is sound. The defect is
in the delivery model: it converts a working default into one that requires an undocumented manual
step, and it fails at the host tool boundary where the plugin cannot catch or explain the error.
Because PABCD routes B-phase writes through the executor role, this takes out the implementation
path of the workflow rather than a peripheral feature. Merging it would leave `dev` in a state
where this very session's delegation surface breaks after the next reinstall.

A one-line fallback in `resolveSpawnPayload` — emit `"worker"` when
`$CODEX_HOME/agents/executor.toml` is absent — resolves it, since both the gate and
`inferRole` already accept `worker`. That belongs to the PR author, not to this merge pass.

## PR 93 — fix(subagents): persist effort and add global defaults with live OCX models

**Reviewer verdict: REQUEST-CHANGES.** **Adjudication: FIX THE TWO MAJORS, THEN MERGE.**

| # | Sev | Finding | Decision |
|---|---|---|---|
| 1 | MAJOR | `EffortSelect.tsx:25` folds an unknown ladder into `[]` via `?? []`, disabling every effort option for models whose ladder OCX does not advertise. | **ACCEPTED — fixed in this merge.** |
| 2 | MAJOR | `Subagents.tsx:65` does the same in the save guard, refusing a model switch with a misleading message; `:109` repeats it in the display warning. | **ACCEPTED — fixed in this merge.** |
| 3 | MINOR | An explicit refresh can join an in-flight non-forced request and be labeled `fresh` (`live-catalog.ts:90`). | Deferred. Affordance reliability, no data risk. |
| 4 | MINOR | A partial project write materializes inherited global values, pinning the role (`store.ts:213`). | Deferred. Deliberate and directly asserted by `scopes.test.ts:26`; the reviewer flagged discoverability, not correctness. |
| 5 | MINOR | `setRole` writes to an untrusted project config that `readSettings` then ignores (`store.ts:157`). | Deferred. Safe — the untrusted file still cannot influence spawns. |
| 6 | MINOR | `messenger-bridge/src/win-exec.ts:2` re-exports a sibling's `dist` from `src`. | Deferred. Works with the tracked dist; flagged for a follow-up. |
| 7 | NIT | MCP dispatch errors outside `callTool` leave the request unanswered (`mcp.ts:124`). | Deferred. |
| 8 | NIT | `/model` in Telegram can now block on a bounded subprocess. | Deferred. 12s timeout, 30s cache. |

**Independent verification of the blocking pair.** The reviewer's mechanism was confirmed
directly rather than taken on trust. `reasoningEfforts()` at `catalog.ts:81` returns `null` for a
non-array, and `live-catalog.ts:51` preserves that, so the three states reach the UI intact —
the PR's own `live-catalog.test.ts:28` asserts `[['low','high'],[],null]`. A live
`ocx models live --json` on this host returned 106 rows, of which several
(`claude-haiku-4-5`, `claude-opus-4-5`, `auto`, `auto-balance`, `auto-cost`) carry no
`reasoningEfforts`. Those models would have been effort-locked in the dashboard.

**The fix.** `effortExcluded()` now lives in `gui/src/effort-support.ts` and returns true only
for an actual array that omits the effort. It is used at all three sites. Extracting it to a
plain `.ts` was necessary because node:test cannot load `.tsx`. Four regression tests in
`gui/test/effort-support.test.ts` pin every state, including that `[]` still excludes
everything — an explicitly empty ladder is a positive claim, unlike `null`.

**Merge conflict.** PR 93 conflicted with `dev` after 92 landed, on one line: the test-count
badge (2,671 from 92 vs 2,692 from 93). Resolved by measuring the merged tree — 2,693 —
then 2,697 after adding the four regression tests, written through
`inventory.mjs --write --tests 2697`.

## Summary of adjudication

| PR | Verdict | Outcome |
|---|---|---|
| 92 | APPROVE-WITH-NITS | Merged first (badge ordering) |
| 91 | REQUEST-CHANGES (BLOCKER) | **Held.** Not merged. |
| 93 | REQUEST-CHANGES (2 MAJOR) | Fixed in-place, then merged |
