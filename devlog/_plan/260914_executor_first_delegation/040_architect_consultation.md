# 040 — Architect consultation follow-up

Depends on: 14c20791 (executor ownership policy and P/B delivery).

## Outcome and scope

Expose the existing architect proposal → main executable plan → same-architect
reflection sequence at P entry, and record its actual result beside implementation
ownership. This is one C2 follow-up to the completed executor change. Main owns
decisions and integration; the architect remains read-only and the A reviewer
remains independent. No model routing, role registration, gate, attestation schema,
global installation, publication or minimum-spawn-count change is included.

## Consultation and decisions

The design proposal and same-handle reflection were received from architect
`01a0a052-2b6a-77b3-a5ef-f5d15ee9617b` in task
`01a0a049-f583-7633-981a-efbd0d680b96`. The reviewed executable-plan revision is
the five-part main packet below, based on `14c20791`; this file records that packet's
scope and decisions rather than claiming the architect reviewed this later file.

| Evidence | Retrievable reference |
|---|---|
| Design proposal | Architect message `msg_685bf51a98b54deca1f4d162572be52e`, 2026-09-14 14:31:03 UTC, rollout line 76 |
| Submitted executable-plan revision | Main message `msg_01a0a054-e122-7a82-adcf-133dbe530993`, 14:31:52 UTC, rollout line 82; SHA-256 `ce3a1198b3fc7daf2bc6df772cd981b7dd796e8154df9eaae8baae344f7972ca` of its UTF-8 text |
| Same-handle reflection | Architect message `msg_1dd8ebb104004267b7d8b77f6d26401e`, 14:32:16 UTC, rollout line 87; ALIGNED with ARCH-P-01 through ARCH-P-04 mapped to main items 1–4 and verification to item 5 |

The source is the local architect rollout
`rollout-2026-09-14T23-28-54-01a0a052-2b6a-77b3-a5ef-f5d15ee9617b.jsonl`
under the native Codex home's `sessions/2026/09/14/`. Raw conversation evidence
stays outside this repository. The dispositions below and file map implement the
submitted packet; the independent reviewer checks their correspondence to the diff.

- ARCH-P-01: accept with amendment. Formal P includes C2 compact and plan-only P
  plans; applicability is not conditional on whether a header was written.
  C0/C1 fast-path work needs neither consultation nor an omission record.
- ARCH-P-02: accept with amendment. Record the actual handle, proposal reference,
  decision dispositions, executable-plan revision submitted, reflection reference
  and unresolved gaps. User-forbidden delegation and failed consultation are
  distinct; a failed call is not a successful exemption.
- ARCH-P-03: accept. Keep phase-plan as the policy owner, add a short P skill/hook
  pointer, and remind A only about changed design decisions. Main still decides.
- ARCH-P-04: accept. Extend the existing CLI P hint; retain executor P/B hints and
  keep status and other CLI phases free of the new consultation hint.

## File change map and owners

| File | Change | Owner |
|---|---|---|
| `skills/pabcd/references/phase-plan.md` | Clarify formal-P scope and link consultation record | main: policy decision |
| `skills/pabcd/references/plan-output.md` | Add compact consultation evidence record before implementation ownership | main: policy decision |
| `skills/pabcd/SKILL.md` | Name proposal and reflection in the P owner pointer | main: policy decision |
| `structure/20_pabcd_dispatch_doctrine.md`, `structure/INDEX.md` | Synchronize owner pointers and evidence boundary | main: integration |
| `components/pabcd-state/src/hook.ts` | Add proposal/reflection at P and design-change recheck at A | executor |
| `components/pabcd-state/src/orchestrate-cli.ts` | Extend existing P hint, preserving B and status behavior | executor |
| `components/pabcd-state/test/{hook,orchestrate-cli}.test.ts` | Exercise actual hook/CLI outputs and negative paths | executor |
| `components/pabcd-state/dist/{hook,orchestrate-cli}.js` | Rebuild shipped payload | main: integration |

Skill and component paths above are relative to `plugins/codexclaw/`.

## Before / after contracts

- P skill/hook: general plan-owner pointer → explicit architect proposal before
  main's executable plan, then same-architect reflection before A, within user limits.
- Plan output: no consultation record → references and dispositions tied to the
  concrete plan, with honest gaps; no transcript copies or new machine schema.
- A hook: reviewer guidance → same guidance plus recheck only when module
  responsibility, data structure, interface or execution flow decisions change.
- CLI P: implementation owner hint → architect sequence plus that existing hint.
  CLI B and all transition gates retain their existing behavior.

## Verification

Run the existing hook/CLI tests before editing; extend runtime-output assertions
and establish a failing-before/passing-after regression. Run the affected suites,
`node plugins/codexclaw/scripts/build.mjs` and `node plugins/codexclaw/scripts/gate.mjs`.
Use the repository's full suite once on the combined change if required by its gate.
Use a task-owned TMPDIR outside `/tmp` (this host has an unrelated `/tmp/.git`).

Verify the installed payload in an isolated home: P carries both policies; A hook
rechecks only design changes; B retains implementation ownership; CLI status and
other phases do not acquire the consultation hint. Compare the real plugin cache
before and after to detect accidental writes.

Behavioral evidence is separate: an actual planning run must obtain a proposal
before finalizing its plan, send that plan to the same architect, and preserve the
independent reviewer. Include C0/C1 and no-delegation negative scenarios. A string
test or this task's earlier manually dispatched consultation is not proof of the
new policy's autonomous adoption. Report any unobserved scenario honestly.

## Review and completion

An independent reviewer checks the combined diff, existing executor behavior,
scope exemptions, evidence semantics and meaningful test coverage. Record fixes
and final verification in `041_architect_receipt.md`; leave the previous receipt
as historical evidence. Local commits follow the repository's `[agent]` convention.
