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
  readGoalplanDetailed,
  writeGoalplan,
  appendGoalplanLedger,
  validateGoalplan,
  isGoalplanComplete,
  remainingWorkPhases,
  unmetCriteria,
  type Goalplan,
  type GoalplanReadResult,
  type GoalplanValidationCtx,
} from "./goalplan.ts";
import { deriveSlug } from "./freeze.ts";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { isCanonicalSessionId, readState, writeState } from "./state.ts";
import { captureSourceIdentity, compareSource } from "./source-identity.ts";
import { parseSourceBoundReceipt } from "./source-receipt.ts";
import { applySteeringBatch } from "./steering.ts";

export type GoalplanVerb = "init" | "show" | "validate" | "steer" | "add-criterion" | "add-work-phase" | "help";

export interface GoalplanCliArgs {
  verb: GoalplanVerb;
  cwd: string;
  objective?: string;
  slug?: string;
  criteria: string[];
  /**
   * 030.3: when set, `init` persists the derived slug into this session's state.json so the
   * Stop hook (040) can resolve the goalplan strictly by `state.slug` (session-bound, never a
   * directory scan). Without it, `init` only writes the local artifact.
   */
  session?: string;
  /** `steer` only: a JSON batch, or a path to a file holding one. */
  batchJson?: string;
  /** `init` / `add-criterion`: the criterion surface (logic|web|tui). */
  surface?: string;
  /** `add-work-phase` only. */
  id?: string;
  title?: string;
}

export interface GoalplanCliParseError {
  error: string;
}

const VERBS: ReadonlySet<string> = new Set<GoalplanVerb>([
  "init",
  "show",
  "validate",
  "steer",
  "add-criterion",
  "add-work-phase",
]);

/** Structural argv parse. argv excludes the `goalplan` kind token. */
export function parseGoalplanCliArgs(argv: string[], cwd: string): GoalplanCliArgs | GoalplanCliParseError {
  const verb = (argv[0] ?? "").toLowerCase();
  // #47: `--help` on a sibling command used to be reported as an unknown verb, so an
  // agent that followed `cxc --help`'s own pointer hit a non-zero exit and had to
  // discover every flag one rejection at a time. Same contract as orchestrate.
  if (verb === "help" || verb === "--help" || verb === "-h") {
    return { verb: "help", cwd, criteria: [] };
  }
  if (!VERBS.has(verb)) {
    return {
      error: `unknown loop verb '${argv[0] ?? ""}' (expected init|show|validate|steer|add-criterion|add-work-phase); run cxc loop --help`,
    };
  }
  const out: GoalplanCliArgs = { verb: verb as GoalplanVerb, cwd, criteria: [] };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--objective") out.objective = argv[++i];
    else if (a === "--slug") out.slug = argv[++i];
    else if (a === "--criterion") {
      const v = argv[++i];
      if (typeof v === "string" && v.length > 0) out.criteria.push(v);
    } else if (a === "--cwd") out.cwd = argv[++i] ?? cwd;
    else if (a === "--session") out.session = argv[++i];
    else if (a === "--batch-json") out.batchJson = argv[++i];
    else if (a === "--surface") out.surface = argv[++i];
    else if (a === "--id") out.id = argv[++i];
    else if (a === "--title") out.title = argv[++i];
  }
  return out;
}

export interface GoalplanCliResult {
  output: string;
  code: number;
}

function resolveSlug(args: GoalplanCliArgs): string | null {
  if (typeof args.slug === "string" && args.slug.length > 0) return deriveSlug(args.slug);
  if (typeof args.objective === "string" && args.objective.length > 0) return deriveSlug(args.objective);
  // #48: `loop init --session` already binds the slug into the session file, so a
  // later `show`/`validate` can recover it without the caller re-typing a
  // 47-character derived slug. This also makes the session the source of truth
  // when the same id has state in more than one tree.
  if (typeof args.session === "string" && args.session.length > 0) {
    const bound = readState(args.cwd, args.session).slug;
    if (typeof bound === "string" && bound.length > 0) return bound;
  }
  return null;
}

function renderPlan(plan: Goalplan): string {
  return renderPlanLines(plan);
}

/**
 * Turn a failed read into one sentence that names the actual failure.
 *
 * Every failure used to render as "no plan found at slug X", so a truncated write
 * and an absent plan were indistinguishable and the suggested remedy (`loop init`)
 * was wrong for half of them (issue #29).
 */
function describeReadFailure(read: GoalplanReadResult, verb: string, slug: string): string {
  const d = read.diagnostic;
  const detail =
    d?.kind === "absent"
      ? `no plan found at slug '${slug}' (${d.path} does not exist) - run \`cxc loop init --objective "..."\``
      : d?.kind === "invalid-json"
        ? `the plan at ${d.path} is not valid JSON: ${d.detail}`
        : d?.kind === "invalid-shape"
          ? `the plan at ${d.path} is structurally invalid - field '${d.field}': ${d.detail}`
          : `the plan at ${d?.path ?? slug} could not be read: ${d?.kind === "unreadable" ? d.detail : "unknown"}`;
  return `loop ${verb}: ${detail}`;
}

