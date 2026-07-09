/**
 * attest.ts — plugin-native structural evidence gate for forward PABCD transitions.
 *
 * Ported from cli-jaw orchestrator/attestation.ts (form-only gate): the adversary is
 * the agent's own laziness/hallucination, not a malicious human. The gate forces the
 * agent to commit to a specific `did` narrative; for A->B to paste the independent
 * reviewer's verdict (`auditOutput` — WP3, so the Audit gate structurally requires a
 * dispatched reviewer, not a self-written sentence) plus the main agent's structured
 * judgment fields; and for C->D to paste real command output with a passing exit code.
 * A boolean is NOT accepted as evidence (cheaper to hallucinate than prose), so the
 * audit/check flags can only flip true through here.
 *
 * No server, no IO: pure validation. Callers (cli.ts / orchestrate) persist the
 * resulting flags via state.writeState. This is the runtime enforcement that 007 R-2
 * demands — the evidence gate must be structural, not prompt prose.
 */


/** A->B: the MAIN agent's structured judgment of the audit round (AUDIT-LOOP-01). */

export const AUDIT_VERDICTS                      = new Set(["pass", "near-pass", "fail"]);

























/**
 * Forward dev transitions that require a valid attestation to advance (L2/020).
 * Ported to full cli-jaw parity: all four forward edges P>A, A>B, B>C, C>D are
 * gated. C>D additionally needs `checkOutput` + a passing `exitCode`. Backward
 * edges (C>B, C>P), interview entry, and D>IDLE close are NOT gated.
 */
export const GATED_TRANSITIONS                      = new Set(["P>A", "A>B", "B>C", "C>D"]);

/** Obvious placeholders that do not count as a real narrative. */
const PLACEHOLDER_DID = /^(tbd|todo|n\/?a|none|done|ok|\.+|-+)$/i;






/**
 * Coerce an arbitrary parsed object (e.g. from --attest JSON) into an Attestation,
 * or null when from/to are not valid phases. A missing `did` still coerces (did:'')
 * so validateAttest can return a clear "did is required" reason.
 */
export function coerceAttest(obj         )                     {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const rec = obj                           ;
  const from = rec.from;
  const to = rec.to;
  if (typeof from !== "string" || typeof to !== "string") return null;
  const att              = {
    from: from         ,
    to: to         ,
    did: typeof rec.did === "string" ? rec.did.trim() : "",
  };
  if (typeof rec.auditOutput === "string") att.auditOutput = rec.auditOutput.trim();
  if (typeof rec.auditVerdict === "string") att.auditVerdict = rec.auditVerdict.trim().toLowerCase();
  if (typeof rec.auditResidual === "string") att.auditResidual = rec.auditResidual.trim();
  if (typeof rec.auditRounds === "number" && Number.isFinite(rec.auditRounds)) {
    att.auditRounds = rec.auditRounds;
  }
  if (typeof rec.checkOutput === "string") att.checkOutput = rec.checkOutput.trim();
  if (typeof rec.exitCode === "number" && Number.isFinite(rec.exitCode)) {
    att.exitCode = rec.exitCode;
  }
  if (typeof rec.override === "boolean") {
    att.override = rec.override;
  }
  return att;
}

/** True when the LAST verdict-shaped line among the final 5 non-empty lines is
 *  FAIL. An earlier `VERDICT: FAIL` corrected by a later final `VERDICT: PASS`
 *  does not trip (audit round 1 M1); free-text FAIL mentions never trip. */
export function hasFailVerdictTail(auditOutput        )          {
  const lines = auditOutput.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const verdictLines = lines.slice(-5).filter((l) => /^verdict\s*[:=]/i.test(l));
  if (verdictLines.length === 0) return false;
  return /^verdict\s*[:=]\s*fail\b/i.test(verdictLines[verdictLines.length - 1]);
}

/**
 * Form-only transition gate. Only the gated forward transitions require an
 * attestation; everything else returns ok. Fail-closed: a missing/placeholder
 * narrative or a failing C->D check is rejected.
 */
export function validateAttest(from       , to       , att                    )               {
  const key = `${from}>${to}`;
  if (!GATED_TRANSITIONS.has(key)) return { ok: true };

  if (!att) {
    return {
      ok: false,
      reason: `${from} -> ${to} requires an attestation with a non-empty "did". Pass --attest '{"from":"${from}","to":"${to}","did":"..."}'.`,
    };
  }
  if (att.from !== from || att.to !== to) {
    return {
      ok: false,
      reason: `Attestation from/to (${att.from}->${att.to}) does not match the requested transition ${from}->${to}.`,
    };
  }
  if (!att.did || PLACEHOLDER_DID.test(att.did)) {
    return {
      ok: false,
      reason: `${from} -> ${to} needs a specific "did" narrative (not empty or a placeholder).`,
    };
  }
  if (key === "A>B") {
    if (!att.auditOutput) {
      return {
        ok: false,
        reason: `A -> B additionally requires "auditOutput": paste the tail of the independent reviewer verdict you actually received. Dispatch a reviewer subagent (even a small/mini-model one) at the A gate; a self-written sentence is not an audit.`,
      };
    }
    if (!att.auditVerdict || !AUDIT_VERDICTS.has(att.auditVerdict)) {
      return { ok: false, reason: `A -> B additionally requires "auditVerdict": "pass" | "near-pass" | "fail" — YOUR OWN judgment of this audit round (AUDIT-LOOP-01). "fail" never advances; "near-pass" means every blocking finding was folded into the plan or explicitly rebutted (also supply "auditResidual").` };
    }
    if (att.auditVerdict === "fail") {
      return { ok: false, reason: `A -> B is blocked: you judged this audit round "fail". Synthesize the blockers (REVIEW-SYNTHESIS-01), amend the plan, and re-audit with the SAME reviewer (v2: followup_task to its task_name; send_message for context-only). Re-attest with "pass" or "near-pass" once only folded/rebutted residuals remain; after 3 failed rounds return to P with a changed plan (LOOP-REPAIR-01).` };
    }
    if (att.auditVerdict === "near-pass" && !att.auditResidual) {
      return { ok: false, reason: `A -> B with "near-pass" additionally requires "auditResidual": name each residual blocker and its disposition (folded into plan / rebutted with rationale), e.g. "GO-WITH-FIXES; 2 blockers folded back: (1) ..., (2) ...".` };
    }
    if (hasFailVerdictTail(att.auditOutput)) {
      return { ok: false, reason: `The pasted auditOutput tail ends with a FAIL verdict line, contradicting auditVerdict="${att.auditVerdict}". Run another audit round (same reviewer) and paste the round that actually reached PASS / GO-WITH-FIXES — or attest "fail" and keep looping (AUDIT-LOOP-01).` };
    }
  }
  if (key === "C>D") {
    if (!att.checkOutput) {
      return {
        ok: false,
        reason: `C -> D additionally requires "checkOutput": paste the tail of the test/tsc command you actually ran.`,
      };
    }
    if (typeof att.exitCode === "number" && att.exitCode !== 0) {
      return {
        ok: false,
        reason: `C -> D requires a passing check, but the attestation reports exitCode ${att.exitCode}. Fix the failure (orchestrate B) before advancing.`,
      };
    }
  }
  return { ok: true };
}
