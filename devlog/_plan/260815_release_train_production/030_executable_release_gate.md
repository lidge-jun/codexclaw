# 030 — Executable release gate

Status: PLANNED — work-phase wp3

## Loop spec

- Archetype: spec-satisfaction repair
- Trigger: `release-gate.ts` defines a manifest schema that nothing produces or
  enforces (issue #21 landed types only)
- Goal: a CLI that assembles a candidate manifest from real receipts and refuses
  publication when any receipt is missing, stale, or bound to another SHA
- Non-goals: creating the workflows that call it (040), publishing (050)
- Verifier: `npm test` (new tests) + both CLI paths run locally with fixtures
- Stop condition: refusal and acceptance both demonstrated with captured output
- Memory artifact: this doc + `.codexclaw/release/candidate-<version>.json`
- Terminal outcomes: DONE when the fail-closed path is observed firing
- Escalation: none

## What already exists

`components/pabcd-state/src/release-gate.ts` ships `CandidateManifest`,
`validateCandidateManifest`, `isReleaseReady`, and `MLB_1_0_RECEIPTS` (nine
receipts, all `status: "missing"`). `isReleaseReady` already blocks on non-present
receipts, requires Ubuntu plus one more platform, and rejects platform rows whose
`testedSha` differs from `candidateSha`.

What is missing: nothing **produces** a manifest, nothing **stores** it, no CLI
surfaces it, and the schema has no notion of receipt freshness or inventory binding.

## Design

### Schema additions (`schemaVersion` 1 → 2)

```ts
interface RequiredReceipt {
  name: string; source: string; status: ReceiptStatus;
  evidence?: string; deferredReason?: string;
  capturedAt?: string;      // NEW — RFC3339
  capturedSha?: string;     // NEW — the commit the receipt was measured on
}
interface CandidateManifest {
  ...
  inventoryHash?: string;   // NEW — sha256 of inventory.json (020)
  testSuite?: { pass: number; fail: number; measuredSha: string };  // NEW
}
```

PLAN-FIELD-CHAIN-01 for `capturedSha`:

| Stage | Path |
| --- | --- |
| creation | `release-cli.ts` `addReceipt()` from `--sha` / CI env |
| serialization | candidate JSON on disk |
| deserialization | `readCandidate()` (JSON.parse + `validateCandidateManifest`) |
| consumers | `isReleaseReady` staleness rule; the `verify` CLI report; 040's workflow gate step |

A receipt whose `capturedSha` is not `candidateSha` becomes a blocker
`"<name> captured on <sha>, candidate is <sha>"`. Absent `capturedSha` on a
`present` receipt is also a blocker — otherwise the field is optional in a way that
lets an unverifiable receipt through, which is the failure mode this phase exists
to remove.

### CLI: `cxc release <verb>`

Routed through the payload dispatcher (`bin/cxc.mjs` maps verbs to components;
`release` → `pabcd-state`).

| Verb | Behavior |
| --- | --- |
| `init --version <v> [--sha <sha>]` | writes `.codexclaw/release/candidate-<v>.json` seeded with `MLB_1_0_RECEIPTS` + the release-train receipts, all `missing` |
| `receipt --name <n> --evidence <e> [--sha] [--status]` | records one receipt with `capturedAt`/`capturedSha` |
| `platform --platform <p> --sha <sha> --ci-run <id> --passed` | records platform evidence |
| `verify [--json]` | runs `validateCandidateManifest` + `isReleaseReady`; **exit 1 on any blocker** |

Receipt set for the 0.2.0-beta.1 train (narrower than `MLB_1_0_RECEIPTS`, which
targets 1.0): `inventory-sync`, `test-suite`, `gate`, `build`,
`packed-install-lifecycle`, `platform-ci`. MLB receipts not yet produced are
carried as `deferred` with a reason, and `deferred` remains a blocker for 1.0 while
being explicitly allowed for a `-beta` version via `--allow-deferred`, which is
recorded in the manifest itself so the published artifact states what it skipped.

## File change map

| Path | Change |
| --- | --- |
| `components/pabcd-state/src/release-gate.ts` | schemaVersion 2, `capturedAt`/`capturedSha`/`inventoryHash`/`testSuite`, staleness + inventory blockers, `allowDeferred` |
| `components/pabcd-state/src/release-cli.ts` | NEW — the four verbs, atomic writes |
| `components/pabcd-state/src/cli.ts` | route `release` |
| `plugins/codexclaw/bin/cxc.mjs` | map `release` → `pabcd-state` |
| `components/pabcd-state/test/release-gate.test.ts` | extend: stale sha, missing capturedSha, inventory mismatch, deferred handling |
| `components/pabcd-state/test/release-cli.test.ts` | NEW — init/receipt/platform/verify round-trip, exit codes |
| `.gitignore` | ignore `.codexclaw/release/` working candidates |

## Bypass record

- Tier: E8; surface: the `verify` step inside `release.yml` (040)
- Known bypass: publishing a release manually through the GitHub UI, which never
  calls the gate
- Residual risk: high until branch/tag protection exists (003: none configured)
- Wording downgrade: yes — "the release train enforces the gate", not "releases
  cannot bypass the gate". Final enforcement layer: none today; recorded as a
  follow-up for tag rulesets.

## Accept criteria + activation scenarios

| # | Criterion | Activation scenario |
| --- | --- | --- |
| 1 | fresh candidate refuses | `init` then `verify` → exit 1, every receipt listed |
| 2 | complete candidate accepts | record all receipts + 3 platforms on one sha → exit 0 |
| 3 | SHA mismatch refuses | record a platform with a different sha → exit 1 naming it |
| 4 | stale receipt refuses | receipt `capturedSha` ≠ candidate → exit 1 with the stale message |
| 5 | inventory mismatch refuses | change `inventory.json`, re-verify → exit 1 |
| 6 | deferred is explicit | `--allow-deferred` passes but the manifest records the deferral |

Every row must be observed as a real CLI invocation, not asserted by unit test
alone — the unit tests prove the predicate, the CLI runs prove it is wired.
