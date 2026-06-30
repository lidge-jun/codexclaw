/**
 * hook.ts — pure hook logic (no process IO; stdin/stdout handled by cli.ts).
 *
 * UserPromptSubmit: detect an explicit IPABCD/interview trigger in the prompt
 * and inject the matching phase directive as additionalContext. Idempotent per
 * (session, turn): a turn_id is recorded in state.injectedTurns so a re-fired
 * hook in the same turn does not double-inject.
 *
 * Stop: active under a native goal only. It returns a bounded
 * `{decision:"block",reason}` continuation envelope while a PABCD cycle is in flight,
 * then releases on re-entry, IDLE/inactive state, no active goal, context pressure, or
 * the same-phase stagnation cap.
 *
 * Ground truth:
 *  - payload field names: codex-rs hooks/src/events/{user_prompt_submit,stop}.rs (snake_case)
 *  - output shape:        omo rules/src/hook-output.ts:10-16 (camelCase hookSpecificOutput)
 */
import { appendLedger, readState, writeState, type Phase } from "./state.ts";
import { hasStageMarkerForPhase, isContextPressureTail, readTranscriptTail } from "./transcript.ts";
import { getGoalActiveStatus, suppressesInterview } from "./goal-active.ts";
import { parseOrchestrateCommand } from "./orchestrate-grammar.ts";
import { applyHumanTransition } from "./orchestrate-apply.ts";

export interface UserPromptSubmitPayload {
  hook_event_name: "UserPromptSubmit";
  session_id: string;
  cwd: string;
  prompt: string;
  transcript_path?: string | null;
  turn_id?: string;
  model?: string;
  permission_mode?: string;
}

export interface StopPayload {
  hook_event_name: "Stop";
  session_id: string;
  cwd: string;
  transcript_path?: string | null;
  turn_id?: string;
  stop_hook_active?: boolean;
  last_assistant_message?: string | null;
}

const MAX_CTX = 32_000;

/**
 * Detect an explicit IPABCD/interview trigger. Explicit only — no goal-mode
 * branch (A3 decision, see 022.3). Both English and Korean phrasings.
 * Order matters: interview is checked first so "orchestrate i" wins over "p".
 */
