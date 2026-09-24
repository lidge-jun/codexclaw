/**
 * goalplan-cli.ts — `cxc loop <verb>` terminal surface (also `cxc goalplan`).
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
import { captureSessionSourceIdentity } from "./session-source-identity.js";
import { checkBoundSourceIdentity } from "./source-gate.js";
import { resolveSessionSource } from "./session-source.js";
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












const VERB_RULES                                           = {
  init: { allowed: new Set(["--objective", "--session", "--criterion", "--schema-version", "--cwd"]), repeatable: new Set(["--criterion"]), usage: "init --objective <text> [--session <id>] [--criterion <text>]... [--schema-version <n>] [--cwd <path>]" },
  show: { allowed: new Set(["--slug", "--objective", "--session", "--cwd"]), repeatable: new Set(), usage: "show (--slug <slug> | --objective <text> | --session <id>) [--cwd <path>]" },
  validate: { allowed: new Set(["--slug", "--objective", "--session", "--cwd"]), repeatable: new Set(), usage: "validate (--slug <slug> | --objective <text> | --session <id>) [--cwd <path>]" },
  steer: { allowed: new Set(["--session", "--batch-json", "--cwd"]), repeatable: new Set(), usage: "steer --session <id> --batch-json <path-or-json> [--cwd <path>]" },
  "add-criterion": { allowed: new Set(["--session", "--criterion", "--surface", "--cwd"]), repeatable: new Set(), usage: "add-criterion --session <id> --criterion <text> [--surface logic|web|tui|desktop] [--cwd <path>]" },
  "add-work-phase": { allowed: new Set(["--session", "--id", "--title", "--depends-on", "--cwd"]), repeatable: new Set(["--depends-on"]), usage: "add-work-phase --session <id> --id <id> --title <text> [--depends-on <id>]... [--cwd <path>]" },
  ready: { allowed: new Set(["--slug", "--objective", "--session", "--json", "--cwd"]), repeatable: new Set(), usage: "ready (--slug <slug> | --objective <text> | --session <id>) [--json] [--cwd <path>]" },
  "add-task": { allowed: new Set(["--session", "--work-phase", "--id", "--title", "--depends-on", "--cwd"]), repeatable: new Set(["--depends-on"]), usage: "add-task --session <id> --work-phase <id> --id <id> --title <text> [--depends-on <task-id>]... [--cwd <path>]" },
  "complete-task": { allowed: new Set(["--session", "--work-phase", "--id", "--outcome", "--cwd"]), repeatable: new Set(), usage: "complete-task --session <id> --work-phase <id> --id <id> --outcome <text> [--cwd <path>]" },
  "meet-criterion": { allowed: new Set(["--session", "--id", "--evidence", "--cwd"]), repeatable: new Set(), usage: "meet-criterion --session <id> --id <id> --evidence <text> [--cwd <path>]" },
  help: { allowed: new Set(), repeatable: new Set(), usage: "--help" },
};

/** Structural argv parse. argv excludes the `goalplan` kind token. */
export function parseGoalplanCliArgs(argv          , cwd        )                                          {
  const verb = (argv[0] ?? "").toLowerCase();
  // #47: `--help` on a sibling command used to be reported as an unknown verb, so an
  // agent that followed `cxc --help`'s own pointer hit a non-zero exit and had to
  // discover every flag one rejection at a time. Same contract as orchestrate.
  if (verb === "help" || verb === "--help" || verb === "-h") {
    if (argv.length > 1) return { error: `help: unexpected argument '${argv[1]}'` };
    return { verb: "help", cwd, criteria: [] };
  }
  if (!VERBS.has(verb)) {
    return {
      error: `unknown loop verb '${argv[0] ?? ""}' (expected init|show|validate|steer|add-criterion|add-work-phase|ready|add-task|complete-task|meet-criterion); run cxc loop --help`,
    };
  }
  const selected = verb                ;
  const rule = VERB_RULES[selected];
  const out                  = { verb: selected, cwd, criteria: [], dependsOn: [] };
  const seen = new Set              ();
  const reject = (message        )                        => ({ error: `${selected}: ${message}` });
  for (let i = 1; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) return reject(`unexpected positional argument '${token}'`);
    // Every value flag also takes `--flag=value`, the only way to pass a value
    // that itself starts with `--` (the space form treats that as a missing value).
    const eq = token.indexOf("=");
    const flag = (eq > 0 ? token.slice(0, eq) : token)                ;
    const inlineValue = eq > 0 ? token.slice(eq + 1) : undefined;
    if (!rule.allowed.has(flag)) {
      if (selected === "init" && flag === "--surface") {
        return reject("--surface is not applied at init; use add-criterion --surface <logic|web|tui|desktop>. Nothing was written.");
      }
      return reject(`unknown flag '${token}'`);
    }
    if (seen.has(flag) && !rule.repeatable.has(flag)) return reject(`${flag} may be provided only once`);
    seen.add(flag);
    if (flag === "--json") {
      if (inlineValue !== undefined) return reject("--json takes no value");
      out.json = true;
      continue;
    }
    const value = inlineValue !== undefined ? inlineValue : argv[++i];
    const missing = inlineValue !== undefined
      ? inlineValue.length === 0
      : value === undefined || value.startsWith("--");
    if (missing) {
      if (flag === "--surface") return reject("--surface needs a value (logic|web|tui|desktop)");
      return reject(inlineValue !== undefined
        ? `${flag} requires a value`
        : `${flag} requires a value (use ${flag}=<value> for a value that starts with --)`);
    }
    switch (flag) {
      case "--objective": out.objective = value; break;
      case "--slug": out.slug = value; break;
      case "--criterion": out.criteria.push(value); break;
      case "--cwd": out.cwd = value; break;
      case "--session": out.session = value; break;
      case "--batch-json": out.batchJson = value; break;
      case "--surface": out.surfaceGiven = true; out.surface = value; break;
      case "--id": out.id = value; break;
      case "--title": out.title = value; break;
      case "--work-phase": out.workPhaseId = value; break;
      case "--outcome": out.outcome = value; break;
      case "--schema-version": {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return reject("--schema-version requires a finite number");
        out.schemaVersion = parsed;
        break;
      }
      case "--evidence": out.evidence = value; break;
      case "--depends-on": {
        const dependency = value.trim();
        if (!dependency) return reject("--depends-on requires one non-empty prerequisite id");
        if (out.dependsOn .includes(dependency)) return reject(`--depends-on must not repeat prerequisite id '${dependency}'`);
        out.dependsOn .push(dependency);
        break;
      }
      default: return reject(`unknown flag '${flag}'`);
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
const SURFACES                      = new Set(["logic", "web", "tui", "desktop"]);
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
    if (args.surfaceGiven && args.surface === undefined) {
      return { output: "loop add-criterion: --surface needs a value (logic|web|tui|desktop)", code: 1 };
    }
    const surface = args.surface ?? "logic";
    if (!SURFACES.has(surface)) {
      return { output: `loop add-criterion: --surface must be logic|web|tui|desktop (got '${args.surface}')`, code: 1 };
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
    ...(["init", "show", "validate", "steer", "add-criterion", "add-work-phase", "ready", "add-task", "complete-task", "meet-criterion", "help"]         )
      .map((verb) => `  cxc loop ${VERB_RULES[verb].usage}`),
    "",
    "Notes:",
    "  Mutating verbs require --session <id>; show, validate, and ready are read-only.",
    "  Unknown flags, stray positionals, missing values, and flags on the wrong verb are rejected before dispatch.",
    "  Every value flag also accepts --flag=value; use it for a value that starts with --.",
    "  The goalplan lives at <cwd>/.codexclaw/goalplans/<slug>/goalplan.json, so --cwd",
    "  matters when the process cwd is not the workspace you are planning in.",
    "  Repeat --depends-on once per prerequisite; add-task accepts only existing task ids",
    "  from the same work phase; comma-separated values are one id.",
    "  complete-task requires non-empty outcome evidence and never replaces a stored outcome.",
    "  init declares schemaVersion 1 unless --schema-version says otherwise. 2 and 3",
    "  additionally require an approved finalGate, and no verb in this build opens a",
    "  final-gate review round, so opt in only if you can record that gate yourself.",
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
    if (args.surfaceGiven) {
      return {
        output: "loop init: --surface is not applied at init; bind the plan with --session and register each surfaced criterion with cxc loop add-criterion --session <id> --criterion <text> --surface <logic|web|tui|desktop>\nNothing was written.",
        code: 1,
      };
    }
    const slug = deriveSlug(objective);
    const existing = readGoalplan(args.cwd, slug);
    if (existing) {
      return { output: `loop init: a plan already exists at slug '${slug}' (use show/validate)`, code: 1 };
    }
    // #133: a BOUND plan promises a closable cycle. Refuse here when the source
    // identity cannot be resolved, rather than letting P->A->B->C succeed and then
    // stranding the session at C with no way to produce a testReceiptPath.
    // Guarded on --session: `loop init` without one writes the local artifact and
    // binds nothing, so it keeps its current behaviour. Same condition the slug
    // binding below uses.
    if (typeof args.session === "string" && args.session.length > 0) {
      const gate = checkBoundSourceIdentity(args.cwd, args.session);
      if (!gate.ok) {
        return { output: `loop init: ${gate.reason}\nNothing was written.`, code: 1 };
      }
    }
    const plan = buildGoalplan({
      objective,
      criteria: args.criteria.map((scenario) => ({ scenario })),
      schemaVersion: args.schemaVersion,
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
  if (args.session) {
    try { resolveSessionSource(args.cwd, args.session); }
    catch (err) { return { code: 1, output: `loop validate: SOURCE-ROOT: ${err instanceof Error ? err.message : String(err)}` }; }
  } else if (plan.finalGate?.sourceIdentity?.sourceRoot) {
    return { code: 1, output: "loop validate: SOURCE-ROOT: pass --session <id> to validate a bound source worktree." };
  }
  const ctx                        = {
    cwd: args.cwd,
    captureSourceIdentity: (cwd) => args.session ? captureSessionSourceIdentity(cwd, args.session) : captureSourceIdentity(cwd),
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
