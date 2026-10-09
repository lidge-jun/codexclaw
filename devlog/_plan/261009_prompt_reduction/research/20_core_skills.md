# Core-skill duplication and layer audit

Read-only research, 2026-10-09. Observed HEAD `6520b7b893fb1b6d1995e1f7b245f244e4c8c8c7`, branch `codex/prompt-reduction`. Only this report was written; no orchestration, goal, dispatch, branch mutation, or test execution. Source files are the shared working-tree versions, not necessarily HEAD; re-anchor before editing. In particular, dispatch-surfaces grew during the read window; citations below use its later 350-line version.

**Recommendation:** retain three small L3 decision routers; make L4 references single owners of procedures; leave L0 guards authoritative for machine checks, and use L5 tests for schema/transport consistency rather than repeated prose. Existing ownership policy already requires one owner and pointer stubs (`SO:3,52`). The three entrypoints measured by `wc -lc` total **56,306 bytes / 829 lines**: dev 32,812/495, loop 11,159/158, pabcd 12,335/176. Proposed combined ceiling: **13,500 bytes**, approximately 76% smaller. Proposed UTF-8 ceilings, not runtime limits.

## Citation key / read scope

To keep this report below 25 KB, `ALIAS:line` expands to the exact path below; ranges/comma lists name all mapped occurrences. Skill paths have prefix `plugins/codexclaw/skills/`; component paths have prefix `plugins/codexclaw/components/`; test paths have prefix `plugins/codexclaw/test/`.

Skills: **D** `dev/SKILL.md`; **L** `loop/SKILL.md`; **P** `pabcd/SKILL.md`; **PP** `pabcd/references/phase-plan.md`; **PC** `pabcd/references/phase-control.md`; **DEL** `pabcd/references/delegation.md`; **DS** `pabcd/references/dispatch-surfaces.md`; **PO** `pabcd/references/plan-output.md`; **IU** `pabcd/references/implementation-units.md`; **LD** `loop/references/lane-dispatch.md`; **RL** `loop/references/runtime-lifecycle.md`; **DG** `loop/references/durable-goalplan.md`; **W** `loop/references/waiting.md`; **SP** `dev/references/stacked-prs.md`; **DP** `dev/references/development-practice.md`; **SO** `dev/references/skill-ownership.md`.

Components: **AT** `pabcd-state/src/attest.ts`; **GG** `pabcd-state/src/goal-gate.ts`; **GP** `pabcd-state/src/goalplan.ts`; **PG** `pabcd-state/src/plan-gate.ts`; **CG** `pabcd-state/src/check-gate.ts`; **HK** `pabcd-state/src/hook.ts`; **SS** `pabcd-state/src/session-source.ts`; **SB** `pabcd-state/src/session-binding.ts`; **GW** `pabcd-state/src/git-write-guard.ts`; **AO** `pabcd-state/src/automation-ownership-gate.ts`; **SA** `subagent-config/src/spawn-attach-hook.ts`; **FD** `subagent-config/src/fallback-dispatch.ts`; **DC** `subagent-config/src/dispatch-contract.ts`; **SAT** `subagent-config/test/spawn-attach-hook.test.ts`; **AST** `pabcd-state/test/attest-shape-hint.test.ts`; **MAPT** `cxc-ops/test/map-affordance.test.ts`; **HKT** `pabcd-state/test/hook.test.ts`.

Tests: **MT** `manifest-policy.test.mjs`; **NT** `native-execution.test.mjs`; **LT** `lane-packet.test.mjs`.

Read all three entrypoints and all 13 requested references. Searched the requested test roots with `rg` for their filenames, then broader readFile/skills/rule matches; inspected matching assertions and relevant guard sources. No tests run. Recommendations below are proposals, not existing runtime claims.

## A. Rules repeated in 2+ places

All mapped formulations/stubs within the requested corpus are listed. Preserve conditional routes; consolidate algorithms/examples. Ownership-index mentions are navigation, not normative duplicates.

