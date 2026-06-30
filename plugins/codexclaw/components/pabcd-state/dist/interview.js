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

export const DIMENSIONS = ["goal", "constraint", "success", "ontology"]         ;


export const DIMENSION_LEVELS = ["low", "mid", "high", "max"]         ;


export const CONTRADICTION_SEVERITIES = ["low", "medium", "high"]         ;


/** Cap for every tracker array (drop-oldest) to bound session JSON growth (T2). */
export const MAX_TRACKER_ARRAY = 50;

/** 102: max auto-resolve rounds per interview before forcing closure/escalation. */
export const MAX_AUTO_ROUNDS = 5;














































/** 080.3: a seed-ontology entity (cli-jaw seed.ts parity, structured + optional). */










/** 080.3: tolerant parse of an unknown value into OntologyEntity[] (or undefined). */
export function reconstructOntologySchema(v         )                               {
  if (!Array.isArray(v)) return undefined;
  const out                   = [];
  for (const e of v) {
    if (!isRecord(e) || typeof e.name !== "string" || e.name.length === 0) continue;
    const fields = Array.isArray(e.fields)
      ? e.fields.filter((f)              => typeof f === "string").slice(-MAX_TRACKER_ARRAY)
      : [];
    const relationships                         = Array.isArray(e.relationships)
      ? e.relationships
          .filter(isRecord)
          .map((r) => ({ to: str(r.to), kind: str(r.kind) }))
          .filter((r) => r.to.length > 0)
          .slice(-MAX_TRACKER_ARRAY)
      : [];
    out.push({ name: e.name, fields, relationships });
  }
  return out.length > 0 ? out.slice(-MAX_TRACKER_ARRAY) : undefined;
}

function isRecord(v         )                               {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v         , fallback = "")         {
  return typeof v === "string" ? v : fallback;
}

function roundIdNum(v         )         {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

function strArray(v         )           {
  if (!Array.isArray(v)) return [];
  return v.filter((x)              => typeof x === "string").slice(-MAX_TRACKER_ARRAY);
}

function level(v         )                 {
  // T3: invalid level fails closed to "low".
  return typeof v === "string" && (DIMENSION_LEVELS                     ).includes(v)
    ? (v                  )
    : "low";
}

function confidence(v         )         {
  // T3: fail-closed. Anything that is not a finite number in [0,1] becomes 0;
  // out-of-range values are treated as invalid (NOT clamped up) so corrupted
  // data can never inflate confidence toward readiness.
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) return 0;
  return v;
}

function severity(v         )                        {
  return typeof v === "string" && (CONTRADICTION_SEVERITIES                     ).includes(v)
    ? (v                         )
    : "high"; // unknown severity is treated as high so it blocks readiness
}

function defaultScore()                 {
  return { level: "low", known: [], unknown: [], confidence: 0 };
}

function reconstructScore(v         )                 {
  if (!isRecord(v)) return defaultScore();
  return {
    level: level(v.level),
    known: strArray(v.known),
    unknown: strArray(v.unknown),
    confidence: confidence(v.confidence),
  };
}

export function defaultInterview(roundId = 0)                   {
  const dimensions = {}                                     ;
  for (const d of DIMENSIONS) dimensions[d] = defaultScore();
  return { roundId: roundIdNum(roundId), dimensions, contradictions: [], assumptions: [], autoResolveCount: 0, consecutiveAutoResolves: 0, scanRounds: 0, lastScanRoundId: 0 };
}

/**
 * Strict, bounded, fail-closed reconstruct. Returns null for a non-object input
 * (fresh sessions read `interview: null`). Any malformed nested data degrades to
 * the fail-closed default rather than throwing or producing a ready tracker.
 */
