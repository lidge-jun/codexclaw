/**
 * dispatch-contract.ts — typed DispatchPacket and DispatchReceipt (issue #17).
 *
 * Expresses PABCD dispatch economy as typed contracts over native Codex spawn,
 * without adding a scheduler or registering native agents.
 */

import { ROLES,               } from "./store.js";

/** Worktree access policy for a dispatched subagent. */


/** Terminal status of a dispatched subagent. */


/** One verifier command's result as reported by the subagent (#276). */






/**
 * Declared write effects of one verifier command (#277). A declaration is the
 * packet author's claim, not proof: codexclaw never runs the command and does
 * not check paths against a filesystem.
 */









/**
 * DispatchPacket — structured task specification for a subagent.
 * Contains everything a subagent needs to complete its bounded task.
 */

























/**
 * DispatchReceipt — structured result from a dispatched subagent.
 * Contains the evidence and findings for the main agent to evaluate.
 */





















function isVerifierResult(value         )                          {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value                           ;
  return typeof v.command === "string" && Number.isInteger(v.exitCode) && typeof v.output === "string";
}

/** Distinct trimmed commands; exact string equality after trim, no other normalization. */
function distinctCommands(commands                   )           {
  return [...new Set(commands.map((command) => command.trim()))];
}

function validateVerifierEffects(value         , commands         )           {
  if (!Array.isArray(value)) return ["verifierEffects must be an array"];
  const required = new Set(Array.isArray(commands)
    ? commands.filter((command)                    => typeof command === "string").map((command) => command.trim())
    : []);
  const seen = new Set        ();
  const errors           = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push("verifierEffects entries must be objects");
      continue;
    }
    const effect = item                           ;
    if (typeof effect.command !== "string" || !effect.command.trim()) {
      errors.push("verifierEffects command must be a non-empty string");
      continue;
    }
    const command = effect.command.trim();
    if (!required.has(command)) errors.push("verifierEffects command `" + command + "` is not in verifierCommands");
    if (seen.has(command)) errors.push("verifierEffects declares `" + command + "` more than once");
    seen.add(command);
    if (!Array.isArray(effect.expectedWrites)
      || effect.expectedWrites.some((path) => typeof path !== "string" || !path.trim())) {
      errors.push("verifierEffects expectedWrites for `" + command + "` must be an array of non-empty strings");
    }
    if (effect.runInIsolation !== undefined && typeof effect.runInIsolation !== "boolean") {
      errors.push("verifierEffects runInIsolation for `" + command + "` must be a boolean");
    }
  }
  return errors;
}

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
  else if (p.verifierCommands.some((command) => typeof command !== "string" || !command.trim())) {
    errors.push("verifierCommands entries must be non-empty strings");
  }
  if (p.verifierEffects !== undefined) errors.push(...validateVerifierEffects(p.verifierEffects, p.verifierCommands));
  if (!Array.isArray(p.requiredSkills)) errors.push("requiredSkills must be an array");
  if (p.worktreePolicy !== "shared-read" && p.worktreePolicy !== "isolated-write") {
    errors.push("worktreePolicy must be shared-read or isolated-write");
  }
  if (p.judgmentOwnership !== "main") errors.push("judgmentOwnership must be main");
  if (!ROLES.includes(p.role            )) {
    errors.push(`role must be one of ${ROLES.join(", ")}`);
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
  if (r.verifierResult !== undefined && !isVerifierResult(r.verifierResult)) {
    errors.push("verifierResult must be {command: string, exitCode: integer, output: string}");
  }
  if (r.verifierResults !== undefined
    && (!Array.isArray(r.verifierResults) || !r.verifierResults.every(isVerifierResult))) {
    errors.push("verifierResults must be an array of {command: string, exitCode: integer, output: string}");
  }
  return errors;
}

/**
 * Check that a receipt satisfies its packet's verifier requirements (#276).
 * Every distinct required command needs a matching result, every result must
 * exit 0, and a result for a command the packet did not require is rejected.
 */
export function receiptSatisfiesPacket(packet                , receipt                 )




  {
  const reasons           = [];
  if (receipt.packetId !== packet.id) {
    reasons.push("packetId mismatch: expected " + packet.id + " got " + receipt.packetId);
  }
  if (receipt.status !== "complete") {
    reasons.push("receipt status is " + receipt.status + ", not complete");
  }
  const required = distinctCommands(packet.verifierCommands);
  const reportedResults            = [
    ...(Array.isArray(receipt.verifierResults) ? receipt.verifierResults : []),
    ...(receipt.verifierResult ? [receipt.verifierResult] : []),
  ];
  // Unvalidated input must not throw here; malformed entries fail the receipt.
  const results = reportedResults.filter(isVerifierResult);
  const nonArrayResults = receipt.verifierResults !== undefined && !Array.isArray(receipt.verifierResults);
  if (nonArrayResults || results.length !== reportedResults.length) {
    reasons.push("receipt has malformed verifier results (see validateReceipt)");
  }
  if (required.length > 0 && results.length === 0) {
    reasons.push("packet has verifier commands but receipt has no verifier result");
  }
  for (const result of results) {
    if (result.exitCode !== 0) {
      reasons.push("verifier exit code " + result.exitCode + " (expected 0) for `" + result.command.trim() + "`");
    }
  }
  const reported = new Set(results.map((result) => result.command.trim()));
  const missing = required.filter((command) => !reported.has(command));
  if (results.length > 0) {
    for (const command of missing) reasons.push("missing verifier result for `" + command + "`");
  }
  if (required.length > 1 && receipt.verifierResults === undefined && receipt.verifierResult) {
    reasons.push("receipt reports one legacy verifierResult; packet requires "
      + required.length + " verifier commands (incomplete)");
  }
  if (required.length > 0) {
    const requiredSet = new Set(required);
    for (const command of reported) {
      if (!requiredSet.has(command)) reasons.push("verifier result for unrelated command `" + command + "`");
    }
  }
  return { satisfied: reasons.length === 0, reasons, missing };
}

/** One preflight row per distinct verifier command (#277). */







/**
 * Pure preflight over declared verifier effects (#277). It never runs a command
 * or reads the filesystem; it only tells the caller which verifiers must not run
 * on a shared checkout without isolation or main's confirmation.
 */
export function verifierPreflight(packet                )                           {
  const effects = new Map((packet.verifierEffects ?? []).map((effect) => [effect.command.trim(), effect]));
  return distinctCommands(packet.verifierCommands).map((command) => {
    const effect = effects.get(command);
    const declared = effect !== undefined;
    if (packet.worktreePolicy === "isolated-write") {
      return { command, declared, needsIsolation: false, reason: "packet is isolated-write" };
    }
    if (!effect) {
      return { command, declared, needsIsolation: true,
        reason: "no declared write boundary on a shared-read packet; run it in an isolated copy or confirm with main" };
    }
    if (effect.runInIsolation === true) {
      return { command, declared, needsIsolation: true, reason: "declared runInIsolation" };
    }
    if (effect.expectedWrites.length > 0) {
      return { command, declared, needsIsolation: true,
        reason: "declares writes (" + effect.expectedWrites.join(", ") + ") on a shared-read packet" };
    }
    return { command, declared, needsIsolation: false, reason: "declared read-only (expectedWrites: [])" };
  });
}

