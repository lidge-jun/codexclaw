# 030 — Executable release gate

Status: PLANNED — work-phase wp3 (issue #26). Rewritten after A-gate round 2.

## Loop spec

- Archetype: spec-satisfaction repair
- Trigger: `release-gate.ts` defines a manifest schema that nothing produces or
  enforces (#21 landed types only)
- Goal: a CLI that assembles a candidate manifest from real receipts and refuses
  publication when any receipt is missing, stale, or bound to another SHA
- Non-goals: creating the workflows that call it (040), publishing (050)
- Verifier: `npm test` plus both CLI paths run locally against fixtures
- Stop condition: refusal and acceptance both demonstrated with captured output
- Memory artifact: this doc + `.codexclaw/release/candidate-<version>.json`
- Terminal outcomes: DONE when the fail-closed path is observed firing

## What already exists

`components/pabcd-state/src/release-gate.ts` ships `CandidateManifest`,
`validateCandidateManifest`, `isReleaseReady`, and `MLB_1_0_RECEIPTS`.
`isReleaseReady` already blocks on non-present receipts, requires Ubuntu plus one
more platform, and rejects platform rows whose `testedSha` differs from
`candidateSha`. Nothing produces, stores, or invokes any of it.

## Schema v2

```ts
interface RequiredReceipt {
  name: string; source: string; status: ReceiptStatus;
  evidence?: string; deferredReason?: string;
  capturedAt?: string;      // NEW - RFC3339
  capturedSha?: string;     // NEW - commit the receipt was measured on
}
interface TestSuiteEvidence { pass: number; fail: number; measuredSha: string; }
interface CandidateManifest {
  // ...existing fields
  inventoryHash?: string;          // NEW - sha256: of canonical inventory.json
  testSuite?: TestSuiteEvidence;   // NEW
  publishedCounts?: {              // NEW - what the docs currently claim
    tests: number; skills: number; hooks: number;
  };
}
```

### Blocker rules added to `isReleaseReady`

1. A `present` receipt missing `capturedSha` or `capturedAt` is invalid.
2. `capturedSha !== candidateSha` → `"<name> captured on <sha>, candidate is <sha>"`.
3. `testSuite.fail > 0` → blocker; `testSuite.measuredSha !== candidateSha` → blocker.
4. `inventoryHash` recomputed from the checkout must match.
5. **Published-count binding (004r2 #2, measured — 004r3 #3):** the counts come from
   `inventory.mjs --published`, which parses each registered marker surface and fails
   if the surfaces disagree with each other, so the comparison is never tautological.
    `publishedCounts.tests !== testSuite.pass`,
   or `publishedCounts.skills/hooks` differing from the inventory, is a blocker. This
   is what stops a release shipping a fresh test receipt beside a stale public badge —
   the exact silent drift 001 documented.

## CLI: `cxc release <verb>`

| Verb | Full syntax |
| --- | --- |
| `init` | `cxc release init --version <v> [--candidate <output-path>] [--sha <sha>]` — writes `.codexclaw/release/candidate-<v>.json` seeded with the full receipt set (see below) |
| `receipt` | `cxc release receipt (--version <v> | --candidate <path>) --name <n> --evidence <e> [--sha <sha>] [--status present|failed|deferred] [--reason <r>]` |
| `platform` | `cxc release platform (--version <v> | --candidate <path>) --platform ubuntu|windows|macos --sha <sha> --ci-run <id> [--passed|--failed]` |
| `tests` | `cxc release tests (--version <v> | --candidate <path>) --pass <n> --fail <n> --sha <sha>` — sets `testSuite` |
| `inventory` | `cxc release inventory (--version <v> | --candidate <path>) --hash <sha256:...> --skills <n> --hooks <n> --published-tests <n>` — sets `inventoryHash` and `publishedCounts` |
| `verify` | `cxc release verify (--version <v> | --candidate <path>) [--json] [--allow-deferred]` — exit 1 on any blocker |

Selector semantics (004r4 #2):

- `init` always requires `--version <v>` (it is the manifest body). `--candidate` is
  optional there and names the **output path** to create; without it the path is
  `.codexclaw/release/candidate-<v>.json`.
- The other five verbs operate on an existing candidate and take `--version <v>`
  **or** `--candidate <path>`, mutually exclusive. `--version` resolves the default
  path; zero matches and multiple matches are both explicit errors (004 #4).

The dedicated `tests` and `inventory` verbs exist because generic `receipt --evidence`
cannot populate typed top-level fields (004r2 #1).

### Receipts for this train

`init` seeds **both** sets so the manifest is complete from creation (004r3 #9):

- six train receipts, status `missing`: `inventory-sync`, `test-suite`, `gate`,
  `build`, `packed-install-lifecycle`, `platform-ci`
- the nine `MLB_1_0_RECEIPTS`, status `deferred`, each with a `deferredReason` taken
  from a table in `release-cli.ts` ("target: MLB 1.0, not required for 0.2.x").
  `validateCandidateManifest` rejects a `deferred` receipt with an empty reason, and
  `verify` refuses deferred receipts unless `--allow-deferred` is passed, which is itself
  recorded in the manifest. `packed-install-lifecycle`
is **not** satisfiable by artifact-lane evidence: if the real install lane cannot
run, the release is BLOCKED (004 #9, tightened in round 2).

## File change map

| Path | Change |
| --- | --- |
| `components/pabcd-state/src/release-gate.ts` | schema v2, five blocker rules, `allowDeferred` |
| `components/pabcd-state/src/release-cli.ts` | NEW — six verbs, atomic writes, candidate resolution |
| `components/pabcd-state/src/cli.ts` | route `release` |
| `plugins/codexclaw/bin/cxc.mjs` | add `release` to `COMMAND_TABLE` |
| `bin/codexclaw.mjs` | add the `release` case + help line — **required** by `payload-bin.test.mjs:36-45` parity (004 #2) |
| `components/pabcd-state/test/release-gate.test.ts` | extend: stale sha, missing `capturedSha`, inventory mismatch, published-count mismatch, deferred |
| `components/pabcd-state/test/release-cli.test.ts` | NEW — round-trip per verb, exit codes, zero/multi candidate errors |
| `plugins/codexclaw/test/payload-bin.test.mjs` | (no edit — it already enforces parity; it must stay green) |
| `.gitignore` | ignore `.codexclaw/release/` working candidates |

## Field chains (PLAN-FIELD-CHAIN-01)

| Field | Creation | Serialization | Deserialization / validation | Consumers |
| --- | --- | --- | --- | --- |
| `testSuite` | `cxc release tests` (040 parses `npm test` output) | candidate JSON | `validateCandidateManifest`: ints ≥ 0, sha format | `isReleaseReady` rules 3 and 5, release notes |
| `inventoryHash` | `cxc release inventory --hash $(inventory.mjs --hash)` | candidate JSON | `sha256:` prefix check | `isReleaseReady` rule 4 |
| `publishedCounts` | `inventory.mjs --published` parses every registered publication surface and prints the measured triple; `cxc release inventory` stores it | candidate JSON | int triple; disagreement between surfaces is a generator error before it reaches the CLI | `isReleaseReady` rule 5 |
| `capturedSha` / `capturedAt` | `receipt`/`platform` from `--sha` (default `GITHUB_SHA`) and `toISOString()` | receipt object | `present` requires both | `isReleaseReady` rules 1-2, `verify --json` |

No `release-manifest.ts` exists or is created. The inventory artifact carries no
commit SHA or test count (020).

## Bypass record (PLAN-BYPASS-NAMED-01)

- Tier: E8; executing surface: the `verify` step inside `release.yml` (040)
- Known bypass: publishing manually through the GitHub UI, which never calls the gate
- Residual risk: high until tag protection exists (003: none configured)
- Wording downgrade: yes — "the release train enforces the gate", never "releases
  cannot bypass the gate". Final enforcement layer: **`protect-release-tags`**
  (ruleset `20884836`, added 2026-08-15) — and only partially. Rulesets protect refs,
  not the Releases API: `gh release create` by hand still skips `release verify`.
  What is now enforced is that such a release cannot re-point or delete an existing
  `v*` tag, so published evidence cannot be rewritten after the fact.

## Accept criteria + activation scenarios

| # | Criterion | Activation scenario |
| --- | --- | --- |
| 1 | fresh candidate refuses | `init` then `verify` → exit 1 listing every receipt |
| 2 | complete candidate accepts | all receipts + 3 platforms + tests + inventory on one sha → exit 0 |
| 3 | SHA mismatch refuses | platform with a different sha → exit 1 naming it |
| 4 | stale receipt refuses | receipt `capturedSha` ≠ candidate → exit 1 |
| 5 | inventory mismatch refuses | mutate `inventory.json`, re-verify → exit 1 |
| 6 | published-count drift refuses | `publishedCounts.tests` ≠ `testSuite.pass` → exit 1 |
| 7 | candidate selection errors | `verify` with no candidate, and with two candidates and no `--version` → distinct errors |
| 8 | both dispatchers route | `node bin/codexclaw.mjs release verify --version x` and `node plugins/codexclaw/bin/cxc.mjs release verify --version x` behave identically; `payload-bin.test.mjs` stays green |

Each row is observed as a real CLI invocation. Unit tests prove the predicate; the
CLI runs prove it is wired.