export function reconstructInterview(v         )                          {
  if (v === null || v === undefined) return null;
  if (!isRecord(v)) return null;

  const dimensions = {}                                     ;
  const rawDims = isRecord(v.dimensions) ? v.dimensions : {};
  for (const d of DIMENSIONS) dimensions[d] = reconstructScore(rawDims[d]);

  // T3 fail-closed: a malformed (non-object) contradiction entry is NOT dropped —
  // it becomes a high-severity contradiction so corrupted data keeps blocking readiness.
  const contradictions                  = Array.isArray(v.contradictions)
    ? v.contradictions
        .map((c) =>
          isRecord(c)
            ? { contradictionId: str(c.contradictionId, str(c.id)), severity: severity(c.severity), summary: str(c.summary) }
            : { contradictionId: "", severity: "high"                         , summary: "[malformed contradiction entry]" },
        )
        .slice(-MAX_TRACKER_ARRAY)
    : [];

  // T3 fail-closed: a malformed (non-object) assumption entry is NOT dropped — it
  // becomes recorded:false so it keeps blocking readiness until explicitly re-recorded.
  const assumptions               = Array.isArray(v.assumptions)
    ? v.assumptions
        .map((a) =>
          isRecord(a)
            ? {
                id: str(a.id),
                text: str(a.text),
                recorded: a.recorded === true,
                ...(typeof a.severity === "string" && (CONTRADICTION_SEVERITIES                     ).includes(a.severity)
                  ? { severity: a.severity                          }
                  : {}),
                ...(a.requiresUserReview === true ? { requiresUserReview: true } : {}),
              }
            : { id: "", text: "[malformed assumption entry]", recorded: false },
        )
        .slice(-MAX_TRACKER_ARRAY)
    : [];

  return {
    roundId: roundIdNum(v.roundId),
    dimensions,
    contradictions,
    assumptions,
    autoResolveCount: roundIdNum(v.autoResolveCount),
    consecutiveAutoResolves: roundIdNum(v.consecutiveAutoResolves),
    scanRounds: roundIdNum(v.scanRounds),
    lastScanRoundId: roundIdNum(v.lastScanRoundId),
    ...(reconstructOntologySchema(v.ontologySchema) ? { ontologySchema: reconstructOntologySchema(v.ontologySchema) } : {}),
  };
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
function isValidScore(v         )                      {
  return (
    isRecord(v) &&
    typeof v.level === "string" &&
    (DIMENSION_LEVELS                     ).includes(v.level) &&
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

export function isInterviewReady(tracker                         )          {
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
  if (!tracker.assumptions.every((a) => isRecord(a) && a.recorded === true)) return false;
  // 131/D2': readiness now requires scan-evidence — at least one contradiction scan
  // must have been recorded. Data-shape alone (maxed dims, empty contradictions) is not
  // proof a scan ran; this closes the "ready without ever scanning" gap.
  return roundIdNum(tracker.scanRounds) >= 1;
}

/** 131/D2': pure I->P soft-gate evaluation. No IO. */











/**
 * Evaluate the I->P soft-gate. This is advisory: the caller may advise-block or, on an
 * explicit human override, pre-flip the interview flag and proceed (logging the override).
 */
export function evaluateInterviewGate(tracker                         )                {
  const t = tracker && isRecord(tracker) ? tracker : null;
  const scanRan = !!t && roundIdNum(t.scanRounds) >= 1;
  const highContradictionCount =
    t && Array.isArray(t.contradictions)
      ? t.contradictions.filter((c) => isRecord(c) && c.severity === "high").length
      : 0;
  const warnings           = [];
  if (!scanRan) warnings.push("no contradiction scan has been recorded for this interview");
  if (highContradictionCount > 0) warnings.push(`${highContradictionCount} high-severity contradiction(s) still open`);
  const ready = isInterviewReady(tracker);
  if (!ready && warnings.length === 0) warnings.push("interview is not ready (dimensions/assumptions incomplete)");
  return { ready, scanRan, highContradictionCount, warnings };
}

/**
 * Write-side normalization (T2): cap every in-state array to MAX_TRACKER_ARRAY
 * (drop-oldest) before the tracker is persisted, so a writer that appended past
 * the cap cannot bloat the hot session JSON. Null passes through unchanged.
 */
export function normalizeInterview(tracker                         )                          {
  if (tracker === null || tracker === undefined) return null;
  if (!isRecord(tracker)) return null;
  const dimensions = {}                                     ;
  const rawDims = isRecord(tracker.dimensions) ? tracker.dimensions : ({}                           );
  for (const d of DIMENSIONS) {
    const sc = rawDims[d];
    dimensions[d] = isRecord(sc)
      ? {
          level: level((sc                  ).level),
          known: strArray((sc                  ).known),
          unknown: strArray((sc                  ).unknown),
          confidence: confidence((sc                  ).confidence),
        }
      : defaultScore();
  }
  return {
    roundId: roundIdNum(tracker.roundId),
    dimensions,
    contradictions: Array.isArray(tracker.contradictions) ? tracker.contradictions.slice(-MAX_TRACKER_ARRAY) : [],
    assumptions: Array.isArray(tracker.assumptions) ? tracker.assumptions.slice(-MAX_TRACKER_ARRAY) : [],
    autoResolveCount: roundIdNum(tracker.autoResolveCount),
    consecutiveAutoResolves: roundIdNum(tracker.consecutiveAutoResolves),
    scanRounds: roundIdNum(tracker.scanRounds),
    lastScanRoundId: roundIdNum(tracker.lastScanRoundId),
    ...(reconstructOntologySchema(tracker.ontologySchema) ? { ontologySchema: reconstructOntologySchema(tracker.ontologySchema) } : {}),
  };
}
