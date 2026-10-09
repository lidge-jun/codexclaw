# r4 router moves

Class: C3 docs-only refactor. Shared working tree; no Git writes, builds, spawning or phase/goal commands.

## Sizes

| Skill | Whole file before B | Whole file after B | Body after B |
| --- | ---: | ---: | ---: |
| qa | 11774 | 3214 | 2850 |
| search | 14317 | 3617 | 3192 |
| recall | 16379 | 3603 | 3202 |
| interview | 17449 | 4102 | 3841 |
| lunasearch | 8843 | 1644 | 1433 |
| skill-hub | 324 | 157 | 34 |
| orchestrate | 284 | 167 | 38 |
| goalplan | 545 | 160 | 36 |
| dev-diagram-viewer | 593 | 210 | 56 |

## Removed headings

| Source router | Removed heading | Destination |
| --- | --- | --- |
| `plugins/codexclaw/skills/search/SKILL.md` | Tier 1 — Hosted web search (discovery) | `plugins/codexclaw/skills/search/references/hosted-discovery.md#tier-1--hosted-web-search-discovery` |
| `plugins/codexclaw/skills/qa/SKILL.md` | 0. Scope split (single ownership) | `plugins/codexclaw/skills/qa/references/scope-and-binding.md#0-scope-split-single-ownership` |
| `plugins/codexclaw/skills/qa/SKILL.md` | 1. Trust nothing | moved: every sentence is in `plugins/codexclaw/skills/qa/references/evidence-contract.md` (QA freshness fields, no inferred or partial verdicts, cannot-run is FAIL, structural-only NA, worker receipts), which the router requires before any verdict; dev §3 owns only the generic proof gate (corrected after research/15 finding 2) |
| `plugins/codexclaw/skills/qa/SKILL.md` | 3. Evidence contract | `plugins/codexclaw/skills/qa/references/evidence-contract.md#3-evidence-contract` |
| `plugins/codexclaw/skills/qa/SKILL.md` | 4. Adversarial classes | `plugins/codexclaw/skills/qa/references/adversarial-oracles.md#4-adversarial-classes` |
| `plugins/codexclaw/skills/qa/SKILL.md` | 5. Oracle passes (depth scales by work class) | `plugins/codexclaw/skills/qa/references/adversarial-oracles.md#5-oracle-passes-depth-scales-by-work-class` |
| `plugins/codexclaw/skills/qa/SKILL.md` | 6. Teardown receipts | `plugins/codexclaw/skills/qa/references/teardown-receipts.md#6-teardown-receipts` |
| `plugins/codexclaw/skills/qa/SKILL.md` | 7. Binding to PABCD C | `plugins/codexclaw/skills/qa/references/scope-and-binding.md#7-binding-to-pabcd-c` |
| `plugins/codexclaw/skills/qa/SKILL.md` | v2 candidates (deliberately not shipped) | history → `devlog/_plan/261009_prompt_reduction/evidence/r4-moved-history.md` |
| `plugins/codexclaw/skills/search/SKILL.md` | Divergence Candidate Grounding | `plugins/codexclaw/skills/search/references/divergence-grounding.md#divergence-candidate-grounding` |
| `plugins/codexclaw/skills/search/SKILL.md` | Tier 2 — Source-open proof (SEARCH-BROWSE-01) | `plugins/codexclaw/skills/search/references/source-open-proof.md#tier-2--source-open-proof-search-browse-01` |
| `plugins/codexclaw/skills/search/SKILL.md` | Tier 3 — Deep research (opt-in) | `plugins/codexclaw/skills/search/references/deep-research-entry.md#tier-3--deep-research-opt-in` |
| `plugins/codexclaw/skills/search/SKILL.md` | Boundaries | `plugins/codexclaw/skills/search/references/deep-research-entry.md#boundaries` |
| `plugins/codexclaw/skills/search/SKILL.md` | Subagent Skill Attachment (SEARCH-ATTACH-01) | `plugins/codexclaw/skills/search/references/subagent-attachment.md#subagent-skill-attachment-search-attach-01` |
| `plugins/codexclaw/skills/search/SKILL.md` | lunasearch (dependent tool) | `plugins/codexclaw/skills/search/references/discovery-boundaries.md#lunasearch-dependent-tool` |
| `plugins/codexclaw/skills/search/SKILL.md` | Removed cli-jaw tiers (non-goals — do not re-add) | `plugins/codexclaw/skills/search/references/discovery-boundaries.md#removed-cli-jaw-tiers-non-goals--do-not-re-add` |
| `plugins/codexclaw/skills/search/SKILL.md` | Korean Intent Guard (8 rules) | `plugins/codexclaw/skills/search/references/intent-guard.md#korean-intent-guard-8-rules` |
| `plugins/codexclaw/skills/search/SKILL.md` | Notes | `plugins/codexclaw/skills/search/references/tool-notes.md#notes` |
| `plugins/codexclaw/skills/recall/SKILL.md` | Commands | `plugins/codexclaw/skills/recall/references/commands.md#commands` |
| `plugins/codexclaw/skills/recall/SKILL.md` | Two engines (do not mix their rules) | `plugins/codexclaw/skills/recall/references/commands.md#two-engines-do-not-mix-their-rules` |
| `plugins/codexclaw/skills/recall/SKILL.md` | Subagent / managed worktree | `plugins/codexclaw/skills/recall/references/scope-and-results.md#subagent--managed-worktree` |
| `plugins/codexclaw/skills/recall/SKILL.md` | Native `memories.*` vs `cxc` | `plugins/codexclaw/skills/recall/references/scope-and-results.md#native-memories-vs-cxc` |
| `plugins/codexclaw/skills/recall/SKILL.md` | Optional extra lanes (only if the tool is installed) | `plugins/codexclaw/skills/recall/references/optional-memory-lanes.md#optional-extra-lanes-only-if-the-tool-is-installed` |
| `plugins/codexclaw/skills/recall/SKILL.md` | Scoping memory search to a project | `plugins/codexclaw/skills/recall/references/scope-and-results.md#scoping-memory-search-to-a-project` |
| `plugins/codexclaw/skills/recall/SKILL.md` | When memory has nothing | `plugins/codexclaw/skills/recall/references/scope-and-results.md#when-memory-has-nothing` |
| `plugins/codexclaw/skills/recall/SKILL.md` | Reading results | `plugins/codexclaw/skills/recall/references/scope-and-results.md#reading-results` |
| `plugins/codexclaw/skills/recall/SKILL.md` | Scope: single Codex home (deliberate non-goal) | `plugins/codexclaw/skills/recall/references/scope-and-results.md#scope-single-codex-home-deliberate-non-goal` |
| `plugins/codexclaw/skills/recall/SKILL.md` | Maintenance | `plugins/codexclaw/skills/recall/references/index-and-injection.md#maintenance` |
| `plugins/codexclaw/skills/recall/SKILL.md` | Automatic session-start injection | `plugins/codexclaw/skills/recall/references/index-and-injection.md#automatic-session-start-injection` |
| `plugins/codexclaw/skills/interview/SKILL.md` | Classify the loop before Plan | `plugins/codexclaw/skills/interview/references/readiness-closeout.md#classify-the-loop-before-plan` |
| `plugins/codexclaw/skills/interview/SKILL.md` | Assumption provenance (INTERVIEW-ASSUME-01) | `plugins/codexclaw/skills/interview/references/assumption-provenance.md#assumption-provenance-interview-assume-01` |
| `plugins/codexclaw/skills/interview/SKILL.md` | Grounding questions in state (INTERVIEW-GROUND-01) | `plugins/codexclaw/skills/interview/references/ledger-grounding.md#grounding-questions-in-state-interview-ground-01` |
| `plugins/codexclaw/skills/interview/SKILL.md` | Sub-modes (INTERVIEW-CATALOG-01) | `plugins/codexclaw/skills/interview/references/catalog-configurator.md#sub-modes-interview-catalog-01` |
| `plugins/codexclaw/skills/interview/SKILL.md` | Catalog Discovery — design/UX LEADS (CATALOG-DESIGN-FIRST-01) | `plugins/codexclaw/skills/interview/references/catalog-configurator.md#catalog-discovery--designux-leads-catalog-design-first-01` |
| `plugins/codexclaw/skills/interview/SKILL.md` | Option-set quality (INTERVIEW-OPTION-01) | `plugins/codexclaw/skills/interview/references/catalog-configurator.md#option-set-quality-interview-option-01` |
| `plugins/codexclaw/skills/interview/SKILL.md` | Rescan + readiness (INTERVIEW-SCAN-01) | `plugins/codexclaw/skills/interview/references/readiness-closeout.md#rescan--readiness-interview-scan-01` |
| `plugins/codexclaw/skills/interview/SKILL.md` | Closeout fork (INTERVIEW-FORK-01) | `plugins/codexclaw/skills/interview/references/readiness-closeout.md#closeout-fork-interview-fork-01` |
| `plugins/codexclaw/skills/interview/SKILL.md` | Runtime Status (shipped) | `plugins/codexclaw/skills/interview/references/runtime-status.md#runtime-status-shipped` |
| `plugins/codexclaw/skills/lunasearch/SKILL.md` | Hardcoded Spawn Path (no catalog probe) | `plugins/codexclaw/skills/lunasearch/references/spawn-surface.md#hardcoded-spawn-path-no-catalog-probe` |
| `plugins/codexclaw/skills/lunasearch/SKILL.md` | Subagent Skill Attachment (attach cxc-search, not prose) | `plugins/codexclaw/skills/lunasearch/references/subagent-attachment.md#subagent-skill-attachment-attach-cxc-search-not-prose` |
| `plugins/codexclaw/skills/lunasearch/SKILL.md` | Use Case | `plugins/codexclaw/skills/lunasearch/references/swarm-and-report.md#use-case` |
| `plugins/codexclaw/skills/lunasearch/SKILL.md` | Swarm Shape | `plugins/codexclaw/skills/lunasearch/references/swarm-and-report.md#swarm-shape` |
| `plugins/codexclaw/skills/lunasearch/SKILL.md` | Spawn Contract | `plugins/codexclaw/skills/lunasearch/references/swarm-and-report.md#spawn-contract` |
| `plugins/codexclaw/skills/lunasearch/SKILL.md` | Proof Handoff (to cxc-search) | `plugins/codexclaw/skills/lunasearch/references/swarm-and-report.md#proof-handoff-to-cxc-search` |
| `plugins/codexclaw/skills/lunasearch/SKILL.md` | Final Report | `plugins/codexclaw/skills/lunasearch/references/swarm-and-report.md#final-report` |
| `plugins/codexclaw/skills/lunasearch/SKILL.md` | Gap note (vs lazycodex ultraresearch) | history → `devlog/_plan/261009_prompt_reduction/evidence/r4-moved-history.md` |
| `plugins/codexclaw/skills/skill-hub/SKILL.md` | skill-hub (DEPRECATED) | history → `devlog/_plan/261009_prompt_reduction/evidence/r4-moved-history.md` |
| `plugins/codexclaw/skills/orchestrate/SKILL.md` | cxc-orchestrate (DEPRECATED) | history → `devlog/_plan/261009_prompt_reduction/evidence/r4-moved-history.md` |
| `plugins/codexclaw/skills/goalplan/SKILL.md` | cxc-goalplan (DEPRECATED) | history → `devlog/_plan/261009_prompt_reduction/evidence/r4-moved-history.md` |
| `plugins/codexclaw/skills/dev-diagram-viewer/SKILL.md` | cxc-dev-diagram-viewer (DEPRECATED) | history → `devlog/_plan/261009_prompt_reduction/evidence/r4-moved-history.md` |

