# 010 — SubagentStop Evidence-Receipt Gate (runtime impl scaffold)

Status: PROPOSED (scaffold; no code yet) · 2026-07-01 · lazygap_impl loop 010 · class C3 (hook/runtime)

> Source gap: `../lazygap/002` (the single biggest harness hole). Runtime feasibility VERIFIED
> in `../lazygap/010` Q1: `SubagentStop` is a real Codex hook event that fires on plugin
> thread-spawned children, receives the child's `last_assistant_message`, and can force the
> child to continue via `decision:"block"` + `reason`. So this is a genuine **E1** gate.
>
> Translates omo's `lazycodex-executor-verify` pattern into codexclaw's no-server model.

## Why

Today a dispatched subagent's "done" claim is never verified at runtime: codexclaw registers
6 hooks, none on the `SubagentStop` surface (`plugins/codexclaw/.codex-plugin/plugin.json`
hooks array). A child can report success having done nothing, and the parent integrates that
on trust. This blocks `020` (skill-attached dispatch): a "reviewer, red-team per `cxc-dev`"
verdict is only trustworthy if the child had to produce evidence. 010 supplies that trust.

## Ground Truth (read before edit)

- codexclaw hooks dir: `plugins/codexclaw/hooks/` (6 JSON manifests). Add a 7th.
- Hook manifest shape (matcher + command -> dist cli.js): see
  `plugins/codexclaw/hooks/post-tool-use-capturing-interview-answers.json`
  (`"matcher": "^request_user_input$"`, command `... cli.js hook post-tool-use`).
- CLI dispatcher: `plugins/codexclaw/components/pabcd-state/src/cli.ts:74-95` — `event` switch
  with a FAIL-CLOSED branch for `pre-tool-use` and a fail-open try for the rest. A new
  `subagent-stop` branch goes inside the fail-open try (release on any error).
- Parsers: `plugins/codexclaw/components/pabcd-state/src/parse.ts:51` (`parseStop`) is the
  template; payload types live in `hook.ts:37` (`StopPayload`). Add `SubagentStopPayload` +
  `parseSubagentStop`.
- omo reference (the pattern to translate, do NOT copy paths):
  `devlog/.lazycodex/plugins/omo/components/lazycodex-executor-verify/src/codex-hook.ts:11-30`
  (`runSubagentStopHook`: agent_type guard, context-pressure bail, receipt check, bounded
  attempt block) + `hooks/hooks.json:5` (`"matcher": "^lazycodex-executor$"`) +
  `src/directive.md` (the block reason) + `src/types.ts:3` (`SubagentStopInput`:
  `agent_type`, `agent_id`, `transcript_path`, `last_assistant_message`).
- Verified SubagentStop stdin fields (codex-rs `schema.rs:578-595`): `session_id`, `turn_id`,
  `transcript_path`, `agent_transcript_path`, `cwd`, `hook_event_name`, `model`,
  `permission_mode`, `stop_hook_active`, `agent_id`, `agent_type`, `last_assistant_message`.
- Output schema (codex-rs `schema.rs:464-480`): `{ decision?: "block", reason?: string }`.

## Design (diff-level)

New hook manifest `plugins/codexclaw/hooks/subagent-stop-verifying-evidence.json`:

```json
{
  "hooks": {
    "SubagentStop": [
      {
        "matcher": "^worker$",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js\" hook subagent-stop",
            "timeout": 10,
            "statusMessage": "(codexclaw) Verifying subagent evidence"
          }
        ]
      }
    ]
  }
}
```

