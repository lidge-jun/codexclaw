# wp1 — Shared behavior and portable fixtures

Depends on wp0. Scope root S=plugins/codexclaw/skills/dev-visualizer,
T=plugins/codexclaw/test. No browser/library installation; preserve CLI usage and
legacy report-model v1. Validate additive fields when present. Main owns SKILL,
common doc integration and branch operations. Worker scopes below are disjoint.

## Exporter worker (E)

MODIFY S/scripts/export-paged-report.mjs and T/report-export.test.mjs.
Before: missing tools fill notRun but finish ignores them; subprocess statuses and
empty extraction can evade QA; fixed A4 checks; only qa/notRun arrays.
After: explicit command options --pdfinfo/--pdftotext for selecting installed tools
(or deterministic subprocess fixtures), --paper-size A4|Letter, recognized arguments
validated; portable executable discovery; status/signal/error checks on each command;
positive finite page count/geometry and nonempty text required before layout analysis.
Do not overwrite input, accept stale output as fresh export, or leave failed temporary
HTML files. Keep existing output-directory regression behavior.

Create report.checks entries {id,required,status,reason}; status PASS|FAIL|REVIEW|NOT_RUN.
Stable ids reuse pdf-parse, text-integrity, pagination plus artifact-created. Missing executables
produce required NOT_RUN and BLOCKED/3; invocation failures, invalid parsing or empty
extraction produce FAIL/1; review findings REVIEW/2; only completed required checks
produce PASS/0. Emit artifactExists and deliveryReady:false separately. No automatic
full-publication receipt; quality-gate remains the explicit final gate.
Outcome chain: CLI/tool execution -> checks -> JSON -> verdict/exit + consumer QA;
no hidden boolean pretending omitted steps succeeded. Precedence FAIL > BLOCKED > REVIEW > PASS.

Tests invoke the actual CLI in temporary homes with deterministic Node subprocess
fixtures (not real user browser profiles): missing tool, nonzero invocation, invalid
page count, empty extraction, A4/Letter happy paths, required NOT_RUN, REVIEW, and
preserved #181 output-directory cases. Show red/green on the original missing-tool
bug, and mutation or equivalent negative proof the guard is exercised. A portable
runner fixture may be added as T/fixtures/visualizer-export-tools.mjs if needed.

## Research/receipt worker (R)

MODIFY S/scripts/report-contract.mjs; T/report-research-handoff.test.mjs.
NEW S/scripts/research-adapter.mjs; S/scripts/report-intake.mjs;
S/assets/research-handoff.example.json; T/report-intake.test.mjs.
Before: optional research section and minimal researchReceipt; no operational intake
adapter/CLI, source spans or source-SHA/host/template provenance.
After: keep source/output languages, question-to-claim IDs and legacy behavior;
validate malformed sections without crashes. Add optional source spans, counter-
evidence/gaps and generation metadata. generationReceipt receives explicit producer
metadata (skillVersion, packageVersion, sourceSha, hostAdapter, genre, templateIds, recipeIds); unknown
stays unknown. researchReceipt remains a compatibility wrapper. Validate metadata shape, never infer version from parent checkout.

Adapter public API prepareResearch(model,{retrieve,metadata}): source-only
validates without invoking retrieve; bounded/deep routes use only explicitly supplied
retrieval capability, preserve provided claims/sources/questions and return missing-
capability/gap information without fabricated evidence. Define exact response as
{model,receipt,issues}; callers branch on issues, never swallow errors as completion.
Input JSON -> validator/adapter -> JSON model + receipt -> authoring instructions and
shared fixtures. CLI report-intake.mjs <model.json> [--metadata <json>] reads frozen
source inputs only, reports validation errors nonzero, no implicit network. Deep
research still requires caller authorization. No provider daemon.
Tests cover zero retrieve calls for source-only, missing adapter, invalid result,
provenance unknown/explicit, counter-evidence and unanswered questions preserved,
legacy v1 accepted without declaring it research-complete.

## Locale/exhibit worker (L)

NEW S/scripts/report-locale.mjs, S/scripts/exhibit-contract.mjs;
S/reference/english-authoring.md, S/reference/exhibit-recipes.md;
S/assets/report-examples/{decision,research,reference}-{ko,en}.json;
S/assets/exhibit-recipes.json;
T/report-locale.test.mjs, T/exhibit-contract.test.mjs.

