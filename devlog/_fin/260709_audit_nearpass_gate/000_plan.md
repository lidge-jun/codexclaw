# 260709_audit_nearpass_gate — plan (000)

## Objective

Harden the PABCD A-phase into a real audit loop with a **main-as-judge near-pass
gate**, and make audit/reviewer dispatches carry `$cxc-search` by default.

Two observed failures (user report, 260709; evidence in `001_findings.md`):

1. Agents run exactly ONE audit round at A (dispatch reviewer, get verdict, move
   to B) even when the verdict names blockers — the audit->fix->re-audit loop
   never happens.
2. Audit dispatches rarely attach `$cxc-search`, so reviewers cannot verify
   references/versions/external claims through the search ladder.

## User steering decision (260709 session — recorded rationale)

- A hard reviewer-PASS requirement is REJECTED. The MAIN agent stays the judge.
- A verdict like `GO-WITH-FIXES; 2 blockers folded back` MUST be able to advance
  A>B when the main agent judges it near-pass (all blocking findings folded into
  the plan or explicitly rebutted).
- What the gate blocks is only: missing judgment, a declared `fail`, `near-pass`
  without a residual disposition, and the blatant contradiction case (pasted
  reviewer tail's final verdict line says FAIL while the attestation claims
  otherwise).
- This keeps the shipped form-only gate philosophy (attest.ts header: the
  adversary is the agent's own laziness, not a malicious human) — we add
  structure to the judgment, not NLP truth-checking of reviewer prose.

## Class call

C3 — public contract change on the A>B attest gate + always-on spawn hook
behavior + doctrine across two components; cross-session persistence risk.
Full plan + independent reviewer audit required.

## Loop-spec header

- Loop archetype: spec-satisfaction repair.
- Trigger: user decision (see steering above).
- Goal: gate + doctrine + attachment changes land, suites green.
- Non-goals: C>D gate semantics, NLP verdict parsing beyond the tail tripwire,
  installed-plugin-cache sync (`~/.codex/plugins/...`), `cli/`, `docs-site/`,
  and `structure/` rewrites EXCEPT the surgical A->B contract sync in
  `structure/20_pabcd_dispatch_doctrine.md` (audit round 1 blocker B2 —
  SOT-SYNC-01).
- Verifier: `npm test` (node --test) in `plugins/codexclaw/components/pabcd-state`
  and `plugins/codexclaw/components/subagent-config`; then root `npm run build`
  (regenerates committed dist — audit round 1 blocker B1) and root `npm test`
  (includes `plugins/codexclaw/test/dist-freshness.test.mjs`); `rg` for
  doctrine markers.
- Stop condition: acceptance criteria c1-c6 met (goalplan
  `implement-the-260709-audit-nearpass-gate-unit-ha`).
- Memory artifact: this unit + the bound goalplan + `.codexclaw/ledger.jsonl`.
- Expected terminal outcomes: DONE; BLOCKED/NEEDS_HUMAN if an out-of-scope
  consumer depends on the old gate shape.
- Escalation: any weakening of completion criteria -> user.
- HOTL resource bounds: write scope =
  `plugins/codexclaw/skills/{pabcd,dev-code-reviewer,search,loop}/SKILL.md`,
  `plugins/codexclaw/components/{pabcd-state,subagent-config}/{src,test}`,
  `plugins/codexclaw/components/{pabcd-state,subagent-config}/dist/` (generated
  at C by root `npm run build`, MAIN session only — workers never touch dist/),
  `structure/20_pabcd_dispatch_doctrine.md` (surgical A->B bullet only),
  `devlog/_plan/260709_audit_nearpass_gate/`, `.codexclaw/goalplans/...`;
  tools = local edits, `node --test`, gpt-5.5 subagents (user-granted
  unlimited); wall-clock = this working session.

## Design summary

### D1 — Verdict taxonomy + main-as-judge gate (A>B)

`Attestation` gains three fields:

- `auditVerdict` — `"pass" | "near-pass" | "fail"`, REQUIRED on A>B. This is
  the MAIN agent's own judgment of the current audit round, not a parse of the
  reviewer's prose.
- `auditResidual` — REQUIRED when `auditVerdict === "near-pass"`: names each
  residual blocker and its disposition (folded into plan / rebutted with
  rationale). Example: `GO-WITH-FIXES; 2 blockers folded back: (1) rollback gap
  -> plan section 4 amended, (2) phantom constant -> rebutted, constant exists at
  src/x.ts:12`.
- `auditRounds` — optional number, ledger trail only (never gates).

Gate rules (validateAttest, `A>B` branch, in order):

1. `auditOutput` missing -> reject (unchanged).
2. `auditVerdict` missing or not in the enum -> reject, reason teaches the enum
   and the loop rule.
3. `auditVerdict === "fail"` -> reject: synthesize (REVIEW-SYNTHESIS-01), amend
   plan, re-audit with the SAME reviewer; LOOP-REPAIR-01 bound (3 failed rounds
   -> back to P).
4. `near-pass` without `auditResidual` -> reject.
5. FAIL-tail tripwire: the LAST 5 non-empty lines of `auditOutput` matching
   are scanned for verdict-shaped lines (`/^verdict\s*[:=]/i`); only when the
   LAST such line says FAIL while the attestation claims pass/near-pass ->
   reject (audit round 1 M1: an earlier `VERDICT: FAIL` corrected by a final
   `VERDICT: PASS` must not trip). Free-text FAIL mentions mid-output never
   trip (reviewers that do not emit a normalized verdict line are unaffected —
   the tripwire arms progressively as the 010 doctrine contract propagates).

### D2 — Audit loop doctrine (AUDIT-LOOP-01)

pabcd SKILL.md §A states the loop explicitly: audit -> synthesize -> amend plan
-> re-audit until pass or main-judged near-pass; FAIL never exits; same-reviewer
reuse (`send_input`/`resume_agent`); bounded by LOOP-REPAIR-01. The dispatch
packet attaches `$cxc-dev-code-reviewer` AND `$cxc-search` and demands a
normalized final line `VERDICT: PASS | GO-WITH-FIXES (blockers=N) | FAIL`.

### D3 — Reviewer search baseline

`ROLE_BASE_SKILLS.reviewer` gains `"search"` in spawn-wrapper.ts. The existing
REVIEW_KEYWORDS role inference (spawn-attach-hook.ts `inferRole`) already
upgrades audit-worded spawns to `reviewer`, so the always-on hook then attaches
`$cxc-search` automatically. SEARCH-ATTACH-01 is extended to name A-gate audit
dispatches in scope.

## Phase map (dependency-ordered, DIFFLEVEL-ROADMAP-01)

| Doc | Phase | Owns |
|-----|-------|------|
| `010_phase1_doctrine_audit_loop.md` | contract | `skills/pabcd/SKILL.md`, `skills/dev-code-reviewer/SKILL.md`, `skills/loop/SKILL.md` |
| `020_phase2_attest_nearpass_gate.md` | enforcement | `components/pabcd-state/{src/attest.ts,src/hook.ts,test/*}` |
| `030_phase3_reviewer_search_baseline.md` | attachment | `components/subagent-config/{src/spawn-wrapper.ts,test/*}`, `skills/search/SKILL.md` |

010 defines the verdict taxonomy 020 enforces; 030 is independent of 020 but
echoes 010's attachment requirement. B may run 010/020/030 as parallel workers
with the disjoint write scopes above (DISPATCH-ISOLATION-01).

## Acceptance criteria (mirror of goalplan c1-c6)

- c1 fail-reject: `auditVerdict:"fail"` rejected with re-audit guidance.
- c2 near-pass: `near-pass` + residual advances (the user's GO-WITH-FIXES; 2
  blockers scenario); `near-pass` without residual rejected.
- c3 FAIL-tail: tail verdict-line contradiction rejected; mid-text FAIL mention
  does not trip.
- c4 search attach: audit-worded spawn message auto-attaches `$cxc-search`.
- c5 doctrine markers grep-verifiable (AUDIT-LOOP-01, VERDICT line, SEARCH-ATTACH
  extension, loop pointer).
- c6 unit docs 000/001/010/020/030 present.
- c7 dist freshness: root `npm run build` run at C and root `npm test`
  (dist-freshness included) green; `structure/20_pabcd_dispatch_doctrine.md`
  A->B bullet synced to the new contract.

## Compatibility notes

- Requiring `auditVerdict` is a behavior change for every A>B caller. In-scope
  callers to update: `STOP_NEXT_COMMAND.A` example (hook.ts), pabcd SKILL.md
  §Control surfaces text, tests. The gate's reject reason teaches the new field,
  so out-of-repo agents self-correct in one retry (fail-closed, self-describing).
- Runtime entrypoints are committed compiled dist (`structure/INDEX.md:180,186,234`);
  `plugins/codexclaw/test/dist-freshness.test.mjs` fails stale dist. C therefore
  runs root `npm run build` before the root suite (audit round 1 B1).
- The repo copy under `plugins/codexclaw/` is the source of truth; the RUNNING
  session's hooks load from the installed cache (`~/.codex/plugins/cache/...`),
  so nothing in this unit hot-modifies the live session. Cache sync is a
  release-flow concern, out of scope here.
