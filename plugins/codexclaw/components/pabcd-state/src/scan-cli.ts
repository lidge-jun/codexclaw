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
import { appendInterviewEvent, readState, writeState, type State } from "./state.ts";
import {
  DIMENSIONS,
  DIMENSION_LEVELS,
  defaultInterview,
  type Dimension,
  type DimensionLevel,
  type DimensionScore,
  type InterviewTracker,
} from "./interview.ts";
import { readQaEvents } from "./interview-ledger.ts";
import { computeNextScanRound } from "./rescan-coordinator.ts";

export interface ScanCliArgs {
  action: "record";
  sessionId: string;
  contradictionCount: number;
  highContradictionCount: number;
  cwd: string;
  /** Fold captured ledger answers into the tracker (WP3). */
  derive?: boolean;
  /** questionId -> dimension attribution for --derive. */
  map?: Record<string, Dimension>;
  /** Explicit level assertions; these win over derivation. */
  dims?: Partial<Record<Dimension, DimensionLevel>>;
  known?: Array<{ dimension: Dimension; text: string }>;
  unknown?: Array<{ dimension: Dimension; text: string }>;
  confidence?: Partial<Record<Dimension, number>>;
}

function isDimension(v: string): v is Dimension {
  return (DIMENSIONS as readonly string[]).includes(v);
}

function isLevel(v: string): v is DimensionLevel {
  return (DIMENSION_LEVELS as readonly string[]).includes(v);
}

/**
 * Split on the FIRST `=` only, so a fact may itself contain `=` or `:`
 * ("uses http://x?a=b"). Returns undefined when there is no separator.
 */
function splitPair(raw: string): { key: string; value: string } | undefined {
  const at = raw.indexOf("=");
  if (at <= 0) return undefined;
  return { key: raw.slice(0, at), value: raw.slice(at + 1) };
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
  let derive = false;
  const map: Record<string, Dimension> = {};
  const dims: Partial<Record<Dimension, DimensionLevel>> = {};
  const known: Array<{ dimension: Dimension; text: string }> = [];
  const unknown: Array<{ dimension: Dimension; text: string }> = [];
  const confidence: Partial<Record<Dimension, number>> = {};
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
      const num = Number.parseFloat(pair.value);
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
function pushUnique(list: string[], text: string): string[] {
  return list.includes(text) ? list : [...list, text];
}

/**
 * Fold the captured QA ledger into per-dimension known/unknown sets. An answered
 * question becomes a known fact; a question asked but never answered becomes an
 * open gap. Attribution comes from `--map`; unmapped questions are skipped
 * rather than guessed, since a wrong dimension is worse than a missing one.
 */
function deriveFromLedger(
  cwd: string,
  sessionId: string,
  map: Record<string, Dimension>,
  dimensions: Record<Dimension, DimensionScore>,
): Record<Dimension, DimensionScore> {
  const events = readQaEvents(cwd, sessionId);
  if (events.length === 0) return dimensions;
  const questions = new Map<string, string>();
  const answers = new Map<string, string[]>();
  for (const ev of events) {
    if (ev.event === "question_asked" && ev.question) questions.set(ev.questionId, ev.question);
    if (ev.event === "answer_recorded" && Array.isArray(ev.answers)) answers.set(ev.questionId, ev.answers);
  }
  const next = { ...dimensions };
  for (const [questionId, questionText] of questions) {
    const dim = map[questionId];
    if (!dim) continue; // unmapped: never guess an attribution
    const score = next[dim];
    const answered = answers.get(questionId);
    if (answered && answered.length > 0) {
      next[dim] = { ...score, known: answered.reduce(pushUnique, score.known) };
    } else {
      next[dim] = { ...score, unknown: pushUnique(score.unknown, questionText) };
    }
  }
  return next;
}

/**
 * Coverage-derived level. Deliberately never promotes to "max": that level gates
 * I->P through isInterviewReady, so it stays an explicit operator assertion
 * (`--dim <d>=max`) rather than something a heuristic can hand out.
 */
function deriveLevel(score: DimensionScore): DimensionLevel {
  // "low" means nothing is known about this dimension at all. An asked-but-
  // unanswered question is not nothing: naming the gap is itself progress, so a
  // dimension with only open gaps sits at "mid" rather than falling back to
  // "low". Facts plus remaining gaps is also "mid"; only facts with no open gap
  // reaches "high".
  if (score.known.length === 0 && score.unknown.length === 0) return "low";
  if (score.unknown.length > 0) return "mid";
  return "high";
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
    let dimensions = tracker.dimensions;
    let derivedCount = 0;
    if (args.derive) {
      const before = dimensions;
      dimensions = deriveFromLedger(args.cwd, args.sessionId, args.map ?? {}, dimensions);
      for (const d of DIMENSIONS) {
        const moved =
          dimensions[d].known.length !== before[d].known.length ||
          dimensions[d].unknown.length !== before[d].unknown.length;
        if (!moved) continue;
        derivedCount += 1;
        dimensions = { ...dimensions, [d]: { ...dimensions[d], level: deriveLevel(dimensions[d]) } };
      }
    }
    for (const entry of args.known ?? []) {
      const score = dimensions[entry.dimension];
      dimensions = { ...dimensions, [entry.dimension]: { ...score, known: pushUnique(score.known, entry.text) } };
    }
    for (const entry of args.unknown ?? []) {
      const score = dimensions[entry.dimension];
      dimensions = { ...dimensions, [entry.dimension]: { ...score, unknown: pushUnique(score.unknown, entry.text) } };
    }
    for (const [dim, value] of Object.entries(args.confidence ?? {})) {
      const d = dim as Dimension;
      dimensions = { ...dimensions, [d]: { ...dimensions[d], confidence: value as number } };
    }
    // Explicit level assertions land last so they win over derivation.
    for (const [dim, level] of Object.entries(args.dims ?? {})) {
      const d = dim as Dimension;
      dimensions = { ...dimensions, [d]: { ...dimensions[d], level: level as DimensionLevel } };
    }
    const nextTracker: InterviewTracker = {
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
