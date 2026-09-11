# wp6 / L5 — recall intent regex (#137)

Branch: `codex/fix-recall-intent-regex`
Base: L4 `codex/fix-chat-index-freshness` (stack map: `000_plan.md`)
Issue: https://github.com/lidge-jun/codexclaw/issues/137
Class: C1 (one behavior, `RECALL_PATTERNS` + tests; no new public API)
Checkout measured: `C:/Users/super/.codex/worktrees/b74b/codexclaw` on `codex/memory-recall-roadmap` (dev line `6aae1c97`)

This document is the copy-paste-executable PRD for this layer. Implement from these before/after blocks. Do not reopen the issue for line numbers; every path:line below was read in this tree.

## 1. Thesis

`detectRecallIntent` must stop firing on ordinary development speech and on write-gate remember-phrases, and must fire on the triggers `plugins/codexclaw/skills/recall/SKILL.md:3` advertises. The five utterances quoted in #137 are the regression fixture (acceptance `c-8` in `000_plan.md`).

No new helper is required. The existing function and pattern list stay the API:

```ts
export function detectRecallIntent(prompt: string): boolean
```

defined at `plugins/codexclaw/components/recall/src/hook.ts:112-116`. Edit the `RECALL_PATTERNS` array only. Do not import pabcd-state. Do not add a write-gate exclusion function.

## 2. Current-tree evidence

### 2.1 Pattern list (the bug)

`plugins/codexclaw/components/recall/src/hook.ts:78-116`:

```ts
/** Past-work recall idioms. Korean forms cover 그때/지난번/저번/예전에/기억/뭐였지. */
const RECALL_PATTERNS: readonly RegExp[] = [
  /그때\s*(그|한|했|만든|작업)/,
  /지난\s*번/,
  /지난\s*세션/,
  /저번\s*(에|세션|주|것|거)/,
  /예전에\s*(하|했|만든|작업|쓰)/,
  /전에\s*(했|만든|작업했|얘기했|말했)/,
  /기억\s*(나|안\s*나|하|해)/,                          // L86
  /뭐였지|뭐\s*였더라|어떻게\s*했었지|어디까지\s*했/,
  /\blast\s+(time|session|week)\b/i,
  /\bprevious(ly)?\s+(session|work|discussed|conversation)?\b/i, // L89
  /\bwhat\s+did\s+(we|i|you)\s+(do|discuss|decide|build)\b/i,
  /\bremember\s+(when|what|the|that|how)\b/i,
  /\b(as|we)\s+discussed\s+(earlier|before|previously|last\s+time)\b/i,
  /\bdiscussed\s+previously\b/i,
  /\bearlier\s+(session|conversation|work)\b/i,
  // wp6: idioms the original set missed. Bare 그때 stays out — it reads as a
  // plain time reference ("그때 봤어") far more often than as a recall request.
  /이전에\s*(하|했|만든|작업|얘기|말)/,                 // L97 — 이전에, not 이전 작업
  /그\s*세션/,
  /그때에(?:는|도)?/,
  /\bprior\s+(work|session|conversation)\b/i,          // L100
  /\ba\s+while\s+ago\b/i,
];

const ALREADY_RECALLING =
  /\bcxc\s+(chat|memory)\s+(search|index)\b|\bcodexclaw(\.mjs)?\s+(chat|memory)\s+(search|index)\b|\b(chat|memory)\s+search\s+["']|\$cxc-recall\b/;

export function detectRecallIntent(prompt: string): boolean {
  if (prompt.trim() === "") return false;
  if (ALREADY_RECALLING.test(prompt)) return false;
  return RECALL_PATTERNS.some((re) => re.test(prompt));
}
```

Two independent defects, both live:

1. L89 makes the noun group optional (`?`). After `previous`/`previously` plus whitespace, `\b` matches the next word boundary, so any following word hits. Measured: `revert the previous commit` → `true`, `previous commit` → `true`.
2. L86's `해` / `하` prefixes write-gate remember-verbs. Measured: `기억해줘` → `true`, `기억해` → `true`, `기억해둬` → `true`, `기억해서 둬` → `true`.

Three advertised misses, measured `false` on this tree:

