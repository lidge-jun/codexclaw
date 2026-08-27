# 260827 OMO + Senpi → CodexClaw 전체 격차 전략 보고서

Date: 2026-08-27
Session: `01a04292-0ed2-7172-87ae-1b2640d8626f`
Class: C3 docs/artifact, single PABCD work-phase
Delivery: strategy-consulting style PDF, 42 A4 pages

## Goal

기존 11쪽 research-gap 보고서를 전면 재구성해 CodexClaw의 제품·런타임·거버넌스·UX·배포·운영 전체 격차를 OMO beta와 Senpi에 비교한 30쪽 이상 executive report로 만든다.

## Non-goals

- OMO/Senpi 기능 수를 그대로 맞추는 parity 주장.
- production source, hooks, skills, runtime config 수정.
- 새 scheduler/server/goal DB/team role 도입.
- release, push, 외부 게시.
- McKinsey 상표·템플릿·고유 trade dress 복제. Pyramid principle, headline-led exhibits, answer-first narrative만 차용한다.

## Evidence baseline

- Current CodexClaw source at report-build HEAD `98cac96c2eaf28446ed433bb7c6ff92fca5201cd`.
- Pinned OMO clone `84f98d8bd1b5c70c46e6f8a5613ffb3c787079db` (`v5.0.0-beta.22`, npm `omo-ai@beta=5.0.0-0.beta.22`).
- Pinned standalone Senpi comparison `703d9d7676b3419273765a4566dd02c1abe75d70` (`2026.8.27`). OMO beta declares peer `2026.8.26-2`; exact integrated peer behavior remains UNVERIFIED.
- `devlog/_fin/lazygap`, `lazygap_impl`, `260725_lazygap2_omo419_parity`, `260710_repo_review`, release/cross-platform/UX units.
- Existing `devlog/_fin/260827_omo_senpi_research_gap/` eight-document audit.
- Fresh six-lane read-only sweep for this report.

Every score is a source-backed maturity assessment, not a performance benchmark. Score labels:

- 1 = prompt/prose or absent.
- 2 = partial mechanism/test-only/manual process.
- 3 = shipped bounded runtime.
- 4 = durable cross-surface integration with evidence.
- 5 = measured operating system with live feedback and release proof.

## Report storyline

1. Answer first: CodexClaw is strong in governance/evidence and thin-host discipline, but trails in durable research/task memory, integrated UX, observability, and ecosystem scale.
2. Where it wins: PABCD/goal completion/source identity/QA evidence/host-native boundaries.
3. Where it trails: research execution state, user-facing orchestration, live operational signals, ecosystem/distribution breadth, full-surface coherence.
4. What not to copy: duplicate schedulers, hidden continuation, process-global arming, role explosion, second goal/task DB.
5. What to do: five strategic programs with dependency-ordered roadmap and KPIs.

## Completeness model

The full-gap claim is bounded by five mutually exclusive pillars, each with four diagnostic domains:

| Pillar | Domains | Primary program |
| --- | --- | --- |
| A. Strategy & execution | orchestration; goal/task state; research/knowledge; multi-agent | Program 1 control-plane truth |
| B. Assurance & trust | evidence/QA; hook/trust/security; release assurance; human authority | Programs 1 and 5 |
| C. Product & operations | onboarding; operator console; remote/messenger; observability | Programs 2 and 3 |
| D. Engineering platform | capability/tool routing; workspace intelligence; cross-platform; maintainability | Programs 1 and 4 |
| E. Scale & ecosystem | distribution/install; model/provider portability; performance operations; extensibility/ecosystem | Programs 4 and 5 |

Materiality threshold: a domain earns a diagnostic page only when it changes at least one of priority, owner, KPI, transfer decision, or release gate. Pages that do not change a decision merge into the closest domain page.

De-duplication: orchestration/goal/task/research pages split by authoritative owner and decision. Multi-agent/background pages split policy from host runtime. Distribution/cross-platform/release pages split artifact delivery, OS behavior, and certification.

## Planned page architecture (42 pages)

| Page | Headline / exhibit |
| --- | --- |
| 1 | Cover |
| 2 | CodexClaw should scale governance, not recreate the runtime |
| 3 | Five programs close the largest gaps without breaking the thin-host boundary |
| 4 | Evidence supports directional maturity, not benchmark rankings |
| 5 | Five MECE pillars define what “full gap” means |
| 6 | CodexClaw owns policy and evidence; Codex owns execution |
| 7 | Maturity is bimodal: governance is strong, product operations are fragmented |
| 8 | CodexClaw wins where truth is durable and loses where state is disconnected |
| 9 | PABCD is real runtime, but intellectual quality remains partly prompt-bound |
| 10 | Goalplan blocks false completion but cannot operate the full task lifecycle |
| 11 | Review identity is strong when bound and form-only when lean |
| 12 | Research quality rules outpace the state that must recover them |
| 13 | Search proof is strong; capability-aware routing is weak |
| 14 | Recall is mature retrieval, not epistemic truth maintenance |
| 15 | Skill delivery is robust; external skill trust remains mutable |
| 16 | Workspace intelligence is advertised but incomplete in the installed payload |
| 17 | Multi-agent policy is strong; runtime-surface detection can misroute |
| 18 | Host-native background execution lacks an integrated liveness projection |
| 19 | Source provenance leads, while receipt truth is still self-authored |
| 20 | Final gates are sophisticated, but the strongest schema remains optional |
| 21 | Hook trust protects local integrity, not publisher authenticity |
| 22 | Security release assurance lags the repository’s stated standard |
| 23 | Remote operations is a differentiated shipped strength |
| 24 | The operator console omits the core PABCD product state |
| 25 | Installation is concise but not guided end-to-end |
| 26 | GUI controls can report success before mutation truth is known |
| 27 | Operational history resets and cannot correlate one run end-to-end |
| 28 | Model/provider controls are rich but vocabulary drifts across surfaces |
| 29 | Source CI is broad; real Windows install lifecycle is missing |
| 30 | Distribution is candidate-grade except checkout-only map/GUI surfaces |
| 31 | Maintainability is the limiting engineering constraint |
| 32 | Performance measurement exists but does not govern candidates |
| 33 | Internal capability breadth exceeds the external ecosystem contract |
| 34 | Impact × feasibility favors five programs over feature parity |
| 35 | 0–90 days should close truth, static safety, mutation UX, and map contradiction |
| 36 | 3–6 months should build durable operations, operator console, and security release |
| 37 | An operating model ties each program to owner, cadence, formula, and gate |
| 38 | Selective transfer preserves CodexClaw’s differentiation |
| 39 | Risks and bounded uncertainty constrain the recommendation |
| 40 | Appendix A: evidence method and score aggregation |
| 41 | Appendix B: page-to-source claim map |
| 42 | Appendix C: detailed score ledger, N/E reasons, and source limitations |

