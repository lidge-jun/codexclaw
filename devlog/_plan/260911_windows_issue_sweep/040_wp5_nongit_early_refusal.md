# 040 — wp5 / L4 / #133 non-git early refusal

Branch `codex/fix-nongit-early-refusal`, base L3 (`codex/fix-config-guard-help`).
Criterion **c-5**. This document closes **#133 only**. #109 is `045`.

## 1. Scope

Two changes, both small, both in `pabcd-state`:

1. Stop leaking git `stderr` into user output.
2. Refuse a bound cycle **at entry** when the source identity cannot be resolved,
   instead of letting it reach C and stall there with no exit.

### The refusal predicate is the load-bearing decision

000_plan.md pins it: the predicate is **"the SOURCE identity cannot be resolved"**,
never **"the FSM cwd has no `.git`"**.

Written the second way this layer would reject #109's split-cwd case at the door, and
`045` would have to undo `040`. Written the first way they compose: `045`'s entire job
is to make that source identity resolvable for a split cwd, so once a source is bound
the predicate stops firing on its own.

Concretely: the gate calls the same `captureSessionSourceIdentity()` the C→D gate
already uses, and refuses on `kind === "unavailable"`. It never calls `existsSync(join(cwd, ".git"))`.

## 2. Change map

| file | NEW/MODIFY/DELETE | change |
|---|---|---|
| `plugins/codexclaw/components/pabcd-state/src/source-identity.ts` | MODIFY | `git()` pipes stderr instead of inheriting it |
| `plugins/codexclaw/components/pabcd-state/src/source-gate.ts` | NEW | one exported predicate both entry points call |
| `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts` | MODIFY | `loop init --session` refuses an unresolvable source |
| `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts` | MODIFY | IDLE→P on a bound session refuses the same way |
| `plugins/codexclaw/components/pabcd-state/dist/*.js` | MODIFY/NEW | `npm run build`. `dist/source-gate.js` is NEW, so `git add -f` it |
| `plugins/codexclaw/components/pabcd-state/test/source-gate.test.ts` | NEW | predicate unit tests |
| `plugins/codexclaw/components/pabcd-state/test/nongit-bound-cycle.test.ts` | NEW | integration: non-git bound session refused at entry, unbound still passes |

## 3. MODIFY `source-identity.ts` — swallow git stderr

The leak is one missing option. `session-source.ts:30` already got this right; this
file is the only one that still inherits.

before (`source-identity.ts:69-71`):

```ts
function git(cwd: string, args: string[]): Buffer {
  return execFileSync("git", args, { cwd, env: gitEnv(), maxBuffer: 64 * 1024 * 1024 });
}
```

after:

```ts
function git(cwd: string, args: string[]): Buffer {
  // stdio: inherit (the default for stderr) is why `fatal: not a git repository`
  // reaches the user on every transition in a non-git workspace (#133). The
  // absence of git is a normal, handled outcome here — captureSourceIdentity
  // turns the throw into kind:"unavailable" — so its diagnostics must not be
  // narrated as if a command failed. session-source.ts:30 already pipes.
  return execFileSync("git", args, {
    cwd,
    env: gitEnv(),
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
```

`stdio[1]` must stay `pipe`: every caller reads the returned Buffer.

## 4. NEW `source-gate.ts` — the single predicate

One module so the two entry points cannot drift apart, and so the test can exercise
the predicate without driving the CLI.

```ts
/**
 * source-gate.ts — entry refusal for goalplan-bound cycles whose source identity
 * cannot be resolved (#133).
 *
 * WHY AT ENTRY: the C->D gate (check-gate.ts:83) and `receipt test`
 * (receipt-cli.ts:167) both refuse an `unavailable` identity, and that refusal is
 * correct - CHECK-BINDING-01 is fail-closed and 075_receipt_binding.md forbids
 * reading "I do not know" as "unchanged". But B->C is deliberately fail-open ("no
 * git means no opinion"), so a bound session sails P->A->B->C and only discovers at
 * C that it can never close. Plan, audit and implementation are already spent. This
 * gate moves the same verdict to the cheapest possible point.
 *
 * WHAT IT DOES NOT DO: it never tests for `.git`. The predicate is "the SOURCE
 * identity is unavailable", so binding a git source worktree (see 045 / #109)
 * clears it without this file knowing anything about split cwds.
 *
 * Unbound sessions are untouched: they close D on checkOutput + exitCode and never
 * enter the receipt path.
 */
import { captureSessionSourceIdentity } from "./session-source-identity.ts";

export interface SourceGateResult {
  ok: boolean;
  reason?: string;
}

export function checkBoundSourceIdentity(cwd: string, sessionId: string): SourceGateResult {
  let kind: string;
  try {
    kind = captureSessionSourceIdentity(cwd, sessionId, { excludeCodexclawArtifacts: true }).kind;
  } catch (err) {
    // A thrown SOURCE-ROOT/binding error is also "cannot resolve".
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
  if (kind === "unavailable") {
    return {
      ok: false,
      reason: [
        "this workspace has no resolvable git source identity, and a goalplan-bound",
        "cycle cannot be closed without one: C -> D requires a testReceiptPath",
        "(CHECK-BINDING-01) and `cxc receipt test` refuses to write a receipt it",
        "cannot bind to a commit.",
        "",
        "Pick one:",
        "  - bind a git source tree:  cxc session source <absolute-path> --json",
        "  - or run this cycle unbound (no `cxc loop init --session`), which closes",
        "    D on checkOutput + exitCode alone.",
      ].join("\n"),
    };
  }
  return { ok: true };
}
```

