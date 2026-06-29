# L31 (Decade 310) -- Channel Delivery (telegram / discord)

Status: PLANNED
Cluster: 6 - Phase: expansion - Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/150_channel_delivery.md, 090 J-2

## Goal (one slice)
Add deferred channel delivery for scheduled results, focused on telegram and
discord as the lowest-priority expansion path. L31 forwards results produced by
L30; it does not define the scheduler or the primary result store.

## Why now / dependencies
- Upstream: depends on L30 selecting and implementing a stable result contract.
  L29/L30 must be done before channel forwarding is useful.
- Downstream: enables heartbeat-style notifications outside the terminal, but
  remains optional so Phase 3 can ship without channel credentials.

## Scope (decision-complete)
- Files to add/edit: channel delivery module/CLI under `cxc`; channel config
  stored in the codexclaw project or user config according to existing config
  conventions; adapters for telegram and discord.
- Exact behavior: a user can configure a channel target, test delivery, and opt
  a scheduled job into forwarding its L30 run summary/result body.
- Candidate CLI: `cxc channel configure telegram`, `cxc channel configure
  discord`, `cxc channel test <name>`, and `cxc schedule notify <job-id>
  --channel <name>`.
- Must-NOT-Have: no channel credentials in plan docs, examples, logs, or test
  fixtures; no channel delivery as the only copy of a scheduled result; no
  forced telegram/discord setup during MVP install.

## IPABCD micro-cycle
- I: not interview-bearing unless credential/setup prompts are needed at build
  time; default is explicit CLI configuration, not automatic interview.
- P: define channel config shape, result-summary payload, and adapter boundaries;
  make L30 file result store the source of truth for forwarding.
- A: audit angle = "does notification failure corrupt or hide the scheduled
  result?" reviewer checks secret handling, retry/error messages, and isolation.
- B: implement channel config/test commands; add telegram and discord adapters;
  wire schedule job opt-in to forward completed run summaries.
- C: run adapter tests with fake transports; run `cxc channel test` in dry-run or
  mock mode; verify a failed delivery leaves the L30 result readable.
- D: done = telegram/discord forwarding is optional, testable, and never required
  for Phase 3 scheduler correctness.

## Acceptance (1-3 testable criteria)
1. `cxc channel test <name>` validates configured delivery with a fake/mock
   transport in tests and clear stdout in CLI mode.
2. A scheduled job can opt into forwarding an existing L30 run result summary to
   telegram or discord without changing the stored result.
3. Missing credentials or delivery failures produce explicit errors and never
   delete, overwrite, or mask `.codexclaw/` run results.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- node:test with fake telegram/discord transports and secret-redaction checks.
- CLI stdout for configure/test dry-run paths.
- Data dump comparing pre/post L30 run result after a failed channel delivery.

## Commit unit (one atomic conventional commit)
`feat(channels): add optional telegram and discord result forwarding`

## Blocked-on (jun decision id, if any)
None. This loop is PLANNED and deferred. It should start only after L30 settles
Q-P3-2, because channel delivery forwards scheduled results rather than owning
the primary result destination.

Deferred implementation options:
- Option A - CLI-only channel setup (recommended): `cxc channel` commands manage
  config and tests. Impact: simple, scriptable, and avoids GUI dependency.
- Option B - skill-driven senders: expose telegram/discord as skills that agents
  call directly. Impact: flexible, but harder to test and easier to leak secrets
  into transcripts if prompts are careless.
- Option C - GUI channel settings: configure targets from a later dashboard.
  Impact: better UX, but depends on Phase 2 GUI stability and is unnecessary for
  the first deferred delivery pass.

Recommendation: Option A after L30. Keep adapters isolated so a later GUI can
reuse the same config/test/send primitives.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/150_channel_delivery.md (telegram/discord deferred scope)
- 260629_codexclaw_mvp/090_expansion_moc.md (channel delivery lowest priority)
- 300_L30_result_delivery_phase3_verify.md (result source contract)
- cli-jaw telegram-send skill structure (Bot API/local API pattern to research
  before implementation; not vendored in this plan)
