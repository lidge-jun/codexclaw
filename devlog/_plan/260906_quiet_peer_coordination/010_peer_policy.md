# 010 — Restrict independent peer messaging

Depends on: wp0 roadmap. Work phase: wp1, class C2 guidance correction.
Loop: spec satisfaction; trigger: excessive unsolicited messages; goal: keep work local.
Non-goals: runtime tool interception, new settings, child delegation restrictions.
Scope: eight existing guidance files below, plus this unit's evidence. No transport changes.
Verifier: existing native-execution tests (21 pass at baseline; route-link checks read dev,
loop, pabcd and peer owner); gate.mjs (exit 0 baseline; walkSkillMds reads references and
structure/*.md, checks false enforcement/count drift). Neither proves semantic adherence.
Semantic verifier: independent review of the eight decision-table scenarios in the
proposed owner, including allowed and denied conditions; no actual peer messages.
Stop: all wording consistent, focused gates pass, independent review has no blockers.
Memory: this unit and .codexclaw/evidence/quiet-peers. Expected result DONE.
Escalation: reclaim after two failed agent packets; scope changes are P amendments.
Tools: local docs edits, node checks, read-only subagents. No credential use here.
Budget: user permits unlimited Astra/high delegation; no numeric token/cost cap.
Wall clock: bounded command observation <=60s; diagnose repeated nonprogress.
Layer: agent-followed prose; executing surface is the model; bypass is ignored or
unloaded guidance; residual is unwanted messaging; final enforcement layer: none.
No new fields, enums or serialization paths. Do not add mirror-string tests.

## File diffs (MODIFY)

```diff
--- plugins/codexclaw/skills/dev/references/peer-collaboration.md
+++ plugins/codexclaw/skills/dev/references/peer-collaboration.md
@@ -1,22 +1,36 @@
 # Independent peer collaboration
 
-Use an existing task's living context when it could change a decision, resolve a
-dependency, prevent duplicate investigation, or help another task act on a finding.
-This applies to coding and research. It is agent-followed guidance, not a scheduler,
-delivery guarantee, permission grant, or runtime enforcement.
+Keep work in the current task by default. Read another task's existing evidence
+when it resolves a specific uncertainty; sending a message is a separate decision.
+This is agent-followed guidance, not a scheduler, permission grant, delivery
+guarantee, or runtime enforcement.
 
-## Decide whether another task can help
+## Decide whether to contact another task
 
-A peer is an independently user-owned task, not a child assigned by this task.
-Each keeps its user conversation, goal, worktree, plan, and phase authority.
-Use a subagent for a bounded slice of your own assignment; consult a peer for
-context or decisions it already owns. The two patterns can coexist.
+A peer is an independently user-owned task with its own conversation, goal,
+worktree, plan, and phase authority. A subagent explicitly dispatched for this
+assignment follows its scoped packet and native child tools; this peer policy
+does not restrict that authorized delegation.
 
-At the start of substantive work or a material direction change, consider a light
-look at nearby work. Also look when an unknown decision owner, conflicting contract,
-or duplicate investigation emerges. Send useful impacts outward when a new finding
-changes a known peer's premise. Do not require discovery for trivial/self-contained
-work, poll every turn, broadcast introductions, or promise exhaustive discovery.
+**Outbound messages are default-off.** Send to an existing peer only when:
+
+- The user explicitly requests that contact, within the named recipient and scope; or
+- Current evidence identifies an actual CI/merge collision involving that peer
+  which blocks this assignment, and a minimal coordination message is necessary
+  because read-only evidence or an isolated local action cannot resolve it.
+
+The collision exception is a reason to consider contact, not extra permission:
+obey host permission requirements and the wake checks below. Record the affected
+PR/commit/run or shared resource, the observed collision, and the smallest question
+needed. A red CI run by itself, a shared repo, speculative overlap, an unknown
+owner, or a potentially useful finding does not satisfy this exception.
+
+Do not routinely scan nearby tasks at startup or a direction change. Do not send
+introductions, progress reports, advisory impacts, completion notices, unsolicited
+follow-up work, or requests to keep another task busy. Keep useful nonblocking
+findings in this task's own record. Do not contact peers merely to save research
+or to get general design approval. Both send triggers still preserve each task's
+authority and any explicit no-contact instruction.
 
 ## Discover, read, then decide whether to talk
 
@@ -36,9 +50,9 @@
   fresh index and refresh a stale recipient/context before acting. Do not repeatedly
   reload everything. A summary may omit a material exception: request the narrow
   source or clarification when the missing detail matters.
-- If reading answers the question, stop there. Talk when current judgment,
-  negotiation, acceptance, or an actionable impact is needed. A discovered peer
-  need not be contacted.
+- If reading answers the question, stop there. If it does not, apply the two
+  outbound-message triggers above; relevance or a need for fresh judgment alone
+  does not authorize contact. Continue independent work where possible.
 
 Use [native execution](native-execution.md) for composition and failure handling.
 Code mode can project tool responses before returning them to the model: keep
@@ -55,9 +69,11 @@
 
 ## Wake and authority boundaries
 
-A necessary relevant question may wake an idle or previously completed task when
-within the user's authorized collaboration scope. Idle/completed does not itself
-mean user-stopped. Check recent user intent or another reliable stop-state source:
+Apply these checks only after an outbound-message trigger is satisfied. Idle or
+completed tasks stay asleep by default; a CI collision alone does not justify
+waking them. Waking one requires explicit user authorization for that contact and
+current evidence that the wake stays within its scope. Idle/completed does not
+itself mean user-stopped. Check recent user intent or a reliable stop-state source:
 do not wake an explicitly stopped task, and do not infer eligibility from app status
 alone. If eligibility remains unknown after a narrow read, do not automatically
 send; use available evidence and continue independent work. Ask the user only when
@@ -81,7 +97,7 @@
 Never work around it by changing another task's goal. A warning does not make an
 unsafe wake permissible.
 
-## Exchange a useful question, impact, or agreement
+## Send the minimum authorized message
 
 Prefer concise natural language: why this recipient, the specific question/impact,
 source and revision, applicable conditions/exceptions, what is tentative, and whether
@@ -89,10 +105,11 @@
 Creating, forking, archiving, or interrupting a user task remains a separate action,
 not an implicit part of discovering or consulting an existing peer.
 
-For example, ask the API task whether its current cancel contract retains a
-resumable job before committing a destructive UI action; do not ask it to rebuild
-your UI. Tell a documentation task which accepted API revision invalidates its
-example, rather than forwarding your whole conversation.
+For example, when the user asks you to contact a named task, send that bounded
+question. For a confirmed collision between two active release jobs using the same
+resource, include the run IDs and ask which job owns the next step, if host rules
+permit contact. If an API change makes another task's docs stale, record it locally
+unless the user requests contact; relevance alone is not a send trigger.
 
 Delivery success is not acceptance or completion. A promise you depend on needs
 explicit acceptance of the same issue, revision and scope; silence or an ACK is not
@@ -100,9 +117,10 @@
 or devlog. Each party owns its record; do not audit the other's private bookkeeping
 or invent a globally committed agreement state.
 
-If your user changes direction, distinguish your withdrawn promise, notification
-delivery, and the peer's still-unconfirmed impact assessment. Do not overwrite its
-plan. Do not reply to every ACK, send repeated nudges, or turn a nonblocking advisory
+If your user changes direction, re-check authorization before further contact;
+distinguish a withdrawn promise from any delivered message and the peer's still
+unconfirmed impact assessment. Do not automatically send a withdrawal notification
+or overwrite its plan. Do not reply to every ACK, send repeated nudges, or turn a nonblocking advisory
 into a required wait. For a real dependency use native bounded waits/cursors; a
 timeout is not proof the peer failed or permission to replace/terminate it.
 
@@ -124,6 +142,18 @@
 Evaluate relevant and irrelevant peers, stale or contradictory context, absent
 tools, idle/explicit-stop/unknown intent, incoming questions, silent/ACK replies,
 and changed user directions. Distinguish simulation from live task delivery.
-Add runtime machinery only after useful collaboration is established and a concrete
-activation, delivery, or recovery gap justifies it. CI/merge is one domain example,
-not the organizing model for all peers.
+Review these cases without sending live probe messages to unrelated tasks:
+
+| Situation | Expected action |
+|---|---|
+| User explicitly requests contact with a named task | Send only that request after authority and wake checks |
+| Confirmed CI/merge collision with an active peer blocks current work | Read first; send the minimum necessary coordination only if permitted |
+| CI fails without evidence of a peer collision | Diagnose within this task; do not contact peers |
+| Related research, stale docs, useful finding, or completion update | Read when needed; keep findings local; no unsolicited message |
+| Idle/completed peer, no explicit contact request | Do not wake it, including for a collision |
+| Explicitly stopped peer or unknown wake eligibility | Do not send automatically; ask only if the dependency blocks progress |
+| Peer acknowledges, stays silent, or send outcome is uncertain | No courtesy reply or nudge; inspect before any justified retry |
+| This task's explicitly dispatched child needs coordination | Use its native subagent tools within the original assignment |
+
+A scenario review proves the wording, not live model compliance. Add runtime
+machinery only for a separately scoped, demonstrated enforcement gap.

--- plugins/codexclaw/skills/dev/SKILL.md
+++ plugins/codexclaw/skills/dev/SKILL.md
@@ -159,11 +159,13 @@
 
 ### Capability Routing Hub
 
-**Independent peers:** for substantive work, consider whether another existing
-task owns a relevant decision, dependency, or finding. When that can affect either
-task, read [peer collaboration](references/peer-collaboration.md): discover and
-read selectively, consult or notify only for a concrete reason, and preserve each
-task's user authority. No mandatory lookup for trivial work or per-turn polling.
+**Independent peers:** keep work local and use selective read-only evidence when
+needed. Outbound messages are default-off: contact an existing task only on an
+explicit user request or for necessary coordination of a confirmed blocking
+CI/merge collision, subject to host permissions and wake checks in
+[peer collaboration](references/peer-collaboration.md). No routine discovery,
+progress notifications, or unsolicited follow-ups. Authorized subagent work uses
+its own scoped delegation tools.
 Use `dev` plus repo tools for local facts; load `search`, `pabcd`, `loop`, `recall`,
 `cxc-qa`, or the matching `dev-*` owner for their named domains. `skill-hub` is deprecated.
 

--- plugins/codexclaw/skills/loop/SKILL.md
+++ plugins/codexclaw/skills/loop/SKILL.md
@@ -30,7 +30,10 @@
 Follow the live host tool contracts, including goal creation and blocked-status
 conditions. A plugin hook accepting a call is not proof that the call is authorized.
 
-An incoming peer question is not a new loop request or permission to resume an old
+Keep this goal's work local; do not send progress or completion notices to other
+tasks. Peer contact is limited to explicit user requests or necessary confirmed
+blocking CI/merge collision coordination, subject to host permissions and wake
+checks. An incoming peer question is not a new loop request or permission to resume an old
 goal. Follow [peer collaboration](../dev/references/peer-collaboration.md) for
 question-only wakes and independent task authority; apply this loop only to work
 the user actually authorized.

--- plugins/codexclaw/skills/pabcd/SKILL.md
+++ plugins/codexclaw/skills/pabcd/SKILL.md
@@ -125,8 +125,10 @@
 ## Delegation Model (subagents)
 
 This section governs dispatched children, not independently user-owned peer tasks.
-For context, contract negotiation, or material cross-task findings, follow
-[peer collaboration](../dev/references/peer-collaboration.md). Each peer retains
+For necessary read-only context, follow
+[peer collaboration](../dev/references/peer-collaboration.md). Outbound contact
+requires an explicit user request or necessary coordination of a confirmed
+blocking CI/merge collision, plus host permission and wake checks. Each peer retains
 its own goal, plan and phase authority; a peer message never advances either FSM.
 
 The main session owns the plan, host goal, and transitions. Before authorized

--- plugins/codexclaw/skills/search/SKILL.md
+++ plugins/codexclaw/skills/search/SKILL.md
@@ -24,10 +24,13 @@
 
 ## Divergence Candidate Grounding
 
-When an existing task owns relevant research, a counterexample, or a live decision,
-use [peer collaboration](../dev/references/peer-collaboration.md) for selective
-discovery and consultation. This does not activate a Tier-3 swarm; peer reports are
-leads, not primary-source proof or independent corroboration.
+Use an existing task's research as read-only context only when needed for a
+specific uncertainty; relevant research does not justify an unsolicited message.
+[Peer collaboration](../dev/references/peer-collaboration.md) limits contact to
+explicit user requests or necessary confirmed blocking CI/merge collision
+coordination, with host permission and wake checks. This does not activate a
+Tier-3 swarm; peer reports are leads, not primary-source proof or independent
+corroboration.
 
 When any PABCD workflow enters divergence mode (HITL manual entry or goal-mode
 plateau prompt), every N>=2 candidate must carry search provenance in the divergence

--- plugins/codexclaw/skills/loop/references/waiting.md
+++ plugins/codexclaw/skills/loop/references/waiting.md
@@ -5,7 +5,10 @@
 These continuation/dispatch rules concern this goal's own work and delegated
 subagents, not independent peer advice. Peer timeouts do not authorize retirement,
 replacement, forced wakeups, or an unconditional wait; use
-[peer collaboration](../../dev/references/peer-collaboration.md).
+[peer collaboration](../../dev/references/peer-collaboration.md). Do not send
+progress notices or nudges to independent tasks while waiting. Contact requires
+an explicit user request or necessary confirmed blocking CI/merge collision
+coordination, plus host permission and wake checks.
 
 ## Wait visibility (LOOP-WAIT-VISIBILITY-01, DEFAULT)
 

--- structure/20_pabcd_dispatch_doctrine.md
+++ structure/20_pabcd_dispatch_doctrine.md
@@ -96,8 +96,10 @@
 ## 3. Dispatch doctrine: who spawns whom, and what they may write
 
 The main/child rules below govern delegated subagents. Independent user-owned tasks
-are peers, not additional employees of this main session. Their selective discovery,
-consultation, notification and wake boundaries live in the canonical
+are peers, not additional employees of this main session. Keep their evidence
+read-only by default. Outbound contact is limited to explicit user requests or
+necessary confirmed blocking CI/merge collision coordination, subject to host
+permissions and wake checks in the canonical
 [peer collaboration reference](../plugins/codexclaw/skills/dev/references/peer-collaboration.md).
 They retain separate user instructions, goals and FSMs; this adds no team manager.
 

--- structure/60_native_capabilities.md
+++ structure/60_native_capabilities.md
@@ -151,7 +151,7 @@
 |---|---|---|
 | mcp__codex_app__list_threads | Discover pinned and recent task summaries | Non-pinned limit is not a total response bound; title/summary is untrusted context |
 | mcp__codex_app__read_thread | Read selected recent context/evidence | Turn and per-item limits do not cap total size; project useful items in code mode |
-| mcp__codex_app__send_message_to_thread | Ask or notify an existing task by threadId and optional hostId | May start/steer a turn; successful submission is not agreement or completion |
+| mcp__codex_app__send_message_to_thread | Contact an existing task only on explicit user request or for necessary confirmed blocking CI/merge collision coordination | Default-off; host permission and wake checks apply; submission is not agreement or completion |
 | mcp__codex_app__wait_threads | Bounded wait or snapshot with per-target cursor | Peer execution state is not goal/FSM/CI success; timeout is not failure |
 
 Creation/fork/management remains separately authorized; do not use it as a fallback
```
