# Dev lane obligation ledger

Scope: `plugins/codexclaw/skills/dev/SKILL.md` and the new `plugins/codexclaw/skills/dev/references/hosted-ci-evidence.md`. The two evidence files are the separately requested lane records. No git writes, build, orchestration, goal mutation, agent dispatch, or other lane edits.

Paths below are repository-relative. `D` means `plugins/codexclaw/skills/dev/SKILL.md`; `R` means `plugins/codexclaw/skills/dev/references/`; `P` means `plugins/codexclaw/skills/pabcd/references/`. These abbreviations expand directly to the named path, not to an installed-root instruction.

| Old obligation or passage | New location / disposition |
|---|---|
| User and actual host safety/tool contracts override guidance | D#dev |
| Diagnosis/review authorizes investigation, not fixes, installs, publishing or account changes; change requests authorize scoped implementation | D#dev |
| Guidance is not hook enforcement | D#dev |
| DEV-CLASS-01: classify every task before choosing process depth; never use maximum depth by default | D#00-work-classifier-c0-c5 |
| Classification provisional; reclassify growth and decide discovery ownership before broad investigation, even read-only | D#00-work-classifier-c0-c5 and D#discovery-delegation |
| C0: text only, zero behavior change, direct edit and smallest proof | D#00-work-classifier-c0-c5 |
| C1: single file, local behavior, no abstraction, fast path and targeted check | D#00-work-classifier-c0-c5 |
| C2: conventional product slice, compact plan, adjacent conventions, focused tests, micro-audit | D#00-work-classifier-c0-c5 |
| C3: cross-module/shared-type/broad behavior; PABCD depth by persistence/risk; warranted subagent audit | D#00-work-classifier-c0-c5 |
| C4: auth/payment/deletion/migration/release/permission/security; mandatory full PABCD, relevant gates and durable evidence | D#00-work-classifier-c0-c5 and D#3-verification-before-completion-strict |
| C5: unresolved ambiguity after clarification; Interview then C0-C4 reclassification before implementation | D#00-work-classifier-c0-c5 |
| Higher-class tie break; conventional route/service/storage remains C2 across files | D#00-work-classifier-c0-c5 |
| DEV-ESCALATE-01: affected security/deletion/migration/destruction/public-contract/release/permission/dependency/framework part gets C4 care | D#00-work-classifier-c0-c5 |
| Split promoted part rather than inflate whole task; promotion alone does not require user question | D#00-work-classifier-c0-c5 |
| C0/C1 skip proactive conventions/pre-write search/reference reading; keep verification, documentation, safety and applicable static checks | D#01-patch-fast-path-c0c1 |
| Five-line edit is an example, not fast-path maximum | D#01-patch-fast-path-c0c1 |
| C0/C1 read surface router; references only when router explicitly routes | D#01-patch-fast-path-c0c1 and D#companion-skills |
| Visible touched-file conventions still apply | D#01-patch-fast-path-c0c1 |
| Security/data-loss/new abstraction excludes fast path; promotion follows executed behavior, not file location | D#01-patch-fast-path-c0c1 |
| C0 has no numbered-unit duty; C1 short change/reason/proof record only in existing unit; create no unit just for C0/C1 | D#01-patch-fast-path-c0c1 |
| UNIT-RESIDENCE-01 residence and numbered documents | pointer to Pimplementation-units.md; D#01-patch-fast-path-c0c1 owns exemptions |
| Authority follows purpose; safety/correctness/permission/truthful verification mandatory | D#02-rule-classes |
| Size/naming/layout/style remain DEFAULT/STYLE_SAMPLE despite MUST/NEVER/HIGH rhetoric; cite user/project contracts that bind them | D#02-rule-classes |
| Explicit requested workflows retain phase/evidence duties; unclassified rules default unless safety/correctness consequence | D#02-rule-classes |
| STRICT blocks completion; DEFAULT needs stated documented reason; HEURISTIC needs no deviation rationale; ESCALATE asks user first | D#02-rule-classes |
| DEV-STYLE-SAMPLE-01: examples never become universal requirements | D#02-rule-classes |
| PR creation/review/merge/dependent delivery loads stacked owner even without DevOps; generic CSS/runtime stacks unrelated | pointer to Rstacked-prs.md#dev-stack-06--recognize-and-register-deliberately-default; D#conditional-routes |
| DEV-STACK-06/07 recognition and separate topology/membership/CI inspection | pointer to Rstacked-prs.md#dev-stack-06--recognize-and-register-deliberately-default and #dev-stack-07--diagnose-ci-independently-default |
| Ordinary/manual PR default; DEV-STACK-OPT-IN-01 requires clear task-specific GitHub native-stack request; maps/base are not opt-in | pointer to Rstacked-prs.md#native-stacks-are-explicit-only-dev-stack-opt-in-01; D#5-safety-rules |
| Methodology conditional on explicit method/repo requirement/strict trigger; no owner preload | pointer to Rmethodology-overlays.md#03-methodology-overlays; D#conditional-routes and D#reading-contract |
| C2 conventional product slice also loads CRUD product development | D#conditional-routes → Rproduct/crud-product-development.md |
| Recognize chat/PABCD/goal/scoped subagent/read-only/docs-only modes; read-only no writes; docs-only consistency checks | D#04-workflow-modes |
| PABCD/goal/divergence/repeated-phase mechanics owned by pabcd/loop; classify each phase | D#04-workflow-modes → plugins/codexclaw/skills/pabcd/SKILL.md and plugins/codexclaw/skills/loop/SKILL.md |
| LOOP-DOCS-FIRST-01 multi-cycle docs-first activation | removed: duplicate of plugins/codexclaw/skills/loop/SKILL.md; D#04-workflow-modes retains owner pointer |
| Production definition: real users beyond author; exclude prototypes/spikes/internal demos | D#04-workflow-modes |
| DEV-ROUTE-01: every matching surface router must be read before writing; multiple surfaces load each | D#companion-skills |
| Backend/API/server → backend; security for auth/input | D#companion-skills, unchanged surface row |
| Frontend/UI/web → frontend; UIUX for vague direction, meaning, IA, brand, concepts | D#companion-skills, unchanged surface row |
| OLTP/schema → backend, security access, testing migrations | D#companion-skills, unchanged surface row |
| Analytics/ETL/data quality/backfills → data; backend API integration | D#companion-skills, unchanged surface row |
| Tests/QA → testing; frontend browser QA | D#companion-skills, unchanged surface row |
| Security/auth/secrets → security + surface router | D#companion-skills, unchanged surface row |
| Architecture/modules/dependencies → architecture; scaffolding new structure | D#companion-skills, unchanged surface row |
| Debug/crashes/perf/comprehension → debugging + surface; no-defect logic analysis reference | D#companion-skills, unchanged surface row |
| DevOps/deploy/infra → DevOps; security credentials | D#companion-skills, unchanged surface row |
| Native desktop → DevOps acceptance/approval owners, testing CI, QA verdicts, frontend webview, security entitlements, debugging Swift | D#companion-skills, unchanged surface row |
| Scaffold/docs/setup → scaffolding + architecture boundaries | D#companion-skills, unchanged surface row |
| Code review → reviewer + security + testing | D#companion-skills, unchanged surface row |
| Diagrams/charts/visual documents/reports/PDF → visualizer + document mechanics; frontend/UIUX keep implementation/design ownership | D#companion-skills, unchanged surface row |
| Full selected reads must reach model; exit 0 is insufficient after truncation; reread separately or contiguous numbered chunks to EOF with no gaps | D#reading-contract |
| Full-read recovery respects output limits and fast-path exceptions; no guessing from elision markers or preloading unrelated refs | D#reading-contract |
| DEV-SKILL-INJECT-01 explicitly attach dev and every relevant surface skill | D#subagent-skill-injection-dev-skill-inject-01 |
| Prefer resolvable skill links; plugin-native mentions/v1 items supported; hooks never infer omitted skills | D#subagent-skill-injection-dev-skill-inject-01 |
| Search children explicitly attach search and inherit search policy | D#subagent-skill-injection-dev-skill-inject-01 |
| Surface-owner map and canonical agents/openai.yaml triggers | D#subagent-skill-injection-dev-skill-inject-01 → Rskill-ownership.md#skill-ownership-map |
| Authorized read-only assessment/debug/source comparison may use explorer without implementation/full PABCD | D#discovery-delegation; classification/modes stay D#00-work-classifier-c0-c5 and D#04-workflow-modes |
| Small orientation; independent question plus separate main work delegates before full source read; state both scopes; configured role/protocol | D#discovery-delegation; transport pointer to Pdelegation.md#discovery-packet |
| Respect no-delegation/host restrictions; if unavailable record limitation and bounded local reads | D#discovery-delegation |
| Discovery leaves share cwd; read-only safety is no template for parallel writes; branch/checkout/merge lanes are separate tasks | pointer to Pdispatch-surfaces.md; D#discovery-delegation retains hazard/pointer |
| Local immediate-step/inseparable lookup allowed; substantial local reads require concrete reason; counts/read-only/parallelism insufficient | D#discovery-delegation |
| Authorized routine delegation requires no new approval | D#discovery-delegation |
| Revisit split on subsystem growth/rereads/truncation; reclassify scope change | D#discovery-delegation |
| Discovery packet is bounded findings/anchors/uncertainties, not full dumps | pointer to Pdelegation.md#discovery-packet; D#discovery-delegation |
| Check only needed child-cited spans; name/reassign evidence gap before expansion; no routine repeated investigation | D#discovery-delegation |
| Discovery replaces neither implementation delegation nor independent review | D#discovery-delegation |
| Served-model identity/cost uses runtime proof; prices include main+child input/cache/output and tiers; token totals alone insufficient | D#discovery-delegation |
| Independent peer work stays local; outbound default-off; explicit request/confirmed CI-merge collision only, host grants/wake checks; no unsolicited discovery/progress | pointer to Rpeer-collaboration.md#decide-whether-to-contact-another-task; D#conditional-routes retains default-off boundary |
| Use dev/repo tools for local facts; search/PABCD/loop/recall/QA/surface owners for domains | D#conditional-routes and D#companion-skills |
| Deprecated skill-hub note | removed: history (moved to evidence/dev-moved-history.md); D#conditional-routes positively names current routes |
| Native Code Mode preferred for nontrivial composition/projection/JS; simple/direct calls and restrictions win; no invented/enabled absent runtime | pointer to Rnative-execution.md#choose-from-the-current-callable-surface; D#conditional-routes |
| Browser routing owns public/authenticated/extraction/local QA; prefer suitable Aside, recommend agbrowse, assume no optional tool/account, no runner installs for Playwright; project E2E testing owner | pointer to Rbrowser-routing.md#selection; D#conditional-routes |
| Canonical owner first; stubs pointers; multi-domain owners loaded | pointer to Rskill-ownership.md#skill-ownership-map; D#conditional-routes and D#companion-skills |
| Role boundary: dev universal process/safety; UIUX design concepts; frontend implementation/rendered tells FE-AI-TELL-01 | removed: duplicate of Rskill-ownership.md#skill-ownership-map and plugins/codexclaw/skills/dev-frontend/SKILL.md#do-not-ship-these-tells-fe-ai-tell-01; unchanged surface rows retain routes |
| FAMILY-SLOP-01 no filler/performative/decorative prose or placeholders/TODO-only/fake fallbacks/speculative layers/defensive clutter without named boundary | D#family-invariants |
| Korean em-dash/connector tells and unnecessary enumerations; kwrite owner | pointer to plugins/codexclaw/skills/kwrite/SKILL.md#pass-2--translationese--ai-idioms-s1 and #pass-3--mechanical-structure-s2; D#family-invariants |
| Bold-label/three-item list and printed stat-card/callout/box-arrow tells; visualizer REPORT-DESIGN-01 owner | pointer to plugins/codexclaw/skills/dev-visualizer/reference/report-writing.md and reference/visual-design.md#report-design-01-a-report-is-set-like-a-publication-not-a-dashboard-strict-for-delivered-reports; D#family-invariants |
| FAMILY-READER-01 answer-first human document, evidence separated/anchored, fresh-reader check; raw receipts/logs/ledgers linked unchanged | pointer to Rreader-documents.md#reader-doc-01-reader-contract-default and #reader-doc-05-fresh-reader-check-default-for-c2-strict-for-user-delivered-reports; D#family-invariants retains raw-artifact rule |
| FAMILY-CITE-01 findings/plans/reviews/contradictions use path:line; plans exact paths/verifiers; proof command plus output/artifact | D#family-invariants |
| Doctrine mirror source-line commentary | removed: history (moved to evidence/dev-moved-history.md); FAMILY-CITE-01 retained |
| FAMILY-PROOF-01 fresh proof for every completion claim, inherited by all routers | D#family-invariants → D#3-verification-before-completion-strict |
| Library syntax/pinned behavior via Context7 resolve/query or official docs | D#conditional-routes |
| Current versions/releases/CVEs/providers/public/HTTP proof uses search evidence rules and HTTP-first procedure | pointer to plugins/codexclaw/skills/search/SKILL.md; D#conditional-routes |
| DEV-RECALL-01 unfamiliar prior terms/files/decisions or lost context requires chat AND memory search; both miss: ask/report searches | D#conditional-routes → plugins/codexclaw/skills/recall/SKILL.md#recall-lookup-scope-read-first and #commands |
| Clarify only material uncertainty, skip answered questions; optional async questions continue authorized work, incorporate answers, exposed allowed tool only; Interview separate | pointer to Rasync-questions.md#send-continue-incorporate and #goal-and-interview-boundaries; D#conditional-routes |
| C2+ conventions/modular/necessity/owner/read-before-edit/friction; source/direct callers before proposing, no unapproved new structure | pointer to Rdevelopment-practice.md#05-repository-convention-discovery and #15-necessity-gate--pre-write-search-obligation; D#conditional-routes |
| DEV-NECESSITY-01 before new abstraction | pointer to Rdevelopment-practice.md#15-necessity-gate--pre-write-search-obligation |
| DEV-FRICTION-01 and DEV-EDIT-SHAPE-01 repeated command/edit patterns | pointer to Rdevelopment-practice.md#2-systematic-debugging |
| Non-obvious defects/repeated repairs debugging owner; no-defect comprehension logic-analysis owner | D#conditional-routes → plugins/codexclaw/skills/dev-debugging/SKILL.md and references/logic-analysis.md |
| “I can't analyze this” skipped-observation rhetoric | removed: history (moved to evidence/dev-moved-history.md); comprehension route retained |
| Completion gate: identify, execute fresh, read full output/exit/failures, confirm claim, report proof | D#3-verification-before-completion-strict |
| Tests claim requires expected executed tests and fresh zero failures; old/absent/skipped/cancelled/assumed tests insufficient | D#3-verification-before-completion-strict |
| Build claim requires build exit 0, not lint | D#3-verification-before-completion-strict |
| Bug claim requires original symptom resolved, not edit alone | D#3-verification-before-completion-strict |
| Feature claim checks every requirement, tests alone insufficient | D#3-verification-before-completion-strict |
| Child completion requires actual VCS diff, independent changes/behavior proof; child success report insufficient | D#3-verification-before-completion-strict |
| Regression-test claim requires verified red-green, not one pass | D#3-verification-before-completion-strict |
| DEV-CI-EVIDENCE-01 and five false-green cases; head/tested SHA/event/run/attempt, expected jobs/dependencies and merge ref; separate absent/approval/skipped/cancelled/pending/failed states | Rhosted-ci-evidence.md#hosted-ci-evidence-dev-ci-evidence-01-default; entire block moved verbatim |
| CI approvals/reruns need authorization separate from diagnosis; full rerun only when partial cannot regenerate evidence | Rhosted-ci-evidence.md#hosted-ci-evidence-dev-ci-evidence-01-default; verbatim |
| gh PR/check-run/run-list/run-view recipes | Rhosted-ci-evidence.md#hosted-ci-evidence-dev-ci-evidence-01-default; verbatim |
| Completed-job log endpoint while run active; read status/stderr/content; conditional escape flag uses non-executing reader; preserve run/attempt/job IDs and retention caveat | Rhosted-ci-evidence.md#hosted-ci-evidence-dev-ci-evidence-01-default; verbatim |
| DEV-VERIFY-FLOOR-01 universal floor, not cap; C0 text consistency; C1 focused check or observed repro with limits when automation does not fit | D#3-verification-before-completion-strict |
| C2 focused slice integration/contract + targeted build/typecheck + changed-UI smoke; CRUD operation negatives testing owner | D#3-verification-before-completion-strict |
| C3 affected suites and public contract/doc consistency; C4 full relevant gates/negative cases/durable evidence | D#3-verification-before-completion-strict |
| C2+ supplied log records change/reason/verification; explicit request/release-record contract still applies; no unrelated records | D#4-change-documentation |
| Finding devlog/changelog does not reintroduce C0/C1 automatic unit duty | D#4-change-documentation → D#01-patch-fast-path-c0c1 |
| Trace external export consumers; scoped unused internals may be removed after search; public removals need compatibility/migration decision | D#5-safety-rules |
| Confirm import target file/export exist before adding | D#5-safety-rules |
| Externalize configuration files/env, magic strings/numbers in named constants | D#5-safety-rules |
| Async errors at explicit boundary; verified JS/TS backend Result alternative allowed; otherwise contextual try/catch logging | D#5-safety-rules |
| Destructive file deletion/table drop/state reset/cache clearing requires explicit approval | D#5-safety-rules |
| DEV-GIT-COMMIT-01 local incremental commits for complete implementation steps; do not accumulate feature uncommitted | D#5-safety-rules |
| DEV-GIT-PUSH-01 explicit current-session remote push authorization, including force/remote branch/tags; local autonomous; D/completion not permission | D#5-safety-rules |
| DEV-SHELL-TEXT-01 generated prose/replacement through apply_patch/file/quoted heredoc/body file, never double-quoted shell/sh -c; git -C source because workdir invisible to hooks | D#5-safety-rules |
| SHELL-SUBST-01 git/gh merge-close executable substitution guard and WORKTREE-GUARD-04 bound foreign-worktree guard | pointer to plugins/codexclaw/skills/worktree-guardian/SKILL.md; D#5-safety-rules names narrow safeguards, preserves prose-writing rule |
| DEV-PRIVACY-01 no raw personal/client material in repo evidence/fixtures/assets; outside-checkout storage; devlog filename/date/summary | D#5-safety-rules |
| Pre-first-push identifier list and push-range search (DEFAULT), hit repair rewrites unpushed commits rather than retain history in follow-up | D#5-safety-rules |
| DEV-STACK-01 split oversized dependency-ordered work; DEV-STACK-02 cascade lower edits; DEV-STACK-04 user-authorized merge order including owner's exception | removed: duplicate of Rstacked-prs.md#dev-stack-01--when-to-stack-default, #dev-stack-02--cascading-edits-strict, #dev-stack-04--merging-and-safety-escalate; D#5-safety-rules keeps pointer |
| Code smell catalog, reviewer read while writing/reviewing; architecture boundary errors | D#conditional-routes → plugins/codexclaw/skills/dev-code-reviewer/SKILL.md and dev-architecture/SKILL.md |
| §6 “thresholds mirror §1 hard limits” residue | removed: duplicate of D#02-rule-classes and Rdevelopment-practice.md#1-modular-development; recorded in evidence/dev-moved-history.md |
| Strict/explicit types, repo-supported TS default, configured static checks, no new tooling/JS conversion without approval | pointer to Rstatic-analysis.md#js-ts-source-file-default, #type-annotations and #static-analysis-gate; D#conditional-routes |
| Narrow justified any/casts/type-ignore escapes, strongest local checker; per-language mappings/commands | pointer to Rstatic-analysis.md#escape-hatches and Rstatic-analysis-gate.md#per-toolchain-gate-commands; D#conditional-routes |
| Always read active skills, select relevant refs only, no unrelated preloads; child context also scoped | D#reading-contract and D#subagent-skill-injection-dev-skill-inject-01 |
| Shared credentials/API quota; inspect real budget before sustained observation, reserve workers, coordinator aggregate; DISPATCH-POLL-BUDGET-01 | pointer to plugins/codexclaw/skills/loop/references/waiting.md#observer-budget; D#conditional-routes |
| DEV-SKILL-DISCOVERY-01 catalog before search, jaw first, source-all adds clawhub/hermes, show only needed result, adapters preserve dev and built-ins win | D#conditional-routes |