report-locale exports validateLocale(config), formatValue(value,config),
compareSemanticPair(source,target). Config records sourceLanguages, outputLanguage,
locale, paperSize (explicit A4|Letter), date/number/currency/unit formats; it never
changes source values. Pair fixtures share stable question/source/claim IDs, numeric
values, units, denominators, qualification and claim-strength markers. Validator
catches drift without pretending to assess arbitrary prose; human bilingual review
remains distinct from layout review. Translated quotes must carry original source
and translation marker. English-native decision/research/reference prose is curated,
not machine literal translation of Korean headings. Include long English labels and
Korean-source/English-output fixture. JSON is serialized input to public functions;
CLI authoring instructions consume results. No mandatory new field on legacy models.

exhibit-contract exports validateExhibitRecipe(recipe), validateExhibitInstance(instance,recipe), renderExhibit(instance,recipe,options) with HTML/SVG
and accessible text. Recipe schema: version,id,domain,readerQuestion,requiredFields,allowedEvidence,
calculation/method,encoding,misleadingAlternatives,failureCases,staticStrategy.
Instance schema: recipeId,sourceRefs,evidenceType,data,units,denominator,uncertainty,
caption,accessibleText,edges. Qualitative
examples need evidence anchors without invented scores. Choose native HTML/SVG only;
no external renderer is necessary. Escapes untrusted labels into inert text.
Curate policy assumption map; business waterfall/sensitivity; UX journey/cohort;
science intervals/heterogeneity; history chronology/provenance; operations process/
latency examples. Describe prerequisites and failure cases. Prose/table remains
valid; no chart quota. Negative tests: mismatched pie denominator, invented scores,
incompatible pooled estimates, correlation-as-causation, missing sources, omitted
uncertainty where required. Evidence/hypothesis edges differ in data + accessible text.
Numbers in fixtures are explicitly illustrative. Original examples, no copied assets.

## Main integration

MODIFY S/SKILL.md, reference/report-pipeline.md, environment-detection.md,
port-maintenance.md, document-pdf.md as needed for correct live command contracts.
Remove obsolete target-only engine/font claims instead of implementing unnecessary
migration. Add routes to actual intake, locale and exhibit examples. Preserve static
HTML/SVG source-review-only row; narrow contradictory blanket browser instructions
in references. Publish no report claiming semantic review from a schema pass.

Verification selection is prose guidance, not a runtime hook: tier E7, surface agent
instructions, bypass other authoring tools, residual agent noncompliance; no final
unbypassable layer. Automated CLI checks are program-local E8, bypass direct rendering;
claim only what the called checker executes. Tests assert behavior/data, not phrase
existence. Independent reviewer checks the simple-static policy across references.

Run focused node --test T/report-*.test.mjs T/exhibit-contract.test.mjs
T/visualizer-packaging.test.mjs. Baseline existing glob executed: 78/78 pass.
New file verifiers cannot run before creation and must first be observed in B/C.
Run syntax checks on modified scripts and repo gate/inventory (baseline green).
A real isolated PDF fixture with mixed scripts/long labels must be exported/inspected
once where export/locale correctness requires it; do not render ordinary doc edits.

## Consumer integration and truthful limits

Dependency map: report-intake CLI -> research-adapter -> report-contract.
report-locale and exhibit-contract are independent domain boundaries; the authoring
entrypoint/report pipeline consumes their JSON examples and documented functions.
Exporter -> Node subprocess tools only; quality-gate remains a separate explicit
PDF receipt boundary. No upward/circular imports or universal renderer framework.
Reject whole historical browser/font migration: it changes far more runtime surface
than #1 needs and would impose resources unrelated to small artifacts.

Human review must independently read the six KO/EN examples against their frozen
source facts; compareSemanticPair protects declared semantic fields, not arbitrary
natural-language inference. Carry uncertainty, quotation translation, denominator and
claim strength into actual visible example prose; do not call matching metadata
semantic proof. Add fixture mutations of those declared facts and record reviewer
judgment separately. A4/Letter export layout uses an isolated real PDF smoke with
long English labels, mixed script and SVG text when generated output warrants it.

For recipe rendering, unsupported or invalid data produces an explicit error/gap,
never fabricated marks. A supported recipe may render an honest table/qualitative
exhibit when no chart is warranted. The result includes caption/source/accessibility
text and a static print strategy. Use no new third-party dependency; native HTML/SVG
satisfies 'at most one' quantitative backend constraint. A renderer cannot certify
causality; explicitly reject declared incompatible pooling/causal overclaim metadata
and retain human evidence review for unstated semantic claims.