| Rule | Occurrences (citation key above) | Single owner | Others shrink to |
|---|---|---|---|
| Authority / loading ≠ execution | `D:14,178,224`; `L:12-26,44,50,85,132`; `P:17-21,64,80-81,151`; `PP:5-10`; `PO:23-27,43`; `DEL:124-125,309-323,358-359`; `LD:16-19`; `RL:3-5,20,62-64`; `DG:4` | L3 D authority; L3 L mode selection | Loop/pabcd one inheritance sentence; refs local prerequisites only. |
| C0/C1 exception; class-scaled depth/proof/records | `D:26-67,413-431`; `P:13,21,93,104,115-123`; `PP:8-10`; `PO:47`; `IU:26-31,45-48`; `DP:69,75-78`; `L:143,147-148`; `SO:40-41` | L3 D classifier/fast path/proof table | Remove P class table; refs point to D exceptions. |
| Selected reads; recover truncation; avoid preload | `D:59,101,125-141,476-479`; `L:54-65`; `P:66-67` | L3 D reading contract | Other routers point to D; retain conditional tables. |
| One canonical owner; others stubs | `D:165-166,235-238,252-254`; `SO:3,52`; `SP:3-5`; routing introductions throughout `L:67-81`, `P:53-58,98-104` | L4 SO index | One dev map link; remove duplicated ownership lecture. |
| Leaf vs task goal/FSM ownership | `D:107-109,180-184`; `L:28-36,89-105`; `P:127-139,148-151`; `DEL:3-23,257-280,291-294`; `DS:12-50,84-111,184-190,280-284,347-350`; `LD:12-19` | L4 DS surface table | Entrypoints two-line distinction+link; DEL starts after choice. |
| Shared cwd/HEAD; disjoint scopes; explicit workdir | `D:180-184`; `L:91-100`; `P:128-137`; `DEL:5-8,19,262-268,272-280`; `DS:25-31,39-41,55-82,92-103,133-148,280-284`; `SP:146-150` | L4 DS isolation | Packet records workdir/prohibition only; keep spawn warning. |
| Lane creation authority | `L:101-104`; `P:134-136`; `DS:48,170-182`; `SP:149-150` | L4 DS authority | Pointer elsewhere; host grant still wins. |
| Explicit skill attachments; no inferred skills | `D:159-166`; `P:149-150`; `PP:13`; `DEL:291-303,312,329`; `SO:11-15` (ownership navigation only) | L3 D obligation; L4 DEL transport | One role/base-skill table; do not delete main skill selection duty. |
| Bounded discovery packet; no redundant reread | `D:170-205`; `DEL:69-86,100-114,127-133,286-287` | L3 D split decision; L4 DEL packet | Dev split/local reason in ~6 lines; transport/cost caveats in DEL. |
| Independent peer messaging / phase authority | `D:209-215`; `L:38-44`; `P:141-146`; `W:5-11`; `SO:12` | L4 dev peer-collaboration | One dev route; others identify peer owner only. |
| Optional async questions / continue work | `D:297-302`; `L:46-50`; `SO:14` | L4 dev async-questions | One dev route; remove loop paragraph. |
| Native execution selection | `D:221-224`; `L:70`; `P:62-64`; `SO:13`; `DEL:188` (spawn-specific recipe) | L4 dev native-execution | Keep tested links; avoid repeated runtime guidance. |
| Fresh proof; artifacts ≠ transitions or child claims | `D:269-275,335-354,423`; `L:106-107,119-121,128,154-158`; `P:57,79-84,90-96`; `PC:33-48,80-81`; `DEL:48-63,383-384`; `PO:24-25,58-60`; `RL:9-13,30-44`; `SO:49-50` | L3 D proof; L4 PC artifact map | Combine D Family Proof and §3; other routers identify phase artifacts only. |
| Current session binding ≠ hook proof | `L:106-115`; `P:33-34`; `PC:93-111`; `RL:15-22` | L4 PC; L0 SB | Remove binding algorithm from L and RL; one PC preflight. |
| Four gated edges / required attest keys | `P:49,53-57`; `PC:25-29,35-43,50-81,85-92`; `RL:27-38`; `L:119-121` | L0 AT/PG/CG; L4 PC table | PC alone keeps schema/examples; RL links it. |
| Interview HITL-only under goal | `L:26,49-50`; `P:27-36,49,71,159-160`; `PP:34`; `RL:26,79-81`; `IU:78-79` | L0 GG; L3 P I route | One P line: I requires no active goal; parser detail in PC. |
| One work-phase = full cycle; D closes IDLE | `L:119-128`; `P:88-96`; `RL:35-49`; `IU:54-69,81` | L3 P cycle; L3 L continuation | IU/RL link cycle rather than retell it. |
| Next P carries previous D direction | `L:126-128`; `P:84,94-96`; `IU:14-16,58-59,81` | L3 L continuity | D records direction; IU only revalidates diff. |
| Docs-first WHEN vs full-roadmap WHAT | `D:114-116`; `L:74,135-148`; `P:77,100-104`; `IU:7-16,54-69` | L3 L WHEN; L4 IU WHAT | Remove dev recitation and IU second roadmap algorithm. |
| Unit residence / numeric docs / separation | `D:55-58,428-431`; `P:98-104,117`; `IU:18-52`; `DP:5-7,57`; `SO:40-41` | L4 IU under D exception | DP one link, not two bare-filename lists; IU one exception paragraph. |
| Architect proposal → dispositions → reflection ≠ A | `P:72`; `PP:5-30`; `PO:31-48`; `DEL:10-13,289-359` | L4 PP sequence; PO record; DEL transport | PP owns steps; PO lists fields only; DEL drops repeated role purpose. |
| Verifier observes target/activation; honest NOT RUN | `P:75,79-81`; `PP:35,37`; `PO:14,23-27,58-60`; `DEL:25-33` (child result contract) | L4 PP grounding; DEL child result shape | PO verifier cell links method; preserve parent/child distinction. |
| Dependency order, not effort buckets | `PP:35`; `IU:9`; `SP:45,251-265,287-289,445`; `D:446` | L4 PP phase order; SP branch projection | SP links PHASE-SPLIT; remove repeated quick-win example. |
| HOTL bounds / terminal outcomes | `L:23-26,152-158`; `DG:12-19,123-129`; `PO:13,15,17,20-27` | L3 L semantics; L4 PO fields | DG links loop-spec; record user bounds/host limits/unset, never invent budget. |
| Completion refuses open work / missing evidence | `L:154-158`; `RL:51-65`; `DG:25-29,45-46,76-77,90-91,109,112` | L0 GG/GP; L4 RL recovery | One completion pointer in L/DG; no second deny matrix. |
| New in-scope units via P amendment | `L:122-125`; `P:88`; `IU:65-69`; `DG:56-58`; `PO:18` | L3 L scope; L4 PO amendment | Remove unrelated-feature example unless bounded by agreed objective. |
| Timeout ≠ failure; stop/inspect before replacement | `DEL:140-148,182,217-238,340-359,383-405,418-426`; `W:20-47,49-111`; `PO:18`; `LD:109,117-122`; `DS:228-234,341-343`; `L:155-156` | L4 W lifecycle; DEL wire protocol | DEL keeps wait family shape; PO links retirement, not retry algorithm. |
| V1 consume once / close slot | `DEL:184,190-192,224-238`; `W:38-42`; `LD:128-133`; `DS:262-266` | L4 DEL V1 lifecycle | W/LD/DS link V1 lifecycle; do not universally close V2 agents. |
| Measured host bounds / concurrency cap | `DEL:249-252`; `W:20-24`; `LD:8-10,117-133`; `DS:253-266` | Fixture + one L4 LD envelope | DEL/W link LD; update numeric-duplication tests. |
| Canonical vs provisional ID / packet modes | `DS:192-234`; `LD:29-32,41-81,91-113` | L4 LD packet/address | DS keeps pending warning/link; LD alone owns modes/timestamps. |
| Wake before yielding | `DS:236-249`; `W:43-47`; `LD:135-145`; `RL:67-71` | L4 W wake contract | DS/LD/RL link W; no copied wake story. |
| Shared polling quota / distinct communication cadence | `D:481-486`; `W:25-31`; `DS:251,268-278` | L4 W observer budget (proposed move) | Dev/DS point to W; fix empty POLL heading preceding FANOUT content. |
| Checkpoint commits / push and merge grants | `D:442-443`; `L:129-133`; `P:83-84`; `SP:93-95,168-182,308,361-386`; `LD:36-38,83-89` | L3 D authority; SP/LD named targets | Build/Done inherit D; examples conditional on retained grants. |
| Ordinary/manual default; native explicit-only | `D:88-93,446`; `SP:7-27,55-95,262-265,301-304,366-369,419-438,456-473` | L4 SP selection contract | Dev trigger+link; native subsections reference one opt-in rule. |
| Cascade / standalone layers / merge order | `D:446`; `P:83`; `PP:35`; `L:130-131`; `SP:45-51,199-228,291-318,322-327,351-362,371-397,446-447,450-452` | L4 SP invariants + §08 exception | Drop dev unconditional bottom-up summary: §08 has chained-child exception. |
| Hosted CI tested SHA/event/jobs evidence | `D:356-411`; `SP:97-129,170-172,234-235`; `DS:334-337` | Extract L4 CI owner from D §3 | Stack/lane keep topology differences; gh log recipes leave L3. |
| Conventions / source read / abstraction owner search | `D:308-321`; `DP:5-22,55-57,63-96`; `PP:12,35`; `SO:11` | L4 DP practice | Combine dev §0.5/§1/§1.5 routes; PP links discovery. |
| Reader summary and anchored evidence | `D:265-272`; `P:84`; `PO:33-41,50-56`; `DEL:55-63,78-80,286-287`; `SO:31` | L4 reader-documents; L3 D citation/proof | Phase/packet docs name output fields, not general writing rules. |

