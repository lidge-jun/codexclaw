# Native thread identity versus shared request correlation

Status: source-backed measurement diagnosis, not an OCX patch or per-child wire
attribution claim. This is separate from the user-excluded response-tier echo bug.

## Actual C2 records

Native session_meta contains two different identities. Both child rollouts name
their real parent in source.subagent.thread_spawn.parent_thread_id and use the
parent/root session_id, while id remains the distinct child thread identity.

| Variant | Thread id | Role | Shared session_id |
| --- | --- | --- | --- |
| baseline | 01a070b0-4a51-7970-b708-6bf12c2d2103 | parent | 01a070b0-4a51-7970-b708-6bf12c2d2103 |
| baseline | 01a070b1-6716-7102-9d25-eee496b78541 | child | 01a070b0-4a51-7970-b708-6bf12c2d2103 |
| candidate | 01a070b2-7252-7d90-ac19-b8e8ea5afe47 | parent | 01a070b2-7252-7d90-ac19-b8e8ea5afe47 |
| candidate | 01a070b3-a9ce-7f82-86b2-17c1975cdb45 | child | 01a070b2-7252-7d90-ac19-b8e8ea5afe47 |

All four native contexts record gpt-6-astra/high. Usage logs contain12 baseline
and13 candidate requests under the corresponding root digest, with exact
Astra/high/priority fields. No rows match the child thread-id digests. These are
shared-family rows, not twelve/thirteen independently attributable parent calls.
Do not duplicate those requests into each child's totals or rewrite their IDs.

## Matching source, inspected read-only

Local Codex rust-v0.146.0 resolves to
e363b08c9175ac1cbe5893615dd2cb9ddf95043b, matching the observed CLI version.
This is version/source correspondence, not cryptographic attestation of binary memory.

- codex-rs/core/src/agent/control.rs:90–99 describes and stores the session ID
  shared across the root's agent-control tree; :127–134 preserves/accesses it.
- codex-rs/core/src/session/session.rs:477–484 distinguishes concrete thread_id
  from shared session_id; :558–582 preserves that shared identity for descendants.
- codex-rs/core/src/session/turn_context.rs:546–553 passes both identities and
  parent_thread_id into response metadata.
- codex-rs/core/src/client.rs:1149–1151 passes session and thread separately to
  response options. codex-rs/codex-api/src/requests/headers.rs:5–13 emits separate
  session-id and thread-id headers.
- Captured OCX source a687eb735 uses client/parent identity, then session identity,
  before thread identity in src/server/request-log-conversation.ts:115–127.
  src/server/responses/core.ts:2984–2989 supplies those actual request fields.

Main rechecked the remote OCX source clean at a687eb735 and healthz version2.43.0,
PID38505, port10100. No source/config/service modification was performed during
this diagnosis. The native-source archive is retained in the experiment root.

## Consequence for evaluation

The original evaluator's exact thread-id digest assumption works for a fresh
single parent but cannot allocate a shared family's rows to individual children.
The failed complete-child collector correctly stopped instead of inventing a
match. Its partial output-complete is not a passing packet.

Keep native per-thread context/behavior proof separate from deduplicated family
request evidence. Per-thread request counts remain unavailable from this usage
channel. Before mandatory delivery comparisons, the measurement contract must
explicitly represent audited shared-session groups or use a genuinely observed
finer identity source; no evaluator fallback may silently treat parent proof as
child proof. Any code change needs its own audited phase scope. No OCX fix is
proposed, and this does not change cxc's latest-SessionStart binding rule.
