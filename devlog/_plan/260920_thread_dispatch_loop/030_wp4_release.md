# 030 — wp4: release

Same procedure as 0.2.32, recorded here so the phase does not re-derive it.

1. Bump every version surface to 0.2.33: `package.json`, `cli/package.json`,
   `plugins/codexclaw/components/*/package.json`, and
   `plugins/codexclaw/.codex-plugin/plugin.json` (which carries `+codex.<timestamp>`).
   Then `node plugins/codexclaw/scripts/inventory.mjs --write --tests <measured>` and
   `node plugins/codexclaw/scripts/check-versions.mjs 0.2.33` must exit 0.
2. Republish the measured test count. CI parses `tests <n>` from the suite and compares it
   with the badge; a new test file moves that number.
3. CHANGELOG section for 0.2.33 naming the lane-loop contract and the measured bounds.
4. Commit as `chore(release): prepare codexclaw 0.2.33`, push to `dev`.
5. Promotion PR `dev -> main`; `enforce-pr-target` exempts it. Merge once checks pass.
6. Wait for CI, Packed install lifecycle and WSL to be green on the exact merge SHA.
7. `gh workflow run release.yml --ref main -f version=0.2.33 -f expected_sha=<FULL 40-char SHA>`.
   A short SHA fails the dispatch guard — that is measured, not theoretical.

## Two traps this release paid for

- **The dispatch guard compares strings, not commits.** `release.yml:91-93` tests
  `"$EXPECTED_SHA" != "$GITHUB_SHA"`, so an abbreviated SHA fails with "main moved after
  the release audit" even when `main` did not move. Measured on run `35456348666` during
  the 0.2.32 dispatch.
- **A CLI entrypoint check must not split `argv` on `/`.** Windows argv uses backslashes,
  so `import.meta.url.endsWith(argv[1].split("/").pop())` is false, the CLI body never
  runs, and the process exits 0 with no output — which reads as a passing script. Compare
  file URLs instead. Two reviewer rounds missed this; the Windows CI shards caught it
  (`39409c8d`). Any new script with a CLI needs a test that asserts it actually printed.