| utterance | why it misses today |
| --- | --- |
| `이전 작업 이어서` | L97 requires `이전에` (with `에`). L85 requires `전에` + `작업했`, not `이전` + `작업`. |
| `리콜해줘` / `리콜` | no `리콜` pattern |
| `메모리에서 찾아줘` | no `메모리에서 찾` pattern |

Skill-advertised English that also miss today (not in the five-utterance table, still in scope because the thesis is advertisement parity): `recall`, `Recall the schema`, `past session`, `past session notes` all return `false`. `chat search` / `memory search` without a `cxc` prefix or quoted query also return `false`; quoted/`cxc` forms are suppressed on purpose by `ALREADY_RECALLING` (`hook.ts:109-114`).

Question-form 기억 already works and must keep working: `기억나?` / `기억 안 나` / `기억하니` / `그 플래그 기억나? 다시 설명해줘` are all `true` via L86.

`prior` is already noun-required at L100 (`work|session|conversation`), so `prior art` is already `false`. The issue still asks to add `discussion` and `time`. Measured: `prior time` → `false`, `prior discussion` → `false`, `prior work on ingest?` → `true`.

### 2.2 Advertised triggers

`plugins/codexclaw/skills/recall/SKILL.md:3` (one line, YAML description):

```
Triggers: recall, 리콜, past session, chat search, memory search, 지난 세션, 이전 작업, 뭐였지, 어떻게 했었지.
```

The same file's body examples at `:23-24` include `그때 그거`, `지난번에 하던 거`, `저번 세션에서`, `예전에 만든`, `last time`, `the thing we did earlier`, `as discussed previously`. Those already have patterns (L80-84, L88, L92-93). Do not edit SKILL.md; it is the advertisement this layer implements.

Coverage vs Triggers list after this layer must be:

| advertised | today | after |
| --- | --- | --- |
| `recall` | miss | fire (`\brecall\b`) |
| `리콜` | miss | fire |
| `past session` | miss | fire |
| `chat search` / `memory search` | miss unless `cxc …` or quoted | fire on the bare words; `ALREADY_RECALLING` still wins for `cxc chat search`, `cxc memory search`, `chat search "…"`, `$cxc-recall` |
| `지난 세션` | fire (L82) | unchanged |
| `이전 작업` | miss | fire |
| `뭐였지` / `어떻게 했었지` | fire (L87) | unchanged |

### 2.3 Write-gate overlap (read-only; do not edit)

`plugins/codexclaw/components/pabcd-state/src/memory-write-gate.ts:73-84`:

```ts
/**
 * Remember idioms, Korean and English. Curated like recall/src/hook.ts:61-77:
 * each pattern needs a memory NOUN or an unambiguous verb phrase, because a bare
 * "기억" ("기억 안 나") is a recall question, not a write request.
 */
export const MEMORY_WRITE_PATTERNS: readonly RegExp[] = [
  /기억\s*(해둬|해 둬|해줘|해라|하자|해$|해[.!,]|해서\s*(둬|놔))/,  // L79
  /(기억|메모)\s*(에|해서)?\s*(남겨|남겨둬|적어|적어둬|저장|기록)/,
  /메모리\s*(에|에다)?\s*(남겨|기록|추가|저장|적어|넣어|써)/,         // L81 write, not 에서 찾
  ...
  /\bremember\s+(this|that|it|these)\b/i,                          // L84
```

L79 is still at line 79 in this tree. The comment's `hook.ts:61-77` is stale (patterns now live at `hook.ts:79-102`); leave that comment to L6. `remember this` is already `false` on the recall side (`hook.ts:91` requires `when|what|the|that|how`) — keep it that way. `메모리에 남겨` (write) must stay distinct from `메모리에서 찾아줘` (recall).

### 2.4 Existing tests that this layer must keep green

`plugins/codexclaw/components/recall/test/hook.test.ts`:

