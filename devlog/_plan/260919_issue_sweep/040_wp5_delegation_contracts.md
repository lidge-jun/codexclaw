# 040 — wp5: delegation and loop dispatch contracts (#178, #198, #192, #194, #193)

**Precondition: PR #180 merges into `dev` first.** It is `MERGEABLE`/`CLEAN` with all 14
checks passing, it already declares `Closes #178`, and it edits
`pabcd/references/delegation.md`, `pabcd/references/phase-plan.md`,
`pabcd/references/plan-output.md` and `loop/references/waiting.md` — the exact files this
phase must edit. Two advisors reached that conclusion independently. Landing it first
removes #178 from this phase and avoids a self-inflicted conflict.

Four of the five issues edit `loop/references/waiting.md`, so this phase is one PR, not
four. It also touches `dev/SKILL.md` §8, so it must not run concurrently with wp6, which
edits §3 of the same file.

## #178 — retirement on an empty wait (carried by PR #180, verified after merge)

`waiting.md:31` treats roughly three empty waits as failure, and
`structure/20_pabcd_dispatch_doctrine.md:181` lists undifferentiated "timeout" among
retirement reasons. Meanwhile `subagent-config/src/fallback-dispatch.ts:168` rejects
`task_failed`, so genuine stagnation has nowhere to go and lands in `reconcile`.

After #180 merges, re-verify on the merged tree: replace the roughly-three-waits rule with
evidence-based classification (progress, suspected stagnation, confirmed failure,
unobservable), and check whether #180 also carried the `fallback-dispatch.ts` half. If it
did not, that component change belongs here:
`fallback-dispatch.ts:168` gains validated `task_failed` handling before the current
`if (b.outcome !== "failed" && b.outcome !== "unavailable") throw`, preserving
cancellation and denial precedence, unknown-state reconciliation, recorded-child checks
and the two-candidate ceiling; `fallback-dispatch-cli.ts:7` extends its provider-only
failure guidance; both `dist` files regenerate through `npm run build`.

## #198 — the report arrives two or three times

Structural, not a broken path. Spawn installs a watcher at
`codex-rs/core/src/agent/control/spawn.rs:407` which independently injects the completed
status at `control.rs:533`; `wait.rs:188` returns terminal `AgentStatus` values;
`close_agent.rs:62` and `:125` capture and return that status before closing.
`wait.rs:274` exposes no content-suppression option, so this cannot be fixed by an
argument — only by a consumption rule.

**MODIFY** `plugins/codexclaw/skills/pabcd/references/delegation.md:166`

- Before: `On V1 you read the answer out of \`wait_agent\``
- After: on V1 the first complete report may arrive through notification or through the
  wait; consume it once per child task per turn. A wait already in flight can still return
  a duplicate, so do not issue additional waits solely to retrieve a report already
  received.
- Also modify that file's stop description, currently `returning the previous status`, to
  state that a completed previous status can contain the entire report. Close agents when
  they are no longer needed; do not skip cleanup to save context, because a completed
  agent holds a concurrency slot. Where Code Mode permits result projection, emit only the
  status and error metadata for an already-consumed result. Do not promise that native
  notifications or tool logging can be eliminated.

**MODIFY** `plugins/codexclaw/skills/loop/references/waiting.md:23` — extend
"V1's `wait_agent` may carry the child's final message" with the duplicate-consumption
pointer, preserving the distinct V2 mailbox and desktop cursor contracts. A previous
status is not post-close termination proof.

First-party evidence for this unit: the A6 advisor report arrived in the `wait_agent`
result and again as a notification, and the concurrency limit of six was hit on the
seventh spawn while completed agents still held slots.

## #192 — lanes stall because no wake was armed

`dispatch-surfaces.md:110` assigns coordination to `wait_threads` with no cross-turn
contract; `waiting.md:29` says to re-wait or poll indefinitely; and
`runtime-lifecycle.md:79` explicitly permits Stop-continuation release under context
pressure or the stagnation cap. Those three together guarantee the reported stall. The
`bg-wake` hook at `components/bg-wake/src/hook.ts:57` reacts to hook invocation and does
not constitute a scheduler for arbitrary lane completion.

**MODIFY** `dispatch-surfaces.md:110` — require a named continuation owner and mechanism
before dispatching work expected to outlive the turn, and require verifying the matching
wake is active and retaining its ID before yielding.

**MODIFY** `waiting.md:29`

