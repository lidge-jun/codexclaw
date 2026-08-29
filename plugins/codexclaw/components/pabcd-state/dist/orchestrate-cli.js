/**
* orchestrate-cli.ts — `cxc orchestrate` terminal command (L4 / 040), the AGENT-gated
* path. Unlike the chat hook (human free-pass, L3b), phase verbs here go through the
 * un-weakened `transition()` + `validateAttest`, so an agent MUST supply real
 * `--attest` evidence to advance a forward edge. Exception: I→P supports an
 * explicit agent override (`override:true` in attest) that bypasses the interview
 * readiness gate, mirroring the human override in `orchestrate-apply.ts`.
 *
 * Shares the SAME `.codexclaw/sessions/<id>.json` state as the hook — but only when
 * the same session id is used. A mutating call therefore requires explicit
 * `--session`; it never silently invents or selects a divergent session.
 *
 * Structural argv parsing (NOT the prompt grammar): verb is argv[0]; `--attest` takes
 * the NEXT single argv token as the exact JSON string (the shell already quoted it).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { coerceAttest, validateWorkPhaseBinding, GATED_TRANSITIONS,                  } from "./attest.js";
import { canEnter, transition, isLegalEdge, VALID_TRANSITIONS } from "./fsm.js";
import { validatePlanArtifacts } from "./plan-gate.js";
import { captureSourceIdentity, compareSource, describeSource } from "./source-identity.js";
import { randomBytes } from "node:crypto";


/**
 * The A>B review binding check (060). Returns a refusal result, or null to pass.
 *
 * 260818 (LEAN-REVIEW-01) — this validates a round that EXISTS. It is no longer
 * what decides whether A>B may happen at all.
 *
 * The mandatory version deadlocked. A>B required a verdict written by the
 * SubagentStop observer, so any reason the observer did not fire — a matcher that
 * did not match the runtime's role vocabulary, a reviewer whose closing lines did
 * not parse, a reinstall that moved PLUGIN_ROOT out from under a live session —
 * became "this cycle can never leave A". The failure was silent and the only exit
 * was hand-feeding the hook its own payload. That happened repeatedly, and a gate
 * whose normal recovery is forging its own input is not a gate.
 *
 * So the round is now opt-in: no round means the form-level attest decides, and a
 * round that IS open must still be honest. A recorded verdict cannot be
 * contradicted, spent across a re-plan, or spent on a plan that changed since.
 * Verification did not get weaker — it stopped being load-bearing on one hook.
 */
function validateReviewBinding(state       , args                    , sessionId        )                                          {
  const refuse = (why        ) => ({
    code: 1,
    output: `orchestrate ${args.verb}: ${renderPhaseContext(state, sessionId)}; ${why} (LEAN-REVIEW-01). Either let the reviewer's exit record a verdict for this round, or close the round with \`cxc review-round abort --session <id>\` and advance on the attest alone. Nothing was written.`,
  });
  let plan                  = null;
  try {
    plan = readGoalplan(args.cwd, state.slug);
  } catch {
    plan = null;
  }
  // No plan, or no round: nothing to validate. The attest is the gate.
  if (!plan) return null;
  const round = latestRound(plan, "plan_audit");
  if (!round) return null;

  // A round with no RECORDED VERDICT is not a blocker. An unfinished round is
  // indistinguishable from a hook that never ran, and the mandatory version
  // resolved that ambiguity against the agent every time. Advancing past an open
  // round is the agent's call; the round's status still records it was left open.
  //
  // Keying on the verdict rather than on `status === "approved"` matters: a
  // reviewer FAIL lands as `changes_requested`, and that is a real answer which
  // must still be honoured below — not an "unfinished" round to wave through.
  if (!round.lane.verdict) return null;

  // From here a reviewer actually answered, so the answer must hold. A verdict
  // that cannot be trusted is worse than no verdict: it launders a stale or
  // foreign approval into this cycle.
  if (!round.ownerSessionId || !round.workPhaseId || !round.planEpoch || !round.planFiles || round.planFiles.length === 0) {
    return null; // a pre-binding round proves nothing; it also blocks nothing
  }
  if (round.ownerSessionId !== sessionId) return refuse(`round ${round.roundId} was approved for a different session, so it cannot be spent here`);
  if (round.planEpoch !== state.planEpoch) return refuse(`round ${round.roundId} approved an earlier plan — re-planning invalidated that approval`);
  const activeWp = effectiveActiveWorkPhaseId(plan);
  if (round.workPhaseId !== activeWp) return refuse(`round ${round.roundId} approved work-phase ${round.workPhaseId}, but ${activeWp ?? "none"} is active`);
  const current = planFilesHash(recomputed(args.cwd, round.planFiles));
  if (current !== round.planSha256) return refuse(`the plan changed after round ${round.roundId} approved it`);
  const attested = args.attest?.auditVerdict;
  if (attested && attested !== round.lane.verdict) {
    return refuse(`you attested "${attested}" but the reviewer recorded "${round.lane.verdict}"`);
  }
  return null;
}

/** REVIEW-BINDING-01 (060): one nonce per P>A. Time alone would collide on a fast
 *  re-plan, which is exactly the case the epoch exists to tell apart. */
