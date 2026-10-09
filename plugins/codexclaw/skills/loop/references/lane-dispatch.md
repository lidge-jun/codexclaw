# Lane dispatch — tasks that run their own loop

Read when a request fans work out across parallel tasks, or when watching more lanes than
one wait can hold. [Dispatch surfaces](../../pabcd/references/dispatch-surfaces.md) owns
the choice between a thread and a subagent; this file owns what a lane is handed and what
it is allowed to do with it.

## Host envelope

Use the live tool schema if it differs. Recorded bounds and evidence locators
live in `test/fixtures/host-thread-bounds.json`; re-derive available artifacts with
`scripts/check-host-bounds.mjs`. Missing artifacts are NOT RUN, not proof of a bound.

| Purpose | Schema or recorded bound |
|---|---|
| create | `create_thread({ prompt, target, model?, thinking? })`; `target.environment` is local or worktree; a worktree takes `startingState` of working-tree or branch with `branchName` and `onMissing` |
| wait | `wait_threads({ targets: [{ threadId, hostId?, afterCursor? }], timeoutMs? })`; 1-8 targets; `timeoutMs` 0-120000, default 120000 |
| read | `read_thread({ threadId, hostId?, cursor?, turnLimit?, includeOutputs?, maxOutputCharsPerItem? })`; `turnLimit` 1-10; `maxOutputCharsPerItem` 0-20000 |
| list | `list_threads({ limit? })`; `limit` 1-50, applied to non-pinned results |
| handoff status | `get_handoff_status({ operationId, afterRevision?, waitMs? })`; `waitMs` 0-60000 |
| follow up | `send_message_to_thread({ threadId, prompt, ... })` |
| fork | `fork_thread({ threadId?, environment? })` |
| move | `handoff_thread({ threadId, destinationHostId?, followUpPrompt? })` |
| managed worktree retention | `keepCount` default 15 |
| subagent capacity | `agents.max_threads` / `maxThreads` default 6 on V1; V2 `features.multi_agent_v2.max_concurrent_threads_per_session` minus the session itself |
| capacity error | `agent thread limit reached` |

## LANE-LOOP-AUTH-01 (STRICT) — a lane may loop; a leaf never may

Follow [surface ownership](../../pabcd/references/dispatch-surfaces.md).
A task runs a PABCD loop only when its packet grants an objective, criteria and
completion condition; otherwise it performs the stated work and reports. A leaf
never owns a goal or FSM.

## LANE-PACKET-01 (DEFAULT) — the prompt is the whole channel

A lane must receive its assignment explicitly rather than infer it from the
coordinator's files or inherited history. Its creation prompt or fork follow-up carries:

| Field | Why it is required |
|---|---|
| `lane` | The lane id used in the manifest, so two records can be matched later |
| `mode` | `dispatch`, `pending`, or `bound`; creation evidence requires an explicit mode in the packet or CLI |
| `address.threadId`, `address.hostId` | How anyone addresses this lane afterwards. Present only once creation has returned them |
| `creation.provisionalId`, `creation.hostId`, `creation.requestedAt` | Required in pending; records the requested creation without claiming a canonical address |
| `creation.worktree` | Optional nonempty string when the worktree is known |
| `work.objective`, `work.criteria[]` | Required when the lane is told to loop; a loop without them is an instruction to invent a goal |
| `work.writeScope[]` | What this lane may write. Overlapping scopes are how two lanes silently fight |
| `work.base`, `work.branch` | The ref it starts from and the branch it owns |
| `authority.loop` | Default false. False means work and report |
| `authority.push`, `authority.openPr` | Default false. A pull request needs a pushed branch, and merge needs both |
| `authority.merge`, `authority.mergeTarget` | Default false. See below |
| `reporting.evidence[]`, `reporting.onBlocked` | What must come back, and what to do instead of guessing |

A packet has three states. `dispatch` is before creation and cannot carry creation
evidence or provisional address fields. `pending` means creation was requested but the
canonical id is unconfirmed: it requires `creation` and forbids the `address` property
entirely, even an empty or null value. `bound` requires a canonical address and may retain
validated creation evidence. These records do not resolve ids or replay creation requests.

For compatibility, a packet without `mode` or `creation` defaults to `bound` when its
address is an object and `dispatch` otherwise. A present malformed or empty mode fails;
creation evidence requires an explicit pending/bound mode in the packet or CLI. A CLI
mode that conflicts with the declared mode fails rather than relabeling the record.

