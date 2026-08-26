/**
 * evidence-cli.ts — `cxc evidence resolve` (EVIDENCE-TERMINAL-01, 260826).
 *
 * When a delegated worker exhausts its evidence-verification budget, the SubagentStop
 * gate releases it (a child that cannot write the receipt gains nothing from being
 * asked forever) and records an unresolved tombstone. GOAL-COMPLETE-GATE-01 then
 * refuses to certify the goal until that verdict is settled. This is how a parent
 * settles it.
 *
 * Resolution is EVIDENCE-BACKED, not an acknowledgement: `--receipt` is required and
 * is validated through the same `hasValidReceipt` contract the gate itself uses
 * (inside .codexclaw/evidence, not a symlink, a regular non-empty file). A bare
 * "I acknowledge this" would just relocate the laundering it exists to prevent.
 *
 * There is deliberately NO `--override` flag. A CLI flag cannot authenticate a human:
 * the same agent that GOAL-COMPLETE-GATE-01 is holding back could run it, erase its own
 * verdict, and then certify the goal — which is precisely the laundering this gate
 * exists to stop. The honest escape hatch for a genuine external blocker already
 * exists and is host-owned: `update_goal {status:"blocked"}`, which the gate always
 * allows.
*/
import { clearAttempts, hasValidReceipt } from "./subagent-evidence.ts";
import { appendLedger, isCanonicalSessionId, readState, withSessionLock, writeState } from "./state.ts";

export interface EvidenceResolveArgs {
  verb: "resolve";
  sessionId: string;
  agentId: string;
  receipt?: string;
  turnId?: string;
  cwd: string;
}

export function parseEvidenceCliArgs(argv: string[], cwd: string): EvidenceResolveArgs | { error: string } {
  const verb = argv[0];
  if (verb !== "resolve") {
    return { error: `unknown evidence verb '${verb ?? ""}' (expected resolve)` };
  }
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const sessionId = flag("session");
  const agentId = flag("agent");
  const receipt = flag("receipt");
  const turnId = flag("turn");
  if (!sessionId || !isCanonicalSessionId(sessionId)) {
    return { error: "--session <id> is required and must be a canonical session id" };
  }
  if (!agentId) return { error: "--agent <agent-id> is required" };
  if (!receipt) {
    return {
      error:
        "--receipt <path> is required: resolving without evidence would defeat the gate. If an external blocker prevents verifying the work, use update_goal status \"blocked\" instead.",
    };
  }
  return { verb: "resolve", sessionId, agentId, receipt, turnId, cwd };
}

export function runEvidenceCli(args: EvidenceResolveArgs): { output: string; code: number } {
  const receipt = args.receipt ?? "";
  if (!hasValidReceipt(args.cwd, receipt)) {
    return {
      output: `evidence resolve: receipt failed the evidence-root guard (must be a real, non-empty, non-symlink file inside .codexclaw/evidence): ${receipt}`,
      code: 1,
    };
  }
  try {
    const removed = withSessionLock(args.cwd, args.sessionId, () => {
      const state = readState(args.cwd, args.sessionId);
      // Tombstone identity is (agentId, turnId). Filtering on agentId alone would let
      // ONE receipt clear every turn that agent ever failed — including turns nobody
      // verified. When an agent has several, --turn is required to disambiguate.
      const matches = state.unverifiedSubagents.filter(
        (e) => e.resolvable && e.agentId === args.agentId && (args.turnId === undefined || e.turnId === args.turnId),
      );
      if (matches.length === 0) return false;
      if (matches.length > 1) return "ambiguous" as const;
      const target = matches[0];
      // Audit BEFORE mutation, inside the same lock. If the ledger write fails the
      // tombstone survives and completion stays denied — recoverable. The inverse
      // order can clear the verdict and lose its only record, which is not.
      appendLedger(args.cwd, {
        ts: new Date().toISOString(),
        sessionId: args.sessionId,
        from: state.phase,
        to: state.phase,
        reason: `evidence resolve: agent=${args.agentId} turn=${target.turnId || "<none>"} resolved with a valid receipt`,
        evidence: args.receipt,
        // `actor` is not inferred from a CLI flag: this path is reachable by any
        // caller of the shipped CLI, so claiming "human" would be a false attribution.
        actor: "agent",
        override: false,
      });
      const next = state.unverifiedSubagents.filter((e) => e !== target);
      writeState(args.cwd, { ...state, sessionId: args.sessionId, unverifiedSubagents: next });
      // The spent retry counter is an independent verdict signal read by the
      // completion gate, so resolution must clear it too — otherwise a resolved
      // agent would keep denying completion forever.
      // Clear the counter for THIS turn only: the fallback verdict signal for any
      // other unverified turn of the same agent must survive.
      //
      // The legacy agent-only counter is deliberately NOT cleared here. It is shared
      // by every turn-less stop of this agent, so deleting it while resolving one
      // turn could erase the live verdict of an absent-turn worker. A pre-upgrade
      // counter is resolved by resolving it on its own terms (no --turn).
      clearAttempts(args.cwd, args.sessionId, args.agentId, target.turnId);
      return true;
    });
    if (removed === "ambiguous") {
      return {
        output: `evidence resolve: agent '${args.agentId}' has more than one unverified record; pass --turn <turn-id> to name exactly which one this receipt verifies`,
        code: 1,
      };
    }
    if (!removed) {
      return {
        output: `evidence resolve: no resolvable unverified record for agent '${args.agentId}' in session ${args.sessionId}`,
        code: 1,
      };
    }
    return {
      output: `evidence resolve: agent ${args.agentId} resolved against ${args.receipt ?? ""}`,
      code: 0,
    };
  } catch (err) {
    return { output: `evidence resolve: ${err instanceof Error ? err.message : String(err)}`, code: 1 };
  }
}