function mintEpoch(prefix        )         {
  return `${prefix}-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;
}

/** REVIEW-BINDING-01 (060): one nonce per P>A. */
function mintPlanEpoch()         {
  return mintEpoch("e");
}
import {
  advanceWorkPhase,
  appendGoalplanLedger,
  dependencyDeadlock,
  effectiveActiveWorkPhaseId,
  GOALPLAN_LEDGER_FILE,
  goalplanDir,
  goalplanDefinitionIntegrityReasons,
  goalplanDependencyCompletionReasons,
  readGoalplan,
  withGoalplanWriteLock,
  writeGoalplan,
  absentSuccessorDetail,
  closeFixedWorkPhase,
  resumeAbsentTarget,


} from "./goalplan.js";
import { latestRound, supersedeStaleRounds } from "./review-round.js";
import { planFilesHash, recomputed } from "./review-round-cli.js";
import { validateCheckReceipt } from "./check-gate.js";
import { evaluateInterviewGate } from "./interview.js";
import { dimensionsBackedByAnswers } from "./interview-ledger.js";
import { applyHumanTransition, clearedIdle } from "./orchestrate-apply.js";
import { resetRenderLedger } from "./render-observations.js";

import {
  appendLedger,
  findForeignSessionCopies,
  LEDGER_FILE,
  matchesDcloseRecovery,
  readState,
  SESSIONS_SUBDIR,
  STATE_DIR,
  writeState,


} from "./state.js";

const VERBS                                            = {
  i: "I", p: "P", a: "A", b: "B", c: "C", d: "D", status: "status", reset: "reset",
};























function isHelpToken(value                    )          {
  return value === "help" || value === "--help" || value === "-h";
}

function readFlagValue(argv          , name        )                     {
  const idx = argv.indexOf(name);
  return idx >= 0 ? argv[idx + 1] : undefined;
}

export function renderOrchestrateHelp(platform                  = process.platform)         {
  // win32 shells cannot pass the inline JSON as one argv token, so the file flag is
  // the only workable form there (issue #31).
  const attestExamples = platform === "win32"
    ? [
        "Attestation examples (PowerShell single quotes do NOT protect embedded double",
        "quotes and cmd.exe ignores them entirely, so write the JSON to a file):",
        "  '{\"from\":\"P\",\"to\":\"A\",\"did\":\"wrote and audited the plan\",\"planUnit\":\"devlog/_plan/260714_slug\",\"workPhaseId\":\"wp1\"}' | Set-Content -Encoding utf8 .codexclaw/attest.json",
        "  cxc orchestrate A --session <id> --attest-file .codexclaw/attest.json",
      ]
    : [
        "Attestation examples:",
        "  cxc orchestrate A --session <id> --attest '{\"from\":\"P\",\"to\":\"A\",\"did\":\"wrote and audited the plan\",\"planUnit\":\"devlog/_plan/260714_slug\",\"workPhaseId\":\"wp1\"}'",
        "  cxc orchestrate B --session <id> --attest '{\"from\":\"A\",\"to\":\"B\",\"did\":\"audit passed\",\"auditOutput\":\"VERDICT: PASS\",\"auditVerdict\":\"pass\",\"workPhaseId\":\"wp1\"}'",
        "  cxc orchestrate C --session <id> --attest '{\"from\":\"B\",\"to\":\"C\",\"did\":\"implemented <files>\",\"workPhaseId\":\"wp1\"}'",
        "  cxc orchestrate D --session <id> --attest '{\"from\":\"C\",\"to\":\"D\",\"did\":\"verified\",\"checkOutput\":\"tests passed\",\"exitCode\":0,\"testReceiptPath\":\".codexclaw/evidence/<session>/test-receipt.json\",\"workPhaseId\":\"wp1\"}'",
      ];
  return [
    "cxc orchestrate — agent-gated IPABCD phase control",
    "",
    "Usage:",
    "  cxc orchestrate <I|P|A|B|C|D|status|reset> [--session <id>] [--attest <json> | --attest-file <path>] [--cwd <path>] [--json]",
    "  cxc orchestrate --help",
    "",
    "Phases:",
    "  IDLE -> P -> A -> B -> C -> D -> IDLE",
    "  I can be entered from IDLE/P/A/B/C/D to clarify requirements.",
    "  D is a closing action; the resting state after D is IDLE.",
    "",
    "Agent safety:",
    "  Mutating verbs (I/P/A/B/C/D/reset) require explicit --session <id>.",
    "  Use your current SessionStart id, or the reserved terminal key 'cli'.",
    "  status is read-only and may use the latest-session fallback when --session is omitted.",
    "",
    ...attestExamples,
    "  Every attest carries from/to naming the edge; they are coerced before any gate runs.",
    "  (workPhaseId is required on gated edges whenever a goalplan is bound to the session,",
    "   and testReceiptPath is required on C -> D for a bound session — see `cxc receipt test`)",
    "",
    "Status:",
    "  cxc orchestrate status --session <id>",
    "  cxc orchestrate status --session <id> --json",
  ].join("\n");
}

/** Structural argv parse. argv excludes the `orchestrate` kind token. */
export function parseOrchestrateCliArgs(argv          , cwd        )                       {
  if (argv.length === 0 || argv.some(isHelpToken)) return { help: true, cwd };

  const verbTok = (argv[0] ?? "").toLowerCase();
  const verb = VERBS[verbTok];
  if (!verb) {
    return {
      error: `unknown orchestrate verb '${argv[0] ?? ""}' (expected I|P|A|B|C|D|status|reset); run cxc orchestrate --help`,
      session: readFlagValue(argv, "--session"),
      cwd: readFlagValue(argv, "--cwd") ?? cwd,
    };
  }

  let attest                     = null;
  let attestError                    ;
  let attestFile                    ;
  let sawInlineAttest = false;
  let session                    ;
  let cwdOut = cwd;
  let json = false;

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--attest") {
      sawInlineAttest = true;
      const raw = argv[++i];
      if (raw === undefined) { attestError = "--attest requires a JSON argument"; continue; }
      try {
        const parsed = JSON.parse(raw)           ;
        const coerced = coerceAttest(parsed);
        if (!coerced) attestError = "attest JSON missing valid from/to";
        else attest = coerced;
      } catch {
        attestError = "attest JSON is not valid JSON";
      }
    } else if (a === "--attest-file") {
      const raw = argv[++i];
      if (raw === undefined) { attestError = "--attest-file requires a path argument"; continue; }
      // Resolved AFTER the loop: --cwd may still be ahead of us in argv order.
      attestFile = raw;
    } else if (a === "--session") {
      session = argv[++i];
    } else if (a === "--cwd") {
      cwdOut = argv[++i] ?? cwd;
    } else if (a === "--json") {
      json = true;
    }
  }
  if (attestFile !== undefined) {
    if (sawInlineAttest) {
      attestError = "pass --attest OR --attest-file, not both";
    } else {
      const path = resolve(cwdOut, attestFile);
      try {
        // Windows PowerShell 5.1 `Set-Content -Encoding utf8` writes a UTF-8 BOM, and
        // JSON.parse rejects it. Stripping it here is what makes the documented
        // win32 write-then-attest recipe actually work.
        const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
        const parsed = JSON.parse(text)           ;
        const coerced = coerceAttest(parsed);
        if (!coerced) attestError = `attest file ${path} is missing valid from/to`;
        else attest = coerced;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        attestError = `could not read the attest file at ${path} (${msg})`;
      }
    }
  }
  return { verb, attest, attestError, session, cwd: cwdOut, json };
}

/**
 * Resolve the target session id. Explicit `--session` wins; else the most-recently
 * modified `.codexclaw/sessions/*.json` (ties broken by filename); else null when no
 * session exists. Never throws on a missing/empty dir.
 */
export function resolveSession(cwd        , explicit         )                {
  if (explicit) return explicit;
  const dir = join(cwd, STATE_DIR, SESSIONS_SUBDIR);
  if (!existsSync(dir)) return null;
  let best                                       = null;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json") || f.endsWith(".tmp")) continue;
    const id = f.slice(0, -".json".length);
    let mtime = 0;
    try { mtime = statSync(join(dir, f)).mtimeMs; } catch { continue; }
    if (!best || mtime > best.mtime || (mtime === best.mtime && id < best.id)) {
      best = { id, mtime };
    }
  }
  return best?.id ?? null;
}

