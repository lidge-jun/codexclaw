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
  contradictionId: string; // correlates a Mind finding (L9.2 correlationId)
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
  roundId: number; // monotonic per interview (T6 replay horizon); planEditId/freezeId land in L10
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

function roundIdNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
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

export function defaultInterview(roundId = 0): InterviewTracker {
  const dimensions = {} as Record<Dimension, DimensionScore>;
  for (const d of DIMENSIONS) dimensions[d] = defaultScore();
  return { roundId: roundIdNum(roundId), dimensions, contradictions: [], assumptions: [] };
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

  // T3 fail-closed: a malformed (non-object) contradiction entry is NOT dropped —
  // it becomes a high-severity contradiction so corrupted data keeps blocking readiness.
  const contradictions: Contradiction[] = Array.isArray(v.contradictions)
    ? v.contradictions
        .map((c) =>
          isRecord(c)
            ? { contradictionId: str(c.contradictionId, str(c.id)), severity: severity(c.severity), summary: str(c.summary) }
            : { contradictionId: "", severity: "high" as ContradictionSeverity, summary: "[malformed contradiction entry]" },
        )
        .slice(-MAX_TRACKER_ARRAY)
    : [];

  // T3 fail-closed: a malformed (non-object) assumption entry is NOT dropped — it
  // becomes recorded:false so it keeps blocking readiness until explicitly re-recorded.
  const assumptions: Assumption[] = Array.isArray(v.assumptions)
    ? v.assumptions
        .map((a) =>
          isRecord(a)
            ? { id: str(a.id), text: str(a.text), recorded: a.recorded === true }
            : { id: "", text: "[malformed assumption entry]", recorded: false },
        )
        .slice(-MAX_TRACKER_ARRAY)
    : [];

  return { roundId: roundIdNum(v.roundId), dimensions, contradictions, assumptions };
}

/**
 * Readiness predicate (single source of truth for flags.interview). True ONLY when:
 *  - tracker is a well-formed object,
 *  - all four dimensions are at level "max",
 *  - contradictions[] is empty,
 *  - every assumption has recorded:true.
 * Never trusts a `ready` field on the tracker (none exists); always recomputed.
 */
/** Strict, fail-closed shape check for a single dimension score. */
function isValidScore(v: unknown): v is DimensionScore {
  return (
    isRecord(v) &&
    typeof v.level === "string" &&
    (DIMENSION_LEVELS as readonly string[]).includes(v.level) &&
    Array.isArray(v.known) &&
    v.known.every((x) => typeof x === "string") &&
    Array.isArray(v.unknown) &&
    v.unknown.every((x) => typeof x === "string") &&
    typeof v.confidence === "number" &&
    Number.isFinite(v.confidence) &&
    v.confidence >= 0 &&
    v.confidence <= 1
  );
}

export function isInterviewReady(tracker: InterviewTracker | null): boolean {
  if (!tracker || !isRecord(tracker)) return false;
  if (!isRecord(tracker.dimensions)) return false;
  // Every dimension must be a fully-valid score at level "max" (T3: a partial
  // {level:"max"} object must NOT pass).
  for (const d of DIMENSIONS) {
    const score = tracker.dimensions[d];
    if (!isValidScore(score) || score.level !== "max") return false;
  }
  // Any contradiction (incl. malformed sentinels) blocks; contradictions must be empty.
  if (!Array.isArray(tracker.contradictions) || tracker.contradictions.length > 0) return false;
  // Every assumption must be a well-formed object with recorded:true.
  if (!Array.isArray(tracker.assumptions)) return false;
  return tracker.assumptions.every((a) => isRecord(a) && a.recorded === true);
}

/**
 * Write-side normalization (T2): cap every in-state array to MAX_TRACKER_ARRAY
 * (drop-oldest) before the tracker is persisted, so a writer that appended past
 * the cap cannot bloat the hot session JSON. Null passes through unchanged.
 */
export function normalizeInterview(tracker: InterviewTracker | null): InterviewTracker | null {
  if (tracker === null || tracker === undefined) return null;
  if (!isRecord(tracker)) return null;
  const dimensions = {} as Record<Dimension, DimensionScore>;
  const rawDims = isRecord(tracker.dimensions) ? tracker.dimensions : ({} as Record<string, unknown>);
  for (const d of DIMENSIONS) {
    const sc = rawDims[d];
    dimensions[d] = isRecord(sc)
      ? {
          level: level((sc as DimensionScore).level),
          known: strArray((sc as DimensionScore).known),
          unknown: strArray((sc as DimensionScore).unknown),
          confidence: confidence((sc as DimensionScore).confidence),
        }
      : defaultScore();
  }
  return {
    roundId: roundIdNum(tracker.roundId),
    dimensions,
    contradictions: Array.isArray(tracker.contradictions) ? tracker.contradictions.slice(-MAX_TRACKER_ARRAY) : [],
    assumptions: Array.isArray(tracker.assumptions) ? tracker.assumptions.slice(-MAX_TRACKER_ARRAY) : [],
  };
}