## B. History / incident / evidence candidates

Move original evidence to devlog only when not already recorded; keep a source pointer, not transcripts/private material (D:445). These are genre findings, not confirmation of present host behavior.

| Passage | Move/delete; instruction that survives |
|---|---|
| DS:57-62,73-78 | Dated shared-cwd probe/upstream contradiction → evidence; retain inherited-cwd/history-not-filesystem invariant. |
| DS:119-126,142-145 | Seven forks, earlier lane comparison/failure → devlog; verify actual grants/source before B. |
| DS:154-168 | Queued fork/25-minute incident → evidence; retain pending-ID recovery with provable-no-assignment exception. |
| DEL:194-202 | Two dated named-model probes → evidence; absent hint ≠ unavailable model. |
| DEL:55-67,188,217-222 | Memory extraction explanation, host catalog observation, wait-family failure story → evidence or delete rhetoric; keep synthesis/transport table. |
| W:15-18; RL:9-13 | Six-minute silence/session ID and “loop costume” story → delete from procedure; keep visibility/persisted-state rules. |
| LD:8-10,98-105,125-126,137-141 | Dated searches/no-cap-resolver-wake observations → fixture/provenance; use live schema, report unknowns. |
| LD:147-154 | Reviewer critique/future fix → devlog; keep one validator-limitation sentence. |
| SP:133-136,192-193,208-211,404-417 | 36-PR batch, six closures, two-of-five broken ancestry, dated transcript → evidence; keep authorized exception/ancestry check/current transport diagnosis. |
| SP:276-281,472-484 | Practitioner estimates/source dates → already-linked 260803 research; depth remains heuristic, recipes require current-doc lookup. |
| P:11,168-172; DG:72-81,114-121 | Architecture/storage/migration history → PC/schema appendix; retain old-build erasure hazard only in compatibility reference. |
| D:272,328-329,455; DP:63; DEL:35,64-67,367 | Doctrine mirror/rhetoric/hard-limit residue/date/issue provenance → remove rhetoric or one evidence link. |

