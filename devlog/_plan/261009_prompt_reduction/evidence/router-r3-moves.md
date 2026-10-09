# r3 router relocation evidence

Class: C3 docs-only, bounded shared-tree lane; no git writes, spawning or builds.

## Sizes and frontmatter

| Skill | Before whole-file B | After whole-file B | After body B | Frontmatter SHA-256 (unchanged) |
|---|---:|---:|---:|---|
| dev-frontend | 35995 | 3988 | 3507 | df8af1c8f9eddf01459b1eb08aa10913646ea19f60b8ce0df06f4282abb8c69f |
| dev-uiux-design | 27912 | 3808 | 3416 | 0dbac96633cb38ea8e61849d01281634b20330ae3aa87269d1695f70a6d9014a |
| dev-visualizer | 15915 | 3747 | 3248 | 4b97f9617167b07bdd4c8288ac357d64aa2b129ebe8f14dce4333f4f7213c3b2 |

## Moves

Source paths below are relative to `plugins/codexclaw/skills/`. Headings and domain procedure text were relocated verbatim; only relative paths/cross-section pointers and the three named duplicate-ID stubs changed. UX-CONCEPT-GEN-01 remains defined by its original router heading, with its procedure routed locally.

| Source | Removed heading/block | Destination file#heading or verified pointer |
|---|---|---|
| `dev-frontend` | Role separation / Role boundary | dev-frontend/references/core/role-boundaries.md#frontend-role-boundaries (dev router lacks the full role paragraph; retained verbatim) |
| `dev-frontend` | Modular References (detailed rows) | dev-frontend/references/core/topic-index.md#modular-references; dev-frontend/references/stack-index.md#modular-references |
| `dev-frontend` | Verification grounding | dev-frontend/references/core/render-grounding.md#verification-grounding |
| `dev-frontend` | 1. Component Identification | dev-frontend/references/core/design-intake.md#1-component-identification |
| `dev-frontend` | 1.5 Objective Gates vs Style Samples | dev-frontend/references/core/design-intake.md#15-objective-gates-vs-style-samples |
| `dev-frontend` | 2. Design Direction Intake | dev-frontend/references/core/design-intake.md#2-design-direction-intake |
| `dev-frontend` | 3. Baseline Configuration | dev-frontend/references/core/design-intake.md#3-baseline-configuration |
| `dev-frontend` | 4. Implementation | dev-frontend/references/core/implementation.md#4-implementation |
| `dev-frontend` | Icon Implementation (FE-ICON-01, DEFAULT) | dev-frontend/references/core/implementation.md#icon-implementation-fe-icon-01-default |
| `dev-frontend` | Cutout Asset Generation | dev-frontend/references/core/implementation.md#cutout-asset-generation |
| `dev-frontend` | Cutout Asset Generation (FE-ASSET-BG-01 surface — STRICT) | pointer to dev-frontend/references/core/asset-requirements.md#asset-background-strategy-fe-asset-bg-01-default (owner verified; original cutout pointer retained under Cutout Asset Generation) |
| `dev-frontend` | 5. Anti-Slop Enforcement | dev-frontend/references/core/anti-slop-enforcement.md#5-anti-slop-enforcement |
| `dev-frontend` | Hero discipline (FE-HERO-01) | dev-frontend/references/core/anti-slop-enforcement.md#hero-discipline-fe-hero-01 |
| `dev-frontend` | Do not ship these tells (FE-AI-TELL-01) | dev-frontend/references/core/anti-slop-enforcement.md#do-not-ship-these-tells-fe-ai-tell-01 |
| `dev-frontend` | 6. Performance Guardrails | dev-frontend/references/core/platform-runtime.md#6-performance-guardrails |
| `dev-frontend` | 7. Accessibility Baseline | dev-frontend/references/core/platform-runtime.md#7-accessibility-baseline |
| `dev-frontend` | A11y polish (FE-A11Y-POLISH-01) | dev-frontend/references/core/platform-runtime.md#a11y-polish-fe-a11y-polish-01 |
| `dev-frontend` | 8. React, Forms, and Accessibility | dev-frontend/references/core/platform-runtime.md#8-react-forms-and-accessibility |
| `dev-frontend` | 12. Frontend Platform Rules | dev-frontend/references/core/platform-runtime.md#12-frontend-platform-rules |
| `dev-frontend` | State Classification | dev-frontend/references/core/platform-runtime.md#state-classification |
| `dev-frontend` | 13. Error Boundaries | dev-frontend/references/core/platform-runtime.md#13-error-boundaries |
| `dev-frontend` | 15. Backend Contract & Security Alignment | dev-frontend/references/core/backend-contracts.md#15-backend-contract--security-alignment |
| `dev-frontend` | 15.1 Contract Ownership | dev-frontend/references/core/backend-contracts.md#151-contract-ownership |
| `dev-frontend` | 15.2 Security Responsibilities | dev-frontend/references/core/backend-contracts.md#152-security-responsibilities |
| `dev-frontend` | 15.3 Testing Integration | dev-frontend/references/core/backend-contracts.md#153-testing-integration |
| `dev-frontend` | §16 Pre-Flight Checklist | dev-frontend/references/core/topic-index.md#16-pre-flight-checklist |
| `dev-frontend` | C0/C1 note | pointer to dev/SKILL.md#01-patch-fast-path-c0c1 (owner verified) |
| `dev-frontend` | External/current evidence | pointer to dev/SKILL.md#conditional-routes (owner verified) |
| `dev-uiux-design` | Emoji ban / Role separation / Role boundary | dev-uiux-design/references/role-boundaries.md#design-role-boundaries (role text retained verbatim; dev lacks the full paragraph) |
| `dev-uiux-design` | Modular References | dev-uiux-design/references/topic-index.md#modular-references |
| `dev-uiux-design` | 3. Korean Design Vocabulary + Quick-Match + Font Selection | dev-uiux-design/references/topic-index.md#3-korean-design-vocabulary--quick-match--font-selection |
| `dev-uiux-design` | Lazy-User Gate (UX-LAZY-01, DEFAULT — ponytail discipline applied to UX) | dev-uiux-design/references/lazy-user-gate.md#lazy-user-gate-ux-lazy-01-default--ponytail-discipline-applied-to-ux |
| `dev-uiux-design` | 1. User Intent Discovery Protocol | dev-uiux-design/references/intent-discovery.md#1-user-intent-discovery-protocol |
| `dev-uiux-design` | No-Brief Default Direction (UX-DEFAULT-ISM-01, DEFAULT — kit content STYLE_SAMPLE) | dev-uiux-design/references/intent-discovery.md#no-brief-default-direction-ux-default-ism-01-default--kit-content-style_sample |
| `dev-uiux-design` | 2. Design Read (MANDATORY for new pages, components, or layouts. Optional for ≤5-line patches — see dev §0.1 Patch Fast-Path.) | dev-uiux-design/references/design-read.md#2-design-read-mandatory-for-new-pages-components-or-layouts-optional-for-5-line-patches--see-dev-01-patch-fast-path |
| `dev-uiux-design` | Output format (mini DESIGN.md) | dev-uiux-design/references/design-read.md#output-format-mini-designmd |
| `dev-uiux-design` | Signals to read | dev-uiux-design/references/design-read.md#signals-to-read |
| `dev-uiux-design` | Dial Setting (MANDATORY — immediately after Design Read) | dev-uiux-design/references/design-read.md#dial-setting-mandatory--immediately-after-design-read |
| `dev-uiux-design` | Dial Presets (UX-DIAL-PRESET-01, STYLE_SAMPLE) | dev-uiux-design/references/design-read.md#dial-presets-ux-dial-preset-01-style_sample |
| `dev-uiux-design` | Anti-Default Discipline | dev-uiux-design/references/design-read.md#anti-default-discipline |
| `dev-uiux-design` | DESIGN.md persistence | dev-uiux-design/references/design-read.md#designmd-persistence |
| `dev-uiux-design` | Motion honesty | pointer to dev-frontend/references/core/motion.md#motion-honesty-fe-motion-honesty-01-default (owner verified) |
| `dev-uiux-design` | Concept Decision Tree | dev-uiux-design/references/concept-exploration.md#concept-decision-tree |
| `dev-uiux-design` | Compact ima2 Recipe | dev-uiux-design/references/concept-exploration.md#compact-ima2-recipe |
| `dev-uiux-design` | Image-First Direction Discovery (UX-IMAGE-FIRST-01, DEFAULT) | dev-uiux-design/references/concept-exploration.md#image-first-direction-discovery-ux-image-first-01-default |
| `dev-uiux-design` | 2.7 Icon Strategy (UX-ICON-01, DEFAULT) | dev-uiux-design/references/icon-strategy.md#27-icon-strategy-ux-icon-01-default |
| `dev-uiux-design` | C0/C1 / dev always-on notes | pointer to dev/SKILL.md#01-patch-fast-path-c0c1, #family-invariants, #3-verification-before-completion-strict, #5-safety-rules (owners verified) |
| `dev-uiux-design` | External/current design evidence | pointer to dev/SKILL.md#conditional-routes (owner verified); URL-candidate condition retained |
| `dev-frontend/references/core/asset-requirements.md` | Application to UX-CONCEPT-GEN-01 | pointer to dev-uiux-design/SKILL.md#25-visual-concept-exploration-ux-concept-gen-01-default; asset-specific text retained verbatim under #application-to-concept-exploration |
| `dev-visualizer` | VIZ-SCOPE-01 scope paragraph | dev-visualizer/reference/scope-and-maintenance.md#scope-and-maintenance |
| `dev-visualizer` | Start with the requested outcome | dev-visualizer/reference/authoring-routes.md#start-with-the-requested-outcome |
| `dev-visualizer` | Select a route; read only what it needs | dev-visualizer/reference/authoring-routes.md#select-a-route-read-only-what-it-needs |
| `dev-visualizer` | Report evidence, language and analytical exhibits | dev-visualizer/reference/artifact-composition.md#report-evidence-language-and-analytical-exhibits |
| `dev-visualizer` | Compose before styling | dev-visualizer/reference/artifact-composition.md#compose-before-styling |
| `dev-visualizer` | Build the smallest complete artifact | dev-visualizer/reference/artifact-composition.md#build-the-smallest-complete-artifact |
| `dev-visualizer` | Deliver and retain provenance | dev-visualizer/reference/delivery-and-provenance.md#deliver-and-retain-provenance |
| `dev-visualizer` | Entrypoint alias history | history → devlog/_plan/261009_prompt_reduction/evidence/r3-moved-history.md |

