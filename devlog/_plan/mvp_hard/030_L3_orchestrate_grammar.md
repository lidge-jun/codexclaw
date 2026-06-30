# L3 / 030 — `$cxc-orchestrate` Grammar Parser (pass L3a)

Status: P (plan) · 2026-06-30 · mvp_hard loop L3 pass A · class C3 (new contract, no persistence yet)

> L3 is split into two PABCD passes because it crosses a parser↔state boundary:
> - **L3a / 030 (this doc)**: a pure grammar parser for the orchestrate command. No
>   state writes, no hook edits — just `parseOrchestrateCommand(prompt)` + tests.
> - **L3b / 031 (next doc)**: wire the parser into `handleUserPromptSubmit` so a
>   chat-submitted command actually calls `transition()+writeState+appendLedger`.
>
> Splitting keeps each pass independently testable and each commit atomic.

## Goal (L3a)

Add a pure parser that recognizes the explicit orchestrate command grammar inside a
submitted prompt, distinct from the loose `detectTrigger()` heuristic. The parser is
the contract L3b wires to the FSM.

Grammar (mirrors `jaw orchestrate <phase>`):
```
orchestrate <I|P|A|B|C|D|status|reset> [--attest <json>]
```
- Case-insensitive on the verb and phase token.
- Phase tokens: `I P A B C D` (the work phases) + two control verbs `status`, `reset`.
- Optional `--attest <json>`: a JSON object (the attestation). Parsed leniently —
  malformed JSON yields `attest: null` plus a `attestError` note, never throws.
- Anchored: the command must appear as its own directive, not buried mid-sentence.
  Accept an optional leading `$cxc-` / `cxc ` / `/` prefix so `$cxc-orchestrate p`,
  `cxc orchestrate p`, and bare `orchestrate p` all parse (composer autocomplete
  inserts the `$cxc-orchestrate` skill mention; the user then types the phase).

## Reference (verified)

- cli-jaw verb set `I|P|A|B|C|D|status|reset` ([handlers-runtime.ts](/Users/jun/Developer/new/700_projects/cli-jaw/src/cli/handlers-runtime.ts:447)).
- codexclaw current loose detector (to be kept, NOT replaced) ([hook.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/hook.ts:48)).
- attest JSON shape consumed by `coerceAttest` ([attest.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/attest.ts:45)).

## File change map (IN scope, L3a only)

1. NEW `plugins/codexclaw/components/pabcd-state/src/orchestrate-grammar.ts`
   - `export type OrchestrateVerb = Phase | "status" | "reset";`
   - `export interface OrchestrateCommand { verb: OrchestrateVerb; rawAttest: string | null; attest: Attestation | null; attestError?: string; }`
   - `export function parseOrchestrateCommand(prompt: string): OrchestrateCommand | null;`
     Returns null when no orchestrate command line is present. Uses `coerceAttest`
     from attest.ts to turn `--attest <json>` into an `Attestation | null`.
   - Keep it under 120 lines, pure, no IO.
2. NEW `plugins/codexclaw/components/pabcd-state/test/orchestrate-grammar.test.ts`
   - parses `orchestrate p`, `$cxc-orchestrate P`, `cxc orchestrate status`,
     `orchestrate reset`.
   - phase case-insensitivity; rejects junk (`orchestrate x`, `orchestrate`, empty).
   - `--attest {json}` parsed into `attest`; malformed JSON → `attest:null` +
     `attestError` set, no throw.
   - a prompt with prose around the command on its own line still parses; a phase
     word buried in a sentence ("please plan this") does NOT parse as a command
     (that stays the job of the loose `detectTrigger`).

## Scope boundary