> BLOCKING DESIGN DECISION (verified, not cosmetic). The SubagentStop matcher keys on the
> child's `agent_type` (codex-rs `stop.rs:54,57`; payload carries it at `:149,160`). codexclaw's
> `ROLE_AGENT_TYPE` (`spawn-wrapper.ts:27-31`) only ever emits TWO built-in values: `worker`
> (executor) and `explorer` (BOTH explorer and reviewer). A real child arrives as e.g.
> `agent_type:"worker"` (codex-rs test `subagent_notifications.rs:713`). Consequences:
>   1. A matcher like `^(executor|reviewer)$` would NEVER fire — those strings are not agent_types.
>   2. `agent_type` ALONE cannot separate a write-review (reviewer) from a read-only investigate
>      (explorer): both are `explorer`. So matching on `agent_type` either gates all explorers
>      (noisy: read-only research shouldn't need a receipt) or none.
> The scaffold above gates `^worker$` (executor/write work) as the safe, unambiguous default —
> write-class dispatches are exactly the ones whose "done" must be proven. RESOLVE in P which of:
>   (a) gate `^worker$` only (recommended start: write work needs receipts; explorers are read-only);
>   (b) ALSO gate `^explorer$` but have the gate inspect the child's `last_assistant_message` /
>       transcript for a write/verify intent marker the `020` dispatch injected, and release
>       read-only explorers by content (not by agent_type);
>   (c) have `020` stamp a distinguishing marker into the spawn so the gate can tell reviewer
>       from explorer despite the shared agent_type.
> This is the one genuine cross-loop coupling between `010` and `020`; do not implement 010's
> matcher until it is chosen.
>
> DECISION (locked, P-phase 2026-07-01): start with **(a) gate `^worker$` only**. Rationale:
> write/executor work is exactly where an unproven "done" is dangerous; read-only explorers
> produce findings the parent re-reads anyway, so a forced receipt there is noise. Reviewers
> currently map to `agent_type:"explorer"`, so they are NOT gated by `010` in this first pass;
> gating reviewers is deferred to a `020` follow-up that stamps a distinguishing marker (option
> c) once the role×intent dispatch lands. The hook still reads `last_assistant_message` so a
> later content-based extension (option b) is a pure add, not a rewrite.

New types + parser (`hook.ts` + `parse.ts`):
- `SubagentStopPayload { hook_event_name:"SubagentStop"; session_id; cwd; agent_type; agent_id?;
  turn_id?; transcript_path?|null; agent_transcript_path?|null; model?; permission_mode?;
  stop_hook_active?; last_assistant_message?|null }`. (Full wire shape verified A-gate:
  codex-rs `schema.rs:576` `SubagentStopCommandInput`, snake_case, `deny_unknown_fields`.)
  CRITICAL: `transcript_path` is the PARENT transcript; the CHILD's transcript is
  `agent_transcript_path` (codex-rs `hook_runtime.rs:302`). The compaction bail must read the
  CHILD path, else a compacted child gets wrongly blocked.
- `parseSubagentStop(raw): SubagentStopPayload | null` — mirror `parseStop` (`parse.ts:51`):
  `asObject` + `str` + event-name check + tolerant optional fields.

New module `plugins/codexclaw/components/pabcd-state/src/subagent-evidence.ts`
(direct `node:fs`, NO fs-injection seam — matches `interview-ledger.ts`/`state.ts`, per A-gate):
1. `EVIDENCE_ROOT = ".codexclaw/evidence"` (project-local, under `cwd`).
2. `extractReceiptPath(lastMessage): string | null` — last-line marker
   `EVIDENCE_RECORDED: <relpath>` (adopt omo's contract; also accept codexclaw `--evidence`).
3. `hasValidReceipt(cwd, receiptPath): boolean` — port omo's realpath/symlink/non-empty guard
   (`isPathInsideDirectory` + `realpathSync`): path must resolve INSIDE `.codexclaw/evidence/`,
   be a real file (not a symlink), and be non-empty.
4. Attempt state `.codexclaw/evidence-attempts/<session>-<agent_id>.json`:
   `readAttempts/writeAttempts/clearAttempts`; `MAX_ATTEMPTS = 3`.
5. `transcriptHasContextPressure(agentTranscriptPath): boolean` — port omo's
   `CONTEXT_PRESSURE_MARKERS` (codex-hook.ts:32-40) bail. Reads the CHILD transcript
   (`agent_transcript_path`), NOT the parent `transcript_path`.
6. `runSubagentStopGate(payload): string` — the decision fn (direct node:fs inside):
   - not a gated `agent_type` -> `""` (release).
   - context-pressure marker present -> clear attempts, `""`.
   - valid receipt -> clear attempts, `""`.
   - missing/invalid receipt AND attempts < MAX -> increment, return
     `JSON.stringify({ decision:"block", reason:<verifier directive> })`.
   - attempts >= MAX -> clear attempts, `""` (bounded; fail-open release, never trap).

Verifier directive (block `reason`): a short imperative — "Your completion is unverified. Run
the relevant checks and write output to `.codexclaw/evidence/<file>`; final line must be
`EVIDENCE_RECORDED: <path>`. This is attempt N of 3." (codexclaw-native wording, English).

Wire-up (`cli.ts`): inside the fail-open try, add
`else if (event === "subagent-stop") { const p = parseSubagentStop(raw); if (p) output = runSubagentStopGate(p); }`.
Register the manifest in `.codex-plugin/plugin.json` hooks array (now 7).

### Invariants

- FAIL-OPEN: any IO/parse error -> release (`""`); the gate can never trap a session.
- Bounded: at most `MAX_ATTEMPTS` blocks per (session, agent_id), then release.
- Receipt path MUST resolve inside `.codexclaw/evidence/`, real, non-empty (no symlink escape).
- No goal-DB access; all state under `.codexclaw/`.
- Matcher scoped to write/verify `agent_type` only — read-only explorers are not gated.

## Acceptance

| Check | Evidence |
|-------|----------|
| Gate fires only for gated agent_type | non-matching agent_type -> `""` |
| Missing receipt blocks (under cap) | no marker -> `decision:"block"` + reason names the receipt path |
| Valid receipt releases | marker -> real non-empty file in evidence root -> `""` + attempts cleared |
| Symlink / outside-root receipt rejected | symlinked or `../` path -> treated as invalid -> block |
| Bounded block | attempts at MAX -> `""` (release), never infinite |
| Context-pressure bail | transcript has compaction marker -> `""` |
| Fail-open on error | malformed stdin / unreadable fs -> `""`, never throws |
| Manifest wired | `.codex-plugin/plugin.json` lists 7 hooks; e2e drives `cli.js hook subagent-stop` |

## Verification

- `node --test plugins/codexclaw/components/pabcd-state/test/subagent-evidence.test.ts`
- extend `plugins/codexclaw/test/hook-e2e.test.mjs` with a `subagent-stop` case (block on
  missing receipt, release on valid receipt) driving the real dist entrypoint.
- `npm run build` (idempotent; +1 compiled module) ; `npm test` (full suite green) ;
  `npm run gate` (exit 0) ; `git diff --check`.

## PABCD plan (one full cycle)

- P: this doc's diff-level design; confirm the exact gated `agent_type` literal.
- A: gpt-5.4 explorer challenges — is the chosen matcher a REAL `agent_type` (`worker`/`explorer`,
  not `executor`/`reviewer`)? is the reviewer-vs-explorer ambiguity resolved per the blocking
  decision above? is fail-open preserved on every error path? does the receipt guard resist
  symlink escape?
- B: implement manifest + types/parser + `subagent-evidence.ts` + cli wiring + tests.
- C: build idempotent + unit + e2e + gate; capture tails.
- D: close to IDLE, commit `feat(lazygap-010): SubagentStop evidence-receipt gate`, `goal update`.

## Depends on / feeds

Feeds `020`: a skill-attached reviewer/executor must return a receipt this gate accepts, which
is what makes the red-team verdict trustworthy rather than prose.
