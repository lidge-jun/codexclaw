# 004 — A-phase audit synthesis and plan amendments

Status: ANALYZED — round 1, verdict FAIL (13 blockers), all folded or rebutted below

Reviewer: independent sol/medium explorer, read-only, re-ran ancestry, counts,
gate/badge checks, CLI help, dist freshness, and GitHub metadata. It confirmed the
research facts (28 skills / 21 hooks both sides / 8 components; all 12 sampled
drift line references contained the claimed stale text; `marketplace add --ref`,
`plugin remove`, `doctor --json`, `hooks retrust --bootstrap-ok --codex-home` are
all real flags on codex-cli 0.146.0).

## Root causes (REVIEW-SYNTHESIS-01)

Three causes generated most of the thirteen:

1. **Provenance modeled as a commit SHA.** Binding a committed file to its own
   commit is circular. Real fix: provenance belongs to CI receipts, not to a
   committed artifact.
2. **Planning from the payload dispatcher while a second, root dispatcher exists.**
   `payload-bin.test.mjs:36-45` enforces parity between them, so any new verb must
   land in both.
3. **Treating the current tree as clean.** Committed `dist` is stale relative to
   source; the working tree's modifications are the *correct* regenerated output.

## Dispositions

| # | Sev | Disposition | Amendment |
| --- | --- | --- | --- |
| 1 | Critical | **folded** | `inventory.json` no longer stores a test count or a SHA. Test totals live only in the CI-produced candidate manifest (`testSuite`), never in a committed file. Inventory keeps identities only, so it is commit-independent and converges. |
| 2 | High | **folded** | Scope gains `bin/codexclaw.mjs`; `release` is routed in both dispatchers, satisfying the parity test. |
| 3 | High | **folded** | Field chains rewritten below for every new field, with one canonical name each. |
| 4 | High | **folded** | `--version` (or `--candidate <path>`) required on `receipt`, `platform`, `verify`; zero/multiple candidates are explicit errors. |
| 5 | High | **folded** | Build precedes verification. The workflow builds and archives first, records the `build` receipt from that step, and `verify` runs immediately before publication. |
| 6 | High | **folded** | The install lane never calls a PATH `cxc`. It resolves the installed plugin root and runs `node "<plugin-root>/bin/cxc.mjs"`, and asserts `command -v cxc` fails first — which is also the activation proof that it is testing the installed payload rather than the checkout. |
| 7 | High | **folded** | Verified: `node plugins/codexclaw/scripts/build.mjs` regenerates exactly `cxc-ops/dist/cli.js` and `dist/doctor.js`, i.e. the working tree's pre-existing modifications ARE the correct output and HEAD's committed dist is stale. 010 commits the regenerated dist (preserving, not discarding, the user's edits) before 040 introduces the freshness lane. |
| 8 | High | **folded** | 020's marker map extended to `getting-started/installation.md`, `guides/native-tools.md`, `docs/*.md`, `plugins/codexclaw/skills/README.md`. Unknown or missing marker ids are `--check` failures. |
| 9 | High | **folded** | An install lane that cannot run is **BLOCKED**, not optional. The `packed-install-lifecycle` receipt stays mandatory; only its `evidence` may name the artifact lane if the install lane is genuinely impossible, and that substitution is recorded in the published manifest. |
| 10 | High | **rebutted, with a correction** | The PR-target workflow does gate `main`, but the repo does not promote by PR: `origin/main` and `origin/dev` are the *same commit* (`15b3d44a`) and `gh pr list --base main --state merged` returns `[]`. Promotion here is a fast-forward push of `dev` to `main`, which is the established mechanism and touches no PR automation. 050 amended accordingly. |
| 11 | Medium | **folded** | PR #1 merged `2026-08-09T01:18:41Z` (`gh pr view 1`), not 2026-07-27. 001 corrected. |
| 12 | Medium | **folded** | Scope boundary extended: `CHANGELOG.md`, `.gitignore`, `plugins/codexclaw/inventory.json`, `plugins/codexclaw/bin/cxc.mjs`, `bin/codexclaw.mjs`, `plugins/codexclaw/components/*/package.json`, `plugins/codexclaw/.codex-plugin/plugin.json` (exact path). |
| 13 | Medium | **folded** | Exact verifier commands recorded in 050 and 010 (below). |

## Amended field chains (replaces 020 §chain and 030 §chain)

`CandidateManifest.testSuite { pass, fail, measuredSha }`

| Stage | Path |
| --- | --- |
| creation | `release.yml` step parsing `npm test` output into `cxc release receipt --name test-suite` |
| serialization | candidate JSON `testSuite` |
| deserialization | `readCandidate()` + `validateCandidateManifest` (type + non-negative ints + sha format) |
| consumers | `isReleaseReady` (`fail > 0` is a blocker; `measuredSha !== candidateSha` is a blocker), release notes renderer |

`CandidateManifest.inventoryHash`

| Stage | Path |
| --- | --- |
| creation | `inventory.mjs --hash` (sha256 over canonical JSON) invoked by `release.yml` |
| serialization | candidate JSON `inventoryHash` |
| deserialization | `validateCandidateManifest` (string, `sha256:` prefix) |
| consumers | `isReleaseReady` recomputes from the checkout and blocks on mismatch |

`RequiredReceipt.capturedSha` / `capturedAt`

| Stage | Path |
| --- | --- |
| creation | `cxc release receipt/platform` from `--sha` (defaults to `GITHUB_SHA`) and `new Date().toISOString()` |
| serialization | receipt object in candidate JSON |
| deserialization | `validateCandidateManifest` — a `present` receipt missing either field is invalid |
| consumers | `isReleaseReady` staleness blocker; `verify --json` report; release notes provenance table |

No `release-manifest.ts` exists or is created; the earlier reference was wrong.
`measuredCommit` (inventory) is deleted entirely — provenance lives only in the
candidate manifest as `measuredSha`.

## Amended verifiers (replaces 010 criterion 5 and 050 verifier line)

```bash
# 010 criterion 5 — every inline-code path in structure/INDEX.md exists
rg -o '\`([a-zA-Z0-9_./-]+/[a-zA-Z0-9_./-]+)\`' -r '$1' structure/INDEX.md \
  | sort -u | while read -r p; do [ -e "$p" ] || echo "MISSING: $p"; done

# 050 — release assets and tag binding
gh release view v0.2.0-beta.1 --repo lidge-jun/codexclaw --json tagName,assets,targetCommitish
gh api repos/lidge-jun/codexclaw/git/ref/tags/v0.2.0-beta.1 --jq .object.sha

# 050 — this unit's issues are closed
for n in 24 25 26 27 28; do gh issue view "$n" --repo lidge-jun/codexclaw --json number,state; done
```

The 010 loop is run **before** the corrections (must print the `_plan/mvp_*`
misses) and **after** (must print nothing). A run that prints nothing both times
is not evidence the check works.

## Residual, accepted

- No branch or tag protection exists, so every gate in this unit remains an early
  warning rather than enforcement. Recorded in each bypass block; a tag ruleset is
  a follow-up, out of scope here.
