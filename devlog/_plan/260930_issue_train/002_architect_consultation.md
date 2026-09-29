# 002 — Architect consultation

Architect: V1 subagent `01a0ee15-caad-7330-8b8d-4c028cefd432`, dispatched read-only with `cxc-dev` and `cxc-dev-architecture` attached (`CXC-ROLE: architect` header; the V1 schema has no `agent_type`). It inherited this session's model; no model override was requested. The proposal covered the three changes in `010`, `020` and `030` and returned 28 decisions. Main's dispositions follow; the reflection result is appended below after the architect checks the written plan.

## Decisions and dispositions

| ID | Decision (short) | Main |
|---|---|---|
| D1 | Shared `VerifierResult` type for legacy `verifierResult` and new `verifierResults[]` | accept (010 1a, 1c) |
| D2 | Merge both result fields, one rule set | accept (010 1g) |
| D3 | Distinct trimmed required commands; exact equality after trim | accept (010 1d `distinctCommands`) |
| D4 | Every required command needs a match; every result must exit 0 | accept |
| D5 | Unrelated results fail even with full coverage when commands are required; extras go in `commandsRun` | accept; the issue says an unrelated result must be rejected, and a gate fails closed. Disclosed in CHANGELOG and DISPATCH-VERIFIER-01 |
| D6 | Legacy single result with several required commands reports incomplete | accept |
| D7 | Additive `missing: string[]` in the return value | accept |
| D8 | `validateReceipt` checks both result fields' shape | accept |
| D9 | `validatePacket` rejects blank verifier command entries; duplicates allowed | accept |
| D10 | Optional `verifierEffects[]` beside unchanged `verifierCommands` | accept |
| D11 | Effect entries must name a listed command, once, with valid field types | accept |
| D12 | No path checks on `expectedWrites`; a declaration is a claim | accept |
| D13 | Preflight rules; declared writes on shared-read need isolation | accept |
| D14 | Preflight separate from validation; undeclared verifiers are flagged, not invalid | accept |
| D15 | DISPATCH-VERIFIER-01 paragraph in `delegation.md` after DISPATCH-TASK-01 | accept |
| D16 | Rebuild tracked dist files | accept |
| D17 | Inline provenance in the OPEN ASSUMPTIONS line; tracker text mirrors it | accept (020 1b) |
| D18 | Only proposed/open stay in OPEN ASSUMPTIONS and tracker; confirmed to requirements; rejected to a separate section | accept; section name `## ASSUMPTION DECISIONS` |
| D19 | Answer reference is the `answer_recorded` `eventId`, not a bare `questionId` | accept |
| D20 | `proposed` vs `open` meaning; high-impact proposed asked next; closeout groups | accept |
| D21 | `hook.ts:1935` unchanged; one clause in `durable-goalplan.md:40` | accept |
| D22 | `options?: string[]` on decisions | accept |
| D23 | Validation in `reviveDecisions` (fail closed) and the reviver copies `options` | accept; reviver keeps exact strings and compares trimmed, matching its existing rule, while `ask` stores trimmed values |
| D24 | `ask` mirrors the reviver rules with specific reasons; never stores `[]` | accept |
| D25 | Do not require the `decide` answer to be one of the options | accept. This overrides the goal objective's and criterion c-10's wording "answer validated against options when present": the host always offers a free-form reply, so the check would strand linked phases. c-10's evidence will state this disposition |
| D26 | Repeatable `--option`; no `options: []` default | accept |
| D27 | `ready --json` and `show` expose options; docs include `async-questions.md:56` | accept, including the async-questions sync |
| D28 | `withdrawn` out of scope; old plans round-trip | accept |

## Unresolved assumptions and answers

1. A legacy single result matching the only required command still passes: yes (existing test `:94` stays green).
2. Writes outside the checkout are not treated as safe under shared-read: yes (D13).
3. Minimum option count: one. The issue's acceptance list requires membership, not a count; two-or-more is a style choice left to the question author.
4. `async-questions.md:56` update: in scope.
5. Rejected-assumption section name: `## ASSUMPTION DECISIONS`. `listPlanFiles` (`freeze-cli.ts:29`) hashes whole files, so no heading set is required.
6. Goal-mode confirmation reference: a decided goalplan decision id (020 1b).
7. Trim-only matching is shared by validation and satisfaction: yes.

## Reflection


Round 1 (same architect, after the plan was written): `REFLECTION: MISALIGNED` with one gap. D17's second half, that a tracker assumption's `text` must repeat the provenance line because freeze copies tracker text into the manifest (`freeze-cli.ts:97`), was missing from the executable guidance in 020. It also noted that 030's malformed-options test must assert the reviver's invalid-plan message naming `decisions` rather than a validate line, and confirmed that the code in 010 and 030 survives the type-stripping build and keeps existing tests green.

Main disposition: both folded. 020 1(b) gained the tracker-text bullet; 030's reviver test row now asserts the `decisions` message. The optional `renderGoalplanHelp` wording is left to B. With the one gap closed, every decision D1-D28 maps to a plan location in the architect's table; main records the consultation as aligned after the fold.
