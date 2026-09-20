# 001 — Reinstall evidence

Superseded by `002_release_0_2_34.md` for the published build. This section records the
pre-release dev install of `aa58601e`; every host was reinstalled again at 0.2.34.

Commit `aa58601e` on `dev`, manifest `0.2.33+codex.20260920193715`. Each host pulled
`dev` fast-forward only and ran `scripts/dev-install.sh` through a login shell via
`plugins/codexclaw/scripts/remote-dev-install.sh`, then reported its own installed
version.

| Host | Before | After | Installer exit | Doctor |
|---|---|---|---|---|
| this Mac (primary checkout) | 0.2.33+codex.20260920025749 | 0.2.33+codex.20260920193715 | 0 | PASS |
| macbookpro-2 (same Mac, `~/Developer/codexclaw`) | 0.2.33+codex.20260920193715 | 0.2.33+codex.20260920193715 | 0 | PASS |
| suji | 0.2.33+codex.20260920025749 | 0.2.33+codex.20260920193715 | 0 | FAIL — 5 hook-trust records need approval |
| mini (Windows, git-bash) | 0.2.33+codex.20260920025749 | 0.2.33+codex.20260920193715 | 0 | WARN — python not runnable for ast-grep |
| macmini | 0.2.33+codex.20260920025749 | unchanged | — | not run — unreachable |

`macbookpro-2` is this machine reached over ssh. It has a second checkout at
`~/Developer/codexclaw` and shares one `~/.codex` plugin cache, so its row records the
checkout being fast-forwarded, not a second install. That run repointed the local
marketplace at the second checkout; the primary checkout's `dev-install.sh` was run
again afterwards to point it back, and both trees were at `aa58601e`, so the payload is
the same either way.

`macmini` is offline: Tailscale reports it last seen nine hours ago, and the
`macmini-cf` cloudflared route fails its websocket handshake. Nothing was installed
there and its previous install is untouched.

`suji`'s doctor FAIL is the same hook-trust state recorded in
`260920_thread_dispatch_loop/041`: four hooks with no trust record and one whose
recorded hash changed. The host excludes untrusted hooks from execution until the user
approves them, and no session can grant that. It is not a failed install — the host
reports the expected version and the installer exited 0.

The payload was read back rather than assumed: `VIZ-VERIFY-SCALE-01` occurs in
`~/.codex/plugins/cache/codexclaw/codexclaw/0.2.33+codex.20260920193715/skills/dev-visualizer/SKILL.md`
on this Mac, `suji` and `mini`.

## Hosts with nothing to reinstall

`clisu-oracle`, `clisu-oracle-public`, `desktop-c795oh4`, `lidge` and `intmb` answered
and have no codexclaw install. `cursor`, `oracle`, `ocx-ci` and `win` did not answer and
were not known to carry one. Installing where codexclaw was never installed would be a
new deployment, not a reinstall.

## Suite note

`npm test` is 3318/3322 with one pre-existing failure: `gui/test/router.test.ts` cannot
resolve `react` because the gui workspace dependencies are not installed in this
checkout. It fails identically without this change, which touches markdown, the manifest
version and `inventory.json` only.
