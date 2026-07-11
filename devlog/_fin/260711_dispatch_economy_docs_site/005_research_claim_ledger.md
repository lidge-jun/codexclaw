---
created: 2026-07-11
tags: [codexclaw, dispatch-economy, research, claim-ledger, arxiv, tier2]
---

# Research claim-ledger — delegation economy (Tier-2 verified)

Status: RESEARCH (research-only doc, LEXICO-SPLIT-01 000-009 range; implementation
record lives in `011_wp1_impl_record.md`)

Method: 3 explorer lanes (A delegation policy / B context management / C cost &
verification overhead) ran `cxc-search` — Tier 1 hosted `web_search` discovery,
then Tier-2 source-proof by opening each arXiv abstract (agbrowse HTTP rung /
arXiv Atom API, HTTP 200, checked 2026-07-11T09:2xZ). FABRICATED: 0/10. Direct
refutations found: 0 (caveat: confirming-question bias acknowledged; lanes were
instructed to record refuting findings and two attribution demotions below came
from that instruction).

## 1. Claim-ledger (10 papers, exact set)

| # | Paper | URL | Published | Claim relied on | Grounds | Grade |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Memex(RL): Indexed Experience Memory | https://arxiv.org/abs/2603.04257 | 2026-03-04 (v1) | Verbatim: truncation/summaries are "fundamentally lossy because they compress or discard past evidence itself"; keeps "concise structured summaries and stable indices" + "full-fidelity underlying interactions in an external experience database", agent can "dereference an index and recover the exact past evidence" | DISPATCH-TASK-01 verbatim-anchor amendment (summary + anchor = summary + stable index) | preprint, multi-author |
| 2 | Scaling Long-Horizon LLM Agent via Context-Folding | https://arxiv.org/abs/2510.11967 | 2025-10-13 (v1) | Verbatim: "matches or outperforms the ReAct baselines while using an active context 10x smaller"; "significantly outperforms models that rely on summarization-based context management" — task-boundary folding beats plain summarization | Context-firewall rationale: sub-agent summaries must be task-boundary shaped, with anchors | preprint, multi-author |
| 3 | ACON: Optimizing Context Compression for Long-horizon LLM Agents | https://arxiv.org/abs/2510.00615 | 2025-10-01 (v1), v3 2026-06-01, ICML 2026 per arXiv comment | Verbatim: "reduces peak token usage by 26-54% while improving task success"; "critical state information is preserved" as explicit design goal | Context-firewall effectiveness evidence | venue-accepted (ICML 2026), Microsoft |
| 4 | SearchSwarm: Delegation Intelligence in Agentic LLMs | https://arxiv.org/abs/2606.09730 | 2026-06-08 | Verbatim: subagents "execute and return only summarized results, conserving the main agent's context budget"; delegation intelligence = "decompose complex tasks, determine when and what to delegate, and integrate returned results" | ECONOMY-01 preamble: main owns decompose/integrate judgment; note — its delegation policy is SFT-internalized, not criterion-based (attribution corrected in Tier-2 round) | preprint, multi-author |
| 5 | When Agents Disagree: The Selection Bottleneck | https://arxiv.org/abs/2603.20324 | 2026-03-20 | Verbatim: "selector quality may be a more impactful design lever than generator diversity"; crossover threshold s* for aggregation quality; judge-selection win-rate 0.810 vs homogeneous 0.512 | Triage-disposition clause (strongest direct support) | single-author preprint — LOW grade, flagged in doctrine |
| 6 | Scaling LLM-based Multi-Agent Collaboration (MacNet) | https://arxiv.org/abs/2406.07155 | 2024-06-11, v3 2025-03-17, ICLR 2025 | Verbatim: "collaborative scaling law -- the overall performance follows a logistic growth pattern as agents scale". DEMOTED: "scaling horizon" phrasing was snippet interpretation, not abstract text; abstract does NOT attribute saturation to triage | Triage-disposition clause (weak support: saturation exists, cause unattributed) | ICLR 2025 |
| 7 | Why Do Multi-Agent LLM Systems Fail? (MAST) | https://arxiv.org/abs/2503.13657 | 2025-03-17, v3 2025-10-26 | 14 failure modes across 1600+ traces in 3 categories incl. task verification (inter-annotator kappa=0.88) | Triage-disposition clause (verification as first-class failure category) | UC Berkeley group preprint |
| 8 | Speculative Actions: A Lossless Framework for Faster Agentic Systems | https://arxiv.org/abs/2510.04371 | 2025-10-05, v2 2026-04-23 | Next-action prediction accuracy (<=55%) bounds gains (<=20% latency); explicit cost-latency analysis; "selective branch launching" prevents cost blowup | DISPATCH-SPECULATE-01: speculation pays only under selective, cost-bounded branching | preprint, multi-author |
| 9 | Cost-Aware Speculative Execution for LLM-Agent Workflows | https://arxiv.org/abs/2606.07846 | 2026-06-05 | Closed-form: expected-value rule "self-limits" as upstream branching factor grows; fires only on side-effect-free/idempotent edges | DISPATCH-SPECULATE-01 (self-limiting branch width) | single-author, SYNTHETIC validation only — LOW grade, flagged in doctrine |
| 10 | Verified Multi-Agent Orchestration (VMAO) | https://arxiv.org/abs/2603.11445 | 2026-03-12, v2 03-15, ICLR 2026 workshop MALGAI | Verbatim: "configurable stop conditions that balance answer quality against resource usage"; DAG decompose -> parallel -> LLM-verifier -> replan; completeness 3.1->4.2, source quality 2.6->4.1 (5-pt, 25 queries) | Verification-as-cost-line-item framing for triage economy | workshop paper |