## Verification and size

- Before: dev 32,812 bytes; new CI reference absent.
- After: dev 12,270 bytes (ceiling 12,288); new CI reference 3,283 bytes. Combined 15,553 bytes; reduction 17,259 bytes (52.6%). Dev entrypoint reduction 62.6%. Target approximately 8 KiB was not reached; unchanged surface rows plus complete universal duties use the hard ceiling.
- Exact comparison against the original read: description unchanged, surface rows unchanged, CI block verbatim. All current dev Markdown file/heading links resolve. Nested metadata keywords were removed after test searches found no reader; remaining metadata is retained.
- `node --test plugins/codexclaw/test/manifest-policy.test.mjs plugins/codexclaw/test/native-execution.test.mjs plugins/codexclaw/test/lane-packet.test.mjs`: 67 tests, 67 pass, zero failed/skipped/cancelled, exit 0.
- `node --test --experimental-strip-types plugins/codexclaw/components/pabcd-state/test/attest-shape-hint.test.ts plugins/codexclaw/components/subagent-config/test/spawn-attach-hook.test.ts`: 104 tests, 104 pass, zero failed/skipped/cancelled, exit 0.
- Final repeat after the citation-list edit: the same commands again passed 67 and 104 tests, exit 0, no failures/skips/cancellations. The parent owns the architecture gate/build/full suite and independent review.

## Cross-lane handoff

Replace the old `stacked-prs.md:112` line with exactly:

```md
Apply [hosted CI evidence](hosted-ci-evidence.md) (DEV-CI-EVIDENCE-01) to tell
```

The following line can continue `those states apart before acting on them.` The refs lane owns this edit. No edit to stacked-prs was made by this lane.

Uncertainty: repository-wide semantic uniqueness and the new architecture gate remain parent checks. Four IDs no longer occur literally in the dev router, but their definitions remain with their owners: FE-AI-TELL-01 (frontend), DEV-NECESSITY-01/DEV-FRICTION-01/DEV-EDIT-SHAPE-01 (development-practice). Guard IDs remain references to worktree-guardian; docs-first and stack IDs remain pointers. The wording “STRICT” on C4 promotion and the verification floor expresses their retained mandatory safety/evidence authority rather than introducing an exception.

Current refs-lane observation: stacked-prs now routes to hosted-ci-evidence.md at lines 83-84 through a resolving `../references/hosted-ci-evidence.md` link; the proposed replacement above describes the original line, not a remaining write request.
