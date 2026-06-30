/**
 * goalplan-cli.ts — `cxc goalplan <init|show|validate>` terminal surface (lazygap_impl 030.2).
 *
 * The no-interview local-loop entry: `init --objective "<text>"` captures a REAL objective
 * directly (not a slug placeholder) and seeds a project-local goalplan under
 * `.codexclaw/goalplans/<slug>/`. `show` renders the current plan; `validate` is the read-only
 * quality gate (E8) that 040's Stop consults before a final D-close.
 *
 * codexclaw never writes the host goal DB — `init` only writes the local artifact. Arming a
 * host goal stays the MAIN session's job (see freeze GOAL_ACTIVATION_DIRECTIVE).
 *
 * Structural argv parsing only (no prompt grammar): verb is argv[0]; flags take the next token.
 */
import {
  buildGoalplan,
  readGoalplan,
  writeGoalplan,
  appendGoalplanLedger,
  validateGoalplan,
  isGoalplanComplete,
  remainingWorkPhases,
  unmetCriteria,

} from "./goalplan.js";
import { deriveSlug } from "./freeze.js";
import { readState, writeState } from "./state.js";





















const VERBS                      = new Set              (["init", "show", "validate"]);

/** Structural argv parse. argv excludes the `goalplan` kind token. */
export function parseGoalplanCliArgs(argv          , cwd        )                                          {
  const verb = (argv[0] ?? "").toLowerCase();
  if (!VERBS.has(verb)) {
    return { error: `unknown goalplan verb '${argv[0] ?? ""}' (expected init|show|validate)` };
  }
  const out                  = { verb: verb                , cwd, criteria: [] };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--objective") out.objective = argv[++i];
    else if (a === "--slug") out.slug = argv[++i];
    else if (a === "--criterion") {
      const v = argv[++i];
      if (typeof v === "string" && v.length > 0) out.criteria.push(v);
    } else if (a === "--cwd") out.cwd = argv[++i] ?? cwd;
    else if (a === "--session") out.session = argv[++i];
  }
  return out;
}






function resolveSlug(args                 )                {
  if (typeof args.slug === "string" && args.slug.length > 0) return deriveSlug(args.slug);
  if (typeof args.objective === "string" && args.objective.length > 0) return deriveSlug(args.objective);
  return null;
}

function renderPlan(plan          )         {
  const lines = [
    `[codexclaw goalplan: ${plan.slug}]`,
    `objective: ${plan.objective}`,
    `host: armed=${plan.host.armed} source=${plan.host.source}`,
    `workPhases: ${plan.workPhases.length} (remaining ${remainingWorkPhases(plan).length})`,
    `criteria: ${plan.criteria.length} (unmet ${unmetCriteria(plan).length})`,
    `complete: ${isGoalplanComplete(plan)}`,
  ];
  for (const wp of plan.workPhases) {
    lines.push(`  - ${wp.id} [${wp.status}] ${wp.title}`);
  }
  return lines.join("\n");
}

export function runGoalplanCli(args                 )                    {
  if (args.verb === "init") {
    const objective = (args.objective ?? "").trim();
    if (objective.length === 0) {
      return { output: "goalplan init: --objective \"<text>\" is required", code: 1 };
    }
    const slug = deriveSlug(objective);
    const existing = readGoalplan(args.cwd, slug);
    if (existing) {
      return { output: `goalplan init: a plan already exists at slug '${slug}' (use show/validate)`, code: 1 };
    }
    const plan = buildGoalplan({
      objective,
      criteria: args.criteria.map((scenario) => ({ scenario })),
    });
    writeGoalplan(args.cwd, plan);
    appendGoalplanLedger(args.cwd, slug, {
      ts: new Date().toISOString(),
      slug,
      event: "created",
      detail: `init objective="${objective}" criteria=${args.criteria.length}`,
    });
    // 030.3: bind the slug to a session so the Stop hook can resolve the goalplan
    // strictly by state.slug (no directory-scan heuristic).
    if (typeof args.session === "string" && args.session.length > 0) {
      const state = readState(args.cwd, args.session);
      writeState(args.cwd, { ...state, slug });
    }
    return { output: renderPlan(readGoalplan(args.cwd, slug) ?? plan), code: 0 };
  }

  const slug = resolveSlug(args);
  if (!slug) {
    return { output: `goalplan ${args.verb}: --slug "<text>" or --objective "<text>" is required`, code: 1 };
  }
  const plan = readGoalplan(args.cwd, slug);
  if (!plan) {
    return { output: `goalplan ${args.verb}: no plan found at slug '${slug}'`, code: 1 };
  }

  if (args.verb === "show") {
    return { output: renderPlan(plan), code: 0 };
  }

  // validate (E8 quality gate)
  const v = validateGoalplan(plan);
  if (v.ok) {
    return { output: `[codexclaw goalplan validate: ${slug}] OK — complete + all met criteria carry evidence`, code: 0 };
  }
  return {
    output: [`[codexclaw goalplan validate: ${slug}] FAIL`, ...v.reasons.map((r) => `  - ${r}`)].join("\n"),
    code: 1,
  };
}
