# 010 — Phase 1: I→P agent override in orchestrate-cli (audit round 3)

> Rounds 1-2 FAIL (Erdos). Root cause: tracker manipulation cannot open the gate
> without either forging evidence or destroying it. The correct fix is to add an
> agent override at the TRANSITION level — mirror the human `override:true` path
> in `applyHumanTransition` (orchestrate-apply.ts:120-150), but in the agent CLI
> path (orchestrate-cli.ts). No tracker mutation. No new files. No scan fabrication.

## Design: agent I→P override at the orchestration layer

The human chat path already supports I→P override:
- `applyHumanTransition` checks `evaluateInterviewGate()`
- If ready → opens the gate normally
- If not ready + `attest.override === true` → pre-flips `flags.interview = true`,
  records `actor:"human"`, `override:true`, `scanEvidence` in the ledger
- If not ready + no override → advise-block with gate warnings

The agent CLI path (`orchestrate-cli.ts`) calls `transition()` which has NO
override support. The fix: add equivalent override logic for I→P in the agent
CLI path, recording `actor:"agent"` instead of `actor:"human"`.

The tracker stays UNTOUCHED. The override is at the transition level.
The ledger records full provenance. The `did` narrative provides the reason.

## MODIFY: `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts`

Before the `const result = transition(state, to, args.attest)` call (~line 286),
add the I→P agent override path:

```ts
// I→P agent override (mirrors applyHumanTransition's override path in
// orchestrate-apply.ts:120-150). The agent CLI path uses the un-weakened
// transition() which has no override support. This adds equivalent logic
// for I→P only, recording actor:"agent" instead of actor:"human".
if (state.phase === "I" && to === "P") {
  const gate = evaluateInterviewGate(state.interview ?? null);
  if (gate.ready) {
    // Interview is ready — let the normal transition() path handle it.
    // (It will derive flags.interview=true from the tracker.)
  } else if (args.attest?.override === true) {
    // Agent override: pre-flip the interview flag and bypass the gate.
    const flags = { ...state.flags, interview: true };
    const legal = canEnter(to, { ...state, flags });
    if (!legal.ok) {
      return { code: 1, output: `orchestrate ${args.verb}: ${renderPhaseContext(state, sessionId)}; ${legal.reason}` };
    }
    const next: State = { ...state, phase: to, flags, orchestrationActive: true, lastInjectedPhase: to, stopBlockPhase: null, stopBlockCount: 0 };
    writeState(args.cwd, next);
    resetRenderLedger(args.cwd);
    appendLedger(args.cwd, {
      ts: new Date().toISOString(),
      sessionId: state.sessionId,
      from: state.phase,
      to,
      reason: "cli",
      actor: "agent",
      override: true,
      scanEvidence: { scanRounds: state.interview?.scanRounds ?? 0, highContradictionCount: gate.highContradictionCount },
      ...(args.attest?.did ? { evidence: args.attest.did } : {}),
    });
    return { code: 0, output: `orchestrate P: I → P (agent override, session ${sessionId})` };
  } else {
    // Not ready and no override: advise-block with gate warnings.
    return {
      code: 1,
      output: `orchestrate ${args.verb}: ${renderPhaseContext(state, sessionId)}; interview soft-gate: ${gate.warnings.join("; ")}. Pass override:true in --attest to proceed.`,
    };
  }
}
```

Import additions at top: `evaluateInterviewGate` from `"./interview.ts"`,
`canEnter` from `"./fsm.ts"` (verify: may already be imported via transition).
Also import `resetRenderLedger` from `"./render-observations.ts"` (existing
pattern at line 343).

## MODIFY: `plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts`

Add after the existing "G20: I->P needs the interview flag" test (~line 471):

1. **Agent override succeeds**: seed at I with null tracker →
   `runOrchestrateCli({verb:"P", attest:{from:"I",to:"P",did:"interview done",override:true}, session:"s1", cwd, json:false})`
   → code 0, output matches /agent override/, `readState` shows phase=P,
   ledger entry has `actor:"agent"`, `override:true`, `scanEvidence`.

2. **Agent override without override flag**: seed at I with null tracker →
   `runOrchestrateCli({verb:"P", attest:{from:"I",to:"P",did:"..."}, session:"s1", ...})`
   → code 1, output matches /soft-gate/.

3. **Agent override with ready tracker**: seed at I with `readyInterview()` →
   `runOrchestrateCli({verb:"P", attest:null, session:"s1", ...})`
   → code 0 (normal path, no override needed).

4. **Agent override records scanEvidence**: verify ledger entry after override
   contains `scanRounds: 0` and correct `highContradictionCount`.

## MODIFY: `plugins/codexclaw/skills/interview/SKILL.md`

In "## Runtime Status (shipped)", after readiness gating:

```
- Agent I→P override: `cxc orchestrate P --session <id> --attest '{"from":"I",
  "to":"P","did":"<reason>","override":true}'` bypasses the interview readiness
  gate when the tracker is not ready. This mirrors the human chat override path:
  the tracker is NOT modified, `flags.interview` is pre-flipped at the transition
  level, and the ledger records `actor:"agent"`, `override:true`, `scanEvidence`
  with the pre-override gate evaluation. The `did` narrative must explain why the
  agent considers the interview complete despite the unready tracker.
```

## NOT modified (scope boundary)

- `fsm.ts` — untouched; `canEnter()` and `transition()` unchanged.
- `interview.ts` — untouched; `isInterviewReady()` unchanged.
- `state.ts` — untouched; no new event types.
- `orchestrate-apply.ts` — untouched; human override path unchanged.
- No new files created.

## Verification (C)

1. `node plugins/codexclaw/scripts/build.mjs` — exit 0
2. `npm test` — all existing tests pass (pre-existing repo-map failure excluded)
3. New test cases pass in `orchestrate-cli.test.ts`
4. Manual: from phase=I with null tracker, `cxc orchestrate P --session <id> --attest '{"from":"I","to":"P","did":"test","override":true}'` succeeds