/**
 * Reserved explicit terminal session keys the CLI may bootstrap (create-on-write)
 * without a pre-existing file. A real codex session id is NEVER in this set — those
 * are created by the hook, and the CLI only rides an existing one. This keeps an
 * explicit `--session <typo-or-new-uuid>` from silently minting a divergent session
 * on a mutating verb (G2 / L20). `cli` is the documented terminal bootstrap key.
 */
export const RESERVED_SESSION_KEYS                      = new Set(["cli"]);

/** True when a session file already exists for this id under the cwd. */
function sessionFileExists(cwd        , sessionId        )          {
  return existsSync(join(cwd, STATE_DIR, SESSIONS_SUBDIR, `${sessionId}.json`));
}

function renderPhaseContext(state       , sessionId        )         {
  return `current=${state.phase} session=${sessionId}`;
}

/**
 * Build the recovery half of a malformed-attest refusal (260825 wp1).
 *
 * The old text was the bare `attest JSON missing valid from/to`, which names the
 * problem and nothing else — and it was the single most-hit agent-facing failure
 * in the archive, because the skill table that agents copy never listed from/to
 * at all. An agent whose attest was EMPTY already got a worked example from
 * `attest.ts`; an agent whose attest was INCOMPLETE got nothing and retried the
 * same omission.
 *
 * An earlier draft of the fix assumed the parser cannot know which edge is being
 * advanced, and proposed `"<current>"/"<target>"` placeholders. An audit
 * disproved it: `verb` is argv[0], resolved before the attest loop runs, so `to`
 * is ALWAYS known, and the caller already reads session state on this exact error
 * path, so `from` is known whenever `--session` resolves. A placeholder appears
 * only for the value that genuinely cannot be determined.
 *
 * The extra keys named are the ones for THIS edge, not a menu of every key the
 * FSM has. A menu would leave the agent guessing which half applies — the same
 * failure in a longer form.
 */
export function renderAttestShapeHint(verb                 , from              )         {
  if (verb === "status" || verb === "reset") return "";
  const to = verb;
  // A hint is only useful if the attest it teaches would be ACCEPTED. When the
  // requested edge is illegal from the current phase, printing the real phase as
  // `from` hands the agent an object that clears this gate and is then refused by
  // the FSM adjacency check — two wrong refusals instead of one. In that case say
  // what is actually wrong: the edge, not the JSON.
  const legal = from === null || isLegalEdge(from, to);
  if (from !== null && !legal) {
    return (
      ` Note ${from} -> ${to} is not a legal edge, so no attest can advance it:` +
      ` legal from ${from} is ${(VALID_TRANSITIONS[from] ?? []).join("|")}.`
    );
  }
  const fromText = from ?? "<see status>";
  const extras                                           = {
    A: ', plus "planUnit":"devlog/_plan/YYMMDD_slug"',
    B: ', plus "auditOutput":"<reviewer verdict tail>" and "auditVerdict":"pass|near-pass|fail"',
    D: ', plus "checkOutput":"<command output tail>" and "exitCode":0',
  };
  const extra = extras[to] ?? "";
  const statusHint = from
    ? ""
    : " Run `cxc orchestrate status --session <id>` to read the current phase.";
  return (
    ` Every attest names the edge it advances: {"from":"${fromText}","to":"${to}","did":"..."}${extra}.` +
    ` A goalplan-bound session also needs "workPhaseId"${to === "D" ? ' and "testReceiptPath"' : ''}.` +
    statusHint
  );
}

function renderStatus(state       , json         , elsewhere           = [])         {
  if (json) {
    return JSON.stringify({
      phase: state.phase,
      flags: state.flags,
      sessionId: state.sessionId,
      ...(elsewhere.length > 0 ? { alsoFoundAt: elsewhere } : {}),
    });
  }
  const line = `session=${state.sessionId} phase=${state.phase} interview=${state.flags.interview} auditPassed=${state.flags.auditPassed} checkPassed=${state.flags.checkPassed}`;
  // #48: the same id in two trees means this line describes only ONE of them.
  // Reporting IDLE for a cycle that is really in flight next door is the failure
  // this warning exists to prevent.
  if (elsewhere.length === 0) return line;
  return [
    line,
    `WARNING: this session id also has state in ${elsewhere.length} other tree(s); the phase above describes THIS cwd only.`,
    ...elsewhere.map((p) => `  also at: ${p}`),
    "  Pass --cwd <path> to address a specific tree.",
  ].join("\n");
}

export function renderOrchestrateParseError(error               )         {
  if (error.session && sessionFileExists(error.cwd, error.session)) {
    const state = readState(error.cwd, error.session);
    return `orchestrate: ${renderPhaseContext(state, error.session)}; ${error.error}`;
  }
  return `orchestrate: ${error.error}`;
}



/** Execute a parsed orchestrate CLI command. Does its own state IO. Never throws. */







function readJsonlObjects(path        )                                 {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean)
    .map((line) => JSON.parse(line)                           );
}

function hasGoalplanRow(cwd        , slug        , event        , detail        )          {
  return readJsonlObjects(join(goalplanDir(cwd, slug), GOALPLAN_LEDGER_FILE))
    .some((row) => row.event === event && row.detail === detail);
}

function hasPabcdCloseRow(
  cwd        ,
  sessionId        ,
  checkEpoch               ,
  closedWorkPhaseId               ,
)          {
  return readJsonlObjects(join(cwd, STATE_DIR, LEDGER_FILE)).some(
    (row) => row.sessionId === sessionId && row.from === "C"
      && row.to === "IDLE" && row.reason === "done"
      && row.checkEpoch === checkEpoch
      && row.closedWorkPhaseId === closedWorkPhaseId,
  );
}

