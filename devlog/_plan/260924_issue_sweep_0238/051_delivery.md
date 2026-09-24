# wp6 delivery: codexclaw 0.2.38

v0.2.38 is published and is the latest release: https://github.com/lidge-jun/codexclaw/releases/tag/v0.2.38 (stable, not a draft, published 2026-09-24T07:41:02Z). It is the first published release containing the 0.2.37 changes. The 0.2.37 release run 35826473652 had only been a dry run, and no v0.2.37 tag exists.

| Step | Evidence |
|---|---|
| PR to dev | #242, head 490168dc, 14/14 checks success (CI 35965352446, Packed install 35965352454); squash-merged as 5956f698 |
| dev at 5956f698 | push CI 35965807342, Packed install 35965807329, WSL 35965807349 all success |
| Promotion PR | #244 (dev → main) first failed one Windows shard (run 35967186837, job 107528324658): session-binding.test.ts pinned that JS `realpathSync` throws on an extended-length cwd, and Node 24.21.0 on runner image 20260922.246.2 now reads it. Fixed in #245 (squash 28f7921d); the product fix, `realpathSync.native`, is unchanged. |
| dev at 28f7921d | push CI 35968364657 failed once on macOS: hook-observation.test.ts spawnSync hit its 10 s timeout (status null at 10.1 s) with a 4 MiB input. The rerun of the failed job (attempt 2) succeeded. Packed install and WSL success. #244 PR checks at 28f7921d all success. |
| main | #244 merged with a merge commit as 92d26a608180e9e3aa84c5c7650efb6a43924c2b; push CI 35969633345, Packed install 35969633308 success (WSL 35969633327 was still running at dispatch; release.yml does not require it) |
| Release dry run | 35970335275, expected_sha 92d26a60: `release verify: READY — 0.2.38`, version kind stable, tests pass=3523 fail=0 total=3599 |
| Release publish | 35970653157 success; tag v0.2.38 → 92d26a60 |
| Assets | SHA256SUMS, candidate-0.2.38.json, codexclaw-payload-0.2.38.tar.gz; `shasum -a 256 -c SHA256SUMS` OK; the extracted payload equals `git archive 92d26a60 plugins/codexclaw` (0 differing, 0 missing, 0 extra files) |
| Issues | #240, #241, #239 closed as completed with evidence comments; #232 had already been closed as superseded at 06:12Z and received the release pointer; #191 closed as not planned in wp1 |

Residuals: the Windows premise change has no hosted run on Node 24.21 yet, because every shard containing that test drew 24.20.0. The macOS spawn timeout in hook-observation.test.ts is a recurring flake risk and is left for a separate test hardening. #243 arrived during this phase and is handled as wp7 (0.2.39).