- `:26-36` `recall intent: korean idioms trigger` — includes `그 플래그 기억나? 다시 설명해줘`. Must still pass.
- `:39-49` `recall intent: english idioms trigger` — `:45` is `"previously we capped tool output — why?"`. That string is `true` only because L89's noun is optional. After this layer it becomes `false` unless the fixture is rewritten. Rewrite it (change 6.1 below).
- `:51-61` `recall intent: neutral prompts and self-recalling prompts stay silent` — `run cxc chat search "trigram" --days 0 and summarize` stays silent via `ALREADY_RECALLING`. Keep.
- `:431-442` `wp6 trigger idioms widen without catching ordinary instructions` — this is the 260910 widening (`이전에 했던`, `그 세션`, `prior work`, `a while ago`). Do not rename, delete, or weaken it. The name collision with this work-phase is historical.

## 3. Contradictions vs the issue body

Issue #137 quotes 0.2.24 paths without the `plugins/codexclaw/` prefix and pastes the regexes with backslashes eaten by markdown. Verified against this tree:

| issue claim | this tree |
| --- | --- |
| `components/recall/src/hook.ts` L86 / L89 | same line numbers, full path `plugins/codexclaw/components/recall/src/hook.ts` |
| `/기억s*(나\|안s*나\|하\|해)/` | actual L86 is `/기억\s*(나\|안\s*나\|하\|해)/` (`\s`, not `s`) |
| `/\bprevious(ly)?s+(session\|work\|discussed\|conversation)?\b/i` | actual L89 has `\s+` and the optional noun group, as described |
| `skills/recall/SKILL.md:3` | `plugins/codexclaw/skills/recall/SKILL.md:3`; trigger string matches |
| write-gate L79 | still L79 in `plugins/codexclaw/components/pabcd-state/src/memory-write-gate.ts` |
| `prior` needs a required noun | already required at L100; missing `discussion` and `time` only |
| five-utterance Y/Y/N/N/N table | re-measured on this tree with `detectRecallIntent`: identical |

The five utterances, measured on this checkout (Y = fires today):

```
Y | revert the previous commit      <- false positive
Y | 기억해줘                          <- false positive (write-gate)
N | 이전 작업 이어서                   <- miss
N | 리콜해줘                          <- miss
N | 메모리에서 찾아줘                   <- miss
```

## 4. Change list

| op | path | what |
| --- | --- | --- |
| MODIFY | `plugins/codexclaw/components/recall/src/hook.ts` | tighten L86 and L89, expand prior nouns, add advertised idioms; update the L78 comment |
| MODIFY | `plugins/codexclaw/components/recall/dist/hook.js` | rebuild only (`npm run build`). Tracked file. Do not hand-edit dist. |
| MODIFY | `plugins/codexclaw/components/recall/test/hook.test.ts` | rewrite the L45 fixture; add the #137 fixture test and the advertisement/negative test |
| (read, do not write) | `plugins/codexclaw/skills/recall/SKILL.md` | advertisement source of truth |
| (read, do not write) | `plugins/codexclaw/components/pabcd-state/src/memory-write-gate.ts` | write-gate overlap |

Do not add a new production file. Do not export a new function. Do not create a shared regex helper across packages.

## 5. Production before / after

Replace the whole `RECALL_PATTERNS` constant and its doc-comment at `hook.ts:78-102`. Leave `ALREADY_RECALLING` and `detectRecallIntent` untouched. Leave the 260910 widening entries (`이전에`, `그 세션`, `그때에`, `a while ago`) in place. Relabel that comment so it is not confused with this wp6:

### AFTER (`plugins/codexclaw/components/recall/src/hook.ts`, replace L78-102)

