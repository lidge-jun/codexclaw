/**
 * goalplan.ts — project-local durable goalplan substrate (lazygap_impl 030).
 *
 * `$cxc-loop` is a prose contract today: "work-phase = one PABCD cycle, D closes to
 * IDLE, the agent self-advances." Nothing durable records WHAT the work-phases are,
 * which criteria gate completion, or what evidence each produced. This module gives
 * that prose a backbone: a slug-namespaced plan artifact + an append-only ledger.
 *
 * Hard invariants (LOCKED — see structure/00_philosophy.md):
 *  - codexclaw NEVER writes the host goal DB. The `host` link here is PROVENANCE only:
 *    `host.armed` records that the MAIN session armed a goal at the freeze boundary; no
 *    code in this module ever calls create_goal / writes goals_1.sqlite.
 *  - All state is project-local under `.codexclaw/goalplans/<slug>/`.
 *  - readGoalplan returns null (never throws) on absent/unreadable — callers degrade,
 *    never trap a session.
 *  - The coupling to the Stop loop is one-directional and loose: a goalplan ENRICHES a
 *    Stop block reason when a host goal is active; it never ARMS the loop by itself.
 *
 * Pure shaping + direct node:fs IO (consistent with state.ts / freeze.ts; no fs seam).
 */
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  writeFileSync,
  rmSync,
  writeSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";
import { renameWithRetry } from "./atomic-write.js";
import { STATE_DIR } from "./state.js";
import { deriveSlug,                   } from "./freeze.js";


export const GOALPLANS_SUBDIR = "goalplans";
export const GOALPLAN_FILE = "goalplan.json";
export const GOALPLAN_LEDGER_FILE = "ledger.jsonl";
export const GOALPLAN_LOCK_DIR = ".goalplan.lock";
export const GOALPLAN_LOCK_OWNER_FILE = "owner.json";
export const GOALPLAN_LOCK_RETRY_DELAYS_MS = [5, 10, 20, 40]         ;

/**
 * The highest schemaVersion this binary understands. A plan that declares more
 * than this is REFUSED on read and on validate rather than clamped: an older
 * binary that quietly accepted a newer plan would strip fields it never learned
 * about, and the next write would persist that loss (wp2, 260829).
 */
export const SUPPORTED_MAX_SCHEMA_VERSION = 3;



/**
 * What surface a criterion exercises. Drives whether the final gate demands a
 * QA receipt on top of a test receipt.
 */


/**
 * `blocked` and `superseded` are both "not done" and neither counts as success.
 * They differ in what they mean for completion: a blocked phase still holds the
 * goal open (something must happen), while a superseded one does not (something
 * else covers it).
 */



































































/**
 * What a round is for. A plan audit and a final code gate cannot stand in for
 * each other, so each purpose carries its own cursor.
 */



















































































































const MAX_SLUG_BYTES = 128;

/** Reject any slug that could be interpreted as a path rather than an identifier. */
export function validateGoalplanSlug(slug        )         {
  if (
    typeof slug !== "string"
    || Buffer.byteLength(slug, "utf8") === 0
    || Buffer.byteLength(slug, "utf8") > MAX_SLUG_BYTES
    || slug === "."
    || slug === ".."
    || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(slug)
  ) {
    throw new Error(`invalid goalplan slug: ${JSON.stringify(slug)}`);
  }
  return slug;
}

function assertNotSymlink(path        )       {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
    throw new Error(`goalplan state path must not be a symlink: ${path}`);
  }
}

/**
 * Resolve a goalplan directory with one containment rule for every consumer.
 * Symlinked state roots are refused because otherwise a lexically safe slug can
 * still redirect writes outside the project.
 */
export function goalplanDir(cwd        , slug        )         {
  const safeSlug = validateGoalplanSlug(slug);
  const projectRoot = resolve(cwd);
  const stateRoot = resolve(projectRoot, STATE_DIR);
  const plansRoot = resolve(stateRoot, GOALPLANS_SUBDIR);
  const dir = resolve(plansRoot, safeSlug);
  if (!dir.startsWith(plansRoot + sep)) throw new Error("goalplan path escapes state root");
  assertNotSymlink(stateRoot);
  assertNotSymlink(plansRoot);
  assertNotSymlink(dir);
  return dir;
}

const REVIEW_STATUSES                      = new Set([
  "pending",
  "launching",
  "in_flight",
  "approved",
  "changes_requested",
  "inconclusive",
]);

function reviveLane(raw         )                    {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw                           ;
  if (typeof r.launchId !== "string" || r.launchId.length === 0) return null;
  const lane             = { launchId: r.launchId };
  if (typeof r.reviewerSession === "string") lane.reviewerSession = r.reviewerSession;
  if (typeof r.workspaceRoot === "string") lane.workspaceRoot = r.workspaceRoot;
  if (typeof r.artifactSha256 === "string") lane.artifactSha256 = r.artifactSha256;
  if (r.verdict === "pass" || r.verdict === "near-pass" || r.verdict === "fail") lane.verdict = r.verdict;
  const identity = reviveSourceIdentity(r.sourceIdentity);
  if (identity) lane.sourceIdentity = identity;
  return lane;
}

/**
 * Revive the review rounds.
 *
 * A round missing its identity, purpose, plan hash or lane is dropped rather
 * than repaired — a half-round would let a consumer believe a review happened.
 * Returns undefined when the field is absent so older plans round-trip unchanged.
 */
function reviveReviewRounds(raw         )                                 {
  if (!Array.isArray(raw)) return undefined;
  const out                     = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const r = entry                           ;
    if (typeof r.roundId !== "string" || r.roundId.length === 0) continue;
    if (r.purpose !== "plan_audit" && r.purpose !== "final_gate") continue;
    if (typeof r.planPath !== "string" || typeof r.planSha256 !== "string") continue;
    if (typeof r.status !== "string" || !REVIEW_STATUSES.has(r.status)) continue;
    const lane = reviveLane(r.lane);
    if (!lane) continue;
    const round                   = {
      roundId: r.roundId,
      purpose: r.purpose,
      planPath: r.planPath,
      planSha256: r.planSha256,
      status: r.status                     ,
      lane,
      openedAt: typeof r.openedAt === "string" ? r.openedAt : new Date(0).toISOString(),
    };
    if (typeof r.closedAt === "string") round.closedAt = r.closedAt;
    // 060 binding fields: revived only when well-formed. A half-parsed binding is
    // worse than none, since the A>B gate reads a missing field as a refusal.
    if (typeof r.ownerSessionId === "string" && r.ownerSessionId.length > 0) round.ownerSessionId = r.ownerSessionId;
    if (typeof r.workPhaseId === "string" && r.workPhaseId.length > 0) round.workPhaseId = r.workPhaseId;
    if (typeof r.planUnit === "string" && r.planUnit.length > 0) round.planUnit = r.planUnit;
    if (typeof r.planEpoch === "string" && r.planEpoch.length > 0) round.planEpoch = r.planEpoch;
    const files = revivePlanFiles(r.planFiles);
    if (files) round.planFiles = files;
    out.push(round);
  }
  return out;
}

/** 060: every entry must be well-formed, or the whole list is dropped — a partial
 *  file set would silently narrow what the round claims to have covered. */
function revivePlanFiles(raw         )                             {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out                 = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return undefined;
    const f = entry                           ;
    if (typeof f.path !== "string" || f.path.length === 0) return undefined;
    if (typeof f.sha256 !== "string" || f.sha256.length === 0) return undefined;
    out.push({ path: f.path, sha256: f.sha256 });
  }
  return out;
}

const GATE_STATUSES                      = new Set(["pending", "in_flight", "approved", "inconclusive"]);

function reviveSourceIdentity(raw         )                             {
  if (typeof raw !== "object" || raw === null) return undefined;
  const s = raw                           ;
  if (s.kind !== "resolved" && s.kind !== "unavailable") return undefined;
  const id                 = {
    kind: s.kind,
    commitSha: typeof s.commitSha === "string" ? s.commitSha : "",
    dirty: s.dirty === true,
    capturedAt: typeof s.capturedAt === "string" ? s.capturedAt : new Date(0).toISOString(),
  };
  if (typeof s.treeHash === "string") id.treeHash = s.treeHash;
  return id;
}

