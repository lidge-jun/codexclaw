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
  addGoalplanTask,
  buildGoalplan,
  completeGoalplanTask,
  goalplanDefinitionIntegrityReasons,
  goalplanDependencyCompletionReasons,
  goalplanWriteLockStatus,
  meetGoalplanCriterion,
  readGoalplan,
  readGoalplanDetailed,
  readyTasks,
  readyWorkPhases,
  withGoalplanWriteLock,
  writeGoalplan,
  appendGoalplanLedger,
  validateGoalplan,
  isGoalplanComplete,
  remainingWorkPhases,
  unmetCriteria,





} from "./goalplan.js";
import { deriveSlug } from "./freeze.js";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { isCanonicalSessionId, readState, writeState } from "./state.js";
import { captureSourceIdentity, compareSource } from "./source-identity.js";
import { parseSourceBoundReceipt } from "./source-receipt.js";
import { applySteeringBatch } from "./steering.js";
























































const VERBS                      = new Set              ([
  "init",
  "show",
  "validate",
  "steer",
  "add-criterion",
  "add-work-phase",
  "ready",
  "add-task",
  "complete-task",
  "meet-criterion",
]);

/** Structural argv parse. argv excludes the `goalplan` kind token. */
export function parseGoalplanCliArgs(argv          , cwd        )                                          {
  const verb = (argv[0] ?? "").toLowerCase();
  // #47: `--help` on a sibling command used to be reported as an unknown verb, so an
  // agent that followed `cxc --help`'s own pointer hit a non-zero exit and had to
  // discover every flag one rejection at a time. Same contract as orchestrate.
  if (verb === "help" || verb === "--help" || verb === "-h") {
    return { verb: "help", cwd, criteria: [] };
  }
  if (!VERBS.has(verb)) {
    return {
      error: `unknown loop verb '${argv[0] ?? ""}' (expected init|show|validate|steer|add-criterion|add-work-phase|ready|add-task|complete-task|meet-criterion); run cxc loop --help`,
    };
  }
  const out                  = { verb: verb                , cwd, criteria: [], dependsOn: [] };
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
    else if (a === "--work-phase") out.workPhaseId = argv[++i];
    else if (a === "--outcome") out.outcome = argv[++i];
    else if (a === "--evidence") out.evidence = argv[++i];
    else if (a === "--json") out.json = true;
    else if (a === "--depends-on") {
      // Repeated, never split: `--depends-on a,b` is ONE id. A comma-splitting parser
      // would silently invent ids, and the dangling-reference check would then blame
      // the plan for something the parser did.
      const raw = argv[++i];
      const v = typeof raw === "string" ? raw.trim() : "";
      // Both malformed cases are REJECTIONS, not silent drops. Dropping a blank would
      // register a phase with fewer prerequisites than the caller typed, and dropping a
      // repeat would hide a typo that meant a different id.
      if (v.length === 0) return { error: "--depends-on requires one non-empty prerequisite id" };
      if (out.dependsOn .includes(v)) return { error: `--depends-on must not repeat prerequisite id '${v}'` };
      out.dependsOn .push(v);
    }
  }
  return out;
}