Adjacent Tier-2 findings not in the exact set (recorded for provenance, cited
nowhere in doctrine): Task-Aware Delegation Cues (2603.11011 — HUMAN-agent
delegation stage, primary vs primary+auditor routing; over-reading as
LLM-orchestrator evidence was corrected), Intelligent AI Delegation (2602.11865 —
position paper: delegation = transfer of authority/responsibility/clear role
specifications), Diversity scaling (2602.03794 — saturation via output correlation
and intrinsic task uncertainty, complementary to selection-bottleneck; "judge
can't discriminate -> agents add noise" was snippet interpretation, DEMOTED).

## 2. Fork-debate verdict record (2026-07-11, full-history fork, adversarial)

Pre-finding: the original principle "complex logic is implemented by the
orchestrator" was in live contradiction with SPECIALIST-CRUX-01 (dispatch hard
derivations to specialists). Complexity was the wrong axis all along.

| # | Extension proposal | Verdict | Resolution |
| --- | --- | --- | --- |
| 1 | complexity -> specifiability x verifiability axes | AMEND | 3rd axis added: judgment ownership (collapse/crux verdicts stay main; re-derivation dispatchable) |
| 2 | context firewall (explorer as compression filter) | AMEND | allowed only with VERBATIM ANCHORS in returns (path:line quotes, figures, URLs) — else correlated blind spots between main and reviewer; folded into DISPATCH-TASK-01, not a new rule |
| 3 | speculative dispatch (phase N+1 during N) | REJECT default | narrow exception: phase-invariant EXTERNAL research only, quarantined `candidate — unverified`, discarded on plan amend (DISPATCH-SPECULATE-01 HEURISTIC) |
| 4 | bidirectional escalation ladder | AMEND | upward folded into DISPATCH-RETIRE-01 (two DISTINCT agents failing one packet = packet failed specifiability -> main reclaims); downward is a P-phase decision via loop-spec Escalation condition, never mid-B |
| 5 | triage cap ("as many as main can judge") | AMEND | unauditable self-report replaced by output-side DISPOSITION OBLIGATION (accept/reject/merge + one-line rationale before next wave; wave-granular allowed) |

Extra proposals adopted: (a) original principle rewritten as "verdicts are
main-owned, re-derivation is dispatchable"; (b) model-routing line as
non-overriding DEFAULT (preserves DIVERGE-TIER-01 tiers; DECORRELATE invariant =
family independence); (c) batch-spawn + single synthesis preference. Structural
finding: `pabcd/SKILL.md` `## Delegation Model (subagents)` was an empty header
with delegation rules misplaced under `## Catalog Discovery routing`; canonical
SOT stays doctrine §3 (the empty header was cheap real estate, not a second SOT).

## 3. Attribution-correction log (Tier-2 discipline receipts)

- MacNet "scaling horizon": demoted to snippet interpretation (not in abstract).
- 2602.03794 "judge discrimination bounds swarm value": demoted — original
  mechanism is output correlation + intrinsic task uncertainty.
- SearchSwarm "specifiability as explicit delegation criterion": corrected — the
  paper internalizes delegation decisions via SFT trajectories.
- Task-Aware Delegation Cues: stage corrected to human-agent teaming; routing is
  2-path (primary vs primary+auditor), not 3-path.
- ACON "largely preserving performance": corrected — abstract claims IMPROVING
  task success, a stronger statement than the snippet.
