# 011 — A-Gate Audit Synthesis

Reviewer: `Wegener`
Verdict: `GO-WITH-FIXES (blockers=4)`

## Folded Blockers

1. **Reset phase context missing**
   - Finding: the plan said every resolvable explicit-session orchestrate path surfaces phase context, but omitted `reset`.
   - Decision: accepted.
   - Amendment: `000_plan.md` now requires `reset` and no-op reset phase context; `010_implementation_contract.md` now pins reset tests.

2. **Malformed-attest activation scenario omitted `attest: null`**
   - Finding: the planned direct `runOrchestrateCli` call did not satisfy the existing `OrchestrateCliArgs` type.
   - Decision: accepted.
   - Amendment: `010_implementation_contract.md` now includes `attest: null` in the activation scenario instead of widening the type unnecessarily.

3. **No-mutation proof too narrow**
   - Finding: the plan required no session/ledger/render-ledger mutation but only named the missing sessions-dir assertion.
   - Decision: accepted.
   - Amendment: test scope now requires sessions dir, existing session JSON, `.codexclaw/ledger.jsonl`, and render ledger checks for help/unknown-verb paths.

4. **Compiled unknown-verb path not pinned**
   - Finding: the top-level plan required dist CLI unknown-verb + session phase reporting, but the implementation contract only pinned dist help.
   - Decision: accepted.
   - Amendment: both `000_plan.md` and `010_implementation_contract.md` now require `dist/cli.js orchestrate wat --session binsess --cwd <tmp>` evidence.

## Residuals

No unresolved blockers remain. The folded items are concrete test/contract amendments and do not require changing FSM semantics.

VERDICT: GO-WITH-FIXES (blockers=4 folded)