/**
 * `steer` resolves its plan through the session binding rather than a slug flag:
 * steering targets whatever this session is actually working on.
 *
 * The session id must be canonical. State paths sanitize it, so `a/b` would
 * quietly resolve to session `a-b` and steer a different goal — silent data
 * corruption dressed up as a typo.
 */
function runSteer(args: GoalplanCliArgs): GoalplanCliResult {
  const session = (args.session ?? "").trim();
  if (session.length === 0) return { output: "loop steer: --session <id> is required", code: 1 };
  if (!isCanonicalSessionId(session)) {
    return {
      output: `loop steer: --session "${session}" is not a canonical session id — it would resolve to a different state file and steer another goal`,
      code: 1,
    };
  }
  const raw = (args.batchJson ?? "").trim();
  if (raw.length === 0) return { output: "loop steer: --batch-json <path-or-json> is required", code: 1 };

  let text = raw;
  if (!raw.startsWith("{")) {
    try {
      text = readFileSync(resolve(args.cwd, raw), "utf8");
    } catch (err) {
      return { output: `loop steer: could not read the batch at ${raw} (${err instanceof Error ? err.message : String(err)})`, code: 1 };
    }
  }
  let batch: unknown;
  try {
    batch = JSON.parse(text);
  } catch (err) {
    return { output: `loop steer: batch is not valid JSON (${err instanceof Error ? err.message : String(err)})`, code: 1 };
  }

  const slug = readState(args.cwd, session).slug;
  if (!slug) {
    return { output: `loop steer: session '${session}' has no bound goalplan — run \`cxc loop init --session ${session}\` first`, code: 1 };
  }

  const result = applySteeringBatch(args.cwd, slug, batch);
  switch (result.kind) {
    case "applied":
      return {
        output: result.warning
          ? `loop steer: applied ${result.entry.idempotencyKey} (${result.entry.summary})\n  warning: ${result.warning}`
          : `loop steer: applied ${result.entry.idempotencyKey} (${result.entry.summary})`,
        code: 0,
      };
    case "duplicate":
      return {
        output: `loop steer: ${result.entry.idempotencyKey} was already applied at ${result.entry.appliedAt} — nothing to do`,
        code: 0,
      };
    case "locked":
      return { output: `loop steer: ${result.reason}`, code: 1 };
    case "rejected":
      return { output: `loop steer: ${result.reason}`, code: 1 };
  }
}

/**
 * `add-criterion` and `add-work-phase` are thin sugar over applySteeringBatch:
 * that path already owns the lock, the idempotency key and the ledger entry, so a
 * second write path would be a second chance to corrupt the plan.
 */
const SURFACES: ReadonlySet<string> = new Set(["logic", "web", "tui"]);
function runAddOp(args: GoalplanCliArgs): GoalplanCliResult {
  const session = (args.session ?? "").trim();
  if (session.length === 0) return { output: `loop ${args.verb}: --session <id> is required`, code: 1 };
  if (!isCanonicalSessionId(session)) {
    return {
      output: `loop ${args.verb}: --session "${session}" is not a canonical session id - it would resolve to a different state file and steer another goal`,
      code: 1,
    };
  }
  const slug = readState(args.cwd, session).slug;
  if (!slug) {
    return {
      output: `loop ${args.verb}: session '${session}' has no bound goalplan - run \`cxc loop init --session ${session}\` first`,
      code: 1,
    };
  }

  let op: Record<string, unknown>;
  let summary: string;
  if (args.verb === "add-criterion") {
    const scenario = (args.criteria[0] ?? "").trim();
    if (scenario.length === 0) {
      return { output: 'loop add-criterion: --criterion "<scenario>" is required', code: 1 };
    }
    const surface = args.surface ?? "logic";
    if (!SURFACES.has(surface)) {
      return { output: `loop add-criterion: --surface must be logic|web|tui (got '${args.surface}')`, code: 1 };
    }
    op = { kind: "add-criterion", scenario, surface };
    summary = scenario;
  } else {
    const id = (args.id ?? "").trim();
    const title = (args.title ?? "").trim();
    if (id.length === 0 || title.length === 0) {
      return { output: "loop add-work-phase: --id <id> and --title <text> are both required", code: 1 };
    }
    op = { kind: "add-work-phase", id, title };
    summary = `${id}: ${title}`;
  }

  // The idempotency key is content-derived, so re-running the same command is a
  // recorded duplicate rather than a second criterion with the same text.
  const key = `${args.verb}-${createHash("sha256").update(summary).digest("hex").slice(0, 12)}`;
  const result = applySteeringBatch(args.cwd, slug, {
    idempotencyKey: key,
    rationale: `cxc loop ${args.verb}`,
    evidence: summary,
    ops: [op],
  });
  switch (result.kind) {
    case "applied":
      return { output: renderPlan(result.plan), code: 0 };
    case "duplicate":
      return { output: `loop ${args.verb}: already applied at ${result.entry.appliedAt} - nothing to do`, code: 0 };
    case "locked":
    case "rejected":
      return { output: `loop ${args.verb}: ${result.reason}`, code: 1 };
  }
}

