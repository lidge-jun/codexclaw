/**
 * minds.ts — 5-Mind contradiction dispatcher surface (L9 / 090-093, FROZEN).
 *
 * T4=opt1: the MAIN session owns the interview loop (question gen, plan/state
 * edits, re-question). The hook only injects directive text. T7=opt1: only the
 * top-level main session dispatches Minds; if codexclaw is itself running as a
 * subagent, Mind dispatch is unavailable (no nested orchestration).
 *
 * Minds are read-only contradiction LENSES. A Mind worker returns a JSON array of
 * contradictions ONLY — it never asks questions, edits files, calls the user,
 * selects options, writes state, or edits plans. This module provides:
 *  - MIND_ROLE_PROMPTS: the five fixed prompts (not configurable in MVP),
 *  - normalizeMindOutput(): strict validation + correlation-key attachment,
 *  - selectMinds(): adaptive routing by lowest-scoring dimensions (cap 3).
 */
import { DIMENSIONS, type Dimension, type ContradictionSeverity, type InterviewTracker } from "./interview.ts";

export const MINDS = ["contrarian", "socratic", "ontologist", "evaluator", "simplifier"] as const;
export type Mind = (typeof MINDS)[number];

/** Recommended concurrent dispatch cap (no 9-way fan-out; 093/090). */
export const MIND_CONCURRENCY_CAP = 3;

const SHARED_OUTPUT_CONTRACT = [
  "Return ONLY a JSON array of contradictions. Each item:",
  '{ "dimension": "goal|constraint|success|ontology", "contradiction": "<short gap/conflict>",',
  '  "severity": "low|medium|high", "evidence": "<file:line, section ref, or exact short quote>" }.',
  "Empty array [] means you found no contradiction. Do NOT ask questions, edit files, call the user,",
  "choose options, write state, or edit the plan. Evidence must be real (no unsupported guesses).",
].join("\n");

export const MIND_ROLE_PROMPTS: Record<Mind, string> = {
  contrarian: [
    "[Mind: Contrarian] Challenge the stated goals and constraints. Be skeptical, not rude:",
    "where is an assumption unjustified, a goal in tension with a constraint, or a claim unproven?",
    SHARED_OUTPUT_CONTRACT,
  ].join("\n"),
  socratic: [
    "[Mind: Socratic] Probe vague terms and missing operational definitions. Which words lack a",
    "testable meaning? Which success terms are undefined? Surface the undefined, not opinions.",
    SHARED_OUTPUT_CONTRACT,
  ].join("\n"),
  ontologist: [
    "[Mind: Ontologist] Check entity/relationship/field/data-model completeness. What entity,",
    "relation, field, or state is referenced but never defined, or modeled inconsistently?",
    SHARED_OUTPUT_CONTRACT,
  ].join("\n"),
  evaluator: [
    "[Mind: Evaluator] Check success criteria for measurability and outcome-level parsimony. Which",
    "acceptance criterion is unmeasurable, untestable, or redundant with another?",
    SHARED_OUTPUT_CONTRACT,
  ].join("\n"),
  simplifier: [
    "[Mind: Simplifier] Find over-engineering, redundant constraints, and scope creep. What can be",
    "removed without losing a real requirement? Where does scope exceed the stated goal?",
    SHARED_OUTPUT_CONTRACT,
  ].join("\n"),
};

/** Directive injected when the main session owns an interview round (T4/T7). */
export const MIND_DISPATCH_DIRECTIVE = [
  "[codexclaw: INTERVIEW — Mind dispatch]",
  "You (the main session) OWN this interview loop: select Minds, dispatch contradiction workers,",
  "triage contradictions, ask the user if needed, edit the plan, update state, and re-question.",
  "The hook only injects directives — it does not coordinate worker returns or plan edits.",
  "Dispatch Minds ONLY from the top-level main session; if you are yourself a subagent, Mind",
  "dispatch is unavailable (no nested orchestration) — fall back to inline reasoning, do not nest.",
  "Each Mind is a read-only lens: it returns contradictions ONLY (never asks/edits/calls/writes).",
  `Choose Minds by lowest-scoring dimensions; concurrent cap ${MIND_CONCURRENCY_CAP}.`,
  "State + plan artifacts live under .codexclaw/ (session tracker + .codexclaw/plan/).",
].join("\n");

export interface MindContradiction {
  mind: Mind; // correlation key (which Mind produced it)
  dimension: Dimension;
  contradiction: string;
  severity: ContradictionSeverity;
  evidence: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const SEVERITIES: readonly string[] = ["low", "medium", "high"];

/**
 * Strict validation of a single Mind's raw output (parsed JSON array). Rejects
 * any item missing a valid dimension, severity, non-empty contradiction, or
 * non-empty evidence. Every accepted item is correlated to `mind`. Malformed
 * input yields [] (never throws) so a bad worker cannot mark interview ready.
 */
export function normalizeMindOutput(mind: Mind, raw: unknown): MindContradiction[] {
  if (!MINDS.includes(mind)) return [];
  if (!Array.isArray(raw)) return [];
  const out: MindContradiction[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const dimension = item.dimension;
    const contradiction = item.contradiction;
    const severity = item.severity;
    const evidence = item.evidence;
    if (typeof dimension !== "string" || !(DIMENSIONS as readonly string[]).includes(dimension)) continue;
    if (typeof severity !== "string" || !SEVERITIES.includes(severity)) continue;
    if (typeof contradiction !== "string" || contradiction.trim().length === 0) continue;
    if (typeof evidence !== "string" || evidence.trim().length === 0) continue; // reject unsupported guesses
    out.push({
      mind,
      dimension: dimension as Dimension,
      contradiction: contradiction.trim(),
      severity: severity as ContradictionSeverity,
      evidence: evidence.trim(),
    });
  }
  return out;
}

/**
 * Adaptive Mind routing: pick the Minds whose mapped dimensions score lowest in
 * the tracker. `count` is clamped to [1, MIND_CONCURRENCY_CAP]. With no tracker,
 * returns the first `count` Minds in canonical order. No forced minimum coverage.
 */
const MIND_PRIMARY_DIMENSION: Record<Mind, Dimension> = {
  contrarian: "constraint",
  socratic: "goal",
  ontologist: "ontology",
  evaluator: "success",
  simplifier: "constraint",
};

const LEVEL_RANK: Record<string, number> = { low: 0, mid: 1, high: 2, max: 3 };

export function selectMinds(tracker: InterviewTracker | null, count = 2): Mind[] {
  const n = Math.max(1, Math.min(MIND_CONCURRENCY_CAP, Math.floor(count)));
  if (!tracker || !isRecord(tracker) || !isRecord(tracker.dimensions)) {
    return [...MINDS].slice(0, n);
  }
  const scored = MINDS.map((mind) => {
    const dim = MIND_PRIMARY_DIMENSION[mind];
    const lvl = tracker.dimensions[dim]?.level ?? "low";
    return { mind, rank: LEVEL_RANK[lvl] ?? 0 };
  });
  // lowest-scoring dimension first; stable canonical order on ties
  scored.sort((a, b) => a.rank - b.rank || MINDS.indexOf(a.mind) - MINDS.indexOf(b.mind));
  return scored.slice(0, n).map((s) => s.mind);
}