Other misplaced L4 content: IU:71-79 divergence algorithm → divergence owner route already at L:75-77/P:108-111. D:384-411 CI/log recipes → conditional L4 CI reference (selective-load principle D:476-479). DEL:240-268 thread envelope → LD, since DEL:3-8 declares subagent ownership. Reconcile numeric-name STRICT/A-FAIL text (IU:18-24,51-52) with dev's DEFAULT naming authority (D:71-77) before rewriting.

## C. Runtime-backed restatements → one-line pointers

Guards replace repeated machine checks, not scope/intent/true-evidence judgment. One operational L4 schema/recovery reference remains; source inspection does not prove installed hook delivery.

| Skill passages | L0 owner, enforced subset/limit | One-line replacement |
|---|---|---|
| PC:25-29,50-78,90-92; RL:27-38 | AT:63,91-122,165-231: four edges, shape/did/verdict/residual/tail/output/zero exit. Pasted evidence is unauthenticated. | Use PC edge table; main provides real phase artifacts. |
| PC:65-66; RL:32-34; L:119-125 | AT:145-157: active workPhaseId match. | Attest current workPhaseId; finish that cycle before another unit. |
| IU:7-31,51-52; PC:60 | PG:31-80: existing directory + one numbered filename + optional path existence; no path/date prefix/content/all-diffs/mixed-doc check. | P→A needs numbered plan files; roadmap content/separation remain A-review duties. |
| PC:40-41,63,74-78,135-140; RL:32-34 | CG:27-85: receipt command/zero exit/timestamp/owner/checkEpoch/current source. No verifier relevance check. | Bound C→D uses current receipt via cxc receipt test; choose a verifier observing the requirement. |
| RL:51-65; DG:25-29,90-91; L:154-158 | GG:210-301; GP:1656-1700: cycle, child verification, bound-plan integrity/completion. Missing/malformed bound plan denies; unexpected errors fail open. | Complete after bound-plan validation and resolved child evidence; never weaken criteria. Update RL's incomplete two-item deny matrix from source. |
| P:49,71,159-160; L:26,49-50 | GG:136-154: exact request_user_input deny under suppressing goal state; HK:1811-1816: I releases Stop. | I is HITL-only without active goal; live question-tool contract applies. |
| RL:73-101; L:116-118,155-158 | HK:1403-1409,1499-1518,1805-1856: caps/goal/context/plateau; missing/decision-awaiting IDLE plan releases. | Stop is bounded/conditional; release proves no completion—recover from durable plan. |
| PC:118-153; DS:140-148 | SS:114-148,172-194: pinned binding/repo integrity, immutable/pre-B, hard-link publication. | Bind task-owned source before B; use recovery reference, never edit state to retarget. |
| PC:94-111; L:108-114; RL:15-22 | SB:41-108: env UUID/native DB/root source/cwd; same-user tampering outside protection (:37-39). | Corroborate/bind via session current/bind; binding is not hook proof. |
| D:444; DS:146-148 | GW:273-301,315-370: parsed risky substitution/bound foreign-worktree denial; Bash matcher/probe failure/recovery exemptions (:5-21,37-43). | Use files/apply_patch/quoted heredoc for prose and git -C source; guards are narrow safeguards. |
| L:28-29; DEL:16; DS:347-350 | SA:865-882 denies child spawn without consumed grant; SA:287-337 other scope/goal/FSM constraints are injected prose. | Leaves return bounded results; recursion requires dispatcher grant. Keep scope/goal warnings, not universal-enforcement claims. |
| DEL:369-430; W:95-111; PO:18 | FD:61-69,128-168,178-233,250-263 checks claims/issuance/IDs/stopped fields/terminal states; primary+one fallback. Main's evidence assertions; unmarked callers bypass. | Managed dispatch follows returned action; only main-direct permits reclaim; one DEL wire-contract example. |
| DEL:25-33 | DC:203-255,266-298 result/command/exit matching and effect-declaration preflight; never executes verifier. | Validate against packet/preflight; declared effects are claims, actual execution/isolation remain caller duties. |
| W:113-126 | AO:38-62,68-94 exact matcher/task/child/stored heartbeat checks; UI/file/unhooked nested/races outside safeguard (:1-4). | Verify stored task association before heartbeat mutation; narrow hook is not all-surface authorization. |

