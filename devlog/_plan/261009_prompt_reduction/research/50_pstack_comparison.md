# Two port fixes are worth preparing; keep PABCD machinery local

Reader: the parent maintainer decides which outbound PRs to prepare and which ideas belong in this prompt-reduction pass. Recommend two independent PRs into foxytanuki/pstack-opencodex: fix the case-colliding upstream lock and make missing/invalid model catalogs produce a controlled diagnostic. Both defects were observed in report 09. Adopt three documentation changes locally: compact owner routing, neutral reviewer packets, and precise delegation-failure labels. These are recommendations, not submitted PRs or fresh verification of the destinations.

## Evidence and URL notation

- **R07**: [Cursor pstack report](/Users/jun/.aside/u/0/artifacts/codexclaw-prompt-research/07-pstack-cursor.md), `ccb5507`, pstack 0.15.15.
- **R08**: [Claude ports report](/Users/jun/.aside/u/0/artifacts/codexclaw-prompt-research/08-pstack-claude-ports.md), MD `60ae9e2`, AJ `c658c0e`, CH `e050aa4`, EL `1b03678`.
- **R09**: [opencodex report](/Users/jun/.aside/u/0/artifacts/codexclaw-prompt-research/09-pstack-opencodex.md), foxytanuki `2dd2800`, upstream pin `12d587d`/0.15.5. All reports dated 2026-10-09; codexclaw comparisons use `96e8d5c`.
- **PI**: [initiative README](/Users/jun/Developer/new/700_projects/pabcd_initiative/README.md) and [dev-pabcd](/Users/jun/Developer/new/700_projects/pabcd_initiative/skills/dev-pabcd/SKILL.md), especially §2.1, §3.2, §3 A/C, §4, §7.1.
- **LS**: [layering standard](../001_layering_standard.md), “Placement test”, “Ownership and pointers”, “History stays out of instructions”, “Budgets”, “Enforcement”.

To keep the tables small, skill URLs use prefix notation: `P/name` means `https://github.com/cursor/plugins/blob/main/pstack/skills/name/SKILL.md`; `M/name` means `https://github.com/michael-denyer/pstack-claude/blob/main/plugins/pstack/skills/name/SKILL.md`. Each cell names an individual skill URL. **P+** is an opportunity for codexclaw, **C+** is stronger codexclaw process/tooling, **=** is overlap, **different** means incompatible goals. Comparisons are source judgments, not measured quality.

## Skill-by-skill: broad prompt workflows versus attested process

Workflow rows are grounded in R07 §1.1/§3, R08 §1.2, R09 §1.2/§3.2. `cxc-` prefixes are omitted in the counterpart column. Newer Cursor/MD skills are explicitly marked; they are absent from foxytanuki's inspected pin (R09 §0/§4a-7).

