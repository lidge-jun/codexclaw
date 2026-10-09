# Obligation ledger — loop/SKILL.md and pabcd/SKILL.md (wp3 lane loop-pabcd)

Paths: L = plugins/codexclaw/skills/loop/SKILL.md, P = plugins/codexclaw/skills/pabcd/SKILL.md, D = plugins/codexclaw/skills/dev/SKILL.md.

| Original obligation | New location/disposition |
|---|---|
| Explanation, review, quoted mention and skill loading grant no execution authority | `L#intent-before-activation`; `P#intent-boundary` points to it |
| Explicit interview, plan-only, read-only, write, commit, goal, FSM, test and delegation limits win | `L#intent-before-activation`; pointer from `P#intent-boundary` |
| Bare operative loop selects scoped HOTL; explicit HITL retains human pauses | `L#intent-before-activation` |
| Ordinary development/loading does not activate HOTL | `L#intent-before-activation` |
| HOTL changes persistence, not permissions; missing authority must be reported | `L#intent-before-activation`; pointer to `D` authority/safety |
| Interview requires HITL without an active host goal | `P#how-it-works`; loop inherits through PABCD |
| Leaves follow packets, return bounded results and own no goal/FSM; spawning requires a grant | `L#intent-before-activation`; pointer to `pabcd/references/dispatch-surfaces.md` |
| Dispatched task goals/FSMs require packet grants, objective, criteria and completion condition | pointer to `pabcd/references/dispatch-surfaces.md#dispatch-surface-01-strict--name-the-surface-before-dispatching` |
| Neither coordinator nor lane advances another task’s FSM; live host contracts outrank hook acceptance | removed: duplicate of dispatch-surfaces and `D` authority |
| Keep authorized work local; peer contact requires proper authority and wake checks | pointer to `D#conditional-routes` → `dev/references/peer-collaboration.md` |
| Incoming peer questions do not activate/resume a loop or advance FSMs | removed: duplicate of peer-collaboration |
| Optional async questions require an exposed/permitted tool; continue without waiting and incorporate answers | pointer to `D#conditional-routes` → `dev/references/async-questions.md` |
| Unanswered optional questions do not block completion or bypass denied questions/approval | removed: duplicate of async-questions |
| Select owners by task, class, risk and phase | `L#intent-before-activation`; `P#phases` |
| Complete selected reads; recover truncation without gaps; reuse current context; avoid recursive preload | pointer to `D#reading-contract` |
| Resolve relative skill links from the skill directory | removed: duplicate of `D#reading-contract` |
| Missing mandatory references are preflight failures | `L#intent-before-activation` |
| All original conditional reference routes | `L#read-before-the-action`; `P#phases`; `P#loop-engineering-11` |
| Installed owners are the loading path; preserve explicit-only/leaf-safe delivery restrictions | `L#intent-before-activation`; pointer to `D#conditional-routes` → skill-catalog |
| DISPATCH-SURFACE-01: choose the dispatch surface before fanout | pointer to `pabcd/references/dispatch-surfaces.md#dispatch-surface-01-strict--name-the-surface-before-dispatching` |
| Shared cwd/HEAD requires disjoint write scopes and prohibits concurrent branch operations | removed: duplicate of `pabcd/references/dispatch-surfaces.md#dispatch-shared-tree-01-strict--subagents-inherit-your-cwd` |
| Branch/worktree/merge-CI lanes require separate task surfaces and applicable creation authority | pointer to dispatch-surfaces routing/authority sections |
| ORCH-MANDATE-01: claim active loops only from actual persisted state | `L#execution-invariants` |
| SESSION-IDENTITY-01: current binding, corroboration/recovery, no borrowed IDs or fabricated hook proof | pointer to `pabcd/references/phase-control.md#control-surfaces-shipped` |
| Use the installed CLI when PATH selects an older development CLI | pointer to runtime-lifecycle entry procedure |
| HOTL requires ACTIVE goal plus in-flight cycle; HITL requires no goal | `L#execution-invariants` |
| Missing capability/binding cannot prove armed continuation | `L#execution-invariants` |
| One work-phase performs a full cycle, closes D to IDLE and starts next P | `P#work-phase-loop-multi-pass-tasks`; loop points there |
| Do not batch work-phases’ B steps or close directly from B | `P#work-phase-loop-multi-pass-tasks` |
| Phase transitions are not phase artifacts; hooks neither choose nor advance phases | `P#work-phase-loop-multi-pass-tasks`; `L#execution-invariants` |
| LOOP-CONTINUE-01: read bound goalplan/ledger after D or context loss, preserve criteria and continue remaining authorized work | `L#execution-invariants` |
| LOOP-UNIT-CHAIN-01: newly discovered in-scope units enter through P amendments to the same goal | `L#execution-invariants`; P points there |
| LOOP-CONTINUITY-01: next P quotes previous D conclusion/direction and explains changes | `L#execution-invariants`; P points there |
| Resume from durable evidence rather than transcript momentum | `L#execution-invariants` |
| LOOP-GIT-01: checkpoint/publication obey dev git authority; declared stacks load their owner | `L#execution-invariants` |
| Planning-only work grants no implementation/publication authority | removed: duplicate of loop intent boundary and `D` authority |
| LOOP-DOCS-FIRST-01: multi-cycle entry begins with skeleton plus docs-only roadmap cycle; strict for HOTL | `L#docs-first-multi-cycle-entry` |
| Roadmap D locks the plan; implementation starts next cycle | `L#docs-first-multi-cycle-entry` |
| Later cycles consume/revalidate prewritten decade docs; newly discovered multi-cycle scope pays roadmap debt at next P | `L#docs-first-multi-cycle-entry` |
| Roadmap cycle permits no production patches, deploys or implementation-complete claims | `L#docs-first-multi-cycle-entry` |
| Single-cycle tasks skip the extra roadmap cycle; dev owns C0/C1 exceptions | `L#docs-first-multi-cycle-entry`; pointer to `D` |
| LOOP-READS-PABCD-01: read implementation units before multi-cycle execution; empty docs/skeletons are insufficient | `L#docs-first-multi-cycle-entry` |
| Report truthful terminal outcomes, distinct from FSM phases and host goal statuses | `L#completion-and-recovery` |
| DONE requires fresh proof of recorded criteria; never weaken GOAL-COMPLETE-GATE-01 | `L#completion-and-recovery`; pointers to dev verification and runtime-lifecycle |
| Exhaustion requires an actual stated bound; compaction, timeout and Stop release prove neither success nor exhaustion | `L#completion-and-recovery` |
| Rejection, stagnation and lost arming use runtime recovery; repeated failures use loop engineering | `L#read-before-the-action`; `L#completion-and-recovery` |
| PABCD architecture-origin prose | removed: history; evidence text supplied above |
| Persisted state, ledger and control-surface details | pointer to `pabcd/references/phase-control.md` |
| C0/C1 fast path, C4 mandatory process and C3 conditional depth | pointer to `D` classifier/fast path; `P#pabcd-depth-by-work-class` retains PABCD-specific depth |
| Lexical Interview hints advise but do not enter phases; explicit commands use phase control | `P#phases`; pointers to interview and phase-control |
| Interview dimensions, contradiction scanning, readiness and Q/A capture | pointer to `interview/SKILL.md#contract` |
| Forward progression, Interview return preserving context, interactive pauses and explicit goal-mode P entry | `P#how-it-works` |
| ORCH-ARTIFACT-01, ATTEST-SHAPE-01, Windows attest files and required edge keys | pointer to `pabcd/references/phase-control.md` |
| Native composition/projection/computation selects available execution, not phases or authority | pointer to `dev/references/native-execution.md` |
| Read current phase’s mandatory owner before work | `P#phases` |
| P explores without implementation and writes grounded diff-level plans | pointer to `pabcd/references/phase-plan.md#phase-entry-and-executable-plan` |
| Architect proposal → executable plan → same-architect reflection; C2+ consultation record | pointers to phase-plan and plan-output in `P#phases` |
| PHASE-SPLIT-01: dependency/architecture order | pointer to phase-plan |
| P/A render/conditional checks require reachable activation and observable evidence | `P#phases`; pointer to phase-check |
| A audits, resolves/rebuts blockers and re-audits to pass/justified near-pass | `P#phases`; pointer to phase-audit |
| C requires fresh relevant proof and source-of-truth sync; unrelated checks are insufficient | `P#phases`; pointer to phase-check and dev verification |
| Reference requirements do not override execution/dispatch restrictions | removed: duplicate of `P#intent-boundary` and `D` authority |
| B implements audited scope, verifies and surfaces deviations | `P#phases` |
| DEV-GIT-COMMIT-01, DEV-GIT-PUSH-01 and declared-stack DEV-STACK-02 | pointers to `D#5-safety-rules` and stacked-prs |
| D records conclusion/change/evidence, updates STATUS/devlog, checkpoints within authority and resolves pending work | `P#phases` |
| READER-DOC-02/04: D serves a fresh reader | pointer to `dev/references/reader-documents.md` |
| LOOP-PESSIMIST-01: D records failed improvement, dead hypothesis and disconfirming evidence | `P#phases` |
| Work-phase versus letter-phase terminology; successive units remain within the agreed goal | `P#work-phase-loop-multi-pass-tasks`; loop scope/continuation owner |
| PLAN-TRACK-01: native update_plan mirrors progress; durable plan remains authoritative | `P#work-phase-loop-multi-pass-tasks` |
| DIFFLEVEL-ROADMAP-01, LEXICO-SPLIT-01, UNIT-RESIDENCE-01, numbering and roadmap contents | pointer to `pabcd/references/implementation-units.md` |
| Optimization/comparison/plateau work reads optimization plus loop engineering; ordinary repair avoids unrelated optimization loading | `P#loop-engineering-11`; `L#read-before-the-action` |
| Five-row class-specific P/A/B/C/D depth contract | `P#pabcd-depth-by-work-class` |
| Main/leaf/task state ownership, dispatch isolation and creation grants | pointer to dispatch-surfaces |
| Explicit owner-skill attachments; no-delegation/write-scope limits prevail | `P#delegation-model--choosing-a-surface`; pointers to dev and delegation |
| LOOP-REPAIR-01, LOOP-DOOM-01 and REVIEW-SYNTHESIS-01 thresholds/procedures | pointer to `pabcd/references/loop-engineering.md#113-repair-loop-discipline-cb-returns` |
| INTERVIEW-CATALOG-01, CATALOG-DESIGN-FIRST-01 and option ontology | `P#catalog-discovery-routing`; pointers to interview and catalog schema |
| State file responsibilities and append-only ledgers | pointer to phase-control; exact text above awaits refs-lane insertion |
| Resolve actual repository root before planning; relative source/test paths use it; clarify ambiguity | `P#repository-root` |