Keep human obligations: loading owners, consultation, independent review, scope, full roadmap content, hosted CI coverage, push/merge/peer grants and truthful evidence. Form-only gate AT:160-165, filename-only PG:31-80, asserted managed evidence DEL:415-426, and injected SA:287-337 do not enforce those judgments.

L1 overlap: arming injection repeats scope/binding/status/goal/init/attest/continuation/grants (HK:505-532). Prefer dynamic binding/phase plus owner route, algorithm once in L4; runtime edits belong to parent. PostCompact here clears dedupe and returns empty, **not** immediate additionalContext (HK:2020-2032). Skill-body inlining adds real transport cost (SA:791-821); attachments are never invented (SA:940-944).

## D. Tests pinning document strings/schema

Actual document reads, separate from generated-hook assertions. Preserve schemas/routes; revise duplicate-location pins when moving an owner.

| Test:line | Document / exact pin | Rewrite constraint |
|---|---|---|
| MT:21-44 | All frontmatters `^---\n([\s\S]*?)\n---`; no top-level `license:`/`keywords:` | Nested dev metadata.keywords allowed. |
| MT:156-160,187-192 | D literal Markdown targets `](references/methodology-overlays.md)`, `](references/development-practice.md)`, `](references/product/crud-product-development.md)` | Keep links/nonempty files or revise router test. |
| MT:161-170,187-192 | P targets `](references/phase-control.md)`, `](references/phase-plan.md)`, `](references/plan-output.md)`, `](references/phase-audit.md)`, `](references/phase-check.md)`, `](references/implementation-units.md)`, `](references/optimization.md)`, `](references/loop-engineering.md)`, `](references/delegation.md)` | Labels/prose free to change. |
| MT:172-183,187-192 | L targets `](../dev/SKILL.md)`, `](../pabcd/SKILL.md)`, `](references/runtime-lifecycle.md)`, `](references/durable-goalplan.md)`, `](references/waiting.md)`, `](references/divergence-tiers.md)`, `](references/lane-dispatch.md)`, `](../pabcd/references/implementation-units.md)`, `](../pabcd/references/loop-engineering.md)`, `](../pabcd/references/optimization.md)`, `](../pabcd/references/delegation.md)` | Compact conditional table can retain all. |
| MT:196-203 | DEL `](../../loop/references/waiting.md)` + nonempty target; D `references/skill-catalog.md` | Preserve or update owner test. |
| NT:45-55 | D/L/P links resolve to `skills/dev/references/native-execution.md`; Markdown regex `\]\(([^)]+)\)` | One native route each, relative spelling flexible. |
| AST:214-249 | PC table ASCII edge grammar `^\|\s*(IDLE->P\|I->P\|P->A\|A->B\|B->C\|C->D)\s*\|([^\|]*)\|`; KEYS cell: P->A `from,to,did,planUnit`; A->B `from,to,did,auditOutput,auditVerdict`; B->C `from,to,did`; C->D `from,to,did,checkOutput,exitCode`; file-wide `workPhaseId`, `testReceiptPath`, `ATTEST-SHAPE-01` | Preserve arrows/column or change parser. Actual required-row assertions cover gated edges only; no examples required. |
| LT:346-354 | LD includes fixture values `8`, `120000`, `15` anywhere (targets/time/retention) | Keep single envelope or change doc assertions. |
| LT:362-367 | Fixture cap `6`, error `agent thread limit reached`; LD must contain error | Cap assertion binds fixture, error assertion binds doc. |
| LT:377-382 | W line containing `wait_threads` also includes `8`; anywhere `120000` | Forces numeric duplication: change to owner route/schema test. |
| LT:385-388 | DEL includes `8`, `120000`, `10`, `20000`, `50`, `60000` anywhere | Forces thread-envelope duplication; assertion does not bind values to rows. |
| LT:391-395 | DS `DISPATCH-FANOUT-CAP-01`, character `6`, exact `](../../loop/references/lane-dispatch.md)` | Keep ID/route; number-anywhere check can pass incidental digit. |
| SAT:1179-1189 | D line starts `description: `; value JSON.parse-able nonempty string; catalog `- cxc-dev: ` + first 120 chars; no `- cxc-loop:`/`- cxc-pabcd:` | Wording dynamic; preserve JSON-quoted single line and leaf catalog separation. |
| SAT:1192-1199 | Current whole D body inlined once, repeat idempotent; whole DP body absent | Shorten D freely; do not recursively inline refs. |