## 5. MODIFY the two entry points

Both refuse before writing anything. Read the current argument-parsing shape in each
file and insert the guard immediately after the session id is known and the goalplan
binding is established, before the first mutation.

### 5.1 `goalplan-cli.ts` — `loop init --session <id>`

This is the earliest honest point: `loop init` is what makes the session bound in the
first place (it binds a slug and does not consult git at all today). Refusing here
means the trap never gets built.

**Guard it on the session being present.** `loop init` without `--session` is a supported
path that writes the local artifact only and binds nothing (`goalplan-cli.ts:70` and the
`[--session <id>]` form in the help at `:559`). An unguarded gate would reject or throw
on that call, which is a regression this layer has no business causing — the gate's
whole justification is that a **bound** plan promises a closable cycle.

Insert after the existing-plan check and before `buildGoalplan`:

```ts
// #133: a BOUND plan promises a closable cycle. Do not create the binding when
// the source identity cannot be resolved - the failure would otherwise surface at
// C, after plan/audit/build are spent.
// Only when a session is actually being bound: `loop init` without --session writes
// the local artifact and binds nothing, so it keeps its current behaviour.
if (session) {
  const gate = checkBoundSourceIdentity(args.cwd, session);
  if (!gate.ok) {
    return { output: `loop init: ${gate.reason}\nNothing was written.`, code: 1 };
  }
}
```

Use whatever local name the surrounding code already has for the session id; do not
introduce a second source of truth for it.

### 5.2 `orchestrate-cli.ts` — IDLE→P on an already-bound session

`loop init` is not the only way to arrive bound: a plan can be bound by an earlier
session, or created before this layer shipped. Guard P entry too, and **only** when a
goalplan is bound (`state.slug`) — the same condition `orchestrate-cli.ts:701` already
uses for the C→D receipt requirement. An unbound P entry must stay unaffected.

```ts
// #133: same predicate as loop init, for a session that arrived bound.
// Guarded by state.slug so unbound HITL cycles are untouched.
if (state.slug) {
  const gate = checkBoundSourceIdentity(cwd, session);
  if (!gate.ok) {
    return { output: `orchestrate P: ${gate.reason}\nNothing was written.`, code: 1 };
  }
}
```

### 5.3 Exact anchors, resolved at L3 head `a7e72a46`

§5.1 and §5.2 told the implementer to find the right spot. Here it is.

**`goalplan-cli.ts`** — `runGoalplanCli` is at `:595` and the `init` branch opens at
`:597`. Order inside it today: objective check, `deriveSlug`, existing-plan check,
`buildGoalplan`, then the first mutation `writeGoalplan(args.cwd, plan)` at `:612`,
then `appendGoalplanLedger`, then the session bind. Insert the gate **after the
existing-plan check and before `buildGoalplan`**, so nothing is constructed or written.

**`orchestrate-cli.ts`** — the agent-gated phase path starts at `:557`. `:559-560` already
validates `resolveSessionSource` with the comment "Validate before any phase/goalplan
writes", which is exactly the right neighbourhood. Insert the gate **immediately after
that try/catch and before the P>A plan-artifact gate at `:568`**.

Guard it on `to === "P" && state.slug`, not on `state.phase === "IDLE"`: `I>P` is also
an entry edge into a cycle and deserves the same refusal. `state.slug` is the same
bound-session condition `:579` and `:701` already use, so an unbound HITL cycle is
untouched by construction.

Both sites return `code: 1` with the gate's reason and the words `Nothing was written`.

### 5.4 Two corrections the existing suite forced during the build

Both were found by running `pabcd-state`'s 1226 tests against the first implementation,
not by reading. Recorded because each is a real design point, not a fixture nit.

**1. The guard must cover ENTRY edges only, not every `to === "P"`.**

`review-deadlock.test.ts:96` ("a re-plan closes the rounds it just invalidated") broke: an
`A->P` re-plan also has `to === "P"`, so a `to === "P" && state.slug` guard silently
blocked it and the round stayed `in_flight` instead of reaching `inconclusive`. A re-plan
is not an entry into a cycle — the cycle is already in flight and already bound, and
refusing it **strands** the session rather than protecting it, which is the exact
opposite of this layer's purpose. The guard is now:

```ts
if (to === "P" && (state.phase === "IDLE" || state.phase === "I") && state.slug) {
```

The audit had flagged `I->P` as needing inclusion and it does; it did not consider
`A->P`, and neither did I. The suite did.

**2. The existing fixtures normalised the #133 trap.**

