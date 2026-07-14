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

### 2. On-disk check lives in NEW `src/plan-gate.ts` (wp2-cycle P amendment)

attest.ts's header contract is "No server, no IO: pure validation" — do not break it.
`validatePlanArtifacts(att, cwd)` goes in a NEW file `src/plan-gate.ts` (fs allowed),
called from `orchestrate-cli.ts` BEFORE the `transition()` call when
`state.phase === "P" && verb === "A"`. The human chat surface (applyHumanTransition)
stays a free-pass by design; the CLI path is the mandated agent path:

```ts
// Caller gates the edge (state.phase === "P" && verb === "A"); att may be null
// (bare `cxc orchestrate A`) — the gate still fires so the FIRST error names
// planUnit (round-3 residual fold).
export function validatePlanArtifacts(att: Attestation | null, cwd: string): AttestResult {
  if (!att?.planUnit) return { ok: false, reason:
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

## ADD `plan` verb — bin case + component cli.ts kind dispatch (BOTH required)

AUDIT ROUND 1 blocker #1 + ROUND 2 High #1: the `cxc` bin dispatches subcommands via
explicit `case` labels in `bin/codexclaw.mjs` (~lines 343-356, usage ~188-194), which
spawn `dist/cli.js` with the kind as argv[0]; component `cli.ts` main() then routes
kinds via explicit if-blocks (freeze:67 / orchestrate:79 / metric:91 / loop:100 /
divergence:113) and silently exit-0s unknown kinds. BOTH layers need wiring:

- `bin/codexclaw.mjs`: new `case "plan":` → `runPabcdState(process.argv.slice(2))`
  (divergence/metric pattern) + usage-string line.
- `cli.ts` main(): new `if (kind === "plan")` branch delegating to plan-cli.ts —
  without it `cxc plan init` is a silent exit-0 no-op.
- `plugins/codexclaw/test/cli-usage.test.mjs` (NOT repo-level test/): update for the
  new verb.
- New `plugins/codexclaw/components/pabcd-state/src/plan-cli.ts` implementing
  `plan init <slug> [--phases N] [--cwd <path>]` → `devlog/_plan/<YYMMDD>_<slug>/` with
  `000_plan.md` (Objective / Loop-spec / Work-phase map / Accept criteria headings) and
  `0N0_phaseN.md` stubs each carrying the DIFFLEVEL-ROADMAP-01 header ("write to
  diff-level BEFORE P>A; empty scaffolds do not satisfy the rule").
  Conventions (round 2): mirror goalplan-cli.ts:51-68 arg parsing; normalize slug via
  `deriveSlug` (freeze.ts:60); no YYMMDD helper exists — write a local one.
- Scaffold template strings must NOT contain literal TODO/FIXME/TBD tokens —
  build.mjs PLACEHOLDER_RE rejects them (audit round 1 blocker #8). Use "fill-in"
  phrasing instead.

## Ship/track requirements (ROUND 2 High #2)

`.gitignore` ignores `dist/` wholesale and dist-freshness skips UNTRACKED dist files
("untracked = doesn't ship"). New compiled outputs MUST be force-added at D:
`git add -f plugins/codexclaw/components/pabcd-state/dist/plan-gate.js
plugins/codexclaw/components/pabcd-state/dist/plan-cli.js` — otherwise a fresh
clone's orchestrate-cli.js import of `./plan-gate.js` throws ERR_MODULE_NOT_FOUND and
breaks EVERY `cxc orchestrate` call. C phase asserts tracked status
(`git ls-files --error-unmatch <both files>`).

## UX fold (ROUND 2 Low #5, adopted)

Run the plan-gate check on the P>A edge even when attest is null, so the FIRST error
names planUnit alongside `did` instead of a two-round discovery.

## TESTS (ROUND 2 Medium #3 correction)

- NEW `test/plan-gate.test.ts` (fs fixtures live here, keeping attest.test.ts no-IO):
  P>A without planUnit → fail; nonexistent dir → fail; dir without `\d{3}_*.md` →
  fail; valid tmpdir unit → ok; non-P>A edges unaffected.
- `test/attest.test.ts`: ONLY coerceAttest planUnit/planPaths coercion cases.
- `test/orchestrate-cli.test.ts`: one runOrchestrateCli P>A rejection case reusing the
  freshCwd/seedSession harness (lines 24-29).
- NEW `test/plan-cli.test.ts`: init creates folder + 000 + N stubs; refuses overwrite.

## Verification (C)

bun test; rebuild dist; standalone: `cxc orchestrate A --session <id> --attest '{...no
planUnit...}'` → non-zero + reason; with scaffolded unit → advances. Capture outputs.
