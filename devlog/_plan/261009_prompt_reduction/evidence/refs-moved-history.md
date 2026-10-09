# Other refs-lane history moved from instructions

Moved on 2026-10-09 from the pre-edit working-tree snapshot. These are historical
claims and former explanations, not current-state proof. Excerpts include context
so the surviving rule can be audited; they do not add new instruction owners.
The updated resolver-cell.txt and 2026-10-09 alias map supersede the old dispatch
card where they differ. No private transcript is copied.

## Record 1

Source: `plugins/codexclaw/skills/pabcd/references/delegation.md:35-35` (pre-edit lines).

The optional progress-checkpoint heading carried issue #265. The checkpoint grant, handoff fields and verification procedure remain instructions; the issue number is provenance only.

## Record 2

Source: `plugins/codexclaw/skills/pabcd/references/delegation.md:55-67` (pre-edit lines).

The promotion rationale described host memory extraction excluding child sessions while retaining main's assistant messages and inter-agent communication. This supported main's synthesis as the available promotion route; it did not authorize automatic durable-memory writes. Repository doctrine was named as provenance rather than an installed prerequisite.

## Record 3

Source: `plugins/codexclaw/skills/pabcd/references/delegation.md:188-189` (pre-edit lines).

In native Code Mode on a V1 host (observed in this host's catalog), the spawn callable is `tools.multi_agent_v1__spawn_agent`; `wait_agent`, `close_agent`, `send_input`, and `resume_agent` use the same `multi_agent_v1__` prefix. The SessionStart dispatch card prints that exact call only under the `CODEXCLAW_SPAWN_V1=1` override, and always lists dated model aliases. Its resolver identifies the family from companion tools (`send_input`/`close_agent` for V1, `followup_task`/`interrupt_agent` for V2) and spawns V2 with `fork_turns: "none"` so model overrides are accepted. If the card says family unresolved, run its one-cell helper resolver and spawn in that same cell; do not treat the generic V2 default as detection. Follow the managed fallback protocol before native spawn when a role has a first fallback.

## Record 4

Source: `plugins/codexclaw/skills/pabcd/references/delegation.md:194-203` (pre-edit lines).

**DELEGATE-MODEL-LIST-01 (STRICT).** The model-override list in the host tool
description is a hint, not an allowlist, and is known to be incomplete. When the
user names a worker model, pass it through as given. Only a real spawn rejection
is evidence of unavailability; absence from the description is not. If a
requested model genuinely fails to spawn, say so to the user — do not substitute
a different model and silently re-plan the ratio. Measured on 2026-09-14:
`spawn_agent({ model: "devin/swe-2" })` returned `{ agent_id, nickname }` and
the child ran to a final message on the parent's branch, while the advertised
list still omitted it; re-confirmed the same day in a second session.

## Record 5

Source: `plugins/codexclaw/skills/pabcd/references/delegation.md:217-223` (pre-edit lines).

The wait difference is the one that bites, in two ways. On V1 the first complete report
may arrive through the host notification OR through `wait_agent`; the same code on V2
returns a status summary and no text, which looks like a silent failure rather than a
schema mismatch — on V2 the final answer arrives as a separate message. And V1's
`wait_agent` waits on named `targets` while V2's waits on the whole mailbox, so a
V1-shaped call carrying `targets` is not a valid V2 call at all.

## Record 6

Source: `plugins/codexclaw/skills/loop/references/waiting.md:15-19` (pre-edit lines).

Long silent waits read as a dead loop to the user and invite interrupts that
kill the work-phase (019f4456: a 6-minute silent `wait_agent` stretch looked
like "stopped after one work-phase"). While waiting on subagents or long
external processes inside a loop:

## Record 7

Source: `plugins/codexclaw/skills/loop/references/runtime-lifecycle.md:9-14` (pre-edit lines).

A loop claim without persisted FSM evidence is INVALID. Narrating phases ("now I'm in
B", "audit passed") without their `cxc orchestrate` transitions is the exact
failure mode this rule exists to stop: the Stop hook never arms, the ledger stays
empty, and the "loop" is one ordinary turn wearing a loop costume. Mandatory sequence
for EVERY loop entry or re-entry:

## Record 8

Source: `plugins/codexclaw/skills/loop/references/lane-dispatch.md:8-11` (pre-edit lines).

The numbers below were read from the Codex desktop bundle and the `codex-rs` sources on
2026-09-20 and are recorded as data in `test/fixtures/host-thread-bounds.json`. Re-derive
them with `scripts/check-host-bounds.mjs` rather than trusting this prose.

## Record 9

Source: `plugins/codexclaw/skills/loop/references/lane-dispatch.md:98-105` (pre-edit lines).

No cap was found on that path when it was read — collection, resolution and injection all
pass the whole array — which is a measured absence rather than a guarantee. A reference is
a pointer, not content: read the task before relying on it.

Creation is asynchronous. A ready task returns `threadId` and `hostId`; a task whose
worktree is still being set up returns a provisional `clientThreadId`, which no tool
accepts. The binding to the canonical id exists internally, but no model-visible resolver
was found when the bundle was searched, so treat it as unavailable rather than hidden.

## Record 10

Source: `plugins/codexclaw/skills/loop/references/lane-dispatch.md:110-114` (pre-edit lines).

A queued worktree **fork** is the one narrow exception: it carries no assignment until
its follow-up message, so routing that lane another way cannot duplicate work. One was
observed never registering; see DISPATCH-FORK-LANE-01 in
[dispatch surfaces](../../pabcd/references/dispatch-surfaces.md).

## Record 11

Source: `plugins/codexclaw/skills/loop/references/lane-dispatch.md:124-134` (pre-edit lines).

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

## Record 12

Source: `plugins/codexclaw/skills/loop/references/lane-dispatch.md:137-142` (pre-edit lines).

A finished lane notifies its own task. No cross-task wake was found. A coordinator that
dispatches lanes and ends its turn has arranged nothing: keep the work inside the turn,
or arm a wake that targets the coordinator itself and verify it is active
(DISPATCH-WAKE-01 in [waiting](waiting.md)). Only one active heartbeat may attach to a
thread, so a second monitor is not a second safety net.

## Record 13

Source: `plugins/codexclaw/skills/loop/references/lane-dispatch.md:149-154` (pre-edit lines).

`check-lane-packet.mjs` decides packets; it does not police this document. The
authorization in [cxc-loop](../SKILL.md) is prose, and no test fails when prose is
deleted — an independent reviewer raised exactly that, and closing it properly means
enforcing the packet at the orchestration boundary, which is a runtime change this
contract does not make. Treat the validator as the enforceable half and the skill text as
the readable half.

## Record 14

Source: `plugins/codexclaw/skills/dev/references/stacked-prs.md:133-137` (pre-edit lines).

A throughput strategy for landing many pull requests in one day, learned from a
36-PR batch. It relaxes the per-PR merge gate, so it is **owner-authorized only**:
the repository owner must decide to accept it for a named batch. Without that
decision, every rule above applies unchanged.

## Record 15

Source: `plugins/codexclaw/skills/dev/references/stacked-prs.md:192-194` (pre-edit lines).

An owner running this strategy reported six pull requests closing correctly from
a single `--merge` on the lane tip.

## Record 16

Source: `plugins/codexclaw/skills/dev/references/stacked-prs.md:208-212` (pre-edit lines).

A non-zero exit means that link will not auto-close. Repair by propagating
upward: merge the refreshed lower link into the one above it and carry that
result to the tip. In the live batch, two of five lanes had already broken this
by absorbing a trunk landing at the bottom without propagating up.

## Record 17

Source: `plugins/codexclaw/skills/dev/references/stacked-prs.md:276-282` (pre-edit lines).

**Depth (HEURISTIC — practitioner guidance, not a measured limit).** Aim for 2–4 layers
and think hard at 5. Community practice guides suggest each layer be reviewable in roughly
10–15 minutes and report stacks becoming unwieldy past about 4–5 layers; treat that as
experience, not a rule. What is certain: every layer is a separate fully gated PR with its
own review and its own CI, and every layer above an edit has to be re-stacked by hand or
by tool. If the map is longer, ship the bottom half, land it, then stack the rest.

## Record 18

Source: `plugins/codexclaw/skills/dev/references/stacked-prs.md:404-417` (pre-edit lines).

An owner-provided OpenCodex transcript dated 2026-09-05 reported a native-stack gh pr merge call with --merge, --admin and --match-head-commit failing through the legacy GraphQL mergePullRequest path. The error required the asynchronous merge REST API. Admin mode did not change the transport; blocked mergeability did not prove transport recovery. No private transcript is copied here.

## Record 19

Source: `plugins/codexclaw/skills/dev/references/stacked-prs.md:463-484` (pre-edit lines).

Only when the user clearly and strongly selected GitHub native stacks for this
task should these native tools be considered. Do not suggest or install them for
ordinary PRs or manual chains. GitHub's first-party extension is `gh stack` (`gh extension install github/gh-stack`,
requires `gh` v2.0+). Core verbs: `init`, `add`, `push`, `view`, `submit`, `rebase`,
`modify`; `up`/`down` navigate (up = away from trunk). Stack metadata lives in
`.git/gh-stack` (JSON, uncommitted) and it enables `git rerere` on init so conflict
resolutions replay across cascades. It also ships an agent-facing skill:
`gh skill install github/gh-stack`.

GitHub's native stacked-PR feature was in **public preview** as of 2026-09-05 — verify
current status before relying on preview-only behavior.

Registration, native/manual distinctions and CI semantics rechecked 2026-09-05:
[creating stacks](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-stacked-pull-requests),
[native rules and CI](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs),
[stack REST API](https://docs.github.com/en/rest/pulls/stacks), and
[API/webhook and async merge contract](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests-apis-and-webhooks).

Sources for the behavioral claims above, all opened 2026-08-03: `git rebase` docs
(`--update-refs`), GitHub Docs "About stacked pull requests", "Pull request merges", and
"About protected branches", the `gh pr create` manual, and the `github/gh-stack` README.
Claim-by-claim provenance: `devlog/_plan/260803_stacked_pull_requests/000_research.md`.
