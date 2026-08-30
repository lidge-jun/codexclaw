# 040 wp5 — publish the 0.2.16 GitHub Release

Depends on: 030. The version bump, the commits, and the `dev`→`main` promotion all
landed (main at `aaf0e70a`, 0.2.16). What did NOT happen is the GitHub Release: the
last published tag is `v0.2.13`, so 0.2.14, 0.2.15 and 0.2.16 exist as code and as an
installed plugin cache but not as a release artifact.

## Why the release workflow refuses

A dry run of `release.yml` at 0.2.16 (run `33285027088`) failed closed at
"Verify the release gate":

```
version kind: stable
release verify: NOT READY — 1 blocker(s):
  - published tests=2026 but the measured suite reported 2271
```

That is rule 5 in `release-gate.ts:371-385`: the number the docs publish must equal
the number the suite actually measured on the candidate commit. The chain is:

1. `README.md` / `README.ko.md` / `README.zh.md` carry a shields.io badge
   `badge/tests-2%2C026_passing`.
2. `inventory.mjs` `PUBLISHED_SURFACES` parses that badge as the published tests
   count and `--published` prints it.
3. `release.yml` feeds that value to `release inventory --published-tests`, which
   stores it as `manifest.publishedCounts.tests`.
4. The gate compares it against `testSuite.total` measured by `npm test` in the
   same job.

So the blocker is a genuine stale-doc report, not a gate defect. The badge was last
synced when the suite had 2,026 tests; the suite has grown to 2,271 since.

## Which number is correct: 2271, not 2273

A local `npm test` reports **2273**, the release job measured **2271**. The
difference is NOT platform skew and must not be papered over:

- The user's worktree carries an uncommitted edit to
  `components/cxc-ops/test/ast-grep.test.ts` that adds two tests
  (5 → 7 `test(` calls).
- Re-running the suite in a detached worktree at `HEAD` (`cb677571`) with the CI
  environment (`CODEXCLAW_SKIP_REPOMAP_SMOKE=1 CI=1`) reports `tests 2271`,
  `pass 2270`, `fail 0`, `skipped 1` — exactly what CI measured.

The badge describes the shipped tree, so **2271** is the honest value. Writing 2273
would make the badge describe an unpublished local edit and would re-break the gate
on the next release.

## Why a number fix alone is not enough

`inventory.mjs --check` (run in CI at `ci.yml:43`) cross-checks published **skills**
and **hooks** against the payload, and `readPublished()` catches the three READMEs
disagreeing *with each other* — but nothing compares the tests badge to a real suite
result. The count does not exist until a suite has run, so the script cannot derive
it the way it derives skills and hooks. That asymmetry is why skills/hooks badges
cannot drift while the tests badge drifted for three versions and was first caught by
the release job, after the build and after the promotion to `main`.

### The guard cannot be an ordinary test (audit blocker 2)

The first draft of this plan proposed a test asserting "the badge equals the number
`node --test` reports". That is not implementable:

- The root test script is one glob over every suite (`package.json:24`), so a test
  that shells out to `npm test` to learn the total re-invokes its own glob —
  unbounded recursion.
- Excluding itself from that inner run makes it both very slow and dishonest: it
  would no longer measure the suite that actually ships.
- Any *committed* total is refused by design: `inventory.json` deliberately stores
  no test count, and `inventory.test.mjs:58-66` asserts that absence. A checked-in
  number would be a second source of truth, which is the drift class this whole
  mechanism exists to prevent.

So the guard belongs where the number already arrives from outside: the checker takes
the measured total as an argument.

### The guard also cannot hardcode 2,271 (audit blocker 1)

Adding any file under the test glob changes the total, so a badge fixed at 2,271 in
the same commit that adds a new test is wrong on arrival. The badge is therefore
written LAST, from a measurement of the final tree, and the number here is
descriptive rather than a target.

## Change map

| File | Change |
|------|--------|
| `plugins/codexclaw/scripts/inventory.mjs` | `check()` accepts an optional `expectedTests`; when supplied, a published tests count that differs is a violation. New CLI form `--check --tests <total>` |
| `.github/workflows/ci.yml` | tee the existing `npm test` output, parse its TAP `tests` total, and pass it to `inventory.mjs --check --tests <total>` — one measurement, no second suite run |
| `plugins/codexclaw/test/inventory.test.mjs` | NEW tests: a wrong-but-self-consistent badge across all three READMEs is a violation when a measured total is supplied, and the matching total passes |
| `README.md`, `README.ko.md`, `README.zh.md` | tests badge + `alt` text 2,026 → the final measured total, via `inventory.mjs --write --tests <total>` |
| `CHANGELOG.md` | note the badge correction and the new drift check under 0.2.16 |