export function detectTrigger(prompt: string): Phase | null {
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

const PHASE_DIRECTIVES: Partial<Record<Phase, string>> = {
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

export function phaseDirective(phase: Phase): string {
  return PHASE_DIRECTIVES[phase] ?? "";
}

export function interviewDirective(): string {
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

const STAGE_LABELS: Partial<Record<Phase, string>> = {
  I: "INTERVIEW",
  P: "PLAN",
  A: "AUDIT",
  B: "BUILD",
  C: "CHECK",
  D: "DONE",
};

/** Short compaction-immune stage header (jwc pabcd-stage-header parity). */
export function buildStageHeader(phase: Phase): string {
  return `[codexclaw — ${phase}: ${STAGE_LABELS[phase] ?? phase}]`;
}

/**
 * L5 — phase footer directive. codex has no status UI, so the model surfaces its own
 * PABCD state by printing one line at the end of each reply. Resting states are IDLE
 * and the work phases I/P/A/B/C; D is the closing transition (after it, the resting
 * state is IDLE), so a chat D-close shows IDLE.
 */
export function phaseFooter(phase: Phase): string {
  const label = STAGE_LABELS[phase] ?? phase;
  return `At the end of your reply, print exactly one status line: \`IPABCD: ${phase} (${label})\`. D is a closing transition — once a cycle closes, the resting state is IDLE.`;
}

/** Append the phase footer to a directive/header (one blank line between). */
export function withFooter(directive: string, phase: Phase): string {
  if (!directive) return directive;
  return `${directive}\n\n${phaseFooter(phase)}`;
}

/** Cap injectedTurns to the most recent N to bound state-file growth (audit blocker #2). */
const MAX_INJECTED_TURNS = 50;
function appendTurn(turns: string[], turn: string): string[] {
  return [...turns, turn].slice(-MAX_INJECTED_TURNS);
}

/**
 * Build the codex hook stdout line. Normalizes CRLF, trims, caps at 32k, and
 * wraps in the omo-parity envelope. Empty context => "" (no injection).
 */
export function buildContextOutput(eventName: string, ctx: string): string {
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
export function handleUserPromptSubmit(payload: UserPromptSubmitPayload): string {
  if (payload.hook_event_name !== "UserPromptSubmit") return "";
  const turn = payload.turn_id ?? "";
  const state = readState(payload.cwd, payload.session_id);
  if (turn && state.injectedTurns.includes(turn)) return "";

  // L3b: parser-first AUTHORITATIVE path. An explicit, line-anchored
  // `orchestrate <verb>` command actually moves the FSM (the missing wire). This is
  // the HUMAN (chat) source → free-pass: forward edges advance without --attest.
  // The loose detectTrigger heuristic below runs ONLY when this returns null.
  const command = parseOrchestrateCommand(payload.prompt);
  if (command) {
    const out = handleOrchestrateCommand(payload, state, turn, command);
    if (out !== null) return out;
    // null => fall through to the loose path (e.g. suppressed interview).
  }

  const trigger = detectTrigger(payload.prompt);

  // L11: in active goal mode, the Interview (I) phase is suppressed — do not inject
  // the I directive and do not create/update interview state (HOTL boundary). Other
  // phase triggers (P/A/B/C) still work; goal mode runs PABCD, just never reopens I.
  if (trigger === "I" && suppressesInterview(getGoalActiveStatus(payload.session_id))) {
    return "";
  }

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
    return buildContextOutput("UserPromptSubmit", withFooter(directive, trigger));
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
    return buildContextOutput("UserPromptSubmit", withFooter(directive, state.phase));
  }

  // mode 3: same phase -> short compaction-immune stage header every turn.
  if (turn) {
    writeState(payload.cwd, {
      ...state,
      injectedTurns: appendTurn(state.injectedTurns, turn),
    });
  }
  return buildContextOutput("UserPromptSubmit", withFooter(buildStageHeader(state.phase), state.phase));
}

/** L5 — one-line human status for the chat `orchestrate status` affordance. */
export function renderStatusLine(phase: Phase, flags: { interview: boolean; auditPassed: boolean; checkPassed: boolean }): string {
  const label = STAGE_LABELS[phase] ?? phase;
  return `[codexclaw status] IPABCD: ${phase} (${label}) · interview=${flags.interview} auditPassed=${flags.auditPassed} checkPassed=${flags.checkPassed}`;
}

/**
 * L3b — apply an explicit chat orchestrate command to file state (human free-pass),
 * persist phase + ledger, and return the directive/status/reset line. Returns null
 * to defer to the loose path (goal-mode interview suppression only).
 */
function handleOrchestrateCommand(
  payload: UserPromptSubmitPayload,
  state: ReturnType<typeof readState>,
  turn: string,
  command: NonNullable<ReturnType<typeof parseOrchestrateCommand>>,
): string | null {
  // HIGH fix: preserve goal-mode Interview suppression on the parser path too,
  // before any state/ledger write (HOTL boundary).
  if (command.verb === "I" && suppressesInterview(getGoalActiveStatus(payload.session_id))) {
    return null;
  }

  const result = applyHumanTransition(state, command.verb, command.attest);
  if (!result.ok) {
    // Refused (illegal adjacency): surface the reason, do not write state/ledger.
    return buildContextOutput("UserPromptSubmit", `[codexclaw — refused: ${result.reason}]`);
  }

  // status: read-only, no state change, no ledger.
  if (result.control === "status") {
    return buildContextOutput("UserPromptSubmit", renderStatusLine(state.phase, state.flags));
  }

  // reset-from-IDLE no-op: recognized but nothing to write.
  if (result.noop) {
    return buildContextOutput("UserPromptSubmit", "[codexclaw — already IDLE]");
  }

  // State-changing command: persist phase + record the turn (same-turn dedup so a
  // re-fire does not double-append the ledger) BEFORE returning.
  if (result.state) {
    writeState(payload.cwd, {
      ...result.state,
      orchestrationActive: result.control === "reset" || result.control === "done" ? false : true,
      lastInjectedPhase: result.control === "reset" || result.control === "done" ? null : result.state.phase,
      injectedTurns: turn ? appendTurn(state.injectedTurns, turn) : state.injectedTurns,
      // L6: a real chat transition is progress -> reset the Stop stagnation guard.
      stopBlockPhase: null,
      stopBlockCount: 0,
    });
  }
  if (result.ledger) appendLedger(payload.cwd, result.ledger);

  if (result.control === "reset") {
    return buildContextOutput("UserPromptSubmit", "[codexclaw — reset → IDLE]");
  }
  // done: chat D-close. Inject the DONE summary directive this turn; the resting
  // state is already IDLE, so the footer surfaces IDLE.
  if (result.control === "done") {
    return buildContextOutput("UserPromptSubmit", withFooter(phaseDirective("D"), "IDLE"));
  }
  const phase = result.state?.phase ?? state.phase;
  const directive = phase === "I" ? interviewDirective() : phaseDirective(phase);
  return buildContextOutput("UserPromptSubmit", withFooter(directive, phase));
}

/** L6 — max consecutive Stop blocks at the SAME phase before the loop releases. */
export const MAX_STOP_BLOCKS = 3;

const STOP_NEXT_COMMAND: Partial<Record<Phase, string>> = {
  I: '`cxc orchestrate P --attest \'{"from":"I","to":"P","did":"interview complete with recorded requirements"}\'`',
  P: '`cxc orchestrate A --attest \'{"from":"P","to":"A","did":"diff-level plan written with files and acceptance criteria"}\'`',
  A: '`cxc orchestrate B --attest \'{"from":"A","to":"B","did":"independent audit PASS; blockers folded into plan"}\'`',
  B: '`cxc orchestrate C --attest \'{"from":"B","to":"C","did":"implementation completed and verifier reviewed it"}\'`',
  C: '`cxc orchestrate D --attest \'{"from":"C","to":"D","did":"checks passed","checkOutput":"<test tail>","exitCode":0}\'`',
  D: '`cxc orchestrate reset` after the DONE summary is recorded',
};

/**
 * L6 — build the Stop `{decision:"block",reason}` envelope (NOT the UserPromptSubmit
 * additionalContext shape). The reason nudges the agent to advance the current phase.
 */
export function buildStopBlock(phase: Phase): string {
  const label = STAGE_LABELS[phase] ?? phase;
  const nextCommand = STOP_NEXT_COMMAND[phase] ?? "`cxc orchestrate status`";
  const reason = [
    `[codexclaw — continue PABCD] You are mid-cycle at ${phase} (${label}) with an active goal.`,
    "Do the real work of this phase, then self-advance with the concrete next command:",
    nextCommand,
    "C→D requires checkOutput+exitCode. D is not a resting state; close the cycle back to IDLE.",
  ].join("\n");
  return `${JSON.stringify({ decision: "block", reason })}\n`;
}

/**
 * Stop handler — L6 active continuation with a bounded stagnation guard so the loop
 * ALWAYS terminates. Blocks (keeps the agent going) only when a PABCD cycle is genuinely
 * in flight under an active goal; releases via any of: stop_hook_active, IDLE/inactive
 * orchestration, no active goal, context pressure, or the MAX_STOP_BLOCKS cap.
 */
export function handleStop(payload: StopPayload): string {
  if (payload.hook_event_name !== "Stop") return "";
  // guard 1: codex is already in a stop-hook-driven continuation -> release.
  if (payload.stop_hook_active) return "";

  const state = readState(payload.cwd, payload.session_id);
  // guard 2a: no cycle in flight -> nothing to continue.
  if (!state.orchestrationActive || state.phase === "IDLE") return "";
  // guard 2b: only an ACTIVE goal arms the autonomous loop (interactive sessions pause).
  if (getGoalActiveStatus(payload.session_id) !== "active") return "";
  // bail: don't pile on during context-pressure/compaction recovery.
  if (isContextPressureTail(readTranscriptTail(payload.transcript_path))) return "";

  // stagnation guard: bound consecutive blocks at the SAME phase. A real transition
  // resets the counter (done at the transition persist sites), so a healthy cycle gets
  // a fresh budget per phase; a stuck agent releases after MAX_STOP_BLOCKS.
  const samePhase = state.stopBlockPhase === state.phase;
  const nextCount = samePhase ? state.stopBlockCount + 1 : 1;
  if (nextCount > MAX_STOP_BLOCKS) {
    // give up the loop: reset the counter and release so the turn can end.
    writeState(payload.cwd, { ...state, stopBlockPhase: null, stopBlockCount: 0 });
    return "";
  }
  writeState(payload.cwd, { ...state, stopBlockPhase: state.phase, stopBlockCount: nextCount });
  return buildStopBlock(state.phase);
}
