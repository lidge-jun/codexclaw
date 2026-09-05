# Direct deployment results

Latest user direction: deploy now without waiting for queued CI (092).
Deployed snapshot:8267fa99f57a1b5afd714d3e63b9d05706a562b8.
Version:0.2.17+codex.20260905162606. This is a direct Git deployment,
not a completed GitHub release/promotion.

## Verification before deployment

The untracked-source override regression passes at all three phases. Full remote
macmini Node24 suite:2551total,2550pass,0fail,0cancelled,1 existing optional repo-map
skip;92,106.578ms. Independent narrow review PASS. No local suite/build/typecheck.
The deployed payload was generated with git archive from the exact commit, not a
dirty directory.918 expected files; digest of sorted file/hash pairs:
51fedde3fb43ccc7d371f39626a9e2d7bf9144fa942d84688d37e9dcfb592a05.
Snapshot tar SHA256:fbc53bfea748a8632e2e1acf8a4feca62cebb396fa3e313f5a89644f1ebf7742.

## Applied hosts

| Host | Applied state | Fresh checks |
|---|---|---|
| suji | Native Git install pinned to8267fa99; all918 files match | manifest/hooks/hook-trust/install-root PASS;23 trusted; separate verify PASS |
| desktop-c795oh4 | Native Windows Git install pinned to8267fa99; all918 files match | same four PASS;23 trusted; separate verify PASS |
| macmini-cf | Existing source-linked install preserved; clean source checkout fast-forwarded963888e0 ->8267fa99 | all918 required files match;15 links resolve to corresponding verified source paths; same four doctor checks PASS;23 trusted |

Suji/Windows normal no-bootstrap re-trust reconciled their previously recorded
missing/drifted trust entries. No branch-protection or trust-safety override.
The native Codex versions were not changed: macmini0.146.0; suji/Windows0.147.0.

## macmini mode change and retained failures

Between read-only inventory and deployment, another actor replaced macmini's old
0.2.16 cache with a source-linked0.2.17 install from
/Users/junny/Developer/codexclaw. The original helper's backup/apply attempts
therefore failed preflight before any write; they are not claimed successful.
Main re-read the actual installation and kept the new local-source mode.

The clean source checkout's origin and ancestry were verified, its current payload
and marketplace were archived privately, and only a fast-forward was performed.
No reset, source overwrite, or application termination was used.

Whole-cache equality then failed because the running GUI had16 existing generated
Vite cache files under gui/node_modules/.vite/deps. These were preserved, not
deleted to obtain green. The separate source-linked proof records
trackedMatch:true and completeTreeMatch:false; it verifies every required file
and every link target while listing those cache extras. This is not a claim of a
fully archive-identical filesystem or a restarted/hot-reloaded GUI/session.

## Backups and receipts

Host-local deployment directory:
- /Users/junny/codexclaw-deploy-20260906-01a0702d
- /Users/neuralarcadepro/codexclaw-deploy-20260906-01a0702d
- C:\Users\user\codexclaw-deploy-20260906-01a0702d

Suji/Windows backup subdirectories retain exact old payloads, a private regular
config preimage, native command receipts and applied.json. Windows backup uses
restricted user/SYSTEM ACLs. macmini retains source-before.tar, the source-linked
file proof, native re-trust log/config backup and doctor output. Config bytes were
not copied off-host. The previously tested isolated copy-install rollback remains
distinct from macmini's source-linked update; no production rollback was needed.

Local non-secret receipts: .codexclaw/evidence/01a0702d-c493-7510-801f-7d8772a2689c/
direct-8267fa9/{expected.json,suji-applied.json,windows-applied.json,mac-source-linked-proof.json}.

## Explicitly not completed

win, oracle and ocx-ci still fail SSH connection attempts; installation state and
deployment there remain unknown. No network/auth repair or new access was attempted.
PR65 and PR67 merged; PR66/PR68 and formal GitHub publication remain separate.
The last public release checked was v0.2.16. Queued checks were not marked passed
and this deployment is not described as a published v0.2.17 release. Existing
conversations may retain loaded code/skill snapshots; fresh sessions pick up the
installed plugin. The original research's unmet criteria were not rewritten.
