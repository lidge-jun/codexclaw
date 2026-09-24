# wp8 delivery: codexclaw 0.2.39

v0.2.39 is published and is the latest release: https://github.com/lidge-jun/codexclaw/releases/tag/v0.2.39 (stable, not a draft, published 2026-09-24T09:23:08Z).

| Step | Evidence |
|---|---|
| PR to dev | #246, head b7846dcb, 14/14 checks success; squash-merged as 22ea08c5 |
| dev at 22ea08c5 | push CI 35976684535, Packed install 35976684536, WSL 35976684551 all success |
| Promotion | #248 (dev → main) green at 22ea08c5; merged with a merge commit as 8e6aa800586360f440b74baf18f91e8c8af5d659 |
| main | push CI 35979257804 and Packed install 35979257769 success |
| Release dry run | 35979974600: `release verify: READY — 0.2.39`, version kind stable, tests pass=3533 fail=0 total=3609 |
| Release publish | 35980577607 success; tag v0.2.39 → 8e6aa800 |
| Assets | `shasum -a 256 -c SHA256SUMS` OK; the payload equals `git archive 8e6aa800 plugins/codexclaw` (0 differing, 0 missing, 0 extra files); manifest `0.2.39+codex.20260924082502` |
| Issues | #243 closed as completed with an evidence comment; its unmet acceptance lines (a scan-free family signal and a live V2 run) are tracked in #247 |

This run hit no flaky tests.
