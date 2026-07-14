# 020 — Phase 2: P>A On-Disk Plan Verification + `cxc plan init` Scaffold (wp2)

Goal: P>A can no longer be satisfied by one sentence. The attest must point at a real
`devlog/_plan/YYMMDD_slug/` unit whose decade docs exist on disk and cover the
registered work-phases. A scaffold command removes the "no folder exists" excuse.

STALENESS NOTE: re-verify all line refs at this phase's P; wp1 will have landed.

## MODIFY `plugins/codexclaw/components/pabcd-state/src/attest.ts`

### 1. `Attestation` interface (~line 23)

Add optional fields:

```ts
  /** P>A: devlog plan unit dir (relative to repo root or absolute), e.g. "devlog/_plan/260714_slug". */
  planUnit?: string;
  /** P>A: plan doc paths inside planUnit that this loop's work-phases execute from. */
  planPaths?: string[];
```

Coerce both in `coerceAttest` (string / string[] of strings, trimmed).

### 2. `validateAttest` P>A branch (~line 130, after the `did` check)

`validateAttest` is pure today (no fs). Keep it pure: add a separate
`validatePlanArtifacts(att, cwd)` exported from attest.ts that DOES touch fs, called
from `orchestrate-cli.ts` right after `validateAttest` for `P>A` only:

```ts
export function validatePlanArtifacts(att: Attestation, cwd: string): AttestResult {
  if (`${att.from}>${att.to}` !== "P>A") return { ok: true };
  if (!att.planUnit) return { ok: false, reason:
    "P -> A requires planUnit: the devlog/_plan/YYMMDD_slug/ unit this plan lives in " +
    "(DIFFLEVEL-ROADMAP-01). Scaffold one with `cxc plan init <slug>` if missing." };
  const unit = resolve(cwd, att.planUnit);
  if (!existsSync(unit) || !statSync(unit).isDirectory()) return { ok: false, reason:
    `planUnit ${att.planUnit} does not exist. Create it (cxc plan init) and write the plan docs first.` };
  const docs = readdirSync(unit).filter((f) => /^\d{3}_.+\.md$/.test(f));
  if (docs.length === 0) return { ok: false, reason:
    `planUnit ${att.planUnit} has no numbered plan docs (000_*.md...). A chat-message plan does not satisfy P (LEXICO-SPLIT-01).` };
  for (const p of att.planPaths ?? []) {
    if (!existsSync(resolve(cwd, p))) return { ok: false, reason: `planPaths entry ${p} does not exist on disk.` };
  }
  return { ok: true };
}
```

Fail-closed for P>A; other edges untouched. Content depth stays the A-phase reviewer's
job (a byte-count lint invites padding); the gate guarantees EXISTENCE + numbering.

## MODIFY `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts`

- Help text (~line 86): extend the `A` example with `"planUnit":"devlog/_plan/260714_slug"`.
- AUDIT ROUND 1 blocker #5 correction: orchestrate-cli.ts never calls `validateAttest`
  directly — it calls `transition()` (~line 259), which invokes `validateAttest` inside
  `fsm.ts:112`. Insert the `validatePlanArtifacts(att, cwd)` check BEFORE the
  `transition()` call (cwd from `--cwd`/process.cwd), rejecting with its reason on the
  same exit path as a transition rejection. Keep fsm.ts pure/fs-free.

## ADD `plan` verb — routed in `bin/codexclaw.mjs`, NOT component cli.ts

AUDIT ROUND 1 blocker #1 correction: the `cxc` bin dispatches subcommands via explicit
`case` labels in `bin/codexclaw.mjs` (~lines 332-356) and the user-facing usage string
lives there (~line 190). Required wiring:

- `bin/codexclaw.mjs`: new `case "plan":` delegating to the pabcd-state dist entry,
  plus a usage-string line.
- `test/cli-usage.test.mjs` (repo-level): update for the new verb.
- New `plugins/codexclaw/components/pabcd-state/src/plan-cli.ts` implementing
  `plan init <slug> [--phases N] [--cwd <path>]` → `devlog/_plan/<YYMMDD>_<slug>/` with
  `000_plan.md` (Objective / Loop-spec / Work-phase map / Accept criteria headings) and
  `0N0_phaseN.md` stubs each carrying the DIFFLEVEL-ROADMAP-01 header ("write to
  diff-level BEFORE P>A; empty scaffolds do not satisfy the rule").
- Scaffold template strings must NOT contain literal TODO/FIXME/TBD tokens —
  build.mjs PLACEHOLDER_RE rejects them (audit round 1 blocker #8). Use "fill-in"
  phrasing instead.

## TESTS

`test/attest.test.ts`: P>A without planUnit → fail; with nonexistent dir → fail; with
dir but no `\d{3}_*.md` → fail; with valid unit (tmpdir fixture) → ok; A>B/B>C/C>D
unaffected without planUnit. `test/plan-cli.test.ts`: init creates folder + 000 + N
stubs; refuses to overwrite an existing unit.

## Verification (C)

bun test; rebuild dist; standalone: `cxc orchestrate A --session <id> --attest '{...no
planUnit...}'` → non-zero + reason; with scaffolded unit → advances. Capture outputs.
