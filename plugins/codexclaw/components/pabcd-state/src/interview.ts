/**
 * interview.ts — IPABCD interview tracker schema, bounded fail-closed reconstruct,
 * and the readiness predicate (L8 / 080-083, FROZEN).
 *
 * The tracker records how complete the Interview (I) phase is across four
 * dimensions. `isInterviewReady` is the single source of truth the main session
 * uses to derive `flags.interview` (which gates entry to P). User transition
 * requests cannot override a false predicate.
 *
 * Discipline (T2/T3/T6):
 *  - T2: every in-state array is capped (MAX_TRACKER_ARRAY, drop-oldest) so the
 *    hot session JSON stays small; no external ledger ships in Cluster 1.
 *  - T3: malformed/lossy data reconstructs FAIL-CLOSED — invalid dimension level
 *    -> "low", invalid confidence -> 0, legacy/invalid assumptions -> recorded:false,
 *    so corrupted data can never become a ready tracker.
 *  - T6: round/edit ids are carried so later loops have a replay horizon beyond
 *    the 50-turn injection cap.
 */

export const DIMENSIONS = ["goal", "constraint", "success", "ontology"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LEVELS = ["low", "mid", "high", "max"] as const;
export type DimensionLevel = (typeof DIMENSION_LEVELS)[number];

export const CONTRADICTION_SEVERITIES = ["low", "medium", "high"] as const;
export type ContradictionSeverity = (typeof CONTRADICTION_SEVERITIES)[number];

/** Cap for every tracker array (drop-oldest) to bound session JSON growth (T2). */
export const MAX_TRACKER_ARRAY = 50;

export interface DimensionScore {
  level: DimensionLevel;
  known: string[];
  unknown: string[];
  confidence: number; // 0..1
}

export interface Contradiction {
  id: string;
  severity: ContradictionSeverity;
  summary: string;
}

export interface Assumption {
  id: string;
  text: string;
  /** Will be emitted to `## OPEN ASSUMPTIONS`. Readiness requires recorded:true. */
  recorded: boolean;
}

export interface InterviewTracker {
  roundId: string;
  dimensions: Record<Dimension, DimensionScore>;
  contradictions: Contradiction[];
  assumptions: Assumption[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").slice(-MAX_TRACKER_ARRAY);
}

function level(v: unknown): DimensionLevel {
  // T3: invalid level fails closed to "low".
  return typeof v === "string" && (DIMENSION_LEVELS as readonly string[]).includes(v)
    ? (v as DimensionLevel)
    : "low";
}

function confidence(v: unknown): number {
  // T3: fail-closed. Anything that is not a finite number in [0,1] becomes 0;
  // out-of-range values are treated as invalid (NOT clamped up) so corrupted
  // data can never inflate confidence toward readiness.
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) return 0;
  return v;
}

function severity(v: unknown): ContradictionSeverity {
  return typeof v === "string" && (CONTRADICTION_SEVERITIES as readonly string[]).includes(v)
    ? (v as ContradictionSeverity)
    : "high"; // unknown severity is treated as high so it blocks readiness
}

function defaultScore(): DimensionScore {
  return { level: "low", known: [], unknown: [], confidence: 0 };
}

function reconstructScore(v: unknown): DimensionScore {
  if (!isRecord(v)) return defaultScore();
  return {
    level: level(v.level),
    known: strArray(v.known),
    unknown: strArray(v.unknown),
    confidence: confidence(v.confidence),
  };
}

export function defaultInterview(roundId = ""): InterviewTracker {
  const dimensions = {} as Record<Dimension, DimensionScore>;
  for (const d of DIMENSIONS) dimensions[d] = defaultScore();
  return { roundId, dimensions, contradictions: [], assumptions: [] };
}

/**
 * Strict, bounded, fail-closed reconstruct. Returns null for a non-object input
 * (fresh sessions read `interview: null`). Any malformed nested data degrades to
 * the fail-closed default rather than throwing or producing a ready tracker.
 */
export function reconstructInterview(v: unknown): InterviewTracker | null {
  if (v === null || v === undefined) return null;
  if (!isRecord(v)) return null;

  const dimensions = {} as Record<Dimension, DimensionScore>;
  const rawDims = isRecord(v.dimensions) ? v.dimensions : {};
  for (const d of DIMENSIONS) dimensions[d] = reconstructScore(rawDims[d]);

  const contradictions: Contradiction[] = Array.isArray(v.contradictions)
    ? v.contradictions
        .filter(isRecord)
        .map((c) => ({ id: str(c.id), severity: severity(c.severity), summary: str(c.summary) }))
        .slice(-MAX_TRACKER_ARRAY)
    : [];

  const assumptions: Assumption[] = Array.isArray(v.assumptions)
    ? v.assumptions
        .filter(isRecord)
        // T3: legacy/invalid assumptions reconstruct to recorded:false (must be
        // explicitly re-recorded before they stop blocking readiness).
        .map((a) => ({ id: str(a.id), text: str(a.text), recorded: a.recorded === true }))
        .slice(-MAX_TRACKER_ARRAY)
    : [];

  return { roundId: str(v.roundId), dimensions, contradictions, assumptions };
}

/**
 * Readiness predicate (single source of truth for flags.interview). True ONLY when:
 *  - tracker is a well-formed object,
 *  - all four dimensions are at level "max",
 *  - contradictions[] is empty,
 *  - every assumption has recorded:true.
 * Never trusts a `ready` field on the tracker (none exists); always recomputed.
 */
export function isInterviewReady(tracker: InterviewTracker | null): boolean {
  if (!tracker || !isRecord(tracker)) return false;
  if (!isRecord(tracker.dimensions)) return false;
  for (const d of DIMENSIONS) {
    const score = tracker.dimensions[d];
    if (!score || score.level !== "max") return false;
  }
  if (!Array.isArray(tracker.contradictions) || tracker.contradictions.length > 0) return false;
  if (!Array.isArray(tracker.assumptions)) return false;
  return tracker.assumptions.every((a) => a && a.recorded === true);
}