`--write` also rewrites `plugins/codexclaw/inventory.json` unconditionally (audit
blocker 4). It is byte-clean today, so the expectation is that the file does not
change; if it does, that is a real inventory drift to inspect, not noise to commit.

### The CI capture must not swallow a failing suite (audit residual)

The CI matrix runs Windows twice (`ci.yml:13-27`) and the current `- run: npm test`
step uses the platform-default shell, which is PowerShell on `windows-latest`.
Piping `npm test` into a log there would report success even when the suite fails,
because PowerShell does not propagate a pipeline's exit status the way
`set -o pipefail` does. Turning a red suite green is a far worse defect than the
stale badge this unit is fixing.

The capture step is therefore pinned to `shell: bash` (available on all three
runners) with `set -euo pipefail` and `tee`, mirroring the release workflow's
existing measurement (`release.yml:74-85`). Bash on the Windows runner keeps
running the same `npm test` under the same Node, so the matrix still tests the
platform, not the shell. The parse reuses the release workflow's TAP expression so
one grammar serves both callers, and a missing/unparseable total fails the step
instead of silently passing an empty argument.

### What actually broke on Windows, and the amendment (C-phase finding)

Pinning bash was necessary but not sufficient. CI run `33286176438` failed both
windows jobs at "Run the suite" while reporting `tests 2273`, `fail 0`,
`skipped 7` — a suite that had passed. The reused expression was the defect:

```
grep -Eo '^. tests [0-9]+'
```

`node --test` prefixes its summary with `ℹ`, which is three UTF-8 bytes, and `^.`
only spans that under a multibyte-aware locale. Git bash on the windows runners
runs under `C`, where the pattern matches nothing; ubuntu's UTF-8 locale is why the
release workflow never showed it. Proved directly:

```
LC_ALL=en_US.UTF-8 grep -Eo '^. tests [0-9]+'  ->  ℹ tests 2273
LC_ALL=C           grep -Eo '^. tests [0-9]+'  ->  (no match)
LC_ALL=C           grep -Eo 'tests [0-9]+$'    ->  tests 2273
```

With no match the total came back empty and `set -e` killed the step at the grep,
before the explicit emptiness check could name the problem. Two amendments:

1. Anchor on the value (`tests [0-9]+$`) instead of the leading glyph, in BOTH
   workflows — `release.yml` carries the same latent bug and would hit it the day it
   runs anywhere but ubuntu. On a real 2,300-line log that pattern matches exactly
   one line, the summary, because a test title never ends that way.
2. Add `|| true` to the capture so a miss reaches the explicit check and reports
   "could not parse a test total" instead of dying anonymously.

New file `plugins/codexclaw/test/suite-summary-parse.test.mjs` extracts every
summary pattern from both workflow files and runs it under `C` and `en_US.UTF-8`,
asserting identical matches and that the digits read are the summary's rather than a
test title's trailing number. Restoring the old anchor makes it fail on any machine,
so this cannot regress silently again.
IN scope: the published tests count and its protection. OUT of scope: the badge
*mechanism* (shields.io markup, `PUBLISHED_SURFACES`), the gate rule in
`release-gate.ts`, the version numbers, historical counts in `CHANGELOG.md` and
`docs-site` (audit: do not mechanically rewrite those), and anything under
`devlog/` other than this unit.

## Accept criteria

1. `inventory.mjs --check --tests <wrong>` exits non-zero naming the drift;
   `--check --tests <measured>` exits 0. Bare `--check` keeps its old behavior, so
   no existing caller breaks.
2. The new tests FAIL when the badge disagrees with the supplied total and PASS when
   it agrees — mutation-proved by reverting the production change, not assumed.
3. `npm test` is green and its final `tests` total equals the badge in all three
   READMEs.
4. The release workflow dry run at 0.2.16 passes "Verify the release gate".
5. A real (non-dry) run publishes `v0.2.16` with the payload tarball, `SHA256SUMS`,
   and the candidate manifest attached.

### Activation scenario for the new guard

The conditional path is "published tests count disagrees with the measured total".
C triggers it in a scratch tree: rewrite the badge to a wrong value in all three
READMEs — self-consistent, so today's `--check` passes it — then run the check with
the real measured total. The observable effect is a violation naming the published
and measured numbers. Without the all-three mutation the test would pass vacuously
through the existing cross-surface check instead of exercising the new comparison.

## Risk

Low. One script function gains an optional argument, one CI line, two tests, three
doc lines. The release workflow is dispatched dry-run first, and the real run only
publishes a tag and assets; it does not touch `main`'s tree.
