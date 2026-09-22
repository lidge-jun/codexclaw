# Analytical exhibit recipes

An exhibit starts with the reader's question and the available evidence. It does not
start with a chart type. Use a recipe only when its prerequisites hold, bind it to one
instance, and validate both before rendering. A table or a short sourced explanation is
a complete exhibit when geometry would add no meaning.

The executable examples live in `assets/exhibit-recipes.json`. All numbers, events,
organizations, records, and source identifiers in that file are original and explicitly
illustrative. They demonstrate contracts and failure modes; they are not evidence for a
real report.

## Public contract

`scripts/exhibit-contract.mjs` exports three functions:

```js
validateExhibitRecipe(recipe)              // -> Issue[]
validateExhibitInstance(instance, recipe)  // -> Issue[]
renderExhibit(instance, recipe, options)   // -> {html, accessibleText, staticStrategy}
```

An issue has `{level:'P0', id, msg}`. Validation is structural and analytical-policy
checking. It cannot establish that a source supports a claim, that a study is well
designed, or that an unstated causal implication is justified. Those remain evidence
review tasks.

`renderExhibit` throws `TypeError` when either contract is invalid. It never fills missing
data with plausible marks. The returned HTML uses an explicit exact-table fallback
(`data-rendering="exact-table"`) for every encoding, plus a caption, sources,
uncertainty, assumptions, declared analysis metadata, and typed relationship lists.
There are no approximate or substitute charts. Every supplied row field has a separate
column: descriptions never hide dates, and point estimates never hide interval bounds.
Every caller-provided string is escaped before entering markup.
`accessibleText` is plain text for the caller to insert through a text-safe API.

## Recipe and instance stay separate

A recipe records analytical requirements. It is reusable and contains no bound values:

| Field | Meaning |
|---|---|
| `version` | Contract version. The only accepted version is `1`. |
| `id`, `domain` | Stable kebab-case identity and one of policy, business, UX, science, history, or operations. |
| `readerQuestion` | The question the exhibit must answer. |
| `prerequisites` | Conditions that must be true before this representation is valid. |
| `requiredFields` | Instance fields whose omission invalidates this recipe. |
| `allowedEvidence` | Evidence types this recipe can bind. |
| `calculation` or `method` | Exactly one descriptor object with `kind` and `description`; the unused descriptor may be omitted or `null`. |
| `encoding` | Analytical family, `labelField:"label"`, and a numeric `valueField` for calculations only. |
| `misleadingAlternatives` | Tempting representations that would distort the evidence. |
| `failureCases` | Conditions that invalidate the exhibit. |
| `staticStrategy` | Honest static fallback for print and low-capability contexts. |

An instance binds sources and data to one recipe:

| Field | Meaning |
|---|---|
| `recipeId` | Must exactly match the recipe. |
| `sourceRefs` | Nonempty evidence identifiers available to the instance. |
| `evidenceType` | Must be allowed by the recipe. |
| `data` | Sourced rows plus claim/design/pooling metadata and explicit assumptions. |
| `units` | Visible unit, or `not-applicable` for qualitative exhibits. |
| `denominator` | Positive measured whole, population, or request count when applicable; otherwise `null`. |
| `uncertainty` | Visible uncertainty or limitation when required; otherwise `null`. |
| `caption`, `accessibleText` | Visible finding/qualification and a full text alternative. |
| `edges` | Relationships classified as `evidence` or `hypothesis`. |

Each data row carries its own `sourceRefs`, and every row reference must resolve through
the instance source list. Evidence edges also require source references. Hypothesis edges
may have no source, but their label and accessible description identify them as unproven.
Do not encode a qualitative theme with an invented score, weight, or rating.

## Validation boundaries

The validator rejects these high-consequence analytical failures:

- Pie values that do not sum to the stated denominator.
- A qualitative row with an invented `score`, `rating`, or `weight`.
- A pooled result unless `poolingCompatibility` is explicitly `compatible`.
- A causal claim on descriptive, observational, historical, or modeled data. The compact
  contract permits causal labeling only for a declared randomized design; it still does
  not certify the design or analysis.
- A required uncertainty statement that is absent.
- Missing, unknown, or row-level source references.
- Missing or non-finite interval bounds, or an estimate outside them.
- Sensitivity output without explicit assumptions.
- Unknown fields, non-finite numbers, unsupported versions, or mixed calculation and
  qualitative-method ownership.

These checks depend on declared metadata. A renderer cannot detect an unstated causal
implication or determine whether two real studies should be pooled. Review the evidence
and visible prose separately.

## Executable per-encoding invariants

These rules apply even if a recipe removes fields from `requiredFields`.
All rows require unique IDs, labels, and resolving source references. Optional text
fields must contain text; supplied numeric fields must be finite. Numeric value fields
are `value`, `estimate`, `duration`, `start`, `end`, `lower`, `upper`, or
`percentile`; the chosen field is checked consistently in every calculation.