```ts
/** Past-work recall idioms. Korean forms cover 그때/지난번/저번/예전에/기억나/리콜/이전 작업/뭐였지.
 *  `기억해*` is the write-gate's job (pabcd-state memory-write-gate.ts); recall keeps question forms only.
 *  `previous`/`prior` require a memory noun — never a git/file noun. */
const RECALL_PATTERNS: readonly RegExp[] = [
  /그때\s*(그|한|했|만든|작업)/,
  /지난\s*번/,
  /지난\s*세션/,
  /저번\s*(에|세션|주|것|거)/,
  /예전에\s*(하|했|만든|작업|쓰)/,
  /전에\s*(했|만든|작업했|얘기했|말했)/,
  /기억\s*(나|안\s*나|하니|하냐)/,
  /뭐였지|뭐\s*였더라|어떻게\s*했었지|어디까지\s*했/,
  /\blast\s+(time|session|week)\b/i,
  /\b(?:previous(?:ly)?|prior)\s+(session|work|conversation|discussion|time|discussed)\b/i,
  /\bwhat\s+did\s+(we|i|you)\s+(do|discuss|decide|build)\b/i,
  /\bremember\s+(when|what|the|that|how)\b/i,
  /\b(as|we)\s+discussed\s+(earlier|before|previously|last\s+time)\b/i,
  /\bdiscussed\s+previously\b/i,
  /\bearlier\s+(session|conversation|work)\b/i,
  // 260910 widening. Bare 그때 stays out — it reads as a plain time reference
  // ("그때 봤어") far more often than as a recall request.
  /이전에\s*(하|했|만든|작업|얘기|말)/,
  /그\s*세션/,
  /그때에(?:는|도)?/,
  /\ba\s+while\s+ago\b/i,
  /리콜/,
  /이전\s*작업/,
  /메모리에서\s*찾/,
  /\brecall\b/i,
  /\bpast\s+session\b/i,
  /\b(?:chat|memory)\s+search\b/i,
];
```

Apply these substitutions mechanically if you prefer a minimal diff over a block replace:

| line today | op | after |
| --- | --- | --- |
| L78 comment | MODIFY | the three-line comment above |
| L86 `/기억\s*(나\|안\s*나\|하\|해)/` | MODIFY | `/기억\s*(나\|안\s*나\|하니\|하냐)/` |
| L89 `/\bprevious(ly)?\s+(session\|work\|discussed\|conversation)?\b/i` | MODIFY | the combined previous/prior pattern above (noun required) |
| L95-96 `// wp6:` comment | MODIFY | `// 260910 widening.` (same body). Do not delete the four surviving widening patterns. |
| L100 `/\bprior\s+(work\|session\|conversation)\b/i,` | DELETE | folded into the previous/prior line |
| after L101 | NEW | `리콜`, `이전\s*작업`, `메모리에서\s*찾`, `\brecall\b`, `\bpast\s+session\b`, `\b(?:chat\|memory)\s+search\b` |

Pattern rules the implementer must not "improve":

- **기억:** drop `하` and `해`. `하` is prefix-greedy (`기억해서 둬` matches today). Keep `나` / `안\s*나` / `하니`. `하냐` is the same interrogative family as the issue's `기억하니`; do not add `하지` (`기억하지 마` is write-adjacent).
- **previous/prior:** noun group is required. Issue minimum is `(session|work|conversation|discussion|time)`. Keep `discussed` in that group so `previously discussed` does not regress; it is a recall verb, not a git noun, and does not make `previous commit` match. Do not add `commit`, `version`, `file`, `pr`, `branch`, `art`.
- **이전 작업:** `/이전\s*작업/` is not a substitute for L97 `이전에`. `이전에 했던` has `에` between `이전` and the verb, so both patterns stay.
- **메모리에서 찾:** do not broaden to `메모리에`. That is write-gate L81.
- **chat/memory search:** adding the bare words is required for SKILL.md:3. `ALREADY_RECALLING` is evaluated first, so `run cxc chat search "trigram" --days 0 and summarize` (`hook.test.ts:55`) stays silent. Do not weaken `ALREADY_RECALLING`.
- **리콜 / recall:** no extra helper, no stemming. `/리콜/` matches `리콜해줘`. `\brecall\b` is case-insensitive.

`detectRecallIntent` stays exactly:

```ts
export function detectRecallIntent(prompt: string): boolean {
  if (prompt.trim() === "") return false;
  if (ALREADY_RECALLING.test(prompt)) return false;
  return RECALL_PATTERNS.some((re) => re.test(prompt));
}
```

Mixed prompts such as `기억해줘 그리고 지난 세션` still fire via `지난 세션`. Pure write requests must not.

Rebuild dist; do not paste regexes into `dist/hook.js` by hand:

```text
npm run build
```

`plugins/codexclaw/components/recall/dist/hook.js` is tracked (`git ls-files` reports it). Stage the rebuild. If `git add` skips it because root `.gitignore:2` ignores `dist/`, use `git add -f plugins/codexclaw/components/recall/dist/hook.js` (roadmap constraint in `000_plan.md`).

## 6. Tests

