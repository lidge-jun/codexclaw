# 004 — Hook stdin wire capture (audit C-1 remediation)

## Why this document exists

The A-phase audit found the plan's mechanism story unproven. `001_evidence.md` E1
cited a rollout transcript as proof that `tool_response` arrives as a JSON string.
The reviewer showed that in the SAME rollout, `function_call.arguments` is also a
string — and if the hook received a string `tool_input`, `parseQuestions` would
return `[]` and no ledger file would exist. But 222 `question_asked` rows do
exist. The two facts are incompatible, so the rollout cannot be the hook's wire.

Confirmed independently:

```
CALL   line 289  arguments  TYPE=str
OUTPUT line 290  output     TYPE=str
```

## What the rollout actually is

The rollout is the model-facing transcript. `parsePostToolUse` (`parse.ts:145-163`)
reads hook stdin, a different channel, and passes `tool_input`/`tool_response`
through without coercion:

```ts
tool_input: obj.tool_input,
tool_response: obj.tool_response,
```

So whatever the host writes to stdin is exactly what the parsers see.

## The asymmetry (and the limit of what it proves)

Even without a live capture, the ledger constrains the answer to exactly one
possibility. From the observed behavior of the built CLI:

| stdin shape | question_asked | answer_recorded |
|---|---|---|
| object in, object out | yes | yes |
| object in, **string** out | yes | **no** |
| string in, object out | no | no |
| string in, string out | no | no |

Production shows `question_asked: 222`, `answer_recorded: 0`. That pins the INPUT
side: `tool_input` must be a shape `parseQuestions` accepts, or no ledger row
would exist at all. The rollout string for `arguments` is therefore a
rollout-serialization artifact.

**Correction (audit round 2).** An earlier draft of this document called the
above a "deductive proof" that `tool_response` is a JSON string. That was an
overclaim, and the round-2 reviewer falsified it by enumerating the response side
properly. The two-row table above is not exhaustive: **seven** distinct
`tool_response` shapes reproduce the exact `question_asked=1, answer_recorded=0`
signature, because `isRecord` rejects all of them equally:

1. a JSON string
2. a double-encoded JSON string
3. an array of content blocks (`[{type:"input_text",text:"<json>"}]`)
4. an array containing the object
5. `{ output: "<json>" }`
6. `undefined` / `null`
7. plain non-JSON text

The JSON-string hypothesis is one member of that equivalence class, not a unique
solution. What IS proven: **the answer-side payload is something `isRecord`
rejects.** Which member it is remains unobserved.

Consequence for the fix: rather than betting on one member, `asRecord` +
`firstRecord` now decode members 1-5 and degrade safely on 6-7. Coverage is
locked by `test/interview-ledger.test.ts` ("parseAnswers decodes every
recoverable transport shape"). If the live wire turns out to be member 6 or 7,
no parser can recover it and the defect is upstream of this module.

## Live capture (in progress)

A `tee` wrapper was installed on the hook command in both the plugin cache
(`~/.codex/plugins/cache/codexclaw/codexclaw/0.1.1/hooks/`) and the worktree, for
`post-tool-use-capturing-interview-answers.json` and
`post-tool-use-tracking-render-observations.json`, writing raw stdin to
`/tmp/cxc_wire/`.

Two constraints limit this in the current session:

1. Hook definitions are loaded at session start, so a mid-session edit does not
   take effect until the next session.
2. Goal mode hard-denies `request_user_input` (`goal-gate.ts:56-58`), so the
   interview hook cannot fire at all inside this autonomous loop.

**Restore before finishing:** `/tmp/hook_backup_capture.json`,
`/tmp/hook_backup_render.json` (cache) and `/tmp/hook_backup_render_wt.json`
(worktree) hold the originals. The tee MUST be reverted — leaving it installed
would ship a debug wrapper.

## Consequence for the plan

The deductive proof above is sufficient to proceed with the 010 fix, because the
fix is a *widening*: it accepts both shapes. If the wire turns out to be object/
object in some environments, the coercion is a no-op there. The fix cannot be
wrong; it can only be unnecessary in paths that already work.

What the deduction does NOT license is the stronger claim "the host always sends
a string". Record it as: **the answer path receives something `isRecord` rejects,
and a JSON string is the only shape consistent with the evidence.** If the live
capture later shows a third shape (e.g. an array of content blocks, as
`custom_tool_call_output` uses elsewhere), `asRecord` must be extended rather than
replaced.

## OPEN ASSUMPTION

`A-WIRE-01` (restated after audit round 2): the answer-side payload is one of at
least seven shapes `isRecord` rejects. The fix now handles the five recoverable
ones, so which member is live no longer changes the patch — but it does mean
**this commit must not be called proven-effective until a production ledger
actually shows an `answer_recorded` row.** Until then the claim is "the known
recoverable shapes are handled", not "the defect is fixed in production".

`A-PROTO-01`: the `__proto__` question-id hazard was pre-existing on the object
path (`out[qid] = ...` replaced the map prototype rather than creating an own
key). Closed in this cycle via `Object.create(null)` plus an explicit key skip,
with a regression test. No global `Object.prototype` pollution ever occurred.