/**
 * A gate whose status or qaRequired cannot be trusted is dropped entirely, so a
 * malformed gate reads as "no gate recorded" on a v1 plan and as a schema
 * violation on a v2 one — never as a silently passing gate.
 */
function reviveFinalGate(raw         )                             {
  if (typeof raw !== "object" || raw === null) return undefined;
  const g = raw                           ;
  if (typeof g.status !== "string" || !GATE_STATUSES.has(g.status)) return undefined;
  if (typeof g.qaRequired !== "boolean") return undefined;
  const gate                 = {
    status: g.status                            ,
    qaRequired: g.qaRequired,
    updatedAt: typeof g.updatedAt === "string" ? g.updatedAt : new Date(0).toISOString(),
  };
  if (typeof g.reviewRoundId === "string") gate.reviewRoundId = g.reviewRoundId;
  if (typeof g.testReceiptPath === "string") gate.testReceiptPath = g.testReceiptPath;
  if (typeof g.qaReceiptPath === "string") gate.qaReceiptPath = g.qaReceiptPath;
  if (g.verdict === "pass" || g.verdict === "near-pass" || g.verdict === "fail") gate.verdict = g.verdict;
  const id = reviveSourceIdentity(g.sourceIdentity);
  if (id) gate.sourceIdentity = id;
  return gate;
}

/**
 * Revive the steering log, or report that it is unusable.
 *
 * Fail-closed, unlike review rounds. steeringLog answers "has this batch already
 * been applied", so dropping a malformed entry would let that batch run a second
 * time. Dropping a malformed review round merely loses a review, which fails in
 * the safe direction; this one fails in the dangerous one.
 *
 * Returns "invalid" so the caller can reject the whole plan rather than reading
 * it as "no steering has happened".
 */
function reviveSteeringLog(raw         )                                          {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return "invalid";
  const out                  = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return "invalid";
    const e = entry                           ;
    for (const key of ["idempotencyKey", "rationale", "evidence", "appliedAt", "summary"]) {
      if (typeof e[key] !== "string" || (e[key]          ).length === 0) return "invalid";
    }
    out.push({
      idempotencyKey: e.idempotencyKey          ,
      rationale: e.rationale          ,
      evidence: e.evidence          ,
      appliedAt: e.appliedAt          ,
      summary: e.summary          ,
    });
  }
  return out;
}

function goalplanPath(cwd        , slug        )         {
  return join(goalplanDir(cwd, slug), GOALPLAN_FILE);
}

function goalplanLedgerPath(cwd        , slug        )         {
  return join(goalplanDir(cwd, slug), GOALPLAN_LEDGER_FILE);
}

/** Declared schemaVersion of a raw parsed object; absent means 1. */
function declaredSchemaVersion(o                         )         {
  return typeof o.schemaVersion === "number" ? o.schemaVersion : 1;
}

/**
 * Revive a `dependsOn` field.
 *
 * `undefined` (field absent) and `[]` are distinct storage shapes that mean the
 * same thing for selection, so both round-trip unchanged. Anything else — a
 * non-array, a non-string element, a blank id — is `"invalid"` and fails the whole
 * plan closed: a partially dropped dependency list would silently widen what the
 * scheduler considers ready.
 */
function reviveDependsOn(value         )                                   {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return "invalid";
  const ids           = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0) return "invalid";
    ids.push(item);
  }
  return ids;
}

/** Best-effort structural validation; a malformed object reads as absent (null). */
function reviveGoalplan(parsed         , expectedSlug         )                  {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const o = parsed                           ;
  if (typeof o.objective !== "string" || typeof o.slug !== "string") return null;
  try {
    validateGoalplanSlug(o.slug);
  } catch {
    return null;
  }
  if (expectedSlug !== undefined && o.slug !== expectedSlug) return null;
  if (declaredSchemaVersion(o) > SUPPORTED_MAX_SCHEMA_VERSION) return null;
  if (!Array.isArray(o.workPhases) || !Array.isArray(o.criteria)) return null;

  const workPhases                      = [];
  for (const wp of o.workPhases             ) {
    if (typeof wp !== "object" || wp === null) return null;
    const w = wp                           ;
    if (typeof w.id !== "string" || typeof w.title !== "string") return null;
    const phaseDependsOn = reviveDependsOn(w.dependsOn);
    if (phaseDependsOn === "invalid") return null;
    const status                  =
      w.status === "in_progress" || w.status === "done" || w.status === "blocked" || w.status === "superseded"
        ? w.status
        : "pending";
    const tasks                 = [];
    for (const t of Array.isArray(w.tasks) ? (w.tasks             ) : []) {
      if (typeof t !== "object" || t === null) continue;
      const tt = t                           ;
      if (typeof tt.id !== "string" || typeof tt.title !== "string") continue;
      const taskDependsOn = reviveDependsOn(tt.dependsOn);
      if (taskDependsOn === "invalid") return null;
      const task               = { id: tt.id, title: tt.title, status: tt.status === "done" ? "done" : "pending" };
      if (taskDependsOn !== undefined) task.dependsOn = taskDependsOn;
      // A blank outcome is no evidence at all, so it stays absent rather than
      // persisting an empty string that later reads as "recorded".
      if (typeof tt.outcome === "string" && tt.outcome.trim().length > 0) task.outcome = tt.outcome.trim();
      tasks.push(task);
    }
    const criteriaIds = Array.isArray(w.criteriaIds)
      ? (w.criteriaIds             ).filter((x)              => typeof x === "string")
      : [];
    const phase                    = { id: w.id, title: w.title, status, tasks, criteriaIds };
    if (phaseDependsOn !== undefined) phase.dependsOn = phaseDependsOn;
    if (typeof w.blockedReason === "string") phase.blockedReason = w.blockedReason;
    if (typeof w.supersededBy === "string") phase.supersededBy = w.supersededBy;
    workPhases.push(phase);
  }

  const criteria                      = [];
  for (const c of o.criteria             ) {
    if (typeof c !== "object" || c === null) return null;
    const cc = c                           ;
    if (typeof cc.id !== "string" || typeof cc.scenario !== "string") return null;
    criteria.push({
      id: cc.id,
      scenario: cc.scenario,
      expectedEvidence: typeof cc.expectedEvidence === "string" ? cc.expectedEvidence : "",
      capturedEvidence: typeof cc.capturedEvidence === "string" ? cc.capturedEvidence : null,
      status: cc.status === "met" ? "met" : "open",
      // preserve only a known surface; missing and unknown both stay undefined
      ...(cc.surface === "logic" || cc.surface === "web" || cc.surface === "tui"
        ? { surface: cc.surface }
        : {}),
    });
  }

  const hostRaw = (typeof o.host === "object" && o.host !== null ? o.host : {})                           ;
  const host                   = {
    armed: hostRaw.armed === true,
    armedAt: typeof hostRaw.armedAt === "string" ? hostRaw.armedAt : null,
    source: hostRaw.source === "freeze" ? "freeze" : "none",
  };

  const reviewRounds = reviveReviewRounds(o.reviewRounds);

  const plan           = {
    objective: o.objective,
    slug: o.slug,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date(0).toISOString(),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString(),
    activeWorkPhaseId: typeof o.activeWorkPhaseId === "string" ? o.activeWorkPhaseId : null,
    workPhases,
    criteria,
    host,
  };
  // Only attach the 010 fields when they are actually present, so a plan written
  // before this feature round-trips byte-identical.
  if (reviewRounds !== undefined) plan.reviewRounds = reviewRounds;
  if (typeof o.activePlanAuditRoundId === "string") plan.activePlanAuditRoundId = o.activePlanAuditRoundId;
  if (typeof o.activeFinalGateRoundId === "string") plan.activeFinalGateRoundId = o.activeFinalGateRoundId;
  if (typeof o.schemaVersion === "number" && Number.isFinite(o.schemaVersion)) {
    plan.schemaVersion = Math.floor(o.schemaVersion);
  }
  const finalGate = reviveFinalGate(o.finalGate);
  if (finalGate) plan.finalGate = finalGate;
  const steeringLog = reviveSteeringLog(o.steeringLog);
  if (steeringLog === "invalid") return null;
  if (steeringLog !== undefined) plan.steeringLog = steeringLog;
  return plan;
}

/** Why a read failed. `null` on the diagnostic means the plan loaded. */











