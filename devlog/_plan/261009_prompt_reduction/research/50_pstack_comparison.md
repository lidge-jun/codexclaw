# Prepare two port fixes; keep PABCD machinery local

Recommend two foxytanuki PRs: lock collision and catalog errors (R09). Adopt compact routing, neutral review packets and failure labels. No PR submitted or remote verification here.

Sources:

- **R07** [Cursor report](/Users/jun/.aside/u/0/artifacts/codexclaw-prompt-research/07-pstack-cursor.md): `ccb5507`.
- **R08** [Claude ports](/Users/jun/.aside/u/0/artifacts/codexclaw-prompt-research/08-pstack-claude-ports.md).
- **R09** [opencodex report](/Users/jun/.aside/u/0/artifacts/codexclaw-prompt-research/09-pstack-opencodex.md): `2dd2800`, vendor `12d587d`. Reports 2026-10-09; codexclaw `96e8d5c`.
- **PI** [README](/Users/jun/Developer/new/700_projects/pabcd_initiative/README.md), [dev-pabcd](/Users/jun/Developer/new/700_projects/pabcd_initiative/skills/dev-pabcd/SKILL.md): headings, §1–§4, §7.1 read.
- **LS** [layering standard](../001_layering_standard.md): read fully.

## 1. Skill mapping: breadth versus attested process

URL notation follows the reports: `P/name` expands to `https://github.com/cursor/plugins/blob/main/pstack/skills/name/SKILL.md`; `N/name` expands to the same URL with `principle-name` as the folder; `M/name` expands to `https://github.com/michael-denyer/pstack-claude/blob/main/plugins/pstack/skills/name/SKILL.md`. Counterparts omit `cxc-`; P+/C+ = stronger side, = overlap. Judgments.

Workflow sources: R07 §1.1/§3, R08 §1.2, R09 §1.2/§3.2. “Newer” = absent foxytanuki pin (R09 §0/§4a-7).

| pstack skill (URL) | What it does | codexclaw counterpart | Gap direction |
|---|---|---|---|
| P/poteto-mode | Route/copy playbooks | dev + pabcd | P+ breadth; C+ FSM |
| P/poteto-help | Typed help; newer | docs-site, skill-catalog | P+ onboarding |
| P/how | Explore then explain | repo-map, explorer | P+ explanation |
| P/why | Rationale archaeology | recall, logic-analysis | P+ source sweep |
| P/recall | Current-state brief | recall + hooks | C+ search; P+ status format |
| P/blast-radius | Prove safety beyond diff | field-chain, activation | P+ ladder; C+ chain |
| P/architect | Compare/screen designs | P architect, decision IDs | P+ alternatives; C+ trace |
| P/arena | Rubric bakeoff/graft | none dedicated | P+ workflow |
| P/swarm | Parallel slices/races | delegation, lane-dispatch | P+ receipts; C+ transport |
| P/interrogate | Same rubric, multiple models | A reviewer, code-reviewer | P+ panel; C+ plan audit |
| P/correct | Mine/enforce repeat lessons; newer | enforcement tiers/hooks | P+ mining; C+ bypass labels |
| P/automate-me | Personal transcript-derived mode | none | P+ capability |
| P/make-bot-ui | Cursor automation UI | remote differs | excluded by foxytanuki |
| P/setup-pstack | Budget/model sheet | subagent-config, TOMLs | overlap; partly uninspected |
| P/reflect | Three-lens retrospective | devlog learnings | P+ procedure |
| P/teach | Weave how/why explanation | reader-documents, visualizer | P+ teaching; C+ reader check |
| P/tdd | Cheap red/green proof | dev-testing | = |
| P/benchmark-checklist | Vet measurements; newer | performance-debugging | P+ rigor |
| P/no-comments | Audit/encode constraints | code-reviewer, comment-lint | semantic vs mechanical |
| P/typescript-best-practices | Compact type patterns | backend, static-analysis | P+ owner |
| P/figure-it-out | Falsifiable hypothesis units | pabcd + loop | P+ rigor labels; C+ persistence |
| P/show-me-your-work | TSV decisions/trail review | ledger + attests | P+ human review; C+ edges |
| P/create-verification-skill | Generate project driver/map | qa | P+ artifact |
| P/maintain-verification-skill | Drift audit/live pass | qa per run | P+ lifecycle |
| P/unslop | Numbered prose-tell rules | kwrite, reader-documents | P+ English/C+ Korean |
| P/technical-writing | Layered writing standards | reader-documents, scaffolding | complementary |
| P/bro | Restate plainly | reader guidance | P+ tiny invocation |

