# 070 — Scoped receipt requirements, and closing the holes the audit found

Status: PLANNED — work-phase wp7 (rewritten after the A gate)

## The trigger

v0.2.0-beta.1 is published, but the releases page still shows **v0.1.0 as Latest**,
because GitHub never promotes a prerelease. To a visitor nothing shipped. Cutting a
stable `0.2.0` is blocked by our own gate:

```text
release verify: NOT READY — 9 blocker(s):
  - activation-baseline deferred: target: MLB 1.0, not required for 0.2.x
  ... 8 more, identical shape
```

Every reason already says *not required for 0.2.x*. The prose knows; the schema
cannot express it, so a 1.0-scoped receipt blocks a 0.2 release.

## What the audit found underneath

Auditing that fix surfaced three defects in **already-shipped** code, one of which
makes a claim I previously made too strong. Verified against `dist/release-gate.js`:

```text
EMPTY RECEIPT ARRAY on a 1.0.0 candidate:
  schemaErrors: []
  gate       : {"ready":true,"blockers":[]}
```

`isReleaseReady` only inspects receipts that *happen to exist*. A candidate with
`receipts: []` passes. So "the gate refuses a release without its evidence" was true
only for receipts the manifest chose to list. Closing this is now part of this phase,
not a follow-up.

And the workflow's prerelease classifier is a substring test:

```text
case $VERSION in *-*)   =>   prerelease
  0.2.0-beta.1            -> prerelease=true    correct
  1.0.0                   -> prerelease=false   correct
  1.0.0+build-with-hyphen -> prerelease=true    WRONG — build metadata, still stable
  1.0.0-rc.1              -> prerelease=true    correct as a label, but see below
```

A stable `1.0.0+build-with-hyphen` would receive `--allow-deferred` and could skip
all nine MLB receipts.

## Design

### 1. Scope, expressed as a policy in code — not as manifest data

`RequiredReceipt` gains `requiredFrom?: string`, and the nine MLB receipts declare
`requiredFrom: "1.0.0"`. Critically, the manifest copy is **not** trusted: `verify`
reads the canonical policy from `RECEIPT_POLICY` (name → `{requiredFrom}`) in
`release-gate.ts` and rejects any manifest whose receipt disagrees with it.

Otherwise a hand-written `--candidate` file could carry
`requiredFrom: "9999.0.0"` and excuse its own evidence. No CLI setter is added.

### 2. Obligation threshold, not SemVer precedence

A receipt is **due** when the candidate's `major.minor.patch` core is >= the
`requiredFrom` core. Prerelease identifiers are deliberately ignored **for this
decision**:

| Candidate | vs `1.0.0` | 1.0 receipts |
| --- | --- | --- |
| `0.2.0-beta.1` | core `0.2.0` < `1.0.0` | not due |
| `0.2.0` | `<` | not due |
| `0.9.0` / `0.10.0` | numeric, `0.10.0 > 0.9.0` | not due |
| **`1.0.0-rc.1`** | core `1.0.0` >= `1.0.0` | **DUE — blocks** |
| `1.0.0` | `>=` | due |
| `1.0.0+build` | metadata ignored | due |
| malformed / absent | — | **fail closed**: invalid version is a blocker |

The `1.0.0-rc.1` row is the whole reason this is a threshold rather than ordinary
precedence. Under SemVer `1.0.0-rc.1 < 1.0.0`, so a naive comparison would let a 1.0
release candidate skip exactly the evidence 1.0 is defined by. An rc of 1.0 is part
of the 1.0 line and owes 1.0 evidence.

### 3. The canonical receipt set is required

`validateCandidateManifest` gains a completeness check: the manifest's receipt names
must equal `TRAIN_RECEIPT_NAMES ∪ MLB_RECEIPT_NAMES` exactly — no omissions, no
duplicates, no unknown names. `receipts: []` becomes a validation failure instead of
a pass.

### 4. One SemVer parser, shared with the workflow

`parseVersion` is exported and `release.yml` uses it instead of the `*-*` glob:

```bash
node bin/codexclaw.mjs release classify --version "$VERSION"   # prints: stable | prerelease
```

That value drives both `--allow-deferred` and `gh release create --prerelease`, so the
label on GitHub and the gate's leniency can never disagree.

### 5. The payload must not lie about its own version

The repo still declares `0.2.0-beta.1` in `package.json`, the plugin manifest, eight
component packages and `inventory.json`. Publishing `v0.2.0` from that tree would ship
an archive labelled beta. wp8 bumps them, and `release.yml` gains an assertion that
the embedded versions equal the release version before it publishes.

## Not doing: relabel the existing beta

`gh release edit v0.2.0-beta.1 --prerelease=false --make-latest` would flip the page
today. Rejected: the tag and every embedded version string say `0.2.0-beta.1`, so
marking it the stable current release would misrepresent the artifact — the same
class of dishonesty this whole unit exists to remove. A correctly versioned `0.2.0`
is the honest path.

## PLAN-FIELD-CHAIN-01 — `requiredFrom`

| Stage | Path |
| --- | --- |
| creation | `RECEIPT_POLICY` + `MLB_1_0_RECEIPTS` literals; `release init` copies them |
| serialization | receipt object in the candidate JSON |
| validation | must parse **and** equal `RECEIPT_POLICY[name].requiredFrom` |
| consumers | `isReleaseReady` due-check only |

`verify --json` does **not** emit receipts, so it is not a consumer — the earlier draft
claimed it was, which was wrong.

`TRAIN_RECEIPTS` carry no `requiredFrom`: due for every release, always.

## File change map

