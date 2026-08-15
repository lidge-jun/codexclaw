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
  writeFileSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";
import { STATE_DIR } from "./state.js";
import { deriveSlug } from "./freeze.js";


export const GOALPLANS_SUBDIR = "goalplans";
export const GOALPLAN_FILE = "goalplan.json";
export const GOALPLAN_LEDGER_FILE = "ledger.jsonl";



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
    out.push(round);
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
  if (!Array.isArray(o.workPhases) || !Array.isArray(o.criteria)) return null;

  const workPhases                      = [];
  for (const wp of o.workPhases             ) {
    if (typeof wp !== "object" || wp === null) return null;
    const w = wp                           ;
    if (typeof w.id !== "string" || typeof w.title !== "string") return null;
    const status                  =
      w.status === "in_progress" || w.status === "done" || w.status === "blocked" || w.status === "superseded"
        ? w.status
        : "pending";
    const tasks                 = [];
    for (const t of Array.isArray(w.tasks) ? (w.tasks             ) : []) {
      if (typeof t !== "object" || t === null) continue;
      const tt = t                           ;
      if (typeof tt.id !== "string" || typeof tt.title !== "string") continue;
      tasks.push({ id: tt.id, title: tt.title, status: tt.status === "done" ? "done" : "pending" });
    }
    const criteriaIds = Array.isArray(w.criteriaIds)
      ? (w.criteriaIds             ).filter((x)              => typeof x === "string")
      : [];
    const phase                    = { id: w.id, title: w.title, status, tasks, criteriaIds };
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

/** Read a goalplan; returns null on absent/unreadable/malformed (never throws). */
export function readGoalplan(cwd        , slug        )                  {
  try {
    const path = goalplanPath(cwd, slug);
    assertNotSymlink(path);
    const raw = readFileSync(path, "utf8");
    return reviveGoalplan(JSON.parse(raw), validateGoalplanSlug(slug));
  } catch {
    return null;
  }
}

/** Write a goalplan atomically (tmp + rename), refreshing updatedAt. */
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
    renameSync(tmp, finalPath);
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
    expectedEvidence: c.expectedEvidence ?? "",
    capturedEvidence: null,
    status: "open",
  }));
  return {
    objective: input.objective,
    slug: deriveSlug(input.objective),
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

/** The next pending task in the first non-done work phase, or null when none remain. */
export function nextOpenTask(plan          )                                                       {
  for (const wp of plan.workPhases) {
    // A blocked phase's tasks are not actionable and a superseded phase's tasks
    // belong to its replacement, so neither can be "the next thing to do".
    if (wp.status === "done" || wp.status === "blocked" || wp.status === "superseded") continue;
    for (const task of wp.tasks) {
      if (task.status !== "done") return { wp, task };
    }
  }
  return null;
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
    out.push('schemaVersion 2 requires a finalGate — open one with `cxc loop final-gate open`');
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

  // CYCLE-COMPLETION-01: refuse before any derivation, and leave `plan` alone.
  const pending = current.tasks.filter((t) => t.status !== "done");
  if (pending.length > 0) {
    return { kind: "tasks_pending", workPhaseId: current.id, pending };
  }

  // Search after current index first (declared order), then wrap.
  const after = plan.workPhases.slice(currentIdx + 1).find((wp) => wp.status === "pending");
  const next = after ?? plan.workPhases.slice(0, currentIdx).find((wp) => wp.status === "pending");
  return {
    kind: "ok",
    closedId: current.id,
    plan: {
      ...plan,
      activeWorkPhaseId: next?.id ?? null,
      workPhases: plan.workPhases.map((wp) => {
        if (wp.id === current.id) {
          return {
            ...wp,
            status: "done"         ,
            tasks: wp.tasks,
          };
        }
        if (next && wp.id === next.id) return { ...wp, status: "in_progress"          };
        return wp;
      }),
    },
  };
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
    if (cur && cur.status !== "done" && cur.status !== "blocked" && cur.status !== "superseded") return cur.id;
  }
  const inProgress = plan.workPhases.find((wp) => wp.status === "in_progress");
  if (inProgress) return inProgress.id;
  const pending = plan.workPhases.find((wp) => wp.status === "pending");
  return pending?.id ?? null;
}
