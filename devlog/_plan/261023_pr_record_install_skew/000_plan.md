# 261023 PR records reach the gate; version skew is named (#316)

## Problem

A GOAT host ran codexclaw 0.2.42 hooks and CLI while the session's skills came from
0.2.43 on another machine. The installed `cxc loop` had no `pr-record`; the operator
ran it from a fresh clone, and the installed GOAL-COMPLETE-GATE-01 still denied
(E8: 2 unmet criteria), because 0.2.42 predates #307. Two things on this side made
it worse: `pr-record` wrote wherever it ran, so a record in the wrong checkout
succeeded and was never read, and nothing told the operator which build was stale.

## Design

- `pr-record` refuses when `<cwd>/.codexclaw/sessions/<id>.json` is missing: the gate
  reads `evidenceDir(payload.cwd)`, the same checkout as the session state.
- `install-version.ts`: running version from the payload manifest and the update path
  from the README.
- Records carry `cxcVersion`. `readNewerPrRecord` finds a record with schema > 1; it is
  never trusted, and both completion denials append which build wrote it and the
  update path.
- Unknown `cxc loop` verb errors name the running version and the update path.
- README (en/ko/zh) update section and runtime-lifecycle.md: `pr-record` needs 0.2.43+,
  upgrade the host rather than recording from a newer clone.

## Verification

`test/pr-record-install.test.ts`: the issue's E8 denial turns into allow with a record
in the session checkout (already true on 0.2.43; kept as the acceptance guard); a record
from another checkout is refused and nothing is written; a newer record and an unknown
verb name the installed version and the update command. The last three fail on dev.