## Move integrity

Domain blocks were sliced from the original files; only relative paths were adjusted after relocation. History excerpts were removed into the history ledger. Frontmatter was checked byte-identical for every scoped router during the move. The recall test changes only its input path and retains every assertion.

QA generic proof points to dev §3 after opening the current owner and confirming fresh command/output proof plus independent child verification. QA domain evidence rules remain in evidence-contract.md.

Every moved reference has a conditional router row. Removed alias bodies are preserved as history and replaced with the target pointer only.

Partial-section moves: recall's sidecar/index write boundary is in references/commands.md (the memory-note prohibition remains in the router); its version-match caution is in references/result-checks.md, with the observed ranking sentence in the history ledger. QA §7, QA §3, recall's rewrite ladder, Luna attachment and cross-skill reference paths now link to their relocated owners. These are reference repairs, not domain-rule changes.

Source-fidelity check: 164 moved heading/paragraph blocks match HEAD source after normalizing only link/path repairs and explicitly archived history. Exact comparison confirms the recall test's input file path is its only edit.

## Validation

| Command | Result |
| --- | --- |
| `node --test plugins/codexclaw/test/recall-skill-synopsis.test.mjs plugins/codexclaw/test/qa-validate-evidence.test.mjs plugins/codexclaw/test/manifest-policy.test.mjs plugins/codexclaw/test/skill-catalog.test.mjs plugins/codexclaw/test/port-provenance.test.mjs` | Exit 0; 45 tests passed; 0 failed/cancelled/skipped |
| `node --test --experimental-strip-types plugins/codexclaw/components/subagent-config/test/catalog.test.ts plugins/codexclaw/components/cxc-ops/test/*.test.ts` | Exit 0; 224 tests passed; 0 failed/cancelled/skipped |
| `node plugins/codexclaw/scripts/check-prompt-architecture.mjs` | Exit 1; 21 expected baseline maintenance findings at final run: 16 shrunken router records and 5 retired legacy duplicate-ID records; no link, definition, L2 or over-budget violation |
| `checkPromptArchitecture({ baseline })` with resolved records removed IN MEMORY only | `ok: true`, no violations; on-disk baseline untouched |

Parent baseline updates for this lane: delete router records for qa (3,214 B), search (3,617 B), recall (3,603 B), interview (4,102 B). All four now fit the 10,240 B whole-file ceiling. Luna is 1,644 B whole / 1,433 B body. Alias bodies: skill-hub 34 B, orchestrate 38 B, goalplan 36 B, dev-diagram-viewer 56 B.

No scope expansion required. No builds or Git writes performed. Domain wording about runtime/model/goal behavior was retained; this docs-only lane does not claim live provider, spawn, Interview or manual-surface behavior verification. The parent owns baseline edits and independent move-ledger review.
