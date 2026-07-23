/**
 * scan-cli.ts — `cxc scan record` (260724 WP1, A-round H4).
 *
 * WHY: RESCAN_REINJECT_DIRECTIVE (hook.ts) has always instructed the model to
 * "record the scan round (cxc scan evidence)" — but no such subcommand ever
 * existed, `appendInterviewEvent` had zero production callers, and nothing
 * incremented `tracker.scanRounds`, so the I->P readiness soft-gate
 * (interview.ts evaluateInterviewGate) was only passable via `override:true`.
 * This module is the missing writer. It performs BOTH halves of the recording
 * contract (the gate reads the tracker cache, the ledger is the durable proof):
 *
 *   1. Append a `scan_completed` InterviewEvent to the per-session interview
 *      ledger (`.codexclaw/interviews/<id>.jsonl`), roundId derived via
 *      computeNextScanRound (monotonic, scanRounds+1).
 *   2. writeState: init the empty tracker when `state.interview` is null, then
 *      increment `scanRounds` AND set `lastScanRoundId = roundId` so the two
 *      counters never drift (A2-round B2).
 *
 * Usage: scan record --session <id> [--contradictions N] [--high N]
 */
import { appendInterviewEvent, readState, writeState, type State } from "./state.ts";
import { defaultInterview, type InterviewTracker } from "./interview.ts";
import { computeNextScanRound } from "./rescan-coordinator.ts";

export interface ScanCliArgs {
  action: "record";
  sessionId: string;
  contradictionCount: number;
  highContradictionCount: number;
  cwd: string;
}

export function parseScanCliArgs(
  argv: string[],
  cwd: string,
): ScanCliArgs | { error: string } {
  const [action, ...rest] = argv;
  if (action !== "record") {
    return { error: `unknown scan action '${action ?? ""}' — usage: scan record --session <id> [--contradictions N] [--high N]` };
  }
  let sessionId = "";
  let contradictionCount = 0;
  let highContradictionCount = 0;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === "--session") {
      sessionId = rest[i + 1] ?? "";
      i += 1;
    } else if (arg === "--contradictions") {
      contradictionCount = Number.parseInt(rest[i + 1] ?? "", 10);
      i += 1;
    } else if (arg === "--high") {
      highContradictionCount = Number.parseInt(rest[i + 1] ?? "", 10);
      i += 1;
    } else {
      return { error: `unknown argument '${arg}'` };
    }
  }
  if (!sessionId) return { error: "scan record: --session <id> is required (mutating command, no latest-session fallback)" };
  if (!Number.isFinite(contradictionCount) || contradictionCount < 0) {
    return { error: "scan record: --contradictions must be a non-negative integer" };
  }
  if (!Number.isFinite(highContradictionCount) || highContradictionCount < 0) {
    return { error: "scan record: --high must be a non-negative integer" };
  }
  return { action: "record", sessionId, contradictionCount, highContradictionCount, cwd };
}

export function runScanCli(args: ScanCliArgs): { output: string; code: number } {
  try {
    const state: State = readState(args.cwd, args.sessionId);
    const tracker: InterviewTracker = state.interview ?? defaultInterview(0);
    const roundId = computeNextScanRound(tracker);
    appendInterviewEvent(args.cwd, {
      ts: new Date().toISOString(),
      sessionId: args.sessionId,
      event: "scan_completed",
      roundId,
      contradictionCount: args.contradictionCount,
      highContradictionCount: args.highContradictionCount,
    });
    const nextTracker: InterviewTracker = {
      ...tracker,
      scanRounds: roundId,
      lastScanRoundId: roundId,
    };
    writeState(args.cwd, { ...state, interview: nextTracker });
    return {
      output: `scan record: round ${roundId} recorded for session ${args.sessionId} (contradictions=${args.contradictionCount}, high=${args.highContradictionCount})`,
      code: 0,
    };
  } catch (err) {
    return {
      output: `scan record failed: ${err instanceof Error ? err.message : String(err)}`,
      code: 1,
    };
  }
}
