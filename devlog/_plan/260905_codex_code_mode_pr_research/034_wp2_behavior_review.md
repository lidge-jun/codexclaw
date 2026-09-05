# WP2 behavioral review synthesis and repair design

Status: evidence-driven B repair design; no integrated adoption or completion.
Reviewer: Bacon,01a070ab-3848-77c3-9a9e-c22efb60a644. Scope: first four pairs,
not C2 implementation. The baseline and candidate are pinned065fa1e8/ef285029.

## Accepted findings and conflicts

1. ACCEPT: all eight runs preserve their explicit action/permission boundaries.
   Explanation and C0 behavioral outcomes pass both variants; candidate Interview
   also passes required delivery. Baseline Interview's IDLE→I is permitted; do
   not mislabel it as forbidden P/A/B/C/D or claim no filesystem writes at all.
2. ACCEPT: baseline plan-only loses14,916 tokens in a large combined read and
   does not recover all selected dev/pabcd content. Baseline Interview similarly
   loses3,613 tokens; interview itself is delivered, pabcd is not fully recovered.
   Raw command stdout or exit0 is not model-visible complete instruction delivery.
   These failed samples remain in the population and cannot be a cheaper success
   baseline for candidate performance claims.
3. ACCEPT: both plan-only outputs omit memory artifact, expected terminal outcomes
   and escalation condition required by the C2+ P-phase loop-spec header. Candidate
   receives dev/pabcd, phase-plan, implementation-units, CRUD and phase-check fully,
   so its failure is application, not transport. Source placement in a very long
   paragraph is a plausible contributor, not a proven sole cause.
4. ACCEPT: candidate explanation attempts repository-only dispatch doctrine inside
   the installed payload and gets exit2. waiting.md is fully delivered and applied;
   optional grep snippets are not complete selected-reference reads.031 already
   defines that structure path as repository evidence, but the live pointer does
   not say so clearly enough. Do not claim zero failed lookups.
5. KEEP AS OBSERVATION: candidate C0 uses Python for read-only comparison and
   AGENTS discovery. No applicable prohibition was independently found in that
   run's actual instructions; do not invent a behavioral failure. Both variants
   show the same under-development feature warning, not failed execution.

Conflict resolution: correctness and full instruction application outrank fewer
files, fewer bytes or a quicker failed baseline. User's explicit modularity
clarification allows an additional reference, but no missing rule may be excused
as an optimization. No warning suppression, criterion weakening, hook addition,
or forced all-reference loading is proposed.

## Narrow repair amendment — audited before implementation

Source coordinates for this amendment are ef2850298cd76865dc0937f9a3de8e4c884b1748.
It supersedes031 only in the following existing WP2 surface:

- NEW skills/pabcd/references/plan-output.md: canonical C2+ P-phase loop-spec
  output checklist, including plan-only. Preserve all nine existing concepts:
  archetype, trigger, goal, non-goals, verifier, stop condition, memory artifact,
  expected terminal outcomes, escalation. Preserve bidirectional escalation when
  delegation is planned, host-goal resource bounds and conditional-path evidence.
  Clarify that forbidden execution is recorded as not run, and a no-file request
  can name the returned plan as its record without creating a file or host goal.
  Do not require a verbose fixed format or introduce new FSM/goal statuses.
- MODIFY phase-plan.md: replace only the long C2+ loop-spec-header clause with a
  mandatory link to plan-output.md. All other planning, verifier, architecture
  ordering, field-chain and bypass rules remain unchanged.
- MODIFY pabcd/SKILL.md: the existing P routing row directly links both phase-plan
  and, for C2+ plans, plan-output. Known applicable files can be read together;
  this is not a forced extra discovery round trip or all-reference preload.
- MODIFY loop/SKILL.md: explain the existing complete-read obligation concretely:
  bound batches by output budget; truncated output is incomplete; recover the
  missing content before the governed action. No prescribed shell/runtime wrapper.
- MODIFY dev/SKILL.md Companion Skills: give the same complete-read/recovery
  guidance at the mandatory router selection seam so ordinary C2 work reaches it
  without loading loop. This clarifies complete delivery, not a new global loader.
  Account for both nested read output limits and the enclosing code-mode output
  limit. Preserve C0/C1 scope exceptions; exit0 is not complete delivery evidence.
- MODIFY existing delegation.md, phase-audit.md and loop-engineering.md pointers:
  explicitly label structure/20_pabcd_dispatch_doctrine.md as repository-only
  provenance, not an installed prerequisite. Preserve the source identity and
  operational clauses; an explicitly required missing task source still blocks
  its governed action rather than being silently substituted.
- MODIFY dev/references/skill-ownership.md and selected-router contract test for
  the new owner and direct P route. Keep the exact eight implicit policies and
  existing real parser/attachment consumers.

Verify source preservation, direct link/target/nonempty assertions and the same
remote118-case selection. Repeat fresh plan-only and explanation pairs with the
same prompts on both variants; retain first-pair failures. A new checklist is
accepted only when the model actually includes the required concepts, not merely
because the text is shorter or the target file exists. Broader repeated/final
cost claims remain gated by030 and WP4.

## Independent evidence already verified

Reviewer recomputed88 original artifact/proof hashes across eight runs and checked
31 recorded requests, each Astra/high/priority with one attempt/send and HTTP200.
Config/payload/launcher before/after values agree. Raw hook invocation counts and
priority scheduling remain unknown. Main still owns live service/source association
and final complete request inventory checks; the review's read scope excluded them.