## Locked cross-worker interfaces (design reflection D2/D3/D4/D5)

Exporter reuses evaluateReport from quality-gate at standard profile to aggregate
matching check IDs; no second verdict engine. Include schemaVersion:1,
artifact_sha256:string|null, artifactExists:boolean, checks[], exitCode and
 deliveryReady:false. PASS checks carry artifact_sha256 and meaningful evidence.
Missing artifact returns FAIL before gate; required missing tools remain BLOCKED.
Artifact-created is additional exporter evidence, not a fake publication check.

prepareResearch(model,{retrieve=null,metadata={}}={}) returns Promise<{model,receipt,issues}>.
retrieve request: {route,sourceBoundary,sourceLanguages,outputLanguage,questions,suppliedSources}.
Response: {sources,claims,answers,gaps,counterEvidence,stopReason?} where answers is
[{questionId,claimIds}], gaps is string[], counterEvidence uses shape below.
Merge by unique stable IDs; reject conflicting duplicates; retain supplied counter-
evidence/gaps. Missing retrieve on research routes returns an issue, not success.
Source-only never calls retrieve. Catch rejected retrieval at the adapter boundary
and retain an explicit issue; do not report missing facts as answered.

source.spans?: [{id,locator,language,excerpt?}]
claim.sourceSpans?: [{sourceId,spanId}]
research.counterEvidence?: [{claimId,sourceRefs,note}]
research.sourceLanguages:string[] and research.outputLanguage:string are canonical.
Legacy research.languages.source/output remains accepted and receipt legacyInput:true;
conflicting dual representation is rejected, no silent upgrade.
generationReceipt(model,{skillVersion='unknown',packageVersion='unknown',sourceSha='unknown',hostAdapter='unknown',
genre='unknown',templateIds=[],recipeIds=[],checks=[]}) produces explicit provenance and
per-check outcomes. researchReceipt preserves existing boolean checks compatibility.
Checks passed by callers are assertions, not authenticated proof; receipt says so.
Full SHA accepts 40 hex or unknown; source paths and account identifiers are excluded.

validateLocale(config) -> Issue[]; formatValue({raw,kind,currency,unit},config) ->
{raw,display}; compareSemanticPair(source,target) -> Issue[]. Units stay unchanged.
validateExhibitRecipe(recipe) -> Issue[];
validateExhibitInstance(instance,recipe) -> Issue[];
renderExhibit(instance,recipe,options) -> {html,accessibleText,staticStrategy}.
Recipe owns prerequisites/requiredFields/allowedEvidence/calculations/failureCases;
instance owns sourceRefs/data/units/denominator/uncertainty/caption/edges.
Recipe/schema metadata is versioned input; invalid versions fail explicitly.

## A-review round 1 dispositions

B1 accepted: top-level artifact_sha256 is canonical, matching evaluateReport input;
no camelCase alias. Positive exporter JSON must be passed directly to evaluateReport
at standard profile, proving matching hash and check shape; missing tools remains
BLOCKED. B2 accepted: packageVersion is separate from skillVersion and defaults to
unknown, validated and tested with distinct consumer/upstream values.

B3 accepted: report-locale also exports renderLocalizedExample(example,config) ->
{html,lang,paperSize}. This small native HTML fixture authoring function consumes the
six paired JSON examples. Each example supplies visible title, summary, sections,
source notes, captions, accessible descriptions and translated quotations plus the
semantic invariants. Config selects lang, explicit A4/Letter CSS, number/date/unit
formatting and localized running labels (Contents/Sources/Limitations or Korean
counterparts). Escape all prose; no executing template strings or language guessing.
Output includes document lang, page/running furniture, figcaptions and accessible
text. Tests parse/assert the produced markup against independent expected values,
not phrase presence in guidelines; negative fixtures reject missing localized fields.
Real exported mixed-script/long-label fixture confirms actual pages when used for
PDF smoke. This is a bounded example/fixture producer, not mandatory HTML pipeline.

Split L into disjoint worker L (report-locale + six examples + English authoring/tests)
and worker X (exhibit-contract + recipe JSON + exhibit reference/tests). They share
no writable file. Main still owns SKILL/pipeline and integration/real PDF smoke.
