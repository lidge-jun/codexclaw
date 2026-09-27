# #251 — Gate legacy worker only during an armed PABCD build/check cycle

Registered `executor` always needs an evidence receipt. A built-in `worker` needs one only when its parent session is actively orchestrating phase B or C. An ordinary worker releases at its first SubagentStop, without attempt files or tombstones.

Current anchors: `plugins/codexclaw/components/pabcd-state/src/subagent-evidence.ts:471`, `plugins/codexclaw/components/pabcd-state/src/state.ts:486`, `plugins/codexclaw/components/pabcd-state/test/subagent-evidence.test.ts:57`, `plugins/codexclaw/skills/pabcd/references/delegation.md:12`, `plugins/codexclaw/components/subagent-config/src/spawn-wrapper.ts:27`.

## File change map

### MODIFY `plugins/codexclaw/components/pabcd-state/src/subagent-evidence.ts`

`GATED_AGENT_TYPES` currently includes both roles (`:57-64`) and `runSubagentStopGate` enters receipt logic immediately (`:471-510`). Keep the matcher set so registered hooks still reach this function; add the worker predicate before `extractReceiptPath`, `readAttempts`, or any state/evidence write.

```ts
if (!GATED_AGENT_TYPES.has(payload.agent_type)) return "";
if (payload.agent_type === "worker") {
  const { state, unreadable } = readStateStrict(payload.cwd, payload.session_id);
  if (unreadable || !state.orchestrationActive || (state.phase !== "B" && state.phase !== "C")) return "";
}
```

`readStateStrict` is the existing non-throwing strict reader (`state.ts:486-603`); `orchestrationActive` is reconstructed false at IDLE (`state.ts:529`). The chosen predicate is **both** active orchestration and phase B/C. Phase P/A reviewers and ordinary worker delegations stay outside this receipt gate; only actual build/check workers need the legacy fallback. `executor` bypasses the predicate and retains the existing receipt, retry, tombstone, and parent-completion consequences. An unreadable worker state releases because the parent cycle cannot be proved armed; executor still follows the current fail-safe/tombstone behavior. Keep all existing receipt root validation for gated paths.

### MODIFY `plugins/codexclaw/components/pabcd-state/test/subagent-evidence.test.ts`

At `:57-64`, replace the unarmed default-worker expectation with `worker outside armed PABCD releases without attempts or tombstone`: assert output `""`, `readAttempts(...) === 0`, no `.codexclaw/evidence-attempts` path, and `readState(...).unverifiedSubagents` empty. It fails before the fix because first Stop blocks. For the existing receipt/tombstone tests that use the test helper's default worker, either seed `{ phase:"B", orchestrationActive:true }` in each fixture or change only the helper default to `executor`; preserve explicit worker coverage. Add `worker in armed B and C blocks without receipt`, `worker at P/A/IDLE or orchestrationActive false releases`, `executor without active cycle still blocks`, and `worker with unreadable state releases without write`. Assert no attempt/tombstone writes on every release path. The `GATED_AGENT_TYPES` set assertion can remain (`test/:57` and later role checks): it describes hook routing, not unconditional gate application.

### MODIFY `plugins/codexclaw/skills/pabcd/references/delegation.md`

At `:8-19`, add one sentence after the registered-executor fallback line: “The registered executor is evidence-gated on every SubagentStop; the built-in worker fallback is evidence-gated only while the parent has an active PABCD B/C cycle. Outside that cycle the worker releases without a receipt.”

### MODIFY `plugins/codexclaw/components/subagent-config/src/spawn-wrapper.ts`

Update the comment at `:8-12` to mention this distinction. Do not change `ROLE_AGENT_TYPE` (`:26-32`): unregistered executor still maps to native `worker`, and the runtime gate uses parent session phase. If the canonical doctrine in `structure/20_pabcd_dispatch_doctrine.md` repeats “all workers always gated,” update that exact sentence in the builder branch after locating it; this is a documentation sync, not a runtime dependency.

## Activation and bypass record

Exercise executor with no state, worker with no state, worker P/A/B/C/IDLE, B/C with `orchestrationActive=false`, corrupt state, valid/invalid receipt, repeated Stop, and tombstone terminal behavior. Tier: cooperative SubagentStop enforcement; executing surface: `runSubagentStopGate`; known bypass: a child labeled as an ungated type or a missing/untrusted hook; residual risk: a worker that performs writes outside an armed cycle is no longer receipt-gated. Wording: “legacy worker receipts are required in active B/C cycles,” not “every worker is verified.” Final enforcement layer: SubagentStop runtime gate, followed by parent completion gate for recorded tombstones. Out of scope: changing native agent registration or receipt file format.
