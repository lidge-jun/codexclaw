# 040 — Work-Aware Stop Continuation (runtime impl scaffold)

Status: PROPOSED (scaffold; no code yet) · 2026-07-01 · lazygap_impl loop 040 · class C3 (hook/runtime)

> Source gap: `../lazygap/003` (Stop continuation depth). A-gate (Kuhn, gpt-5.4) verified vs
> shipped `handleStop` and returned SAFE-TO-WRITE with 7 constraints, all folded below. Depends
> on `030` (the goalplan artifact) AND `030.3` (slug provenance) — without a reliable slug, Stop
> cannot locate the goalplan and MUST behave exactly like today.
>
> 040 is a TEXT-ONLY enrichment of the Stop block reason. It changes no guard, no arming
> condition, no counter, and reads no DB. If anything here reads as "Stop now decides differently",
> it is wrong.

## Why

Shipped `handleStop` arms on coarse signals (active goal + in-flight cycle + stagnation budget)
and its block reason names only the phase command (`buildStopBlock(phase)`). It cannot say WHAT
work remains because nothing durable records it. With `030`'s goalplan, the block reason can name
the next concrete task + the evidence it must produce + the ledger path — so the agent self-advances
toward real remaining work, not just "do phase X". omo's continuation reads remaining checkboxes
and names the next item (`../lazygap/003`); 040 is that, within codexclaw's no-server model.

## Ground Truth (read before edit — shipped baseline)

Exact shipped `handleStop` order (`hook.ts:429-458`), every line a release/guard:
1. `hook_event_name !== "Stop"` → release.
2. `stop_hook_active` → release (`:432`).
3. `readState(cwd, session_id)` (`:434`).
4. `!orchestrationActive || phase === "IDLE"` → release (`:436`).
5. `phase === "I"` → release (interview firewall) (`:441`).
6. `getGoalActiveStatus(session_id) !== "active"` → release (`:443`). ← the ARMING gate.
7. `isContextPressureTail(readTranscriptTail(transcript_path))` → release (`:445`).
8. stagnation calc `samePhase`/`nextCount` (`:450-451`).
9. `nextCount > MAX_STOP_BLOCKS` → reset counter + release (`:452-455`).
10. persist `stopBlockPhase/stopBlockCount` (`:457`).
11. `return buildStopBlock(state.phase)` (`:458`). ← the ONLY block path.

- `buildStopBlock(phase)` today takes ONLY `phase` (`hook.ts:411`); reason is the phase label +
  `STOP_NEXT_COMMAND[phase]` + the D-close note.
- Goal-DB access on this path is ONLY `getGoalActiveStatus` (`goal-active.ts:62`, sqlite). A
  goalplan read is a plain file read under `payload.cwd` — NO new DB access.
- `state.slug` is NOT reliably persisted (`state.ts:62` default `""`, `:87` rehydrate-only;
  `freeze-cli.ts:65` falls back to `state.slug || sessionId`). → 030.3 is a hard prerequisite.
- D is effectively not a persisted resting phase: chat D closes to IDLE (`orchestrate-apply.ts:82`),
  CLI D closes to IDLE (`orchestrate-cli.ts:177`). So Stop blocking AT phase D is defensive/
  test-only, not the common runtime path — 040 prose must not imply D is a normal Stop-block phase.
- `loop/SKILL.md` is already HONEST (`:17-29`): it says the Stop hook blocks/releases only, never
  transitions, and uses coarse signals. 040 does NOT downgrade it; 040 EXPANDS one line to note
  that with a goalplan the block reason may NAME remaining work while still not transitioning.

## Design (diff-level)

### The only code change: enrich the block reason on the final block path

`buildStopBlock` gains an OPTIONAL second arg; the no-goalplan call is byte-identical to today.

```ts
// hook.ts — signature change is additive; phase-only call is unchanged.
export function buildStopBlock(phase: Phase, work?: StopWorkContext | null): string {
  const label = STAGE_LABELS[phase] ?? phase;
  const nextCommand = STOP_NEXT_COMMAND[phase] ?? "`cxc orchestrate status`";
  const lines = [
    `[codexclaw — continue PABCD] You are mid-cycle at ${phase} (${label}) with an active goal.`,
    "Do the real work of this phase, then self-advance with the concrete next command:",
    nextCommand,
  ];
  if (work) {
    // ENRICHMENT ONLY — appended lines; never replaces the phase command above.
    if (work.nextTaskTitle) lines.push(`Remaining work: ${work.nextTaskTitle}`);
    if (work.expectedEvidence) lines.push(`Required evidence: ${work.expectedEvidence}`);
    if (work.ledgerPath) lines.push(`Record progress in: ${work.ledgerPath}`);
  }
  lines.push("C→D requires checkOutput+exitCode. D is not a resting state; close the cycle back to IDLE.");
  return `${JSON.stringify({ decision: "block", reason: lines.join("\n") })}\n`;
}

export interface StopWorkContext {
  nextTaskTitle: string | null;
  expectedEvidence: string | null;
  ledgerPath: string | null;
}
```

