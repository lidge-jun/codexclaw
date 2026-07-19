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
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { coerceAttest, validateWorkPhaseBinding, GATED_TRANSITIONS,                  } from "./attest.js";
import { canEnter, transition } from "./fsm.js";
import { validatePlanArtifacts } from "./plan-gate.js";
import { advanceWorkPhase, appendGoalplanLedger, effectiveActiveWorkPhaseId, readGoalplan, writeGoalplan } from "./goalplan.js";
import { evaluateInterviewGate } from "./interview.js";
import { applyHumanTransition, clearedIdle } from "./orchestrate-apply.js";
import { resetRenderLedger } from "./render-observations.js";

import {
  appendLedger,
  readState,
  writeState,
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

export function renderOrchestrateHelp()         {
  return [
    "cxc orchestrate — agent-gated IPABCD phase control",
    "",
    "Usage:",
    "  cxc orchestrate <I|P|A|B|C|D|status|reset> [--session <id>] [--attest <json>] [--cwd <path>] [--json]",
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
    "Attestation examples:",
    "  cxc orchestrate A --session <id> --attest '{\"from\":\"P\",\"to\":\"A\",\"did\":\"wrote and audited the plan\",\"planUnit\":\"devlog/_plan/260714_slug\",\"workPhaseId\":\"wp1\"}'",
    "  cxc orchestrate B --session <id> --attest '{\"from\":\"A\",\"to\":\"B\",\"did\":\"audit passed\",\"auditOutput\":\"VERDICT: PASS\",\"auditVerdict\":\"pass\",\"workPhaseId\":\"wp1\"}'",
    "  cxc orchestrate D --session <id> --attest '{\"from\":\"C\",\"to\":\"D\",\"did\":\"verified\",\"checkOutput\":\"tests passed\",\"exitCode\":0,\"workPhaseId\":\"wp1\"}'",
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
  let session                    ;
  let cwdOut = cwd;
  let json = false;

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--attest") {
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
    } else if (a === "--session") {
      session = argv[++i];
    } else if (a === "--cwd") {
      cwdOut = argv[++i] ?? cwd;
    } else if (a === "--json") {
      json = true;
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

function renderStatus(state       , json         )         {
  if (json) return JSON.stringify({ phase: state.phase, flags: state.flags, sessionId: state.sessionId });
  return `session=${state.sessionId} phase=${state.phase} interview=${state.flags.interview} auditPassed=${state.flags.auditPassed} checkPassed=${state.flags.checkPassed}`;
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
    return { code: 0, output: renderStatus(readState(args.cwd, sessionId), args.json) };
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
  if (state.phase === "P" && to === "A") {
    const planCheck = validatePlanArtifacts(args.attest, args.cwd);
    if (!planCheck.ok) {
      return { code: 1, output: `orchestrate ${args.verb}: ${renderPhaseContext(state, sessionId)}; ${planCheck.reason}` };
    }
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
      const next        = { ...state, phase: to, flags, orchestrationActive: true, lastInjectedPhase: to, stopBlockPhase: null, stopBlockCount: 0 };
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

  // G1 (L20): D is a CLOSING transition, not a resting badge. Once the C->D attest
  // gate (checkOutput + exitCode:0, enforced by transition() above) passes, close the
  // cycle to IDLE atomically — one clearedIdle write + one done ledger (C->IDLE) — so
  // the terminal path matches the chat done-control and L5/L7's "resting state is
  // IDLE" contract. No intermediate phase="D" is persisted and no second ledger row.
  if (to === "D") {
    writeState(args.cwd, { ...clearedIdle(state), stopBlockPhase: null, stopBlockCount: 0 });
    appendLedger(args.cwd, {
      ts: new Date().toISOString(),
      sessionId: state.sessionId,
      from: state.phase,
      to: "IDLE",
      reason: "done",
      ...(args.attest?.did ? { evidence: args.attest.did } : {}),
    });
    if (state.slug) {
      try {
        const plan = readGoalplan(args.cwd, state.slug);
        if (plan) {
          const closedId = effectiveActiveWorkPhaseId(plan);
          const advanced = advanceWorkPhase(plan);
          if (advanced) {
            writeGoalplan(args.cwd, advanced);
            appendGoalplanLedger(args.cwd, state.slug, {
              ts: new Date().toISOString(),
              slug: state.slug,
              event: "workphase_done",
              // 260714 wp4: log the EFFECTIVE closed id (implicit cursor may have
              // started from a null explicit cursor — "closed none" was a lie).
              detail: `closed ${closedId ?? "none"}`,
            });
            if (advanced.activeWorkPhaseId) {
              appendGoalplanLedger(args.cwd, state.slug, {
                ts: new Date().toISOString(),
                slug: state.slug,
                event: "workphase_started",
                detail: `started ${advanced.activeWorkPhaseId}`,
              });
            }
          }
        }
      } catch {
        // FAIL-OPEN: goalplan advance failure must not block the D-close.
      }
    }
    return { code: 0, output: `orchestrate D: current=${state.phase} -> IDLE (${state.phase} → IDLE, cycle closed, session ${sessionId})` };
  }

  // L6: a real CLI transition is progress -> reset the Stop stagnation guard.
  writeState(args.cwd, { ...result.state, orchestrationActive: result.state.phase !== "IDLE", lastInjectedPhase: result.state.phase, stopBlockPhase: null, stopBlockCount: 0 });
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