- Before: `Never end the turn just because a wait timed out — re-wait or poll`
- After: bounded in-turn waiting, or an already verified and authorized cross-turn wake.
  With no exposed wake, continue handling in-turn or report the limitation explicitly.

**MODIFY** `runtime-lifecycle.md:67` — extend the existing waiting-reference pointer to
cover cross-turn dispatch preflight. Canonical wake instructions stay in `waiting.md`:
lane/task/host/PR mapping, evidence commands, merge owner and authority, next actions,
terminal cleanup, and silence unless something meaningful changes. Deleting a wake removes
the trigger; it neither completes the goal nor authorizes reinstatement. Muting
notifications is not stopping monitoring.

## #194 — lanes and the observer share one quota

`waiting.md:20` couples frequent waits to progress updates and then recommends polling at
`:29`. `dev/SKILL.md:415` discusses tokens only. `dispatch-surfaces.md:110` names no
observation owner or budget. The reported exhaustion was not independently reproduced, but
the guidance gap is directly observable.

**MODIFY** `dev/SKILL.md:415` — widen "Token Budget Awareness" to resource-budget
awareness, keeping the existing text and pointing at the waiting contract.

**MODIFY** `waiting.md:20` — keep bounded native waits, but qualify "between waits, emit
a one-line progress update": communication cadence must not set external API cadence.
Add one coordination observer, deduplicated snapshots, one fetch per PR per scheduled
observation by default, and intervals of several minutes or more for long hosted jobs,
adjusted to actual quota and urgency.

**MODIFY** `dispatch-surfaces.md:110` — give the parent ownership of aggregate polling
capacity across lanes sharing credentials or quota. Before sustained polling, inspect the
relevant budget, for example `gh api rate_limit`; reserve capacity for workers and back
off on evidenced limit responses. Do not assume every 403 means exhaustion, that every
account has 5,000 calls, or that rate-limit categories are interchangeable.

Correct the reporter's arithmetic if it is reused: one request every 30 seconds is 120 per
hour, not 60, and those counts alone do not explain how 5,000 calls were consumed.

## #193 — an unreachable lane

`delegation.md:181` jumps from creation straight to waits requiring `threadId`, and
`dispatch-surfaces.md:45` offers only "`threadId` plus `hostId`". The host distinguishes
filtered, paginated stored listings at `thread_processor.rs:3756` from loaded IDs at
`:2183`, and thread start emits `ThreadStarted` at `:1328` — so absence from a listing
does not prove a thread is unaddressable or nonexistent.

The desktop wrapper that resolves `clientThreadId` is not in this repository, so the
reported host omission cannot be reproduced or fixed here. This phase fixes the
documentation gap and says plainly that the rest is unverified.

**MODIFY** `delegation.md:181` — expand the create-tool row with ready-versus-pending
outcomes: record the returned canonical ID and host immediately, keep provisional IDs
separate, and never pass a provisional ID to a canonical-ID tool. Use a known canonical ID
directly without treating listing presence as a prerequisite. Do not promise a resolver or
a deadline the live tool contract does not offer.

**MODIFY** `dispatch-surfaces.md:45` — `threadId` plus `hostId` becomes canonical
`threadId` plus `hostId`, with pending creation left unresolved, and a pointer to a
recovery section.

**Add** a bounded, explicitly implementation-dependent recovery recipe to that file:
identify the same host, worktree and branch; inspect candidate rollout metadata matching
cwd, creation time and parent identity; read `SessionMeta.id`
(`protocol/src/protocol.rs:3014`) rather than guessing a filename. A shared cwd alone
cannot distinguish a lane from its subagents. Verify a candidate through a read-only task
API before steering, and leave ambiguity unresolved. Do not recreate a lane merely because
discovery failed.

## Verification

Human review for every item above except the `fallback-dispatch` component change, which
runs
`node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/subagent-config/test/fallback-dispatch.test.ts plugins/codexclaw/components/subagent-config/test/fallback-dispatch-cli.test.ts`
covering unknown/running child, mismatched ID, missing reconciliation, cancellation and
denial, malformed evidence, old-state compatibility, two-attempt exhaustion and emitted
guidance. The document does not claim a gate for the prose.

## Risk

Deduplicating by agent ID alone would discard a later task's report on a reused agent.
Over-aggressive projection hides failures. Careless `task_failed` handling could turn a
cancellation into replacement authority. Accidental rearming after explicit cancellation,
duplicate automations, and treating a scheduled run as merge authority are the wake risks.
