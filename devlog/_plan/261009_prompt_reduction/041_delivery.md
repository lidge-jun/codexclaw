# 041 — Delivery record: PRs, release 0.2.42, deployment

## PRs (merge commits on `dev`)

| PR | Content | Head (checks) | Merge |
|---|---|---|---|
| #287 | fork-lane dispatch docs (user's PR) | `977bd116` (14/14) | `6520b7b8` |
| #288 | L1 hook injections | `eda55ed3` (13/13, enforce-target ran on open) | `a3001789` |
| #289 | standard, gate, core routers | `df7c7b34` (14/14) | `af7e9afe` |
| #290 | catalog and routers | `38330756` (14/14) | `5feda454` |
| #291 | release 0.2.42 | `db752b56` (14/14) | `417ba6f8` |
| #292 | `dev` → `main` promotion | see below | see below |

## Deployment of `dev` `417ba6f8946a100d900c1d49648fbef21e60b9b5` (0.2.42+codex.20261009045258)

Script: `evidence/deploy-host.sh` (pinned SHA, rollback capture under `~/.codexclaw-rollback/0.2.42-<UTC>/`, `dev-install.sh --no-build`, retrust, doctor, set+bytes payload compare against `git archive`, compiled SHELL-SUBST-01 deny smoke through `hook worktree-guard-pretool`). Deployed from the CI-verified `dev` SHA before the `main` promotion finished, because runners were saturated; the tree equals what `main` receives.

| Host | OS | Before | After | Trust | Payload (missing/changed/extra) | Smoke | Notes |
|---|---|---|---|---|---|---|---|
| local Mac (`~/Developer/new/700_projects/codexclaw`) | macOS | 0.2.41 @225a2a7d | 0.2.42 @417ba6f8 | PASS 32 | 0/0/0 | deny | |
| lidge | Linux | 0.2.41 | 0.2.42 | PASS 32 | 0/0/0 | deny | |
| macmini-cf | macOS | 0.2.41 | 0.2.42 | PASS 32 | 0/0/0 | deny | first run under `bash -l` could not find node (exit 127) and left 0.2.41 installed; rerun under `zsh -l` succeeded |
| clisu-oracle (= cli-jaw-server) | Linux | 0.2.41 | 0.2.42 | PASS 32 | 0/0/0 | deny | |
| suji | macOS | 0.2.41 | 0.2.42 | PASS 32 | 0/0/0 | deny | |
| desktop-c795oh4 | Windows (Git Bash) | 0.2.41 | 0.2.42 | PASS 32 | 0/0/0 | deny | |
| mini | Windows (Git Bash) | 0.2.41 | 0.2.42 | PASS 32 | 0/0/0 | deny | installer exit 1: pruning the old 0.2.41 cache failed with "Device or resource busy" (a running Codex session holds it); 0.2.42 is installed and verified; the stale directory goes away on the next install |
| intmb, win | — | — | not deployed | — | — | — | Cloudflare websocket bad handshake (same as 0.2.41) |
| oracle, cursor, ocx-ci | — | — | not deployed | — | — | — | ssh timeout (same as 0.2.41) |

Running Codex sessions keep the plugin version they started with; new threads load 0.2.42. On the local Mac the 0.2.41 cache was pruned, so this coordinator session uses the 0.2.42 CLI for its remaining FSM commands.


## Promotion and release

- #292 (`dev` → `main`): 28/28 checks on head `417ba6f8` (pull_request and push events, CI, Packed install, WSL); merged as `main` `17e23f5c6fe286eb7cafdb7491ce32c784e97886`, tree identical to `417ba6f8`.
- `main` push runs on `17e23f5c`: CI success, Packed install success (WSL was still running at dispatch).
- Release dry run 37891482501: `release verify: READY — 0.2.42 @ 17e23f5c`, `pass=3696 fail=0 total=3772` (the 76 unlisted are platform skips, as in 0.2.41).
- Publish 37891760770: success, "published v0.2.42 with 3 assets".
- Independent asset check: `shasum -a 256 -c SHA256SUMS` OK; payload unpacked vs `git archive 17e23f5c plugins/codexclaw`: 0 differences; manifest `0.2.42+codex.20261009045258`; tag `v0.2.42` → `17e23f5c`; latest release `v0.2.42`; not a prerelease.