`creation.provisionalId` is a nonempty string, and `creation.hostId` uses the same charset
as `address.hostId`. `creation.requestedAt` must be a real calendar timestamp in canonical
UTC form `YYYY-MM-DDTHH:mm:ss[.sss]Z`, with exactly three fractional digits if supplied.
Offsets, normalized impossible dates and local timestamps are rejected. For example:

```json
{
  "mode": "pending",
  "creation": {
    "provisionalId": "<clientThreadId>",
    "hostId": "local",
    "requestedAt": "2026-09-22T12:00:00Z"
  }
}
```

This fragment accompanies the packet's required lane, work and reporting fields.

Validate with `node plugins/codexclaw/scripts/check-lane-packet.mjs <packet.json>
[--mode dispatch|pending|bound] [--json]`. Options may precede or follow the single file;
missing values, duplicate options, unknown flags/modes and extra files are rejected.
Single-packet JSON includes `resolved.mode`, and successful text output prints `mode=...`.
Validate a mixed-state set together — it also rejects two lanes sharing
a lane id or a branch, and compares write scopes after normalizing `.` and `..` so an
aliased path cannot hide an overlap.

What it cannot do: tell a provisional id from a canonical one by shape, because they have
none. It can only refuse an `address.clientThreadId` and refuse a `threadId` that repeats
either `creation.provisionalId` or the legacy `address.provisionalId`. Keep new provisional
records in `creation.provisionalId`; copying a value never establishes canonical identity.

## LANE-MERGE-GRANT-01 (STRICT) — merge is a separate sentence

The default is evidence-return: the lane pushes its branch, opens a PR when its packet
says so, and hands back CI evidence; the coordinator sequences landing
(DISPATCH-LANE-MERGE-01). A lane granted merge may land only the branch named in
`authority.mergeTarget`, which must be its own. Nothing about holding a worktree implies
permission to rewrite, retarget or merge another lane's branch.

## Addressing a lane

A lane is a canonical `threadId` plus a `hostId`. The user-facing mention the app builds
is `[@Title](thread://<threadId>?hostId=<encoded hostId>)`; the thread id accepts only
`[A-Za-z0-9_-]` and the host id is percent-encoded and must decode to `[A-Za-z0-9._:-]`.
Several tasks can be referenced in one turn: duplicates collapse by `(hostId, threadId)`
and the turn carries the resolved list as JSON under `## Referenced chats with Codex:`.
A reference is a pointer, not content: read the task before relying on it.
Do not infer an undocumented mention cap.

Creation is asynchronous. A ready task returns `threadId` and `hostId`; a task whose
worktree is still being set up returns a provisional `clientThreadId`, which no tool
accepts. Record the provisional handle as `creation.provisionalId` in a pending packet.
Use only a resolver exposed by the live host; do not invent one. A listing can
supply candidates, but title, cwd and elapsed time cannot establish the mapping.
Confirm through host evidence and a read-only task read; otherwise leave it pending.
An absent listing or delay never authorizes recreating a lane. The unassigned
queued-fork exception belongs to
[dispatch surfaces](../../pabcd/references/dispatch-surfaces.md#dispatch-fork-lane-01--a-fork-as-the-thread-route-when-created-threads-lose-permission).

If a canonical ID is lost, constrain recovery to the same host, worktree and branch.
Inspect candidate session metadata for cwd, creation time and parent identity,
then read the recorded session ID; never guess from a filename. Shared cwd cannot
separate a lane from its subagents. Confirm the candidate with a read-only task
read before steering it, and leave ambiguity unresolved.

## Watching lanes, and the wave that is actually capped

`wait_threads` uses the host envelope above and wakes on completion or required
attention; commentary does not wake it. A timeout returns compact progress for
each target and is a normal outcome. For more lanes than one wait accepts, choose
the batch whose result changes the next decision, carry each `afterCursor`, and
never infer an unwatched lane is idle.

Use waves within the session's subagent capacity and state the wave size.
Before releasing V1 slots, follow
[consume-once lifecycle](../../pabcd/references/delegation.md#v1-consume-once-lifecycle)
(DISPATCH-CONSUME-ONCE-01); V2 has no close operation. No fixture establishes a
host-wide task concurrency cap; report an unknown cap rather than assume one.

## Nothing wakes the coordinator

Before yielding with lanes active, follow [the wake contract](waiting.md#wake-before-yielding)
(DISPATCH-WAKE-01). Only one active heartbeat attaches to a thread.
Managed-worktree retention is in the host envelope: archive cleanup may delete
or transfer a checkout. Preserve work through an authorized landing or push;
never rely on an unowned worktree as the only copy.

## Known limitation

The packet validator checks record coherence; it neither intercepts dispatch nor
enforces prose authorization at the orchestration boundary.
