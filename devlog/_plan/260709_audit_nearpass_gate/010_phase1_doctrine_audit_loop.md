# 010 — Phase 1: doctrine contract (AUDIT-LOOP-01 + verdict line)

Write scope (disjoint): `plugins/codexclaw/skills/pabcd/SKILL.md`,
`plugins/codexclaw/skills/dev-code-reviewer/SKILL.md`,
`plugins/codexclaw/skills/loop/SKILL.md`,
`structure/20_pabcd_dispatch_doctrine.md` (surgical A->B bullet only — audit
round 1 B2). Nothing else.

## 1. pabcd/SKILL.md §A (line 131) — MODIFY

In the A-phase paragraph (the numbered item `2. **A — Audit**`), replace the
sentence pair:

```text
Fold fixes back into the plan and record the verdict. No code changes.
```

with:

```text
**Audit loop (STRICT, AUDIT-LOOP-01):** A is a loop — audit -> synthesize ->
amend plan -> re-audit — not a single round. Exit A>B only when the MAIN agent
judges the round **pass** (reviewer approved) or **near-pass**: every
High/Critical blocker was folded into the plan as a concrete amendment or
explicitly rebutted with recorded rationale, and only non-blocking residuals
remain (`GO-WITH-FIXES; 2 blockers folded back` qualifies — the main agent is
the judge, not a string parser). A FAIL round never exits: apply
REVIEW-SYNTHESIS-01 (§11.3), amend the plan, and re-audit with the SAME
reviewer (`send_input`/`resume_agent`, DISPATCH-ACTOR-01); LOOP-REPAIR-01
bounds the loop — after 3 failed rounds return to P with a changed plan (HITL
may return to Interview). The dispatch packet attaches `$cxc-dev-code-reviewer`
AND `$cxc-search` (reference/version/external-claim verification rides the
search ladder) and instructs the reviewer to end with a normalized final line
`VERDICT: PASS | GO-WITH-FIXES (blockers=N) | FAIL` plus numbered blockers.
No code changes.
```

Then extend the same paragraph's closing form-only sentence. Replace:

```text
The `A>B` attest structurally requires `auditOutput` (the pasted tail of the
reviewer's verdict) — a form-only bar: silently skipping the paste fails the
gate, but the gate cannot verify the paste's provenance, so faithful execution
(really dispatching the reviewer) remains the agent's obligation.
```

with:

```text
The `A>B` attest structurally requires `auditOutput` (the pasted tail of the
reviewer's verdict) plus `auditVerdict` (`pass|near-pass|fail` — the MAIN
agent's own judgment of the round); `near-pass` additionally requires
`auditResidual` naming each residual blocker and its disposition
(folded/rebutted). A declared `fail` never advances, and a pasted tail whose
final verdict line says FAIL is rejected regardless of the claimed judgment.
Still a form-only bar: the gate cannot verify the paste's provenance, so
faithful execution (really dispatching the reviewer, really looping) remains
the agent's obligation.
```

Keep line 132 ("When the verdict is FAIL, fold-back follows
REVIEW-SYNTHESIS-01...") unchanged — it now reads as the FAIL branch of
AUDIT-LOOP-01.

### Also MODIFY §Control surfaces (Terminal bullet, ~line 96)

Replace:

```text
`A>B` additionally needs `auditOutput` (reviewer verdict tail) and `C>D`
```

with:

```text
`A>B` additionally needs `auditOutput` (reviewer verdict tail) + `auditVerdict`
(`pass|near-pass|fail`; `near-pass` also needs `auditResidual`) and `C>D`
```

### Also MODIFY §Per-phase artifact obligation (ORCH-ARTIFACT-01, ~line 79)

Replace:

```text
A = an audit/review verdict that names blockers (`A>B` attest requires a non-empty
`auditOutput` — the pasted tail of the dispatched reviewer subagent's verdict); B = the
```

with:

```text
A = an audit/review verdict that names blockers (`A>B` attest requires a non-empty
`auditOutput` — the pasted tail of the dispatched reviewer subagent's verdict — plus
the main agent's `auditVerdict` judgment, AUDIT-LOOP-01); B = the
```

## 2. dev-code-reviewer/SKILL.md §Output Contract (REVIEW-OUTPUT-01, ~line 102) — MODIFY

After the sentence ending "...then a dedicated `blocking_issues` block; verdict
last." append to the same paragraph:

```text
For dispatched plan-audit (PABCD A-gate) reviews the verdict is additionally
machine-scannable: end the reply with a final line `VERDICT: PASS`,
`VERDICT: GO-WITH-FIXES (blockers=N)`, or `VERDICT: FAIL` (mapping:
Approve -> PASS; Approve-with-suggestions -> GO-WITH-FIXES; Request-changes /
Block -> FAIL). The dispatching agent's exit rule is AUDIT-LOOP-01
(`cxc-pabcd` §A): FAIL always triggers another round.
```

## 3. loop/SKILL.md §Repair-loop discipline — MODIFY

In the `REVIEW-SYNTHESIS-01 (pointer)` bullet, after "Canonical wording:
`cxc-pabcd` §11.3." append:

```text
A-gate exit follows AUDIT-LOOP-01 (`cxc-pabcd` §A): only pass or main-judged
near-pass exits A>B; FAIL re-enters the audit loop with the same reviewer.
```

## 4. structure/20_pabcd_dispatch_doctrine.md (~line 73) — MODIFY (SOT sync, B2)

Replace the bullet:

```text
- A->B additionally requires a pasted `auditOutput` (the dispatched reviewer subagent's
  verdict tail — WP3), so the Audit gate structurally needs a real reviewer dispatch.
```

with:

```text
- A->B additionally requires a pasted `auditOutput` (the dispatched reviewer subagent's
  verdict tail — WP3) plus `auditVerdict` (`pass|near-pass|fail`, the MAIN agent's own
  judgment; `near-pass` also needs `auditResidual` naming each residual blocker's
  disposition). A declared `fail` never advances, and a tail whose final verdict line
  says FAIL is rejected (AUDIT-LOOP-01) — the Audit gate structurally needs a real
  reviewer dispatch AND a judged loop exit.
```

## Verification (phase-local)

- `rg -n "AUDIT-LOOP-01" plugins/codexclaw/skills/pabcd/SKILL.md` -> >= 2 hits
  (§A + artifact obligation).
- `rg -n "VERDICT: PASS" plugins/codexclaw/skills/{pabcd,dev-code-reviewer}/SKILL.md`
  -> 1 hit each.
- `rg -n "AUDIT-LOOP-01" plugins/codexclaw/skills/loop/SKILL.md` -> 1 hit.
- `rg -n "auditVerdict" structure/20_pabcd_dispatch_doctrine.md` -> 1 hit.