| `dev-uiux-design` | Rule class note block | dev-uiux-design/references/role-boundaries.md#rule-class-note |
| `dev-uiux-design` | 2.6 Asset Production Handoff (UX-ASSET-GEN-01) | dev-uiux-design/references/asset-handoff.md#26-asset-production-handoff-ux-asset-gen-01 |

## Owner checks and limits

The current dev router was read in full. Its C0/C1, family invariants, proof/safety and current-evidence routes contain the rules pointed to. Its former full role-boundary paragraph is absent, so each protected owner preserves its paragraph in a local role reference. The frontend asset-background owner and motion-honesty owner were opened and checked before replacing duplicate stubs.

READER-DOC-01..05 local visualizer copy is untouched. No visualizer link escapes its directory. Genre-specific research/decision/reference language moved together in artifact-composition.md. Frontend render grounding and visualizer verification tiers are preserved in their respective domains; this lane does not reconcile their broader semantic overlap.

No baseline edits: parent owns removal/lowering of r3 router records and retirement of the three resolved legacy ID records.

## Verification

Required suites: `node --test plugins/codexclaw/test/visualizer-packaging.test.mjs plugins/codexclaw/test/report-*.test.mjs plugins/codexclaw/test/emergence-html-structure.test.mjs plugins/codexclaw/test/exhibit-contract.test.mjs plugins/codexclaw/test/manifest-policy.test.mjs plugins/codexclaw/test/skill-catalog.test.mjs` — exit 0; 266 tests, 265 passed, 0 failed/cancelled, 1 skipped. The opt-in real Chrome SVG crossing smoke was skipped because CXC_REAL_CHROME=1 was not set; no real-Chrome proof claimed.

