/**
 * review-round-cli.ts — `cxc review-round <open|show|abort>` (060).
 *
 * Opens and inspects plan-audit rounds. There is no `close`: approval is written
 * by the SubagentStop observer when a reviewer actually finishes, never by the
 * agent asking for it (REVIEW-BINDING-01).
 *
 * `open` refuses unless the session is genuinely at an audit: phase A, a bound
 * goalplan that reads, an active work-phase, and the plan unit plus epoch that
 * P>A minted. Letting the caller name a unit here would let an old cycle's
 * numbered docs buy a fresh verdict.
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";
import { readState } from "./state.js";
import { readGoalplan, writeGoalplan, effectiveActiveWorkPhaseId,               } from "./goalplan.js";
import { openRound, markLaunching, markInFlight, latestRound, abortRound, staleness } from "./review-round.js";



const VERBS                      = new Set                 (["open", "show", "abort"]);

/** Same shape plan-gate enforces at P>A — a plan lives in numbered documents. */
const NUMBERED_DOC_RE = /^\d{3}_.+\.md$/;

/** Body of a TOML table `[header]`, up to the next table header. */
function tomlTableBody(content        , header        )                {
  const lines = content.split("\n");
  const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const start = lines.findIndex((line) => new RegExp(`^\\s*\\[${escaped}\\]\\s*(?:#.*)?$`).test(line));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^\s*\[/.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

function tomlBoolInBody(body        , key        )                 {
  const match = body.match(new RegExp(`^\\s*${key}\\s*=\\s*(true|false)\\s*(?:#.*)?$`, "m"));
  return match ? match[1] === "true" : null;
}

/**
 * TRUE when the multi_agent_v2 spawn surface is active. Only v2 accepts an
 * `agent_type` argument; on v1 the field does not exist and a value passed for
 * it is dropped (050). Telling a v1 caller to "dispatch with agent_type
 * explorer" is an instruction it cannot carry out, so the dispatch text below
 * adapts.
 *
 * Recognizes the same three shapes config-guard's isMultiAgentV2Enabled does —
 * table, scalar, inline table. A bare-scalar-only regex read the shipped
 * `[features.multi_agent_v2] enabled = true` form as v1 (audit r7). Duplicated
 * rather than imported because pabcd-state does not depend on config-guard;
 * a missing or unreadable config means the v1 default, which is also the safe
 * wording.
 */
function v2SpawnSurface()          {
  const home = process.env.CODEX_HOME && process.env.CODEX_HOME.length > 0
    ? process.env.CODEX_HOME
    : resolve(homedir(), ".codex");
  let content        ;
  try {
    content = readFileSync(resolve(home, "config.toml"), "utf8");
  } catch {
    return false;
  }
  const table = tomlTableBody(content, "features.multi_agent_v2");
  if (table !== null) return tomlBoolInBody(table, "enabled") === true;
  const features = tomlTableBody(content, "features");
  if (features !== null) {
    const bool = tomlBoolInBody(features, "multi_agent_v2");
    if (bool !== null) return bool;
    const inline = features.match(/^\s*multi_agent_v2\s*=\s*\{([^}]*)\}/m);
    if (inline) {
      const enabled = inline[1].match(/enabled\s*=\s*(true|false)/);
      if (enabled) return enabled[1] === "true";
    }
  }
  return false;
}












export function parseReviewRoundCliArgs(argv          , cwd        )                                                {
  const verb = (argv[0] ?? "").toLowerCase();
  if (!VERBS.has(verb)) {
    return { error: `unknown review-round verb '${argv[0] ?? ""}' (expected open|show|abort)` };
  }
  const out                     = { verb: verb                   , cwd, planPaths: [] };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--session") out.session = argv[++i];
    else if (a === "--cwd") out.cwd = argv[++i] ?? cwd;
    else if (a === "--plan-path") {
      const v = argv[++i];
      if (typeof v === "string" && v.length > 0) out.planPaths.push(v);
    } else if (a === "--reason") out.reason = argv[++i];
    else if (a === "--json") out.json = true;
  }
  return out;
}



function sha256(buf                 )         {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Resolve --plan-path entries against the unit P>A validated.
 *
 * Containment alone is not enough: package.json or the goalplan itself sit still
 * for a whole cycle and would always read fresh. Restricting to numbered docs
 * inside the bound unit is what makes "the files went stale" mean something.
 */
function collectPlanFiles(cwd        , planUnit        , paths          )                                                {
  if (paths.length === 0) return { error: "--plan-path is required at least once: a round with no files audits nothing" };
  const unitAbs = resolve(cwd, planUnit);
  const seen = new Set        ();
  const files                 = [];
  for (const p of paths) {
    const abs = isAbsolute(p) ? resolve(p) : resolve(cwd, p);
    const rel = relative(unitAbs, abs);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      return { error: `plan path ${p} is outside the bound plan unit ${planUnit}` };
    }
    if (!NUMBERED_DOC_RE.test(rel)) {
      return { error: `plan path ${p} is not a numbered plan document (000_*.md) directly inside ${planUnit}` };
    }
    if (!existsSync(abs) || !lstatSync(abs).isFile() || lstatSync(abs).isSymbolicLink()) {
      return { error: `plan path ${p} is not a readable regular file` };
    }
    const key = relative(resolve(cwd), abs);
    if (seen.has(key)) continue;
    seen.add(key);
    files.push({ path: key, sha256: sha256(readFileSync(abs)) });
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files };
}

