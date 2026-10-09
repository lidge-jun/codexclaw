---
name: cxc-dev
description: "MUST USE for coding, PR creation/review/merge, dependent branches, scaffolding, and QA. Classify C0-C5, preserve safety and fresh proof, and load the matching surface owner. Triggers: develop, fix, refactor, test, review, docs, browse, QA, stacked PR, 개발, 수정, 검토, 스택 PR."
metadata:
  last-verified: "2026-07-02"
  short-description: "Universal dev discipline: work classifier, modular limits, verification gate, safety rules."
---

# Dev

User/host safety and tool contracts prevail. Diagnosis/review permits investigation only; changes stay in authorized scope. Prose is not runtime enforcement.

## §0.0 Work Classifier (C0-C5)

DEV-CLASS-01 (DEFAULT): classify before depth; reclassify growth. Decide discovery ownership before broad reads, even read-only.

| Class | Signals | Process |
|---|---|---|
| C0 | Text only; zero behavior change | Direct edit + smallest proof |
| C1 | One file, local behavior, no new abstraction | Fast path + focused check |
| C2 | Conventional product slice | Compact plan, adjacent conventions, focused tests, micro-audit |
| C3 | Module boundaries, shared types, broad behavior | PABCD depth by risk/persistence; subagent audit when warranted |
| C4 | Auth, payments, deletion, migration, release, permissions, security | Full PABCD, gates, durable risk/evidence |
| C5 | Ambiguity after one clarification round | Interview via `pabcd`; resolve/reclassify C0-C4 before build |

Tie-break: higher class wins (DEFAULT); route→service→storage remains C2.
DEV-ESCALATE-01 (STRICT): security, deletion/migration, destruction, public contracts, release, permissions, new dependencies/frameworks promote the affected part to C4. Split it out; promotion alone requires no question.

## §0.1 Patch Fast-Path (C0/C1)

C0/C1 skip convention/owner search and references unless explicitly routed; keep §3/4/5/static checks and visible conventions. Five lines is illustrative. Security/data-loss/new abstractions exclude this path; text-only edits do not escalate by location.
C0 needs no numbered unit; C1 records change/reason/proof in existing units only. Never create units just for C0/C1; [unit residence](../pabcd/references/implementation-units.md) owns UNIT-RESIDENCE-01.

## §0.2 Rule Classes

Safety/correctness/permissions/truthful proof are mandatory. Size/naming/layout/style are DEFAULT/STYLE_SAMPLE despite old MUST/HIGH labels unless a cited project/user contract binds them. Requested workflows keep phase/evidence; other unclassified rules are DEFAULT.

- STRICT: violation blocks completion.
- DEFAULT: follow unless a stated, documented reason warrants deviation.
- HEURISTIC: judgment guide; deviation needs no rationale.
- DEV-STYLE-SAMPLE-01 (STYLE_SAMPLE): illustration, never universal.
- ESCALATE: stop and ask the user.

## §0.4 Workflow Modes

Mode: chat, PABCD, goal, scoped subagent, read-only (no writes), docs-only (consistency checks). Read `pabcd`/`cxc-loop` for mechanics; classify each work-phase. Docs-first: `cxc-loop` (LOOP-DOCS-FIRST-01).
Production: deployed to real users beyond the author; excludes prototypes/spikes/internal demos.

## Companion Skills

DEV-ROUTE-01 (STRICT): before writing, read every matching surface router SKILL.md. References are conditional; C0/C1 exceptions apply.

### Reading contract

Read active SKILL.md fully; references only when applicable. Truncation is incomplete even at exit 0: reread separately or in numbered contiguous, non-overlapping chunks through EOF; verify no gaps before acting. Respect output limits/C0-C1 exceptions.