| pstack skill (URL) | What it does | codexclaw counterpart | Gap direction |
|---|---|---|---|
| P/poteto-mode | Route to playbooks, copy their steps | dev + pabcd | P+ breadth; C+ attested FSM |
| P/poteto-help | Typed help from owning files; newer skill | docs-site, skill-catalog | P+ onboarding |
| P/how | Explore, then explain subsystem flow | repo-map, explorer | P+ explanation; structural overlap |
| P/why | Investigate rationale across source categories | recall, debugging/logic-analysis | P+ archaeology |
| P/recall | Transcript/shared-record current-state brief | recall + recovery hooks | C+ search/injection; P+ status format |
| P/blast-radius | Prove the safety fact beyond the diff | plan field-chain, check activation | P+ evidence ladder; C+ field-chain |
| P/architect | Compare designs; screen agent-prone mistakes | P architect + design decision IDs | P+ alternatives; C+ traceability |
| P/arena | Rubric bakeoff, choose base, graft | none dedicated | P+; substantial new workflow |
| P/swarm | Parallel slices/races with receipts | delegation, lane-dispatch | P+ receipt rejection; C+ transport |
| P/interrogate | Same rubric across models; synthesize findings | A reviewer, code-reviewer | P+ panel; C+ pre-build plan audit |
| P/correct | Mine repeat failures; enforce above prose; newer | enforcement tiers, hooks | P+ mining; C+ named bypass honesty |
| P/automate-me | Mine transcripts into personal routing skill | none | P+; outside this pass |
| P/make-bot-ui | Cursor automation/webhook UI | remote is a different service | different; excluded by foxytanuki |
| P/setup-pstack | Budget/model role sheet | subagent-config, role TOMLs | overlap; equivalence partly uninspected |
| P/reflect | Three-lens transcript review into skill changes | devlog learning records | P+ dedicated retrospective |
| P/teach | Combine how/why into paced explanation | reader-documents, visualizer | P+ teaching; C+ fresh-reader check |
| P/tdd | Cheap red/green test with evidence | dev-testing | =; avoid duplicating |
| P/benchmark-checklist | Seven measurement-validity questions; newer | performance-debugging, optimization | P+ explicit reporting discipline |
| P/no-comments | Read-only comment audit, encode constraints | code-reviewer, comment-lint | P+ semantic pass; C+ edit-time check |
| P/typescript-best-practices | Path-scoped constructive type patterns | backend, architecture, static-analysis | P+ compact syntax owner |
| P/figure-it-out | Falsifiable units and hypothesis loop | pabcd + loop | P+ rigor labels; C+ durable phases |
| P/show-me-your-work | TSV decisions and cross-family trail review | ledger.jsonl + attest pointers | P+ human trail review; C+ edge binding |
| P/create-verification-skill | Persistent per-project driver/feature map | qa | P+ reusable harness artifact |
| P/maintain-verification-skill | Source drift audit plus live pass | qa per-run method | P+ maintenance lifecycle |
| P/unslop | Numbered English prose-tell rules | kwrite, reader-documents | P+ English; C+ Korean |
| P/technical-writing | Diátaxis/style/instruction hierarchy | reader-documents, scaffolding | complementary; use existing owner |
| P/bro | Restate plainly, no jargon | reader-facing guidance | P+ tiny explicit invocation |

Principle URLs below use the same `P/` expansion. R07 §1.2/§3 and R09 §1.2 establish the leaf inventory and broad mappings; the per-leaf counterpart is a synthesis by meaning, not an individually tested equivalence. The newest explain-the-number leaf exists in Cursor/MD only (R08 §1.1).

| pstack skill (URL) | What it does | codexclaw counterpart | Gap direction |
|---|---|---|---|
| P/principle-laziness-protocol | Reduce avoidable work | necessity/economy guidance | = intent |
| P/principle-foundational-thinking | Ground assumptions | architect consultation | = intent |
| P/principle-redesign-from-first-principles | Reconsider broken shape | architecture, friction rules | = intent |
| P/principle-attack-the-premise | Challenge wrong framing | interview, necessity gate | = intent |
| P/principle-subtract-before-you-add | Remove before extending | necessity gate, LS placement | = intent |
| P/principle-minimize-reader-load | Reduce reader burden | reader-documents | = intent |
| P/principle-outcome-oriented-execution | Check outcomes | FAMILY-PROOF-01 | C+ proof process |
| P/principle-experience-first | Judge real experience | qa, render grounding | C+ check integration |
| P/principle-exhaust-the-design-space | Consider alternatives | P architect | P+ explicit alternatives |
| P/principle-build-the-lever | Build reusable capability | verifiable units | P+ explicit framing |
| P/principle-model-the-domain | Represent domain semantics | architecture, backend | = intent |
| P/principle-boundary-discipline | Respect module boundaries | architecture exports | = intent |
| P/principle-type-system-discipline | Encode invariants in types | static-analysis, backend | = intent |
| P/principle-make-operations-idempotent | Safe repeated operations | scaffold contract | = intent |
| P/principle-migrate-callers-then-delete-legacy-apis | Move consumers before removal | dev public-contract safety | = intent |
| P/principle-separate-before-serializing-shared-state | Separate writable ownership | dispatch isolation/one owner | C+ scoped dispatch |
| P/principle-prove-it-works | Require observed proof | FAMILY-PROOF-01, C gate | C+ attested checks |
| P/principle-fix-root-causes | Repair causes | debugging | = intent |
| P/principle-sequence-verifiable-units | Verify dependency-ordered units | implementation-units | C+ persistent sequence |
| P/principle-test-behavior-not-implementation | Behavioral tests | dev-testing | = intent |
| P/principle-explain-the-number | Validate measurements; newer | performance-debugging | P+ reporting checklist |
| P/principle-guard-the-context-window | Bound loaded context | LS, delegation packets | = intent |
| P/principle-never-block-on-the-human | Autonomous progress | explicit HITL/HOTL boundaries | different; preserve user authority |
| P/principle-encode-lessons-in-structure | Prefer checks over more prose | enforcement tiers, LS L0/L5 | = intent |

