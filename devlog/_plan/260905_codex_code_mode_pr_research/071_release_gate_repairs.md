# Release gate repair: dependency lock and measured counts

Scope: release readiness of the integrated candidate, not new product behavior.
The original run and audit remain recorded; no threshold, test or trust bypass.

## Dependency evidence and bounded update

The current lock has two vulnerable transitive packages. Primary advisories opened
2026-09-06: [Browserslist cache](https://github.com/advisories/GHSA-c83g-rgw3-j3cx),
[Browserslist stats](https://github.com/advisories/GHSA-73wf-gq98-2v4g), and
[nanoid generator](https://github.com/advisories/GHSA-2v37-7h3g-55p8).
Patched lower bounds are browserslist4.28.7 and nanoid3.3.18.

MODIFY package-lock.json only for the security repair: on a disposable exact-source
macmini checkout, run `npm update browserslist nanoid --package-lock-only --ignore-scripts`.
Review resolved package/version/integrity changes; reject unrelated updates or new
direct dependencies. Keep package.json ranges unchanged. Verify with fresh npm ci,
full tests and npm audit --audit-level=high; retain JSON audit and SBOM artifacts.
This is a separately identifiable lock-only commit, not a blanket npm audit fix.
It shares the integration delivery PR because publication is blocked until the
same frozen candidate is verified, but no application feature is mixed into it.

## Runtime and count corrections

Use Node24, the version family explicitly configured in CI and Release. The failed
Node22 attempt is preserved as a limitation, not retried into a Node22 PASS.
The full original candidate succeeds on24:2521 total,2520pass,0fail,0cancelled,
1 deliberate repo-map smoke skip. The first logs named release-integrated-* were
actually this unintegrated baseline after git apply refused stale index entries;
they must not vouch for the merged source. Use a fresh clone of the published
integration SHA for its proof; do not reuse that ambiguous working directory.

MODIFY only existing generated count surfaces via inventory.mjs --write --tests N
after measuring the actual integrated full suite. N is not guessed and passing
counts never include cancelled tests. Do not alter the existing skip policy.
The generator owns inventory.json and README/docs published count blocks.

Plan audit: Gauss PASS. N denotes the successful full run's total tests, not its
passes. The current generator updates inventory.json and the three root READMEs;
do not imply it rewrites arbitrary docs-site blocks.

Observed lock-only update: browserslist4.28.4 ->4.28.9 and nanoid3.3.16 ->3.3.18;
the other five updates are browserslist's declared data/database dependencies
(baseline-browser-mapping, caniuse-lite, electron-to-chromium, node-releases,
update-browserslist-db). No package.json/direct-dependency change. Fresh audit
JSON reports0 vulnerabilities. This is dependency resolution proof, not yet a
post-update full-suite or final release PASS.

Verification: exact source SHA/tree, clean generated dist after remote build,
full-suite exit0, measured inventory check, gate, existing platform/packed/WSL CI,
independent interdiff review, then the release workflow's own gate.
