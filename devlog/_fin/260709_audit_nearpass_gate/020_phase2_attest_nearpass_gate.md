# 020 — Phase 2: attest near-pass gate (enforcement)

Write scope (disjoint): `plugins/codexclaw/components/pabcd-state/src/attest.ts`,
`plugins/codexclaw/components/pabcd-state/src/hook.ts`,
`plugins/codexclaw/components/pabcd-state/test/*.ts`. Nothing else.

Depends on 010's verdict taxonomy (doctrine names the same enum). Must NOT
change C>D semantics or the FSM shape.

## 1. src/attest.ts — MODIFY

### 1a. Types

After the existing `Phase` import, add:

```ts
/** A->B: the MAIN agent's structured judgment of the audit round (AUDIT-LOOP-01). */
export type AuditVerdict = "pass" | "near-pass" | "fail";
export const AUDIT_VERDICTS: ReadonlySet<string> = new Set(["pass", "near-pass", "fail"]);
```

Extend `Attestation` after `auditOutput?: string;`:

```ts
  /** A->B only (REQUIRED): the main agent's own judgment of this audit round —
   *  NOT a parse of reviewer prose. "fail" never advances (AUDIT-LOOP-01). */
  auditVerdict?: string;
  /** A->B only (REQUIRED when auditVerdict === "near-pass"): each residual
   *  blocker + its disposition (folded into plan / rebutted with rationale). */
  auditResidual?: string;
  /** A->B optional: audit rounds run this phase; ledger trail only, never gates. */
  auditRounds?: number;
```

### 1b. coerceAttest — add after the `auditOutput` coercion line

```ts
  if (typeof rec.auditVerdict === "string") att.auditVerdict = rec.auditVerdict.trim().toLowerCase();
  if (typeof rec.auditResidual === "string") att.auditResidual = rec.auditResidual.trim();
  if (typeof rec.auditRounds === "number" && Number.isFinite(rec.auditRounds)) {
    att.auditRounds = rec.auditRounds;
  }
```

### 1c. FAIL-tail tripwire helper (module-local, exported for tests)

```ts
/** True when the LAST verdict-shaped line among the final 5 non-empty lines is
 *  FAIL. An earlier `VERDICT: FAIL` corrected by a later final `VERDICT: PASS`
 *  does not trip (audit round 1 M1); free-text FAIL mentions never trip. */
export function hasFailVerdictTail(auditOutput: string): boolean {
  const lines = auditOutput.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const verdictLines = lines.slice(-5).filter((l) => /^verdict\s*[:=]/i.test(l));
  if (verdictLines.length === 0) return false;
  return /^verdict\s*[:=]\s*fail\b/i.test(verdictLines[verdictLines.length - 1]);
}
```

### 1d. validateAttest `A>B` branch — replace the existing single check with, in order:

```ts
  if (key === "A>B") {
    if (!att.auditOutput) {
      return { ok: false, reason: `A -> B additionally requires "auditOutput": paste the tail of the independent reviewer verdict you actually received. Dispatch a reviewer subagent (even a small/mini-model one) at the A gate; a self-written sentence is not an audit.` };
    }
    if (!att.auditVerdict || !AUDIT_VERDICTS.has(att.auditVerdict)) {
      return { ok: false, reason: `A -> B additionally requires "auditVerdict": "pass" | "near-pass" | "fail" — YOUR OWN judgment of this audit round (AUDIT-LOOP-01). "fail" never advances; "near-pass" means every blocking finding was folded into the plan or explicitly rebutted (also supply "auditResidual").` };
    }
    if (att.auditVerdict === "fail") {
      return { ok: false, reason: `A -> B is blocked: you judged this audit round "fail". Synthesize the blockers (REVIEW-SYNTHESIS-01), amend the plan, and re-audit with the SAME reviewer (send_input / resume_agent). Re-attest with "pass" or "near-pass" once only folded/rebutted residuals remain; after 3 failed rounds return to P with a changed plan (LOOP-REPAIR-01).` };
    }
    if (att.auditVerdict === "near-pass" && !att.auditResidual) {
      return { ok: false, reason: `A -> B with "near-pass" additionally requires "auditResidual": name each residual blocker and its disposition (folded into plan / rebutted with rationale), e.g. "GO-WITH-FIXES; 2 blockers folded back: (1) ..., (2) ...".` };
    }
    if (hasFailVerdictTail(att.auditOutput)) {
      return { ok: false, reason: `The pasted auditOutput tail ends with a FAIL verdict line, contradicting auditVerdict="${att.auditVerdict}". Run another audit round (same reviewer) and paste the round that actually reached PASS / GO-WITH-FIXES — or attest "fail" and keep looping (AUDIT-LOOP-01).` };
    }
  }
```

