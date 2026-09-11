/**
 * source-gate.ts — entry refusal for goalplan-bound cycles whose source identity
 * cannot be resolved (#133).
 *
 * WHY AT ENTRY: the C->D gate (check-gate.ts) and `receipt test` (receipt-cli.ts) both
 * refuse an `unavailable` identity, and that refusal is correct — CHECK-BINDING-01 is
 * fail-closed and 075_receipt_binding.md forbids reading "I do not know" as
 * "unchanged". But B->C is deliberately fail-open ("no git means no opinion"), so a
 * bound session sails P->A->B->C and only discovers at C that it can never close.
 * Plan, audit and implementation are already spent, and there is no exit. This gate
 * moves the same verdict to the cheapest possible point.
 *
 * WHAT IT DOES NOT DO: it never tests for `.git`. The predicate is "the SOURCE identity
 * is unavailable", so binding a git source worktree (#109) clears it without this file
 * knowing anything about split cwds. Written the other way, this gate would reject the
 * #109 case at the door and that fix would have to undo this one.
 *
 * Unbound sessions are untouched: they close D on checkOutput + exitCode and never
 * enter the receipt path. Callers must only consult this for a BOUND session.
 */
import { captureSessionSourceIdentity } from "./session-source-identity.ts";

export interface SourceGateResult {
  ok: boolean;
  reason?: string;
}

export function checkBoundSourceIdentity(cwd: string, sessionId: string): SourceGateResult {
  let kind: string;
  try {
    kind = captureSessionSourceIdentity(cwd, sessionId, { excludeCodexclawArtifacts: true }).kind;
  } catch (err) {
    // A thrown SOURCE-ROOT or binding error is also "cannot resolve".
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
  if (kind !== "unavailable") return { ok: true };
  return {
    ok: false,
    reason: [
      "this workspace has no resolvable git source identity, and a goalplan-bound",
      "cycle cannot be closed without one: C -> D requires a testReceiptPath",
      "(CHECK-BINDING-01) and `cxc receipt test` refuses to write a receipt it cannot",
      "bind to a commit.",
      "",
      "Pick one:",
      "  - bind a git source tree:  cxc session source <absolute-path> --json",
      "  - or run this cycle unbound (no `cxc loop init --session`), which closes D on",
      "    checkOutput + exitCode alone.",
    ].join("\n"),
  };
}