/**
 * Read a goalplan and say why when it fails.
 *
 * The bare `catch { return null }` made every failure - absent file, bad JSON, a
 * `steeringLog` the reviver rejected - surface identically as "no plan found at
 * slug X", so a malformed plan was indistinguishable from no plan at all
 * (issue #29). Never throws: the diagnostic is the error channel.
 */
export function readGoalplanDetailed(cwd        , slug        )                     {
  let path        ;
  let raw        ;
  try {
    path = goalplanPath(cwd, slug);
  } catch (err) {
    // A rejected slug (traversal, symlinked state root) has no legal path to name.
    return {
      plan: null,
      diagnostic: { kind: "unreadable", path: slug, detail: err instanceof Error ? err.message : String(err) },
    };
  }
  try {
    assertNotSymlink(path);
    raw = readFileSync(path, "utf8");
  } catch (err) {
    const e = err                         ;
    const detail = e?.message ?? String(err);
    if (e?.code === "ENOENT") return { plan: null, diagnostic: { kind: "absent", path } };
    return { plan: null, diagnostic: { kind: "unreadable", path, detail } };
  }
  let parsed         ;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      plan: null,
      diagnostic: { kind: "invalid-json", path, detail: err instanceof Error ? err.message : String(err) },
    };
  }
  const plan = reviveGoalplan(parsed, validateGoalplanSlug(slug));
  if (!plan) {
    const field = firstInvalidField(parsed);
    return {
      plan: null,
      diagnostic: {
        kind: "invalid-shape",
        path,
        field,
        detail: `the goalplan parsed as JSON but field '${field}' did not satisfy the schema`,
      },
    };
  }
  return { plan, diagnostic: null };
}

/** Back-compat wrapper: every existing caller keeps its null-on-failure contract. */
export function readGoalplan(cwd        , slug        )                  {
  return readGoalplanDetailed(cwd, slug).plan;
}

/**
 * Name the first field the reviver would have rejected. Mirrors reviveGoalplan's
 * required set in declaration order; `"(unknown)"` when the object looks structurally
 * fine and the rejection came from a nested reviver such as steeringLog.
 */











function sleepGoalplanLock(ms        )       {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function goalplanWriteLockDir(cwd        , slug        )         {
  return resolve(goalplanDir(cwd, slug), GOALPLAN_LOCK_DIR);
}







export function goalplanWriteLockStatus(
  cwd        ,
  slug        ,
  nowMs         = Date.now(),
  stat                                        = statSync,
)                          {
  const path = goalplanWriteLockDir(cwd, slug);
  if (!existsSync(path)) return { path, exists: false, ageMs: null };
  try {
    const ageMs = Math.max(0, nowMs - stat(path).mtimeMs);
    return { path, exists: true, ageMs };
  } catch (err) {
    if ((err                         )?.code === "ENOENT") {
      return { path, exists: false, ageMs: null };
    }
    throw err;
  }
}

function readGoalplanLockOwnerText(dir        )         {
  try {
    return readFileSync(join(dir, GOALPLAN_LOCK_OWNER_FILE), "utf8").trim() || "(empty owner.json)";
  } catch {
    return "(owner.json unavailable)";
  }
}

export function withGoalplanWriteLock   (
  cwd        ,
  slug        ,
  fn                       ,
  options                           = {},
)                             {
  validateGoalplanSlug(slug);
  const dir = goalplanWriteLockDir(cwd, slug);
  const delays = options.retryDelaysMs ?? GOALPLAN_LOCK_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? sleepGoalplanLock;
  const ownerPath = join(dir, GOALPLAN_LOCK_OWNER_FILE);

  if (!existsSync(goalplanPath(cwd, slug))) {
    return { kind: "unreadable", reason: `goalplan '${slug}' does not exist` };
  }
  for (let attempt = 0; ; attempt += 1) {
    try {
      mkdirSync(dir, { recursive: false });
      break;
    } catch (err) {
      if ((err                         )?.code !== "EEXIST") throw err;
      if (attempt >= delays.length) {
        const owner = readGoalplanLockOwnerText(dir);
        return {
          kind: "locked",
          reason:
            `goalplan '${slug}' is busy. Lock directory: ${dir}. owner=${owner}. `
            + `Inspect ${ownerPath}. After verifying no writer is active, remove that lock directory `
            + `with a tool for this platform.`,
        };
      }
      sleep(delays[attempt]);
    }
  }

  try {
    try {
      writeFileSync(
        ownerPath,
        `${JSON.stringify({ pid: process.pid, acquiredAt: (options.now ?? (() => new Date().toISOString()))() })}\n`,
        { mode: 0o600 },
      );
    } catch {
      // Diagnostic only. The directory itself is the lock.
    }

    const read = readGoalplanDetailed(cwd, slug);
    if (!read.plan) {
      // The `absent` variant of GoalplanReadDiagnostic carries no `detail`, so the field
      // is read only where the union actually has it. An unconditional access compiles
      // away under type stripping and reads `undefined` at runtime, which would swallow
      // the real reason behind the generic fallback.
      const diagnostic = read.diagnostic;
      const detail = diagnostic && diagnostic.kind !== "absent" ? diagnostic.detail : null;
      return {
        kind: "unreadable",
        reason: detail ?? `goalplan '${slug}' could not be read`,
      };
    }
    return { kind: "ok", value: fn(read.plan) };
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // The next acquire reports the leftover path for platform-appropriate cleanup.
    }
  }
}

function firstInvalidField(parsed         )         {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return "(root: not an object)";
  const o = parsed                           ;
  if (typeof o.objective !== "string") return "objective";
  if (typeof o.slug !== "string") return "slug";
  if (declaredSchemaVersion(o) > SUPPORTED_MAX_SCHEMA_VERSION) return "schemaVersion";
  if (!Array.isArray(o.workPhases)) return "workPhases";
  if (o.workPhases.some((w) => {
    if (typeof w !== "object" || w === null) return true;
    const wp = w                           ;
    return typeof wp.id !== "string" || typeof wp.title !== "string";
  })) {
    return "workPhases[] entries (each needs id/title)";
  }
  // Mirror the reviver's order: phase dependsOn first, then the tasks it would revive.
  for (const rawWp of o.workPhases) {
    const wp = rawWp                           ;
    if (reviveDependsOn(wp.dependsOn) === "invalid") return "workPhases[].dependsOn";
    for (const rawTask of Array.isArray(wp.tasks) ? wp.tasks : []) {
      if (typeof rawTask !== "object" || rawTask === null) continue;
      const task = rawTask                           ;
      if (typeof task.id !== "string" || typeof task.title !== "string") continue;
      if (reviveDependsOn(task.dependsOn) === "invalid") {
        return "workPhases[].tasks[].dependsOn";
      }
    }
  }
  if (!Array.isArray(o.criteria)) return "criteria";
  if (Array.isArray(o.criteria) && o.criteria.some((c) => typeof c !== "object" || c === null || typeof (c                           ).scenario !== "string")) {
    // Issue #29: hand-authored {bogus: true} criteria used to read as "(unknown)".
    return "criteria[] entries (each needs scenario/expectedEvidence/status)";
  }
  if (typeof o.host !== "object" || o.host === null || typeof (o.host                           ).armed !== "boolean") {
    return "host (needs armed/armedAt/source)";
  }
  if (o.steeringLog !== undefined && !Array.isArray(o.steeringLog)) return "steeringLog";
  return "(unknown)";
}

/**
 * Low-level atomic publication (tmp + rename), refreshing updatedAt.
 * A new-plan create path may call this directly. A mutation of an existing plan
 * MUST call it inside withGoalplanWriteLock().
 */
export function writeGoalplan(cwd        , plan          )       {
  validateGoalplanSlug(plan.slug);
  const dir = goalplanDir(cwd, plan.slug);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  // Recheck after creation to close the ordinary pre-existing symlink case.
  goalplanDir(cwd, plan.slug);
  const finalPath = goalplanPath(cwd, plan.slug);
  const tmp = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  const normalized           = { ...plan, updatedAt: new Date().toISOString() };
  try {
    writeFileSync(tmp, JSON.stringify(normalized, null, 2), { mode: 0o600 });
    renameWithRetry(tmp, finalPath);
  } catch (err) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      // best-effort cleanup of orphan tmp; ignore
    }
    throw err;
  }
}

