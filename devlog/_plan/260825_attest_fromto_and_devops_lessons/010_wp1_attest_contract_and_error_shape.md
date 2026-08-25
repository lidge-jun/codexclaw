# 010 — wp1: make the attest contract say what the gate enforces

Phase: wp1. Depends on: wp0. Blocks: nothing (wp2/wp3 are independent text work).

## Problem

`skills/pabcd/SKILL.md:91-98` is the table agents copy. It omits `from`, `to`,
`planUnit`, `workPhaseId`, and `testReceiptPath`. The runtime requires all of
them on the matching edges. See 001 §A/§B for the full divergence and the
three-round-trip cascade it produces.

Two halves, and both are needed:

- **Documentation** stops producing the malformed attest in the first place.
- **The error message** rescues the agent that produced one anyway — from a stale
  skill copy, another repo's docs, or its own memory.

Fixing only the docs leaves `attest JSON missing valid from/to` teaching nothing
for the next year. Fixing only the message means every loop pays one round trip
forever.

## MODIFY map

### 1. `plugins/codexclaw/skills/pabcd/SKILL.md` — the table (:91-98)

Replace the "Required attest keys" table so every gated row carries the full key
set, and add a copy-paste object per edge underneath. The entry rows must keep
saying "none" for the ATTEST, but must stop implying an attest passed on an entry
edge is free-form: `coerceAttest` runs on IDLE→P too, so
`--attest '{"did":"x"}'` fails there as well even though the edge is ungated.

New shape:

| Edge | Required attest keys |
|---|---|
| IDLE→P, I→P | none — pass no `--attest` at all. If you DO pass one it still parses, so it still needs `from`/`to`. |
| P→A | `from`, `to`, `did`, `planUnit`; `workPhaseId` when a goalplan is bound |
| A→B | `from`, `to`, `did`, `auditOutput`, `auditVerdict`; `auditResidual` when near-pass; `workPhaseId` when bound |
| B→C | `from`, `to`, `did`; `workPhaseId` when bound |
| C→D | `from`, `to`, `did`, `checkOutput`, `exitCode` (must be 0); `testReceiptPath` when bound; `workPhaseId` when bound |

Plus one fenced block with four ready objects — the exact strings an agent should
be able to paste and edit.

**Amended after audit (002 blocker 4).** An earlier draft said these must match
`orchestrate-cli.ts:166-168` "which is already correct". It is NOT: there is no
B→C example there at all, and its C→D example omits `testReceiptPath`. CLI help
is a REPAIR TARGET in this phase, not the reference. Fix both surfaces, then they
agree because both are right — not because one copied the other's gap.

A one-line rule id so the requirement is citable:
**ATTEST-SHAPE-01 (STRICT):** every `--attest` object carries `from` and `to`
naming the edge being advanced, even on ungated edges, because the parser
coerces before the gate runs.

### 2. `skills/interview/SKILL.md:64` and `:144`

`{"override":true,...}` and `{"override":true}` are valid JSON, so they do NOT
fail as "not valid JSON" — they fail as missing from/to, which is the confusing
case. Replace both with the already-correct object from `:180-181`:
`{"from":"I","to":"P","did":"<reason>","override":true}`.

### 3. `skills/loop/SKILL.md`

Its attest references (:27-32, :101) carry no example object. Add a pointer to
the pabcd table rather than a second copy — `cxc-pabcd` owns the contract
(existing precedent: loop already defers phase semantics to pabcd).

### 4. `structure/20_pabcd_dispatch_doctrine.md:72`

`--attest '{"from","to","did"}'` is not valid JSON. Anyone pattern-matching it
writes a JSON array of strings or something worse. Make it a real object.

### 5. `components/pabcd-state/src/orchestrate-cli.ts` — the null-coerce paths

`:227` (inline) emits `attest JSON missing valid from/to`; `:257` (file) emits
`attest file <path> is missing valid from/to`. Two different strings, both with
no example, no phase, no next command.

**Amended after audit (002 blocker 1).** An earlier draft claimed the parser
cannot know the edge and proposed `"<current>"`/`"<target>"` placeholders. That
was wrong and the auditor disproved it: `const verb = VERBS[verbTok]` resolves at
`orchestrate-cli.ts:200`, twenty-seven lines BEFORE the attest loop, and
`runOrchestrateCli:345-348` already calls `readState` + `renderPhaseContext` on
this exact error path. So the message is built where the facts are, and it is
concrete:

- `to` is ALWAYS the verb. No placeholder.
- `from` is the current phase whenever the session resolves — which is mandatory
  for every mutating verb anyway. A placeholder appears only when it genuinely
  cannot be known.
- Forward-declare the extra keys FOR THAT VERB, not a menu: `A` adds
  `planUnit`; `B` adds `auditOutput` + `auditVerdict`; `D` adds `checkOutput`
  + `exitCode`; a bound goalplan adds `workPhaseId`, and a bound `D` also adds
  `testReceiptPath`.
- Name `cxc orchestrate status --session <id>` for the case where `from` is
  unavailable.

A generic menu of every possible key is the same failure in longer form: the
agent still has to guess which half applies to its edge.

`orchestrate-grammar.ts:88` (chat surface) gets the same text. Note the chat
path currently discards `attestError` entirely (`hook.ts:773`) and the human
free-pass advances anyway — a separate finding, NOT fixed here, because changing
it would make the human surface stricter, which nobody asked for.