`goalplan.test.ts:603` ("030.3: init --session persists the derived slug") broke, because
it binds a session in a bare `mkdtempSync` directory — which is precisely the
non-git-plus-bound-plan combination this issue is about. The fixture was not wrong about
slug persistence; it was silently asserting that binding a plan into an unclosable
workspace is fine.

Fixed with a `tmpRepo()` helper that `git init`s and commits one file, used only by tests
that actually bind a session. `loop init` **without** `--session` keeps using the bare
`tmp()`, which is also the regression guard for the guarded-on-session rule in §5.1.

This is worth naming: part of why #133 survived is that the suite's own fixtures treated
the trap as the normal case. Result after both corrections: `pabcd-state` 1226 tests,
1224 passed, 0 failed, 2 skipped.

## 6. Tests

### 6.1 NEW `test/source-gate.test.ts`

Three cases, no CLI:

1. A temp directory that is **not** a repository, with a bound session → `ok === false`
   and the reason names both `cxc session source` and the unbound escape hatch.
2. A temp `git init` directory with one commit → `ok === true`.
3. A dirty temp repository → `ok === true`. Dirty is a *resolved* identity; this gate
   must not confuse "dirty" with "unavailable".

### 6.2 NEW `test/nongit-bound-cycle.test.ts`

The integration test that would have caught #133. In a non-git temp cwd:

1. `loop init --session <id> --objective ...` exits non-zero and writes **no**
   `.codexclaw/goalplans/` directory.
2. The **unbound** path still works end to end: `orchestrate P/A/B/C` then D closes
   to IDLE on `checkOutput` + `exitCode`, exactly as it does today. This is the
   regression guard that proves the layer did not tighten the unbound contract.
3. No line matching `/^fatal:/m` appears on stdout or stderr of any transition.
   This is the §3 assertion; before the fix, B→C and C emit two `fatal:` lines each.

**Case 3 must `spawnSync` a real process, not call `run*Cli` in-process.** The leak is
`execFileSync` inheriting the PARENT's stderr, so in-process it lands on the test
runner's own stderr and never appears in the returned `output` string — the assertion
would pass while the bug is fully present. Drive the built CLI and read `res.stderr`:

```ts
const res = spawnSync(process.execPath, [ORCHESTRATE_CLI, "C", "--session", id, "--attest-file", p], {
  cwd: probe, encoding: "utf8", env: { ...process.env, CODEX_HOME: home },
});
assert.doesNotMatch(res.stderr ?? "", /^fatal:/m);
assert.doesNotMatch(res.stdout ?? "", /^fatal:/m);
```

Cases 1 and 2 may stay in-process; only the stderr assertion needs a real child.

## 7. Reproduction (parent fails, L4 head passes)

```powershell
$probe = Join-Path $env:TEMP ("cxc-nongit-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $probe | Out-Null
cd $probe
cxc loop init --objective "bound probe" --session cli --criterion "probe closes a cycle"
cxc orchestrate P --session cli
```

On the parent commit: `loop init` succeeds, P succeeds, and the cycle later dies at C
with `no receipt written` — plus `fatal: not a git repository` on the B and C
transitions. On the L4 head: `loop init` refuses immediately with the two-option
message and writes nothing, and no `fatal:` line appears anywhere.

## 8. Regression risk

The behaviour change is intentional and is the point: a bound non-git session that
used to reach C now stops at entry. Three things must NOT change, and each has a test:

- **Unbound cycles.** Guarded by `state.slug`. §6.2 case 2 pins it.
- **Dirty repositories.** `dirty` is resolved, not unavailable. §6.1 case 3 pins it.
- **The C→D contract.** Nothing in `check-gate.ts` or `receipt-cli.ts` is touched. This
  layer adds an earlier refusal; it never adds a way through.

The real hazard is a later refactor rewriting the predicate as a `.git` existence
check because it is cheaper. That would silently re-break #109. §4's doc comment and
§6.1 case 2/3 are the defence.

Piping git stderr loses diagnostics for genuinely broken repositories (corrupt index,
permission failure). Accepted: those already surface as a thrown `execFileSync` error
whose message the callers report, and the alternative is the #133 leak on every
ordinary non-git transition.

### 8.1 Known coverage limit — the human free-pass is outside this gate

Both insertion points are on the **agent-gated CLI** path. A line-anchored chat
`orchestrate P` is a human free-pass that reaches `applyHumanTransition`
(`orchestrate-apply.ts:69`) without passing through `runOrchestrateCli`'s gates, so a
human can still enter P on a bound non-git session and rediscover the stall at C.

Accepted, not overlooked. The human path is deliberately ungated across this whole
surface — that is what "human free-pass" means in `cxc-pabcd` phase-control — and
widening it here would be a separate contract change, not a #133 fix. The agent path is
where the unattended loop lives and where the trap actually cost a cycle. Recorded so a
later reader does not mistake the gap for an omission.

## 9. Criterion

**c-5**: a goalplan-bound cycle in a non-git workspace is refused at entry with an
actionable message instead of stalling at C, and no git `fatal` line reaches user
output on any transition. Proved by §6.2 cases 1 and 3 plus the live §7 reproduction.

Explicitly **not** claimed here: #109. See `045` and criterion **c-8**.