Principles: R07 §1.2/§3, R09 §1.2; newest leaf R08 §1.1. Per-leaf gloss/mapping is name-based synthesis, not verified body equivalence.

| pstack skill (URL) | What it does | codexclaw counterpart | Gap direction |
|---|---|---|---|
| N/laziness-protocol | Avoid wasted work | necessity/economy | overlap |
| N/foundational-thinking | Ground assumptions | architect | overlap |
| N/redesign-from-first-principles | Reconsider shape | architecture/friction | overlap |
| N/attack-the-premise | Challenge framing | interview | overlap |
| N/subtract-before-you-add | Remove before adding | necessity, LS | overlap |
| N/minimize-reader-load | Reduce reader burden | reader-documents | overlap |
| N/outcome-oriented-execution | Check outcomes | fresh proof | C+ procedure |
| N/experience-first | Judge real experience | qa/render grounding | C+ checks |
| N/exhaust-the-design-space | Consider alternatives | P architect | P+ alternatives |
| N/build-the-lever | Build reusable capability | verifiable units | P+ framing |
| N/model-the-domain | Model semantics | architecture/backend | overlap |
| N/boundary-discipline | Respect boundaries | architecture exports | overlap |
| N/type-system-discipline | Encode invariants | static-analysis | overlap |
| N/make-operations-idempotent | Repeat safely | scaffold contract | overlap |
| N/migrate-callers-then-delete-legacy-apis | Move consumers first | public-contract safety | overlap |
| N/separate-before-serializing-shared-state | Separate ownership | dispatch/one owner | C+ dispatch |
| N/prove-it-works | Observed proof | FAMILY-PROOF-01 | C+ gates |
| N/fix-root-causes | Fix causes | debugging | overlap |
| N/sequence-verifiable-units | Verify ordered units | implementation-units | C+ sequence |
| N/test-behavior-not-implementation | Behavioral tests | dev-testing | overlap |
| N/explain-the-number | Vet measurements; newer | performance-debugging | P+ checklist |
| N/guard-the-context-window | Bound context | LS, packets | overlap |
| N/never-block-on-the-human | Autonomous progress | HITL/HOTL boundaries | philosophy differs |
| N/encode-lessons-in-structure | Checks over prose | tiers, LS L0/L5 | overlap |

Port additions: R08 §1.1/§1.2/§1.4. In MD/CH/EL; absent AJ/foxytanuki.

| pstack skill (URL) | What it does | codexclaw counterpart | Gap direction |
|---|---|---|---|
| M/babysit | Drive PR readiness | stacked-prs, devops | P+ watchers |
| M/deslop | Semantic code cleanup | comment-lint, frontend | complementary |
| M/fix-ci | Fix failing checks | devops/CI rules | = |
| M/fix-merge-conflicts | Resolve/verify conflicts | branch lifecycle | = |
| M/get-pr-comments | Fetch review comments | none dedicated | P+ convenience |
| M/make-pr-easy-to-review | Improve history/body | review readiness | = |
| M/thermo-nuclear-code-quality-review | Maintainability audit | reviewer/architecture | overlap |
| M/what-did-i-get-done | Summarize commits | none dedicated | P+ convenience |

