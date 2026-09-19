# 002 — A-phase audit dispositions

The independent reviewer returned FAIL with three blockers. Two are accepted and change
the design; one is answered with the authority record the reviewer could not see.

## B1. Overstated root cause — accepted, reframed

The reviewer is right that `loop/SKILL.md:28-29` names a **leaf** in its prohibition, so
calling it a demonstrated block is too strong. What is actually true is narrower and still
worth fixing: the first clause — "Only the main session owns host goals and PABCD
transitions" — carries no qualifier, the second says "a delegated task", and the file
nowhere states the positive case. A lane reading it finds a universal-sounding prohibition
and no permission, which is not the same as a prohibition but produces the same behaviour.

So the unit stops claiming a blocker and does the thing that actually helps: **state the
lane case positively and scope the leaf rule to leaves.** `000` and `010` are amended to
say this.

## B2. Prose tests prove nothing — accepted, design changed

The reviewer invokes this repository's own TEST-PROMPT-SEAM-01, and the objection holds:
asserting that a phrase exists in a markdown file is not verification. Both planned test
sets are replaced by behavioural seams:

- **NEW `plugins/codexclaw/scripts/check-lane-packet.mjs`** — a validator for the packet a
  coordinator hands a lane, in the shape of the existing `check-lane-manifest.mjs`. It
  decides real cases: a packet that says `loop: true` without an objective and criteria is
  rejected; merge authority absent means evidence-return, and a lane claiming merge without
  the grant is rejected; a write scope overlapping another lane's is rejected; a
  `clientThreadId` in the addressing field is rejected because no tool accepts it. Tests
  exercise those decisions, not the prose around them.
- **NEW `plugins/codexclaw/test/fixtures/host-thread-bounds.json`** plus
  `scripts/check-host-bounds.mjs` — the measured bounds recorded as data with their
  evidence locators. The test asserts the documented numbers equal the fixture, and the
  script re-derives them from `app.asar` and the `codex-rs` sources when those artifacts
  are present. Where the artifact is absent — CI has neither — the script reports NOT RUN
  and exits non-zero on drift only, because an unrunnable check is not a pass.

## B3. Unrecorded authority — answered with the record

The reviewer had no access to the request that authorizes this unit, so its objection is
procedurally right and substantively moot. The grant, recorded here as the artifact it
should have been:

> "…해서 main 머지하고 배포한다음에 ssh에 codexclaw 깔린곳에 전부 dev 기준 재설치까지 완료해줘"
> — user, 2026-09-20, the request that opened this goal

That sentence grants, in order: merge to `main`, publish a release, and reinstall from
`dev` on every SSH host that already has codexclaw. Pushing to `dev` was granted earlier
the same day ("dev에 커밋을 쌓으면서 진행 푸시도 dev에 바로"). It does not grant installing
codexclaw where it was never installed, and `040` already excludes that.

The lane-side authority is unchanged and stays conservative: a lane pushes and opens a PR
only when its packet says so, and `check-lane-packet.mjs` enforces that a lane cannot
claim merge without the explicit grant.

## Corrections accepted without argument

- The `thread://` regex is at byte `30013400`; `001` cited the containing function start.
- The five-concurrent-agents observation has no durable artifact. `001` now records the
  exact error string returned by the host instead of the count:
  `collab spawn failed: agent thread limit reached`.
- `020` amends a test file that `010` creates; the dependency order is intentional.
