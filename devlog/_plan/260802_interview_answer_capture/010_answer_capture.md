# 010 — Phase 1: repair string-shaped answer capture

Work-phase `wp2`. This is the unblocking change: nothing downstream can
accumulate state until answers land in the ledger.

## Scope boundary

IN (edited): `components/pabcd-state/src/interview-ledger.ts`,
`components/pabcd-state/test/interview-ledger.test.ts`,
`plugins/codexclaw/test/hook-e2e.test.mjs`.

IN (regression-check only, no change expected):
`components/pabcd-state/test/rescan-coordinator.test.ts` — imports
`captureInterviewAnswers` at `:16` and calls it five times (`:32,44,57,63,92`)
with OBJECT fixtures, so it takes the unchanged `isRecord` branch. Listed because
DIFFLEVEL-ROADMAP-01 requires the map to name every direct consumer of a changed
function (audit C-3).

OUT: the tracker schema, the readiness predicate, `hook.ts` directives,
`scan-cli.ts`.

## File change map

### `components/pabcd-state/src/interview-ledger.ts`

Add a local coercion helper next to `isRecord`, then route both parsers through it.

```ts
/**
 * The host may deliver request_user_input tool_input/tool_response either as a
 * structured object or as a JSON string (observed in real rollouts). Accept both.
 * Total: anything unparseable becomes undefined and the caller degrades to empty.
 */
function asRecord(v: unknown): Record<string, unknown> | undefined {
  if (isRecord(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return isRecord(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
```

`parseAnswers` — replace the guard:

```ts
// before
if (!isRecord(toolResponse) || !isRecord(toolResponse.answers)) return {};
for (const [qid, val] of Object.entries(toolResponse.answers)) {

// after
const resp = asRecord(toolResponse);
if (!resp || !isRecord(resp.answers)) return {};
for (const [qid, val] of Object.entries(resp.answers)) {
```

`parseQuestions` — same treatment, since `tool_input` can arrive stringified by
the same transport:

```ts
// before
if (!isRecord(toolInput) || !Array.isArray(toolInput.questions)) return [];
for (const q of toolInput.questions) {

// after
const input = asRecord(toolInput);
if (!input || !Array.isArray(input.questions)) return [];
for (const q of input.questions) {
```

Both remain total — no new throw paths. `JSON.parse` is wrapped; a non-object
parse result (`"null"`, `"[1,2]"`, `"5"`) returns `undefined` and the caller
returns empty exactly as today.

## Tests

`test/interview-ledger.test.ts` — add, and confirm each FAILS before the change:

1. `parseAnswers` accepts a JSON-string `tool_response` and returns the answer map.
2. `parseQuestions` accepts a JSON-string `tool_input`.
3. `captureInterviewAnswers` with a string `tool_response` writes BOTH
   `question_asked` and `answer_recorded` (this is criterion `c2`).
4. Regression: malformed strings (`"{"`, `"null"`, `"[]"`) still return empty and
   never throw.
5. Regression: the existing object-shaped path is unchanged.

`plugins/codexclaw/test/hook-e2e.test.mjs` — the fixture at :487 currently feeds
an object. Do NOT replace it (that path is real too); ADD a sibling case using the
verbatim string body recorded in `001_evidence.md` E1, asserting an
`answer_recorded` row appears.

Note the existing arity assertion `assert.equal(res.written.length, 4)` at
`test/interview-ledger.test.ts:63` counts 2 questions x 2 events. It uses object
fixtures (`:32-43`) and is unaffected. New cases must assert their own counts
rather than perturbing it.

`test/state.test.ts:441-447` was checked directly: it exercises `state.ts`
`readInterviewEvents` on a hand-written mixed ledger and never reaches
`interview-ledger.ts` parsing. Unaffected.

Also add a string-payload variant of the goal-firewall case at
`test/interview-ledger.test.ts:153-168`, which currently covers only the object
shape (audit C-5).

## Verification

```
npm test                 # full suite green
npm run build            # hooks execute dist/, so rebuild before probing
# then feed a string-shaped payload to the built CLI in a temp cwd and confirm
# the ledger contains both question_asked and answer_recorded
node plugins/codexclaw/components/pabcd-state/dist/cli.js hook post-tool-use
```

## Accept criteria

- `c2`: a STRING `tool_response` yields an `answer_recorded` event, shown failing
  before and passing after.
- `c3`: `npm test` green.

## Risk

Low, but larger than "one extra row" (audit C-3 correction).

The `tool_response` coercion only adds `answer_recorded` rows to ledgers that
already exist. The `tool_input` coercion is different in kind: today a string
`tool_input` yields ZERO events and no ledger file at all, so after the fix
sessions that currently have no ledger will start getting one. Two consequences:

1. `readQaEvents` returns data for sessions that previously returned nothing.
2. ~~`handlePostToolUse` can now emit `RESCAN_REINJECT_DIRECTIVE` on turns that
   previously stayed silent.~~ **Retracted (audit round 2).** The reviewer ran
   `handlePostToolUse` against both pre- and post-fix builds and the directive
   was emitted in ALL cases, including on garbage input: the reinjection at
   `hook.ts:1157-1165` depends only on goal status and `phase === "I"`, never on
   whether capture wrote anything. This commit adds no injection path. The
   original risk statement was wrong in the author's favor.

On ordering: `captureInterviewAnswers` runs BEFORE the goal-firewall check
(`hook.ts:1142` vs `:1153`). That is deliberate and correct — PreToolUse denies
the tool outright under an active goal, so nothing reaches here anyway, and
recording an answer that genuinely happened is the intended behavior.

Growth is bounded by real user answers. A 5MB answer writes a 5MB ledger, but
that requires a user to type 5MB.

Per `004_wire_capture.md`, the coercion is a WIDENING: it accepts both shapes, so
it is a no-op wherever the wire is already an object. It cannot be wrong; it can
only be unnecessary in paths that already work.