/** Aggregate hash in path order — the same construction freeze.ts uses. */
export function planFilesHash(files                )         {
  return sha256(files.map((f) => `${f.path}\u0000${f.sha256}`).join("\u0000"));
}

export function runReviewRoundCli(args                    )                       {
  const session = (args.session ?? "").trim();
  if (session.length === 0) return { output: "review-round: --session <id> is required", code: 1 };
  const state = readState(args.cwd, session);

  if (args.verb === "open") {
    if (state.phase !== "A") {
      return { output: `review-round open: session is at ${state.phase}, not A — a plan audit is opened during Audit`, code: 1 };
    }
    if (!state.slug) return { output: "review-round open: this session has no bound goalplan", code: 1 };
    if (!state.planUnit || !state.planEpoch) {
      return { output: "review-round open: no plan binding on this session — enter A through `cxc orchestrate A` so P>A records the unit it validated", code: 1 };
    }
    let plan                  = null;
    try {
      plan = readGoalplan(args.cwd, state.slug);
    } catch {
      plan = null;
    }
    if (!plan) return { output: `review-round open: the bound goalplan "${state.slug}" could not be read`, code: 1 };
    const workPhaseId = effectiveActiveWorkPhaseId(plan);
    if (!workPhaseId) return { output: "review-round open: the bound goalplan has no active work-phase", code: 1 };

    const collected = collectPlanFiles(args.cwd, state.planUnit, args.planPaths);
    if ("error" in collected) return { output: `review-round open: ${collected.error}`, code: 1 };

    const opened = openRound(plan, {
      purpose: "plan_audit",
      planPath: state.planUnit,
      planSha256: planFilesHash(collected.files),
    });
    if (opened.kind !== "ok") return { output: `review-round open: ${"reason" in opened ? opened.reason : opened.kind}`, code: 1 };

    // Bind before launching: a round that exists without its identity could be
    // matched by a later cycle.
    let next = opened.plan;
    next = {
      ...next,
      reviewRounds: (next.reviewRounds ?? []).map((r) =>
        r.roundId === opened.round.roundId
          ? { ...r, ownerSessionId: session, workPhaseId, planUnit: state.planUnit , planEpoch: state.planEpoch , planFiles: collected.files }
          : r,
      ),
    };
    const launchId = opened.round.lane.launchId;
    const launching = markLaunching(next, "plan_audit", opened.round.roundId, launchId);
    if (launching.kind !== "ok") return { output: `review-round open: ${"reason" in launching ? launching.reason : launching.kind}`, code: 1 };
    const inFlight = markInFlight(launching.plan, "plan_audit", opened.round.roundId, launchId);
    if (inFlight.kind !== "ok") return { output: `review-round open: ${"reason" in inFlight ? inFlight.reason : inFlight.kind}`, code: 1 };
    writeGoalplan(args.cwd, inFlight.plan);
    return {
      output: [
        launchId,
        "",
        `Round ${opened.round.roundId} is in flight over ${collected.files.length} file(s).`,
        v2SpawnSurface()
          ? "Dispatch an independent reviewer (agent_type explorer) and require it to end its"
          : "Dispatch an independent reviewer and require it to end its",
        "final message with exactly these two lines:",
        "",
        `  LAUNCH: ${launchId}`,
        "  VERDICT: PASS | NEAR-PASS | FAIL",
        "",
        "The verdict is recorded when that reviewer exits. There is no way to write it here.",
      ].join("\n"),
      code: 0,
    };
  }

  if (args.verb === "abort") {
    if (!state.slug) return { output: "review-round abort: this session has no bound goalplan", code: 1 };
    const plan = readGoalplan(args.cwd, state.slug);
    if (!plan) return { output: "review-round abort: the bound goalplan could not be read", code: 1 };
    const aborted = abortRound(plan, "plan_audit", args.reason ?? "aborted by the agent");
    if (aborted.kind !== "ok") return { output: `review-round abort: ${"reason" in aborted ? aborted.reason : aborted.kind}`, code: 1 };
    writeGoalplan(args.cwd, aborted.plan);
    return { output: `review-round abort: ${aborted.round.roundId} closed as inconclusive`, code: 0 };
  }

  // show
  if (!state.slug) return { output: "review-round show: this session has no bound goalplan", code: 1 };
  const plan = readGoalplan(args.cwd, state.slug);
  if (!plan) return { output: "review-round show: the bound goalplan could not be read", code: 1 };
  const round = latestRound(plan, "plan_audit");
  if (!round) return { output: "review-round show: no plan_audit round yet", code: 0 };
  const fresh = round.planFiles ? staleness(plan, round.roundId, planFilesHash(recomputed(args.cwd, round.planFiles))) : "open";
  if (args.json) {
    return { output: JSON.stringify({ roundId: round.roundId, status: round.status, staleness: fresh, launchId: round.lane.launchId, verdict: round.lane.verdict ?? null, workPhaseId: round.workPhaseId ?? null, planEpoch: round.planEpoch ?? null }), code: 0 };
  }
  return {
    output: `review-round ${round.roundId}: status=${round.status} staleness=${fresh} verdict=${round.lane.verdict ?? "-"} launch=${round.lane.launchId}`,
    code: 0,
  };
}

/** Re-read the exact files a round named, so staleness reflects them and nothing else. */
export function recomputed(cwd        , files                )                 {
  return files.map((f) => {
    try {
      return { path: f.path, sha256: sha256(readFileSync(resolve(cwd, f.path))) };
    } catch {
      return { path: f.path, sha256: "missing" };
    }
  });
}