Header comment of the file: extend the A->B sentence to mention the judgment
fields (keep the form-only framing).

## 2. src/hook.ts — MODIFY (two sites)

### 2a. Phase directive `A:` (~line 159)

Replace the array with:

```ts
  A: [
    "[codexclaw: AUDIT]",
    "Audit the plan adversarially before building. Dispatch an independent reviewer",
    "(sub-agent) to challenge assumptions, find blockers, and verify references. If",
    "spawn_agent is not in your visible tools, tool_search for it first (the",
    "multi_agent_v1.* collab tools are deferred). Attach the discipline as $cxc mentions",
    "in the spawn message ($cxc-dev-code-reviewer AND $cxc-search plus the matching",
    "$cxc-dev-* surface skill); the spawn-attach hook fills in missing baselines. Ask",
    "the reviewer to end with a final line: VERDICT: PASS | GO-WITH-FIXES (blockers=N)",
    "| FAIL. A is a loop (AUDIT-LOOP-01): on FAIL, synthesize (REVIEW-SYNTHESIS-01),",
    "amend the plan, re-audit with the SAME reviewer; advance only when YOU judge the",
    "round pass or near-pass (all blocking findings folded into the plan or rebutted).",
  ].join("\n"),
```

### 2b. `STOP_NEXT_COMMAND.A` (~line 538)

Replace with:

```ts
  A: '`cxc orchestrate B --attest \'{"from":"A","to":"B","did":"audit loop closed: blockers folded into plan","auditOutput":"<reviewer verdict tail>","auditVerdict":"pass|near-pass","auditResidual":"<near-pass only: residual blockers + disposition>"}\'`',
```

## 3. Tests — MODIFY/ADD

### test/attest.test.ts

- UPDATE the existing WP3 test: `auditOutput` alone must now FAIL with
  `/auditVerdict/`; the passing case becomes
  `{ auditOutput: "reviewer: GO-WITH-FIXES; 2 blockers folded back", auditVerdict: "near-pass", auditResidual: "2 blockers folded back: (1) rollback gap -> plan amended, (2) phantom constant -> rebutted" }`.
- ADD `A->B auditVerdict=fail is rejected with re-audit guidance` — expect
  `ok:false`, reason matches `/SAME reviewer/` and `/LOOP-REPAIR-01/`.
- ADD `A->B near-pass without auditResidual is rejected` — reason matches
  `/auditResidual/`.
- ADD `A->B pass with clean output advances` — `auditVerdict:"pass"`,
  `auditOutput` ending `VERDICT: PASS` -> `ok:true`.
- ADD FAIL-tail tripwire tests:
  `auditOutput: "...\nVERDICT: FAIL"` + `auditVerdict:"pass"` -> rejected,
  reason matches `/contradict/i`;
  `auditOutput: "scanned for FAIL markers; none apply\nVERDICT: PASS"` +
  `auditVerdict:"pass"` -> `ok:true` (mid-text mention does not trip);
  `auditOutput: "VERDICT: FAIL\nround 2 after fixes:\nVERDICT: PASS"` +
  `auditVerdict:"pass"` -> `ok:true` (last verdict line wins — M1);
  direct unit tests for `hasFailVerdictTail` (tail hit true / mid-text false /
  `verdict = fail` true / >5-lines-above-tail false / FAIL-then-final-PASS false).
- UPDATE `coerceAttest` test: verify `auditVerdict: " NEAR-PASS "` coerces to
  `"near-pass"`, `auditResidual` trims, `auditRounds: 2` survives, and a
  non-numeric `auditRounds` is dropped.

### test/orchestrate-cli.test.ts

- UPDATE the A>B attest JSON (~line 89) to add
  `"auditVerdict":"pass"` (keep `auditOutput`).
- ADD one CLI-level rejection: A>B attest carrying `"auditVerdict":"fail"`
  exits non-zero / prints the blocked reason (follow the file's existing
  assertion style for gate failures).

### Other pabcd-state tests

- `rg -n "independent audit PASS|GO; refs verified|auditOutput" test/` and
  update any assertion pinning the OLD directive/example strings
  (hook-continuation.test.ts asserts STOP_NEXT_COMMAND text — update to the new
  A example if it pins it).

## Verification (phase-local)

```sh
cd plugins/codexclaw/components/pabcd-state && npm test
```

All tests green; new tests present for c1/c2/c3. dist/ is NOT rebuilt in this
phase: the MAIN session runs root `npm run build` + root `npm test`
(dist-freshness) at C (audit round 1 B1) — workers never touch dist/.