function resolveSlug(args                 )                {
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

function renderPlan(plan          , lock                          )         {
  return renderPlanLines(plan, lock);
}

/**
 * Turn a failed read into one sentence that names the actual failure.
 *
 * Every failure used to render as "no plan found at slug X", so a truncated write
 * and an absent plan were indistinguishable and the suggested remedy (`loop init`)
 * was wrong for half of them (issue #29).
 */
function describeReadFailure(read                    , verb        , slug        )         {
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
function runSteer(args                 )                    {
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
  let batch         ;
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
const SURFACES                      = new Set(["logic", "web", "tui"]);
function runAddOp(args                 )                    {
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

  let op                         ;
  let summary        ;
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
    const dependsOn = args.dependsOn ?? [];
    op = { kind: "add-work-phase", id, title, ...(dependsOn.length > 0 ? { dependsOn } : {}) };
    // dependsOn stays OUT of the summary so a phase registered without prerequisites keeps
    // the exact idempotency key it had before this upgrade. Re-running an old command must
    // still be recorded as a duplicate, not applied a second time.
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

/**
 * 060 wp6: "what can I run right now" as a first-class read, not a derivation the caller
 * has to redo. The Stop hook and this verb consume the SAME two helpers, so an agent reading
 * the terminal and an agent reading the Stop block cannot disagree about readiness.
 *
 * Integrity is checked FIRST. Listing ready items out of a plan with a duplicate id or a
 * dangling edge would hand back a confident answer computed from a graph the plan itself
 * rejects.
 */
function runReady(args                 , plan          )                    {
  const reasons = [
    ...goalplanDefinitionIntegrityReasons(plan),
    ...goalplanDependencyCompletionReasons(plan),
  ];
  if (reasons.length > 0) {
    return {
      output: [`loop ready: ${plan.slug} has an invalid dependency graph`, ...reasons.map((r) => `  - ${r}`)].join("\n"),
      code: 1,
    };
  }

  const phases = readyWorkPhases(plan);
  const tasks = readyTasks(plan);
  if (args.json === true) {
    return {
      output: JSON.stringify({
        slug: plan.slug,
        // dependsOn is part of the answer: "wp-live is ready" and "wp-live is ready BECAUSE
        // wp-base is done" are different claims, and only the second one can be audited.
        readyWorkPhases: phases.map((wp) => ({
          id: wp.id,
          title: wp.title,
          status: wp.status,
          dependsOn: wp.dependsOn ?? [],
        })),
        readyTasks: tasks.map((entry) => ({
          workPhaseId: entry.workPhaseId,
          id: entry.task.id,
          title: entry.task.title,
        })),
      }),
      code: 0,
    };
  }

  const lines = [`[codexclaw loop ready: ${plan.slug}]`];
  lines.push(phases.length > 0
    ? `readyWorkPhases: ${phases.map((wp) => `${wp.id} (${wp.title})`).join("; ")}`
    : "readyWorkPhases: none");
  lines.push(tasks.length > 0
    ? `readyTasks: ${tasks.map((entry) => `${entry.workPhaseId}/${entry.task.id} (${entry.task.title})`).join("; ")}`
    : "readyTasks: none");
  return { output: lines.join("\n"), code: 0 };
}

/**
 * 060 wp6: the three lifecycle verbs share one locked read-modify-write.
 *
 * They all read the plan, apply one pure transition, then write. Giving each verb its own
 * critical section would be three chances to forget the lock; sharing one is why the lock
 * audit counts exactly one new locked write for all three.
 *
 * goalplan.json is the commit point. A failed ledger append returns success with a warning
 * rather than claiming the transition did not happen — the plan on disk already moved.
 */
function runLifecycle(args                 )                    {
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

  const id = (args.id ?? "").trim();

  let ledgerEvent                                                                 = null;
  let ledgerDetail = "";
  let transition                                             ;

  if (args.verb === "add-task") {
    const workPhaseId = (args.workPhaseId ?? "").trim();
    const title = (args.title ?? "").trim();
    // One sentence naming every required argument. Reporting them one rejection at a time
    // is what issue #31 was about: the caller pays a round trip per missing flag.
    if (workPhaseId.length === 0 || id.length === 0 || title.length === 0) {
      return { output: "loop add-task: --work-phase, --id, and non-empty --title are required", code: 1 };
    }
    const dependsOn = args.dependsOn ?? [];
    if (dependsOn.length > 0) {
      ledgerEvent = "dependency_registered";
      ledgerDetail = `task ${workPhaseId}/${id} depends on ${dependsOn.join(", ")}`;
    }
    transition = (plan) => addGoalplanTask(plan, workPhaseId, { id, title, dependsOn });
  } else if (args.verb === "complete-task") {
    const workPhaseId = (args.workPhaseId ?? "").trim();
    const outcome = (args.outcome ?? "").trim();
    if (workPhaseId.length === 0 || id.length === 0 || outcome.length === 0) {
      return { output: "loop complete-task: --work-phase, --id, and non-empty --outcome are required", code: 1 };
    }
    ledgerEvent = "task_done";
    ledgerDetail = outcome;
    transition = (plan) => completeGoalplanTask(plan, workPhaseId, id, outcome);
  } else {
    const evidence = (args.evidence ?? "").trim();
    if (id.length === 0 || evidence.length === 0) {
      return { output: "loop meet-criterion: --id and non-empty --evidence are required", code: 1 };
    }
    ledgerEvent = "criterion_met";
    ledgerDetail = evidence;
    transition = (plan) => meetGoalplanCriterion(plan, id, evidence);
  }










  const locked = withGoalplanWriteLock                 (args.cwd, slug, () => {
    const plan = readGoalplan(args.cwd, slug);
    if (!plan) return { kind: "missing" };
    const result = transition(plan);
    if (result.kind === "rejected") return { kind: "refused", reason: result.reason };
    if (result.kind === "unchanged") return { kind: "unchanged", reason: result.reason };
    writeGoalplan(args.cwd, result.plan);
    return { kind: "committed" };
  });

  if (locked.kind === "locked" || locked.kind === "unreadable") {
    return { output: `loop ${args.verb}: ${locked.reason}`, code: 1 };
  }
  const inner = locked.value;
  if (inner.kind === "missing") {
    const read = readGoalplanDetailed(args.cwd, slug);
    return { output: describeReadFailure(read, args.verb, slug), code: 1 };
  }
  if (inner.kind === "refused") {
    return { output: `loop ${args.verb}: ${inner.reason}`, code: 1 };
  }
  if (inner.kind === "unchanged") {
    // The pure reason IS the message. Wrapping it in a second sentence would give the
    // same state two different wordings depending on which surface reported it.
    return { output: `loop ${args.verb}: ${inner.reason}; nothing to do`, code: 0 };
  }

  let warning = "";
  if (ledgerEvent) {
    try {
      appendGoalplanLedger(args.cwd, slug, {
        ts: new Date().toISOString(),
        slug,
        event: ledgerEvent,
        detail: ledgerDetail,
      });
    } catch (err) {
      warning = `\nwarning: goalplan state was committed, but ledger append failed: ${(err         )?.message ?? String(err)}`;
    }
  }
  return { output: `loop ${args.verb}: ${slug} ${id} applied${warning}`, code: 0 };
}

function renderPlanLines(plan          , lock                          )         {
  const lines = [
    `[codexclaw loop: ${plan.slug}]`,
    `objective: ${plan.objective}`,
    `host: armed=${plan.host.armed} source=${plan.host.source}`,
    `workPhases: ${plan.workPhases.length} (remaining ${remainingWorkPhases(plan).length})`,
    `criteria: ${plan.criteria.length} (unmet ${unmetCriteria(plan).length})`,
    `complete: ${isGoalplanComplete(plan)}`,
  ];
  if (lock) {
    // 060 wp6: a stuck lock used to be invisible from the CLI, so a blocked write looked
    // like a hung command. The age is what tells a live holder from an abandoned one.
    lines.push(lock.exists
      ? `writeLock: present path=${lock.path} ageMs=${lock.ageMs}`
      : `writeLock: absent path=${lock.path}`);
  }
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
export function renderGoalplanHelp()         {
  return [
    "cxc loop — durable goalplan for a multi-cycle PABCD loop",
    "",
    "Usage:",
    "  cxc loop init --objective <text> --session <id> [--criterion <text>]... [--cwd <path>]",
    "  cxc loop show (--slug <slug> | --objective <text>) [--cwd <path>]",
    "  cxc loop validate --slug <slug> [--cwd <path>]",
    // 060 wp6: --slug is GONE from the three mutating usage lines. `runSteer()` and
    // `runAddOp()` read `readState(cwd, session).slug` and ignore `args.slug`, so those
    // lines advertised syntax that never ran. The read-only verbs keep it because
    // `resolveSlug()` actually consumes the argument.
    "  cxc loop steer --session <id> --batch-json <path-or-json> [--cwd <path>]",
    "  cxc loop add-work-phase --session <id> --id <id> --title <text> [--depends-on <id>]... [--cwd <path>]",
    "  cxc loop add-criterion --session <id> --criterion <text> [--surface logic|web|tui] [--cwd <path>]",
    "  cxc loop ready (--slug <slug> | --objective <text> | --session <id>) [--json] [--cwd <path>]",
    "  cxc loop add-task --session <id> --work-phase <id> --id <id> --title <text> [--depends-on <task-id>]... [--cwd <path>]",
    "  cxc loop complete-task --session <id> --work-phase <id> --id <id> --outcome <text> [--cwd <path>]",
    "  cxc loop meet-criterion --session <id> --id <id> --evidence <text> [--cwd <path>]",
    "  cxc loop --help",
    "",
    "Notes:",
    "  Mutating verbs require --session <id>; show, validate, and ready are read-only.",
    "  The goalplan lives at <cwd>/.codexclaw/goalplans/<slug>/goalplan.json, so --cwd",
    "  matters when the process cwd is not the workspace you are planning in.",
    "  Repeat --depends-on once per prerequisite; add-task accepts only existing task ids",
    "  from the same work phase; comma-separated values are one id.",
    "  complete-task requires non-empty outcome evidence and never replaces a stored outcome.",
    "  meet-criterion requires non-empty captured evidence for the same reason.",
    "",
    "steer --batch-json expects an object with:",
    '  { "idempotencyKey": "<unique>", "rationale": "<why>", "evidence": "<proof>",',
    '    "ops": [ { "kind": "annotate", "note": "..." } ] }',
    "  op kinds: annotate | add-criterion | add-work-phase (all additive — steering",
    "  cannot weaken a completion criterion).",
  ].join("\n");
}

export function runGoalplanCli(args                 )                    {
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

  if (args.verb === "ready") {
    const session = (args.session ?? "").trim();
    // Checked BEFORE resolveSlug(): a non-canonical id would be sanitized into a
    // DIFFERENT session's state file, and this read-only verb would then print a plan
    // the caller never named. Fail before anything about that plan reaches the output.
    if (session.length > 0 && !isCanonicalSessionId(session)) {
      return { output: "loop ready: session id is not canonical", code: 1 };
    }
  }

  if (args.verb === "steer") return runSteer(args);

  if (args.verb === "add-criterion" || args.verb === "add-work-phase") return runAddOp(args);

  if (args.verb === "add-task" || args.verb === "complete-task" || args.verb === "meet-criterion") {
    return runLifecycle(args);
  }

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
    return { output: renderPlan(plan, goalplanWriteLockStatus(args.cwd, plan.slug)), code: 0 };
  }

  if (args.verb === "ready") return runReady(args, plan);

  // validate (E8 quality gate)
  // A read-only context, so `loop validate` can report on a schemaVersion 2 plan
  // instead of refusing every one of them for a missing context. Nothing here
  // mutates state; the enforcing consumer (goal-gate) is wired separately.
  const ctx                        = {
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
