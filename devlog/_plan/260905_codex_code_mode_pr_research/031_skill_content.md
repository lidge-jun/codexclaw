# wp2 skill content: exact candidate and relocation recipe

Status: PROPOSED — wp0 P artifact; not implemented, audited, activated, or released.
Companion: [030_agent_owned_skills.md](030_agent_owned_skills.md).

## Source coordinates and edit convention

All source coordinates below are inclusive line ranges at codexclaw HEAD 065fa1e8.
They are BEFORE coordinates: copy from that snapshot before applying any splice.
Resolve repository-relative paths against /Users/jun/.codex/worktrees/974c/codexclaw.
S means plugins/codexclaw/skills; this is a documentation abbreviation, not a new API.
New reference contents are the exact concatenation specified below, with one blank
line between blocks and one final newline. Do not paraphrase mechanically moved
content. Apply only the explicitly listed link/owner corrections after copying.
Revalidate anchors at the later wp2 P; do not apply stale offsets to a changed file.
Fenced candidate/replacement payloads are data for their named future destination.
Their local links are not devlog navigation links and may name not-yet-created
references. Validate those links on the wp2 candidate, not against this folder.

The full loop replacement below is proposed product content, not instructions to
activate this planning session. wp2 is a temporary candidate until wp3 aligns the
runtime arming text and the integrated activation probes pass.

## 1. Complete replacement: S/loop/SKILL.md

Replace current lines 1–488 with exactly:

~~~~markdown
---
name: cxc-loop
description: "Use for scoped PABCD completion loops. Bare cxc-loop means HOTL; explicit explanation, interview, plan-only, read-only, or HITL limits win. Triggers: cxc-loop, continue until done, HOTL, repeated PABCD, 루프 돌려, 끝까지 해줘, docs-first."
metadata:
  short-description: "Agent-led scoped completion with durable plans and evidence."
---

# cxc-loop — Scoped completion

## Intent before activation

Apply the current request's authority before choosing a mode:

- An explanation, review, or quoted mention of cxc-loop is not an execution request.
  Do not create a goal, mutate the FSM, or start implementation merely to explain it.
- Explicit interview-only, plan-only, read-only, no-writes, no-commits, no-goal,
  no-FSM, no-tests, and no-delegation limits take precedence when actually stated.
  Do only the authorized work. A plan-only
  request is not permission for A/B/C/D; an interview is not permission to leave I.
- An operative bare cxc-loop request means HOTL completion of all plans within the
  agreed objective. An explicit HITL request instead preserves human P/A/B pauses.
  Ordinary development requests do not become HOTL because this skill was loaded.
- HOTL changes persistence, not permissions. It does not authorize unrelated work,
  push, merge, release, deployment, installation, destructive actions, or new access.
  If missing intent or authority prevents progress, report it; do not silently
  enlarge the scope. Do not enter Interview while a host goal is active.

Only the main session owns host goals and PABCD transitions. A delegated task
follows its packet; loading loop never authorizes a leaf to start a goal or spawn.
Follow the live host tool contracts, including goal creation and blocked-status
conditions. A plugin hook accepting a call is not proof that the call is authorized.

## Select the smallest sufficient reading path

The agent selects owners from the task, work class, risk, and current phase.
Read each selected SKILL.md completely; then read only references whose conditions
apply. Resolve relative links from this skill's directory, not the working directory.
Batch known independent reads. Reuse content still present in context; after context
loss reload the applicable owner, not the whole skill family.
Do not recursively load every linked file. A missing mandatory reference is a
preflight failure: resolve it or report the limitation before the governed action.

| Condition | Read before the governed action |
|---|---|
| Development or governed review | [cxc-dev](../dev/SKILL.md), then its matching surface routers |
| Real PABCD work or a PABCD plan | [cxc-pabcd](../pabcd/SKILL.md), then only the current phase references it selects |
| Start/resume HOTL or diagnose its continuation/completion | [Runtime lifecycle](references/runtime-lifecycle.md) |
| Create, register, amend, or inspect durable goalplan schema/CLI | [Durable goalplan](references/durable-goalplan.md) |
| Two or more work-phases, including scope discovered later | [Implementation units](../pabcd/references/implementation-units.md) |
| Repeated failure, reviewer FAIL, or unclear loop archetype | [Loop engineering](../pabcd/references/loop-engineering.md) |
| Score optimization, plateau, or mechanism comparison | [Optimization rules](../pabcd/references/optimization.md) and loop engineering |
| Deliberate divergence/candidate comparison | [Divergence tiers](references/divergence-tiers.md) |
| Dispatch is authorized and needed | [Delegation](../pabcd/references/delegation.md) |