export function runOrchestrateCli(args                                             , commitHooks                         = {})            {
  if ("help" in args) return { code: 0, output: renderOrchestrateHelp() };

  // malformed --attest is a hard error before any state mutation (except control verbs).
  if (args.attestError && args.verb !== "status" && args.verb !== "reset") {
    const sessionIdForError = args.session && sessionFileExists(args.cwd, args.session) ? args.session : null;
    const stateForError = sessionIdForError ? readState(args.cwd, sessionIdForError) : null;
    const context =
      stateForError && sessionIdForError
        ? `${renderPhaseContext(stateForError, sessionIdForError)}; `
        : "";
    // Only a SHAPE failure gets the worked example. "not valid JSON" and
    // "requires a path argument" are different problems, and an example of a
    // well-formed object would only muddy them.
    const hint = args.attestError.includes("missing valid from/to")
      ? renderAttestShapeHint(args.verb, stateForError?.phase ?? null)
      : "";
    return { code: 1, output: `orchestrate ${args.verb}: ${context}${args.attestError}.${hint}` };
  }

  const sessionId = resolveSession(args.cwd, args.session);

  // status: read-only. With no session, report it (don't create one).
  if (args.verb === "status") {
    if (!sessionId) return { code: 0, output: "no active session" };
    return {
      code: 0,
      output: renderStatus(
        readState(args.cwd, sessionId),
        args.json,
        findForeignSessionCopies(args.cwd, sessionId, siblingRoots(args.cwd)),
      ),
    };
  }

  // G3 (fork-FSM collision, 260707): mutating verbs REQUIRE an explicit --session.
  // The implicit most-recent-mtime fallback let any concurrent session (a /fork sees
  // the parent's orchestrate context and naturally replays commands) mutate whichever
  // session file was newest — live forensics in devlog/_fin/260707_fork_fsm_bug/.
  // Fork provenance is invisible to hooks (codex-rs session.rs:1221-1226 maps
  // Forked -> Startup), so the CLI boundary is where the accidental path closes.
  // Read-only status above keeps the fallback.
  if (!args.session) {
    return {
      code: 1,
      output: `orchestrate ${args.verb}: mutating verbs require an explicit --session <id> (your codex session id from the SessionStart context line, or the terminal key 'cli'). The implicit most-recent-session fallback is disabled for writes: a concurrent or forked session must never mutate another session's FSM.`,
    };
  }

  // mutating verbs need a concrete session: never silently invent a divergent one.
  if (!sessionId) {
    return { code: 1, output: `orchestrate ${args.verb}: no active session — pass --session <id> (the codex session id, or an explicit terminal session like 'cli')` };
  }

  // G2 (L20): an EXPLICIT --session on a mutating verb may target only an existing
  // session file or a reserved terminal key (cli). An unknown explicit id (e.g. a typo
  // or a fresh codex-style uuid the hook never created) must NOT silently mint a
  // divergent session. The implicit most-recent pick and the no-session cli bootstrap
  // are unaffected (args.session is undefined there).
  if (args.session && !sessionFileExists(args.cwd, sessionId) && !RESERVED_SESSION_KEYS.has(sessionId)) {
    return {
      code: 1,
      output: `orchestrate ${args.verb}: unknown session '${sessionId}' — no .codexclaw/sessions/${sessionId}.json exists. Target an existing session or use the terminal key 'cli'.`,
    };
  }
  const state = readState(args.cwd, sessionId);
  // 050 wp5 §5: the fixed close target and whether this D request is finishing a
  // close that already started. A matching marker means the first attempt already
  // spent the binding, transition, and receipt gates, so re-consuming them would
  // refuse a retry for gates it has no way to satisfy twice.
  const closePhaseId = args.verb === "D" ? args.attest?.workPhaseId?.trim() ?? "" : "";
  const recoveringDclose = args.verb === "D" && matchesDcloseRecovery(state, closePhaseId);

  // reset: control override (same cleared-IDLE write as the human path).
  if (args.verb === "reset") {
    const res = applyHumanTransition(state, "reset");
    if (res.noop) return { code: 0, output: `orchestrate reset: ${renderPhaseContext(state, sessionId)}; already IDLE` };
    if (res.state) {
      writeState(args.cwd, { ...res.state, orchestrationActive: false, lastInjectedPhase: null, stopBlockPhase: null, stopBlockCount: 0 });
      if (res.ledger) appendLedger(args.cwd, res.ledger);
    }
    return { code: 0, output: `orchestrate reset: current=${state.phase} -> IDLE (session ${sessionId})` };
  }

  // phase verb: AGENT-GATED via the un-weakened transition().
  const to = args.verb         ;
  // P>A plan-artifact gate (260714 wp2, DIFFLEVEL-ROADMAP-01): the plan must
  // exist as numbered on-disk docs before Audit. Runs even when attest is null
  // so the FIRST error names planUnit. Fail-closed on this edge only.
  // REVIEW-BINDING-01 (060): keep the unit this edge validated, so A can bind a
  // review round to it. Deriving it again at A time would let the caller name any
  // unit with numbered docs and buy a fresh verdict from an old cycle's plan.
  let planBinding                                         = null;
  if (state.phase === "P" && to === "A") {
    const planCheck = validatePlanArtifacts(args.attest, args.cwd);
    if (!planCheck.ok) {
      return { code: 1, output: `orchestrate ${args.verb}: ${renderPhaseContext(state, sessionId)}; ${planCheck.reason}` };
    }
    planBinding = { unit: planCheck.unit, epoch: mintPlanEpoch() };
  }
  // Work-phase binding gate (260714 wp4, LOOP-UNIT-CHAIN-01): on every gated edge
  // of a goalplan-bound session, the attest must name the ONE effective active
  // work-phase. Fail-open when no goalplan resolves (HITL unchanged).
  if (GATED_TRANSITIONS.has(`${state.phase}>${to}`) && state.slug && !recoveringDclose) {
    let effective                = null;
    try {
      const plan = readGoalplan(args.cwd, state.slug);
      effective = plan ? effectiveActiveWorkPhaseId(plan) : null;
    } catch {
      effective = null; // FAIL-OPEN: unreadable goalplan never blocks HITL work
    }
    const bindCheck = validateWorkPhaseBinding(args.attest, effective);
    if (!bindCheck.ok) {
      return { code: 1, output: `orchestrate ${args.verb}: ${renderPhaseContext(state, sessionId)}; ${bindCheck.reason}` };
    }
  }
  // I→P agent override (mirrors applyHumanTransition's override path in
  // orchestrate-apply.ts). The agent CLI path uses the un-weakened transition(),
  // which has no override support. This adds equivalent logic for I→P only,
  // recording actor:"agent" instead of actor:"human".
  if (state.phase === "I" && to === "P") {
    const gate = evaluateInterviewGate(state.interview ?? null, {
      backedDimensions: dimensionsBackedByAnswers(args.cwd, sessionId),
    });
    if (gate.ready) {
      // Interview is ready — let the normal transition() path handle it.
      // (It will derive flags.interview=true from the tracker.)
    } else if (args.attest?.override === true) {
      // Agent override: pre-flip the interview flag and bypass the gate.
      // Validate the override attestation: require non-empty/non-placeholder did
      // and matching from/to (agent discipline, mirrors PLACEHOLDER_DID in attest.ts).
      const OVERRIDE_PLACEHOLDER = /^(tbd|todo|n\/?a|none|done|ok|\.+|-+)$/i;
      if (!args.attest.did || OVERRIDE_PLACEHOLDER.test(args.attest.did)) {
        return { code: 1, output: `orchestrate ${args.verb}: ${renderPhaseContext(state, sessionId)}; I→P override requires a specific "did" narrative explaining why the interview is complete (not empty or placeholder).` };
      }
      if (args.attest.from !== "I" || args.attest.to !== "P") {
        return { code: 1, output: `orchestrate ${args.verb}: ${renderPhaseContext(state, sessionId)}; I→P override attest from/to must be I/P, got ${args.attest.from}/${args.attest.to}.` };
      }
      const flags = { ...state.flags, interview: true };
      const legal = canEnter(to, { ...state, flags });
      if (!legal.ok) {
        return { code: 1, output: `orchestrate ${args.verb}: ${renderPhaseContext(state, sessionId)}; ${legal.reason}` };
      }
      // 050: I→P is never B, so the snapshot is explicitly cleared rather than spread.
      // 050/060: I→P is neither B nor A, so both bindings are cleared explicitly —
      // this writer bypasses transition() and would otherwise spread stale values.
      const next        = { ...state, phase: to, flags, orchestrationActive: true, lastInjectedPhase: to, stopBlockPhase: null, stopBlockCount: 0, phaseEntrySource: null, planUnit: null, planEpoch: null, checkEpoch: null };
      writeState(args.cwd, next);
      resetRenderLedger(args.cwd);
      appendLedger(args.cwd, {
        ts: new Date().toISOString(),
        sessionId: state.sessionId,
        from: state.phase,
        to,
        reason: "cli",
        actor: "agent",
        override: true,
        scanEvidence: { scanRounds: state.interview?.scanRounds ?? 0, highContradictionCount: gate.highContradictionCount },
        ...(args.attest?.did ? { evidence: args.attest.did } : {}),
      });
      return { code: 0, output: `orchestrate P: I → P (agent override, session ${sessionId})` };
    } else {
      // Not ready and no override: advise-block with gate warnings.
      return {
        code: 1,
        output: `orchestrate ${args.verb}: ${renderPhaseContext(state, sessionId)}; interview soft-gate: ${gate.warnings.join("; ")}. Pass override:true in --attest to proceed.`,
      };
    }
  }
  // 050 wp5 §5: a marker-matched D retry is resuming a transition the first attempt
  // already made legally. state.phase is IDLE by then, so transition() would refuse
  // C>D on a session whose cycle is functionally mid-close.
  const result = recoveringDclose
    ? { ok: true         , state: { ...state, phase: "D"          } }
    : transition(state, to, args.attest);
  if (!result.ok || !result.state) {
    return { code: 1, output: `orchestrate ${args.verb}: ${renderPhaseContext(state, sessionId)}; ${result.reason ?? "transition refused"}` };
  }

  // LEAN-REVIEW-01 (260818): an OPEN round is honoured, never required. A>B is
  // gated by the attest; a recorded verdict adds provenance on top of it. See
  // validateReviewBinding for why the mandatory shape was removed.
  if (state.phase === "A" && to === "B" && state.slug) {
    const verdictCheck = validateReviewBinding(state, args, sessionId);
    if (verdictCheck) return verdictCheck;
  }


  // byte-identical to what it was on entry to B, nothing was implemented during B.
  // That is the "built everything earlier, used B as a rubber stamp" shape this
  // unit set out to catch, and its own ledger caught it happening mid-repair.
  //
  // Advisory limits, stated plainly: committing work made in P also changes HEAD
  // and passes, a shared worktree attributes another session's edits to this one,
  // and no git means no opinion. It is a supporting signal, not the main defence.
  if (state.phase === "B" && to === "C" && state.phaseEntrySource) {
    const now = captureSourceIdentity(args.cwd, { excludeCodexclawArtifacts: true });
    const cmp = compareSource(state.phaseEntrySource, now);
    if (cmp.kind === "same") {
      return {
        code: 1,
        output: `orchestrate C: ${renderPhaseContext(state, sessionId)}; the source is unchanged since B began (${describeSource(now)}), so nothing was implemented in this B (SOURCE-DELTA-01). Implement inside B rather than carrying earlier work across the edge. Nothing was written.`,
      };
    }
  }


  // G1 (L20): D is a CLOSING transition, not a resting badge. Once the C->D attest
  // gate (checkOutput + exitCode:0, enforced by transition() above) passes, close the
  // cycle to IDLE atomically — one clearedIdle write + one done ledger (C->IDLE) — so
  // the terminal path matches the chat done-control and L5/L7's "resting state is
  // IDLE" contract. No intermediate phase="D" is persisted and no second ledger row.
  if (to === "D") {
    // CHECK-BINDING-01 (075): a bound session must name a receipt this cycle produced.
    // Runs before the goalplan preflight and every write, so a refusal leaves state,
    // the PABCD ledger and the goalplan untouched.
    // 050 wp5 §5: a marker-matched retry already spent its receipt in the first
    // attempt, and the epoch it ran under is recorded on the marker.
    if (state.slug && !recoveringDclose) {
      const receiptCheck = validateCheckReceipt(state, sessionId, args.attest?.testReceiptPath, args.cwd);
      if (!receiptCheck.ok) {
        return { code: 1, output: `orchestrate D: ${renderPhaseContext(state, sessionId)}; ${receiptCheck.reason} Nothing was written.` };
      }
    }
    // §35-1: unbound HITL keeps the pre-wp5 path byte-for-byte. It never takes a
    // goalplan lock and never enters marker cleanup.
    if (!state.slug) {
      writeState(args.cwd, { ...clearedIdle(state), stopBlockPhase: null, stopBlockCount: 0 });
      appendLedger(args.cwd, {
        ts: new Date().toISOString(),
        sessionId: state.sessionId,
        from: state.phase,
        to: "IDLE",
        reason: "done",
        ...(args.attest?.did ? { evidence: args.attest.did } : {}),
      });
      return { code: 0, output: `orchestrate D: current=${state.phase} -> IDLE (${state.phase} → IDLE, cycle closed, session ${sessionId})` };
    }

    const slug = state.slug;
    let allDoneClose = false;
    const locked = withGoalplanWriteLock(args.cwd, slug, (plan) => {
        // §5: integrity is checked inside the lock, before marker or any write.
        const integrityReasons = [
          ...goalplanDefinitionIntegrityReasons(plan),
          ...goalplanDependencyCompletionReasons(plan),
        ];
        if (integrityReasons.length > 0) {
          return {
            code: 1         ,
            allDone: false         ,
            output: `orchestrate D: invalid goalplan: ${integrityReasons.join("; ")}. Nothing was written.`,
          };
        }
        // §35-2: preserve the existing empty-plan refusal before target lookup.
        if (plan.workPhases.length === 0) {
          return {
            code: 1         ,
            allDone: false         ,
            output: `orchestrate D: ${renderPhaseContext(state, sessionId)}; the bound goalplan "${slug}" has no work-phase to close (CYCLE-COMPLETION-01): the plan is empty — register workPhases[] first. Nothing was written.`,
          };
        }

        // §39 Y2: recovery comes BEFORE the all-done special case. Crashing right
        // after the final work-phase was committed leaves an all-done plan, so
        // checking all-done first would re-enter it as a plain cycle close and
        // record closedWorkPhaseId: null — losing the target the marker names.
        let closedPlan = plan;
        let writeClosedPlan = false;
        if (recoveringDclose) {
          // §50: a marker written before the successor field exists cannot say whether
          // the plan commit landed, and neither reading of it is safe — treating it as
          // "no decision" or as "no successor" both null the cursor on a plan that was
          // already correct, and the target status does not separate the two histories.
          // Hand it to a human instead of guessing.
          if (state.dcloseRecovery.legacy) {
            return {
              code: 1         ,
              allDone: false         ,
              output: `orchestrate D: the recovery marker for ${closePhaseId} predates the successor field, so this retry cannot tell whether the plan commit landed. The marker was kept; inspect the goalplan, set the work-phase statuses and activeWorkPhaseId by hand, then run \`cxc orchestrate reset --session ${sessionId}\` to clear the marker. Nothing was written.`,
            };
          }
          // §39 Y1: the marker is written BEFORE the plan commit, so a matching
          // marker does not prove the plan was closed. Look the fixed target up —
          // this is not the §38 X2 "target validation" that refuses on absence.
          // Absent means a later edit removed it and the commit is not ours to
          // redo; present-but-open means the marker-then-crash case and we close
          // exactly that phase.
          //
          // §40 Z1: closing it means closeFixedWorkPhase(), the same transformation
          // the normal path uses. Fixing up only the target's status left
          // activeWorkPhaseId on a done phase and logged a false started row.
          const fixed = plan.workPhases.find((workPhase) => workPhase.id === closePhaseId);
          // §42/§43: the caller never decides whether the commit landed. Status alone
          // is not proof — a status-only edit keeps the cursor on the target — and even
          // a genuine commit can be edited afterwards to hide a pending task under a
          // done phase. So the helper runs whenever the target exists, and it answers
          // `already_done` only after its three gates pass.
          // §52/§53: an absent target does NOT mean there is nothing to finish. The marker
          // still records the successor this close activated, and skipping to cleanup
          // leaves that phase unstarted while the ledger claims the cycle closed.
          // Reachable: crash right after the marker, then an edit removes the target.
          // The decision is shared with the chat path so the two cannot diverge.
          if (!fixed) {
            const orphan = resumeAbsentTarget(plan, state.dcloseRecovery.nextWorkPhaseId);
            if (orphan.kind === "successor_lost") {
              return {
                code: 1         ,
                allDone: false         ,
                output: `orchestrate D: recovery target ${closePhaseId} is gone from the plan and the successor ${orphan.successorId} it recorded ${absentSuccessorDetail(orphan.reason)}, so this retry cannot tell what to finish. The marker was kept; inspect the goalplan, set the work-phase statuses and activeWorkPhaseId by hand, then run \`cxc orchestrate reset --session ${sessionId}\` to clear the marker. Nothing was written.`,
              };
            }
            if (orphan.kind === "activate") {
              closedPlan = orphan.plan;
              writeClosedPlan = true;
            }
          }
          if (fixed) {
            const closed = closeFixedWorkPhase(plan, closePhaseId, state.dcloseRecovery.nextWorkPhaseId);
            // §41 W1: a target that gained a pending task or became blocked after its
            // marker is FAIL-CLOSED, and the marker is deliberately left in place so
            // the operator can fix the plan and finish with the same request. Wiping
            // it here would destroy the only route back.
            if (closed.kind === "tasks_pending") {
              const open = closed.pending.map((task) => `${task.id} (${task.title})`).join("; ");
              return {
                code: 1         ,
                allDone: false         ,
                output: `orchestrate D: recovery target ${closePhaseId} gained ${closed.pending.length} open task(s) after its marker was written, so this cycle cannot close (CYCLE-COMPLETION-01): ${open}. The recovery marker was kept; close those tasks and run the same D request again. Nothing was written.`,
              };
            }
            if (closed.kind === "not_runnable") {
              return {
                code: 1         ,
                allDone: false         ,
                output: `orchestrate D: recovery target ${closePhaseId} is now ${closed.status}, so this cycle cannot close (CYCLE-COMPLETION-01). The recovery marker was kept; restore that work-phase and run the same D request again. Nothing was written.`,
              };
            }
            if (closed.kind === "dependencies_unmet") {
              return {
                code: 1         ,
                allDone: false         ,
                output: `orchestrate D: recovery target ${closePhaseId} now waits for ${closed.unmet.join(", ")}, so this cycle cannot close (CYCLE-COMPLETION-01). The recovery marker was kept; satisfy those work-phases and run the same D request again. Nothing was written.`,
              };
            }
            // §50: the recorded successor is binding. When it cannot be used this fails
            // closed and keeps the marker, because picking a different phase would
            // confirm a close the earlier attempt never decided. An earlier draft
            // refreshed the marker to whatever this retry chose instead, which let the
            // repair drift away from the write it was resuming.
            if (closed.kind === "successor_lost") {
              // §51: a corrupt marker names no repairable work-phase, so it gets its own
              // route out. The other three are fixed by editing the plan.
              if (closed.reason === "corrupt") {
                return {
                  code: 1         ,
                  allDone: false         ,
                  output: `orchestrate D: the recovery marker for ${closePhaseId} names that same work-phase as its successor, which no close can produce, so this retry cannot tell what to finish. The marker was kept; inspect the goalplan, set the work-phase statuses and activeWorkPhaseId by hand, then run \`cxc orchestrate reset --session ${sessionId}\` to clear the marker. Nothing was written.`,
                };
              }
              const detail = closed.reason === "absent"
                ? "is no longer in the plan"
                : closed.reason === "not_runnable"
                  ? "can no longer be started"
                  : "now waits for another work-phase";
              return {
                code: 1         ,
                allDone: false         ,
                output: `orchestrate D: recovery target ${closePhaseId} was closed with successor ${closed.successorId}, which ${detail}, so this cycle cannot close (CYCLE-COMPLETION-01). The recovery marker was kept; restore that work-phase and run the same D request again. Nothing was written.`,
              };
            }
            if (closed.kind === "ok") {
              closedPlan = closed.plan;
              writeClosedPlan = true;
            }
          }
        } else {
          // §35-3 / #49: an already-complete non-empty plan closes the cycle only.
          // No marker, plan write, or goalplan ledger row is needed. This is now
          // inside the non-recovery branch so a matching marker always wins.
          if (plan.workPhases.every((workPhase) => workPhase.status === "done")) {
            // §40 Z2: finish the PABCD close row inside THIS lock. all-done mints no
            // marker, so if the row were left to a second lock and that lock failed,
            // the retry would hit `IDLE -> D` with nothing to recover from and the
            // row would be lost for good.
            if (state.phase === "C" && !hasPabcdCloseRow(args.cwd, sessionId, state.checkEpoch, null)) {
              appendLedger(args.cwd, {
                ts: new Date().toISOString(), sessionId: state.sessionId, from: "C", to: "IDLE", reason: "done",
                checkEpoch: state.checkEpoch,
                closedWorkPhaseId: null,
                ...(args.attest?.did ? { evidence: args.attest.did } : {}),
              });
              commitHooks.afterPabcdLedgerAppend?.();
            }
            return { code: 0         , allDone: true          };
          }
          // §35-5: input and target membership checks follow all-done and recovery.
          if (!closePhaseId) {
            return {
              code: 1         ,
              allDone: false         ,
              output: "orchestrate D: attest.workPhaseId is required. Nothing was written.",
            };
          }
          const target = plan.workPhases.find((workPhase) => workPhase.id === closePhaseId);
          if (!target) {
            return {
              code: 1         ,
              allDone: false         ,
              output: `orchestrate D: work-phase ${closePhaseId} is not in the bound goalplan. Nothing was written.`,
            };
          }
          const advanced = advanceWorkPhase(plan);
          // §35-6: pending tasks are refused before no-active/deadlock handling.
          if (advanced.kind === "tasks_pending") {
            const open = advanced.pending.map((task) => `${task.id} (${task.title})`).join("; ");
            return {
              code: 1         ,
              allDone: false         ,
              output: `orchestrate D: ${renderPhaseContext(state, sessionId)}; work-phase ${advanced.workPhaseId} still has ${advanced.pending.length} open task(s), so this cycle cannot close (CYCLE-COMPLETION-01): ${open}. Nothing was written.`,
            };
          }
          // §35-7: all-done was consumed above, so no_active now means a real
          // unavailable/deadlocked remainder. Prefer dependencyDeadlock() detail.
          if (advanced.kind === "no_active") {
            const deadlock = dependencyDeadlock(plan);
            const reason = deadlock
              ? `Dependency deadlock: ${deadlock.reasons.join("; ")}`
              : "every remaining work-phase is blocked or superseded — unblock one";
            return {
              code: 1         ,
              allDone: false         ,
              output: `orchestrate D: ${renderPhaseContext(state, sessionId)}; the bound goalplan "${slug}" has no work-phase to close (CYCLE-COMPLETION-01): ${reason}. Nothing was written.`,
            };
          }
          if (advanced.closedId !== closePhaseId) {
            return {
              code: 1         ,
              allDone: false         ,
              output: `orchestrate D: fixed close target ${closePhaseId} does not match active work-phase ${advanced.closedId}. Nothing was written.`,
            };
          }
          closedPlan = advanced.plan;
          writeClosedPlan = true;

          // §35-8: only the normal bound close mints a marker and commits the plan.
          if (state.phase !== "C" || !state.checkEpoch) {
            return {
              code: 1         ,
              allDone: false         ,
              output: "orchestrate D: current C check epoch is required. Nothing was written.",
            };
          }
          writeState(args.cwd, {
            ...state,
            dcloseRecovery: {
              sessionId: state.sessionId,
              checkEpoch: state.checkEpoch,
              closedWorkPhaseId: closePhaseId,
              // §48: record the successor BEFORE the plan commit. A retry re-reads this
              // decision, so a later hand edit of the cursor cannot rewrite what this
              // close meant to do.
              nextWorkPhaseId: closedPlan.activeWorkPhaseId,
            },
          });
          commitHooks.afterRecoveryMarkerWrite?.();
        }
        if (writeClosedPlan) {
          writeGoalplan(args.cwd, closedPlan);
          commitHooks.afterGoalplanCommit?.();
        }

        if (!hasGoalplanRow(args.cwd, slug, "workphase_done", `closed ${closePhaseId}`)) {
          appendGoalplanLedger(args.cwd, slug, {
            ts: new Date().toISOString(), slug, event: "workphase_done",
            detail: `closed ${closePhaseId}`,
          });
        }
        // §52: the started row names the successor THIS close activated, which the marker
        // records. The persisted cursor is the wrong source on a resume: a retry that
        // answers already_done leaves `closedPlan` as the file, and that cursor may have
        // moved past the successor — or been nulled by an all-done plan — so the row this
        // close still owed would never be written. The hasGoalplanRow guard keeps it
        // idempotent when the row already exists.
        const startedId = recoveringDclose
          ? state.dcloseRecovery.nextWorkPhaseId
          : closedPlan.activeWorkPhaseId;
        if (startedId && !hasGoalplanRow(args.cwd, slug, "workphase_started", `started ${startedId}`)) {
          appendGoalplanLedger(args.cwd, slug, {
            ts: new Date().toISOString(), slug, event: "workphase_started",
            detail: `started ${startedId}`,
          });
        }
        return { code: 0         , allDone: false          };
      });

    if (locked.kind === "locked") {
      return { code: 1, output: `orchestrate D: ${locked.reason} D-close was not applied. Nothing was written.` };
    }
    if (locked.kind === "unreadable") {
      return { code: 1, output: `orchestrate D: the bound goalplan "${slug}" could not be read (CYCLE-COMPLETION-01): ${locked.reason}. Nothing was written.` };
    }
    if (locked.value.code !== 0) return locked.value;
    allDoneClose = locked.value.allDone;

    const recovery = readState(args.cwd, sessionId).dcloseRecovery;
    const closeCheckEpoch = recovery?.checkEpoch ?? state.checkEpoch;
    const closedWorkPhaseId = allDoneClose ? null : closePhaseId;
    if (state.phase !== "IDLE") {
      writeState(args.cwd, {
        ...clearedIdle(state),
        checkEpoch: allDoneClose ? null : recovery?.checkEpoch ?? null,
        dcloseRecovery: allDoneClose ? null : recovery,
        stopBlockPhase: null,
        stopBlockCount: 0,
      });
      commitHooks.afterStateWrite?.();
    }
    // check + append + marker cleanup is one critical section. Two recoveries
    // cannot both observe an absent 3-tuple.
    //
    // §40 Z2: all-done already wrote its row inside the first lock and has no marker
    // to clear, so it never enters this second critical section.
    const finalize = allDoneClose
      ? { kind: "ok"         , value: undefined }
      : withGoalplanWriteLock(args.cwd, slug, () => {
      if (!hasPabcdCloseRow(args.cwd, sessionId, closeCheckEpoch, closedWorkPhaseId)) {
        appendLedger(args.cwd, {
          ts: new Date().toISOString(), sessionId: state.sessionId, from: "C", to: "IDLE", reason: "done",
          checkEpoch: closeCheckEpoch,
          closedWorkPhaseId,
          ...(args.attest?.did ? { evidence: args.attest.did } : {}),
        });
        commitHooks.afterPabcdLedgerAppend?.();
      }
      const current = readState(args.cwd, sessionId);
      if (matchesDcloseRecovery(current, closePhaseId)) {
        writeState(args.cwd, { ...current, checkEpoch: null, dcloseRecovery: null });
      }
    });
    if (finalize.kind !== "ok") {
      return {
        // §39 Y3: not a refusal. The state write above already moved the FSM to
        // IDLE outside the lock, so returning code 1 here would report a failure
        // for a cycle that is functionally closed. The marker survives and the
        // next D request for the same tuple finishes the cleanup.
        code: 0,
        output: `orchestrate D: close target ${closePhaseId} is committed and the cycle is closed, but ledger/marker finalization is pending: ${finalize.reason} The recovery marker is still on the session, so running the same D request again finishes the cleanup.`,
      };
    }
    return { code: 0, output: `orchestrate D: close target ${closePhaseId} is complete (cycle closed, session ${sessionId})` };
  }

  // L6: a real CLI transition is progress -> reset the Stop stagnation guard.
  // SOURCE-DELTA-01 (050): snapshot the source on entry to B, and clear it on every
  // other edge so a stale snapshot cannot outlive its phase. applyHumanTransition()
  // takes no cwd, so the capture belongs here at the call site rather than inside it.
  const entrySource = result.state.phase === "B" ? captureSourceIdentity(args.cwd, { excludeCodexclawArtifacts: true }) : null;
  // 060: A carries the binding this edge just minted; entering P or I drops it, so
  // re-planning cannot leave an old approval looking current.
  const nextUnit = planBinding ? planBinding.unit : result.state.phase === "A" ? state.planUnit : null;
  const nextEpoch = planBinding ? planBinding.epoch : result.state.phase === "A" ? state.planEpoch : null;
  // 075: entering C mints a check epoch; staying in C keeps it; anywhere else drops it.
  // A receipt records the epoch it ran under, so re-checking invalidates the old one.
  const nextCheckEpoch = result.state.phase !== "C" ? null : state.phase === "C" ? state.checkEpoch : mintEpoch("c");
  // 032: a fresh epoch orphans every round the old one owned. Close them here,
  // before the new binding lands, or the gate will wait on a round no sign-off can
  // reach.
  //
  // The old epoch is read from the rounds, not from state: this edge is entered
  // from P, and state read at P has already normalized the A-only binding to null.
  // The rounds are the only place the previous epoch still exists.
  if (planBinding && state.slug) {
    try {
      withGoalplanWriteLock(args.cwd, state.slug, (plan) => {
        const stranded = (plan.reviewRounds ?? []).find(
          (round) => round.purpose === "plan_audit"
            && round.ownerSessionId === sessionId
            && round.planEpoch !== undefined
            && round.planEpoch !== planBinding.epoch
            && round.status !== "approved"
            && round.status !== "changes_requested"
            && round.status !== "inconclusive",
        );
        const swept = supersedeStaleRounds(
          plan,
          "plan_audit",
          sessionId,
          stranded?.planEpoch ?? null,
        );
        if (swept.closed.length === 0) return;
        writeGoalplan(args.cwd, swept.plan);
        for (const roundId of swept.closed) {
          appendGoalplanLedger(args.cwd, state.slug , {
            ts: new Date().toISOString(),
            slug: state.slug ,
            event: "review_round_superseded",
            detail: "the plan was re-planned, so this round can no longer be spent",
            roundId,
          });
        }
      });
    } catch {
      // Housekeeping is fail-open. The P-to-A edge continues.
    }
  }
  writeState(args.cwd, { ...result.state, orchestrationActive: result.state.phase !== "IDLE", lastInjectedPhase: result.state.phase, stopBlockPhase: null, stopBlockCount: 0, phaseEntrySource: entrySource, planUnit: nextUnit, planEpoch: nextEpoch, checkEpoch: nextCheckEpoch });
  // C-RENDER-GROUNDING-01: a new cycle starts at P — clear the render ledger so the
  // Stop advisory judges THIS cycle's rows only (stale rows both suppress and misfire).
  if (result.state.phase === "P") resetRenderLedger(args.cwd);
  appendLedger(args.cwd, {
    ts: new Date().toISOString(),
    sessionId: state.sessionId,
    from: state.phase,
    to: result.state.phase,
    reason: "cli",
    ...(args.attest?.did ? { evidence: args.attest.did } : {}),
  });
  return { code: 0, output: `orchestrate ${args.verb}: current=${state.phase} -> ${result.state.phase} (${state.phase} → ${result.state.phase}, session ${sessionId})` };
}
/**
 * #48: candidate trees to check for the SAME session id. Deliberately shallow —
 * the immediate children of $HOME plus the parent of cwd — because this is a
 * warning path on a read-only command, not a filesystem crawl. Anything deeper
 * would cost more than the warning is worth.
 */
function siblingRoots(cwd        )           {
  const roots           = [];
  let home        ;
  try {
    home = homedir();
  } catch {
    return roots;
  }
  try {
    for (const entry of readdirSync(home, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      // Skip the noisy ones a workspace never lives in.
      if (entry.name === "node_modules" || entry.name === "AppData") continue;
      roots.push(join(home, entry.name));
    }
  } catch {
    // an unreadable home is not an error for a warning path
  }
  const parent = resolve(cwd, "..");
  if (parent !== resolve(cwd)) roots.push(parent);
  return roots;
}
