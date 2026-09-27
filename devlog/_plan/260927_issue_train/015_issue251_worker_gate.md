# #251 — Gate legacy worker only during an armed PABCD build/check cycle

When PABCD policy is enabled (012), registered `executor` needs an evidence receipt at every SubagentStop, regardless of parent state-file existence. SessionStart normally creates state; direct hook calls without it keep the existing executor fail-safe behavior. A built-in `worker` needs one only when its parent session is actively orchestrating phase B or C. With PABCD disabled, the gate is silent for **both** types and creates no attempt file or tombstone. An ordinary worker outside an armed B/C cycle releases at its first SubagentStop.

Current anchors: `plugins/codexclaw/components/pabcd-state/src/subagent-evidence.ts:471`, `plugins/codexclaw/components/pabcd-state/src/state.ts:486`, `plugins/codexclaw/components/pabcd-state/test/subagent-evidence.test.ts:57`, `plugins/codexclaw/skills/pabcd/references/delegation.md:12`, `plugins/codexclaw/components/subagent-config/src/spawn-wrapper.ts:27`.

## File change map

### MODIFY `plugins/codexclaw/components/pabcd-state/src/subagent-evidence.ts`

`GATED_AGENT_TYPES` currently includes both roles (`:57-64`) and `runSubagentStopGate` enters receipt logic immediately (`:471-510`). Keep the matcher set so registered hooks still reach this function; add the worker predicate before `extractReceiptPath`, `readAttempts`, or any state/evidence write.

The dispatch-level `readPabcdEnabled` switch in 012 runs first. For a direct call to this function, also check policy at the top of `runSubagentStopGate` (or inject an already-computed policy flag) so disabled behavior is consistent. Add `if (!readPabcdEnabled(payload.cwd)) return "";` before the role check, receipt extraction, attempts, tombstones and state writes. Test direct calls and built-hook dispatch. Do not add a parent-state-existence release clause; keep the existing executor attempts, tombstones, and completion consequences.

```ts
if (!GATED_AGENT_TYPES.has(payload.agent_type)) return "";
if (payload.agent_type === "worker") {
  const { state, unreadable } = readStateStrict(payload.cwd, payload.session_id);
  if (unreadable || !state.orchestrationActive || (state.phase !== "B" && state.phase !== "C")) return "";
}
```

`readStateStrict` is the existing non-throwing strict reader (`state.ts:486-603`); `orchestrationActive` is reconstructed false at IDLE (`state.ts:529`). The chosen worker predicate is **both** active orchestration and phase B/C. Phase P/A reviewers and ordinary worker delegations stay outside this receipt gate. When policy is enabled, `executor` bypasses the worker predicate and retains the existing receipt, retry, tombstone, and parent-completion consequences. When policy is disabled, both roles release without touching evidence state. An unreadable worker state releases because the parent cycle cannot be proved armed; executor still follows the enabled-policy fail-safe behavior, with no 011 state-existence exception. Keep receipt root validation for gated paths.

### MODIFY `plugins/codexclaw/components/pabcd-state/test/subagent-evidence.test.ts`

At `:57-64`, replace the unarmed default-worker expectation with `worker outside armed PABCD releases without attempts or tombstone`: assert output `""`, `readAttempts(...) === 0`, no `.codexclaw/evidence-attempts` path, and `readState(...).unverifiedSubagents` empty. It fails before the fix because first Stop blocks. For the existing receipt/tombstone tests that use the test helper's default worker, either seed `{ phase:"B", orchestrationActive:true }` in each fixture or change only the helper default to `executor`; preserve explicit worker coverage. Add `worker in armed B and C blocks without receipt`, `worker at P/A/IDLE or orchestrationActive false releases`, `executor with or without state and no active cycle still blocks`, and `worker with unreadable state releases without write`. Assert no attempt/tombstone writes on every release path. The `GATED_AGENT_TYPES` set assertion can remain (`test/:57` and later role checks): it describes hook routing, not unconditional gate application.

Add `disabled PABCD releases executor and worker with no attempts/tombstones` for direct `runSubagentStopGate` calls and built-hook dispatch, including an otherwise armed B/C state. Add `enabled PABCD overrides project false and gates executor` to prove 012's positive env override. For a direct executor SubagentStop on a fresh cwd, retain the current evidence-gate result; its first directory creation receives 011's `.gitignore`. A fresh unarmed worker releases without attempts or a new directory.

### MODIFY `plugins/codexclaw/skills/pabcd/references/delegation.md`

At `:8-19`, add one sentence after the registered-executor fallback line: “When PABCD policy is enabled, the registered executor is evidence-gated on every SubagentStop; the built-in worker fallback is evidence-gated only while the parent has an active PABCD B/C cycle. When PABCD policy is disabled, both gates are silent. Outside that cycle the worker releases without a receipt.”

### MODIFY `plugins/codexclaw/components/subagent-config/src/spawn-wrapper.ts`

Update the comment at `:8-12` to mention this distinction. Do not change `ROLE_AGENT_TYPE` (`:26-32`): unregistered executor still maps to native `worker`, and the runtime gate uses parent session phase. If the canonical doctrine in `structure/20_pabcd_dispatch_doctrine.md` repeats “all workers always gated,” update that exact sentence in the builder branch after locating it; this is a documentation sync, not a runtime dependency.

## Activation and bypass record

Exercise executor with no state (still gated), worker with no state (released), worker P/A/B/C/IDLE, B/C with `orchestrationActive=false`, both roles with PABCD off (including armed B/C), corrupt state, valid/invalid receipt, repeated Stop, and tombstone terminal behavior. **Tier:** SubagentStop `decision:block` is runtime continuation control analogous to E2, but structure/40 defines E2 for the `Stop` hook specifically; E8 tests cover this gate. **Executing surface:** `runSubagentStopGate` and hook dispatch. **Known bypass:** child labeled as an ungated type or a missing/untrusted hook. **Residual risk:** worker writes outside armed B/C are not receipt-gated. **Wording downgrade:** “registered executor receipts under enabled PABCD; legacy worker receipts in active B/C,” not “every worker is verified.” **Final enforcement layer:** SubagentStop runtime gate under enabled policy, then parent completion gate for recorded tombstones, with E8 regression tests. Out of scope: changing native agent registration or receipt file format.
