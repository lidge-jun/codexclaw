# 011 - A-Gate Audit Synthesis (Round 1)

Reviewer: explorer subagent 019f3982-6161 (gpt-5.5 xhigh, "Nietzsche"), read-only.
Verdict: 5 findings (4x P2, 1x P3). All five ACCEPTED. Plan patched in the same
round; re-audit of changed sections requested from the same reviewer.

## Triage

- F1 (initiative full-text ownership) ACCEPT. The reference file claims canonical
  full text while 11.6/11.7 full text is router-resident. Fix: the appended 11.8
  in loop-engineering.md is preceded by explicit stub headers for 11.6/11.7 that
  point to the router index, so a reference-file reader cannot miss them. No
  existing wording changed (stays in scope).
- F2 (cli-jaw ordering) ACCEPT. Own coordinate check confirmed 11.6 at :477 and
  11.7 at :486. Fix: insertion point is after 11.7 at end of file (500 lines),
  preserving numeric order.
- F3 (Tier-1 gate weaker than provenance doctrine) ACCEPT. Fix in canonical
  text: collapse gate = N candidate docs with filled front-matter AND per-
  candidate provenance per existing divergence doctrine (repo-evidence path or
  search-provenance source). Tier 1 tightens 11.7; it must not silently relax it.
- F4 (minds are not candidate authors) ACCEPT. Minds are interview-time
  contradiction lenses (minds.ts:9,61). Fix: codexclaw adaptation names native
  explorer subagents as Tier-1 candidate authors; minds appear only as an
  optional blindspot lens during I. Canonical text keeps the generic word
  "explorers" and never assigns doc-writing to minds.
- F5 (CLI has no front-matter fields) ACCEPT (P3). Fix: front-matter lives in
  the candidate DOC file; `cxc divergence candidate add` records the archive row
  (kind/title/rationale/--source) alongside. Guidance must not imply the CLI
  stores front-matter.

## Plan Deviations Logged

010_plan.md updated in place: canonical text (gate + provenance sentence,
explorer wording), R1 stub-header fix, R2 insertion point, R4 minds/CLI wording.

## Rounds 2-3

- Round 2 (same reviewer): F1-F5 all RESOLVED with line evidence; one new P3 -
  R3 jawcode compact clause lagged the tightened Tier-1 gate. VERDICT: ITERATE.
- Fix: R3 clause now carries "docs present WITH per-candidate provenance".
- Round 3 (same reviewer): P3 RESOLVED at 010_plan.md:92. FINDINGS: 0.
  VERDICT: OKAY. A gate passed; reviewer closed (contaminated for final C gate;
  C will use fresh per-repo reviewers).
