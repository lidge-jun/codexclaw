# 050 — PostCompact Recovery Hook (runtime impl scaffold)

Status: PROPOSED (scaffold; no code yet) · 2026-07-01 · lazygap_impl loop 050 · class C2 (hook/runtime)

> Source gap: `../lazygap/006` (compaction recovery). A-gate (Hegel, gpt-5.4) verified vs codex-rs
> + shipped hook.ts and returned SAFE-TO-WRITE with one hard scope correction folded below:
> resetting the re-inject cursor does NOT guarantee next-prompt re-inject — the context-pressure
> bail runs first. The honest value is narrow and stated as such.
>
> This is a small resilience add (E4), independent of every other decade.

## Why

After a context compaction, codexclaw waits passively for the next `UserPromptSubmit` to
re-surface PABCD state, and once suppression clears it emits only the SHORT stage header (mode 3),
not the full phase directive — because `lastInjectedPhase` still equals the current phase, so the
full-directive mode-2 path never fires. omo recovers deliberately with PostCompact hooks
(`../lazygap/006`). 050 adds one PostCompact hook that resets the cursor so the first
NON-SUPPRESSED same-phase prompt after recovery gets the FULL directive instead of just the header.

## Ground Truth (read before edit — codex-rs + shipped baseline)

- `PostCompact` is a real, registerable plugin hook event: `hook_config.rs:42,119`,
  `protocol.rs:1355`. codexclaw registers 7 hooks today; this is the 8th.
- `PostCompactCommandInput` stdin fields (codex-rs `schema.rs:362`, serialized `compact.rs:207`):
  `session_id, turn_id, agent_id?, agent_type?, transcript_path, cwd, hook_event_name, model,
  trigger`. Both `session_id` AND `cwd` are present (`schema.rs:363,371`) — so `readState`/
  `writeState` path resolution works (`state.ts:79,83,135`).
- PostCompact output is SIDE-EFFECT-ONLY for our purpose: the schema allows only universal fields
  (`schema.rs:172`), the parser returns `StatelessHookOutput` (`output_parser.rs:250`), and the
  runtime honors only `continue/stopReason/systemMessage` — NO `additionalContext`, NO `decision`
  block (`compact.rs:353,361`). So the hook CANNOT inject context; it can only mutate our own
  `.codexclaw/` state and return `""`.
- Re-inject mechanism (`hook.ts`): mode-2 full directive fires when `state.phase !==
  state.lastInjectedPhase` (`:305-307`). Setting `lastInjectedPhase=null` makes that true.
- CRITICAL ordering caveat (`hook.ts`): the context-pressure bail `if (isContextPressureTail(tail))
  return ""` (`:292`) runs BEFORE the `lastInjectedPhase` check (`:306`). And if the transcript
  tail still carries the current phase's stage marker, the handler silently rewrites
  `lastInjectedPhase = state.phase` and returns nothing (`:294`), UNDOING the reset. So a reset
  does NOT guarantee re-inject on the immediately next prompt.
- Pressure markers: `transcript.ts:20` `CONTEXT_PRESSURE_MARKERS` (compaction/summary strings).
- cli.ts dispatcher: the generic fail-open `try` (`cli.ts:80`) is the right home for a
  `post-compact` branch (swallow errors, emit `""`).

## Design (diff-level)

### New manifest `plugins/codexclaw/hooks/post-compact-resetting-reinject-cursor.json`

```json
{
  "hooks": {
    "PostCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js\" hook post-compact",
            "timeout": 10,
            "statusMessage": "(codexclaw) Recovering PABCD state after compaction"
          }
        ]
      }
    ]
  }
}
```

(No matcher: PostCompact is not tool-scoped.)

### New types + parser (`hook.ts` + `parse.ts`)

```ts
export interface PostCompactPayload {
  hook_event_name: "PostCompact";
  session_id: string;
  cwd: string;
  turn_id?: string;
  transcript_path?: string | null;
  trigger?: string;
}
// parse.ts: parsePostCompact(raw): PostCompactPayload | null  — mirror parseStop (parse.ts:56)
```

### New handler (`hook.ts`)

