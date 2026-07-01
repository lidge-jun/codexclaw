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
import { appendLedger, readState, writeState,                        } from "./state.js";
import { hasStageMarkerForPhase, isContextPressureTail, readTranscriptTail } from "./transcript.js";
import { getGoalActiveStatus, suppressesInterview } from "./goal-active.js";
import { parseOrchestrateCommand } from "./orchestrate-grammar.js";
import { applyHumanTransition } from "./orchestrate-apply.js";
import { captureInterviewAnswers } from "./interview-ledger.js";
import { MIND_DISPATCH_DIRECTIVE } from "./minds.js";
import { checkObjectivePlateau, readObjectiveKind,                   } from "./metrics.js";
import { readGoalplan, nextOpenTask, unmetCriteria } from "./goalplan.js";
import { peakFrictionVerdict, looksLikeFailure, recordFriction } from "./friction.js";

































/**
 * PostCompact payload (lazygap_impl 050). Fires after a context compaction. Wire shape
 * verified against codex-rs `schema.rs:362` (`PostCompactCommandInput`, snake_case) +
 * `compact.rs:207` (`hook_event_name: "PostCompact"`). Both `session_id` and `cwd` are
 * present, so state path resolution works. Output is side-effect-only (the runtime honors
 * only universal fields), so the handler always returns "".
 */









/**
 * SubagentStop payload (lazygap_impl 010). Fires when a plugin thread-spawned child
 * ends its turn. Wire shape verified against codex-rs `schema.rs:576`
 * (`SubagentStopCommandInput`, snake_case). NOTE: `transcript_path` is the PARENT
 * transcript; the CHILD's transcript is `agent_transcript_path`
 * (codex-rs `hook_runtime.rs:302`) — the compaction bail must read the child path.
 */















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

/**
 * Detect a user asking to route a question/research task through agbrowse.
 * This is intentionally narrower than "mentions agbrowse": implementation work
 * about the hook or package should not be mistaken for a search request.
 */
