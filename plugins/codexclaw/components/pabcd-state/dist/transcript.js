/**
 * transcript.ts — transcript-grounded idempotency + context-pressure suppression
 * for the UserPromptSubmit hook (007 R-11, ported from omo ultrawork codex-hook.ts).
 *
 * The local injectedTurns flag dedups within a (session,turn), but a turn_id can
 * churn or reset after compaction, so a passive re-fire could double-inject the
 * same phase directive. These guards read the recent transcript TAIL (byte-bounded)
 * and (a) skip when the current phase's stage marker is already present, and
 * (b) stay silent under context-pressure / compaction-recovery markers.
 *
 * All functions are fail-open on IO/parse errors (never throw) — matching the
 * cli.ts fail-safe contract; an unreadable transcript must not block codex.
 */
import { readFileSync } from "node:fs";


const TRANSCRIPT_SEARCH_BYTES = 65_536;

/** Compaction / context-pressure recovery markers (lowercased substring match). */
export const CONTEXT_PRESSURE_MARKERS                    = [
  "compacted session handoff",
  "context window has been compacted",
  "conversation history has been summarized",
];

/** Stage labels mirror hook.ts STAGE_LABELS; kept local to avoid an import cycle. */
const PHASE_LABELS                                 = {
  I: "INTERVIEW",
  P: "PLAN",
  A: "AUDIT",
  B: "BUILD",
  C: "CHECK",
  D: "DONE",
};

/** Byte-bounded tail read; returns "" on any IO error (fail-open). */
export function readTranscriptTail(
  transcriptPath                           ,
  maxBytes = TRANSCRIPT_SEARCH_BYTES,
)         {
  if (!transcriptPath) return "";
  try {
    const buf = readFileSync(transcriptPath);
    return buf.subarray(Math.max(0, buf.byteLength - maxBytes)).toString("utf8");
  } catch {
    return "";
  }
}

/**
 * True if the transcript tail already carries a codexclaw stage marker for `phase`.
 * Matches both emitted forms: the full directive head `[codexclaw: PLAN]` and the
 * compaction-immune header `[codexclaw — P: PLAN]`.
 */
export function hasStageMarkerForPhase(tail        , phase       )          {
  if (!tail) return false;
  const label = PHASE_LABELS[phase];
  if (!label) return false;
  const directiveHead = `[codexclaw: ${label}]`;
  const headerHead = `[codexclaw — ${phase}: ${label}]`;
  return tail.includes(directiveHead) || tail.includes(headerHead);
}

/** True if the tail (or any text) shows a compaction/context-pressure recovery marker. */
export function isContextPressureTail(tail        )          {
  if (!tail) return false;
  const lc = tail.toLowerCase();
  return CONTEXT_PRESSURE_MARKERS.some((m) => lc.includes(m));
}