- IN: the new parser module + its test. Pure function only.
- OUT: any edit to `hook.ts`, `cli.ts`, `state.ts`, `fsm.ts` (that's L3b/031); the
  `cxc orchestrate` terminal CLI (L4/040); `status`/`reset` semantics + ledger
  (L5/050). L3a does NOT call `transition()` and does NOT write state.

## Accept criteria (testable)

- `parseOrchestrateCommand("orchestrate p")` → `{verb:"P", attest:null, rawAttest:null}`.
- `parseOrchestrateCommand("$cxc-orchestrate A --attest {\"from\":\"P\",\"to\":\"A\",\"did\":\"x\"}")`
  → `verb:"A"`, `attest` coerced to `{from:"P",to:"A",did:"x"}`.
- `parseOrchestrateCommand("orchestrate status")` → `verb:"status"`.
- `parseOrchestrateCommand("please plan this feature")` → `null` (not a command).
- malformed attest JSON sets `attestError`, `attest:null`, never throws.
- `npm test` green at 233+; `npm run build` idempotent.

## Risk / rollback

- Risk: a too-greedy regex could swallow normal prose ("orchestrate the release").
  Mitigation: require the verb token immediately after `orchestrate` to be one of
  the known phase/control tokens; otherwise return null.
- Rollback: delete the new module + test; nothing else references it until L3b.

## Audit focus (for A gate)

- Does the anchor/prefix handling correctly accept `$cxc-orchestrate p` (autocomplete
  inserts the mention) without also matching prose? Is the verb whitelist exhaustive?
- Is `coerceAttest` reuse correct, or does the parser need its own JSON extraction
  for the `--attest {…}` segment (brace-balanced, since JSON can contain spaces)?
- Should `status`/`reset` be in the same return type as phases, or split? (Plan keeps
  them unified as `OrchestrateVerb` for one parse surface.)

## Audit verdict (A gate — independent reviewer, 2026-06-30)

Verdict: **PLAN OK with fixes**. Folded into the build scope:

1. **HIGH — robust `--attest` JSON extraction**: `coerceAttest` only coerces an
   already-parsed object; it does NOT extract JSON text. The parser must FIRST pull
   the full JSON object after `--attest` via **brace-balanced extraction** (scan from
   the first `{`, track depth, respect string literals so a `}` inside a quoted `did`
   doesn't end early), THEN `JSON.parse` → `coerceAttest`. A `split(" ")` /
   `/--attest (\S+)/` approach is forbidden (truncates spaced `did`). Malformed/
   unbalanced → `attest:null` + `attestError`, never throw.
2. **MEDIUM — exclude IDLE**: the verb type is `Exclude<Phase,"IDLE"> | "status" | "reset"`
   (work phases `I P A B C D` + control verbs). `orchestrate idle` is rejected (null).
3. **MEDIUM — L3b precedence note (documented now, enforced in L3b)**: `detectTrigger`
   already matches `orchestrate p` etc. In L3b, `parseOrchestrateCommand` is the
   AUTHORITATIVE path and must be tried FIRST with an early return; the loose
   `detectTrigger` only runs when the strict parser returns null. L3a stays parser-only.
4. **MEDIUM — prefix model**: native plugin mentions render as `$codexclaw:cxc-orchestrate`;
   raw `$cxc-orchestrate` is hook-parsed shorthand. The parser accepts leading
   `$codexclaw:cxc-orchestrate`, `$cxc-orchestrate`, `cxc orchestrate`, `/orchestrate`,
   and bare `orchestrate`. Tests cover the namespaced form.
5. **LOW — added tests**: `orchestrate idle` rejects; `orchestrate proper testing`
   rejects; `please orchestrate p` mid-sentence rejects (command must be line-anchored);
   spaced `did` parses; truncated/unbalanced brace JSON → `attestError`; namespaced
   `$codexclaw:cxc-orchestrate P` parses.
6. **LOW — verification cwd**: `npm run build` runs from repo root
   `/Users/jun/Developer/new/700_projects/codexclaw`; `npm test` is wired there too.

### Grammar precedence / line-anchoring (resolved)

The command must be its own line (optionally prefixed). Match per-line: trim each
line, strip an optional leading `$codexclaw:cxc-`/`$cxc-`/`cxc `/`/` prefix, then
require the line to START with `orchestrate <verb>`. A verb not in the whitelist or
a non-anchored occurrence → null. This is why "please orchestrate p" (mid-sentence)
does not parse.
