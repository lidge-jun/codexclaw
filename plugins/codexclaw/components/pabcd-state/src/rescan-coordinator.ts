/**
 * rescan-coordinator.ts — interactive-interview signal helper (L12.2 / 122).
 *
 * Pure SIGNAL calculator the MAIN SESSION calls during an INTERACTIVE interview
 * (no active goal) to decide whether another contradiction-scan / question round is
 * warranted. It never dispatches Minds, asks the user, or writes state — the main
 * session owns that loop (T4/T7). It is NEVER wired into `handleStop`: the Stop hook
 * does not drive the Interview (an interactive session pauses for the human, L6).
 *
 * Hard boundary (user constraint): goal mode is PABCD-only; the interview NEVER fires
 * during a goal. When a goal is active (or its DB is unreadable -> fail-closed), this
 * helper returns an EMPTY result, so even a future mis-wiring can never use it to resume
 * an interview under a goal.
 *
 * A-gate fixes folded in:
 *  - B1: `computeNextScanRound` derives from `scanRounds` ONLY (+1); it ignores
 *    `roundId`/`lastScanRoundId` (a different counter) so the scan round is monotonic.
 *  - B3: the high-severity contradiction signal is read ONLY from the in-memory tracker;
 *    this module never touches the scan-evidence ledger reader (`readInterviewEvents`),
 *    which is unfiltered and would absorb QA lines from the shared interviews JSONL.
 *  - pending question is matched on the `(turnId, questionId)` PAIR (not questionId alone)
 *    so a dimension id reused across rounds is not treated as already answered.
 */
import type { InterviewTracker } from "./interview.ts";
import { readQaEvents } from "./interview-ledger.ts";
import { getGoalActiveStatus, suppressesInterview, type GoalActiveDeps } from "./goal-active.ts";

export interface PendingInterviewWork {
  /** `(turnId, questionId)` pairs asked but not yet answered (encoded "turnId\u0000questionId"). */
  pendingQuestionIds: string[];
  /** count of open high-severity contradictions in the tracker. */
  highContradictionCount: number;
  /** true when there is concrete pending interview work (a question or a high contradiction). */
  pending: boolean;
}

const EMPTY: PendingInterviewWork = { pendingQuestionIds: [], highContradictionCount: 0, pending: false };

/** Pair key for a (turnId, questionId) tuple; NUL separator avoids collisions. */
function pairKey(turnId: string, questionId: string): string {
  return `${turnId}\u0000${questionId}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function highContradictions(tracker: InterviewTracker | null): number {
  if (!tracker || !isRecord(tracker) || !Array.isArray(tracker.contradictions)) return 0;
  return tracker.contradictions.filter((c) => isRecord(c) && c.severity === "high").length;
}

export interface RescanDeps {
  /** injectable goal-status reader (defaults to the real goals_1.sqlite read). */
  goal?: GoalActiveDeps;
  /** injectable goal-status override for tests that don't want a DB at all. */
  goalStatus?: () => "active" | "inactive" | "unreadable";
}

/**
 * Compute pending interview work for the INTERACTIVE interview. Returns EMPTY when a
 * goal is active/unreadable (goal mode is PABCD-only; interview never fires under a goal).
 * Pending question = a `question_asked` whose `(turnId, questionId)` pair has no matching
 * `answer_recorded`. High contradictions are read from the tracker only. Never throws.
 */
export function hasPendingInterviewWork(
  cwd: string,
  sessionId: string,
  tracker: InterviewTracker | null,
  deps: RescanDeps = {},
): PendingInterviewWork {
  // Hard boundary: no interview signal while a goal is active (or unreadable -> fail-closed).
  const status = deps.goalStatus ? deps.goalStatus() : getGoalActiveStatus(sessionId, deps.goal);
  if (suppressesInterview(status)) return EMPTY;

  let answered: Set<string>;
  let asked: Map<string, true>;
  try {
    const events = readQaEvents(cwd, sessionId);
    answered = new Set<string>();
    asked = new Map<string, true>();
    for (const e of events) {
      if (!isRecord(e) || typeof e.turnId !== "string" || typeof e.questionId !== "string") continue;
      const key = pairKey(e.turnId, e.questionId);
      if (e.event === "answer_recorded") answered.add(key);
      else if (e.event === "question_asked") asked.set(key, true);
    }
  } catch {
    // ledger read failure -> rely on contradiction signal only (conservative, no throw).
    answered = new Set<string>();
    asked = new Map<string, true>();
  }

  const pendingQuestionIds: string[] = [];
  for (const key of asked.keys()) {
    if (!answered.has(key)) pendingQuestionIds.push(key);
  }
  const highContradictionCount = highContradictions(tracker);
  return {
    pendingQuestionIds,
    highContradictionCount,
    pending: pendingQuestionIds.length > 0 || highContradictionCount > 0,
  };
}

/**
 * Next contradiction-scan round id. MONOTONIC: derived from `scanRounds` only (+1), never
 * from `roundId`/`lastScanRoundId`. A missing/malformed `scanRounds` reads as 0 -> next 1.
 */
export function computeNextScanRound(tracker: InterviewTracker | null): number {
  const n = tracker && isRecord(tracker) && typeof tracker.scanRounds === "number" && Number.isFinite(tracker.scanRounds) && tracker.scanRounds >= 0
    ? Math.floor(tracker.scanRounds)
    : 0;
  return n + 1;
}

/**
 * The main-session interactive-interview sequence this helper supports (documentation):
 *  1. select Minds adaptively (lowest-scoring dimensions, cap 3) — see minds.selectMinds;
 *  2. dispatch read-only contradiction lenses (Minds return contradictions ONLY);
 *  3. triage severity (high -> ask_user; low/med -> recorded assumption) — see triage;
 *  4. record the answer via the PostToolUse interview ledger (interview-ledger);
 *  5. rescan: re-run from step 1 until `hasPendingInterviewWork().pending` is false.
 * The hook never runs this loop; the main session does, and only with no active goal.
 */
