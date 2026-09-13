# Report publication pipeline

Status: DONE (implementation and local verification; remote publication verified after commit)

The report route will preserve evidence and third-party voice before typography, and refuse to label skipped PDF checks as passing. Existing report assets and the visualizer entrypoint remain the owners; no extra public skill or dependency is installed.

## Scope and boundaries

- User authorized implementation, local commits and a push to the CodexClaw remote. No merge, release, dependency installation, account change or unrelated file changes.
- Isolated task branch starts from origin/main `9e279a45`; original checkout is untouched.
- C3 compact development process with an independent Aside research/review lane. Native session probe reported CODEX_THREAD_ID absent and hooksVerified false: no native goal or PABCD continuation is claimed.
- Public reference captures and machine-specific font files stay outside Git. Only original guidance, sample data and reproducible checks enter the push.

## Structural decision

Current: SKILL.md routes to report-writing/document-pdf/visual-design and one CLI script owning browser print, TOC and PDF heuristics. Call-site search (`export-paged-report`, `quality-gate.mjs`, `font-manifest`, `claims.json`, `report-model`) found no existing report contract or font-manifest runtime.

Chosen: keep one entrypoint; colocate publication contract, font binding and optional browser adapter under dev-visualizer/scripts. The CLI depends on those modules; none depends on the CLI. This is a feature-local boundary.

Rejected: adding many public micro-skills (routing duplication), copying a consultancy's assets, changing the engine family, or installing a driver. The available Playwright package may be used explicitly; the CLI remains available as a labelled unverified fallback.

## Dependency-ordered changes

1. `010_export_integrity.md`: reproduce NOT_RUN/PASS, fail closed, validate PDF/tool results, resolve full TOC titles without prefix guesses; focused runtime regressions.
2. `020_report_contract.md`: explicit readiness and local font manifest; claims and hash-bound delivery receipts; negative tests for missing/stale evidence.
3. `030_editorial_assets.md`: third-party voice, answer-first progression, page-role CSS/catalog, consistent illustrative template, source ledger; real PDF and rendered-page review.

## Completion criteria

- Missing tools, failed subprocesses, unresolved TOC, stale receipts and broken font requirements cannot produce PASS.
- Report wording rules apply to reader-facing reports/briefs independent of page count, without inflating one-figure explainers.
- Font files are never vendored; local required weights/versions/hashes can be bound and verified.
- Existing command shape is retained; additional requirements and exit codes are documented.
- Focused tests, affected suite, build/gate and actual PDF smoke are freshly recorded.
- Exact committed SHA equals pushed branch SHA. Main is not merged and no release is claimed.

## Closeout

All three scoped units are implemented. Final verification is recorded in
`040_verification.md`; no source behavior changed after the green full-suite run.
Publication is to the isolated task branch only. No main merge, release or
installation into the original checkout is implied.