| Path | Change |
| --- | --- |
| `release-gate.ts` | `requiredFrom`; `parseVersion`/`compareCore`/`isPrerelease`; `RECEIPT_POLICY`; completeness + policy-match validation; due-check; invalid version blocks |
| `release-cli.ts` | `classify` verb; no `--required-from` setter |
| `release-gate.test.ts` | threshold table, empty/duplicate/unknown/forged receipts, malformed version |
| `release-cli.test.ts` | `init` seeds policy; 0.2.0 verifies with no flag; 1.0.0 does not |
| `release.yml` | use `classify`; assert embedded versions match |

## Accept criteria

| # | Criterion | Activation |
| --- | --- | --- |
| 1 | 1.0-scoped deferral does not block 0.2.0 | complete candidate, no flag → `READY` |
| 2 | the same receipts block `1.0.0` | same candidate at 1.0.0, no flag → blocked, named |
| 3 | **`1.0.0-rc.1` also blocks** | rc candidate → blocked |
| 4 | `receipts: []` is rejected | validation error, not `ready:true` |
| 5 | forged `requiredFrom` rejected | `9999.0.0` on a due receipt → policy-mismatch error |
| 6 | a due deferral still blocks | deferred train receipt → blocked |
| 7 | `missing` never scope-excused | MLB receipt `missing` on 0.2.0 → blocked |
| 8 | classifier correct | `1.0.0+build-with-hyphen` → `stable`; `1.0.0-rc.1` → `prerelease` |
| 9 | no regression | existing 33 release tests + `npm test` green |

Criteria 2, 3 and 4 are load-bearing: if any stops blocking, the change removed the
guarantee instead of scoping it.

## `--allow-deferred` does not reach a due receipt (A-gate r2 #1)

The rewrite made `1.0.0-rc.1` *due*, then classified it `prerelease` and handed it
`--allow-deferred` — which today skips **every** deferred receipt unconditionally
(`release-gate.ts`: `if (options.allowDeferred) continue;`). The two rules would have
cancelled out and the 1.0 line would still ship without its evidence.

Precedence is now explicit:

```text
deferred receipt
  ├─ requiredFrom set AND candidate core < requiredFrom core  -> not due, skipped (scope)
  └─ otherwise                                                -> DUE, blocks
                                                                 even with --allow-deferred
```

`--allow-deferred` keeps exactly one job: excusing a receipt that is due when the
maintainer knowingly ships without it — the beta case. It can no longer excuse a
receipt that has reached its `requiredFrom`, so no classification path can hand a 1.0
candidate a pass. Scoped not-yet-due receipts need no flag at all; their exemption
is automatic.

Criterion 3 is amended to run **with** `allowDeferred: true`, and a chain test walks
the real workflow path: `classify 1.0.0-rc.1` → `prerelease` → `verify --allow-deferred`
→ blocked, naming the nine receipts.

## Version-surface assertion, stated precisely (A-gate r2 #2)

"Embedded versions equal the release version" was too literal: `plugin.json` carries
`+codex.<timestamp>` build metadata by design (050), so `0.2.0+codex.20260815...`
would never string-equal `0.2.0` and the legitimate release would be impossible.

The assertion compares **SemVer core + prerelease**, ignoring build metadata:

| Surface | Must equal | Metadata |
| --- | --- | --- |
| `package.json` | `0.2.0` exactly | none allowed |
| 8 component `package.json` | `0.2.0` exactly | none allowed |
| `plugin.json` | core+prerelease `0.2.0` | `+codex.<stamp>` permitted |
| `inventory.json` `plugin.*Version` | mirrors the two above | as above |

wp8 file surfaces, previously missing from the map:
`package.json`, `plugins/codexclaw/.codex-plugin/plugin.json`,
`plugins/codexclaw/components/*/package.json`, `plugins/codexclaw/inventory.json`,
`CHANGELOG.md`.

Added acceptance criteria:

| # | Criterion | Activation |
| --- | --- | --- |
| 10 | a correctly bumped 0.2.0 tree passes the assertion | run it post-bump → exit 0 |
| 11 | a stale beta surface fails it | leave one component at `0.2.0-beta.1` → non-zero, naming the file |
| 12 | build metadata does not fail the assertion | `plugin.json` `0.2.0+codex.<stamp>` → passes |

Round 2 also confirmed the closures hold: the core threshold has no 1.0-line
exemption (`alpha`/`rc`/stable/patch/build variants all core `>= 1.0.0`); exact canonical
names close the empty-array, omission, duplicate and unknown-name holes; and
`RECEIPT_POLICY` equality prevents `requiredFrom` forgery despite arbitrary JSON input.

## A-gate round 1 (FAIL — 6 blockers, all folded)

| # | Sev | Disposition |
| --- | --- | --- |
| 1 | High | folded — `*-*` glob misclassifies `1.0.0+build-with-hyphen` as prerelease, which would hand it `--allow-deferred`. Replaced by a shared `classify` verb driving both the flag and the GitHub label. |
| 2 | High | folded — obligation is now a **core-version threshold**, so `1.0.0-rc.1` owes 1.0 evidence. Ordinary SemVer precedence would have exempted it. |
| 3 | High | folded — `requiredFrom` is canonical in `RECEIPT_POLICY` and a manifest that disagrees is rejected, so a hand-written candidate cannot excuse itself. |
| 4 | High | folded — **pre-existing hole**, reproduced: an empty receipt array verified `ready:true` on a 1.0.0 candidate. Validation now requires the exact canonical set. |
| 5 | High | folded — wp8 bumps every embedded version and `release.yml` asserts they match before publishing. |
| 6 | Medium | folded — `verify --json` removed from the chain (it emits no receipts), criterion 5's inverted wording fixed, negative cases added. |

Also recorded from the same round: this repo is `private: true` with no `npm publish`,
so "deploy" here means the GitHub Release payload, not a package registry.