File (MODIFY, do not create a new test file): `plugins/codexclaw/components/recall/test/hook.test.ts`

Convention: `import test from "node:test"` + `assert` from `node:assert/strict`, tests named `recall intent: …`, run by `node plugins/codexclaw/scripts/test.mjs` which spawns `node --test`.

### 6.1 MODIFY existing fixture (required, otherwise current suite goes red)

Path: `plugins/codexclaw/components/recall/test/hook.test.ts:45`
Test name: `recall intent: english idioms trigger` (do not rename)

BEFORE:

```ts
    "previously we capped tool output — why?",
```

AFTER:

```ts
    "the previous session we capped tool output — why?",
```

Input: `the previous session we capped tool output — why?`
Assertion: `assert.ok(detectRecallIntent(p))`
Why today's code is relevant: today's L89 already returns true for the old string and the new string. After the noun becomes required, the old string is a false positive of the same class as `previous commit` and would fail this test. The new string keeps an English previous-session positive in this suite.

### 6.2 NEW test — the #137 five-utterance fixture (c-8)

Append after the existing `recall intent: english idioms trigger` test (`hook.test.ts:49`), keeping the 260910 `wp6 trigger idioms…` test at `:431` untouched.

Test name: `recall intent: issue #137 five-utterance fixture`

```ts
test("recall intent: issue #137 five-utterance fixture", () => {
  assert.equal(detectRecallIntent("revert the previous commit"), false);
  assert.equal(detectRecallIntent("기억해줘"), false);
  assert.equal(detectRecallIntent("이전 작업 이어서"), true);
  assert.equal(detectRecallIntent("리콜해줘"), true);
  assert.equal(detectRecallIntent("메모리에서 찾아줘"), true);

  assert.equal(
    handleUserPromptSubmit({ hook_event_name: "UserPromptSubmit", prompt: "기억해줘" }),
    "",
  );
  assert.match(
    handleUserPromptSubmit({ hook_event_name: "UserPromptSubmit", prompt: "리콜해줘" }),
    /cxc chat search/,
  );
});
```

| input | expected | why it fails on today's code |
| --- | --- | --- |
| `revert the previous commit` | `false` | L89 optional noun; measured `true` |
| `기억해줘` | `false` | L86 `해` overlaps write-gate L79; measured `true` |
| `이전 작업 이어서` | `true` | no `이전 작업` pattern; measured `false` |
| `리콜해줘` | `true` | no `리콜` pattern; measured `false` |
| `메모리에서 찾아줘` | `true` | no `메모리에서 찾` pattern; measured `false` |
| handler `기억해줘` | `""` | `handleUserPromptSubmit` at `:196` injects whenever intent is true |
| handler `리콜해줘` | stdout matches `/cxc chat search/` | intent is false, so the handler returns `""` |

The five strings are copied verbatim from the issue body, including the lack of a trailing particle on `기억해줘` / `리콜해줘`.

### 6.3 NEW test — advertisement positives and remaining negatives

Test name: `recall intent: advertised triggers fire; write-gate and git nouns do not`

```ts
test("recall intent: advertised triggers fire; write-gate and git nouns do not", () => {
  for (const p of [
    "recall",
    "Recall the schema",
    "리콜",
    "past session",
    "이전작업",
    "기억나?",
    "기억 안 나",
    "기억하니",
    "기억하냐",
    "previous session",
    "previous work",
    "previous conversation",
    "previous discussion",
    "the previous time",
    "previously discussed the cap",
    "prior time",
    "prior discussion",
    "memory search foo",
  ]) {
    assert.ok(detectRecallIntent(p), "should trigger: " + p);
  }
  for (const p of [
    "previous commit",
    "bump the previous version",
    "prior art",
    "기억해",
    "기억해둬",
    "기억해서 둬",
    "remember this",
    "메모리에 남겨줘",
  ]) {
    assert.equal(detectRecallIntent(p), false, "should NOT trigger: " + p);
  }
  assert.equal(
    detectRecallIntent('run cxc chat search "trigram" --days 0 and summarize'),
    false,
  );
});
```

Why this fails on today's code (measured):

