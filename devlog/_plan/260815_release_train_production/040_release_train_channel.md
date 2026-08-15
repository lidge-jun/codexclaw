# 040 — Release train channel

Status: PLANNED — work-phase wp4

## Loop spec

- Archetype: spec-satisfaction repair
- Trigger: no workflow can publish a release; CI omits macOS and never tests the
  installed product (003)
- Goal: an executable release train — exact-head verification, gate, payload build,
  publication — plus CI lanes that test the artifact and the install
- Non-goals: cutting the actual release (050)
- Verifier: real GitHub Actions runs on the exact head SHA, green
- Stop condition: every new job has a green run id recorded
- Memory artifact: this doc + run ids in the candidate manifest
- Terminal outcomes: DONE on green runs; BLOCKED if Actions is unavailable
- Escalation: if the real-Codex install lane cannot authenticate on a runner,
  degrade it to the artifact lane and record the limitation rather than claiming
  install coverage

## Lane split

003 established what CI can honestly prove without the `codex` binary. The train
therefore has four lanes:

- `ci.yml` — source regression on ubuntu, windows, macos
- `packed-install.yml` artifact job — payload build, dist freshness, archive, dispatcher smoke, residue simulation (no `codex` needed)
- `packed-install.yml` install job — real `codex` marketplace add/plugin add/retrust/upgrade/remove
- `release.yml` — exact-head verification, gate, archive, publish

### Lane 1 — `ci.yml` extension

`os: [ubuntu-latest, windows-latest, macos-latest]`, unchanged steps plus
`node plugins/codexclaw/scripts/inventory.mjs --check`.

macOS is added because it is the primary development platform and currently the
only untested one — a path-case or BSD-tool difference would ship undetected.

### Lane 2 — artifact job (no `codex` needed)

Runs on all three OSes:

1. `npm ci` then `node plugins/codexclaw/scripts/build.mjs` (validates manifest,
   hook/MCP targets, skill layout, placeholder scan)
2. dist freshness: `git diff --exit-code plugins/codexclaw/components/*/dist`
   after a rebuild — proves committed output matches source
3. archive `plugins/codexclaw/` into `codexclaw-payload-<sha>.tar.gz`, emit
   `SHA256SUMS`
4. extract into a temp dir and run the payload dispatcher with no `cxc` on PATH
   (mirrors `payload-bin.test.mjs`): `node <extracted>/bin/cxc.mjs orchestrate status`
5. fake-home residue simulation: copy the payload into a temp home, run the
   uninstall residue assertion, confirm zero leftovers

### Lane 3 — install job (needs `codex`)

Ubuntu + macOS first; Windows once those are green. Shape:

- `npm install -g @openai/codex@0.147.0`
- a temp home in `$RUNNER_TEMP`, exported as `CODEX_HOME` per command
- `codex plugin marketplace add "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY" --ref "$GITHUB_SHA"`
- `codex plugin add codexclaw@codexclaw`
- `cxc hooks retrust --key codexclaw@codexclaw --codex-home <home> --bootstrap-ok`
- `cxc doctor --json`
- upgrade: re-add at the previous release ref, then back to HEAD, retrust again
- `codex plugin remove codexclaw@codexclaw` then a residue assertion over the home

`--ref "$GITHUB_SHA"` is what makes this certify a specific commit rather than a
moving branch. `continue-on-error` is deliberately **not** used: a lane that cannot
fail is not evidence. If `codex` proves unusable on runners, the job is removed and
the limitation recorded in the release notes — a green job that silently skipped is
worse than an absent one.

### Lane 4 — `release.yml`

Triggers: `workflow_dispatch` (version + prerelease inputs) and `push.tags: v*`.
Permissions `contents: write`, concurrency group `release` without cancellation.

Steps: resolve the exact SHA, query `ci.yml` and `packed-install.yml` conclusions
**for that SHA** via `gh api` (not "latest run"), run `cxc release init/receipt/platform`,
run `cxc release verify` (fails closed), build and archive with checksums,
`gh release create` attaching the payload archive, `SHA256SUMS` and the candidate
manifest, then re-read the release via API and assert the assets exist.

## PLAN-VERIFIER-REAL-01

| Command | Exists today | Reads this change? |
| --- | --- | --- |
| `gh workflow run` / `gh run watch` | yes | yes — it executes the new files |
| `actionlint` | not installed | syntax only; not a substitute for a run |
| `npm test` | yes | no — no test reads workflow YAML |

The only real verifier for this phase is executing the workflows. Any claim of
"workflow correct" without a run id is unverified.

## Bypass record

- Tier: E8; executing surface: `release.yml`
- Known bypass: manual `gh release create` or the GitHub UI
- Residual risk: high — no tag protection or rulesets exist (003)
- Wording downgrade: yes. Final enforcement layer: none; a tag ruleset is the
  recommended follow-up and is out of scope here.

## Accept criteria

1. `ci.yml` green on ubuntu, windows and macOS at the exact head SHA (3 run ids).
2. Artifact job green on all three OSes.
3. Install job green, or removed with a recorded reason — never green-because-skipped.
4. `release.yml` runs against an incomplete candidate and **fails** at the verify
   step, then succeeds in 050.

Criterion 4 is the activation scenario for the whole phase: a release workflow that
has never refused anything has not been shown to gate.

## A-gate amendments (see `004_audit_amendments.md`)

**No PATH `cxc` in the install lane (004 #6).** A marketplace install does not put
`cxc` on PATH — `README.md:74-80` and `cxc-resolve.ts:4-14` both say so. The lane
resolves the installed plugin root and runs `node "<plugin-root>/bin/cxc.mjs" ...`,
and first asserts that `command -v cxc` **fails**. That assertion is the activation
proof that the lane exercises the installed payload rather than the checkout.

**Committed dist is stale today (004 #7).** `git diff --exit-code
plugins/codexclaw/components/*/dist` currently exits 1, and rerunning
`build.mjs` regenerates exactly `cxc-ops/dist/cli.js` and `dist/doctor.js` — i.e.
the working tree's pre-existing modifications are the *correct* output and HEAD's
committed dist lags source. 010 commits that regenerated output (preserving the
existing edits) before this lane is introduced; otherwise a clean GitHub checkout
fails the freshness step on arrival.

**Build before verify (004 #5).** The job order is build -> archive -> record
receipts -> verify -> publish, so no receipt is verified before the step that earns
it.

**No optional install lane (004 #9).** An install lane that cannot run makes the
phase BLOCKED. It is never silently dropped, and `continue-on-error` is not used.
