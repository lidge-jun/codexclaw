# Review, release and installed verification

Depends on010 passing regression/build and independent review. Bump all existing
0.2.20 version surfaces to0.2.21, fresh manifest+codex UTC stamp, preserve dependencies.
Regenerate inventory with measured full test count from CI/remote suite, not guessed.
Use ordinary repair PR todev; exact-head checks green then merge. Promote dev->main,
require exact-main CI/WSL/packed install then dispatch release.yml version0.2.21.
Verify immutable tag, release checksum/assets and full payload against frozen source.
Deploy established macmini-cf,suji,desktop-c795oh4,local using reviewed previous operator
and host-local backups; preserve unrelated configs and source trees; no forced restart.
Verify current installed versions, hashes, doctor and trust. Current session live
bind smoke must preserve other state and report hooksVerified:false. Readonly checks
of affected sessions are permitted; do not mutate their completed FSMs or wake peers.
Record remaining need for restarting stale app sessions honestly rather than claiming
that installing files refreshed an already-running plugin catalog.
