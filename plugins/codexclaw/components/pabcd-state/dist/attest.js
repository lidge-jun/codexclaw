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
  if (typeof rec.checkOutput === "string") att.checkOutput = rec.checkOutput.trim();
  if (typeof rec.exitCode === "number" && Number.isFinite(rec.exitCode)) {
    att.exitCode = rec.exitCode;
  }
  if (typeof rec.override === "boolean") {
    att.override = rec.override;
  }
  return att;
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
