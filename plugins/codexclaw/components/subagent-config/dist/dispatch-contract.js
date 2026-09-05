/**
 * dispatch-contract.ts — typed DispatchPacket and DispatchReceipt (issue #17).
 *
 * Expresses PABCD dispatch economy as typed contracts over native Codex spawn,
 * without adding a scheduler or multiplying permanent agent roles.
 */

/** Worktree access policy for a dispatched subagent. */


/** Terminal status of a dispatched subagent. */


/**
 * DispatchPacket — structured task specification for a subagent.
 * Contains everything a subagent needs to complete its bounded task.
 */























/**
 * DispatchReceipt — structured result from a dispatched subagent.
 * Contains the evidence and findings for the main agent to evaluate.
 */



















/** Validate a DispatchPacket. Returns error messages or empty array. */
export function validatePacket(packet         )           {
  const errors           = [];
  if (!packet || typeof packet !== "object") {
    return ["packet must be a non-null object"];
  }
  const p = packet                           ;
  if (typeof p.id !== "string" || !p.id) errors.push("id must be a non-empty string");
  if (typeof p.objective !== "string" || !p.objective) errors.push("objective must be a non-empty string");
  if (!Array.isArray(p.inputAnchors)) errors.push("inputAnchors must be an array");
  if (typeof p.expectedOutput !== "string") errors.push("expectedOutput must be a string");
  if (typeof p.decisionBoundary !== "string") errors.push("decisionBoundary must be a string");
  if (!Array.isArray(p.verifierCommands)) errors.push("verifierCommands must be an array");
  if (!Array.isArray(p.requiredSkills)) errors.push("requiredSkills must be an array");
  if (p.worktreePolicy !== "shared-read" && p.worktreePolicy !== "isolated-write") {
    errors.push("worktreePolicy must be shared-read or isolated-write");
  }
  if (p.judgmentOwnership !== "main") errors.push("judgmentOwnership must be main");
  if (p.role !== "explorer" && p.role !== "reviewer" && p.role !== "executor") {
    errors.push("role must be explorer, reviewer, or executor");
  }
  // Check for oversized skill attachment
  if (Array.isArray(p.requiredSkills) && p.requiredSkills.length > 10) {
    errors.push("requiredSkills exceeds maximum of 10");
  }
  return errors;
}

/** Validate a DispatchReceipt. Returns error messages or empty array. */
export function validateReceipt(receipt         )           {
  const errors           = [];
  if (!receipt || typeof receipt !== "object") {
    return ["receipt must be a non-null object"];
  }
  const r = receipt                           ;
  if (typeof r.packetId !== "string" || !r.packetId) errors.push("packetId must be a non-empty string");
  if (r.status !== "complete" && r.status !== "blocked" && r.status !== "inconclusive") {
    errors.push("status must be complete, blocked, or inconclusive");
  }
  if (typeof r.findings !== "string") errors.push("findings must be a string");
  if (!Array.isArray(r.evidenceAnchors)) errors.push("evidenceAnchors must be an array");
  if (!Array.isArray(r.commandsRun)) errors.push("commandsRun must be an array");
  if (!Array.isArray(r.unresolvedAssumptions)) errors.push("unresolvedAssumptions must be an array");
  return errors;
}

/** Check that a receipt satisfies its packet's verifier requirements. */
export function receiptSatisfiesPacket(packet                , receipt                 )


  {
  const reasons           = [];
  if (receipt.packetId !== packet.id) {
    reasons.push("packetId mismatch: expected " + packet.id + " got " + receipt.packetId);
  }
  if (receipt.status !== "complete") {
    reasons.push("receipt status is " + receipt.status + ", not complete");
  }
  if (packet.verifierCommands.length > 0 && !receipt.verifierResult) {
    reasons.push("packet has verifier commands but receipt has no verifier result");
  }
  if (receipt.verifierResult && receipt.verifierResult.exitCode !== 0) {
    reasons.push("verifier exit code " + receipt.verifierResult.exitCode + " (expected 0)");
  }
  return { satisfied: reasons.length === 0, reasons };
}

