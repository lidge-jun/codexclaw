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
 * 260802 WP3 — the dimension writer. `captureInterviewAnswers` finally records
 * answers (WP2), but nothing READ them: `readQaEvents` had no production
 * consumer, so `tracker.dimensions` stayed unwritten, `selectMinds` tied every
 * dimension at "low" and fell back to canonical order, and each interview
 * question was generated with no accumulated context. `--derive` closes that
 * loop by folding captured answers into `known[]` and unanswered questions into
 * `unknown[]`. See devlog/_plan/260802_interview_answer_capture/020_*.md.
 *
 * Usage: scan record --session <id> [--contradictions N] [--high N]
 *          [--derive] [--map <questionId>=<dimension>]
 *          [--dim <dimension>=<level>] [--known <dimension>=<fact>]
 *          [--unknown <dimension>=<gap>] [--confidence <dimension>=<0..1>]
 */
import { appendInterviewEvent, readState, writeState,            } from "./state.js";
import {
  DIMENSIONS,
  DIMENSION_LEVELS,
  MAX_TRACKER_ARRAY,
  defaultInterview,




} from "./interview.js";
import { readQaEvents } from "./interview-ledger.js";
import { computeNextScanRound } from "./rescan-coordinator.js";


















function isDimension(v        )                 {
  return (DIMENSIONS                     ).includes(v);
}

function isLevel(v        )                      {
  return (DIMENSION_LEVELS                     ).includes(v);
}

/**
 * Split on the FIRST `=` only, so a fact may itself contain `=` or `:`
 * ("uses http://x?a=b"). Returns undefined when there is no separator.
 */
function splitPair(raw        )                                             {
  const at = raw.indexOf("=");
  if (at <= 0) return undefined;
  return { key: raw.slice(0, at), value: raw.slice(at + 1) };
}

export function parseScanCliArgs(
  argv          ,
  cwd        ,
)                                  {
  const [action, ...rest] = argv;
  if (action !== "record") {
    return { error: `unknown scan action '${action ?? ""}' — usage: scan record --session <id> [--contradictions N] [--high N]` };
  }
  let sessionId = "";
  let contradictionCount = 0;
  let highContradictionCount = 0;
  let derive = false;
  // Object.create(null): a question id like `toString` or `hasOwnProperty` would
  // otherwise resolve to an inherited function on a plain literal, defeating the
  // `if (!dim) continue` skip and crashing the derivation.
  const map                            = Object.create(null)                             ;
  const dims                                             = {};
  const known                                                = [];
  const unknown                                                = [];
  const confidence                                     = {};
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
    } else if (arg === "--derive") {
      derive = true;
    } else if (arg === "--map") {
      const pair = splitPair(rest[i + 1] ?? "");
      if (!pair) return { error: "scan record: --map expects <questionId>=<dimension>" };
      if (!isDimension(pair.value)) return { error: `scan record: unknown dimension '${pair.value}' (expected ${DIMENSIONS.join("|")})` };
      map[pair.key] = pair.value;
      i += 1;
    } else if (arg === "--dim") {
      const pair = splitPair(rest[i + 1] ?? "");
      if (!pair) return { error: "scan record: --dim expects <dimension>=<level>" };
      if (!isDimension(pair.key)) return { error: `scan record: unknown dimension '${pair.key}' (expected ${DIMENSIONS.join("|")})` };
      if (!isLevel(pair.value)) return { error: `scan record: invalid level '${pair.value}' (expected ${DIMENSION_LEVELS.join("|")})` };
      if (pair.value === "max") {
        // `max` on all four dimensions is what isInterviewReady gates I->P on.
        // The sanctioned way to reach P without a genuinely ready interview is
        // `cxc orchestrate P --attest '{"override":true,...}'`, which validates
        // the narrative and writes an auditable ledger row. Letting a writer flag
        // grant `max` would be the same power with no attestation and no trail.
        return {
          error:
            "scan record: --dim cannot set 'max'. That level gates I->P via isInterviewReady; " +
            "use `cxc orchestrate P --session <id> --attest '{\"from\":\"I\",\"to\":\"P\",\"did\":\"<reason>\",\"override\":true}'` " +
            "so the bypass is attested and recorded in the ledger.",
        };
      }
      dims[pair.key] = pair.value;
      i += 1;
    } else if (arg === "--known" || arg === "--unknown") {
      const pair = splitPair(rest[i + 1] ?? "");
      if (!pair) return { error: `scan record: ${arg} expects <dimension>=<text>` };
      if (!isDimension(pair.key)) return { error: `scan record: unknown dimension '${pair.key}' (expected ${DIMENSIONS.join("|")})` };
      if (pair.value.length === 0) return { error: `scan record: ${arg} text must not be empty` };
      (arg === "--known" ? known : unknown).push({ dimension: pair.key, text: pair.value });
      i += 1;
    } else if (arg === "--confidence") {
      const pair = splitPair(rest[i + 1] ?? "");
      if (!pair) return { error: "scan record: --confidence expects <dimension>=<0..1>" };
      if (!isDimension(pair.key)) return { error: `scan record: unknown dimension '${pair.key}' (expected ${DIMENSIONS.join("|")})` };
      // Number() rather than parseFloat: "0.5abc" must be rejected, not silently
      // truncated to 0.5.
      const num = pair.value.trim().length === 0 ? Number.NaN : Number(pair.value);
      if (!Number.isFinite(num) || num < 0 || num > 1) return { error: `scan record: --confidence must be within [0,1], got '${pair.value}'` };
      confidence[pair.key] = num;
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
  // Optional fields are omitted when unused, so a plain `scan record` parses to
  // exactly the shape it always did (the pre-existing equality test relies on it).
  return {
    action: "record",
    sessionId,
    contradictionCount,
    highContradictionCount,
    cwd,
    ...(derive ? { derive } : {}),
    ...(Object.keys(map).length > 0 ? { map } : {}),
    ...(Object.keys(dims).length > 0 ? { dims } : {}),
    ...(known.length > 0 ? { known } : {}),
    ...(unknown.length > 0 ? { unknown } : {}),
    ...(Object.keys(confidence).length > 0 ? { confidence } : {}),
  };
}

