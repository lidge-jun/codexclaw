# 001 — Evidence

All figures gathered 2026-08-02 from the live tree at
`/Users/jun/developer/new/700_projects/codexclaw` (branch `dev`) and from
`~/.codex/sessions/`.

## E1. The primary defect: the answer branch never runs

`parseAnswers` accepts an answer map only when the payload is already an object:

```ts
// components/pabcd-state/src/interview-ledger.ts:110-112
export function parseAnswers(toolResponse: unknown): Record<string, string[]> {
  if (!isRecord(toolResponse) || !isRecord(toolResponse.answers)) return {};
```

Extracted from a real rollout
(`~/.codex/sessions/2026/07/28/rollout-2026-07-28T05-18-59-019fa53b-...jsonl`),
matching the `request_user_input` call id:

```
OUTPUT TYPE: str
"{\"answers\":{\"item3_criterion_shape\":{\"answers\":[\"신규 채택에만 적용\"]},
  \"item5_upstream_filing\":{\"answers\":[\"제출까지 위임\"]},
  \"item45_defect\":{\"answers\":[\"좁은 오적용만 교정\"]}}}"
```

The body is exactly the documented shape — but wrapped in a string.

**CAVEAT (audit C-1, blocking).** The same rollout shows `function_call.arguments`
is ALSO a string (line 289, `arguments type: str`). If the hook received a string
`tool_input`, `parseQuestions` would return `[]` and NO ledger file would be
written — yet 222 `question_asked` rows exist (E2). Both facts cannot come from
the same wire format.

Therefore the rollout is the **model-facing transcript**, not the hook stdin
channel. `parsePostToolUse` (`parse.ts:145-163`) reads a separate stream and
passes `tool_input`/`tool_response` through untouched. The rollout proves the
host serializes to strings *somewhere*, but it does NOT prove what arrives on the
hook's stdin.

**Status: the defect is confirmed (E2), the mechanism is NOT yet proven.** A tee
wrapper on the hook command is capturing real stdin; see `004_wire_capture.md`.
Implementation of wp2 must not start until that capture resolves the shape.

## E2. Ledger census: 222 questions, 0 answers

Across every `*/.codexclaw/interviews/*.jsonl` in `700_projects`:

```
{'question_asked': 222, 'scan_completed': 17, 'rescan_completed': 12,
 'answer': 9, 'scan_round': 5}
```

(Count re-verified during the A-phase audit; `scan_completed` was 15 at first
scan and 17 after this session's own scan rounds — the file is live.)

`answer_recorded` does not appear. All 222 question rows carry a real `turnId`
and non-empty question text, which proves the hook fires and `parseQuestions`
works — the break is isolated to the response side.

### E2a. The 9 foreign `answer` rows are orphaned legacy data

The census includes 9 rows with `event: "answer"` in a schema this codebase never
produced:

```json
{"ts":"2026-07-23T08:32:16Z","session":"019f8e04-...","phase":"I","event":"answer",
 "question_id":"ambiguous_finish_policy","answer":"실무 종료 허용","notes":"..."}
```

`session` not `sessionId`, `question_id` not `questionId`, `answer` as a scalar
not `answers[]`, and no `eventId`. Grepping the plugin source for `question_id`
finds no producer. They were written by hand or by a tool that no longer exists,
all in `opencodex`, all on 2026-07-23.

Both readers discard them: `readQaEvents` (`interview-ledger.ts:69`) requires
`eventId`, and `readInterviewEvents` filters to scan kinds (proven by the G3
mixed-ledger test, `test/state.test.ts:436-457`).

**Declared OUT OF SCOPE as orphaned legacy data.** They are recorded here so the
"zero answers" claim is precise: zero answers exist *in the supported schema*,
and the 9 legacy rows are unreadable by any current consumer. No migration is
planned; a future cycle may delete them.

## E3. Interview state is empty in practice

12 most recent `.codexclaw/sessions/*.json`: 11 have `interview: null`, one has
all four dimensions at `"low"`, none reach `"max"`.

No production code writes `InterviewTracker.dimensions`. The only writer of
`state.interview` is `scan-cli.ts:83-87`, which sets `scanRounds` and
`lastScanRoundId` only.

## E4. Downstream consequence: Mind routing degrades to fixed order

```ts
// components/pabcd-state/src/minds.ts:169-179
if (!tracker || !isRecord(tracker) || !isRecord(tracker.dimensions)) {
  return [...MINDS].slice(0, n);
}
const lvl = tracker.dimensions[dim]?.level ?? "low";
```

The adaptive scorer itself is correct. With no writer, every dimension reads
`"low"`, all four tie, and the sort falls through to canonical order. "Target the
weakest dimension" is unsatisfiable because weakness is never computed.

## E5. The symptom, verbatim from the ledger

Shortest recorded questions across all sessions:

```
'이어서 어느 방향으로 진행할까요?'   <- appears twice, in different sessions
'맵에 뭘 담을까요?'
'언어 지원을 어떻게 단계화할까요?'
```

These are the context-blind questions the user complained about. They are what a
question generator produces when no prior answer, known fact, or open unknown is
available to ground it.

## E6. The test blind spot

```js
// plugins/codexclaw/test/hook-e2e.test.mjs:487
tool_response: { answers: { q1: { answers: ["A"] } } }
```

The e2e fixture feeds an object, so the suite passes while production fails. A
green suite is therefore not evidence for this defect; only a string-shaped
fixture can detect it.

## E7. Reproduction

Feeding the built hook CLI an object-shaped payload in a temp cwd writes BOTH
events, confirming the code path is otherwise healthy:

```
{"event":"question_asked",...,"question":"Q one?"}
{"event":"answer_recorded",...,"answers":["picked A"]}
```

Feeding it a string-shaped `tool_response` writes only `question_asked`. That
delta is the bug.
