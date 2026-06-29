/**
 * hook.ts — pure hook logic (no process IO; stdin/stdout handled by cli.ts).
 *
 * UserPromptSubmit: detect an explicit IPABCD/interview trigger in the prompt
 * and inject the matching phase directive as additionalContext. Idempotent per
 * (session, turn): a turn_id is recorded in state.injectedTurns so a re-fired
 * hook in the same turn does not double-inject.
 *
 * Stop: PASSIVE in Pass 2 — returns "" and writes nothing. Auto-advance / ledger
 * is deferred to a later pass to avoid per-turn ledger spam (gates like
 * canEnter("A") are unconditionally open, so a naive advance would log every turn).
 *
 * Ground truth:
 *  - payload field names: codex-rs hooks/src/events/{user_prompt_submit,stop}.rs (snake_case)
 *  - output shape:        omo rules/src/hook-output.ts:10-16 (camelCase hookSpecificOutput)
 */
import { readState, writeState,            } from "./state.js";
import { hasStageMarkerForPhase, isContextPressureTail, readTranscriptTail } from "./transcript.js";

                                          
                                      
                     
              
                 
                                  
                   
                 
                           
 

                              
                          
                     
              
                                  
                   
                             
                                         
 

const MAX_CTX = 32_000;

/**
 * Detect an explicit IPABCD/interview trigger. Explicit only — no goal-mode
 * branch (A3 decision, see 022.3). Both English and Korean phrasings.
 * Order matters: interview is checked first so "orchestrate i" wins over "p".
 */
export function detectTrigger(prompt        )               {
  const p = (prompt ?? "").toLowerCase();
  // Korean triggers are anchored to an action marker. 감사 ("audit") is
  // ambiguous with 감사 ("thanks"), so AUDIT REQUIRES a strong do-it marker
  // (해줘/해라/하자/좀/진행/부탁) and rejects the bare/polite thanks forms
  // 감사 / 감사해 / 감사해요 / 감사합니다 (Galileo blocker #1).
  if (/\binterview\b|인터뷰|\borchestrate i\b/.test(p)) return "I";
  if (/\borchestrate p\b|plan this|계획(?:을)?\s*세워/.test(p)) return "P";
  if (/\borchestrate a\b|audit this|감사\s*(?:해줘|해라|하자|좀|진행|부탁)/.test(p)) return "A";
  if (/\borchestrate b\b|build this|구현\s*(?:해|하자|좀)/.test(p)) return "B";
  if (/\borchestrate c\b|check this|검증\s*(?:해|하자|좀)/.test(p)) return "C";
  return null;
}

const PHASE_DIRECTIVES                                 = {
  I: [
    "[codexclaw: INTERVIEW]",
    "Clarify requirements before planning. Cover four dimensions — Goal, Constraint,",
    "Success criteria, Ontology. Research the repo first, then ask focused questions.",
    "When you ask, use request_user_input with background + 2-3 concrete options",
    "(recommendation FIRST) + one impact/tradeoff sentence per option. Do NOT start implementing yet.",
  ].join("\n"),
  P: [
    "[codexclaw: PLAN]",
    "Write a diff-level plan: file change map, scope boundary (IN/OUT), and testable",
    "accept criteria. Ground decisions in real code you have read. No implementation yet.",
  ].join("\n"),
  A: [
    "[codexclaw: AUDIT]",
    "Audit the plan adversarially before building. Dispatch an independent reviewer",
    "(sub-agent) to challenge assumptions, find blockers, and verify references. Fold",
    "fixes back into the plan and record the verdict.",
  ].join("\n"),
  B: [
    "[codexclaw: BUILD]",
    "Implement the audited plan in small atomic commits. Verify as you go (run tests).",
    "Stay inside the plan's scope boundary; surface deviations instead of silently expanding.",
  ].join("\n"),
  C: [
    "[codexclaw: CHECK]",
    "Run the real verification: tests, type checks, and adversarial review. Capture fresh",
    "command output as evidence. Do not claim pass without artifact-level proof.",
  ].join("\n"),
  D: [
    "[codexclaw: DONE]",
    "Summarize what was checked with evidence, update STATUS/devlog, and commit. Confirm",
    "no pending work remains for this work-phase before closing.",
  ].join("\n"),
};

export function phaseDirective(phase       )         {
  return PHASE_DIRECTIVES[phase] ?? "";
}

export function interviewDirective()         {
  return PHASE_DIRECTIVES.I;
}

/**
 * Question-shape directive (L10.1 / 101). The main session (never a subagent)
 * uses request_user_input with this shape: background + why it matters + where
 * the answer changes the plan, 2-3 concrete options, recommendation FIRST, and
 * one impact/tradeoff sentence per option. assistant-emitted choice fences are
 * not the primary selector.
 */
export const QUESTION_SHAPE_DIRECTIVE = [
  "[codexclaw: INTERVIEW — user question]",
  "Ask via request_user_input only (not an assistant choice fence). Each question must include:",
  "- background: what is unresolved and why it matters,",
  "- where the answer changes the plan,",
  "- 2-3 concrete options (recommendation FIRST),",
  "- one impact/tradeoff sentence per option.",
  "Only the main session asks; subagents never generate or deliver questions.",
  "While a question is pending, refuse or restate unrelated free-form answers.",
].join("\n");

