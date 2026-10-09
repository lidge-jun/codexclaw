# wp5 — release 0.2.42 and deploy

Reuses the 0.2.40 delivery procedure (`../260930_issue_train/040_wp4_delivery.md`) and the 0.2.41 host deployment (rollout 2026-10-06, hosts below). Fresh evidence at every step.

## Delivery of each implementation PR (wp2, wp3, wp4)

1. Branch from the latest `origin/dev` (wp2 branch = `codex/prompt-reduction`, which carries this unit's docs); later phases branch after the previous PR merges.
2. Local gates: `npm run build`; focused tests via `cxc receipt test`; `npm test` (TAP total from a 0-failure run); `inventory.mjs --write --tests <total>` then `--check`; `gate.mjs`; `platform-smoke.mjs`.
3. Privacy self-check on the push range, per the amendment below (pattern supplied outside the repository).
4. Push, `gh pr create --base dev --body-file`; read hosted CI on the exact head per DEV-CI-EVIDENCE-01; `gh pr merge --merge --match-head-commit <head>`.

## Release

1. Branch `codex/release-0242` from `origin/dev`. Version `0.2.41 → 0.2.42` in every file found by `rg --hidden -l '0\.2\.41' --glob '!.git' --glob '!CHANGELOG.md' --glob '!devlog/**' --glob '!node_modules/**'` (package.json, package-lock.json workspace entries, cli, gui, components/*); `plugin.json` `0.2.42+codex.<UTC stamp>`; inventory and badges via `inventory.mjs --write --tests <total>`.
2. CHANGELOG `[0.2.42] - <UTC date>`: Changed — layering standard and prompt-architecture gate; shorter L1 injections (with measured before/after); core and router skills restructured; descriptions trimmed; loop CLI mutation receipts; DISPATCH-FORK-LANE-01 from #287. Compatibility: no hook identity changes, so no retrust; scripts that parsed the full plan from `loop add-*` output must call `cxc loop show`.
3. `check-versions.mjs 0.2.42`; PR to dev; exact-head CI; merge. Promotion PR `dev → main` "Release codexclaw 0.2.42"; exact-head CI; merge commit; main push CI and Packed install green.
4. `gh workflow run release.yml --ref main -f version=0.2.42 -f prerelease=false -f dry_run=true -f expected_sha=<main sha>` → `release verify: READY`; then `dry_run=false`. Download assets, `shasum -a 256 -c SHA256SUMS`, payload vs `git archive <sha> plugins/codexclaw`; tag points at main SHA; latest release.

## Deploy

- Local Mac: the user's dev checkout install path used for 0.2.41 (resolved at wp5 P from the 0.2.41 rollout); verify `~/.codex/plugins/cache/codexclaw/codexclaw/0.2.42+codex.*` and hook trust via `cxc doctor`.
- SSH hosts that ran 0.2.41: lidge, macmini-cf, clisu-oracle, suji, mini, desktop-c795oh4 via `plugins/codexclaw/scripts/remote-dev-install.sh <host>` (with `--shell bash` / `--path` per host as in 0.2.41), after `--check`. Hosts unreachable in 0.2.41 (intmb, win, oracle, cursor, ocx-ci) are retried once with `--check` and reported.
- Per-host evidence: installed version, hook trust count PASS, payload match. Existing sessions pick up 0.2.42 in new threads.

## Accept criteria

c-4, c-5, c-6 captured with PR numbers, SHAs, run ids, release URL, asset verification and the per-host table in `041_delivery.md`.


## Amendments after A round 1

- Blocker 7 / R3. No committed file contains the scan pattern. At run time main writes `/tmp/cxc-privacy.pat` (GitHub token shape, API-key shape, and home-directory paths of any user other than the maintainer) and runs `git log -p origin/dev..HEAD -- . ':(exclude)devlog/_plan/261009_prompt_reduction/research/02_audit_round1.md' ':(exclude)devlog/_plan/261009_prompt_reduction/research/04_audit_round2.md' | rg -P -i -f /tmp/cxc-privacy.pat`, which must exit 1. The two excluded reports quote the old literal pattern while reviewing it (the 0.2.40 precedent excluded its own command doc the same way); they are checked by eye. Task identifiers are added if any appear (all research sources are public repositories).
- Blocker 8. Deploy pins the intended dev SHA (the dev merge SHA that `main`'s release contains) apart from the release main SHA. Per host: `remote-dev-install.sh <host> --check` first; a dirty or off-dev checkout is reported and skipped, never reset. After install, run on the host and record: checkout HEAD equals the intended SHA; installed cache dir `0.2.42+codex.*`; payload compare of the installed cache against the checkout's `plugins/codexclaw` (tracked files, `git ls-files` + `cmp`); `cxc doctor` hook trust lines (PASS count); and the compiled risky-substitution deny smoke used for 0.2.41 (pipe a PreToolUse Bash payload containing a `$(git push)` substitution to the installed pabcd-state hook and expect `permissionDecision: deny`). Installer exit 0 alone is not PASS.
- Nits. Version replacement inspects test fixtures that merely contain the old version string and leaves them; `npm ci` runs before the TAP total is recorded.

## wp5 P revalidation (2026-10-09)

Continuity, quoting the wp4 D summary: "Next: deliver PR C, then wp5 (release 0.2.42 and deploy), then wp6." State: #288 (`a3001789`) and #289 (`af7e9afe`) are merged to `dev`; #290 is open with CI running; `main` is 0.2.41 (`96e8d5ce`). Release starts after #290 merges.

Deploy procedure, re-read from the 0.2.41 record (rollout summary 2026-10-06, Task 4): on each host, in its codexclaw dev checkout, fast-forward to `origin/dev` at the intended SHA (refuse if dirty or off `dev`; never reset), run `scripts/dev-install.sh --no-build` (dist is tracked), then `node <installed cache>/bin/cxc.mjs hooks retrust`, then verify: installed cache directory `0.2.42+codex.*`, checkout HEAD equals the intended SHA, tracked payload compare (cache vs `git ls-files plugins/codexclaw`, excluding runtime artifacts such as `.DS_Store`, `.codexclaw`, GUI build output and Python caches), `cxc doctor` hook-trust PASS, and the compiled risky-substitution deny smoke. `remote-dev-install.sh <host>` wraps the checkout/install half; the verification half runs as a separate read-only ssh script per host because the installer masks doctor failures.

Hosts (`~/.ssh/config`): lidge, macmini-cf, clisu-oracle (cli-jaw-server is the same machine), suji, desktop-c795oh4, mini succeeded for 0.2.41; intmb and win (Cloudflare websocket) and oracle, cursor, ocx-ci (timeouts) failed and are retried once with `--check`. Local Mac: the marketplace root reported by `codex plugin marketplace list` (recorded at B), same steps.

No new design decision: no architect consultation (the 0.2.40 release precedent). Stop conditions: a red check on an exact head, a release dry run that is not READY, an asset mismatch, or a host whose checkout is dirty/off-dev (reported and skipped).


## Amendments after wp5 A (research/17_audit_wp5.md, NEAR-PASS)

- R1 (SHA pin before install). The host procedure is a single ssh script (`evidence/deploy-host.sh`, written at B, run with `bash -l -s` over ssh): `git fetch origin`; refuse if the checkout is dirty or not on `dev`; refuse unless `git merge-base --is-ancestor HEAD <SHA>` and `git rev-parse origin/dev` contains `<SHA>`; `git merge --ff-only <SHA>` (the frozen full SHA, never moving `origin/dev`); `scripts/dev-install.sh --no-build`; `hooks retrust` through the installed cache's `bin/cxc.mjs`. `remote-dev-install.sh` is not used for 0.2.42 because it pulls moving `origin/dev` and rebuilds.
- R2 (payload set equality). Verification compares the installed cache directory with `git archive <SHA> plugins/codexclaw` unpacked to a temp dir: both file sets and bytes, recording missing, changed and unexpected counts; allowlist for runtime artifacts only: `.DS_Store`, `.codexclaw/`, `__pycache__/`, `*.pyc`, `gui/dist/`, `node_modules/`. PASS needs 0/0/0.
- R3 (rollback). Before install the script copies the current cache directory (`~/.codex/plugins/cache/codexclaw/codexclaw/<old version>`) and `~/.codex/config.toml` to `~/.codexclaw-rollback/0.2.42-<UTC>/` on that host. Restore: copy the saved cache directory back, restore `config.toml`, run `hooks retrust` from the restored cache, and run the same doctor and deny smoke. A host that fails verification is restored, then reported.
- Nit. After the version bump: `check-versions.mjs 0.2.42`, plus `rg` for leftover `0.2.41` (excluding CHANGELOG, devlog and fixture paths), `npm ls --workspaces --depth=0` to check cli, GUI and lock entries; doctor output must contain hook-trust PASS with a nonzero count.

