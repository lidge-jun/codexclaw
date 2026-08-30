# 030 wp4 — release the fix

Depends on: 010, 020. Nothing here is executable until both have landed.

## What "release" means in this repo

Both `package.json` and `cli/package.json` are `"private": true`, so there is no
npm publish step. The release commit `05db9d07` shows the actual procedure: every
version surface moves together, the inventory is regenerated, and the changelog
gains a section. The shipped artifact is the plugin cache under
`$CODEX_HOME/plugins/cache/codexclaw/codexclaw/<version>+codex.<stamp>/`, which is
what a running session loads.

Version surfaces touched by `05db9d07` (the list to mirror):

```
CHANGELOG.md                                        package.json
cli/package.json                                    package-lock.json
plugins/codexclaw/.codex-plugin/plugin.json         plugins/codexclaw/inventory.json
plugins/codexclaw/gui/package.json                  components/*/package.json  (8 components)
```

That is the full 15-file set `git show --name-only 05db9d07` reports; the audit
caught `CHANGELOG.md` missing from the first draft of this list. `package-lock.json`
moves only because it mirrors the workspace version strings — if a future bump
leaves it untouched, that is not an error.

**Two surfaces are NOT script-covered (audit blocker 3).** `collectSurfaces()` in
`check-versions.mjs:42-64` yields 12 entries: `package.json`, `plugin.json`, the 8
components, and the two `inventory.plugin.*` keys. It never reads
`cli/package.json` or `plugins/codexclaw/gui/package.json`, both at 0.2.15 today.
Bumping the covered ten and forgetting those two makes the script print OK at
exit 0 over an inconsistent release — the exact failure this doc's Bypass section
claimed was caught. Verify those two by reading them back manually.

`plugins/codexclaw/scripts/check-versions.mjs` verifies they agree, but it takes
the expected version as a required argument — bare invocation prints
`usage: check-versions.mjs <release-version>` and does nothing. Run it as
`node plugins/codexclaw/scripts/check-versions.mjs 0.2.16`. (Verified by running
it: bare invocation exits with the usage line.)

## Steps

1. `npm run build` — regenerate `dist` for the changed component. The runtime
   loads `dist`, not `src`, so an unbuilt fix ships as no fix.
2. `npm test` — full suite, not just the new file.
3. Bump to `0.2.16` across every surface above; run
   `node plugins/codexclaw/scripts/check-versions.mjs 0.2.16`.
4. `node plugins/codexclaw/scripts/inventory.mjs` to regenerate `inventory.json`.
5. CHANGELOG: a `0.2.16` section naming the user-visible change — new goalplans
   declare v1 and can be completed; v2/v3 remain opt-in and still gated.
6. Commit. Per DEV-GIT-PUSH-01 the push is a separate decision; the user approved
   release for this fix, so the scope is this fix's commit and nothing else.
7. Verify the installed artifact, not the source: the plugin cache directory for
   the new version exists, `cxc --version` reports it, and a freshly created
   goalplan declares `"schemaVersion": 1`.

## Note on new `dist` files

If the build emits a `dist` artifact git has not tracked before, `git add -f` is
required — `dist` is ignored, and a missing runtime file is invisible until a
session loads the plugin and fails.

## Accept criteria

1. `npm run build` exits 0 and `dist/goalplan.js` contains the new default.
   Activation: grep the built file for `DEFAULT_NEW_SCHEMA_VERSION`.
2. `npm test` exits 0.
3. `check-versions.mjs 0.2.16` exits 0 after the bump, AND `cli/package.json` plus
   `gui/package.json` are read back by hand, since the script does not cover them.
4. The commit exists and its sha is recorded in the D summary.
5. The installed runtime reports 0.2.16 and a new `cxc loop init` writes
   `"schemaVersion": 1`. Activation: run both commands and paste the output.

## Bypass

Release mechanics, not enforcement. The one real risk is a partial bump: some
surfaces at 0.2.16 and others at 0.2.15. `check-versions.mjs` is an early warning,
not enforcement — anyone can skip it, and it covers only 12 of the 14 version
surfaces. Residual risk: a skipped run, or a bump that misses `cli/` or `gui/`,
ships mismatched metadata with a green check.

## dist is committed, and a test enforces it (audit blocker 5)

`dist/` is gitignored but ~149 dist files are force-tracked, and
`plugins/codexclaw/test/dist-freshness.test.mjs` asserts the committed `dist` is
byte-identical to a fresh compile of `src`. Two consequences for this unit:

- Editing `src` without rebuilding AND committing `dist` fails that test, with a
  message about stale artifacts rather than about this change.
- 020's accept criterion 3 (grep the shipped artifact for `--lane`) only means
  anything AFTER `npm run build`; `dist/goalplan.js:1528` still contains the old
  string until then.