## 2. Outbound candidates: repair the port

foxytanuki welcomes PRs: English/Conventional Commits, vendor unchanged, dist untracked, overlay/tools own adaptations, behavioral tests for model/runtime changes. Python stdlib/Git/patch suffice; retain both MIT notices. No PR history calibrates rejection risk (R09 §1.1/§2/§5; [CONTRIBUTING](https://github.com/foxytanuki/pstack-opencodex/blob/main/CONTRIBUTING.md)). Existing paths below occur in R09 §1.1/§4a/§5; rename destination is new. Lines are estimates.

| Candidate | Exact files; lines | Repo fit / rejection risk | PABCD fit / proof |
|---|---|---|---|
| **A: collision; send now** | `UPSTREAM` → new `UPSTREAM.lock`; `tools/pstack_opencodex.py`; `README.md`; `CONTRIBUTING.md`; `.github/workflows/ci.yml`. 20–45 + rename. | Reproduced Quick start failure; vendor/policy unchanged. Low–medium: no history, macOS CI cost. | One lock owner; audit consumers before build; fresh macOS failing/passing clone/build and license checks. R09 §4a-1/§6. |
| **B: catalog errors; send now** | `tools/pstack_opencodex.py`; `tests/test_runtime.py`. 35–70. | Existing runtime invalid-input/CLI tests; no dependency. Low–medium: error/exit contract. | One load boundary; audit missing/malformed triggers before build; actual CLI negative/valid tests. R09 §4a-2. |
| **C: symlink containment; later** | `tools/pstack_opencodex.py`; `tests/test_runtime.py` separate install class. 60–110. | Matches only-dist ownership; medium: relative targets/test placement. | Separate C4 deletion lane: owned/outside/sibling/relative/dangling links, real dirs; audit plus positive/negative tests. Inspected, not reproduced (R09 §4a-5). |
| **D: mappings; later** | `overlay/HARNESS.md`. 8–16. | Single owner/prior mapping commit; medium: unverified live tools/MCP inheritance. | Audit host schema first; qualify availability; prose is guidance. R09 §3.1/§4a-4/§7; R08 §6. |

For each: parent persists plan, independent pre-build verdict and fresh output; PI permits worklog attestations without a destination FSM. The form-only gate cannot prove truth; do not import codexclaw to manufacture one (PI §2.1/§3.2/§3 A/C/§4). All candidates retain MIT notices; only A/B have observed failures worth sending now.

Drop FSM/hooks/Interview/global audit imports, duplicated proof/diversity rules and recursion denial. Defer build coverage, reproducibility, sync and packaging: test/metadata/policy/pointer redesign exceeds scope (R09 §0/§3/§4a-3,6–9; R07 §2/§3/§4a).

**Cursor upstream: no send-now PR candidates.** README invites PRs; no CONTRIBUTING found, but no merged external pstack change was found and [#424](https://github.com/cursor/plugins/pull/424) closed unmerged. Practical acceptance is unestablished, not formally banned; closing reasons unavailable. Avoid competing worktree fixes [#492](https://github.com/cursor/plugins/pull/492)/[#523](https://github.com/cursor/plugins/issues/523). Issue-first is inferred. MD accepts PRs, EL requests issues, CH is stale (R07 §0-4/§4a/§5/Limits; R08 §4a/§5).

## 3. Local ideas: three docs adoptions

Check current owners first. LS: one owner, small cues, history in devlog; verbatim locks only for keys/markers/flags/pointers/boundaries.

| Idea / source | Decision | Reason / destination |
|---|---|---|
| Compact routing, MD 983-byte hook (R08 §1.4/§4b-10; R09 §3.2-6) | **ADOPT-NOW** | Existing routers: cue + installed owner pointer; detail L4. Do not replicate 11 KB HARNESS. |
| Neutral reviewer packets, MD #232 (R08 §4b-2) | **ADOPT-NOW** | delegation owner: original brief/constraints/rubric/anchors, no parent's first-review conclusion; keep repair continuity. PI §7.1 isolation. |
| Failure classes (R09 §3.1/§4b-2) | **ADOPT-NOW** | Same owner: `unreadable_encrypted_agent_task` = transport; stop equivalent retries. Timeout proves neither 429 nor encryption. No setting mutation. |
| Receipts, patch-id reuse (R07 §4b-1,2) | **LATER** | Check observer overlap; patch identity cannot reuse old CI/live evidence. |
| Blast-radius/perf checklists (R07 §4b-3,4) | **LATER** | Focused L4 procedures, not new universal thresholds. |
| Verify generator, why/reflect/help/personal mode (R07 §4b-12,15; R08 §1.2) | **LATER** | New capabilities/privacy boundaries. |
| Preflight/clamp/live gate/formal models (R09 §4b-1,4; R08 §4b-7,11) | **LATER** | Runtime/CI changes; no live delegation proof. |
| Imported PR thresholds/opt-out (R08 §4b-1,10) | **REJECT** | Foreign config/thresholds duplicate owners. |
| New principle leaves/always-apply unslop/comment persona (R07 §1.2/§4b-14; R09 §4b-8,9) | **REJECT** | Catalog growth; use reader/reviewer owners. |
| False independent verdict/unsafe buckets/universal autonomy (R09 §2/§4b-3,12; R07 §1.6/§3) | **REJECT** | Preserve independence/user authority/tree safety. |

## 4. Two diff outlines; three local adoptions

**PR A: `fix: avoid upstream lock case collision`.** Rename `UPSTREAM` to `UPSTREAM.lock` unchanged; modify `LOCK_FILE` in `tools/pstack_opencodex.py`, README layout, CONTRIBUTING pin instruction. CI: add `macos-latest` beside Ubuntu; retain test/build/license/vendor checks. Audit all lock consumers; leave `upstream/` unchanged. Fresh macOS checkout must build. R09 §6 recorded `D UPSTREAM`, `IsADirectoryError`, then 46 skills after rename. Windows is inferred/unverified (R09 §4a-1/§7).

**PR B: `fix: report invalid model catalogs without traceback`.** In `tools/pstack_opencodex.py` check-models' catalog-load boundary, adapt check-runtime invalid-input handling: missing file, malformed JSON, missing `slug`; non-secret diagnostic/nonzero exit. Preserve valid resolution/clamping; no new JSON flag. Add CLI negative/valid cases in `tests/test_runtime.py`, asserting useful error/no traceback/input immutability. Audit exception/message contract first. Missing catalog was reproduced; missing slug inspected; malformed JSON is a proposed acceptance case (R09 §4a-2/§6).

Parent: refresh HEAD/duplicate PRs → diff-level plan → independent audit → build → fresh tests/build/notice/vendor/diff checks → PR. Commands: `python3 -m unittest discover -s tests -v`, `python3 tools/pstack_opencodex.py build`, `git diff --check` (R09 §5). Verify target coverage (PI §3.2); parent owns transitions/verdicts/submission. Line estimates are review scope, not phase ordering (PI §3 P).

Local maximum: LS routing; neutral packets/failure taxonomy at `pabcd/references/delegation.md`, audit pointers elsewhere. MIT copies need notices/provenance (R07 §5; R08 §5; R09 §5).

Limits: no foreign tests/live calls by this leaf. R07 lacked closing reasons/partially read bodies; R08 ran no tests/installs and tool claims were document-derived; R09 had no live delegation/Windows proof. Anonymous counts and codexclaw absence claims are snapshots, may miss newer/equivalent behavior. Configuration OK/patch identity/green tests/attest shape do not prove live behavior (R07 Limits; R08 §6; R09 §7; PI §2.1). Parent owns fresh-reader check; spawning forbidden here.
