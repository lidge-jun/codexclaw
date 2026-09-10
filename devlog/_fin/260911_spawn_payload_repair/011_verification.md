# Spawn payload repair verification

The five PR #130 findings reproduced at `0b811d3f` are repaired through source
revision `26f0bc25`. The repair preserves the earlier explorer routing and discovery
guidance. It does not change role model defaults or provider retry policy.

| Failure | Result and regression evidence |
| --- | --- |
| Repeated skill expansion across items | Deduplicate over all text items; append one body set to the last text item only if the complete projected text, separators and hook prefixes fit the existing limit. Combined overflow attaches no new body and retains caller text. |
| Whitespace lost during item cleanup | Remove control tokens without trimming or collapsing item whitespace. Indented YAML, CRLF, blank/empty items and marker-bearing text retain their source whitespace; attachments and order remain intact. |
| Ignored-config warning duplicates guards | Unwrap the exact warning before checking existing guard/prompt prefixes, then restore it once. Two and three applications remain stable, including an ignored project config with a trusted global prompt. |
| Quoted dispatch marker consumes a claim | Accept only the first producer line, with exact hook-owned wrappers on reapplication. Later text/items, missing-TASK quotations, fences, skill bodies and near-match wrappers cannot issue a claim. Genuine headers retain same-tool reapplication and reject another tool's issuance. |
| Recovery advice selects explorer settings for review | Both public producers cover native reviewer, legacy explorer plus an explicit reviewer header, and hosts without an agent_type field. Their emitted instructions resolve distinct reviewer model, effort and prompt with neutral task text. |

The committed fixtures are
`components/subagent-config/test/spawn-items-boundaries.test.ts` (11 tests) and
`components/pabcd-state/test/reviewer-producer-contract.test.ts` (2 tests), both
under `plugins/codexclaw`. The latter executes public recovery producers and the
real `inferRole` to `resolveSpawnConfig` chain; a source-string check is not its
routing oracle. Two older output expectations were updated for the corrected
guidance, retaining their runtime and CRLF checks.

## Executed checks

- Baseline affected suites: 198 passed, zero failed. The initial new hook suite
  failed 7 of 9 tests before the source repair; the first two producer tests failed
  before their repair. Follow-up exact-wrapper and fieldless-host regressions also
  failed before their corresponding corrections.
- Final hook suites: 168 passed; final affected producer suites: 98 passed.
- Full suite at `26f0bc25`: 3,032 tests, 2,960 passed, zero failed, 72 skipped.
  Build compiled 179 files; gate, inventory and Linux smoke passed.
- Independent design reflection and plan audit passed after recorded amendments.
  Final independent review passed all five repairs after catching a case-insensitive
  coordinator wrapper and missing guidance for a host without an agent_type field.
- Local integration was merged, built and installed with the normal installer.
  All 13 audited source/artifact hashes matched the installed cache, including the
  unchanged local account-catalog and discovery guidance files. Doctor passed with
  all 29 hook hashes trusted.
- Tests redirected to installed compiled JavaScript passed: 11 hook cases and 2
  producer cases. The actual installed hook CLI also injected configured model and
  effort, preserved the items-only shape, image and YAML whitespace, attached one
  skill body across repeated mentions, and returned a no-op on reapplication.

Run the focused globs and repository commands in
[the implementation record](010_payload_boundaries.md). Full-suite fixtures must
use a temporary root with no Git repository in its ancestor chain. Initial runs
on this machine had four GUI root-discovery failures because the temporary parent
was itself a pre-existing Git repository. No repository or test assertion was
removed; selecting a clean temporary root made the eight affected GUI tests and
the full suite pass. Unrelated existing directories were preserved.

## Scope and evidence limits

The executor owned the two recovery source strings. During implementation, its
scope was narrowed to those strings and main took the disjoint producer tests;
main also implemented the subsequent fieldless-host correction after executor
completion. Main owned the coupled hook repair and inspected the returned diff.
This coordination adjustment did not introduce another workflow owner.

These are deterministic routing and payload checks, not a new native-model behavior
benchmark. They do not prove that every main model delegates more frequently or
that total task cost falls. The earlier behavior study remains in
[its own verification record](../260911_discovery_ownership/011_verification.md).
Coordinator wrapper recognition verifies routing; unrelated recursion-grant
lifecycle and single-message prompt reapplication were not redesigned. A new host
payload form or legitimate prefix rejected by these fixtures would require a new
compatibility case rather than broadening marker scans into task data.

Private evidence filenames include `hook-red.log`, `exact-prefix-red.log`,
`producer-red.log`, `fieldless-red.log`, their green counterparts,
`full-suite-final-source.log`, `installed-final-hashes.json`,
`installed-boundaries.log`, `installed-producer.log` and `installed-cli-smoke.json`.
Raw local paths, account data and request logs are not published. Current PR head,
hosted checks and review-thread replies are recorded on PR #130; no upstream merge
or release is included.
