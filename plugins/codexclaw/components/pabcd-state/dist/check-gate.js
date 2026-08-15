/**
 * check-gate.ts — the C>D receipt check (075).
 *
 * Lives outside attest.ts for the same reason plan-gate.ts does: attest stays pure,
 * and anything that touches the filesystem belongs to a module the caller invokes
 * deliberately.
 *
 * It also lives outside parseSourceBoundReceipt's acceptance rules. That parser is
 * shared with the final gate, so tightening it there would invalidate every
 * existing final-gate receipt. The extra requirements are asked here, on the one
 * edge that needs them.
 */
import { parseSourceBoundReceipt, isReceiptError } from "./source-receipt.js";
import { captureSourceIdentity, compareSource } from "./source-identity.js";




/**
 * Verify the receipt named by a C>D attestation.
 *
 * Bound sessions only. A HITL session keeps the form-level gate from 070, which
 * already requires an exit code. A bound session whose goalplan cannot be read is
 * NOT treated as HITL — that is the cheapest way past every gate in this unit.
 */
export function validateCheckReceipt(
  state       ,
  sessionId        ,
  receiptPath                    ,
  cwd        ,
)                  {
  const refuse = (why        )                  => ({
    ok: false,
    reason: `${why} (CHECK-BINDING-01). Produce one with: cxc receipt test --session <id> -- <command>, then pass its path as testReceiptPath.`,
  });

  if (!receiptPath) return refuse('C -> D on a goalplan-bound session requires "testReceiptPath"');
  if (!state.checkEpoch) {
    return {
      ok: false,
      reason: "this check cycle predates CHECK-BINDING-01, so no receipt can bind to it. Step back with `cxc orchestrate B` and re-enter `cxc orchestrate C` to mint a binding.",
    };
  }

  const parsed = parseSourceBoundReceipt(receiptPath, cwd, "test");
  if (isReceiptError(parsed)) return refuse(parsed.error);

  // The fields the shared parser preserves but does not require.
  if (!parsed.command || parsed.command.trim().length === 0) {
    return refuse("the receipt names no command, so it records nothing about what ran");
  }
  if (parsed.exitCode !== 0) {
    return refuse(`the receipt reports exitCode ${parsed.exitCode ?? "none"}; only a passing run closes a check`);
  }
  if (!parsed.createdAtProvided) {
    return refuse("the receipt carries no usable createdAt");
  }
  if (parsed.ownerSessionId !== sessionId) {
    return refuse("the receipt was produced by a different session");
  }
  if (parsed.checkEpoch !== state.checkEpoch) {
    return refuse("the receipt belongs to an earlier check cycle — re-run the command for this one");
  }

  const now = captureSourceIdentity(cwd, { excludeCodexclawArtifacts: true });
  const cmp = compareSource(parsed.sourceIdentity, now);
  if (cmp.kind === "different") {
    return refuse(`the source changed after the check ran (${cmp.detail})`);
  }
  if (cmp.kind === "unavailable") {
    return refuse(`git could not resolve the source identity (${cmp.reason})`);
  }
  return { ok: true };
}
