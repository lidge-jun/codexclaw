# Triage of the 22 open issues (2026-09-27)

Six gpt-6-sol explorers verified each issue against `dev` at `958441a9` (read-only, source anchors in their returns); main accepted their verdicts with the adjustments noted. REAL means the shipped behavior is wrong; PROPOSAL means the report asks for new behavior.

| Issue | Verdict | Decision | Reason |
|---|---|---|---|
| #209 pending worktree thread has no clientThreadId to threadId path | NOT-REPRODUCED in plugin | defer | The gap is in the Desktop creation wrapper; codexclaw already keeps provisional and canonical ids apart (dispatch-surfaces.md:114-129, check-lane-packet.mjs:96-119). Needs a host completion event. |
| #213 automation ids are host-global | PARTIAL | defer | The ownership hook already denies foreign update/delete on hooked calls (automation-ownership-gate.ts:37-62). The remaining hole is atomic authorization inside the host mutation handler. |
| #247 identify collab family at SessionStart | PROPOSAL | defer | SessionStart has no tool catalog or family field (fallback-dispatch-cli.ts:33-39); a plugin-only fix would guess. Needs a host signal. |
| #250 trigger and loop-arm heuristics match ordinary words | REAL | fix (016) | detectTrigger and detectLoopArmRequest match bare mentions and generic persistence phrases (hook.ts:238-285) and inject directives into headless runs. |
| #251 SubagentStop gate blocks built-in worker | REAL | fix (015) | The gate checks agent type without checking whether the parent armed a PABCD cycle (subagent-evidence.ts:471). |
| #252 no supported PABCD off switch | PROPOSAL | implement narrowed (012) | A blanket pabcd-state no-op would also remove worktree, memory-write and automation guards (inventory.json:175-205); a PABCD-policy switch keeps them. |
| #253 GOAL-IDLE-CONTINUE-01 blocks every active-goal session | REAL | fix (013) | handleStop blocks at IDLE whenever a native goal is active, even with no state or goalplan (hook.ts:1781-1787; hook-continuation.test.ts:506 pins it). |
| #254 MAX_STOP_BLOCKS_TOTAL never resets | PROPOSAL (behavior intended) | implement (014) | The cap is documented as per-session (hook.ts:1371); long goal sessions still lose continuation silently. A per-real-user-turn budget keeps the unattended bound. |
| #255 SessionStart writes session state into every cwd | REAL | partial fix: `.codexclaw/.gitignore` on first directory creation (011_issue255_codexclaw_gitignore.md); lazy creation deferred | `handleSessionStart` calls `ensureState` unconditionally (`hook.ts:572-575`, `state.ts:368-381`). The issue is low severity and offers an ignore-file alternative. Audit round 3 showed that stateless sessions affect executor evidence and goal-complete gates (`goal-gate.ts:215-236`) and conditional atomic publication (`state.ts:607-617`); lazy creation needs its own design. |
| #256 independent verification receipt | PROPOSAL | defer | Receipts store a joined command string with no argv, cwd or output digests (receipt-cli.ts:170-172); a rerun cannot be reconstructed reliably yet. |
| #257 strict accepted-progress report | PROPOSAL | defer | Review rounds attach to plan audit, not completed work (review-round-cli.ts:230-235); needs a post-implementation acceptance record first (#256). |
| #258 verbatim archive of user-typed prompts | PROPOSAL | defer | UserPromptSubmit carries no typed-versus-injected provenance (hook.ts:134, parse.ts:65); the archive cannot promise what it claims. |
| #259 provenance on peer prompts | PROPOSAL | defer | An unauthenticated text envelope that suppresses PABCD parsing would let anyone type it; needs authenticated sender metadata from the host. |
| #260 unit fields and cxc loop check | PROPOSAL | defer | Fields would be dropped by the reviver today (goalplan.ts:548); the external-wait part is covered by #262's decision links. |
| #261 reviewer panel per round | PROPOSAL | decline | Turning lanes and synthesis into gates reverses the deliberate non-blocking review round (orchestrate-cli.ts:65); parallel reviewers already work under guidance. |
| #262 pending decisions in goalplans | PROPOSAL | implement (030) | Opt-in plan-local record; readiness derives waits from open decisions. |
| #263 PreCompact checkpoint hook | PROPOSAL | defer | Codex supports PreCompact (hooks/src/schema.rs:347), but the proposal adds several stores; revisit after #255 settles cwd writes. |
| #264 measured-state snapshot after compaction | PROPOSAL | defer | Readers map absence to defaults (state.ts:486) and bg listing writes corrections (registry.ts:110-154); needs a strict read contract first. |
| #265 on-disk progress checkpoint for workers | PROPOSAL | guidance only (021) | Useful as a packet convention; a new CLI verb is not needed yet. |
| #266 host hygiene doctor | PROPOSAL | defer | Process ownership across platforms is not establishable; bg reconcile writes (registry.ts:106-146). |
| #267 suggested wave width | PROPOSAL | defer | Family, native limit and open-child count are not observable at SessionStart (dispatch-card.ts:24-36). |
| #268 compact-at-clean-boundary advisory | PROPOSAL | defer | No token usage parsing exists and Stop systemMessage display is unverified (stop.rs:288). |

Declined and deferred issues stay open with a comment linking this record, except #261, which is closed as declined. #255 also stays open after its partial `.gitignore` fix, with the PR linked and lazy creation deferred.

## Agent-created thread permissions (no issue)

Measured on this Mac on 2026-09-27. Rollouts with `thread_source=agent_created_thread` started with `approval_policy=on-request` and `workspace-write` in 7 of about 356 September cases (plus 8 archived on 09-23), including a projectless thread on 09-27, while their parents ran `never` with `danger-full-access`. The Desktop per-thread store held 5 `:workspace` entries out of 1,159. The only command-approval responses in the retained Desktop logs (05:06 and 08:53 UTC on 09-27) came from such children; thread `01a0e145` contains the exact `git fetch origin dev --quiet` command approved at 08:53. Subagents followed their parent in every case (5,336 never to never, 40 on-request to on-request). Codex runs PermissionRequest hooks before the user approval UI (codex-rs/core/src/tools/approvals.rs:505-525), and the bundled runtime 0.158.0-alpha.2.1 contains that path. Upstream: openai/codex #33282, #40793, #41167.
