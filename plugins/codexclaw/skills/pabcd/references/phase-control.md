## Phase Control / Orchestrate

### Chat Surface

The chat command grammar is:

```text
orchestrate <I|P|A|B|C|D|status|reset> [--attest <json> | --attest-file <path>]
```

**On Windows use `--attest-file`.** PowerShell strips the quotes from inline JSON
and, once you escape them, splits the value at its first space — and every gated
edge needs a `did` narrative, which has spaces. Write the JSON first, then attest:

```powershell
'<json>' | Set-Content -Encoding utf8 .codexclaw/attest.json
cxc orchestrate A --session <id> --attest-file .codexclaw/attest.json
```

Accepted prefixes include `$codexclaw:cxc-orchestrate`, `$cxc-pabcd`,
`cxc orchestrate`, `/orchestrate`, and bare `orchestrate`.

### Semantics

- Chat-submitted commands are the human path.
- Human path can advance legal adjacent phases without attestation.
- Agent/terminal path is the live `cxc orchestrate` CLI and is attest-gated:
  forward edges (P>A, A>B, B>C, C>D) require `--attest` evidence.
- `D` is a closing action that returns to `IDLE`; it is not a resting badge.
- `status` is read-only.
- `reset` is an explicit control action, not a normal phase edge.

### Per-phase artifact obligation (ORCH-ARTIFACT-01)