/** Append a goalplan ledger event (append-only, mkdir -p). */
export function appendGoalplanLedger(cwd        , slug        , entry                     )       {
  validateGoalplanSlug(slug);
  if (entry.slug !== slug) throw new Error("goalplan ledger entry slug does not match target slug");
  const dir = goalplanDir(cwd, slug);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  goalplanDir(cwd, slug);
  const path = goalplanLedgerPath(cwd, slug);
  assertNotSymlink(path);
  const noFollow = typeof fsConstants.O_NOFOLLOW === "number" ? fsConstants.O_NOFOLLOW : 0;
  const fd = openSync(
    path,
    fsConstants.O_APPEND | fsConstants.O_CREAT | fsConstants.O_WRONLY | noFollow,
    0o600,
  );
  try {
    writeSync(fd, `${JSON.stringify(entry)}\n`);
  } finally {
    closeSync(fd);
  }
}









/** Build a fresh goalplan (no IO). Slug is derived from the objective. */
export function buildGoalplan(input                  )           {
  const now = input.now ?? (() => new Date().toISOString());
  const ts = now();
  const criteria                      = (input.criteria ?? []).map((c, i) => ({
    id: `c-${i + 1}`,
    scenario: c.scenario,
    // schemaVersion 2 refuses an unclassified criterion. Defaulting to "logic"
    // is what makes init-time criteria constructible under v2 at all.
    surface: c.surface ?? "logic",
    expectedEvidence: c.expectedEvidence ?? "",
    capturedEvidence: null,
    status: "open",
  }));
  return {
    objective: input.objective,
    slug: deriveSlug(input.objective),
    schemaVersion: SUPPORTED_MAX_SCHEMA_VERSION,
    createdAt: ts,
    updatedAt: ts,
    activeWorkPhaseId: null,
    workPhases: [],
    criteria,
    host: {
      armed: input.host?.armed === true,
      armedAt: input.host?.armedAt ?? null,
      source: input.host?.source === "freeze" ? "freeze" : "none",
    },
  };
}

// --- derived helpers (consumed by 040 work-aware Stop + the validate gate) ---

/** Work phases that are not yet done, in declared order. */
export function remainingWorkPhases(plan          )                      {
  // `superseded` drops out: another phase covers that work, so it cannot hold the
  // goal open. `blocked` stays in — being stuck is not being finished.
  return plan.workPhases.filter((wp) => wp.status !== "done" && wp.status !== "superseded");
}

// --- dependency-aware selection (wp4) ---
//
// Readiness is derived, never stored: these helpers read the status of each direct
// dependency and nothing else. They do not mutate a phase or task, do not append to
// the ledger, and do not decide when the next turn happens - the host continuation
// driver owns that. A missing dependency target reads as not-done, so a hand-edited
// plan that slipped past validation cannot be mistaken for runnable.
function workPhaseDependenciesMet(plan          , phase                   )          {
  return (phase.dependsOn ?? []).every(
    (dependencyId) => plan.workPhases.find((candidate) => candidate.id === dependencyId)?.status === "done",
  );
}

function taskDependenciesMet(phase                   , task              )          {
  return (task.dependsOn ?? []).every(
    (dependencyId) => phase.tasks.find((candidate) => candidate.id === dependencyId)?.status === "done",
  );
}

function isRunnablePhase(plan          , wp                   )          {
  return (
    (wp.status === "pending" || wp.status === "in_progress")
    && workPhaseDependenciesMet(plan, wp)
  );
}

/** The first runnable pending task in declared order, or null when none remain. */
export function nextOpenTask(plan          )                                                       {
  for (const wp of plan.workPhases) {
    if (!isRunnablePhase(plan, wp)) continue;
    for (const task of wp.tasks) {
      if (task.status === "pending" && taskDependenciesMet(wp, task)) return { wp, task };
    }
  }
  return null;
}





function describePhaseDependency(plan          , dependencyId        )         {
  const dependency = plan.workPhases.find((wp) => wp.id === dependencyId);
  return `work-phase ${dependencyId} (${dependency?.status ?? "missing"})`;
}

function describeTaskDependency(phase                   , dependencyId        )         {
  const dependency = phase.tasks.find((task) => task.id === dependencyId);
  return `task ${phase.id}/${dependencyId} (${dependency?.status ?? "missing"})`;
}

function dependencyWaitReason(subject        , dependencies                   )         {
  return `${subject} waits for ${dependencies.join(", ")}`;
}

function unmetPhaseDependencyIds(plan          , phase                   )           {
  // wp3와 같은 규칙: 중복 참조는 첫 등장 순서로 줄인다. 그러지 않으면
  // dependsOn: ["a", "a"]가 대기 문장 안에 같은 blocker를 두 번 넣는다.
  return [...new Set(phase.dependsOn ?? [])].filter(
    (dependencyId) => plan.workPhases.find((candidate) => candidate.id === dependencyId)?.status !== "done",
  );
}

function unmetTaskDependencyIds(phase                   , task              )           {
  return [...new Set(task.dependsOn ?? [])].filter(
    (dependencyId) => phase.tasks.find((candidate) => candidate.id === dependencyId)?.status !== "done",
  );
}

/**
 * Direct unmet-dependency reasons, independent of whether other work is ready.
 * This is derived data and never mutates the plan or appends a ledger row.
 */
export function dependencyWaitReasons(plan          )           {
  const reasons           = [];
  for (const wp of remainingWorkPhases(plan)) {
    const unmetPhaseDependencies = unmetPhaseDependencyIds(plan, wp);
    if (unmetPhaseDependencies.length > 0) {
      reasons.push(dependencyWaitReason(
        `work-phase ${wp.id}`,
        unmetPhaseDependencies.map((id) => describePhaseDependency(plan, id)),
      ));
    }
    if (wp.status !== "pending" && wp.status !== "in_progress") continue;
    for (const task of wp.tasks.filter((candidate) => candidate.status === "pending")) {
      const unmetTaskDependencies = unmetTaskDependencyIds(wp, task);
      if (unmetTaskDependencies.length > 0) {
        reasons.push(dependencyWaitReason(
          `task ${wp.id}/${task.id}`,
          unmetTaskDependencies.map((id) => describeTaskDependency(wp, id)),
        ));
      }
    }
  }
  return reasons;
}

/**
 * Derived runtime diagnosis only. It never mutates a phase/task and is never
 * appended to the historical ledger by itself.
 */
export function dependencyDeadlock(plan          )                            {
  const unfinished = remainingWorkPhases(plan);
  if (unfinished.length === 0) return null;

  const runnablePhases = plan.workPhases.filter((wp) => isRunnablePhase(plan, wp));
  const hasRunnableTask = runnablePhases.some((wp) =>
    wp.tasks.some((task) => task.status === "pending" && taskDependenciesMet(wp, task))
  );
  const hasClosablePhase = runnablePhases.some((wp) =>
    wp.tasks.every((task) => task.status === "done")
  );
  if (hasRunnableTask || hasClosablePhase) return null;

  const reasons           = [];
  for (const wp of unfinished) {
    if (wp.status === "blocked") {
      reasons.push(
        `work-phase ${wp.id} is blocked${wp.blockedReason ? ` (${wp.blockedReason})` : ""}`,
      );
      continue;
    }
    const unmetPhaseDependencies = unmetPhaseDependencyIds(plan, wp);
    if (unmetPhaseDependencies.length > 0) {
      reasons.push(dependencyWaitReason(
        `work-phase ${wp.id}`,
        unmetPhaseDependencies.map((id) => describePhaseDependency(plan, id)),
      ));
      continue;
    }
    for (const task of wp.tasks.filter((candidate) => candidate.status === "pending")) {
      const unmetTaskDependencies = unmetTaskDependencyIds(wp, task);
      if (unmetTaskDependencies.length > 0) {
        reasons.push(dependencyWaitReason(
          `task ${wp.id}/${task.id}`,
          unmetTaskDependencies.map((id) => describeTaskDependency(wp, id)),
        ));
      }
    }
  }
  return reasons.length > 0 ? { reasons } : null;
}

/** Criteria still open. */
export function unmetCriteria(plan          )                      {
  return plan.criteria.filter((c) => c.status === "open");
}

/**
 * Work phases marked `done` while still holding open tasks (CYCLE-COMPLETION-01).
 *
 * `advanceWorkPhase()` can no longer produce this shape, but plans closed before
 * 030 can still carry it, and a goalplan is a hand-editable file. Completion is
 * the right place to catch it: refusing to certify is honest, while rewriting
 * someone's plan on read is not.
 */