Port-added skills are grounded in R08 §1.1/§1.2/§1.4. MD/CH/EL include these; AJ omits them. They are not additions in foxytanuki's port.

| pstack skill (URL) | What it does | codexclaw counterpart | Gap direction |
|---|---|---|---|
| M/babysit | Drive PR checks/review toward readiness | stacked-prs, devops | P+ watcher tooling |
| M/deslop | Semantic code cleanup | comment-lint, frontend anti-slop | complementary |
| M/fix-ci | Diagnose/fix failing checks | devops, CI evidence rules | = |
| M/fix-merge-conflicts | Resolve and verify conflicts | devops branch lifecycle | = |
| M/get-pr-comments | Fetch/summarize review comments | no dedicated skill | P+ convenience |
| M/make-pr-easy-to-review | Clean history/body for review | code-reviewer readiness | = |
| M/thermo-nuclear-code-quality-review | Strict maintainability audit | code-reviewer, architecture | = intent |
| M/what-did-i-get-done | Summarize authored commits | no dedicated skill | P+ convenience |

## Outbound candidates must repair the port, not replace its philosophy

foxytanuki welcomes PRs, owns adaptations in overlay/tools, requires English and Conventional Commits, keeps `upstream/` pinned/unmodified and `dist/` untracked, and requires behavioral tests for model-resolution/runtime changes. Its stdlib Python/patch toolchain already supports the candidates below. Both MIT notices must survive build. There are zero PRs in the report snapshot, so rejection risks are judgments with no acceptance history (R09 §1.1, §2, §5; [CONTRIBUTING](https://github.com/foxytanuki/pstack-opencodex/blob/main/CONTRIBUTING.md)).

All existing paths below are explicitly recorded in R09 §1.1/§4a/§5. A rename destination is intentionally new. Estimates count changed lines, excluding unchanged context. The maintainer must refresh destination HEAD/duplicate PR state before filing. No current remote state was checked by this leaf.

| Candidate | Exact files; size | Own-repo fit / rejection risk | PABCD fit and proof boundary |
|---|---|---|---|
| **A. Lock case collision — send now** | `UPSTREAM` → **new** `UPSTREAM.lock`; `tools/pstack_opencodex.py`; `README.md`; `CONTRIBUTING.md`; `.github/workflows/ci.yml`. About 20–45 lines plus rename. | Direct Quick start repair, preserves lock content/vendor bytes; Linux + macOS CI uses existing commands. Low–medium risk: no review history; macOS CI cost. MIT notices unchanged. | Audit all lock consumers before build; fresh failing clone/build on macOS then passing clone/build, tests and notice checks. One lock owner. Record plan/audit/output artifacts; CI is observable coverage, not an attested FSM. R09 §4a-1/§6. |
| **B. Catalog diagnostics — send now** | `tools/pstack_opencodex.py`; `tests/test_runtime.py`. About 35–70 lines. | Existing check-runtime bad-input contract and CLI tests are the precedent; no dependencies or model-selection redesign. Low–medium risk: maintainer may prefer a different exit/message contract. MIT notices unchanged. | Plan and independent audit name malformed/missing input triggers; tests run actual check-models CLI, compare exit/output, then prove valid catalog behavior unchanged. One error-boundary owner; record fresh output in worklog/PR. R09 §4a-2 and tests L176–185. |
| **C. Symlink containment — later, separate safety lane** | `tools/pstack_opencodex.py`; `tests/test_runtime.py` with a separate install-ownership test class. About 60–110 lines. | Repairs README's “only links into dist” contract with stdlib paths; existing test file is real, but install tests may deserve a new file in a separately audited plan. Medium risk: target/relative-link semantics need agreement. | Deletion boundary merits C4 care: outside/sibling/relative/dangling links, retained real dirs, owned removals. Audit before any implementation; fresh positive/negative receipts. Source-inspected defect, not reproduced in R09 §4a-5; defer behind observed failures. |
| **D. Remaining HARNESS mappings — later** | `overlay/HARNESS.md`. About 8–16 lines. | Fits single mapping owner and prior `02b9c94` mapping commit. Medium risk: live child tool schemas/MCP inheritance are unverified. | Audit every claimed mapping against exposed host schema; preserve “when exposed” and no fabricated tools. Docs are guidance, not gates. R09 §3.1/§4a-4/§7; R08 §6. |

Do not submit broad build-coverage or reproducibility features now: the former needs a new test-file design; the latter expands metadata while paths remain absolute. Upstream sync is maintainer-owned and changes skill/model policy. Plugin packaging requires redesigning absolute pointers. Leaf recursion denial contradicts pstack's nested-worker design. An FSM, codexclaw hooks, Interview mandate, or mandatory global plan audit would import machinery or conflict with upstream's no-default-planning stance. Existing proof principles, shipping review, model diversity, and check-runtime honesty are not new features to contribute (R09 §0/§2/§3/§4a-3,6–9; R07 §2/§3/§4a). Exact workflow differences at the older foxytanuki pin must not be assumed identical to current Cursor.

**Cursor upstream: no send-now PR candidate.** README welcomes PRs and no CONTRIBUTING was found, but R07 §0-4/§4a/§5 found no merged outside pstack change; even README fix [#424](https://github.com/cursor/plugins/pull/424) closed unmerged. That is poor evidence of practical acceptance, not proof of a formal ban. Closing reasons were unavailable (R07 Limits). Do not list upstream PR candidates as accepted. The already-proposed worktree fix also risks duplicating [#492](https://github.com/cursor/plugins/pull/492) and the concern in [#523](https://github.com/cursor/plugins/issues/523). Issue-first is an inferred route, not authorized publication by this leaf. MD accepts outside port fixes, EL routes contributions through issues, and CH is stale; those are background, not outbound scope here (R08 §4a/§5).

## Local ideas: three docs changes now; runtime work later

Each classification below is a recommendation, not an assertion that current uncommitted parent work lacks it. Before adoption, check the named owner for existing equivalent wording. LS requires one prose owner, small always-on text, incident history in devlog, and wording locks only for actual wire/marker/pointer contracts.

| Idea and source | Decision | Local shape / reason |
|---|---|---|
| Compact routing; MD 983-byte startup and foxytanuki single harness (R08 §1.4/§4b-10; R09 §1.1/§3.2-6) | **ADOPT-NOW** | Apply LS to existing routers: applicability + installed owner pointer; branch detail in one L4 owner. Do not copy the roughly 11 KB HARNESS into every skill or transplant an opt-out setting. |
| Reviewer packets omit parent's verdict (MD #232, R08 §4b-2) | **ADOPT-NOW** | `pabcd/references/delegation.md`: give original brief, constraints, rubric and artifact anchors; withhold parent's conclusion on independent first review. Keep same-reviewer repair continuity. A-phase references point here. PI §7.1 isolation supports it. |
| Transport error vs timeout vs model rejection (R09 §3.1/§4b-2) | **ADOPT-NOW** | Same delegation owner: explicit `unreadable_encrypted_agent_task` means transport; stop equivalent retries. Timeout alone establishes neither 429 nor encryption failure. Keep literal error keys; no new fallback runtime or setting mutation. |
| Worker SHA/method receipts; bounded respawn (R07 §4b-2) | **LATER** | Existing evidence observer may overlap; verify schema and failure/retry ownership before adding a rule. |
| Patch-id verdict reuse (R07 §4b-1) | **LATER** | Review judgment can survive a matching patch, but exact-head CI/live evidence cannot. Requires base/context semantics, beyond this text-reduction pass. |
| Blast-radius ladder and benchmark checklist (R07 §4b-3,4; R08 §4b-4) | **LATER** | Useful focused L4 checklists; avoid new universal evidence ladders or hard five-run defaults during reduction. |
| Neutral review panels, two designs, arena, trail review (R07 §4b-5–7,13; R08 §4b-5) | **LATER** | Cost/dispatch/independence changes require scoped acceptance tests and one synthesis owner. |
| Plan linter, rule-enforcer table, blinded eval (R07 §4b-8–10) | **LATER** | Compare LS's existing architecture gate first; semantic model compliance is not proved by string checks. |
| Persistent verify skill, why, reflect, help, automate-me (R07 §4b-12,15; R08 §1.2/§4b-8,9; R09 §4b-11) | **LATER** | Useful new capabilities, not prompt diet; transcripts/rulings need provenance and privacy boundaries. |
| Live-catalog tri-state preflight, effort clamp, exact-head live gate, formal models (R09 §4b-1,4; R08 §4b-7,11) | **LATER** | Runtime/CI behavior changes; report has no live delegation proof. Preserve configuration/live distinction. |
| Pinned provenance, declared fork ledger, patch-drift check (R08 §4b-6; R09 §4b-5,6) | **LATER** | Valuable provenance mechanism; schema/build changes need their own audited lane. |
| AJ fixed PR budget, hook opt-out copied verbatim (R08 §1.4/§4b-1,10) | **REJECT** as imports | Arbitrary thresholds/user config duplicate local ownership. A repo-specific budget can be evaluated later. |
| 24 new principle leaves, always-apply English unslop, comment-hater persona (R07 §1.2/§4b-14; R09 §4b-8,9) | **REJECT** as packages | Catalog growth/duplicate obligations violate LS. Retain useful prose judgment in existing reader/code-review owners. |
| Same-family substitute sold as independent; unsafe cleanup buckets; universal autonomous shipping (R09 §2/§4b-3,12; R07 §1.6/§3) | **REJECT** | Preserve honest independence, user authority and managed-tree safety; no relaxed gates. |

## Concrete handoff: two independent PRs, three local adoptions

**PR A — `fix: avoid upstream lock case collision`.** Rename tracked `UPSTREAM` to `UPSTREAM.lock`, change `LOCK_FILE` in `tools/pstack_opencodex.py`, change the lock name in README layout and CONTRIBUTING's pin instruction, add `macos-latest` beside Ubuntu in CI's OS matrix. Keep Python versions and test/build/license/vendor checks. Audit every lock-name reference without rewriting the `upstream/` path. Verify a fresh macOS checkout, not just an already-renamed working copy; retain failing-before/passing-after output. Windows stays explicitly unverified. R09 §4a-1/§6/§7 supplies the reproduction and existing paths.

**PR B — `fix: report invalid model catalogs without traceback`.** In `tools/pstack_opencodex.py`, at check-models' catalog-load boundary, adapt the existing check-runtime bad-input approach for missing files, malformed JSON and missing `slug`; keep diagnostics concise/non-secret and a documented nonzero exit. Do not add a new JSON flag or change valid model matching/clamping. In `tests/test_runtime.py`, add CLI cases that trigger each input error and one valid resolution case; assert useful error, no traceback and unchanged input files. Audit exception scope before build. R09 §4a-2/§1.1 supports the analogous contract; exact exception/output choices remain to be checked in source.

Parent preparation order for each PR: refresh remote/source and duplicate state → diff-level plan with exact checks/activation scenarios → independent audit → implementation → fresh tests/build/notice/vendor checks → concrete PR with observed versus expected behavior and verification limits. PI permits worklog attestations where no FSM exists (§2 runtime adapter/§2.1); do not install codexclaw to manufacture a destination gate. Its form-only gate cannot establish truth. The parent owns all phase transitions, submission and verdicts. Outbound size estimates are review scope, not dependency-phase ordering (PI §3 P).

Local maximum: (1) compact owner routing under LS, (2) neutral first-review packets at delegation's owner, (3) literal failure classification there. No history in L1–L3. Copied substantial MIT text needs notices/provenance; prefer original concise wording for these ideas (R07 §5; R08 §5; R09 §5).

Limits: all reports were read fully; PI headings, §1–§4 and §7.1 and LS were read. This leaf ran no foreign build or live provider call. R07 partially read some source bodies/scripts and lacked PR closing comments; R08 ran no tests/live installs and tool mappings were document-derived; R09 reproduced macOS lock/build and missing-catalog failure, but Windows and live delegation were unverified. Counts/merge norms are anonymous snapshot evidence. A clean test suite, configuration OK, patch identity, or a valid attestation is not live behavior proof. Codexclaw absence claims may miss alternate wording or newer changes (R07 Limits; R08 §6; R09 §7; PI §2.1). Fresh-reader review is left to the parent because this leaf is forbidden to spawn.
