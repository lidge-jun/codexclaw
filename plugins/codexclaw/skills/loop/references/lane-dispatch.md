# Lane dispatch — tasks that run their own loop

Read when a request fans work out across parallel tasks, or when watching more lanes than
one wait can hold. [Dispatch surfaces](../../pabcd/references/dispatch-surfaces.md) owns
the choice between a thread and a subagent; this file owns what a lane is handed and what
it is allowed to do with it.

The numbers below were read from the Codex desktop bundle and the `codex-rs` sources on
2026-09-20 and are recorded as data in `test/fixtures/host-thread-bounds.json`. Re-derive
them with `scripts/check-host-bounds.mjs` rather than trusting this prose.

## LANE-LOOP-AUTH-01 (STRICT) — a lane may loop; a leaf never may

A subagent has no session state, no host goal and no FSM: it must not call `create_goal`
or `cxc orchestrate`. A dispatched task does own both, because codexclaw keys them to the
task. Ownership is not authority, though. A lane runs a PABCD loop only when its packet
grants an objective, criteria and a completion condition; with no such grant it does the
stated work and reports. The coordinator never advances a lane's FSM and a lane never
advances the coordinator's — messaging a task is not commanding it.

## LANE-PACKET-01 (DEFAULT) — the prompt is the whole channel

A lane cannot read the coordinator's goalplan, ledger or context. Whatever is not in the
`create_thread` prompt does not exist for it. The packet therefore carries:

| Field | Why it is required |
|---|---|
| `lane` | The lane id used in the manifest, so two records can be matched later |
| `address.threadId`, `address.hostId` | How anyone addresses this lane afterwards. Present only once creation has returned them |
| `work.objective`, `work.criteria[]` | Required when the lane is told to loop; a loop without them is an instruction to invent a goal |
| `work.writeScope[]` | What this lane may write. Overlapping scopes are how two lanes silently fight |
| `work.base`, `work.branch` | The ref it starts from and the branch it owns |
| `authority.loop` | Default false. False means work and report |
| `authority.push`, `authority.openPr` | Default false. A pull request needs a pushed branch, and merge needs both |
| `authority.merge`, `authority.mergeTarget` | Default false. See below |
| `reporting.evidence[]`, `reporting.onBlocked` | What must come back, and what to do instead of guessing |

A packet has two lives, and conflating them is how a lane ends up addressed by an id that
does not exist yet. Before dispatch it is a `dispatch` packet: everything except the
address. After creation returns a canonical id it becomes a `bound` packet, and only then
is the address required. Declare the mode; do not let it be inferred from a missing field.

Validate with `node plugins/codexclaw/scripts/check-lane-packet.mjs <packet.json>
[--mode dispatch|bound]`, and validate a set together — it also rejects two lanes sharing
a lane id or a branch, and compares write scopes after normalizing `.` and `..` so an
aliased path cannot hide an overlap.

What it cannot do: tell a provisional id from a canonical one by shape, because they have
none. It can only refuse an `address.clientThreadId` and refuse a `threadId` that repeats
a `provisionalId` the caller recorded. Keep the provisional id in that field.

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
No cap was found on that path when it was read — collection, resolution and injection all
pass the whole array — which is a measured absence rather than a guarantee. A reference is
a pointer, not content: read the task before relying on it.

Creation is asynchronous. A ready task returns `threadId` and `hostId`; a task whose
worktree is still being set up returns a provisional `clientThreadId`, which no tool
accepts. The binding to the canonical id exists internally, but no model-visible resolver
was found when the bundle was searched, so treat it as unavailable rather than hidden.
Record the provisional id in its own field, never as the address, and recover the
canonical id by reading the task listing — not by creating the lane again.

## Watching lanes, and the wave that is actually capped

`wait_threads` takes **1-8 targets** with `timeoutMs` **0-120000** (default 120000). It
wakes on the first target that completes or needs attention; commentary never wakes it and
a timeout returns compact progress for every target, which is a normal outcome rather than
a failure. More than eight lanes means deliberate batching: watch the batch whose result
changes your next decision, carry each target's `afterCursor`, and do not read an
unwatched lane as idle.

Fan-out **across branches** belongs to lanes, not to subagents; concurrency *inside* one
lane's tree is still subagent work. No host-wide cap on concurrently running tasks was
found in the searched paths, and per-thread turns queue instead. Subagents are the capped
resource:
spawning past the limit fails outright with `agent thread limit reached`, and the limit is
six per session by default (`agents.max_threads`; on V2,
`features.multi_agent_v2.max_concurrent_threads_per_session` minus one for the session
itself). So "unlimited parallel subagents" is not a shape the host offers — run waves,
state the wave size, and close finished agents, because a completed agent holds its slot
until it is closed.

## Nothing wakes the coordinator

A finished lane notifies its own task. No cross-task wake was found. A coordinator that
dispatches lanes and ends its turn has arranged nothing: keep the work inside the turn,
or arm a wake that targets the coordinator itself and verify it is active
(DISPATCH-WAKE-01 in [waiting](waiting.md)). Only one active heartbeat may attach to a
thread, so a second monitor is not a second safety net.

Managed worktrees are retained to the latest 15 by default and archive cleanup can delete
or transfer one, so a lane's checkout is not permanent storage. Land or push work; do not
leave the only copy in a worktree nobody owns.

## Known limitation

`check-lane-packet.mjs` decides packets; it does not police this document. The
authorization in [cxc-loop](../SKILL.md) is prose, and no test fails when prose is
deleted — an independent reviewer raised exactly that, and closing it properly means
enforcing the packet at the orchestration boundary, which is a runtime change this
contract does not make. Treat the validator as the enforceable half and the skill text as
the readable half.