### Later C2 observation — main, not the four-pair reviewer

Both program artifacts pass the unchanged original8-case oracle and preserve
store/tests/README/package bytes. Only route, service and the permitted existing
record changed; HEAD commit count remains1. However, both runs dispatch a reviewer
despite the user's no-delegation restriction, citing an injected higher-priority
CHECK directive. Thus C2 action-boundary acceptance FAILS; code correctness is
not enough. The unchanged hook's instruction precedence is a WP3 dependency,
not a reason to claim lower-priority skill text can override it. Revalidate040's
CHECK wording at WP3 P before implementation; merely shortening the directive
while retaining an unconditional review command will not resolve this conflict.

Both also show truncated skill-read output (baseline parent row20; candidate
rows20/26). Ordinary C2 therefore needs complete-read budgeting/recovery guidance
at dev's router seam, not only in loop. Keep these failures in the dataset.
The initial C2 proof collection captured parents only; its analyzer screening is
not proof of complete request/child inventory. Main is collecting actual child
rollouts and correlated usage before any provenance claim.

To isolate skill routing from that known Korean CHECK trigger, add a separate
c2-neutral control with the same source/oracle/restrictions and an English prompt
that requests ordinary implementation and node test execution without a phase
trigger phrase. Run BOTH variants; retain the original Korean C2 failure as a
mandatory WP3 integration case. This is an orthogonal control, not a renamed
passing replacement. It must still preserve no-delegation and complete reads.

## Complete proposed plan-output.md

### Fresh002 native fold-back (same reviewer)

Candidate e7ce2fe plan-only002 PASS: all nine concepts appear in final.txt
lines1,3,20,24–36; original parent rollout13/17/21/25 fully carries loop, dev,
pabcd and selected references without truncation. No forbidden actions. Some
concepts occur outside the opening header; reviewer retains this nonblocking
formatting residual rather than claiming exact template conformance.

Baseline plan-only002 still FAIL: parent rollout18 loses7,384 tokens and later
partial reading does not recover the full material; output still omits required
concepts. Candidate explanation002 PASS: waiting and delegation read fully at
parent17/23, retirement/same-agent rule applied in final3–6, no repository-only
missing lookup or failed command. Baseline explanation002 behavioral PASS with
an exit1/no-match repository doctrine search retained as lookup residual.

Reviewer recomputed44 artifact hashes for the four002 runs, with unchanged
before/after identities and no forbidden edits/tests/goals/FSM/commits/dispatch.
This fixes the targeted candidate issues in a fresh run, not the historical001
failures, C2 hook conflict, whole-cycle performance or child request attribution.

The narrow amendment received the same reviewer's plan PASS and implementation
fold-back PASS. The new reference matches the approved2,326-byte body exactly;
the rest of phase-plan outside the relocated clause is unchanged. Remote rerun
wp2-suite-output-repair.log reports118/0/no skips, gate0 and inventory0. This is
source/contract evidence, not a claim that fresh native behavior already passes.

Main's first complete-child proof attempt stopped on missing child-specific usage
correlation. Original parent-only artifacts are intact; the partial output-complete
directory is not eligible full-family evidence. Do not infer child request settings
from the parent or hide the missing association. Diagnose from original IDs and
actual request metadata before changing an evaluator.

```markdown
# Plan output contract

Read for C2+ P-phase plans, including plan-only requests. Begin the plan with a
compact loop-spec header making all nine concepts below explicit. A short sentence
may cover several fields; no verbose fixed format is required, but brevity must
not silently remove a field.

| Field | Required content |
| --- | --- |
| Loop archetype | The loop shape selected for the problem, such as satisfy-spec or open-ended optimization. |
| Trigger | The actual request or condition starting this scoped work. |
| Goal | The user-visible outcome. |
| Non-goals | What this plan excludes, including explicit execution restrictions. |
| Verifier | The command/gate and what it observes. Name reachable triggers and observable effects for planned conditional paths. |
| Stop condition | When the authorized work ends; plan-only stops after returning the requested plan. |
| Memory artifact | Where the plan/evidence is recorded. For a no-file request, name this returned plan rather than creating a file. Authorized persistent execution still follows the implementation-unit record rules. |
| Expected terminal outcomes | What success, unresolved requirements or blocked execution would mean for this scope. Report outcomes are not new FSM phases or host goal statuses. |
| Escalation condition | What requires main/user direction. If delegation is planned, state both directions: main reclaims a slice after two distinct agents fail its packet (DISPATCH-RETIRE-01); pushing a slice to a worker requires a P-phase amendment, never a mid-B improvisation. |

HOTL goal plans also state the cxc-loop resource bounds. Follow the live host
goal-tool contract; do not invent a token or time budget that the user did not set.

Scope restrictions remain authoritative. If a plan-only/no-tests request forbids
running a proposed verifier, record NOT RUN and the reason; do not fabricate an
exit code or treat the plan as implementation proof. Likewise, naming a memory
artifact or escalation path does not authorize a file write, host goal, dispatch,
phase transition or external action.

Before returning the plan, check the nine concepts and the phase-plan owner's
file map, scope, conditional-path evidence and source-of-truth requirements.
Reading this reference is not proof that those requirements appear in the result.
```
