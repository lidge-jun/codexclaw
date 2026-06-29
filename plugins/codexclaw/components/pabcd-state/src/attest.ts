/**
 * attest.ts — plugin-native structural evidence gate for forward PABCD transitions.
 *
 * Ported from cli-jaw orchestrator/attestation.ts (form-only gate): the adversary is
 * the agent's own laziness/hallucination, not a malicious human. The gate forces the
 * agent to commit to a specific `did` narrative, and for C->D to paste real command
 * output with a passing exit code. A boolean is NOT accepted as evidence (cheaper to
 * hallucinate than prose), so the audit/check flags can only flip true through here.
 *
 * No server, no IO: pure validation. Callers (cli.ts / orchestrate) persist the
 * resulting flags via state.writeState. This is the runtime enforcement that 007 R-2
 * demands — the evidence gate must be structural, not prompt prose.
 */
import type { Phase } from "./state.ts";

export interface Attestation {
  from: Phase;
  to: Phase;
  /** Required narrative of what the agent actually did this phase (NOT a boolean). */
  did: string;
  /** C->D only: pasted tail of the actual tsc/test command output. */
  checkOutput?: string;
  /** Optional exit code; if present and non-zero, C->D is rejected. */
  exitCode?: number;
}

/** Forward dev transitions that require a valid attestation to advance. */
export const GATED_TRANSITIONS: ReadonlySet<string> = new Set(["A>B", "C>D"]);

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
  if (typeof rec.checkOutput === "string") att.checkOutput = rec.checkOutput.trim();
  if (typeof rec.exitCode === "number" && Number.isFinite(rec.exitCode)) {
    att.exitCode = rec.exitCode;
  }
  return att;
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