| Change surface | Primary router | Also load |
|---------------|----------------|-----------|
| Backend / API / server | `dev-backend` | `dev-security` for auth/input |
| Frontend / UI / web | `dev-frontend` | `dev-uiux-design` for vague/open visual direction, UX-state meaning, IA, brand, concept gen |
| App database / OLTP / transactional schema | `dev-backend` | `dev-security` for access; `dev-testing` for migrations |
| Analytics / ETL / data quality / analytical backfills | `dev-data` | `dev-backend` for API integration |
| Tests / QA | `dev-testing` | `dev-frontend` for browser QA |
| Security / auth / secrets | `dev-security` | surface-specific router |
| Architecture / modules / deps | `dev-architecture` | `dev-scaffolding` for new structure |
| Debugging / crashes / perf / comprehending unknown systems | `dev-debugging` | surface-specific router; `references/logic-analysis.md` when no defect |
| DevOps / deploy / infra | `dev-devops` | `dev-security` for credentials |
| Native desktop: Tauri, AppKit/SwiftUI, WidgetKit, menu-bar/tray apps, embedded sidecars, signing/notarization, macOS approval prompts | `dev-devops` → `references/native-desktop-acceptance.md` and `references/macos-system-approvals.md` | `dev-testing` for suites and CI matrix; `cxc-qa` for gui/cli verdicts; `dev-frontend` for web-view UI; `dev-security` for entitlements and credentials; `dev-debugging` runtimes/swift.md |
| Scaffolding / docs / setup | `dev-scaffolding` | `dev-architecture` for boundaries |
| Code review | `dev-code-reviewer` | `dev-security` + `dev-testing` |
| Diagrams / charts / visual documents / reports / PDF composition | `dev-visualizer` | Available document-format owner for PDF/DOCX/Slides mechanics; `dev-frontend` and `dev-uiux-design` retain implementation/design ownership |

### Subagent Skill Injection (DEV-SKILL-INJECT-01)

Attach dev+surface skills explicitly; search tasks also attach search and its policy. Use resolvable links or supported mentions/v1 items; hooks never infer omissions. Mappings: [ownership](references/skill-ownership.md); triggers: `agents/openai.yaml`.

### Discovery delegation