const STAGE_LABELS                                 = {
  I: "INTERVIEW",
  P: "PLAN",
  A: "AUDIT",
  B: "BUILD",
  C: "CHECK",
  D: "DONE",
};

/** Short compaction-immune stage header (jwc pabcd-stage-header parity). */
export function buildStageHeader(phase       )         {
  return `[codexclaw — ${phase}: ${STAGE_LABELS[phase] ?? phase}]`;
}

/** Cap injectedTurns to the most recent N to bound state-file growth (audit blocker #2). */
const MAX_INJECTED_TURNS = 50;
function appendTurn(turns          , turn        )           {
  return [...turns, turn].slice(-MAX_INJECTED_TURNS);
}

/**
 * Build the codex hook stdout line. Normalizes CRLF, trims, caps at 32k, and
 * wraps in the omo-parity envelope. Empty context => "" (no injection).
 */
export function buildContextOutput(eventName        , ctx        )         {
  const norm = (ctx ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!norm) return "";
  const capped =
    norm.length <= MAX_CTX
      ? norm
      : `${norm.slice(0, MAX_CTX - 64).replace(/[ \t\r\n]+$/, "")}\n\n[truncated]`;
  return `${JSON.stringify({
    hookSpecificOutput: { hookEventName: eventName, additionalContext: capped },
  })}\n`;
}

/**
 * UserPromptSubmit handler — hybrid directive injection (018.3, audit-revised).
 *
 * Idempotent per (session, turn) via state.injectedTurns. Three modes, all
 * gated FAIL-CLOSED behind state.orchestrationActive so an un-orchestrated
 * session injects NOTHING (jwc parity; audit blocker #1):
 *  - mode 1 (explicit trigger, any phase): inject the full phase directive and
 *    turn orchestration ON. This is the ONLY way orchestration activates.
 *  - mode 2 (active, no trigger, phase changed since last inject): inject the
 *    full directive for the current phase (state-transition directive).
 *  - mode 3 (active, no trigger, same phase): inject the short stage header
 *    every turn (compaction-immune, jwc M2 parity).
 */
export function handleUserPromptSubmit(payload                         )         {
  if (payload.hook_event_name !== "UserPromptSubmit") return "";
  const turn = payload.turn_id ?? "";
  const state = readState(payload.cwd, payload.session_id);
  if (turn && state.injectedTurns.includes(turn)) return "";

  const trigger = detectTrigger(payload.prompt);

  // mode 1: explicit trigger activates orchestration and injects the full directive.
  if (trigger) {
    const directive = trigger === "I" ? interviewDirective() : phaseDirective(trigger);
    if (turn) {
      writeState(payload.cwd, {
        ...state,
        orchestrationActive: true,
        lastInjectedPhase: trigger,
        injectedTurns: appendTurn(state.injectedTurns, turn),
      });
    }
    return buildContextOutput("UserPromptSubmit", directive);
  }

  // fail-closed: no trigger and orchestration never activated -> stay silent.
  if (!state.orchestrationActive) return "";

  // R-11 transcript-grounded idempotency (passive modes only; explicit trigger
  // above already injected). The local injectedTurns flag dedups within a turn,
  // but turn_id can churn/reset after compaction. Read the transcript tail and:
  //  - suppress under context-pressure/compaction recovery (don't pile on), and
  //  - skip when the current phase's stage marker is already present in the tail.
  const tail = readTranscriptTail(payload.transcript_path);
  if (isContextPressureTail(tail)) return "";
  if (hasStageMarkerForPhase(tail, state.phase)) {
    if (turn) {
      writeState(payload.cwd, {
        ...state,
        lastInjectedPhase: state.phase,
        injectedTurns: appendTurn(state.injectedTurns, turn),
      });
    }
    return "";
  }

  // mode 2: phase changed since the last injected phase -> full directive.
  if (state.phase !== state.lastInjectedPhase) {
    const directive = state.phase === "I" ? interviewDirective() : phaseDirective(state.phase);
    if (turn) {
      writeState(payload.cwd, {
        ...state,
        lastInjectedPhase: state.phase,
        injectedTurns: appendTurn(state.injectedTurns, turn),
      });
    }
    return buildContextOutput("UserPromptSubmit", directive);
  }

  // mode 3: same phase -> short compaction-immune stage header every turn.
  if (turn) {
    writeState(payload.cwd, {
      ...state,
      injectedTurns: appendTurn(state.injectedTurns, turn),
    });
  }
  return buildContextOutput("UserPromptSubmit", buildStageHeader(state.phase));
}

/**
 * Stop handler — PASSIVE in Pass 2. Intentionally a no-op: emits nothing and
 * writes no ledger/state. FSM auto-advance is deferred (see header + plan 018.2).
 */
export function handleStop(_payload             )         {
  return "";
}
