---
title: State Model
description: The .codexclaw file state — phases, the session schema, the transition ledger, and the interview ledger.
---

codexclaw keeps all durable state in plain files under the project's `.codexclaw/` directory.
There is no server and no database.

## Phases

A work-phase runs the IPABCD cycle. `IDLE` is the closed/rest state a cycle returns to:

```ts
type Phase = "IDLE" | "I" | "P" | "A" | "B" | "C" | "D";
```

`I` is the optional Interview phase; `P → A → B → C → D` is Plan → Audit → Build → Check → Done.
`D` closes the cycle back to `IDLE`.

## Files

| Path | Contents |
|---|---|
| `.codexclaw/sessions/<sessionId>.json` | The session `State` object. |
| `.codexclaw/ledger.jsonl` | Append-only `LedgerEntry` rows, one per transition. |
| `.codexclaw/interview/freeze.json` | Interview-plan freeze manifest. |
| `.codexclaw/interviews/<id>.jsonl` | Interview Q/A capture + scan-evidence events. |
| `.codexclaw/subagents.json` | Subagent role → model/prompt config. |

:::note
Older drafts referenced a single `.codexclaw/state.json`. The shipped layout is session-scoped
under `sessions/`; there is no top-level `state.json`.
:::

## Session state

```ts
interface State {
  phase: Phase;
  sessionId: string;
  slug: string;
  updatedAt: string;
  flags: { interview: boolean; auditPassed: boolean; checkPassed: boolean };
  supersededBy: string | null;
  injectedTurns: string[];
  lastInjectedPhase: Phase | null;
  orchestrationActive: boolean;
  interview: InterviewTracker | null;
  stopBlockPhase: Phase | null;
  stopBlockCount: number;
}
```

The `flags` are pre-flip gates: `auditPassed` gates `A → B`, `checkPassed` gates `C → D`, and
`interview` gates the `I → P` soft-gate. `stopBlockPhase` / `stopBlockCount` bound the Stop
continuation so a loop can never trap a session.

## Transition ledger

Every transition appends one row:

```ts
interface LedgerEntry {
  ts: string;
  sessionId: string;
  from: Phase | null;
  to: Phase;
  reason: string;
  evidence?: string;
  actor?: "human" | "agent";        // who drove the transition
  override?: boolean;               // human overrode the I->P soft-gate
  scanEvidence?: { scanRounds: number; highContradictionCount: number };
}
```

The `actor`, `override`, and `scanEvidence` fields distinguish a human chat free-pass from an
agent/CLI attest-gated transition, and record interview scan evidence at an `I → P` override.
