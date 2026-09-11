# 051 — wp6 receipt (L5 / #137, recall intent detection)

Branch `codex/fix-recall-intent-regex`, based on `codex/fix-chat-index-freshness`.
Implementation commit `a94113d0`.

## Conclusion

The hook stopped firing on `revert the previous commit` and on `기억해줘`, and started
firing on the three triggers the skill had been advertising without implementing.
Both directions of #137 are closed, and no existing pin was touched.

## The finding that changed the fix

`#137` asks the implementation to match what `skills/recall/SKILL.md:3` advertises.
Taken literally that is wrong, and the audit proved it by inventing ten ordinary
development utterances and running them through the proposed patterns. Seven fired:

```text
리콜 기능 구현해줘              implement the recall feature
recall 훅 테스트 추가해줘        add a test for the recall hook
chat search UX 개선해줘          improve the chat-search UX
memory search 랭킹 고쳐줘        fix memory-search ranking
메모리에서 찾는 코드를 고쳐줘     fix the code that searches memory
the previous time CI failed
I recall seeing this in the Node docs
```

`SKILL.md`'s trigger line is advertising for **skill selection**; this hook detects
**user intent**. They are different matchers. Every advertised trigger is also a
feature name in this repository, so matching the bare noun guarantees a false positive
on exactly the conversations where this hook fires most — people building the recall
feature. The rule this layer adopts is: **match the request form, never the feature
name.** The bare `recall` and `chat|memory search` patterns were dropped outright.

## What changed — `hook.ts` `RECALL_PATTERNS` only

| before | after | why |
|---|---|---|
| `/기억\s*(나|안\s*나|하|해)/` | `/기억\s*(나|안\s*나|하니|하냐)/` | `기억해*` is a request to RECORD; the write gate owns it |
| `/\bprevious(ly)?\s+(session|work|discussed|conversation)?\b/i` | `/\bprevious\s+(session|work|conversation|discussion|chat)\b/i` + `/\bpreviously\s+(we|i|you|the\s+team|discussed|agreed|decided)\b/i` | the optional noun was the false positive; splitting adjective from adverb keeps `hook.test.ts:45` green |
| `/\bprior\s+(work|session|conversation)\b/i` | `+ discussion` | |
| — | `/리콜해/`, `/^\s*리콜\s*$/`, `/이전\s*작업/`, `/메모리에서\s*찾아/` | the three advertised triggers, in request form only |

`time` is deliberately absent from the `previous` noun list: "the previous time CI
failed" is not a recall request.

`메모리에서 찾아` rather than `메모리에서 찾` because `찾는` is adnominal —
"메모리에서 찾는 코드" is a noun phrase about code, not a request to search memory.

## Evidence

RED on the parent `97c52684`, re-proved independently by the main session:

```text
git stash push -- recall/src recall/dist
test.mjs hook.test.ts   -> tests 29, pass 27, fail 2
  ✖ recall intent: issue #137 five-utterance fixture
  ✖ recall intent: advertised triggers fire; write-gate and git nouns do not
git stash pop -> tree restored
```

Exactly two red — the layer's proof — with all 27 pins green beside them, including
`hook.test.ts:45`, `:26`'s `기억나?`, and `round2.test.ts:78` which the PRD had
never mentioned.

GREEN: `npm run build` exit 0; focused recall suite `tests 236, pass 236, fail 0`
(234 before this layer); `round2.test.ts` 9/9.

## A pin is evidence

The PRD's own §5 AFTER block collapsed `previous`/`previously`/`prior` into one
alternation, which flips `hook.test.ts:45` from true to false — and its §6.1 then
rewrote that pin to match. Both were rejected. "previously we capped tool output —
why?" genuinely is a recall request; the test was right and the regex was wrong.
Rewriting a pin to accommodate a pattern is how a false negative ships with a green
suite.

## Known gap, declared

`기억해?` — the question form with the `해` ending — now matches neither this hook
nor the write gate, because `memory-write-gate.ts:79` does not list `해?`. Widening
the recall pattern to cover it would re-create the exact `기억해` collision #137 is
about. It is left alone and recorded here. If it matters, it belongs to the write
gate's pattern in L6's component, not to this one.

## Next

wp7 / L6 / #135 + #136 + #141 on `codex/fix-memory-write-gate`, based on this branch.

