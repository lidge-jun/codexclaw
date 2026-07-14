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
import type { Phase } from "./state.ts";

/** A->B: the MAIN agent's structured judgment of the audit round (AUDIT-LOOP-01). */
export type AuditVerdict = "pass" | "near-pass" | "fail";
export const AUDIT_VERDICTS: ReadonlySet<string> = new Set(["pass", "near-pass", "fail"]);

export interface Attestation {
  from: Phase;
  to: Phase;
  /** Required narrative of what the agent actually did this phase (NOT a boolean). */
  did: string;
  /** A->B only: pasted tail of the independent reviewer's verdict (the dispatched
   *  audit subagent's returned findings). */
  auditOutput?: string;
  /** A->B only (REQUIRED): the main agent's own judgment of this audit round —
   *  NOT a parse of reviewer prose. "fail" never advances (AUDIT-LOOP-01). */
  auditVerdict?: string;
  /** A->B only (REQUIRED when auditVerdict === "near-pass"): each residual
   *  blocker + its disposition (folded into plan / rebutted with rationale). */
  auditResidual?: string;
  /** A->B optional: audit rounds run this phase; ledger trail only, never gates. */
  auditRounds?: number;
  /** C->D only: pasted tail of the actual tsc/test command output. */
  checkOutput?: string;
  /** Optional exit code; if present and non-zero, C->D is rejected. */
  exitCode?: number;
  /** 131/D2': human I->P soft-gate override. True = "I accept the unready interview". */
  override?: boolean;
  /** P>A (260714 wp2): devlog plan unit dir, e.g. "devlog/_plan/260714_slug". Verified on disk by plan-gate.ts. */
  planUnit?: string;
  /** P>A (260714 wp2): plan doc paths this loop's work-phases execute from. Verified on disk by plan-gate.ts. */
  planPaths?: string[];
  /** Gated edges (260714 wp4): the ONE work-phase this cycle advances. Must match the
   *  bound goalplan's effective active work-phase (LOOP-UNIT-CHAIN-01 binding). */
  workPhaseId?: string;
}

/**
 * Forward dev transitions that require a valid attestation to advance (L2/020).
 * Ported to full cli-jaw parity: all four forward edges P>A, A>B, B>C, C>D are
 * gated. C>D additionally needs `checkOutput` + a passing `exitCode`. Backward
 * edges (C>B, C>P), interview entry, and D>IDLE close are NOT gated.
 */
export const GATED_TRANSITIONS: ReadonlySet<string> = new Set(["P>A", "A>B", "B>C", "C>D"]);

/** Obvious placeholders that do not count as a real narrative. */
const PLACEHOLDER_DID = /^(tbd|todo|n\/?a|none|done|ok|\.+|-+)$/i;

export interface AttestResult {
  ok: boolean;
  reason?: string;
}

/**
 * Coerce an arbitrary parsed object (e.g. from --attest JSON) into an Attestation,
 * or null when from/to are not valid phases. A missing `did` still coerces (did:'')
 * so validateAttest can return a clear "did is required" reason.
 */
export function coerceAttest(obj: unknown): Attestation | null {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const rec = obj as Record<string, unknown>;
  const from = rec.from;
  const to = rec.to;
  if (typeof from !== "string" || typeof to !== "string") return null;
  const att: Attestation = {
    from: from as Phase,
    to: to as Phase,
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
  if (typeof rec.planUnit === "string") att.planUnit = rec.planUnit.trim();
  if (Array.isArray(rec.planPaths)) {
    const paths = rec.planPaths.filter((p): p is string => typeof p === "string").map((p) => p.trim()).filter((p) => p.length > 0);
    if (paths.length > 0) att.planPaths = paths;
  }
  if (typeof rec.workPhaseId === "string") att.workPhaseId = rec.workPhaseId.trim();
  return att;
}

/** True when the LAST verdict-shaped line among the final 5 non-empty lines is
 *  FAIL. An earlier `VERDICT: FAIL` corrected by a later final `VERDICT: PASS`
 *  does not trip (audit round 1 M1); free-text FAIL mentions never trip. */
export function hasFailVerdictTail(auditOutput: string): boolean {
  const lines = auditOutput.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const verdictLines = lines.slice(-5).filter((l) => /^verdict\s*[:=]/i.test(l));
  if (verdictLines.length === 0) return false;
  return /^verdict\s*[:=]\s*fail\b/i.test(verdictLines[verdictLines.length - 1]);
}

/**
 * 260714 wp4 (LOOP-UNIT-CHAIN-01): pure work-phase binding check for gated edges.
 * `activeWorkPhaseId` is the bound goalplan's EFFECTIVE active work-phase (computed
 * by the caller via goalplan.effectiveActiveWorkPhaseId, fail-open null on IO/parse
 * failure or when no goalplan is bound). Null → ok keeps HITL sessions unchanged;
 * the delete/corrupt/unbound evasion class is accepted per this module's threat
 * model (adversary is laziness, not malice).
 */
export function validateWorkPhaseBinding(att: Attestation | null, activeWorkPhaseId: string | null): AttestResult {
  if (activeWorkPhaseId == null) return { ok: true };
  if (!att?.workPhaseId) {
    return {
      ok: false,
      reason: `A goalplan is bound (active work-phase ${activeWorkPhaseId}); pass "workPhaseId" in the attest. One work-phase = one full PABCD cycle (LOOP-UNIT-CHAIN-01).`,
    };
  }
  if (att.workPhaseId !== activeWorkPhaseId) {
    return {
      ok: false,
      reason: `attest.workPhaseId=${att.workPhaseId} but the active work-phase is ${activeWorkPhaseId}. Close this cycle through D before touching another unit (LOOP-UNIT-CHAIN-01).`,
    };
  }
  return { ok: true };
}

/**
 * Form-only transition gate. Only the gated forward transitions require an
 * attestation; everything else returns ok. Fail-closed: a missing/placeholder
 * narrative or a failing C->D check is rejected.
 */
export function validateAttest(from: Phase, to: Phase, att: Attestation | null): AttestResult {
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
      return { ok: false, reason: `A -> B is blocked: you judged this audit round "fail". Synthesize the blockers (REVIEW-SYNTHESIS-01), amend the plan, and re-audit with the SAME reviewer (v2 surface: followup_task to its task_name; v1 surface: send_input to its agent_id). Re-attest with "pass" or "near-pass" once only folded/rebutted residuals remain; after 3 failed rounds return to P with a changed plan (LOOP-REPAIR-01).` };
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