export function detectAgbrowseSearchRequest(prompt        )          {
  const p = (prompt ?? "").toLowerCase();
  if (!/\bagbrows?e\b/.test(p)) return false;
  return (
    /\b(?:through|via|using|use|with|ask|question|research|search|browse|look\s*up|find|fetch|verify)\b/.test(p) ||
    /(?:통해|통해서|사용|써서|가지고|질문|물어|조사|검색|리서치|알아봐|찾아|확인|검증|브라우즈)/.test(p)
  );
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
  // L17: the I directive now carries the Mind-dispatch contract so the main session
  // actually runs the contradiction-rescan loop (select Minds -> dispatch read-only
  // lenses -> triage -> ask the user proceed/keep-interviewing). This is what wires
  // minds.ts into the production hook path. It only ever reaches the agent OUTSIDE a
  // goal: the goal-active firewall (explicit + passive I-path) suppresses the whole
  // Interview when a goal is active.
  return `${PHASE_DIRECTIVES.I}\n\n${MIND_DISPATCH_DIRECTIVE}`;
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

export const AGBROWSE_SEARCH_DIRECTIVE = [
  "[codexclaw: SEARCH — agbrowse requested]",
  "The user explicitly asked to route this question/research task through agbrowse.",
  "Load and obey cxc-search before answering when available.",
  "Use agbrowse only as a known-URL proof helper: first resolve it with the cxc-search helper",
  "(`scripts/agbrowse_helper.py doctor` from the search skill), then prefer",
  "`agbrowse fetch \"<url>\" --json --browser never` or",
  "`agbrowse search --verify \"<url>\" --json --browser never` for candidate URLs.",
  "If no candidate URL is already known, use hosted web_search to discover URLs first",
  "or state that discovery is unavailable. Never use plain `agbrowse search \"<query>\"`",
  "as discovery.",
  "Escalate to `agbrowse fetch \"<url>\" --json --browser auto` only for a known",
  "blocked/JS-only URL with local Chrome available; otherwise fall back to Browser Use / Computer Use.",
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

/**
 * L5 — phase footer directive. codex has no status UI, so the model surfaces its own
 * PABCD state by printing one line at the end of each reply. Resting states are IDLE
 * and the work phases I/P/A/B/C; D is the closing transition (after it, the resting
 * state is IDLE), so a chat D-close shows IDLE.
 */
export function phaseFooter(phase       )         {
  const label = STAGE_LABELS[phase] ?? phase;
  return `At the end of your reply, print exactly one status line: \`IPABCD: ${phase} (${label})\`. D is a closing transition — once a cycle closes, the resting state is IDLE.`;
}

/** Append the phase footer to a directive/header (one blank line between). */
export function withFooter(directive        , phase       )         {
  if (!directive) return directive;
  return `${directive}\n\n${phaseFooter(phase)}`;
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

  const agbrowseRequested = detectAgbrowseSearchRequest(payload.prompt);

  // fail-closed: no trigger and orchestration never activated -> stay silent.
  if (!state.orchestrationActive) {
    if (agbrowseRequested) {
      if (turn) {
        writeState(payload.cwd, {
          ...state,
          injectedTurns: appendTurn(state.injectedTurns, turn),
        });
      }
      return buildContextOutput("UserPromptSubmit", AGBROWSE_SEARCH_DIRECTIVE);
    }
    return "";
  }

  // L17 firewall: the goal-active interview suppression must also cover the PASSIVE
  // re-injection paths (modes 2/3), not just the explicit `trigger === "I"` path above.
  // If the session is sitting in phase I and a native goal is (or becomes) active, do
  // NOT re-inject any Interview directive — goal mode is PABCD-only and the Interview
  // never fires under a goal. Fail-closed: an unreadable goal DB also suppresses.
  if (state.phase === "I" && suppressesInterview(getGoalActiveStatus(payload.session_id))) {
    return "";
  }

  // R-11 transcript-grounded idempotency (passive modes only; explicit trigger
  // above already injected). The local injectedTurns flag dedups within a turn,
  // but turn_id can churn/reset after compaction. Read the transcript tail and:
  //  - suppress under context-pressure/compaction recovery (don't pile on), and
  //  - skip when the current phase's stage marker is already present in the tail.
  const tail = readTranscriptTail(payload.transcript_path);
  if (isContextPressureTail(tail) && !agbrowseRequested) return "";
  if (hasStageMarkerForPhase(tail, state.phase)) {
    if (turn) {
      writeState(payload.cwd, {
        ...state,
        lastInjectedPhase: state.phase,
        injectedTurns: appendTurn(state.injectedTurns, turn),
      });
    }
    if (agbrowseRequested) {
      return buildContextOutput("UserPromptSubmit", AGBROWSE_SEARCH_DIRECTIVE);
    }
    return "";
  }

  // mode 2: phase changed since the last injected phase -> full directive.
  if (state.phase !== state.lastInjectedPhase) {
    const directive = state.phase === "I" ? interviewDirective() : phaseDirective(state.phase);
    const context = agbrowseRequested ? `${directive}\n\n${AGBROWSE_SEARCH_DIRECTIVE}` : directive;
    if (turn) {
      writeState(payload.cwd, {
        ...state,
        lastInjectedPhase: state.phase,
        injectedTurns: appendTurn(state.injectedTurns, turn),
      });
    }
    return buildContextOutput("UserPromptSubmit", withFooter(context, state.phase));
  }

  // mode 3: same phase -> short compaction-immune stage header every turn.
  if (turn) {
    writeState(payload.cwd, {
      ...state,
      injectedTurns: appendTurn(state.injectedTurns, turn),
    });
  }
  const header = buildStageHeader(state.phase);
  const context = agbrowseRequested ? `${header}\n\n${AGBROWSE_SEARCH_DIRECTIVE}` : header;
  return buildContextOutput("UserPromptSubmit", withFooter(context, state.phase));
}

/** L5 — one-line human status for the chat `orchestrate status` affordance. */
export function renderStatusLine(phase       , flags                                                                    )         {
  const label = STAGE_LABELS[phase] ?? phase;
  return `[codexclaw status] IPABCD: ${phase} (${label}) · interview=${flags.interview} auditPassed=${flags.auditPassed} checkPassed=${flags.checkPassed}`;
}

/**
 * L3b — apply an explicit chat orchestrate command to file state (human free-pass),
 * persist phase + ledger, and return the directive/status/reset line. Returns null
 * to defer to the loose path (goal-mode interview suppression only).
 */
function handleOrchestrateCommand(
  payload                         ,
  state                              ,
  turn        ,
  command                                                         ,
)                {
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
export const PLATEAU_METRIC_RECORDS = 2;
export const PLATEAU_NOISE_FLOOR = 0;

const STOP_NEXT_COMMAND                                 = {
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
 *
 * 040 — an OPTIONAL work context enriches the reason with the next concrete task, the
 * evidence it must produce, and the goalplan ledger path. The phase-only call
 * (`work` omitted/null) is byte-identical to the shipped reason — enrichment lines are
 * appended only when a goalplan resolved, and never replace the phase command.
 */






export function buildStopBlock(
  phase       ,
  work                         ,
  friction                                       ,
)         {
  const label = STAGE_LABELS[phase] ?? phase;
  const nextCommand = STOP_NEXT_COMMAND[phase] ?? "`cxc orchestrate status`";
  const lines = [
    `[codexclaw — continue PABCD] You are mid-cycle at ${phase} (${label}) with an active goal.`,
    "Do the real work of this phase, then self-advance with the concrete next command:",
    nextCommand,
  ];
  if (work) {
    // ENRICHMENT ONLY — appended lines; never replaces the phase command above.
    if (work.nextTaskTitle) lines.push(`Remaining work: ${work.nextTaskTitle}`);
    if (work.expectedEvidence) lines.push(`Required evidence: ${work.expectedEvidence}`);
    if (work.ledgerPath) lines.push(`Record progress in: ${work.ledgerPath}`);
  }
  // 080: friction is an ADVISORY line only (read after the arming guard); it never changes
  // whether Stop blocks. `escalate`/`stop` signal a repeated tool failure worth a rethink.
  if (friction === "escalate" || friction === "stop") {
    lines.push(
      `Friction signal (${friction}): a tool failure has recurred — review .codexclaw/friction.jsonl and change approach rather than repeating the same command.`,
    );
  }
  lines.push("C→D requires checkOutput+exitCode. D is not a resting state; close the cycle back to IDLE.");
  const reason = lines.join("\n");
  return `${JSON.stringify({ decision: "block", reason })}\n`;
}

/**
 * 040 — resolve the goalplan work context for the Stop block reason. PURE + fail-safe:
 * keys STRICTLY on the session-bound `state.slug` (persisted by `cxc goalplan init
 * --session`, 030.3). No directory scan, no DB access — a missing slug or absent/
 * unreadable goalplan returns null, so `buildStopBlock(phase, null)` is byte-identical
 * to the shipped reason. The A-gate (Copernicus) rejected any dir-scan fallback because
 * GoalplanHostLink has no session binding and could enrich the wrong goal.
 */
export function readStopWorkContext(cwd        , state       )                         {
  const slug = state.slug;
  if (!slug) return null; // no session-bound slug -> exactly today's behavior
  const plan = readGoalplan(cwd, slug);
  if (!plan) return null;
  const next = nextOpenTask(plan);
  const unmet = unmetCriteria(plan);
  if (!next && unmet.length === 0) return null; // nothing remaining -> no enrichment
  return {
    nextTaskTitle: next ? `${next.wp.title} → ${next.task.title}` : null,
    expectedEvidence: unmet[0]?.expectedEvidence ?? null,
    ledgerPath: `.codexclaw/goalplans/${slug}/ledger.jsonl`,
  };
}

export function buildPlateauDivergeBlock(phase       , plateau              )         {
  const label = STAGE_LABELS[phase] ?? phase;
  const values = plateau.values.length > 0 ? plateau.values.join(" -> ") : "n/a";
  const reason = [
    `[codexclaw — objective plateau] You are mid-cycle at ${phase} (${label}) with an active maximize goal.`,
    `The latest ${PLATEAU_METRIC_RECORDS} ${plateau.metricName ?? "objective"} metric value(s) are non-improving: ${values}.`,
    "Step back and re-plan with divergence: record at least two grounded candidate approaches, choose the collapse point, then continue PABCD.",
    "Do not ask the user while the goal is active; record assumptions or an unresolved-tie note for later review.",
  ].join("\n");
  return `${JSON.stringify({ decision: "block", reason })}\n`;
}

function objectivePlateau(cwd        , sessionId        )               {
  try {
    if (readObjectiveKind(cwd, sessionId) !== "maximize") return { flat: false, metricName: null, values: [] };
    return checkObjectivePlateau(cwd, sessionId, {
      minRecords: PLATEAU_METRIC_RECORDS,
      noiseFloor: PLATEAU_NOISE_FLOOR,
    });
  } catch {
    return { flat: false, metricName: null, values: [] };
  }
}

/**
 * Stop handler — L6 active continuation with a bounded stagnation guard so the loop
 * ALWAYS terminates. Blocks (keeps the agent going) only when a PABCD cycle is genuinely
 * in flight under an active goal; releases via any of: stop_hook_active, IDLE/inactive
 * orchestration, no active goal, context pressure, or the MAX_STOP_BLOCKS cap.
 */
export function handleStop(payload             )         {
  if (payload.hook_event_name !== "Stop") return "";
  // guard 1: codex is already in a stop-hook-driven continuation -> release.
  if (payload.stop_hook_active) return "";

  const state = readState(payload.cwd, payload.session_id);
  // guard 2a: no cycle in flight -> nothing to continue.
  if (!state.orchestrationActive || state.phase === "IDLE") return "";
  // guard 2a': the autonomous Stop loop is PABCD-only. The Interview is HITL-only and
  // is NEVER driven by Stop — even if a session is sitting at phase=I when a goal is
  // (or becomes) active, the loop does not continue the interview. This matches the
  // goal firewall (Interview never fires under a goal) on the Stop surface too.
  if (state.phase === "I") return "";
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
  const plateau = objectivePlateau(payload.cwd, payload.session_id);
  if (plateau.flat) return buildPlateauDivergeBlock(state.phase, plateau);
  // 040: enrich the block reason with goalplan-derived remaining work (text-only, after
  // every release guard + the cap). null context => byte-identical shipped reason.
  // 080: a HIGH friction signal adds an advisory escalate line to the SAME block — it is
  // read ONLY here, after the goal-active arming guard + the cap, so it never changes when
  // Stop blocks vs releases (arming is unchanged). FAIL-OPEN: null verdict => no line.
  return buildStopBlock(state.phase, readStopWorkContext(payload.cwd, state), peakFrictionVerdict(payload.cwd));
}

/**
 * PostToolUse handler (L12 WP4) — capture a `request_user_input` round into the
 * durable interview ledger. PURE side-effect recorder: it never blocks or emits a
 * decision (PostToolUse runs AFTER the tool already executed), so it always returns
 * "". Only acts on the request_user_input tool; everything else is a no-op.
 *
 * Goal-mode note: the PreToolUse interview deny is a SEPARATE hook that fires before
 * the tool runs, so when a goal is active the call is denied and never reaches here —
 * no conflict. When goal mode is inactive (interactive interview), this records the
 * question + answer for replay/evidence.
 */
export function handlePostToolUse(payload                    )         {
  if (payload.hook_event_name !== "PostToolUse") return "";
  if (payload.tool_name !== "request_user_input") return "";
  captureInterviewAnswers({
    cwd: payload.cwd,
    sessionId: payload.session_id,
    turnId: payload.turn_id ?? "",
    toolInput: payload.tool_input,
    toolResponse: payload.tool_response,
  });
  return "";
}

/**
 * PostToolUse friction CAPTURE for shell tools (lazygap_impl 080.1). Matcher `^Bash$`
 * (both exec_command and shell_command normalize to "Bash"). HEURISTIC by necessity:
 * codex-rs PostToolUse carries no error/exit_code, only a TRUNCATED `tool_response`
 * text, and apply_patch failures never reach PostToolUse — so this scans the response
 * text for failure markers and records a friction signature when it looks like a
 * failure. It is NOT complete tool-failure observability. Side-effect only (returns "").
 */
export function handleBashFrictionCapture(payload                    )         {
  if (payload.hook_event_name !== "PostToolUse") return "";
  if (payload.tool_name !== "Bash") return "";
  const text = typeof payload.tool_response === "string"
    ? payload.tool_response
    : (() => {
        try {
          return JSON.stringify(payload.tool_response ?? "");
        } catch {
          return "";
        }
      })();
  if (looksLikeFailure(text)) {
    recordFriction(payload.cwd, "Bash", text);
  }
  return "";
}

/**
 * PostCompact handler (lazygap_impl 050) — side-effect-only compaction recovery.
 *
 * After a context compaction, codexclaw would otherwise re-surface only the SHORT stage
 * header on the next same-phase prompt (mode-3), because `lastInjectedPhase` still equals
 * the current phase. This resets ONLY that cursor so the first NON-SUPPRESSED same-phase
 * prompt upgrades to the FULL phase directive (mode-2: `phase !== lastInjectedPhase`).
 *
 * It does NOT touch phase, flags, the stagnation counter, the goalplan, or the goal DB, and
 * it does NOT bypass the context-pressure suppression (which correctly runs first) — so it
 * does not guarantee re-inject on the immediately next prompt, only that the first eligible
 * one is the full directive. Returns "" always: PostCompact output cannot inject context
 * (codex-rs honors only universal fields), so this is a pure local-state side effect.
 */
export function handlePostCompact(payload                    )         {
  if (payload.hook_event_name !== "PostCompact") return "";
  const state = readState(payload.cwd, payload.session_id);
  // No-op unless an orchestrated cycle is in flight; nothing to recover otherwise.
  if (!state.orchestrationActive || state.phase === "IDLE") return "";
  if (state.lastInjectedPhase === null) return ""; // already reset; avoid a redundant write
  writeState(payload.cwd, { ...state, lastInjectedPhase: null });
  return "";
}