### 6. `components/pabcd-state/src/hook.ts` — the injected examples

- `:471-478,493` `loopArmDirective`: no example object at all. Add the P→A
  object, both platform branches, so the prompt-time directive teaches the shape.
- `:1036-1040` `STOP_NEXT_COMMAND`: examples carry from/to but omit
  `workPhaseId` (all) and `testReceiptPath` (C→D). The Stop hook knows whether a
  goalplan is bound, so the emitted example should include the active work-phase
  id when there is one.
- `:1163-1164` `buildGoalIdleBlock`: emits `evidence` where the schema says
  `did`. Rename. This one advances today because IDLE→P is ungated, so it fails
  SILENTLY rather than loudly — the worst of the three.

### 7. `bin/codexclaw.mjs:249-286` + the `--help` verbs

Folded in because it is the same defect family and the same test file. Top-level
help omits `receipt`, `review-round`, `scan`, `release` while instructing agents
to run `<cmd> --help`; and `review-round`/`plan` reject `--help` as an unknown
verb (`review-round-cli.ts:99`, `plan-cli.ts:75`). Add the `help|--help|-h`
branch that loop/receipt/scan already have, and list the missing verbs.

`cxc freeze --help` writing `.codexclaw/interview/freeze.json` is the same
family but a mutation, not a message: handle `--help` before any IO.
`metric`/`divergence` demanding `--session` before printing usage is the same
one-line fix.

## TESTS

In `components/pabcd-state/test/`:

**Amended after audit (002 blocker 2).** The first draft asserted the message
"contains `from` and `to`". Today's message is `attest JSON missing valid
from/to` — it contains both. Those tests would have passed against the very bug
they exist to prevent. Every assertion below pins a substring that does NOT
exist in the tree today.

1. `orchestrate-cli`: an attest lacking `from`/`to` on verb `A` produces a
   message containing the literal fragment `"did":"`, the string
   `cxc orchestrate status`, and `planUnit` (the verb-specific key). None of the
   three appears in the current output.
2. The same for `--attest-file`, asserting ITS wording (`attest file <path> is
   missing valid from/to`), since `:257` is a separate code path with a separate
   literal that a single-path test leaves uncovered. It matters more than usual:
   it is the REQUIRED path on Windows.
3. `orchestrate-grammar`: same assertion on the chat parser.
4. `hook`: `buildGoalIdleBlock` emits `"did"` and not `"evidence"`;
   `loopArmDirective` contains a from/to-bearing object on both platform
   branches (platform is injected — this repo's convention, `atomic-write.test.ts:4`).
5. `help-verbs.test.ts`: extend to `review-round`, `plan`, `metric`,
   `divergence`, `freeze`. The freeze case asserts exit 0, output contains
   `Usage`, AND that `.codexclaw/interview/freeze.json` was not created — the
   mutation is the actual bug, so the assertion must touch the filesystem.
6. A doc-truth test bound to the TABLE ROWS, not the file: parse the attest table
   out of `skills/pabcd/SKILL.md` and assert each gated row names the keys that
   edge's gate requires. A file-wide `rg` would pass on any incidental mention
   somewhere in a 37k-character document (002 nit 7). The repo already has this
   genre — `shipped skill catalog exactly matches on-disk SKILL.md folders` — so
   drift detection is house style, not an invention.

Test 6 is the one that stops this regressing. Everything else fixes today's text;
test 6 reddens the build when the next contract change forgets the skill again.

## Accept criteria

| # | Criterion | Proof |
|---|---|---|
| 1 | Every gated row names `from`/`to` + its edge-specific keys | table diff |
| 2 | `rg -e workPhaseId -e planUnit -e testReceiptPath plugins/codexclaw/skills/pabcd/SKILL.md` has hits | command output |
| 3 | The null-coerce refusal names the target verb and shows a correct example | live CLI output, BOTH flag forms (different literals) |
| 4 | No injected example uses `evidence` as an attest key | `rg` + test |
| 5 | `cxc orchestrate --help` carries a B→C object and a C→D object with `testReceiptPath` | help output |
| 6 | `--help` exits 0 with usage on every shipped verb, and `cxc freeze --help` creates no `.codexclaw/interview/freeze.json` | test output + `ls` |
| 7 | `scan-cli.ts:146`'s override example carries `from`/`to` | `rg` |
| 8 | `npm test` green after `npm run build` | receipt |

## Scope boundary

IN: the files above, plus `scan-cli.ts`'s override example (002 nit 9 — same
cascade, one line, and it is a runtime error handing the agent a command).

OUT: making the chat surface honor `attestError` (`hook.ts:773` drops it and the
human free-pass advances anyway; changing that makes the HUMAN surface stricter,
which nobody asked for); the interview-readiness dead end (001 §F.1); `--slug` on
loop steer/add-*; `fsm.ts:43`'s illegal-transition message; the docs-site
quickstart (002 nit 4).

Note on the grammar test: it pins the chat PARSER's error field only. Because
`hook.ts:773` discards `attestError`, that test does not protect chat UX, and it
is labeled as such so a later reader does not mistake it for coverage it lacks.

## Note on dist

`test/dist-freshness.test.mjs` fails on src/dist drift and `dist/` is committed
(260822 unit, §7). Editing `src/` alone reddens the suite. `npm run build` is
part of this phase, not an afterthought.