`node plugins/codexclaw/scripts/check-prompt-architecture.mjs` — exit 1, expected baseline ratchet requests for reduced routers, and now-obsolete legacy ID records FE-ASSET-BG-01, UX-CONCEPT-GEN-01, FE-MOTION-HONESTY-01. No link or duplicate-definition violation in r3. Concurrent r2 links temporarily appeared in one snapshot (dev-debugging/root-cause-phases.md, dev-devops/deployment-pipeline-rules.md, dev-scaffolding/source-of-truth-layout.md); these are outside r3 write scope. Parent reruns the aggregate gate after lanes settle.

Path-only follow-through: existing dev-frontend iterative-design.md and prototype-variants.md now identify the retained UI/UX concept-router owner explicitly. Local moved prose points to the new cross-section paths. The pre-existing frontend §11 accessibility reference has no section in the original router; retained without inventing a rule and flagged for the caller.

Fresh text-consistency proof: exact whole frontmatter equality to HEAD for all three routers (catalog changes were already in HEAD); every removed router heading has a ledger disposition and exists verbatim in a local reference, except the explicitly resolved FE-ASSET-BG-01 duplicate heading, which points to the verified asset owner.

Final verification snapshot: all concurrent non-r3 link errors had cleared. The actual architecture command exited 1 with 21 baseline-only ratchet notices (16 reduced-router records and 5 resolved legacy-ID entries). An independent checker invocation with only those shrink/retirement changes applied to an **in-memory** baseline passed the aggregate gate; no baseline file was edited. r3 sizes were 3988 / 3808 / 3747 B. Each named ID has exactly one owner: FE-ASSET-BG-01 → frontend asset-requirements.md; UX-CONCEPT-GEN-01 → UI/UX SKILL.md; FE-MOTION-HONESTY-01 → frontend motion.md.

Fresh packaging + genre rerun: 12/12 passed, exit 0. Inline command and cross-section path follow-through was then corrected without changing procedure wording; the final isolated-link/architecture checks cover those paths.