| Encoding | Required data and checks |
|---|---|
| `waterfall` | At least three rows: first `role:"baseline"`, middle `role:"delta"`, last `role:"total"`. Baseline plus signed deltas must equal the independently supplied total within max(1e-9, abs(total) × 1e-9). Overflow is rejected. The renderer never invents a missing total. |
| `cohort` | This compact contract represents outcome counts with one common eligible population per cohort. Counts are safe integers from zero through the denominator; the denominator is a positive safe integer. Different denominators require separate instances. Uncertainty is mandatory. |
| `interval` | Each row has finite `lower`, selected estimate, and `upper`, in that order numerically. Uncertainty is mandatory; the interval level remains a sourced statement for human review. |
| `latency` | Each row has numeric `percentile` in [0,100], canonical label `P<number>` (for example P95), and nonnegative latency. Percentiles strictly increase; corresponding latencies never decrease. A positive safe-integer request denominator and uncertainty are mandatory. The denominator label records the observation population/window. |
| `pie` | Nonnegative values sum to a positive denominator using the same tolerance as the bridge. Denominator and values have identical units. An exact category/whole table is emitted, not a pie graphic. |
| `sensitivity` | Each row has a finite modeled result and a `scenario` describing its inputs. Nonempty assumptions and uncertainty are required. Formulas are plain text; no arbitrary formula is executed or certified. |
| `heterogeneity` | Each row has a finite estimate and a study `description`. Uncertainty is mandatory. Pooling requires declared compatibility; metadata and study definitions remain visible. |
| `timeline` | Each row has a `date` string preserving source precision and a `description`. Uncertainty is mandatory. Dates are never normalized or silently reordered; chronology and interpretation require source review. |
| `journey` | Each row has a `stage` and `description`; uncertainty is mandatory. |
| `assumption-map`, `process` | Each row has a `description`; uncertainty is mandatory. |
| `table` | A calculation requires a finite selected value in every row; a method requires a sourced text detail. All other supplied fields remain visible. There is no claim of a specialized chart or domain validation for a generic table. |

Qualitative methods reject all numeric row fields, including numbers smuggled in as
`value`, and reject `score`, `rating`, and `weight`. Qualitative encodings require
a method; quantitative encodings require a calculation. Generic tables permit either.
Unknown options to `renderExhibit` are rejected; version 1 defines no rendering options.

Every validator bounds input before processing: at most 1,000 entries in any array
(including rows and edges), 16,000 UTF-16 code units per string, 1,000,000 total string
code units, 50 fields per object, 100 code units per field name, depth 12, and 50,000
visited values. Oversized input returns a P0 issue at the offending path; rendering
throws TypeError. The renderer contains no spread-based extrema or chart allocation.

## Curated recipes

| Recipe | Use it when | Prerequisites and honest static form | Do not use it when |
|---|---|---|---|
| `policy-assumption-map` | A policy decision depends on propositions with different evidence strength. | Anchor every proposition; list evidence and hypothesis edges separately. | The map would imply that every connector is observed or would turn interviews into scores. |
| `business-waterfall` | Signed components use one unit and reconcile a baseline to an outcome. | Show baseline and contributions in a signed table with unrounded reconciliation. | Components overlap, units differ, or a residual is hidden by rounding. |
| `business-sensitivity` | A transparent model should show how a result changes with assumptions. | Hold the formula constant; list baseline, changed assumption, result, and limitation. | Scenarios are being presented as forecasts or hidden assumptions change. |
| `ux-journey-evidence` | Sourced observations need ordering by user task stage. | Use an ordered evidence table and separate hypotheses from observed transitions. | A small qualitative sample would be converted into prevalence or severity scores. |
| `ux-cohort-comparison` | Comparable cohorts share an outcome definition, window, and denominator. | Align measured values with the eligible population and uncertainty. | Selection differs silently or an observational difference is called causal. |
| `science-intervals` | Studies report point estimates and comparable uncertainty intervals. | Show estimate, lower/upper bounds, interval level, unit, and source. | Interval levels differ without disclosure or point estimates are shown alone. |
| `science-heterogeneity` | Study definitions must be checked before any summary estimate. | Keep study estimates separate and state the pooling decision and reason. | Outcomes, populations, or windows are incompatible but a pooled value is still shown. |
| `history-chronology-provenance` | Events need sequence, date precision, provenance, and disputed readings. | Preserve date precision and source each event; mark interpretive links as hypotheses. | Temporal sequence would be presented as causal proof or approximate dates made exact. |
| `operations-process-evidence` | Observed steps and handoffs need separation from suspected causes. | List steps and distinguish observed handoffs from causal hypotheses. | The designed workflow substitutes for observation or efficiency scores are invented. |
| `operations-latency` | Percentiles come from one request population, period, and unit. | State percentile, value, request count, period, and source. | Percentiles come from different windows or the mean hides tail behavior. |

## Sources, uncertainty, and illustrative labels

Put source references in three places: the instance source list, each data row that uses
the source, and every evidence edge. The renderer prints the instance sources and the
table prints row-level anchors. Source identifiers are locators, not endorsements; the
report still needs a source register that resolves them to real documents and spans.

Keep uncertainty visible beside the exhibit. Examples include sampling error, reported
confidence intervals, model assumptions, date precision, and qualitative limits. `null`
means the recipe does not require an uncertainty statement; it never means certainty.

Illustrative values must say so in the unit, caption, accessible description, or all
three. Do not copy the sample numbers into a report and remove the label. Modeled values
must remain modeled, observations must remain observations, and hypotheses must remain
hypotheses in both visible and accessible text.

## Rendering and fallback

Every recipe renders an exact semantic table in normal HTML flow. Visible columns and
generated accessible text preserve supplied values, bounds, date precision, stages,
scenario inputs, row roles, percentiles, and row source references. Missing optional
cells say "Not supplied" rather than implying zero. Qualitative relationships use typed
lists. There is no chart quota and no fabricated chart fallback.

The returned `staticStrategy` states the intended print or low-capability fallback. A
consumer may use that table/prose strategy directly. Rendering a valid contract does not
replace report-level source review, bilingual review, layout review, or PDF QA.