Non-document runtime pins: MAPT:241,255-257,342,354 assert injected `DEV-STACK-06/07`/stack reference; HKT:264 generated `phase-plan/plan-output`; SAT:1172-1176 generated mention forms. These do not pin SKILL prose. No direct body-phrase pins found for PP/PO/IU/RL/DG/SP/SO in searched roots; DP only excluded-reference check above. Bounded search, not repository-wide guarantee. Removed fragile prose tests acknowledged at MT:146-149.

## E. Target outline and UTF-8 byte budgets

L2 selection descriptions: <=240 B frontmatter, <=100 B YAML short description; describe when to select, keep procedures in L3/L4. Current surfaces: D/L/P:3 and each dev/loop/pabcd `agents/openai.yaml:3,5` (implicit enabled). Preserve invocation policy and loading≠activation boundary (L:14-22, P:17-21).

| L3 file / ceiling | Target outline (bytes, including reserve) | Routing/removal basis |
|---|---|---|
| dev/SKILL.md **7,500 B** vs 32,812 now | Metadata/title 500; authority/rule classes 600; class/depth/proof/record table + fast path 1,500; universal evidence/safety/git/privacy/output 1,250; surface table 2,000; discovery/attachments/reading 550; conditional refs 850; reserve 250 | Retain D:14,26-84,125-163,256-275,437-445. CI diagnostics out (:384-411); combine four practice stubs (:306-331), two ownership paragraphs (:165-166,235-238), stack recital (:88-93,446). |
| loop/SKILL.md **2,500 B** vs 11,159 now | Metadata/title 350; activation/mode/scope 550; conditional routes 650; docs-first WHEN/continuation/recovery/outcomes 700; reserve 250 | Retain L:12-26,122-128,135-158. Binding/init/attest/Stop → RL/PC; dispatch algorithm → DS; inherited async/peer rules → dev routes. Keep short leaf caveat. |
| pabcd/SKILL.md **3,500 B** vs 12,335 now | Metadata/title 400; intent/dev class pointer 400; FSM/cycle/deliverables 850; current-phase/control routes 850; record/delegation/loop handoffs 650; reserve 350 | Retain P:69-104; remove second class table (:113-123), parser explanation (:23-36), shared-tree essay (:125-151), storage (:168-172), repeated git/proof (:83-84), repair thresholds (:155-160). Formal P still loads PP/PO. |

L4 target owners: DP conventions/necessity/read/edit; SO index; SP manual invariants + opt-in recipes + separately authorized §08 appendix; PC commands/identity/edges/source recovery; PP consultation/executable plan/verifier/bypass grounding; PO nine fields/consultation record; IU residence/roadmap/numbering once; DS selection/isolation/grant; DEL subagent packet/role/family/fallback; LD task packet/address/one host envelope; RL entry/arming/gate diagnostics; DG schema/CLI/compatibility; W observation/retirement/wake/budget/automation ownership. Existing boundary anchors: SO:40-46, DS:3-5, DEL:3-8, LD:3-6, RL:3-5.

Parent implementation order: reconcile ownership/scope contradictions; compact L3 preserving tested links; consolidate L4; change numeric duplication tests; shrink L1 while preserving guard behavior. No runtime/test/product edits are authorized for this leaf.
