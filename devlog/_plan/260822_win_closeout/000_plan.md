# 260822 win closeout - campaign closeout roadmap

The 11-cycle win/linux campaign (devlog/_plan/260821_win-linux-optimization) closed its
goalplan, but it left the repository in a state that cannot ship:

- The `test (windows-latest, false)` CI cell is RED on the newest dev commit.
- The `enforce-target` check fails on every PR and blocks the release promotion path.
- GitHub issues #32 and #33 are open, both Windows-only defects filed during the campaign.
- No v0.2.7 release exists. `origin/main` and `origin/dev` both carry version 0.2.7 in
  the tree, but the newest tagged release is v0.2.6, so nothing shipped.

This unit closes all four before cutting the release.

## Work phases

| id | doc | scope |
|----|-----|-------|
| wp01-win-ci-red | 010 | telegram photo-download test race on windows runners |
| wp02-symlink-tests | 020 | issue #32: goalplan symlink guards vs unprivileged Windows |
| wp03-hook-trust | 030 | issue #33: hook trust registration + retrust spawn on win32 |
| wp04-enforce-target | 040 | enforce-pr-target workflow: promotion exemption + 403 tolerance |
| wp05-dual-verify | 050 | native Windows + WSL Ubuntu full suites |
| wp06-release | 060 | push dev, promote to main, publish v0.2.7 |

## Success criteria

1. CI is green on windows-latest, ubuntu-latest and macos-latest for the head of dev.
2. The goalplan symlink tests run on a stock non-admin Windows checkout.
3. `cxc hooks retrust` runs on Windows without spawnSync EPERM.
4. A dev -> main promotion PR passes the enforce-target check.
5. The component suite passes natively on Windows and under WSL Ubuntu.
6. `main` carries 0.2.7 and a v0.2.7 GitHub release exists.
