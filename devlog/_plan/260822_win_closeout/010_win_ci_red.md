# 010 - wp01: the red windows-latest CI cell

## Symptom

`test (windows-latest, false)` in run 32556937213 fails with exactly one assertion:

```
test at plugins\codexclaw\components\messenger-bridge\test\telegram-adapter.test.ts:427:1
photo-only private message is downloaded and prefixed into the prompt
  AssertionError: 0 !== 1   (actual: 0, expected: 1)
```

Line 474 is `assert.equal(seen.length, 1)`. The agent callback never ran.

## Root cause

The test drives the adapter and then waits with the shared 30ms `settle()` helper:

```ts
await adapter.start();
await settle();          // 30ms, unconditional
adapter.stop();
assert.equal(seen.length, 1);
```

A photo turn is not one tick of work. It is `getFile` -> file download -> temp dir
creation -> agent dispatch, and every step is a real promise chain behind
`withMediaDownloadSlot`. On an idle developer machine 30ms happens to be enough; on a
loaded windows-latest runner it is not, so `adapter.stop()` lands before the agent
callback and `seen` is still empty.

Commit 0954b8d already hit the same race in the sibling text test at :153 and fixed it
by polling, and af8d8dd widened that poll to 15s. The photo test was never converted -
it is the last fixed-sleep media assertion in the file.

## Fix

Promote the ad-hoc poll into a named helper next to `settle()` and use it for both
observable outcomes the photo test cares about:

```ts
async function waitUntil(predicate, what, timeoutMs = 15000) { ... }
```

1. `waitUntil(() => seen.length > 0, ...)` replaces the fixed sleep before `stop()`.
2. The temp-dir cleanup assertions become `waitUntil` too: cleanup runs after the
   agent callback resolves, so it inherits the same race.
3. The inline poll at :153 collapses into the helper.

A timeout is an assertion failure with a named cause, not a silent pass.

## Verification

`node --test --experimental-strip-types plugins/codexclaw/components/messenger-bridge/test/telegram-adapter.test.ts`
-> 28 tests, 28 pass, 0 fail (native Windows).