Advancing a phase is not the same as doing it (see [Faithful execution](../SKILL.md#work-phase-loop-multi-pass-tasks)). Each forward
edge must carry its real artifact, not just an `--attest` string: P = the actual diff-level plan;
A = an audit/review verdict that names blockers (`A>B` attest requires a non-empty
`auditOutput` — the pasted tail of the dispatched reviewer subagent's verdict — plus
the main agent's `auditVerdict` judgment, AUDIT-LOOP-01); B = the
implementation delta; C = fresh `tsc`/test/gate output (`C>D` attest requires a non-empty
`checkOutput` and `exitCode`, which must be `0`); D = a cycle summary with
evidence and the next-phase decision. A phase whose artifact is absent is not done, regardless
of adjacency.

**ATTEST-EVIDENCE-01 (DEFAULT):** write `did` with artifact pointers, not only a
sentence: plan/devlog paths, changed files, commands with exit codes, and evidence or
ledger paths when present. The runtime gate remains form-only for `did`; this is the
agent discipline that makes later audit possible.

**ATTEST-SHAPE-01 (STRICT):** every `--attest` object carries `from` and `to`
naming the edge it advances. The parser coerces before any gate runs
(`attest.ts` `coerceAttest`), so an attest without them is refused on EVERY
edge — including ungated entry edges — before `did`, `planUnit`, or
`workPhaseId` is ever examined.

| Edge | Required attest keys | Notes |
|------|---------------------|-------|
| IDLE->P | none — pass no `--attest` at all | If you pass one anyway it is still parsed, so it still needs `from`/`to` |
| I->P | none — unless overriding an unready interview, which needs `from`, `to`, `did`, `override` | |
| P->A | `from`, `to`, `did` with plan pointer, `planUnit` | `planUnit` must be a real `devlog/_plan/YYMMDD_slug/` holding numbered docs |
| A->B | `from`, `to`, `did`, `auditOutput`, `auditVerdict` (`pass`/`near-pass`/`fail`); near-pass adds `auditResidual` | FAIL never advances |
| B->C | `from`, `to`, `did` with implementation delta | |
| C->D | `from`, `to`, `did`, `checkOutput`, `exitCode` (required, must be 0) | a goalplan-bound session also needs `testReceiptPath` from `cxc receipt test` |

**Every gated edge additionally requires `workPhaseId` whenever a goalplan is
bound to the session** — it must equal the active work-phase (LOOP-UNIT-CHAIN-01).

Copy-paste objects. Replace the values; keep every key:

```json
{"from":"P","to":"A","did":"wrote the diff-level plan at <path>","planUnit":"devlog/_plan/260825_slug","workPhaseId":"wp1"}
{"from":"A","to":"B","did":"folded 2 blockers, rebutted 1","auditOutput":"<pasted reviewer verdict tail>","auditVerdict":"near-pass","auditResidual":"GO-WITH-FIXES; blocker 1 folded, blocker 2 rebutted because ...","workPhaseId":"wp1"}
{"from":"B","to":"C","did":"implemented <files>; <n> tests added","workPhaseId":"wp1"}
{"from":"C","to":"D","did":"verified at <sha>","checkOutput":"<pasted tail of the command>","exitCode":0,"testReceiptPath":".codexclaw/evidence/<session>/test-receipt.json","workPhaseId":"wp1"}
```

Omit `workPhaseId` when no goalplan is bound, and `testReceiptPath` when the
session is unbound. Everything else is mandatory on that edge.

These are edge contracts, not substitutes for phase work. Artifact pointers must name
the evidence produced by the phase being advanced.

### Control surfaces (shipped)

Chat and CLI control the same persisted FSM and ledger; invocation source selects
the gate. A line-anchored chat `orchestrate <verb>` is a human free-pass, while
illegal edges remain refused. Agents use
`cxc orchestrate <verb> --session <id> --attest <json>` (or `--attest-file <path>`,
required on Windows) and provide real evidence.
`A>B` requires `auditOutput` plus `auditVerdict`; near-pass also requires
`auditResidual`.
`C>D` requires `checkOutput` and a passing `exitCode` — omitting it is refused, since a check with no outcome is not a check.
Mutating verbs require an explicit session; only `status` may use latest-session fallback.
**SESSION-IDENTITY-01 (STRICT):** use the current SessionStart binding, never a
parent or transcript-history id; this also governs `cxc loop init` and `cxc goalplan`.
When native CODEX_THREAD_ID is available, corroborate the binding using
`cxc session current` before mutation. Missing, inherited or conflicting binding:
run `cxc session current` then explicit `cxc session bind` from the verified native
cwd. Never assign the environment ID, replay hook JSON or substitute `cli`.
The command verifies the native ID/cwd against Codex's read-only thread database,
rejects subagents and unavailable/incompatible identity, and preserves existing
state. A failed verification is not permission to guess. Binding reports
`hooksVerified:false`: it does not prove hook delivery, enable hooks or arm Stop.
SessionStart creates missing IDLE state without
clobbering resumed state; `cli` is terminal-only. Injected directives end with
`IPABCD: <phase> (<LABEL>)`. Injected footer values are prompt-time snapshots.
The final status reports the latest verified persisted phase and matching label
for the current SessionStart-bound session and cwd, including a later authorized
successful transition. This reporting rule requires no additional calls and grants
no transition authority. D closes to IDLE unless later authorized successful
re-entry occurs.

### Loop / goal activation handoff

Execution intent and HOTL activation belong to [cxc-loop](../../loop/SKILL.md).
This reference owns phase commands and attestations, not permission to execute.

### Source worktrees

A native session may keep its original cwd while implementing in a linked Git
worktree. From the native cwd, run `cxc session source /absolute/worktree --json`
before entering B. It verifies native identity, pins the source worktree in the
same repository, and leaves session/goalplan/evidence storage in the native cwd.
`cxc session current --json` reports `sourceCwd` and, for a bound worktree,
`sourceIdentity`. This is a source snapshot, not evidence that a check ran.

B entry/delta, `receipt test` execution and Check/final validation use that
worktree. Plans and receipt paths still resolve from the native cwd; use absolute
worktree paths for plan documents. The binding is immutable; repeating the same
command is idempotent. B entry pins the root in session state; if its binding file
is lost, the command can restore only that same pinned root, including during Check. A missing or changed binding cannot count as implementation.
A linked worktree is not exclusive to a session: edits by another actor in the
same worktree remain indistinguishable. Use a task-owned worktree.

For QA verdict `sourceSnapshotAt`, reviewer-lane `sourceIdentity` and final-gate
`sourceIdentity`, capture `session current --json` at observation time and retain
the entire identity, including `sourceRoot`. Do not copy an old snapshot or
reconstruct it from native HEAD. Test receipts capture automatically. Rootless
legacy receipts remain usable for unbound sessions only. Run
`cxc loop validate --session <id> --slug <slug>` so validation uses the same binding.

An old, unbound B cycle cannot be rebound retroactively: its baseline describes the old
source. Preserve its evidence, stop any active goal using host-supported controls,
then use the supported return-to-I/replan path (I -> P with an explicit documented
readiness override when requirements are already known), bind before B, review the
plan and perform real new work before Check. Never fabricate a baseline or edit
native SQLite/FSM bytes to make the old cycle pass. An explicit reset also starts
a new cycle but is a separately authorized control operation.

If the pinned worktree was removed, recreate it at that path or start a new
native session for a different worktree. Reset does not retarget a source.
Binding publication requires filesystem hard-link support; unsupported filesystems
fail without replacing existing state or bindings.