/** Append without duplicating; the caller's write path applies the array cap. */
function pushUnique(list          , text        )           {
  return list.includes(text) ? list : [...list, text];
}

/**
 * Keep the FIRST MAX_TRACKER_ARRAY entries rather than the last. `writeState`'s
 * normalizeInterview caps with drop-oldest, which for interview knowns inverts
 * the value ordering: the earliest answers are the goal and the constraints,
 * while late entries are clarifications. Capping here keep-first also makes
 * re-deriving idempotent — under drop-oldest, `pushUnique` re-appends whatever
 * the cap already evicted, so repeated no-op derives rotate the window forever
 * and the tracker never reaches a fixed point.
 */
function capKeepFirst(list          )           {
  return list.length <= MAX_TRACKER_ARRAY ? list : list.slice(0, MAX_TRACKER_ARRAY);
}

/**
 * Fold the captured QA ledger into per-dimension known/unknown sets. An answered
 * question becomes a known fact; a question asked but never answered becomes an
 * open gap. Attribution comes from `--map`; unmapped questions are skipped
 * rather than guessed, since a wrong dimension is worse than a missing one.
 */
function deriveFromLedger(
  cwd        ,
  sessionId        ,
  map                           ,
  dimensions                                   ,
)                                    {
  const events = readQaEvents(cwd, sessionId);
  if (events.length === 0) return dimensions;
  const questions = new Map                ();
  const answers = new Map                  ();
  for (const ev of events) {
    if (ev.event === "question_asked" && ev.question) questions.set(ev.questionId, ev.question);
    if (ev.event === "answer_recorded" && Array.isArray(ev.answers)) {
      // Merge across turns: the same question id answered twice must keep both
      // answers, not last-write-wins.
      const prior = answers.get(ev.questionId) ?? [];
      answers.set(ev.questionId, ev.answers.reduce(pushUnique, prior));
    }
  }
  const next = { ...dimensions };
  for (const [questionId, questionText] of questions) {
    const dim = Object.prototype.hasOwnProperty.call(map, questionId) ? map[questionId] : undefined;
    if (!dim) continue; // unmapped: never guess an attribution
    const score = next[dim];
    const answered = answers.get(questionId);
    if (answered && answered.length > 0) {
      // An answered question retires its own gap: a resolved question must not
      // stay listed as unknown, or deriveLevel pins the dimension at mid forever.
      next[dim] = {
        ...score,
        known: capKeepFirst(answered.reduce(pushUnique, score.known)),
        unknown: score.unknown.filter((gap) => gap !== questionText),
      };
    } else {
      next[dim] = { ...score, unknown: capKeepFirst(pushUnique(score.unknown, questionText)) };
    }
  }
  return next;
}

