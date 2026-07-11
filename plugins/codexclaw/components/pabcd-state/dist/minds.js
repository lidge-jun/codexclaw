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
import { DIMENSIONS,                                                                   } from "./interview.js";

export const MINDS = ["contrarian", "socratic", "ontologist", "evaluator", "simplifier"]         ;


/** Recommended concurrent dispatch cap (no 9-way fan-out; 093/090). */
export const MIND_CONCURRENCY_CAP = 3;

const SHARED_OUTPUT_CONTRACT = [
  "Return ONLY a JSON array of contradictions. Each item:",
  '{ "dimension": "goal|constraint|success|ontology", "contradiction": "<short gap/conflict>",',
  '  "severity": "low|medium|high", "evidence": "<file:line, section ref, or exact short quote>" }.',
  "Empty array [] means you found no contradiction. Do NOT ask questions, edit files, call the user,",
  "choose options, write state, or edit the plan. Evidence must be real (no unsupported guesses).",
].join("\n");

export const MIND_ROLE_PROMPTS                       = {
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
  "Spawn shape (MIND-SPAWN-SHAPE-01 — required so model/effort routing applies): agent_type",
  '"explorer", task_name mind_<mindname>, and a NON-full-history fork — V2 fork_turns:"none"',
  "(V1: omit fork_context). A full-history fork rejects model/effort overrides upstream and",
  "skips the .codexclaw/subagents.json role-config injection entirely.",
  "Mind lenses ride the explorer role config: its configured model/reasoning_effort are injected",
  "when you omit those fields. Lens work seldom needs parent-strength reasoning — pin it via",
  "`cxc subagents set explorer --effort <low|medium|high|xhigh>` or pass reasoning_effort explicitly.",
  "Minds are stateless: pack the lens prompt PLUS a compact interview snapshot (dimension scores,",
  "knowns, open assumptions, draft plan path) into each task message.",
  "State + plan artifacts live under .codexclaw/ (session tracker + .codexclaw/plan/).",
].join("\n");










function isRecord(v         )                               {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const SEVERITIES                    = ["low", "medium", "high"];

/**
 * Evidence must look like real grounding, not an unsupported guess (092:18):
 *  - a file:line reference (e.g. plan.md:12, src/x.ts:3),
 *  - an explicit section reference (contains "section" or a "##"/"L<n>" marker), or
 *  - an exact short quote (wrapped in straight/smart quotes).
 */
function isGroundedEvidence(s        )          {
  const v = s.trim();
  if (v.length === 0) return false;
  if (/[^\s:]+:\d+/.test(v)) return true; // file:line
  if (/(^|\b)(section\b|##|L\d+(\.\d+)?)/i.test(v)) return true; // section / loop ref
  if (/["'\u201c\u201d\u2018\u2019].+["'\u201c\u201d\u2018\u2019]/.test(v)) return true; // quoted span
  return false;
}

/**
 * Strict validation of a single Mind's raw output (parsed JSON array). Rejects
 * any item missing a valid dimension, severity, non-empty contradiction, or
 * non-empty evidence. Every accepted item is correlated to `mind`. Malformed
 * input yields [] (never throws) so a bad worker cannot mark interview ready.
 */
export function normalizeMindOutput(mind      , raw         , roundId = 0)                      {
  if (!MINDS.includes(mind)) return [];
  if (!Array.isArray(raw)) return [];
  const round = typeof roundId === "number" && Number.isFinite(roundId) && roundId >= 0 ? Math.floor(roundId) : 0;
  const correlationId = `${round}-${mind}`;
  const out                      = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const dimension = item.dimension;
    const contradiction = item.contradiction;
    const severity = item.severity;
    const evidence = item.evidence;
    if (typeof dimension !== "string" || !(DIMENSIONS                     ).includes(dimension)) continue;
    if (typeof severity !== "string" || !SEVERITIES.includes(severity)) continue;
    if (typeof contradiction !== "string" || contradiction.trim().length === 0) continue;
    if (typeof evidence !== "string" || !isGroundedEvidence(evidence)) continue; // reject unsupported guesses (092:18)
    out.push({
      mind,
      correlationId,
      dimension: dimension             ,
      contradiction: contradiction.trim(),
      severity: severity                         ,
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
const MIND_PRIMARY_DIMENSION                          = {
  contrarian: "constraint",
  socratic: "goal",
  ontologist: "ontology",
  evaluator: "success",
  simplifier: "constraint",
};

const LEVEL_RANK                         = { low: 0, mid: 1, high: 2, max: 3 };

export function selectMinds(tracker                         , count = 2)         {
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
