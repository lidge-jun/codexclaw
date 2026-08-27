# Page and exhibit contract

## Narrative pattern

Every page follows one of four templates:

- Answer page: headline → one-sentence answer → 3–5 supporting facts.
- Exhibit page: message headline → chart/diagram → text alternative → implication.
- Domain diagnostic: current state → benchmark → material gap → action/KPI.
- Roadmap page: dependency graph → decision gates → accountable owner.

## Visual grammar

- White background, navy headlines, cyan accent, limited green/orange/red decisions.
- Color never carries meaning alone: every mark has a label, status word, or table alternative.
- No decorative gradients or stock imagery.
- Charts use consistent 1–5 maturity scales and note that scores are source-backed assessments.
- Each diagram has a caption and adjacent text alternative.

## Mandatory exhibits

1. Three-owner architecture.
2. Overall maturity bars.
3. Strategic positioning 2×2.
4. Product architecture stack.
5. PABCD lifecycle comparison.
6. Goal/research state ownership map.
7. Search proof funnel.
8. Multi-agent lifecycle comparison.
9. Evidence chain.
10. Enforcement tier stack.
11. Trust boundary map.
12. UX journey.
13. Distribution flow.
14. Capability heatmap.
15. Impact × feasibility portfolio.
16. 0–90 day roadmap.
17. 3–6 month dependency roadmap.
18. KPI tree.

## Page contract

For each of pages 2–39 the builder data must carry:

- `headline`: a conclusion, not a topic.
- `pillar` and `program`.
- `purpose`: which decision the page changes.
- `evidence`: at least two source codes or one shipped-runtime source plus an explicit limitation.
- `exhibit`: chart/diagram/table type.
- `textAlternative`: full adjacent meaning.
- `implication`: what management should do differently.
- `mergeTest`: the nearest page it would merge into if it does not change a distinct decision.

The builder validates all fields before PDF generation. It rejects subject-only headlines ending in “gap”, “summary”, or “overview” without a predicate.

## Completed page matrix

Evidence codes resolve in `003_score_claim_ledger.md`. `P1`–`P5` are strategic programs from `004_operating_model.md`.