/**
 * Coverage-derived level. Deliberately never promotes to "max": that level gates
 * I->P through isInterviewReady, so it stays an explicit operator assertion
 * (`--dim <d>=max`) rather than something a heuristic can hand out.
 */
function deriveLevel(score                )                 {
  // "low" means nothing is known about this dimension at all. An asked-but-
  // unanswered question is not nothing: naming the gap is itself progress, so a
  // dimension with only open gaps sits at "mid" rather than falling back to
  // "low". Facts plus remaining gaps is also "mid"; only facts with no open gap
  // reaches "high".
  if (score.known.length === 0 && score.unknown.length === 0) return "low";
  if (score.unknown.length > 0) return "mid";
  return "high";
}

export function runScanCli(args             )                                   {
  try {
    const state        = readState(args.cwd, args.sessionId);
    const tracker                   = state.interview ?? defaultInterview(0);
    const roundId = computeNextScanRound(tracker);
    appendInterviewEvent(args.cwd, {
      ts: new Date().toISOString(),
      sessionId: args.sessionId,
      event: "scan_completed",
      roundId,
      contradictionCount: args.contradictionCount,
      highContradictionCount: args.highContradictionCount,
    });
    let dimensions = tracker.dimensions;
    let derivedCount = 0;
    // Only dimensions this invocation actually modified get their level
    // recomputed. Recomputing ALL of them would silently revert a prior
    // `--dim` assertion on the next unrelated `scan record`, because `--dim`
    // writes `level` without writing any known/unknown to justify it.
    const touched = new Set           ();
    if (args.derive) {
      const before = dimensions;
      dimensions = deriveFromLedger(args.cwd, args.sessionId, args.map ?? {}, dimensions);
      for (const d of DIMENSIONS) {
        const moved =
          dimensions[d].known.length !== before[d].known.length ||
          dimensions[d].unknown.length !== before[d].unknown.length;
        if (!moved) continue;
        derivedCount += 1;
        touched.add(d);
      }
    }
    for (const entry of args.known ?? []) {
      const score = dimensions[entry.dimension];
      dimensions = { ...dimensions, [entry.dimension]: { ...score, known: capKeepFirst(pushUnique(score.known, entry.text)) } };
      touched.add(entry.dimension);
    }
    for (const entry of args.unknown ?? []) {
      const score = dimensions[entry.dimension];
      dimensions = { ...dimensions, [entry.dimension]: { ...score, unknown: capKeepFirst(pushUnique(score.unknown, entry.text)) } };
      touched.add(entry.dimension);
    }
    // Recompute the touched levels from coverage AFTER the manual entries land,
    // so `--known` alone cannot leave a dimension claiming "low" (nothing known)
    // while holding a fact. Explicit `--dim` still wins below, and untouched
    // dimensions keep whatever level a previous invocation asserted.
    for (const d of touched) {
      const derivedLvl = deriveLevel(dimensions[d]);
      if (dimensions[d].level !== derivedLvl && dimensions[d].level !== "max") {
        dimensions = { ...dimensions, [d]: { ...dimensions[d], level: derivedLvl } };
      }
    }
    for (const [dim, value] of Object.entries(args.confidence ?? {})) {
      const d = dim             ;
      dimensions = { ...dimensions, [d]: { ...dimensions[d], confidence: value           } };
    }
    // Explicit level assertions land last so they win over derivation.
    for (const [dim, level] of Object.entries(args.dims ?? {})) {
      const d = dim             ;
      dimensions = { ...dimensions, [d]: { ...dimensions[d], level: level                   } };
    }
    const nextTracker                   = {
      ...tracker,
      dimensions,
      scanRounds: roundId,
      lastScanRoundId: roundId,
    };
    writeState(args.cwd, { ...state, interview: nextTracker });
    const derived = args.derive ? `, derived=${derivedCount} dimension(s) from the answer ledger` : "";
    return {
      output: `scan record: round ${roundId} recorded for session ${args.sessionId} (contradictions=${args.contradictionCount}, high=${args.highContradictionCount}${derived})`,
      code: 0,
    };
  } catch (err) {
    return {
      output: `scan record failed: ${err instanceof Error ? err.message : String(err)}`,
      code: 1,
    };
  }
}