## File change map

| Path | Change | Purpose |
| --- | --- | --- |
| `tmp/pdfs/build_codexclaw_gap_report.py` | MODIFY | Rebuild the existing 11-page report into a 42-page exhibit-led report; modular page helpers and vector exhibits; remove unsupported historical PASS/PASS wording. |
| `output/pdf/codexclaw-omo-senpi-gap-analysis-ko.pdf` | REPLACE | Final 30+ page report. |
| `devlog/_fin/260827_omo_senpi_full_gap_report/000_plan.md` | NEW | This completed plan. |
| `devlog/_fin/260827_omo_senpi_full_gap_report/001_page_architecture.md` | NEW | Page-by-page content and exhibit contract. |
| `devlog/_fin/260827_omo_senpi_full_gap_report/002_axis_synthesis.md` | NEW | Six-axis synthesis, maturity matrix, and five programs. |
| `devlog/_fin/260827_omo_senpi_full_gap_report/003_score_claim_ledger.md` | NEW | Auditable scoring sources, confidence, N/E rules, and count commands. |
| `devlog/_fin/260827_omo_senpi_full_gap_report/004_operating_model.md` | NEW | Owners, formulas, baselines, cadence, dependencies, and decision gates. |
| `devlog/_fin/260827_omo_senpi_full_gap_report/005_audit_synthesis.md` | NEW | Audit blocker synthesis and amendments. |
| `tmp/pdfs/verify_full_gap_report.py` | NEW | Executable PDF, render-manifest, bounds, and nonblank verifier. |
| `tmp/pdfs/verify_allowed_delta.py` | NEW | Snapshot/verify status+hash for all non-report worktree paths. |
| `tmp/pdfs/full-gap-baseline.json` | GENERATED | Pre-build unrelated dirty-work snapshot. |
| `tmp/pdfs/full-gap-inspection.json` | GENERATED | Per-page visual inspection and zero-defect ledger. |

## Acceptance criteria

1. PDF has exactly 42 A4 pages.
2. At least 12 non-blank vector exhibits plus adjacent text alternatives/tables.
3. Every page has a message headline; no chapter starts hidden under headers.
4. Covers all 20 domains in the five-pillar completeness model.
5. Includes current-state strengths, gaps, benchmark, recommended initiative, owner, KPI, and risk for each domain.
6. Overall scores identify method and evidence limits; no scalar score is called a benchmark result.
7. Contains explicit ADOPT / ADAPT / DEFER / REJECT transfer decisions.
8. Contains 0–90 day and 3–6 month dependency roadmaps.
9. Contains three appendix pages: method, page-to-source map, detailed score/N/E ledger.
10. `pdfinfo` confirms A4, unencrypted, no JavaScript, at least 30 pages.
11. `pypdf`/`pdfplumber` reopen all pages; text bounds remain inside media box.
12. `pdftoppm` renders all 42 pages; verifier emits a 42-row manifest with nonwhite-pixel and text counts.
13. Contact sheets cover pages 1–42; `full-gap-inspection.json` has exactly 42 `PASS` rows and zero open defects.
14. No change under `plugins/codexclaw/`, `structure/`, `README.md`, `docs/`, `.github/`, `package.json`, or `bin/`; unrelated dirty work preserved.
15. Every diagnostic page maps to one pillar and one strategic program; every program has owner, baseline, formula, source, cadence, and gate.

## Verifier

```bash
/tmp/codexclaw-pdf-venv.PURmmc/bin/python tmp/pdfs/verify_full_gap_report.py \
  output/pdf/codexclaw-omo-senpi-gap-analysis-ko.pdf \
  --expected-pages 42 \
  --render-prefix tmp/pdfs/full-gap-final \
  --manifest tmp/pdfs/full-gap-render-manifest.json \
  --inspection tmp/pdfs/full-gap-inspection.json
test "$(jq '[.pages[] | select(.status != "PASS")] | length' tmp/pdfs/full-gap-inspection.json)" = 0
/tmp/codexclaw-pdf-venv.PURmmc/bin/python tmp/pdfs/verify_allowed_delta.py verify \
  --baseline tmp/pdfs/full-gap-baseline.json \
  --allow devlog/_fin/260827_omo_senpi_full_gap_report \
  --allow tmp/pdfs \
  --allow output/pdf/codexclaw-omo-senpi-gap-analysis-ko.pdf
test -z "$(git status --short -- plugins/codexclaw structure README.md docs .github package.json bin)"
```