Before broad reads, bound the question; delegate to configured explorer if independent and main has separate work. State scopes; host/no-delegation limits win. Record unavailability; read narrowly.
Local lookup must determine next steps or be inseparable; explain substantial reads. Read-only/counts/parallelism do not justify them. Revisit on new subsystems/rereads/truncation; reclassify growth.
Use a [discovery packet](../pabcd/references/delegation.md#discovery-packet); check needed spans, reassign named gaps before expanding, no routine re-investigation. Discovery replaces neither implementation delegation nor independent review.
Isolation: [dispatch surfaces](../pabcd/references/dispatch-surfaces.md); read-only leaves do not justify parallel writes. Authorized delegation needs no new approval.
Model claims need runtime proof; cost compares main+child input/cache/output prices/tiers, not tokens.

## Family Invariants

- FAMILY-SLOP-01 (DEFAULT): no filler, performative narration, decorative rationale, placeholders, TODO-only output, fake fallbacks, speculative wrappers/defensive clutter without boundary reasons. Prose/page tells: `kwrite` and `dev-visualizer` REPORT-DESIGN-01.
- FAMILY-READER-01 (DEFAULT): [reader documents](references/reader-documents.md) for human deliverables; link raw audit artifacts.
- FAMILY-CITE-01 (STRICT): findings/plans/reviews/contradictions cite `path:line`; plans name paths/verifiers; proof includes command+output/artifact.
- FAMILY-PROOF-01 (STRICT): completion follows §3; all routers inherit it.

## 3. Verification Before Completion (STRICT)

1. Identify the command proving the claim.
2. Run it fresh, never cached.
3. Read full output; check exit code and count failures.
4. Confirm it supports the claim.
5. Report the claim with evidence.

| Claim | Requires | Insufficient |
|---|---|---|
| Tests pass | Expected tests executed; fresh zero failures | Old/absent/skipped/cancelled tests, assumptions |
| Build succeeds | Build exit 0 | Lint success |
| Bug fixed | Original symptom resolved | Edit alone |
| Feature complete | Every requirement checked | Tests alone |
| Subagent completed | Actual changes in VCS diff | Child report alone |
| Regression test works | Verified red→green | One passing run |

DEV-VERIFY-FLOOR-01 (STRICT): floor, not cap:

| Class | Floor |
|---|---|
| C0/C1 | C0 text consistency; C1 focused check, or observed repro with stated limits when automation does not fit |
| C2 | Integration/contract tests + build/typecheck + changed-UI smoke; CRUD negatives: `dev-testing` references/core/crud-test-matrix.md |
| C3 | Affected suites + public-contract/doc consistency |
| C4 | Full relevant gates + negatives + durable evidence |

Verify child success independently: diff and behavior.

## 4. Change Documentation

C2+ supplied logs record change/reason/proof. C0/C1 follow §0.1; discovered logs create no duty. Explicit requests/release contracts bind named logs; no unrelated records.

## 5. Safety Rules

- Search consumers before export removal; unused internal exports may go within scope; public removal needs compatibility/migration decisions.
- Confirm import target files/exports; externalize config in files/env and name magic constants.
- Surface async errors: verified JS/TS backend `neverthrow` boundaries (`dev-backend` §3), otherwise try/catch with contextual logs.
- Destruction (ESCALATE): explicit approval for file deletion/table drops/state resets/cache clearing.
- DEV-GIT-COMMIT-01 (DEFAULT): locally commit each complete implementation step; do not accumulate a feature uncommitted.
- DEV-GIT-PUSH-01 (ESCALATE): explicit current-session approval for remote pushes, force pushes, remote branch creation and tags. Local commits are autonomous; completion grants no push permission.
- DEV-SHELL-TEXT-01 (STRICT): generated prose/replacements use apply_patch/files/quoted-delimiter heredocs/--body-file, never double-quoted shell or sh -c payloads. Use `git -C <source>`; hooks cannot see workdir. SHELL-SUBST-01/WORKTREE-GUARD-04 are narrow safeguards.
- DEV-PRIVACY-01 (STRICT): no raw client/personal transcripts, documents/figures, named private conversations or credentials in repo evidence/fixtures/samples. Store outside checkout; devlog records filename/date/summary. Before first branch push, list identifying company/product/people/distinctive-number terms and search the push range (DEFAULT). Fix hits by rewriting unpushed commits, never follow-up commits that retain exposed history.
- Dependent delivery follows [stacked PRs](references/stacked-prs.md) (DEV-STACK-01, DEV-STACK-02, DEV-STACK-04, DEV-STACK-OPT-IN-01); retain its merge/native-selection grants.

## Conditional Routes

Read matching rows; repo tools own local facts.

| When | Read |
|---|---|
| PR creation/review/merge, dependent delivery | [Stacked PRs](references/stacked-prs.md) (DEV-STACK-06/07) |
| Method/repo requirement/strict trigger | [Methodology overlays](references/methodology-overlays.md) |
| C2 conventional slice | [CRUD](references/product/crud-product-development.md) |
| C2+ implementation/new abstraction | [Practice](references/development-practice.md) |
| Debug/comprehend | `cxc-dev-debugging`; no defect: its `references/logic-analysis.md` |
| Hosted CI | [CI evidence](references/hosted-ci-evidence.md) (DEV-CI-EVIDENCE-01) |
| Questions | [Async questions](references/async-questions.md) |
| Peer contact | Default-off; [peer collaboration](references/peer-collaboration.md) |
| Composition/projection/JS | [Native execution](references/native-execution.md) |
| Browser proof/extraction/UI QA | [Browser routing](references/browser-routing.md) |
| Library behavior | Context7 resolve-library-id → query-docs; otherwise official docs |
| Current/public/HTTP evidence | `cxc-search` |
| Lost prior context | DEV-RECALL-01 (STRICT): `cxc-recall` chat+memory search; both miss: ask/report searches |
| Code smells | `cxc-dev-code-reviewer` §3; boundary errors: `dev-architecture` §4 |
| Types/static checks | [Static analysis](references/static-analysis.md), [gates](references/static-analysis-gate.md) |
| Lane observation | [Waiting](../loop/references/waiting.md) (DISPATCH-POLL-BUDGET-01) |
| Capability gap | DEV-SKILL-DISCOVERY-01 (DEFAULT): [catalog](references/skill-catalog.md), `cxc skill search <query>` (jaw first; --source all adds clawhub/hermes), needed `cxc skill show <id>`; built-ins win, adapters preserve dev |
| Ownership | [Ownership](references/skill-ownership.md); update owner first |
