/**
 * dispatch-contract.ts — typed DispatchPacket and DispatchReceipt (issue #17).
 *
 * Expresses PABCD dispatch economy as typed contracts over native Codex spawn,
 * without adding a scheduler or registering native agents.
 */

import { ROLES, type RoleName } from "./store.ts";

/** Worktree access policy for a dispatched subagent. */
export type WorktreePolicy = "shared-read" | "isolated-write";

/** Terminal status of a dispatched subagent. */
export type DispatchStatus = "complete" | "blocked" | "inconclusive";

/** One verifier command's result as reported by the subagent (#276). */
export interface VerifierResult {
  command: string;
  exitCode: number;
  output: string;
}

/**
 * Declared write effects of one verifier command (#277). A declaration is the
 * packet author's claim, not proof: codexclaw never runs the command and does
 * not check paths against a filesystem.
 */
export interface VerifierEffect {
  /** Must equal (after trim) one entry of `verifierCommands`. */
  command: string;
  /** Paths or globs the command may write; `[]` declares it read-only. */
  expectedWrites: string[];
  /** Run this verifier in an isolated copy even when the packet is shared-read. */
  runInIsolation?: boolean;
}

/**
 * DispatchPacket — structured task specification for a subagent.
 * Contains everything a subagent needs to complete its bounded task.
 */
export interface DispatchPacket {
  /** Unique packet identifier. */
  id: string;
  /** Concrete task objective. */
  objective: string;
  /** Input anchors: file paths, URLs, or data references the subagent should read. */
  inputAnchors: string[];
  /** Expected output schema description. */
  expectedOutput: string;
  /** Decision boundary: what the subagent may decide vs what must return to main. */
  decisionBoundary: string;
  /** Verifier commands the main agent will run to check the result. */
  verifierCommands: string[];
  /** Optional write-effect declarations, at most one per verifier command (#277). */
  verifierEffects?: VerifierEffect[];
  /** Skill names to attach to the subagent. */
  requiredSkills: string[];
  /** Worktree access policy. */
  worktreePolicy: WorktreePolicy;
  /** Judgment ownership is always with the main agent (invariant). */
  judgmentOwnership: "main";
  /** Role: explorer (discovery), reviewer (audit), executor (write), architect (design). */
  role: RoleName;
}

/**
 * DispatchReceipt — structured result from a dispatched subagent.
 * Contains the evidence and findings for the main agent to evaluate.
 */
export interface DispatchReceipt {
  /** Packet id this receipt responds to. */
  packetId: string;
  /** Terminal status. */
  status: DispatchStatus;
  /** Typed findings or result. */
  findings: string;
  /** Evidence anchors: file paths, command outputs, or data references. */
  evidenceAnchors: string[];
  /** Commands or checks the subagent ran. */
  commandsRun: string[];
  /** Unresolved assumptions the main agent must evaluate. */
  unresolvedAssumptions: string[];
  /** Legacy single verifier result; still read, merged with `verifierResults`. */
  verifierResult?: VerifierResult;
  /** One result per packet verifier command (#276). Extra checks go in `commandsRun`. */
  verifierResults?: VerifierResult[];
  /** Source/worktree identity where mutation occurred. */
  sourceIdentity?: string;
}

function isVerifierResult(value: unknown): value is VerifierResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.command === "string" && Number.isInteger(v.exitCode) && typeof v.output === "string";
}

/** Distinct trimmed string commands; exact equality after trim, no other normalization. */
function distinctCommands(commands: readonly unknown[]): string[] {
  return [...new Set(commands.filter((command): command is string => typeof command === "string")
    .map((command) => command.trim()))];
}

/** Entries an unvalidated packet carries that are not non-blank strings. */
function malformedCommandCount(commands: readonly unknown[]): number {
  return commands.filter((command) => typeof command !== "string" || !command.trim()).length;
}

function validateVerifierEffects(value: unknown, commands: unknown): string[] {
  if (!Array.isArray(value)) return ["verifierEffects must be an array"];
  const required = new Set(Array.isArray(commands)
    ? commands.filter((command): command is string => typeof command === "string").map((command) => command.trim())
    : []);
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push("verifierEffects entries must be objects");
      continue;
    }
    const effect = item as Record<string, unknown>;
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
export function validatePacket(packet: unknown): string[] {
  const errors: string[] = [];
  if (!packet || typeof packet !== "object") {
    return ["packet must be a non-null object"];
  }
  const p = packet as Record<string, unknown>;
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
  if (!ROLES.includes(p.role as RoleName)) {
    errors.push(`role must be one of ${ROLES.join(", ")}`);
  }
  // Check for oversized skill attachment
  if (Array.isArray(p.requiredSkills) && p.requiredSkills.length > 10) {
    errors.push("requiredSkills exceeds maximum of 10");
  }
  return errors;
}

/** Validate a DispatchReceipt. Returns error messages or empty array. */
export function validateReceipt(receipt: unknown): string[] {
  const errors: string[] = [];
  if (!receipt || typeof receipt !== "object") {
    return ["receipt must be a non-null object"];
  }
  const r = receipt as Record<string, unknown>;
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
 * exit 0, and when the packet requires commands, a result for a command it did
 * not require is rejected.
 */
export function receiptSatisfiesPacket(packet: DispatchPacket, receipt: DispatchReceipt): {
  satisfied: boolean;
  reasons: string[];
  /** Required verifier commands (trimmed) with no matching result. */
  missing: string[];
} {
  const reasons: string[] = [];
  if (receipt.packetId !== packet.id) {
    reasons.push("packetId mismatch: expected " + packet.id + " got " + receipt.packetId);
  }
  if (receipt.status !== "complete") {
    reasons.push("receipt status is " + receipt.status + ", not complete");
  }
  const commands: unknown[] = Array.isArray(packet.verifierCommands) ? packet.verifierCommands : [];
  if (!Array.isArray(packet.verifierCommands) || malformedCommandCount(commands) > 0) {
    reasons.push("packet has malformed verifier commands (see validatePacket)");
  }
  const required = distinctCommands(commands).filter((command) => command.length > 0);
  const reportedResults: unknown[] = [
    ...(Array.isArray(receipt.verifierResults) ? receipt.verifierResults : []),
    ...(receipt.verifierResult !== undefined ? [receipt.verifierResult] : []),
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
  if (required.length > 1 && receipt.verifierResults === undefined && receipt.verifierResult !== undefined) {
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
export interface VerifierPreflightEntry {
  command: string;
  declared: boolean;
  needsIsolation: boolean;
  reason: string;
}

/**
 * Pure preflight over declared verifier effects (#277). It never runs a command
 * or reads the filesystem; it only tells the caller which verifiers must not run
 * on a shared checkout without isolation or main's confirmation.
 */
export function verifierPreflight(packet: DispatchPacket): VerifierPreflightEntry[] {
  const effects = new Map((packet.verifierEffects ?? []).map((effect) => [effect.command.trim(), effect]));
  const commands: unknown[] = Array.isArray(packet.verifierCommands) ? packet.verifierCommands : [];
  const malformed: VerifierPreflightEntry[] = commands
    .filter((command) => typeof command !== "string" || !command.trim())
    .map((command) => ({ command: String(command), declared: false, needsIsolation: true,
      reason: "malformed verifier command (see validatePacket); do not run it" }));
  return [...distinctCommands(commands).filter((command) => command.length > 0).map((command) => {
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
  }), ...malformed];
}

