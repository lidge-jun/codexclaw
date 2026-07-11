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
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { STATE_DIR } from "./state.js";
import { deriveSlug } from "./freeze.js";

export const GOALPLANS_SUBDIR = "goalplans";
export const GOALPLAN_FILE = "goalplan.json";
export const GOALPLAN_LEDGER_FILE = "ledger.jsonl";





























































export function goalplanDir(cwd        , slug        )         {
  return join(cwd, STATE_DIR, GOALPLANS_SUBDIR, slug);
}

function goalplanPath(cwd        , slug        )         {
  return join(goalplanDir(cwd, slug), GOALPLAN_FILE);
}

function goalplanLedgerPath(cwd        , slug        )         {
  return join(goalplanDir(cwd, slug), GOALPLAN_LEDGER_FILE);
}

/** Best-effort structural validation; a malformed object reads as absent (null). */
function reviveGoalplan(parsed         )                  {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const o = parsed                           ;
  if (typeof o.objective !== "string" || typeof o.slug !== "string") return null;
  if (!Array.isArray(o.workPhases) || !Array.isArray(o.criteria)) return null;

  const workPhases                      = [];
  for (const wp of o.workPhases             ) {
    if (typeof wp !== "object" || wp === null) return null;
    const w = wp                           ;
    if (typeof w.id !== "string" || typeof w.title !== "string") return null;
    const status = w.status === "in_progress" || w.status === "done" ? w.status : "pending";
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
    workPhases.push({ id: w.id, title: w.title, status, tasks, criteriaIds });
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
    });
  }

  const hostRaw = (typeof o.host === "object" && o.host !== null ? o.host : {})                           ;
  const host                   = {
    armed: hostRaw.armed === true,
    armedAt: typeof hostRaw.armedAt === "string" ? hostRaw.armedAt : null,
    source: hostRaw.source === "freeze" ? "freeze" : "none",
  };

  return {
    objective: o.objective,
    slug: o.slug,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date(0).toISOString(),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString(),
    activeWorkPhaseId: typeof o.activeWorkPhaseId === "string" ? o.activeWorkPhaseId : null,
    workPhases,
    criteria,
    host,
  };
}

/** Read a goalplan; returns null on absent/unreadable/malformed (never throws). */
export function readGoalplan(cwd        , slug        )                  {
  try {
    const raw = readFileSync(goalplanPath(cwd, slug), "utf8");
    return reviveGoalplan(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Write a goalplan atomically (tmp + rename), refreshing updatedAt. */
export function writeGoalplan(cwd        , plan          )       {
  const dir = goalplanDir(cwd, plan.slug);
  mkdirSync(dir, { recursive: true });
  const finalPath = goalplanPath(cwd, plan.slug);
  const tmp = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  const normalized           = { ...plan, updatedAt: new Date().toISOString() };
  try {
    writeFileSync(tmp, JSON.stringify(normalized, null, 2));
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
  const dir = goalplanDir(cwd, slug);
  mkdirSync(dir, { recursive: true });
  appendFileSync(goalplanLedgerPath(cwd, slug), `${JSON.stringify(entry)}\n`);
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
  return plan.workPhases.filter((wp) => wp.status !== "done");
}

/** The next pending task in the first non-done work phase, or null when none remain. */
export function nextOpenTask(plan          )                                                       {
  for (const wp of plan.workPhases) {
    if (wp.status === "done") continue;
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

/** Complete = no remaining work phases AND no unmet criteria. */
export function isGoalplanComplete(plan          )          {
  return remainingWorkPhases(plan).length === 0 && unmetCriteria(plan).length === 0;
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
export function validateGoalplan(plan          )                     {
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
  const unmet = unmetCriteria(plan);
  if (unmet.length > 0) {
    reasons.push(`${unmet.length} unmet criterion/criteria: ${unmet.map((c) => c.id).join(", ")}`);
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Advance the goalplan's work-phase cursor: mark the current activeWorkPhaseId
 * as `done`, then set the next pending work-phase active.
 * Returns null only when there is no active phase to close.
 */
export function advanceWorkPhase(plan          )                  {
  if (!plan.activeWorkPhaseId) return null;
  const currentIdx = plan.workPhases.findIndex((wp) => wp.id === plan.activeWorkPhaseId);
  if (currentIdx < 0) return null;
  const current = plan.workPhases[currentIdx];

  // Search after current index first (declared order), then wrap.
  const after = plan.workPhases.slice(currentIdx + 1).find((wp) => wp.status === "pending");
  const next = after ?? plan.workPhases.slice(0, currentIdx).find((wp) => wp.status === "pending");
  return {
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
  };
}
