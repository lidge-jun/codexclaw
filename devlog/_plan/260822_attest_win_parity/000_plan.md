# 000 - attest instruction parity on Windows

## The defect

codexclaw tells Windows agents to run a command that cannot work.

```
cxc orchestrate A --session <id> --attest '{"from":"P","to":"A","did":"wrote the plan"}'
-> orchestrate A: ...; attest JSON is not valid JSON
```

Measured cause (filed upstream as fuck-powershell#6): PowerShell strips the quotes
from a single-quoted argument, so the CLI receives `{from:P,to:A,did:wrote the plan}`.
Escaping the quotes appears to fix it and then splits the argument at the first
space inside a value. There is no inline form that survives a `did` field, which
is mandatory on every gated edge.

## What is already correct

- `renderOrchestrateHelp` (orchestrate-cli.ts:152) branches on platform.
- `stopNextCommand` (hook.ts:1019) rewrites the Stop-reason command for win32.
- `attest.ts:173` already leads with `--attest-file <path> (required on Windows)`
  and is the wording to mirror elsewhere.

An earlier draft of this doc claimed "the Stop hook is honest" as a blanket
statement. An audit disproved it: `buildGoalIdleBlock` is also a Stop surface and
is NOT platform-aware. `stopNextCommand` being fixed says nothing about its
neighbours.

## What is wrong

| surface | line | what it says |
|---|---|---|
| `LOOP_ARM_DIRECTIVE` | hook.ts:469 | "Advance EVERY forward edge yourself with `cxc orchestrate <phase> --attest <json>`" |
| `pabcd/SKILL.md` | 49, 99 | grammar and instruction both spell only `--attest <json>` |
| `loop/SKILL.md` | 28 | "carrying the phase's real artifact" via `--attest <json>` |
| `interview/SKILL.md` | 64, 142, 178 | three inline `--attest '{...}'` override examples |
| `scan-cli.ts` | 134 | emits a runnable inline command in a user-facing error |
| `buildGoalIdleBlock` | hook.ts:1132 | Stop block hands the agent an inline `--attest` P command |
| `plan-gate.ts` | 41 | P->A rejection tells you to re-attest with an inline command |

`plan-gate.ts:41` is the most-traveled of them all: it fires on the P->A gate,
reached from both `hook.ts:70` and `orchestrate-cli.ts:393`. A second sweep
missed it because the string is split across a `+` concatenation with an escaped
quote, so `rg -F -e "--attest '"` cannot see it. Found by the round-2 auditor.

Confirmed clean and needing no change: `map-affordance.ts:182` and
`idle-edit.ts:55` mention `--attest` with no JSON literal;
`orchestrate-grammar.ts` parses chat grammar, not a shell surface.

The last two were MISSED by the first draft of this plan and found by a
completeness sweep (`rg -l -F -e "--attest '"`). `scan-cli.ts:134` is the more
serious of the two: it is not documentation, it is a runtime error message
handing the user a command to copy, and on Windows that command fails.

`attest.ts:173` already says "(required on Windows)" next to `--attest-file`, so
it is correct and is the wording to mirror elsewhere.

`LOOP_ARM_DIRECTIVE` is the worst of them because it is **injected at prompt
time** by the UserPromptSubmit hook. Every agent starting loop work on Windows is
handed a command that will fail, before it has run anything.

This is not hypothetical: this session hit it, concluded the FSM was broken,
and spent a cycle proving otherwise.

## MODIFY map

### 1. `components/pabcd-state/src/hook.ts` - LOOP_ARM_DIRECTIVE (:458)

The constant is a plain `string`. Make it a function of platform, mirroring
`stopNextCommand`, which keeps its table private and exports ONLY the function.

BEFORE (:458)
```ts
export const LOOP_ARM_DIRECTIVE = [ ... ].join("\n");
```

AFTER
```ts
export function loopArmDirective(platform: NodeJS.Platform = process.platform): string
```

**No compatibility binding.** An earlier draft proposed keeping
`export const LOOP_ARM_DIRECTIVE = loopArmDirective("linux")`. The audit
rejected it and was right: there are zero out-of-tree importers, so it buys no
compatibility, and it would permanently freeze a caller to POSIX text on Windows
- reintroducing the exact bug being fixed. The single call site at :603 moves to
the function.

Step 4 gains a win32 branch naming the two-step recipe.

### 2. `skills/pabcd/SKILL.md`

Line 49 grammar gains the alternative; line 99 gains a Windows note. The skill is
read by the agent, so the note must be short and imperative, not a discussion.

### 3. `skills/loop/SKILL.md`

Line 28 gains the same alternative.

### 4. `skills/interview/SKILL.md`

Three override examples at 64, 142 and 178. These teach the `override` escape
hatch, which is exactly the moment a stuck agent reaches for them - so a form
that fails on Windows is worst here.

### 5. `components/pabcd-state/src/scan-cli.ts` - line 134

A runtime error string. Make it platform-aware the same way `attest.ts:173`
already is, or point at `--attest-file` unconditionally since that form works
everywhere.

### 6. `components/pabcd-state/src/hook.ts` - buildGoalIdleBlock (:1132)

The line offering `cxc orchestrate P --session <id> --attest '{...}'` degrades
exactly like the directive - the probe shows it arriving as
`{from:IDLE,to:P,evidence:<diff-level plan...>}`. It needs the same treatment,
which means `buildGoalIdleBlock` takes a `platform` parameter.

### 7. `npm run build`

`dist/` is committed and `test/dist-freshness.test.mjs:28` fails on src/dist
drift. Editing only `src/` ships nothing and reddens CI. The installed payload
at `~/.codex/plugins/cache/.../dist/hook.js:469` still carries the stale line,
which is what produced the bad directive in this very session.

### 8. `components/pabcd-state/src/plan-gate.ts` - line 41

Same treatment as `scan-cli.ts`. Point at `--attest-file` unconditionally, since
that form is correct on every platform.

## TESTS

Platform is INJECTED, so Linux CI drives the win32 branch. That is this repo's
stated convention (`atomic-write.test.ts:4`), and the reason a
"assert whatever is right for the host" test would be worthless: the CI matrix is
mostly Linux, so the win32 path would never execute.

1. `loopArmDirective("win32")` contains `--attest-file`, does NOT contain
   `--attest <json>`, AND carries the two-step `Set-Content` recipe - the payload
   an agent actually needs. A negative assertion alone would pass on text that is
   merely different rather than correct; `orchestrate-cli.test.ts:161` pairs its
   negative with a positive for the same reason.
2. `loopArmDirective("linux")` equals a **literal snapshot** of today's text,
   pinned in the test file.

   An earlier draft proposed asserting `loopArmDirective("linux") === LOOP_ARM_DIRECTIVE`
   while DEFINING the constant as `loopArmDirective("linux")`. That compares a
   value to itself and passes no matter how badly the POSIX text is mangled - it
   is a tautology, and it was the one guarantee the plan was selling. Caught by
   audit. The snapshot must be literal text in the test.
3. `buildGoalIdleBlock` with `platform: "win32"` does not emit an inline
   `--attest '` and DOES emit the write-then-attest pair; with `"linux"` it still
   emits the inline form.
4. `handleUserPromptSubmit` gains platform injection so the directive it renders
   is testable end to end rather than only at the helper.
5. `hook.test.ts:296` (`/--attest <json>/`) is retargeted rather than deleted -
   it becomes the POSIX-branch assertion.
6. `hook-continuation.test.ts:441` asserts
   `/cxc orchestrate P --session gi1 --attest/` and breaks on Windows once item 6
   lands. Retarget it the same way. Missed by the first TESTS draft, which named
   only `hook.test.ts:296`.
7. `plan-gate.ts`'s rejection string is asserted somewhere - locate and retarget
   before editing, rather than discovering it in CI.

Signature note: `buildGoalIdleBlock(cwd, state, sessionId)` already takes three
positional arguments at its call site, so `platform` must be a fourth OPTIONAL
parameter or the existing call silently shifts.

Note `stopNextCommand` currently has NO test. The pattern being copied is itself
unverified, so this unit adds one for it too.

## Verified precondition

The recipe the fix points at was executed end to end before writing this plan:
`Set-Content -Encoding utf8` writes a UTF-8 BOM (`head=efbbbf7b2266726f`), and
the CLI reads it correctly - `orchestrate-cli.test.ts` already has a BOM
tolerance case. So the recommendation is safe to make.

## Audit record

Round 1 returned VERDICT: fail with a P0 and three P1s. All were accepted:

- P0 the POSIX-parity test was a tautology -> now a literal snapshot.
- P1 three surfaces missed (`buildGoalIdleBlock`, `scan-cli.ts`,
  `interview/SKILL.md`) -> added to the MODIFY map.
- P1 no dist rebuild step -> added as item 7.
- P1 the compat binding was the wrong shape -> dropped entirely.
- P2 platform should be injected so Linux CI drives the win32 branch -> adopted.
- P2 stale line reference `:455` -> corrected to `:458`.

The auditor also reproduced both failure modes independently with the argv probe,
confirming quote-stripping (`argc=2`) and space-splitting (`argc=4`).

Round 2 returned VERDICT: near-pass (blockers=4 folded):

- P1 `plan-gate.ts:41`, a fourth runtime emitter invisible to a `-F` sweep
  because the string is concatenated -> added as MODIFY item 8.
- P1 `hook-continuation.test.ts:441` would break unannounced -> added to TESTS.
- P2 win32 assertions were negative-only -> now assert the recipe is present.
- P2 `docs-site` ships five inline examples with no Windows note
  (`quickstart.md:22,30,38,46,56`, `guides/pabcd.md:36,42`, `index.mdx:175`,
  `reference/commands.md:62`) -> deferred to a follow-up unit; they are published
  docs rather than a runtime failure, and folding a docs-site pass into this unit
  would widen it past the code fix.

The auditor also confirmed dropping the const is safe: three code references, all
inside `hook.ts`, no barrel re-export, and `hook.test.ts` asserts on rendered
output rather than importing it.