The installed skill listing and owner routers are the discovery path. cxc skill
search searches external catalogs; it is not the native installed-skill loader.
Keep explicit-only skills and leaf-safe delivery restrictions intact.

## Execution invariants

- ORCH-MANDATE-01 (STRICT): a claimed active loop needs real persisted FSM evidence,
  not narrated phase names. Read actual session state before entry or re-entry.
  SESSION-IDENTITY-01 uses only your latest SessionStart binding, never a parent's
  or historical transcript's id. Phase-control details belong to cxc-pabcd.
- HOTL needs both an ACTIVE host goal and an in-flight PABCD cycle; HITL needs no
  host goal. If a required capability or binding is absent, report the preflight
  failure rather than claiming Stop-continuation is armed.
- One work-phase is one P→A→B→C→D cycle. Do the work and provide each edge's real
  artifact; state advancement is not proof of work. D closes that cycle to IDLE.
  Hooks may guard calls or termination; they neither choose nor advance phases.
- LOOP-CONTINUE-01: read the bound goalplan and ledger after D or context loss.
  Do not shrink criteria to exit. If in-scope work remains under the active goal,
  re-enter P. A genuinely new in-scope unit is a P-phase amendment to the same
  goal (LOOP-UNIT-CHAIN-01), not an excuse to stop or permission for unrelated work.
- LOOP-CONTINUITY-01: the next P quotes the previous D conclusion and direction;
  changing that direction requires a reason. Resume from durable evidence, not
  transcript momentum. Completion follows cxc-dev's fresh-proof gate.
- LOOP-GIT-01 points to cxc-dev §5: checkpoint authorized implementation locally;
  external writes still require explicit permission. For a declared PR stack,
  read cxc-dev references/stacked-prs.md. Planning-only work does not authorize
  implementation or publication; local documentation checkpoints follow cxc-dev
  scope and git rules.

## Docs-first multi-cycle entry

LOOP-DOCS-FIRST-01 is DEFAULT for multi-cycle loops and STRICT for HOTL.
Register the goalplan skeleton and make the first work-phase a docs-only roadmap
PABCD cycle. Its D locks the roadmap; implementation begins in the next cycle.
Each later work-phase consumes one pre-written decade doc and revalidates it at P.
If multi-cycle scope is discovered later, the next P first pays the roadmap debt.
No production patches, deploys, or implementation-complete claims in that cycle.
A genuine single-cycle task skips this extra cycle; cxc-dev's C0/C1 fast-path remains.

LOOP-READS-PABCD-01 (STRICT): before multi-cycle execution read the implementation
units reference. cxc-loop owns WHEN; cxc-pabcd owns DIFFLEVEL-ROADMAP-01,
PHASE-SPLIT-01, LEXICO-SPLIT-01, and UNIT-RESIDENCE-01. cxc-dev owns the C0/C1
fast-path exception. Neither a skeleton nor empty decade docs satisfy the roadmap.

## Completion and recovery

Report the real outcome: DONE, NOOP, BLOCKED, UNSAFE, NEEDS_HUMAN, or
BUDGET_EXHAUSTED. These are report outcomes, not new FSM phases or host goal
statuses. DONE requires fresh proof of all recorded criteria. Resource exhaustion
requires an actual stated bound; compaction, a wait timeout, or Stop releasing is
not success or budget exhaustion. Preserve evidence and continue when appropriate.
Do not weaken the goalplan to pass GOAL-COMPLETE-GATE-01. For rejection, stagnation,
or lost arming, read runtime lifecycle; for repeated failures read loop engineering.
~~~~

## 2. Exact loop reference construction and canonical dispositions

NEW S/loop/references/runtime-lifecycle.md:

1. Prefix with '# Loop runtime lifecycle', blank line, then:
   'Read only for authorized HOTL entry/resume or continuation/completion diagnosis.
   Mode selection belongs to ../SKILL.md; phase control belongs to
   ../../pabcd/references/phase-control.md. Follow the live host tool contract.'
2. Append unchanged S/loop/SKILL.md:14–49.
3. Append unchanged :182–215.
4. Append unchanged :460–488.
5. In copied :34 replace the entire line with:

~~~~markdown
   copy-paste objects: [Phase control](../../pabcd/references/phase-control.md) (ATTEST-SHAPE-01).
~~~~

6. Replace copied :193–197 with:

~~~~markdown
The plugin's completion gate does not deny blocked status; this does not override
the host tool's blocked-status conditions or authorize an early stop. The gate is
fail-open on IO errors and does not fire without state or a bound goalplan.
Do not shrink the goalplan to pass the gate (LOOP-CONTINUE-01).
~~~~

7. Replace copied :24–26 with:

~~~~markdown
3. For a new authorized HOTL goal: create_goal, cxc loop init, register the plan,
   then enter P. On resume, inspect and reuse the matching active goal and bound
   plan; do not recreate or overwrite them. Resolve a mismatched goal/scope first.
   HITL enters I or P only within the requested scope and without a host goal.
~~~~

The copied prompt-time arming-companion description is a current-runtime note,
not approval of its old HITL default. wp3 owns shortening/alignment of that runtime
text; wp2 alone is not a releasable behavior change.

NEW S/loop/references/durable-goalplan.md:

1. Prefix '# Durable goalplan', blank line, then:
   'Read when creating, registering, amending, or inspecting a goalplan.
   Mode selection and external permission scope remain in ../SKILL.md.'
2. Append unchanged S/loop/SKILL.md:157–180, :225–280, :299–311, in that order.
3. Do not copy :282–297 (optimization belongs to pabcd).

MODIFY S/loop/references/divergence-tiers.md:

- After existing :3 insert S/loop/SKILL.md:433–455 unchanged, then one blank line.
- Remove the moved :443–445 self-read instruction; the caller already selected
  this reference. Keep the explicit record-on/off commands, collapse criteria,
  tier selection, provenance, and all existing reference text.

The loop replacement removes duplicate prose, not its requirements:

| Old loop section | Disposition / canonical destination |
|---|---|
| :51–72 LEAN-REVIEW-01 | S/pabcd/references/phase-audit.md, copied pabcd :163–170 already owns recorded verdict semantics |
| :74–114 Contract | New loop intent + execution invariants; phase control and goal-only Interview prohibition preserved |
| :116–155 Docs-first | New loop docs-first; exact document contents stay in pabcd implementation-units |
| :217–223 speculative dispatch | Append unchanged to S/pabcd/references/delegation.md |
| :282–297 optimization clarification | Append unchanged to S/pabcd/references/optimization.md |
| :313–338 continuation | New loop execution invariants (same-scope amendment, no criterion shrink, disk recovery, re-entry) |
| :341–365 Git | New loop LOOP-GIT-01 pointer; cxc-dev §5 and stacked-prs remain canonical |
| :367–387 outcomes | New loop completion plus existing pabcd loop-engineering §11.2 |
| :389–408 repair | Existing pabcd loop-engineering §11.3 plus the exact HOTL correction below |
| :409–415 reviewer reuse | Append unchanged to pabcd phase-audit; structure dispatch doctrine remains lifecycle owner |
| :417–431 archetype/regeneration | Existing pabcd loop-engineering §11.4 and §11.4a |
| :433–458 divergence | Move :433–455 as above; :457–458 was a now-redundant self-link |

## 3. dev mechanical moves and exact replacement stubs

NEW S/dev/references/methodology-overlays.md = unchanged S/dev/SKILL.md:73–104.
NEW S/dev/references/development-practice.md = '# Development practice', blank,
unchanged :241–334, blank, unchanged :338–353.

Path corrections in copied overlays: replace 'references/product/crud-product-development.md'
with 'product/crud-product-development.md', 'references/logging.md' with
'logging.md', and 'references/stacked-prs.md' with 'stacked-prs.md'.
In copied development-practice replace each '§0.1' pointer with
'dev SKILL.md §0.1'; that section remains in the parent entrypoint, not this ref.
All other moves preserve wording.
The practice copy retains old section numbers so dev §0.5/§1/§1.5/§2 pointers can
forward without losing their semantic anchors. Do not move §3 or §5.

MODIFY S/dev/SKILL.md:

Replace :73–104 with:

~~~~markdown
## §0.3 Methodology Overlays

Methodologies are conditional, not universal. For an explicit method, repo
requirement, or a matching strict trigger, read
[Methodology overlays](references/methodology-overlays.md).
The surface table below remains mandatory before writing in that surface.
C2 conventional product slices also select
[CRUD product development](references/product/crud-product-development.md).
Read selected references only; do not preload every overlay's owners.
~~~~