```ts
// Side-effect-only: reset the re-inject cursor so the next NON-SUPPRESSED same-phase prompt
// upgrades from the short stage header to the full phase directive. Returns "" always
// (PostCompact output cannot inject context — codex-rs honors only universal fields).
export function handlePostCompact(payload: PostCompactPayload): string {
  if (payload.hook_event_name !== "PostCompact") return "";
  const state = readState(payload.cwd, payload.session_id);
  // Only meaningful for an in-flight orchestrated cycle; otherwise nothing to recover.
  if (!state.orchestrationActive || state.phase === "IDLE") return "";
  // Reset ONLY the directive cursor. Do not touch phase, flags, goalplan, or the stagnation
  // counter. lastInjectedPhase=null makes the next mode-2 check (phase !== lastInjectedPhase)
  // true, so the first eligible same-phase prompt gets the FULL directive, not the header.
  writeState(payload.cwd, { ...state, lastInjectedPhase: null });
  return "";
}
```

### cli.ts wiring (inside the fail-open try)

```ts
} else if (event === "post-compact") {
  const payload = parsePostCompact(raw);
  if (payload) output = handlePostCompact(payload); // always "" ; side-effect only
}
```

Register the manifest in `.codex-plugin/plugin.json` hooks array (now 8).

## Honest scope (what 050 does and does NOT claim)

- DOES: after compaction, reset the directive cursor so the FIRST non-suppressed same-phase
  prompt re-surfaces the FULL phase directive instead of only the short stage header.
- Does NOT: guarantee re-inject on the immediately next prompt. The context-pressure bail
  (`hook.ts:292`) and a stale stage marker in the tail (`hook.ts:294`) can both delay/undo it.
  050 explicitly does NOT bypass the pressure guard — that guard is correct (don't pile on
  during recovery).
- Does NOT: inject any context from the PostCompact hook itself (runtime ignores it).
- Without 050, mode-3 still emits the short header every same-phase turn; 050 only upgrades the
  first post-recovery one to the full directive. That is the entire, bounded value.

## Invariants

- Side-effect-only: handler returns `""`; never relies on PostCompact output being honored.
- Touches ONLY `lastInjectedPhase`; never phase, flags, stagnation counter, goalplan, or DB.
- No-op unless an orchestrated cycle is in flight (`orchestrationActive && phase !== IDLE`).
- FAIL-OPEN: any IO/parse error → `""` (lives in the cli.ts fail-open try).
- Does not bypass the context-pressure suppression; recovery resurfacing waits until it clears.

## Acceptance

| Check | Evidence |
|-------|----------|
| Cursor reset | after handlePostCompact on an active cycle, `state.lastInjectedPhase === null` |
| No-op when idle | `orchestrationActive=false` or `phase=IDLE` → state unchanged, `""` |
| Scope-limited write | only `lastInjectedPhase` changes; phase/flags/stopBlockCount/goalplan untouched |
| Re-inject upgrade | after reset, a non-suppressed same-phase UserPromptSubmit emits the FULL directive |
| Pressure not bypassed | with a pressure-tail, the next prompt still suppresses (existing behavior) |
| Fail-open | malformed stdin → `""`, no throw |
| Manifest wired | plugin.json lists 8 hooks; e2e drives `cli.js hook post-compact` |

## Verification

- `node --test plugins/codexclaw/components/pabcd-state/test/hook.test.*` (add handlePostCompact case)
- extend `plugins/codexclaw/test/hook-e2e.test.mjs`: seed an active-cycle state, drive
  `cli.js hook post-compact`, assert `lastInjectedPhase` reset + idle no-op.
- `npm run build` (idempotent) ; `npm test` (full suite green) ; `npm run gate` ; `git diff --check`.

## PABCD plan (one full cycle)

- P: this diff-level design; confirm side-effect-only + the narrowed claim.
- A: gpt-5.4 explorer challenges — does the handler touch anything beyond `lastInjectedPhase`?
  does it correctly no-op when no cycle is active? is the "does not bypass pressure" claim honest?
- B: implement manifest + types/parser + `handlePostCompact` + cli wiring + tests.
- C: build idempotent + unit + e2e + gate; capture tails.
- D: close to IDLE, commit `feat(lazygap-050): PostCompact recovery hook`, then continue.

## Depends on / feeds

Independent of all other decades (own surface). Lightly complements `040` (after recovery, the
full directive re-points the agent at goalplan/ledger). SessionStart stays detect-only (non-goal).