- positives `recall`, `리콜`, `past session`, `이전작업`, `prior time`, `prior discussion`, `memory search foo` are `false`
- negatives `previous commit`, `기억해`, `기억해둬`, `기억해서 둬` are `true`
- `기억나?` / `기억 안 나` / `기억하니` / `previous session` already pass; they pin the keep-set so a too-tight 기억 pattern cannot ship

`이전작업` (no space) must pass because the new pattern uses `\s*`. `메모리에 남겨줘` must stay false so the write-gate Korean form does not start a recall nudge.

Do not add tests under `pabcd-state/`. Do not duplicate the 260910 widening cases.

## 7. Verification

From the repository root. Run as three separate commands (PowerShell 5.1 has no `&&`):

```text
npm run build
node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/recall/test/hook.test.ts
npm test
```

Layer is proven only when all of these hold:

1. `npm run build` exits 0 and `plugins/codexclaw/components/recall/dist/hook.js` contains `이전\s*작업`, `리콜`, `메모리에서\s*찾`, and the required-noun previous/prior source (not the optional `?` group).
2. Focused test file exits 0 and the output names `recall intent: issue #137 five-utterance fixture` and `recall intent: advertised triggers fire; write-gate and git nouns do not` as pass.
3. `npm test` exits 0. The existing names `recall intent: korean idioms trigger`, `recall intent: english idioms trigger`, `recall intent: neutral prompts and self-recalling prompts stay silent`, and `wp6 trigger idioms widen without catching ordinary instructions` still pass.
4. Red-green: on the parent tip (this layer unpatched) the new fixture test fails on the first two asserts (`previous commit` / `기억해줘` still true) and on the three advertised misses. At this layer's tip the same test passes. A green build whose new test never ran red is not proven (`000_plan.md` verification contract).

This layer has no Windows-only reproduction. No `cxc receipt` is produced by the implementer; wp8 owns receipts.

## 8. Must not touch

Production / tests / config outside the three MODIFY paths in §4. In particular:

- `plugins/codexclaw/skills/recall/SKILL.md` — advertisement, not a write.
- `plugins/codexclaw/components/pabcd-state/**` including `src/memory-write-gate.ts` and its tests — L6 / wp7 (#135, #136, #141).
- Peer-owned files: `provider-bridge/`, `session-binding.ts`, `config-guard/`, `source-identity.ts`, `session-source.ts`.
- Lower-layer recall files this stack already owns: `src/cwd-context.ts`, `src/index-search.ts`, `src/memory-search.ts`, `src/cli.ts`, ingest/index-db, `test/chat-fallback.test.ts`, `test/cwd-scope.test.ts`.
- `extractRecallTargets` / `TARGET_STOP` (`hook.ts:130-157`) unless a new test proves `리콜` leaks as a suggested term (it will not: it is not VERSION/FILE/ERROR/CAMEL/QUOTED). Do not expand the stop-list while you are here.
- SessionStart / PostCompact / `noRefresh` banner path (`hook.ts:501-505`) — that region is L4 / wp5 (#144).

## 9. Layer interactions

- **Below (L4 / wp5 / #144):** also writes `hook.ts`, but at the SessionStart search-chat call (`hook.ts:501` `noRefresh: true`) and freshness banner. Different region from `RECALL_PATTERNS` (`hook.ts:78-102`). Rebase onto L4. If L4 shifts later lines, re-anchor by symbol (`RECALL_PATTERNS`, `detectRecallIntent`), not by the L4 line numbers. Do not rewrite L4's banner.
- **Above (L6 / wp7 / #135 #136 #141):** write-gate in pabcd-state. After this layer, `기억해줘` no longer nudges recall; L6 still has to make the grant/Windows destination parser correct. Do not fix write-gate detection here. Do not import `detectMemoryWriteRequest`.
- **L1-L3:** no file overlap with this layer's writes. No API this layer consumes.
- Historical `// wp6:` comment and test name inside `hook.ts` / `hook.test.ts` are the 260910 widening, not this issue. Keep their behavior.

## 10. Acceptance

Done when:

1. The five #137 utterances have the corrected verdicts pinned by `recall intent: issue #137 five-utterance fixture`.
2. SKILL.md:3 trigger words fire (or, for command-shaped chat/memory search, remain suppressed by `ALREADY_RECALLING`).
3. Write-gate phrases `기억해*` / `remember this` / `메모리에 남겨줘` do not fire recall.
4. Ordinary git speech `revert the previous commit` / `previous commit` / `prior art` do not fire.
5. Existing 기억-question and 260910 widening tests still pass.
6. `npm run build` and `npm test` are green at this layer's tip, with dist rebuilt.

Not done if the implementer adds a cross-package helper, edits the write-gate, or leaves `dist/hook.js` stale.

## Amendment A — wp6 P revalidation (2026-09-11)

Re-verified at `97c52684` by an independent `xai/grok-4.6` explorer.
**This amendment governs.**

### A.1 Stale citations

| PRD says | Now |
|---|---|
| `hook.test.ts:431-442` wp6 test | **`:459-471`** (L4 grew the file; `:26-61` and `:45` did not move) |
| `hook.ts:501-505` `noRefresh: true` | `searchChat(` is still `:501`; L4's comments are `:505-507`; **`noRefresh: true` is `:508`** |
| header checkout `6aae1c97` | `codex/fix-recall-intent-regex` @ `97c52684` |

§2.1 and §2.3 BEFORE blocks are not byte-for-byte: the source carries no `// L86`-style
tags and has the `ALREADY_RECALLING` doc comment at `:104-108`. The regexes themselves
match. **Do not apply either block as a range replace.**

### A.2 Today's verdicts, confirmed against the current patterns

| utterance | today | why |
|---|---|---|
| `revert the previous commit` | **true** — false positive | `:89` noun group is optional |
| `기억해줘` | **true** — false positive | `:86` `해` overlaps the write gate at `memory-write-gate.ts:79` |
| `이전 작업 이어서` | **false** — false negative | `:97` requires `이전에` |
| `리콜해줘` | **false** — false negative | no `리콜` pattern |
| `메모리에서 찾아줘` | **false** — false negative | no `메모리에서 찾` pattern |

`SKILL.md:3` advertises: `recall, 리콜, past session, chat search, memory search,
지난 세션, 이전 작업, 뭐였지, 어떻게 했었지`. Three of those never matched.

### A.3 The conflict the issue did not see, and how to resolve it

The issue says make `previous`/`prior` require a noun. **An existing pin dies if you do
that literally.** `hook.test.ts:45` asserts that

```text
previously we capped tool output — why?
```

is a recall hit, and it passes today only because the noun group is optional. That
utterance genuinely IS a recall request — it refers to past work — so the pin is right
and the issue's wording is too blunt. `round2.test.ts:78`
(`gap4: hardened hook patterns and suppression`) is a second pin on this behaviour and
the PRD does not mention it at all.

Resolution — split the adjective from the adverb, because English does:

```text
previous   (adjective)  -> require a session noun:
                           /\bprevious\s+(session|work|conversation|discussion|time|chat)\b/i
                           kills "revert the previous commit"
previously (adverb)     -> require a past-work subject or verb:
                           /\bpreviously\s+(we|i|you|the\s+team|discussed|agreed|decided)\b/i
                           keeps "previously we capped tool output"
prior      (adjective)  -> require a session noun, as the PRD already specifies
```

Both existing pins stay green and the reported false positive dies. **Neither pin may
be edited, weakened or deleted to make this layer pass** — if a proposed pattern cannot
satisfy both, the pattern is wrong, not the pin.

### A.4 Do not weaken the other pins

`hook.test.ts:26` (Korean idioms including `기억나?`), `:39` (English idioms), `:51`
and `:55` (neutral prompts and `cxc chat search "..."` silence), `:63` (handler
envelope for `지난번 세션 이어서`), `:459` (the 260910 widening), `:473` (suggested
terms), and `round2.test.ts:78`.

`기억나?` at `:26` matters for the `기억` rewrite: the question form must keep firing
while `기억해줘` stops. That is the whole point — recall is a question, recording is a
request.

### A.5 Latency

`UserPromptSubmit` must stay "well under its 5s hook budget" and must not open an
index (`hook.ts:120-122`, `:169-170`). `detectRecallIntent` has no separate numeric
budget, but it runs on **every** user prompt, so the pattern list stays a flat array of
cheap regexes — no lookbehind, no catastrophic backtracking, no new I/O.