Replace :241–353 with:

~~~~markdown
## 0.5 Repository Convention Discovery

C2+ implementation first reads
[Development practice](references/development-practice.md): repository conventions,
modular limits, necessity and owner search, read-before-edit, and friction rules.
The C0/C1 fast-path in §0.1 applies. Read the source and direct callers before
proposing a change; do not invent new structure without the required approval.

## 1. Modular Development

Canonical details remain in [Development practice](references/development-practice.md).

## 1.5 Necessity Gate & Pre-Write Search Obligation

Before any new abstraction, apply DEV-NECESSITY-01 and owner search in
[Development practice](references/development-practice.md).

## 2. Systematic Debugging

For non-obvious defects or repeated failed repairs load cxc-dev-debugging.
DEV-FRICTION-01 and DEV-EDIT-SHAPE-01 remain in
[Development practice](references/development-practice.md).
~~~~

Keep all other dev body lines unchanged, including :42–59 fast-path,
:126–157 router/attachment obligations, :190–214 Family Invariants,
:357–408 proof/safety, and :436–449 token awareness/catalog discovery.
Only frontmatter replacements in §6 below additionally apply.

## 4. pabcd phase-specific references and router splices

NEW reference files (exact content, before link/owner corrections):

| Destination under S/pabcd/references/ | Complete construction | Read condition |
|---|---|---|
| phase-control.md | unchanged S/pabcd/SKILL.md:42–149 | before actual FSM command / control diagnosis |
| phase-plan.md | '# Plan phase', blank, unchanged :155–162 | before P work, including plan-only scope |
| phase-audit.md | '# Audit phase', blank, unchanged :163–170; blank, unchanged S/loop/SKILL.md:409–415 | before authorized A; also recorded-verdict dispute |
| phase-check.md | '# Check phase', blank, unchanged S/pabcd/SKILL.md:172–222 | before C; P/A load if planning/auditing render or conditional-path proof |
| implementation-units.md | unchanged :231–318 | C2+ unit placement or multi-phase roadmap before P |
| optimization.md | '# Optimization-loop meta-rules', blank, unchanged :320–352; blank, unchanged S/loop/SKILL.md:282–297 | optimization/plateau only |
| delegation.md | unchanged S/pabcd/SKILL.md:366–399; blank, unchanged S/loop/SKILL.md:217–223 | before authorized dispatch |

No B/D reference: their short canonical paragraphs stay in the router.
Section moves must preserve complete original long paragraph lines, not truncate
them to terminal display width.

Explicit link corrections inside moved references:

- phase-control's control table and JSON remain byte-identical.
  Replace its copied original :76 line with:

~~~~markdown
Advancing a phase is not the same as doing it (see [Faithful execution](../SKILL.md#work-phase-loop-multi-pass-tasks)). Each forward
~~~~

In :141–149 retain the handoff heading but replace its paragraph with:

~~~~markdown
Execution intent and HOTL activation belong to [cxc-loop](../../loop/SKILL.md).
This reference owns phase commands and attestations, not permission to execute.
~~~~

- phase-plan original :156: replace only the literal path
  'references/stacked-prs.md' with '../../dev/references/stacked-prs.md';
  retain the surrounding cxc-dev owner and DEV-STACK-01 wording.
- phase-audit: replace each '§11.3' with 'loop-engineering.md §11.3'.
  Its lifecycle structure pointer remains a repository-doctrine pointer, not an
  installed file.
- phase-check original :172: change 'skills/qa/SKILL.md' to ../../qa/SKILL.md.
  Keep render/activation paragraphs and rule severities unchanged.
- implementation-units original :235: replace the code-form relative target with
  the following complete line:

~~~~markdown
[Implementation log](../../dev-scaffolding/references/implementation-log.md).
~~~~

- optimization copied loop :284–285: replace that two-line owner pointer with
  this complete line:

~~~~markdown
This file owns the meta-rules; repair/archetype detail is in [Loop engineering](loop-engineering.md).
~~~~

- Existing references to structure/20_pabcd_dispatch_doctrine.md remain canonical
  repository evidence, not a new plugin-shipped dependency. Do not claim a path
  outside the installed payload can always be opened. The moved delegation body
  already contains the usable leaf/task/role/transport safeguards.

MODIFY S/pabcd/SKILL.md using BEFORE coordinates:

1. After :13 add:

~~~~markdown
## Intent boundary

Loading this skill is not authority to execute phases. Explanation, review,
interview-only, plan-only, read-only, no-goal, no-FSM, and no-delegation limits win.
Use the requested method only within that scope. An operative bare cxc-loop
request selects scoped HOTL through cxc-loop; ordinary PABCD use does not.
cxc-dev is canonical for work class, C0/C1 fast-path, proof, and safety.
~~~~

2. Replace :42–149 with:

~~~~markdown
## Phase Control / Orchestrate

Before an authorized state-control action read
[Phase control](references/phase-control.md). It owns the chat/CLI distinction,
SESSION-IDENTITY-01, ORCH-ARTIFACT-01, ATTEST-SHAPE-01, Windows attest-file usage,
and every edge's required keys. Entry edges are not the four gated work edges.
Do not claim a phase from narration; do its work and record the real transition.
Goal activation and scoped continuation are owned by [cxc-loop](../loop/SKILL.md).
~~~~

3. Replace :151–170 with:

~~~~markdown
## Phases

Read only the current phase's detailed owner before doing its work. A reference
link is a conditional routing edge, not a command to preload the entire graph.

| Phase / trigger | Mandatory owner before work |
|---|---|
| I | cxc-interview; no active host goal |
| P, including plan-only | [Plan phase](references/phase-plan.md) |
| A, if authorized | [Audit phase](references/phase-audit.md) |
| C | [Check phase](references/phase-check.md) |
| P/A specifying render or conditional-path verification | [Check phase](references/phase-check.md), to define reachable activation and observable evidence |

P explores and plans without implementing; PHASE-SPLIT-01 and the diff-level
contract apply. A actually audits, folds/rebuts blockers, and re-audits; only pass
or justified near-pass exits. C requires fresh relevant proof and SoT sync;
passing unrelated checks is not evidence. Explicit execution restrictions are not
overridden by a reference asking to run a verifier or dispatch a reviewer.
~~~~

4. Keep :171 (B) unchanged. Remove :172–222 (moved). Keep :223 (D) unchanged.
5. Keep :225–229 (work-phase definition/invariant); immediately after :229 add:

~~~~markdown
Faithful execution: perform each phase's actual work; the state transition is not
its artifact. C0/C1 keeps cxc-dev's fast-path; a real loop still cannot skip phases.
LOOP-CONTINUITY-01: P quotes the previous D conclusion/direction, with a reason
for changing it. PLAN-TRACK-01: when available, the native update_plan surface
mirrors progress; the durable plan remains the source of truth.
~~~~

6. Replace :231–352 with:

~~~~markdown
### Implementation-Unit Documents

Before C2+ unit planning or any multi-phase roadmap, read
[Implementation units](references/implementation-units.md).
It owns DIFFLEVEL-ROADMAP-01, PHASE-SPLIT-01 linkage, LEXICO-SPLIT-01,
UNIT-RESIDENCE-01, numbering, and docs-first document contents.
cxc-dev §0.1 owns C0/C1 record exemptions. cxc-loop owns when docs-first begins.

### Optimization-Loop Meta-Rules (plateau discipline)

For optimization, mechanism comparison, or plateau analysis, read
[Optimization rules](references/optimization.md) and
[Loop engineering](references/loop-engineering.md). Ordinary repair does not
preload optimization material.
~~~~

7. Retain :354–364 depth table with the C0/C1 row correction in §5.
8. Replace :366–420 with:

~~~~markdown
## Delegation Model (subagents)

The main session owns the plan, host goal, and transitions. Before authorized
dispatch read [Delegation](references/delegation.md). Leaves do not spawn by
default; attachments name the needed owner skills explicitly.
No-delegation and scoped read/write restrictions take precedence.

## Loop Engineering (§11)

For repeated failure, reviewer FAIL, or loop-archetype selection, read
[Loop engineering](references/loop-engineering.md). LOOP-REPAIR-01: two repeated
failed repairs require root-cause work, three require replan. LOOP-DOOM-01:
three failed attestations are no-progress, never success. REVIEW-SYNTHESIS-01
requires accept/rebut synthesis before re-dispatch. HOTL never returns to I
while its goal is active.
~~~~

9. Retain :422–436 catalog/state/repository-root sections unchanged.
10. In the moved implementation-units :312–318 replace the anti-skip/tracker
    paragraphs with the single line below. The router supplies these rules to every
    cycle, so the reference must not keep a second full canonical version.

~~~~markdown
Faithful execution and PLAN-TRACK-01 remain in [Work-phase loop](../SKILL.md#work-phase-loop-multi-pass-tasks).
~~~~

## 5. Explicit canonical-owner reconciliation (not mechanical)

MAIN integration decision: preserve existing S/dev/SKILL.md:42–59 while resolving
contradictory pabcd bookkeeping. This is not an explicit user policy instruction.
dev owns C0/C1 classification and its record exception. pabcd owns the general
unit/document contract SUBJECT TO that exception; scaffolding owns doc placement.
No broader weakening of verification, safety, behavior-based promotion, or C2+
documentation obligations is intended.
The initiative is read-only and is not changed to pretend this downstream policy
was always its wording.

In NEW S/pabcd/references/implementation-units.md replace copied :256–263 with:

~~~~markdown
**Unit residence (STRICT, UNIT-RESIDENCE-01):** C2+ development belongs to an
implementation unit (devlog/_plan/YYMMDD_slug/). Ceremony scales with class.
C0/C1 record behavior is canonically defined by [cxc-dev §0.1](../../dev/SKILL.md):
C0 is exempt from numbered unit records; C1 records in the owning unit only when
one already exists. Do not create a unit solely for a C0/C1 fast-path record.
This exception does not waive verification, safety, or behavior-based promotion.
When residence is required and no unit exists, use the existing repository's
unit convention; interview resolves placement when interview is in scope.
~~~~

In copied :275–279 replace the complete bullet with:

~~~~markdown
- 000-range durable research is mandatory for C4, and for C3 when cross-turn,
  contract, architecture, or repository-convention needs require it. It is optional
  for C0-C2 and low-persistence C3. C2+ still follows UNIT-RESIDENCE-01;
  C0/C1 follows cxc-dev §0.1 without a forced new unit.
~~~~

In S/pabcd/SKILL.md:358 replace only the Record (D) cell with:
'cxc-dev §0.1: C0 exempt; C1 records only in an existing owning unit'.

MODIFY S/dev-scaffolding/references/implementation-log.md:

- Replace :3–7 with:

~~~~markdown
Canonical placement and documentation routine for implementation units.
Numbering and general residence belong to
[Implementation units](../../pabcd/references/implementation-units.md);
folder introduction belongs to ../SKILL.md §2.1.
Read this routine for C2+/multi-phase unit documentation, not every small edit.
cxc-dev §0.1 is canonical for the C0 exemption and existing-unit-only C1 record.
~~~~

- Replace :69–78 with:

~~~~markdown
## Class-scaled documentation

The full master-plan, diff-level roadmap, and doc-audit routine is mandatory for
C4, multi-phase units, and C3 needing persistent contract/architecture evidence.
General unit residence belongs to pabcd's implementation-units reference.
C0/C1 follows cxc-dev §0.1: C0 needs no numbered unit record; C1 records only in
an existing owning unit. Do not create a unit solely for a fast-path record.
Preserve the smallest fresh verification and all safety rules.
~~~~

MODIFY S/dev-scaffolding/SKILL.md:

- In :72–78 insert after the introductory paragraph and before the list:
  'C0/C1 record exemptions are owned by cxc-dev §0.1; this routine does not override them.'
- Replace :113–116 with:

~~~~markdown
Phase naming is owned by [Implementation units](../pabcd/references/implementation-units.md)
(LEXICO-SPLIT-01). Use the existing three-digit convention; do not mix two-digit names.
~~~~

- Replace :120–122 with:
  'This gate governs introducing a convention, not routine unit subfolders in an
  existing devlog/_plan. Create a unit only when required; cxc-dev §0.1 does not
  require a new unit for a C0/C1 fast-path record.'
- In :299 replace the parenthetical pabcd/SKILL.md location with
  '../pabcd/references/implementation-units.md, LEXICO-SPLIT-01'.

MODIFY S/dev/references/skill-ownership.md:

Insert these rows immediately before existing :29 PABCD workflow row:

~~~~markdown
| C0/C1 classification and record exemption | dev §0.0/§0.1 | pabcd, dev-scaffolding |
| Unit residence and numbered roadmap contents | pabcd references/implementation-units.md, subject to dev §0.1 | loop, dev-scaffolding |
| Loop intent, docs-first activation, scoped continuation | loop SKILL.md | pabcd, goalplan |
| Goalplan schema and runtime lifecycle | loop references/durable-goalplan.md and references/runtime-lifecycle.md respectively | pabcd, goalplan |
| Phase control and phase work | pabcd references/phase-control.md and phase-plan/audit/check.md respectively | loop, orchestrate |
| Repair and optimization method | pabcd references/loop-engineering.md and optimization.md respectively | loop |
~~~~

Existing frontend/uiux owner rows and role-boundary text are unchanged.
Change existing 'Pre-write search | dev §1.5' owner cell to
'dev references/development-practice.md (§1.5)'.

MODIFY S/pabcd/references/loop-engineering.md:

- Replace :49–51 (LOOP-DOOM-01) with unchanged S/loop/SKILL.md:399–402.
  This ports the existing HOTL-safe variant; it adds no runtime transition.
- In :46–48 change 'or Interview return' to 'or Interview return in HITL'.
- In :98 change '§10 LOOP-CONTINUITY-01' to
  '../SKILL.md Work-Phase Loop, LOOP-CONTINUITY-01'; in :73 replace 'in §10'
  with 'in optimization.md'; in :97 replace '§10 LOOP-CANDIDATE-ANCHOR-01'
  with 'optimization.md LOOP-CANDIDATE-ANCHOR-01'. Preserve other prose.
- Add after :140:

~~~~markdown
Continuation belongs to [cxc-loop](../../loop/SKILL.md);
divergence operation belongs to [Divergence tiers](../../loop/references/divergence-tiers.md).
Optimization meta-rules are in [Optimization rules](optimization.md).
Read only the owner needed by the current action.
~~~~

## 6. Exact metadata replacements

Names, metadata nesting, folder names, implicit flags, and deprecated redirect
identities do not change. Do not convert descriptions to YAML block scalars.

S/dev/SKILL.md:3 replacement:

~~~~yaml
description: "MUST USE for coding, review, scaffolding, and QA. Classify C0-C5, preserve safety and fresh proof, and load the matching surface owner before work. Triggers: develop, fix, refactor, test, review, docs, browse, QA, 개발, 수정, 검토."
~~~~

S/pabcd/SKILL.md:3 replacement:

~~~~yaml
description: "Use for class-scaled Plan-Audit-Build-Check-Done work. Explicit explanation, interview, plan-only, and read-only limits win; loading the skill does not activate a loop. Triggers: PABCD, plan this, 기획, 단계별로, 요구사항 정리."
~~~~

For S/{dev,pabcd,loop}/agents/openai.yaml replace only interface.short_description:

| File | Exact new YAML scalar |
|---|---|
| dev/agents/openai.yaml | "Class-scaled development, routing, safety, and proof." |
| pabcd/agents/openai.yaml | "PABCD phases, evidence, and explicit scope boundaries." |
| loop/agents/openai.yaml | "Scoped HOTL completion with explicit scope limits." |

WP2 A amendment: these UI summaries fit the25–64-character openai.yaml contract.
Full intent precedence remains in description and the skill body, not the UI label.

Preserve allow_implicit_invocation: true for these three. Preserve every other
skill policy file, especially frontend/uiux and explicit-only routers.
The first 120 description characters must still identify each skill's purpose,
because the current leaf catalog truncates descriptions (spawn-attach-hook.ts:559–565).

## 7. Compatibility pointers and deliberate non-changes

- S/orchestrate/SKILL.md:11–12 still resolves through the preserved
  'Phase Control / Orchestrate' heading; no redirect or CLI grammar changes.
- S/goalplan/SKILL.md remains a redirect to loop. Its schema/CLI material is reached
  by loop's Durable goalplan link, not by inventing a separate goalplan loader.
- S/skill-hub/SKILL.md remains a redirect; dev's Capability Routing Hub is retained.
- dev §3, §5 and Family Invariants stay at the original semantic owners so all
  dev-* inheritance pointers continue to work without frontend/uiux edits.
- S/dev/references/static-analysis-gate.md and logging.md retain usable dev §7/§5
  references. Existing stack pointers keep their file, owner and rule IDs.
- No hook removal, runtime arming-text change, phase grammar change, new implicit
  skill, leaf whitelist expansion, schema/CLI flag, or generated runtime change in wp2.
- Historical devlogs and the initiative are evidence, not live callers to rewrite.