function renderPlanLines(plan: Goalplan): string {
  const lines = [
    `[codexclaw loop: ${plan.slug}]`,
    `objective: ${plan.objective}`,
    `host: armed=${plan.host.armed} source=${plan.host.source}`,
    `workPhases: ${plan.workPhases.length} (remaining ${remainingWorkPhases(plan).length})`,
    `criteria: ${plan.criteria.length} (unmet ${unmetCriteria(plan).length})`,
    `complete: ${isGoalplanComplete(plan)}`,
  ];
  for (const wp of plan.workPhases) {
    lines.push(`  - ${wp.id} [${wp.status}] ${wp.title}`);
  }
  for (const c of plan.criteria) {
    lines.push(`  - ${c.id} [${c.status}] ${c.scenario}`);
  }
  return lines.join("\n");
}

/**
 * #47: every flag below used to be discoverable only by running the command and
 * reading the rejection, one missing argument at a time. The steer batch shape is
 * spelled out for the same reason.
 */
export function renderGoalplanHelp(): string {
  return [
    "cxc loop — durable goalplan for a multi-cycle PABCD loop",
    "",
    "Usage:",
    "  cxc loop init --objective <text> --session <id> [--criterion <text>]... [--cwd <path>]",
    "  cxc loop show (--slug <slug> | --objective <text>) [--cwd <path>]",
    "  cxc loop validate --slug <slug> [--cwd <path>]",
    "  cxc loop steer --session <id> --slug <slug> --batch-json <path-or-json> [--cwd <path>]",
    "  cxc loop add-work-phase --session <id> --slug <slug> --id <id> --title <text>",
    "  cxc loop add-criterion --session <id> --slug <slug> --criterion <text> [--surface logic|web|tui]",
    "  cxc loop --help",
    "",
    "Notes:",
    "  Mutating verbs require --session <id>; show and validate are read-only.",
    "  The goalplan lives at <cwd>/.codexclaw/goalplans/<slug>/goalplan.json, so --cwd",
    "  matters when the process cwd is not the workspace you are planning in.",
    "",
    "steer --batch-json expects an object with:",
    '  { "idempotencyKey": "<unique>", "rationale": "<why>", "evidence": "<proof>",',
    '    "ops": [ { "kind": "annotate", "note": "..." } ] }',
    "  op kinds: annotate | add-criterion | add-work-phase (all additive — steering",
    "  cannot weaken a completion criterion).",
  ].join("\n");
}

export function runGoalplanCli(args: GoalplanCliArgs): GoalplanCliResult {
  if (args.verb === "help") return { output: renderGoalplanHelp(), code: 0 };
  if (args.verb === "init") {
    const objective = (args.objective ?? "").trim();
    if (objective.length === 0) {
      return { output: "loop init: --objective \"<text>\" is required", code: 1 };
    }
    const slug = deriveSlug(objective);
    const existing = readGoalplan(args.cwd, slug);
    if (existing) {
      return { output: `loop init: a plan already exists at slug '${slug}' (use show/validate)`, code: 1 };
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

  if (args.verb === "steer") return runSteer(args);

  if (args.verb === "add-criterion" || args.verb === "add-work-phase") return runAddOp(args);

  const slug = resolveSlug(args);
  if (!slug) {
    return {
      output: `loop ${args.verb}: --slug "<text>", --objective "<text>", or --session <id> (with a bound plan) is required`,
      code: 1,
    };
  }
  const plan = readGoalplan(args.cwd, slug);
  if (!plan) {
    // Issue #29: "no plan found" used to hide truncated writes and schema rejects.
    const read = readGoalplanDetailed(args.cwd, slug);
    return { output: describeReadFailure(read, args.verb, slug), code: 1 };
  }

  if (args.verb === "show") {
    return { output: renderPlan(plan), code: 0 };
  }

  // validate (E8 quality gate)
  // A read-only context, so `loop validate` can report on a schemaVersion 2 plan
  // instead of refusing every one of them for a missing context. Nothing here
  // mutates state; the enforcing consumer (goal-gate) is wired separately.
  const ctx: GoalplanValidationCtx = {
    cwd: args.cwd,
    captureSourceIdentity,
    compareSource,
    readReceipt: (path, expectedKind) => parseSourceBoundReceipt(path, args.cwd, expectedKind),
  };
  const v = validateGoalplan(plan, ctx);
  if (v.ok) {
    return { output: `[codexclaw loop validate: ${slug}] OK — complete + all met criteria carry evidence`, code: 0 };
  }
  return {
    output: [`[codexclaw loop validate: ${slug}] FAIL`, ...v.reasons.map((r) => `  - ${r}`)].join("\n"),
    code: 1,
  };
}
