# 260719 CI Green Hardening — Done (Terminal: DONE)

## Evidence

- CI run 29692503272 on `main` (b4be8c17): `test (ubuntu-latest): success`, `test (windows-latest): success`, conclusion `success`. Previous state: ubuntu 3 failures / windows ~45 failures (run 29688404179).
- Local macOS `npm test`: 1147 pass / 0 fail (twice: pre-push b and pre-push final).
- Commits: `01ae4f37` fix(ci) cross-platform test hardening (25 files), `b4be8c1` fix(ci) final 3 windows failures (3 files).

## What closed each cluster

| Cluster | Fix | Commit |
|---------|-----|--------|
| ubuntu: 2 spawn e2e + uninstall no-op | stale test contracts synced to 260713 surface-split + per-platform service contracts | 01ae4f37 |
| windows: retrustHooks x6 | .bak ISO colon sanitize (`replace(/:/g, "-")`) | 01ae4f37 |
| windows: F1 dist-freshness, frontmatter x2, TOML | `.gitattributes` `* text=auto eol=lf` | 01ae4f37 |
| windows: EPERM x55 (adapter/gateway/db tests) | teardown order stop -> db.close -> rmRfRetry | 01ae4f37 |
| windows: L18/L19/L15/v2-compose/parseServeArgs/resolveGoalsDbPath/ladder | path normalization + pathToFileURL | 01ae4f37 + b4be8c1 |
| windows: /cwd ~ literal, retrust CLI shim | semantic home assertion; win32 skip with rationale | b4be8c1 |

## Pessimist record (LOOP-PESSIMIST-01)

- **Not improved**: `repoMapVenvPython` still emits `bin/python3` on win32 (real uv venvs use `Scripts/`). Test now mirrors platform output instead of fixing the product question — follow-up candidate: `cxc map` Windows runtime correctness.
- **Coverage trade-off**: `hooks retrust CLI reports...` is skipped on win32 (fake sh shim not executable on NTFS). The CLI stdout-reporting surface has no Windows coverage; direct `retrustHooks` tests cover behavior on all platforms.
- **Process**: 1 of 6 dispatched subagents (T5 first dispatch) retired silent after 20+ min with zero edits; re-dispatch as two smaller scopes succeeded. CI verification took 2 push rounds, not 1 — the first round surfaced 3 residuals the local-only pre-check could not see (documented in acceptance as a known gap: no local Windows smoke).