### handleStop wiring (the final return ONLY — after every guard)

```ts
// hook.ts handleStop — replace ONLY the final `return buildStopBlock(state.phase);`
// All guards 1-10 above are untouched and run first.
const work = readStopWorkContext(payload.cwd, state); // null on any miss → exact old behavior
return buildStopBlock(state.phase, work);
```

### `readStopWorkContext` (new helper — pure, fail-safe, no DB)

```ts
// Resolve the goalplan via the persisted slug (030.3); enrich only. Any miss → null.
export function readStopWorkContext(cwd: string, state: State): StopWorkContext | null {
  const slug = state.slug;                       // 030.3 guarantees this is set when a goalplan exists
  if (!slug) return null;                         // no slug → behave exactly like today
  const plan = readGoalplan(cwd, slug);           // 030 helper; null on absent/unreadable
  if (!plan) return null;
  const next = nextOpenTask(plan);                // 030 helper
  const unmet = unmetCriteria(plan);              // 030 helper
  return {
    nextTaskTitle: next ? `${next.wp.title} → ${next.task.title}` : null,
    expectedEvidence: unmet[0]?.expectedEvidence ?? null,
    ledgerPath: next || unmet.length ? `.codexclaw/goalplans/${slug}/ledger.jsonl` : null,
  };
}
```

### What 040 deliberately does NOT do

- Does NOT add a block condition: arming stays exactly the 6 release guards + stagnation cap.
- Does NOT let a goalplan arm Stop without a host active goal (corrected 030 coupling).
- Does NOT read or write any goal DB; goalplan is a local file.
- Does NOT touch `stopBlockPhase/stopBlockCount`; the cap fires identically.
- Does NOT transition any phase; Stop still only blocks/releases.

## Invariants

- TEXT-ONLY enrichment: the goalplan read happens on the final block path (after all release
  guards + the cap-release branch), and changes only the reason string.
- Back-compat exact: absent/unreadable goalplan OR missing slug → `readStopWorkContext` returns
  `null` → `buildStopBlock(phase, null)` emits the byte-identical shipped reason.
- No new DB access; no new early return; no counter change; no goal-active rule change.
- Stagnation cap unchanged — naming a task never resets or bypasses it.
- Prerequisite: 030.3 (persisted slug). Until it lands, `state.slug` is `""` → null → old behavior.

## Acceptance

| Check | Evidence |
|-------|----------|
| Guards unchanged | all 6 release paths + cap-release still release identically (existing Stop tests stay green) |
| Enrichment only on block | a blocked Stop with a goalplan appends Remaining work / Required evidence / ledger lines |
| No-goalplan byte-identical | no slug or no goalplan → reason string equals the current shipped reason exactly |
| No DB access added | `readStopWorkContext` does only `node:fs` under cwd; no sqlite/goal-active call |
| Stagnation intact | block count still caps at MAX_STOP_BLOCKS regardless of work text |
| Slug prerequisite honored | with `state.slug===""`, behavior is exactly today (null context) |
| D note | doc/tests treat phase-D Stop block as defensive/test-only, not a normal path |

## Verification

- `node --test plugins/codexclaw/components/pabcd-state/test/hook.test.*` (Stop guard suite stays green)
- add a `readStopWorkContext` unit test (goalplan present → enriched; absent/no-slug → null)
- extend `plugins/codexclaw/test/hook-e2e.test.mjs` Stop case: with a seeded goalplan, the block
  reason names the next task; without one, the reason is unchanged.
- `npm run build` (idempotent) ; `npm test` (full suite green) ; `npm run gate` ; `git diff --check`.

## PABCD plan (one full cycle)

- P: this diff-level design; confirm enrichment-only + the 030.3 slug prerequisite.
- A: gpt-5.4 explorer challenges — is every shipped guard preserved in order? is the no-goalplan
  reason truly byte-identical? does any path read the goalplan before the release guards? is the
  cap untouched?
- B: implement `buildStopBlock` optional arg + `readStopWorkContext` + handleStop final-return wire
  + tests; expand `loop/SKILL.md` one line (Stop may NAME remaining work, still no transition).
- C: build idempotent + Stop unit/e2e + gate; capture tails.
- D: close to IDLE, commit `feat(lazygap-040): work-aware Stop continuation`, `update_goal`.

## Depends on / feeds

Depends on `030` (goalplan artifact + helpers) and `030.3` (persisted slug). Feeds the
autonomous loop UX: the agent self-advances toward named remaining work. Independent of the
`010`/`020` dispatch spine.