export function doneWorkPhasesWithPendingTasks(plan          )                      {
  return plan.workPhases.filter(
    (wp) => wp.status === "done" && wp.tasks.some((t) => t.status !== "done"),
  );
}

/**
 * Complete = no remaining work phases, no unmet criteria, and no `done` phase
 * hiding open tasks. The third clause keeps `loop show` honest: without it the
 * summary printed complete=true for a plan `loop validate` refuses.
 */
export function isGoalplanComplete(plan          )          {
  return (
    remainingWorkPhases(plan).length === 0
    && unmetCriteria(plan).length === 0
    && doneWorkPhasesWithPendingTasks(plan).length === 0
  );
}

// --- dependency integrity (wp3): pure read-only validation, no writes ---
//
// Two boundaries, deliberately separate. reviveDependsOn() above is the STRUCTURAL
// boundary: a non-array, a non-string element, or a blank id fails the whole plan
// closed before it ever becomes a Goalplan. These two functions are the SEMANTIC
// boundary: given a well-formed string[], they judge what it refers to. Neither
// writes goalplan.json or either ledger — a rejection leaves every byte in place.





function duplicateIds(ids                   )           {
  const seen = new Set        ();
  const duplicates = new Set        ();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    else seen.add(id);
  }
  return [...duplicates].sort();
}

