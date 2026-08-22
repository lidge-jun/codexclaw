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
import { canEnter, transition } from "./fsm.js";
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
import { advanceWorkPhase, appendGoalplanLedger, effectiveActiveWorkPhaseId, readGoalplan, writeGoalplan,                                   } from "./goalplan.js";
import { latestRound, supersedeStaleRounds } from "./review-round.js";
import { planFilesHash, recomputed } from "./review-round-cli.js";
import { validateCheckReceipt } from "./check-gate.js";
import { evaluateInterviewGate } from "./interview.js";
import { applyHumanTransition, clearedIdle } from "./orchestrate-apply.js";
import { resetRenderLedger } from "./render-observations.js";

import {
  appendLedger,
  readState,
  writeState,
  findForeignSessionCopies,
  STATE_DIR,
  SESSIONS_SUBDIR,


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
        "  cxc orchestrate D --session <id> --attest '{\"from\":\"C\",\"to\":\"D\",\"did\":\"verified\",\"checkOutput\":\"tests passed\",\"exitCode\":0,\"workPhaseId\":\"wp1\"}'",
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
    "  (workPhaseId is required on gated edges whenever a goalplan is bound to the session)",
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
export function runOrchestrateCli(args                                             )            {
  if ("help" in args) return { code: 0, output: renderOrchestrateHelp() };

  // malformed --attest is a hard error before any state mutation (except control verbs).
  if (args.attestError && args.verb !== "status" && args.verb !== "reset") {
    const sessionIdForError = args.session && sessionFileExists(args.cwd, args.session) ? args.session : null;
    const context = sessionIdForError ? `${renderPhaseContext(readState(args.cwd, sessionIdForError), sessionIdForError)}; ` : "";
    return { code: 1, output: `orchestrate ${args.verb}: ${context}${args.attestError}` };
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
  if (GATED_TRANSITIONS.has(`${state.phase}>${to}`) && state.slug) {
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
    const gate = evaluateInterviewGate(state.interview ?? null);
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
  const result = transition(state, to, args.attest);
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
    if (state.slug) {
      const receiptCheck = validateCheckReceipt(state, sessionId, args.attest?.testReceiptPath, args.cwd);
      if (!receiptCheck.ok) {
        return { code: 1, output: `orchestrate D: ${renderPhaseContext(state, sessionId)}; ${receiptCheck.reason} Nothing was written.` };
      }
    }
    // CYCLE-COMPLETION-01 preflight (030): decide the work-phase close BEFORE any
    // write. Closing the FSM first and consulting the goalplan afterwards is what
    // let a refusal land as "FSM idle, ledger done, goalplan unfinished" — so the
    // refusal path below returns with state, PABCD ledger and goalplan untouched.
    let advanced                       = null;
    if (state.slug) {
      let plan                  = null;
      let planReadFailed = false;
      try {
        plan = readGoalplan(args.cwd, state.slug);
      } catch {
        planReadFailed = true;
      }
      if (!plan || planReadFailed) {
        // FAIL-CLOSED for a bound session only: readGoalplan() swallows every error
        // into null, and hand-editing a goalplan is ordinary practice here, so a
        // missing or malformed file would otherwise be the cheapest way past this
        // gate. Sessions with no bound slug keep the old fail-open behaviour.
        return {
          code: 1,
          output: `orchestrate D: ${renderPhaseContext(state, sessionId)}; the bound goalplan "${state.slug}" could not be read, so this cycle cannot be closed (CYCLE-COMPLETION-01). Restore the goalplan file, or run \`cxc orchestrate reset\` to stand the cycle down.`,
        };
      }
      advanced = advanceWorkPhase(plan);
      if (advanced.kind === "tasks_pending") {
        const open = advanced.pending.map((t) => `${t.id} (${t.title})`).join("; ");
        return {
          code: 1,
          output: `orchestrate D: ${renderPhaseContext(state, sessionId)}; work-phase ${advanced.workPhaseId} still has ${advanced.pending.length} open task(s), so this cycle cannot close (CYCLE-COMPLETION-01): ${open}. One work-phase is one full PABCD cycle — finish the task and mark it done, or close the remaining tasks in their own cycles. Nothing was written.`,
        };
      }
      if (advanced.kind === "no_active") {
        return {
          code: 1,
          output: `orchestrate D: ${renderPhaseContext(state, sessionId)}; the bound goalplan "${state.slug}" has no active work-phase to close (CYCLE-COMPLETION-01). Register or unblock a work-phase before closing a cycle. Nothing was written.`,
        };
      }
    }
    writeState(args.cwd, { ...clearedIdle(state), stopBlockPhase: null, stopBlockCount: 0 });
    appendLedger(args.cwd, {
      ts: new Date().toISOString(),
      sessionId: state.sessionId,
      from: state.phase,
      to: "IDLE",
      reason: "done",
      ...(args.attest?.did ? { evidence: args.attest.did } : {}),
    });
    if (advanced && advanced.kind === "ok") {
      // Persist the plan the preflight computed — re-reading here would race the
      // decision the refusal above was based on.
      try {
        writeGoalplan(args.cwd, advanced.plan);
        appendGoalplanLedger(args.cwd, state.slug, {
          ts: new Date().toISOString(),
          slug: state.slug,
          event: "workphase_done",
          // 260714 wp4: log the EFFECTIVE closed id (implicit cursor may have
          // started from a null explicit cursor — "closed none" was a lie).
          detail: `closed ${advanced.closedId}`,
        });
        if (advanced.plan.activeWorkPhaseId) {
          appendGoalplanLedger(args.cwd, state.slug, {
            ts: new Date().toISOString(),
            slug: state.slug,
            event: "workphase_started",
            detail: `started ${advanced.plan.activeWorkPhaseId}`,
          });
        }
      } catch {
        // FAIL-OPEN on the WRITE only: the gate decision already passed, so a disk
        // failure here must not strand a legitimately closed cycle.
      }
    }
    return { code: 0, output: `orchestrate D: current=${state.phase} -> IDLE (${state.phase} → IDLE, cycle closed, session ${sessionId})` };
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
      const plan = readGoalplan(args.cwd, state.slug);
      if (plan) {
        const stranded = (plan.reviewRounds ?? []).find(
          (r) => r.purpose === "plan_audit"
            && r.ownerSessionId === sessionId
            && r.planEpoch !== undefined
            && r.planEpoch !== planBinding.epoch
            && r.status !== "approved"
            && r.status !== "changes_requested"
            && r.status !== "inconclusive",
        );
        const swept = supersedeStaleRounds(plan, "plan_audit", sessionId, stranded?.planEpoch ?? null);
        if (swept.closed.length > 0) {
          writeGoalplan(args.cwd, swept.plan);
          for (const roundId of swept.closed) {
            appendGoalplanLedger(args.cwd, state.slug, {
              ts: new Date().toISOString(),
              slug: state.slug,
              event: "review_round_superseded",
              detail: "the plan was re-planned, so this round can no longer be spent",
              roundId,
            });
          }
        }
      }
    } catch {
      // FAIL-OPEN: sweeping is housekeeping; a failure here must not block the edge
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