| Pg | Headline | Pillar / program | Purpose / decision changed | Exhibit | Evidence | Implication | Merge test |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 2 | CodexClaw should scale governance, not recreate the runtime | All / all | Set strategy thesis | answer pyramid | C1,C5,C17,O4,S7 | Invest in truth/integration, not parity | Cannot merge: report answer |
| 3 | Five programs close the largest gaps without breaking the thin-host boundary | All / P1–P5 | Approve portfolio | five-program bands | C2,C10,C12,C16,C17 | Fund five programs | Merge to 34 only if exec summary removed |
| 4 | Evidence supports directional maturity, not benchmark rankings | Method / all | Bound score use | evidence ladder | C5,C16,O7,S9 | Do not publish overall ranking | Merge to 40 only if removed from exec section |
| 5 | Five MECE pillars define what “full gap” means | All / all | Approve completeness model | pillar tree | C1,C5,C10,C16,C17 | Use 20-domain denominator | Cannot merge: scope proof |
| 6 | CodexClaw owns policy and evidence; Codex owns execution | A / P1 | Preserve owner boundary | three-owner architecture | C1,C4,O4,S7 | Reject runtime duplication | Merge 7 only if architecture remains visible |
| 7 | Maturity is bimodal: governance is strong, product operations are fragmented | All / P1–P5 | Identify portfolio imbalance | heatmap | C1,C5,C10,C12,C16,C19 | Balance control plane with product ops | Merge 8 if one exhibit survives |
| 8 | CodexClaw wins where truth is durable and loses where state is disconnected | All / P1,P3 | Prioritize integration | strength/gap bridge | C2,C5,C10,C12 | Connect existing state before adding features | Merge 7 only if distinct causal bridge retained |
| 9 | PABCD is real runtime, but intellectual quality remains partly prompt-bound | A / P1 | Tier governance by risk | lifecycle stack | C1,O1 | Require stronger C3/C4 binding | Merge 11 only if FSM evidence retained |
| 10 | Goalplan blocks false completion but cannot operate the full task lifecycle | A / P1 | Fund public task/criterion ops | state lifecycle | C2,O2,S1 | Build add/resolve/capture operations | Cannot merge: highest-value gap |
| 11 | Review identity is strong when bound and form-only when lean | A,B / P1 | Define tiered review policy | two-track review | C1,C5,O5 | C3/C4 require bound review | Merge 9 only if trade-off remains explicit |
| 12 | Research quality rules outpace the state that must recover them | A / P1 | Fund durable research projection | wave/claim map | C3,O3 | Put lanes/leads/claims in goalplan | Cannot merge: distinct consumer case |
| 13 | Search proof is strong; capability-aware routing is weak | A,D / P1 | Wire tool truth | proof funnel | C3,C13,S6 | Connect actual tools to search ladder | Merge 15 only if source-proof funnel remains |
| 14 | Recall is mature retrieval, not epistemic truth maintenance | A / P1 | Add claim validity before memory promotion | knowledge lifecycle | C3,O3 | Preserve provenance/validity | Cannot merge: distinct memory decision |
| 15 | Skill delivery is robust; external skill trust remains mutable | D,E / P5 | Harden supply-chain review | trust funnel | C4,C20,O11 | Pin revision/hash/permissions | Merge 33 only if delivery/runtime distinction retained |
| 16 | Workspace intelligence is advertised but incomplete in the installed payload | D / P5 | Decide ship-or-stop-advertising | payload gap flow | C14 | Close map contradiction | Cannot merge: concrete product inconsistency |
| 17 | Multi-agent policy is strong; runtime-surface detection can misroute | A,D / P1 | Build capability adapter | lifecycle matrix | C4,C13,O4 | Snapshot effective schema/lifecycle | Cannot merge: top P1 initiative |
| 18 | Host-native background execution lacks an integrated liveness projection | A,C / P3 | Keep liveness host-owned | owner boundary | C12,O4,S7 | Request authenticated host events | Merge 27 only if scheduler reject remains |
| 19 | Source provenance leads, while receipt truth is still self-authored | B / P1 | Build Evidence Authority v3 | evidence chain | C5,O5 | Bind command/output/executor | Cannot merge: top assurance gap |
| 20 | Final gates are sophisticated, but the strongest schema remains optional | B / P1 | Mandate by work class | gate ladder | C5,O5 | Require schema v2 for C3/C4 | Merge 19 only if optionality survives |
| 21 | Hook trust protects local integrity, not publisher authenticity | B / P5 | Add supply-chain identity | trust chain | C6,S4 | Add SBOM/signing/publisher proof | Merge 22 if local/publisher distinction remains |
| 22 | Security release assurance lags the repository’s stated standard | B / P5 | Expand release gate | security checklist | C6,C7,S4 | Add SAST/secret/dependency/SBOM/signing | Cannot merge: release decision |
| 23 | Remote operations is a differentiated shipped strength | C / P2,P3 | Preserve/extend unique advantage | channel journey | C11 | Use bridge as operator entry point | Cannot merge: positive strategic differentiator |
| 24 | The operator console omits the core PABCD product state | C / P2 | Fund unified console | console wireframe | C10,C2,O8 | Show phase/work/criteria/receipts/trust | Cannot merge: top product gap |
| 25 | Installation is concise but not guided end-to-end | C / P2 | Build progressive onboarding | user journey | C9,O8,S10 | Health→trust→models→optional bridge→task | Merge 24 only if first-run journey remains |
| 26 | GUI controls can report success before mutation truth is known | C / P2 | Fix control-plane correctness first | error-state flow | C9,C10 | Require confirmed ok and save boundary | Cannot merge: immediate defect class |
| 27 | Operational history resets and cannot correlate one run end-to-end | C / P3 | Fund durable ops plane | event correlation | C12,O4,S7 | Persist stable IDs and failures | Cannot merge: top ops gap |
| 28 | Model/provider controls are rich but vocabulary drifts across surfaces | C,E / P2,P1 | Unify capability-aware settings | settings map | C18,O9,S8 | One effort/capability contract | Merge 17 only if human UX decision retained |
| 29 | Source CI is broad; real Windows install lifecycle is missing | D,E / P5 | Close candidate proof | OS matrix | C15,C17,O7,S5 | Add Windows install/retrust/upgrade/remove | Cannot merge: exact platform gap |
| 30 | Distribution is candidate-grade except checkout-only map/GUI surfaces | E,D / P5,P2 | Decide shipped surface | install topology | C14,C17,O10 | Ship bounded surfaces or stop claims | Merge 16 only if full distribution view remains |
| 31 | Maintainability is the limiting engineering constraint | D / P4 | Fund static-safety spine | debt bars | C16,O7,S5 | Typecheck, split modules, canonical helpers | Cannot merge: top engineering gap |
| 32 | Performance measurement exists but does not govern candidates | E,D / P4 | Establish baseline before gate | trend/gate ladder | C19,S9 | 30-run OS baseline, then budget | Cannot merge: measured-ops decision |
| 33 | Internal capability breadth exceeds the external ecosystem contract | E / P5 | Define bounded ABI/trust | ecosystem rings | C20,O10,S10 | Versioned manifest/provenance/disable path | Cannot merge: ecosystem decision |
| 34 | Impact × feasibility favors five programs over feature parity | All / all | Approve portfolio | impact-feasibility bubble | C2,C10,C12,C16,C17,C19,C20 | Sequence five programs | Cannot merge: portfolio choice |
| 35 | 0–90 days should close truth, static safety, mutation UX, and map contradiction | All / P1,P2,P4,P5 | Approve near-term roadmap | 0–90 timeline | C2,C9,C14,C16,C17 | Start P4/P1 foundations first | Cannot merge: horizon one |
| 36 | 3–6 months should build durable operations, operator console, and security release | All / P2,P3,P5 | Approve scale roadmap | dependency roadmap | C6,C7,C10,C12 | Consume stable IDs/state | Cannot merge: horizon two |
| 37 | An operating model ties each program to owner, cadence, formula, and gate | All / all | Approve governance | KPI tree/RACI | C2,C10,C12,C16,C17 | Review programs with explicit exit gates | Cannot merge: operating contract |
| 38 | Selective transfer preserves CodexClaw’s differentiation | All / all | Approve ADOPT/ADAPT/DEFER/REJECT | transfer matrix | C1,O1,O3,O4,S4,S7 | Import patterns, not runtime owners | Cannot merge: transfer decision |
| 39 | Risks and bounded uncertainty constrain the recommendation | All / all | Bound confidence | risk matrix | C5,C6,C7,O7,S5 | Keep N/E and rejected transfers visible | Cannot merge: risk acceptance |

Pages 40–42 are appendix pages and do not require a management decision; they provide method, page-to-source resolution, and detailed score/N/E evidence.

## Page QA contract

- Headline, body, exhibit, caption, footer all inside page frame.
- Tables never split a row across pages.
- Minimum body text 8.2pt and source text 6.2pt.
- No black squares, missing Korean glyphs, clipped labels, overlapping bars, or orphan headings.
- Cover decoration applies only to page 1.
- Render every page at 120–140 DPI and inspect the complete set.
- Generate three contact sheets (1–14, 15–28, 29–42) and a JSON defect ledger.
- Each inspection row records page, headline, render path, text-readable, no-overlap, no-clipping, nonblank, caption/table-alternative, status, and note.