function findDependencyCycle(nodes                           )                  {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set        ();
  const visiting = new Map                ();
  const stack           = [];
  const visit = (id        )                  => {
    const seenAt = visiting.get(id);
    if (seenAt !== undefined) return [...stack.slice(seenAt), id];
    if (visited.has(id)) return null;
    visiting.set(id, stack.length);
    stack.push(id);
    for (const dependencyId of [...(byId.get(id)?.dependsOn ?? [])].sort()) {
      if (!byId.has(dependencyId)) continue;
      const cycle = visit(dependencyId);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  };
  for (const id of [...byId.keys()].sort()) {
    const cycle = visit(id);
    if (cycle) return cycle;
  }
  return null;
}

export function goalplanDefinitionIntegrityReasons(plan          )           {
  const reasons           = [];
  const phaseIds = new Set(plan.workPhases.map((phase) => phase.id));
  for (const id of duplicateIds(plan.workPhases.map((phase) => phase.id))) {
    reasons.push(`duplicate work phase id '${id}' makes dependency references ambiguous`);
  }
  for (const phase of plan.workPhases) {
    // 감사 라운드 1 BLOCKER 1: 같은 참조를 여러 번 쓴 dependsOn이 같은 사유를 반복하면
    // goal-gate의 slice(0, 4)가 한 문장으로 네 칸을 채워 다른 진단을 가린다. wp2 reviver는
    // 중복 원소를 거부하지 않으므로(goalplan.ts:466-475) 여기서 첫 등장 순서를 지켜 줄인다.
    for (const dependencyId of new Set(phase.dependsOn ?? [])) {
      if (dependencyId === phase.id) reasons.push(`work phase ${phase.id} depends on itself`);
      else if (!phaseIds.has(dependencyId)) {
        reasons.push(`work phase ${phase.id} depends on unknown work phase '${dependencyId}'`);
      }
    }

    const taskIds = new Set(phase.tasks.map((task) => task.id));
    for (const id of duplicateIds(phase.tasks.map((task) => task.id))) {
      reasons.push(`work phase ${phase.id} has duplicate task id '${id}', so task dependency references are ambiguous`);
    }
    for (const task of phase.tasks) {
      for (const dependencyId of new Set(task.dependsOn ?? [])) {
        if (dependencyId === task.id) reasons.push(`task ${phase.id}/${task.id} depends on itself`);
        else if (!taskIds.has(dependencyId)) {
          reasons.push(`task ${phase.id}/${task.id} depends on unknown task '${dependencyId}' in the same work phase`);
        }
      }
    }
    const taskCycle = findDependencyCycle(phase.tasks.map((task) => ({
      id: task.id,
      dependsOn: (task.dependsOn ?? []).filter((dependencyId) => dependencyId !== task.id),
    })));
    if (taskCycle) {
      reasons.push(`task dependency cycle in work phase ${phase.id}: ${taskCycle.join(" -> ")}`);
    }

    if ((plan.schemaVersion ?? 1) >= 3) {
      for (const task of phase.tasks) {
        if (task.status === "done" && (task.outcome ?? "").trim().length === 0) {
          reasons.push(`task ${phase.id}/${task.id} is done but has no non-empty outcome`);
        }
        if (task.status === "pending" && task.outcome !== undefined) {
          reasons.push(`task ${phase.id}/${task.id} is pending but has outcome`);
        }
      }
    }
  }

  const phaseCycle = findDependencyCycle(plan.workPhases.map((phase) => ({
    id: phase.id,
    dependsOn: (phase.dependsOn ?? []).filter((dependencyId) => dependencyId !== phase.id),
  })));
  if (phaseCycle) reasons.push(`work phase dependency cycle: ${phaseCycle.join(" -> ")}`);

  const criterionIds = new Set(plan.criteria.map((criterion) => criterion.id));
  for (const id of duplicateIds(plan.criteria.map((criterion) => criterion.id))) {
    reasons.push(`duplicate criterion id '${id}' makes criteriaIds references ambiguous`);
  }
  for (const phase of plan.workPhases) {
    for (const criterionId of phase.criteriaIds) {
      if (!criterionIds.has(criterionId)) {
        reasons.push(`work phase ${phase.id} references unknown criterion '${criterionId}'`);
      }
    }
  }
  return reasons;
}

export function goalplanDependencyCompletionReasons(plan          )           {
  const reasons           = [];
  const phasesById = new Map(plan.workPhases.map((phase) => [phase.id, phase]));
  for (const phase of plan.workPhases) {
    if (phase.status === "done") {
      // 중복 참조는 한 사유 안의 목록에도 한 번만 나온다(감사 라운드 1 BLOCKER 1).
      const open = [...new Set(phase.dependsOn ?? [])].filter(
        (dependencyId) => phasesById.get(dependencyId)?.status !== "done",
      );
      if (open.length > 0) {
        reasons.push(`work phase ${phase.id} is done while dependency work phase(s) are not done: ${open.join(", ")}`);
      }
    }
    const tasksById = new Map(phase.tasks.map((task) => [task.id, task]));
    for (const task of phase.tasks) {
      if (task.status !== "done") continue;
      const open = [...new Set(task.dependsOn ?? [])].filter(
        (dependencyId) => tasksById.get(dependencyId)?.status !== "done",
      );
      if (open.length > 0) {
        reasons.push(`task ${phase.id}/${task.id} is done while dependency task(s) are not done: ${open.join(", ")}`);
      }
    }
  }
  return reasons;
}






/**
 * Everything the v2 checks need that a pure function cannot reach: the current
 * tree state and the evidence receipts. Passed in rather than imported so the
 * validator stays testable and so its IO failures surface as reasons instead of
 * exceptions — an exception would land in goal-gate's outer catch, which fails
 * open on purpose for unexpected errors and would silently open the gate.
 */







/** Absent schemaVersion means 1; the marker can only raise the answer. */
export function effectiveSchemaVersion(plan          , markerPresent         )         {
  const declared = typeof plan.schemaVersion === "number" ? plan.schemaVersion : 1;
  return markerPresent ? Math.max(declared, 2) : declared;
}

/** True when any criterion in the WHOLE plan exercises a visual surface. */
export function computeQaRequired(plan          )          {
  return plan.criteria.some((c) => c.surface === "web" || c.surface === "tui");
}

/**
 * Quality gate (E8): validates a goalplan for goal completion (called by
 * GOAL-COMPLETE-GATE-01 in goal-gate.ts, NOT during D-close).
 *
 * GOAL-COMPLETE-GATE-01 (260709): an EMPTY plan (no work phases AND no criteria) FAILS.
 * `isGoalplanComplete` is vacuously true for `loop init`-only artifacts, which let the
 * 019f4456 session's unregistered plan pass the gate. A plan that never recorded what
 * "done" means cannot certify completion — register workPhases[]/criteria[] first.
 */
export function validateGoalplan(plan          , ctx                        )                     {
  const reasons           = [];
  // Refuse before any other check: a plan this binary cannot fully represent must
  // not be judged complete on a partial reading of it.
  if (typeof plan.schemaVersion === "number" && plan.schemaVersion > SUPPORTED_MAX_SCHEMA_VERSION) {
    return {
      ok: false,
      reasons: [
        `schemaVersion ${plan.schemaVersion} is newer than this build supports (max ${SUPPORTED_MAX_SCHEMA_VERSION}) - upgrade codexclaw before validating this plan`,
      ],
    };
  }
  // Structure before progress: a plan whose references are broken cannot be judged
  // on its completion state, and goal-gate shows only the first four reasons
  // (goal-gate.ts slice(0, 4)) - so the repairable ones come first.
  reasons.push(
    ...goalplanDefinitionIntegrityReasons(plan),
    ...goalplanDependencyCompletionReasons(plan),
  );
  if (plan.workPhases.length === 0 && plan.criteria.length === 0) {
    reasons.push(
      "plan is empty: no workPhases[] and no criteria[] registered — fill the goalplan (schema in $cxc-loop) before the E8 gate can certify completion",
    );
  }
  for (const c of plan.criteria) {
    if (c.status === "met" && (c.capturedEvidence ?? "").trim().length === 0) {
      reasons.push(`criterion ${c.id} marked met but has no captured evidence`);
    }
  }
  const remaining = remainingWorkPhases(plan);
  if (remaining.length > 0) {
    reasons.push(`${remaining.length} work phase(s) not done: ${remaining.map((w) => w.id).join(", ")}`);
  }
  // CYCLE-COMPLETION-01: a phase closed over open tasks cannot certify completion.
  for (const wp of doneWorkPhasesWithPendingTasks(plan)) {
    const open = wp.tasks.filter((t) => t.status !== "done").map((t) => t.id).join(", ");
    reasons.push(`work phase ${wp.id} is marked done but still has open task(s): ${open}`);
  }
  const unmet = unmetCriteria(plan);
  if (unmet.length > 0) {
    reasons.push(`${unmet.length} unmet criterion/criteria: ${unmet.map((c) => c.id).join(", ")}`);
  }
  reasons.push(...supersededIntegrityReasons(plan));
  reasons.push(...finalGateReasons(plan, ctx));
  return { ok: reasons.length === 0, reasons };
}

/**
 * A `superseded` phase leaves the remaining-work count, so a plan file that
 * simply says "superseded" would shrink its own completion bar. Editing
 * goalplan.json by hand is documented as normal workflow, so this is not an
 * exotic attack — it is the ordinary path.
 *
 * Four checks, all structural. Whether the replacement genuinely covers the work
 * is a judgment no validator can make; that part rides on the rationale and the
 * ledger. Cycles need no separate walk: any cycle contains a phase whose
 * replacement is itself superseded, which the third check already rejects.
 */
function supersededIntegrityReasons(plan          )           {
  const out           = [];
  for (const wp of plan.workPhases) {
    if (wp.status !== "superseded") continue;
    const by = wp.supersededBy;
    if (typeof by !== "string" || by.trim().length === 0) {
      out.push(`work phase ${wp.id} is superseded but does not name what replaced it (supersededBy)`);
      continue;
    }
    if (by === wp.id) {
      out.push(`work phase ${wp.id} claims to supersede itself, which would drop it from the remaining work for free`);
      continue;
    }
    const target = plan.workPhases.find((other) => other.id === by);
    if (!target) {
      out.push(`work phase ${wp.id} is superseded by '${by}', which is not in this plan`);
      continue;
    }
    if (target.status === "superseded") {
      out.push(`work phase ${wp.id} is superseded by '${by}', which is itself superseded — the work would vanish`);
    }
  }
  return out;
}

/** Marker path: promotion to v2 is recorded outside the plan file as well. */
export function schemaMarkerPath(cwd        , slug        )         {
  return join(goalplanDir(cwd, slug), "schema-v2.marker");
}

/**
 * The v2 final-gate checks.
 *
 * Editing goalplan.json by hand is a normal workflow, so keying "is this v2" on
 * a number inside that same file would make deleting the number a bypass. The
 * marker file lives beside the plan and can only raise the effective version;
 * deleting the marker is still possible and is documented as such rather than
 * claimed impossible.
 */
function finalGateReasons(plan          , ctx                        )           {
  const markerPresent = ctx ? existsSync(schemaMarkerPath(ctx.cwd, plan.slug)) : false;
  const version = effectiveSchemaVersion(plan, markerPresent);
  if (version < 2) return [];

  if (!ctx) {
    return [
      "this plan is schemaVersion >= 2 but validateGoalplan was called without a validation context, so the final gate could not be checked — this is a refusal, not a pass",
    ];
  }
  if (markerPresent && (plan.schemaVersion ?? 1) < 2) {
    return [
      `this plan was promoted to schemaVersion 2 (${schemaMarkerPath(ctx.cwd, plan.slug)} exists) but the plan file declares ${plan.schemaVersion ?? "none"} — restore "schemaVersion": 2 instead of downgrading`,
    ];
  }

  const out           = [];
  for (const c of plan.criteria) {
    if (c.surface === undefined) {
      out.push(`criterion ${c.id} has no valid surface ("logic" | "web" | "tui") — schemaVersion 2 requires it, since an unclassified criterion would silently escape the QA requirement`);
    }
  }
  const gate = plan.finalGate;
  if (!gate) {
    // No `final-gate` verb exists in goalplan-cli.ts or cli.ts (issue #29). Naming a
    // command the user cannot run is worse than naming none, so this points at the
    // review-round surface that actually produces a gate.
    out.push(
      "schemaVersion 2 requires a finalGate - open a final-gate review round with " +
        "`cxc review-round open --lane final_gate --session <id>` and record its verdict",
    );
    return out;
  }
  if (gate.status !== "approved") {
    out.push(`final gate is ${gate.status}, not approved — close the gate before completing the goal`);
  }
  if (gate.verdict === "fail") out.push("final gate verdict is fail");

  const expectedQa = computeQaRequired(plan);
  if (expectedQa !== gate.qaRequired) {
    out.push(
      `final gate recorded qaRequired=${gate.qaRequired} but the plan now scans as ${expectedQa} — criteria changed after the gate opened, so re-open it`,
    );
  }

  out.push(...roundReasons(plan, gate));
  out.push(...identityReasons(plan, gate, ctx));
  return out;
}

function roundReasons(plan          , gate                )           {
  if (!gate.reviewRoundId) return ["final gate has no reviewRoundId — an approval must name the round that produced it"];
  const round = (plan.reviewRounds ?? []).find((r) => r.roundId === gate.reviewRoundId);
  if (!round) return [`final gate names review round ${gate.reviewRoundId}, which is not in the plan`];
  const out           = [];
  if (round.purpose !== "final_gate") {
    out.push(`review round ${round.roundId} has purpose "${round.purpose}" — a plan audit cannot stand in for the final code gate`);
  }
  if (round.status !== "approved") {
    out.push(`review round ${round.roundId} is ${round.status}, not approved`);
  }
  if (round.lane.verdict === undefined) {
    out.push(`review round ${round.roundId} recorded no verdict`);
  } else if (round.lane.verdict !== gate.verdict) {
    out.push(`review round ${round.roundId} says "${round.lane.verdict}" but the final gate says "${gate.verdict}"`);
  }
  return out;
}

/**
 * Every identity in play must describe the same tree: the tree right now, the
 * one the gate recorded, the one each receipt was produced against, and the one
 * the reviewer looked at.
 */
function identityReasons(plan          , gate                , ctx                       )           {
  const out           = [];
  let current                ;
  try {
    current = ctx.captureSourceIdentity(ctx.cwd);
  } catch (err) {
    return [`could not capture the current source identity: ${err instanceof Error ? err.message : String(err)}`];
  }
  if (!gate.sourceIdentity) {
    out.push("final gate has no sourceIdentity — an approval must record the tree it approved");
  }

  const named                                         = [["the final gate", gate.sourceIdentity]];
  const round = (plan.reviewRounds ?? []).find((r) => r.roundId === gate.reviewRoundId);
  if (round?.lane.sourceIdentity) named.push(["the reviewer", round.lane.sourceIdentity]);

  for (const [label, path, kind] of [
    ["the test receipt", gate.testReceiptPath, "test"],
    ...(gate.qaRequired ? [["the QA receipt", gate.qaReceiptPath, "qa"]         ] : []),
  ]                                                 ) {
    if (!path) {
      out.push(`${label} path is missing`);
      continue;
    }
    let receipt                                                        ;
    try {
      receipt = ctx.readReceipt(path, kind);
    } catch (err) {
      out.push(`${label} could not be read: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    if ("error" in receipt) {
      out.push(`${label} is not usable: ${receipt.error}`);
      continue;
    }
    named.push([label, receipt.sourceIdentity]);
  }

  for (const [label, identity] of named) {
    if (!identity) continue;
    const cmp = ctx.compareSource(identity, current);
    if (cmp.kind === "different") {
      out.push(`${label} describes a different source than the tree right now (${cmp.detail ?? "changed"}) — re-run the gate`);
    } else if (cmp.kind === "unavailable") {
      out.push(
        `${label} cannot be compared because git could not resolve the source identity — a schemaVersion 2 plan cannot be certified without git; use the v1 flow instead`,
      );
    }
  }
  return out;
}

/**
 * Outcome of a work-phase close attempt (CYCLE-COMPLETION-01, 030).
 *
 * `tasks_pending` is the gate this type exists for: a work-phase whose tasks are
 * still open cannot be closed, so five declared tasks need five closes rather
 * than one. Callers MUST treat it as a refusal and write nothing — the D-close
 * preflight runs before any state, ledger or goalplan write precisely so a
 * refusal leaves all three untouched.
 */







/**
 * Advance the goalplan's work-phase cursor: mark the current activeWorkPhaseId
 * as `done`, then set the next pending work-phase active.
 *
 * Refuses when the active work-phase still holds open tasks. Before 030 this
 * marked the phase `done` and left its pending tasks behind, and
 * `remainingWorkPhases()` only reads phase status — so one D-close could retire
 * a work-phase holding five unfinished units and the completion gate saw
 * nothing wrong. A survey of the 83 goalplans on disk found task status is
 * genuinely maintained (763 of 826 tasks done) and only 3 of 227 closed
 * work-phases carry a pending task, so the refusal lands on the defect rather
 * than on ordinary use.
 *
 * On refusal the input plan is returned untouched: closing a cycle never marks
 * tasks done on the agent's behalf.
 */



















/**
 * Close exactly `workPhaseId` and move the cursor the same way a normal advance
 * does: after-then-wrap over pending phases whose dependencies are met.
 *
 * 050 §40 Z1: D-close recovery used to fix up only the target's status, which left
 * activeWorkPhaseId pointing at a done phase and logged a false `started <target>`.
 * Normal close and recovery now share this one transformation, so the two cannot
 * disagree about the resulting plan.
 *
 * 050 §41 W1: the gates live HERE, not in the callers. An earlier draft checked only
 * that the target existed, so recovery — which calls this directly — skipped the
 * pending-task refusal and the blocked/superseded check that advanceWorkPhase() runs
 * first. That is reachable: the marker survives edits, and wp6 add-task can put a
 * pending task on a live phase between the crash and the retry.
 */
export function closeFixedWorkPhase(
  plan          ,
  workPhaseId        ,
  recordedNext                ,
)                   {
  const currentIdx = plan.workPhases.findIndex((wp) => wp.id === workPhaseId);
  if (currentIdx < 0) return { kind: "absent" };
  const current = plan.workPhases[currentIdx];

  // A blocked or superseded phase is never closable. advanceWorkPhase() never picks
  // one, so this only fires when a recovery target changed state after its marker.
  if (current.status !== "pending" && current.status !== "in_progress" && current.status !== "done") {
    return { kind: "not_runnable", status: current.status };
  }

  // §41 W5: runnable means dependencies met, not just a workable status. Checking
  // status alone let a target through whose dependency turned blocked after the
  // marker was written — advanceWorkPhase() answers no_active there, and recovery
  // must not answer ok.
  if (!workPhaseDependenciesMet(plan, current)) {
    return { kind: "dependencies_unmet", unmet: unmetPhaseDependencyIds(plan, current) };
  }

  // CYCLE-COMPLETION-01, unchanged wording and unchanged variant: an open task keeps
  // the phase open on both the normal path and a recovery retry.
  const pending = current.tasks.filter((task) => task.status !== "done");
  if (pending.length > 0) return { kind: "tasks_pending", workPhaseId, pending };

  const closedWorkPhases = plan.workPhases.map((wp) =>
    wp.id === workPhaseId ? { ...wp, status: "done"         , tasks: wp.tasks } : wp
  );
  const closedPlan           = { ...plan, activeWorkPhaseId: null, workPhases: closedWorkPhases };

  // §50: `recordedNext` has three meanings and they must stay separate. `undefined` is a
  // FIRST close with no decision yet, so wp4 after-then-wrap computes the successor.
  // `null` is an earlier attempt that found none, and a retry must not start a phase
  // that was added afterwards. A string is the phase that attempt chose, and it is
  // binding: if it cannot be used, this fails closed instead of quietly picking another
  // phase and logging `started` for work nobody scheduled.
  //
  // §48 explains why the plan file cannot decide this on its own: one byte pattern fits
  // both an attempt that already chose wp-2 and a plan where wp-2 was running all along.
  // Because the named phase is accepted at `pending` or `in_progress` alike, the status
  // normalization five earlier drafts fought over disappears entirely.
  let next                            ;
  if (recordedNext === undefined) {
    const after = closedWorkPhases.slice(currentIdx + 1).find(
      (wp) => wp.status === "pending" && workPhaseDependenciesMet(closedPlan, wp),
    );
    next = after ?? closedWorkPhases.slice(0, currentIdx).find(
      (wp) => wp.status === "pending" && workPhaseDependenciesMet(closedPlan, wp),
    );
  } else if (recordedNext === null) {
    next = undefined;
  } else {
    // §51: a marker naming the target as its own successor is corrupt — a close never
    // activates the phase it just finished. Without this guard the done-successor rule
    // below swallows it, and for an OPEN target it silently nulls the cursor.
    // §52: an empty id belongs here, not with the explicit null. readStateStrict() rejects
    // it too, and treating it as "no successor" would give a damaged marker the authority
    // of a real decision.
    if (recordedNext.length === 0 || recordedNext === workPhaseId) {
      return { kind: "successor_lost", successorId: recordedNext, reason: "corrupt" };
    }
    const named = closedWorkPhases.find((wp) => wp.id === recordedNext);
    if (!named) return { kind: "successor_lost", successorId: recordedNext, reason: "absent" };
    if (named.status === "done") {
      // §51: a finished successor is not a lost one. The recorded phase was started and
      // then closed by its own cycle, so this retry has nothing left to activate — and
      // refusing would trap the session: escaping would mean re-opening a completed
      // work-phase or discarding the marker. The settled-shape check below then answers
      // §52: do not compute a cursor from a finished successor. Setting `next` to nothing
      // made the settled shape claim `activeWorkPhaseId: null`, which erased a cursor the
      // plan had legitimately moved on to — wp-2 finishing can itself have started wp-3.
      //
      // §53: but only a target that is ALSO done makes this close settled. A marker can
      // survive with the target still open — crash before the plan commit, then the
      // successor finishes on its own — and answering already_done there wrote the close
      // rows while leaving the target open in the plan. Close it for real, with no
      // successor to activate because the recorded one is finished.
      // §54: closing the target must not undo progress the plan already made. The
      // successor finishing can itself have started wp-3, and nulling the cursor there
      // cut that off. Keep a cursor only when it names a DIFFERENT phase that is really
      // running — a cursor on the target, or on a pending phase, is not progress and
      // §45 established that such a cursor is forgeable.
      // §55: readiness belongs in the same predicate. A running phase whose dependencies
      // are unmet is a cursor effectiveActiveWorkPhaseId() already refuses to honour, so
      // keeping it would leave a stale explicit cursor the next cycle does not follow.
      // §56: this normalization runs whether or not the target is already done. An earlier
      // draft returned already_done immediately for a done target, which skipped the whole
      // check and let exactly the same damaged cursors through — including a cursor on the
      // done target itself. The settled-shape comparison below is what decides already_done,
      // and it can only do that against a normalized cursor.
      next = closedWorkPhases.find(
        (wp) => wp.id === plan.activeWorkPhaseId && wp.id !== workPhaseId
          && wp.status === "in_progress" && workPhaseDependenciesMet(closedPlan, wp),
      );
    } else if (named.status !== "pending" && named.status !== "in_progress") {
      return { kind: "successor_lost", successorId: recordedNext, reason: "not_runnable" };
    } else if (!workPhaseDependenciesMet(closedPlan, named)) {
      return { kind: "successor_lost", successorId: recordedNext, reason: "dependencies_unmet" };
    } else {
      next = named;
    }
  }

  const settledPlan           = {
    ...closedPlan,
    activeWorkPhaseId: next?.id ?? null,
    workPhases: closedWorkPhases.map((wp) =>
      next && wp.id === next.id ? { ...wp, status: "in_progress"          } : wp
    ),
  };

  // §45/§50: identity is the LAST step, not the whole judgement. Predicates over the
  // plan were forgeable four ways — a pending phase under the cursor, an in_progress
  // phase whose dependencies are unmet, an arbitrary phase that is not the real
  // successor, and a null cursor stranding an in_progress phase — so the settled shape
  // is computed first and compared. But identity alone is not enough either: the
  // expected shape is only meaningful because `recordedNext` fixed which successor this
  // close chose. Comparing against a shape derived from the file would just re-ask the
  // question the file cannot answer.
  if (samePlanShape(plan, settledPlan)) return { kind: "already_done" };

  return { kind: "ok", closedId: workPhaseId, plan: settledPlan };
}

/**
 * Structural equality over the fields a close writes: cursor plus every phase id,
 * status, dependsOn, and task status. Timestamps and prose are irrelevant here, so
 * comparing whole JSON would make the check brittle for no gain.
 */
/**
 * §53: what a resume should do when the fixed target is gone from the plan but the
 * marker still names a successor. Shared by the CLI and the chat path, because a
 * decision this subtle drifted between the two the moment it lived in one of them.
 *
 * The gates mirror closeFixedWorkPhase(): a phase that is blocked, superseded, or
 * waiting on a dependency was never started and cannot be started now, so the retry
 * fails closed rather than logging `started` for work nobody scheduled.
 */
/** §53: one wording source so the two surfaces cannot describe the same state differently. */
export function absentSuccessorDetail(
  reason                                                  ,
)         {
  return reason === "absent"
    ? "is gone too"
    : reason === "not_runnable"
      ? "can no longer be started"
      : "now waits for another work-phase";
}






export function resumeAbsentTarget(
  plan          ,
  recordedNext               ,
)                           {
  // A marker that recorded no successor has nothing to activate: the close it describes
  // ended the plan, so cleanup is the whole remaining job.
  if (!recordedNext) return { kind: "cleanup" };
  const named = plan.workPhases.find((wp) => wp.id === recordedNext);
  if (!named) return { kind: "successor_lost", successorId: recordedNext, reason: "absent" };
  // Finished on its own: the activation happened and only the ledger and state rows are
  // owed. The row guards make those idempotent.
  if (named.status === "done") return { kind: "cleanup" };
  if (named.status !== "pending" && named.status !== "in_progress") {
    return { kind: "successor_lost", successorId: recordedNext, reason: "not_runnable" };
  }
  // §55: readiness is checked before either branch below, so the absent-target path answers
  // the same question closeFixedWorkPhase() answers when the target is still there. Gating
  // only the pending branch made deletion of the target decide the verdict: the same
  // successor waiting on the same unmet dependency was refused with the target present and
  // activated with it gone. A dangling dependsOn reads as not-done here by design, and the
  // pending branch already refused that plan.
  if (!workPhaseDependenciesMet(plan, named)) {
    return { kind: "successor_lost", successorId: recordedNext, reason: "dependencies_unmet" };
  }
  // Running: the activation happened too, but only if the cursor agrees. §45 established
  // that a null or moved cursor stranding an in_progress phase is exactly the corruption
  // a resume must repair, so restore the cursor instead of walking away from it.
  if (named.status === "in_progress") {
    return plan.activeWorkPhaseId === named.id
      ? { kind: "cleanup" }
      : { kind: "activate", plan: { ...plan, activeWorkPhaseId: named.id } };
  }
  return {
    kind: "activate",
    plan: {
      ...plan,
      activeWorkPhaseId: named.id,
      workPhases: plan.workPhases.map((wp) =>
        wp.id === named.id ? { ...wp, status: "in_progress"          } : wp
      ),
    },
  };
}

function samePlanShape(left          , right          )          {
  if (left.activeWorkPhaseId !== right.activeWorkPhaseId) return false;
  if (left.workPhases.length !== right.workPhases.length) return false;
  return left.workPhases.every((wp, idx) => {
    const other = right.workPhases[idx];
    return wp.id === other.id
      && wp.status === other.status
      && (wp.dependsOn ?? []).join("\u0000") === (other.dependsOn ?? []).join("\u0000")
      && wp.tasks.length === other.tasks.length
      && wp.tasks.every((task, i) => task.id === other.tasks[i].id
        && task.status === other.tasks[i].status);
  });
}

export function advanceWorkPhase(plan          )                {
  // 260714 wp4 (implicit cursor): a null/stale cursor adopts the effective active
  // work-phase instead of no-opping, so the standard `loop init` flow (cursor seeded
  // null) still books work-phase closes.
  //
  // No explicit guard against blocked/superseded is needed: effectiveActiveWorkPhaseId
  // already skips them, so neither can be the phase this marks done. When every phase
  // is blocked or superseded there is no effective id and this returns null, which is
  // the right answer — there is nothing to close.
  const effectiveId = effectiveActiveWorkPhaseId(plan);
  if (!effectiveId) return { kind: "no_active" };
  const currentIdx = plan.workPhases.findIndex((wp) => wp.id === effectiveId);
  if (currentIdx < 0) return { kind: "no_active" };
  const current = plan.workPhases[currentIdx];

  // The pending-task refusal moves into the shared helper (050 §41 W1) and is forwarded
  // unchanged, so the CLI and chat wording stay identical.
  //
  // Closing the current phase succeeds even when nothing else can start: a verified
  // completion is not rolled back because a successor is blocked. The cursor goes null
  // and dependencyDeadlock() explains why on the next Stop or D-close.
  const closed = closeFixedWorkPhase(plan, current.id);
  if (closed.kind === "tasks_pending") {
    return { kind: "tasks_pending", workPhaseId: closed.workPhaseId, pending: closed.pending };
  }
  // absent, not_runnable, and dependencies_unmet all fold into the existing no_active
  // variant: the effective cursor never picks such a phase, so the normal path cannot
  // reach them and the return shape is unchanged. 050 §50 successor_lost cannot occur
  // here at all, because this call passes no recorded successor — it is a recovery-only
  // answer. The catch-all keeps the union exhaustive without inventing new wording.
  if (closed.kind !== "ok") return { kind: "no_active" };
  return { kind: "ok", closedId: closed.closedId, plan: closed.plan };
}

/**
 * 260714 wp4 (LOOP-UNIT-CHAIN-01 binding target): the work-phase this cycle is FOR.
 * Explicit cursor wins ONLY when it names a live, non-done work-phase (a stale ghost
 * or already-done cursor falls through); otherwise the first in_progress, then the
 * first pending work-phase. Null only when no open work-phase exists — so a bound,
 * registered goalplan always yields a binding target and "bound but cursorless"
 * cannot dodge the workPhaseId gate.
 */
export function effectiveActiveWorkPhaseId(plan          )                {
  if (plan.activeWorkPhaseId) {
    const cur = plan.workPhases.find((wp) => wp.id === plan.activeWorkPhaseId);
    // A cursor left pointing at a blocked or superseded phase is stale in the same
    // way a done one is: the loop would otherwise keep cycling on a phase that
    // cannot advance. Fall through to the next workable phase instead.
    // wp4: a cursor pointing at a phase whose dependencies are unmet is stale for the
    // same reason, so isRunnablePhase() carries both conditions.
    if (cur && isRunnablePhase(plan, cur)) return cur.id;
  }
  const inProgress = plan.workPhases.find(
    (wp) => wp.status === "in_progress" && workPhaseDependenciesMet(plan, wp),
  );
  if (inProgress) return inProgress.id;
  const pending = plan.workPhases.find(
    (wp) => wp.status === "pending" && workPhaseDependenciesMet(plan, wp),
  );
  return pending?.id ?? null;
}
