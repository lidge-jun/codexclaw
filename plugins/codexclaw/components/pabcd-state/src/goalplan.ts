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
import { STATE_DIR } from "./state.ts";
import { deriveSlug } from "./freeze.ts";

export const GOALPLANS_SUBDIR = "goalplans";
export const GOALPLAN_FILE = "goalplan.json";
export const GOALPLAN_LEDGER_FILE = "ledger.jsonl";

export type CriterionStatus = "open" | "met";
export type TaskStatus = "pending" | "done";
export type WorkPhaseStatus = "pending" | "in_progress" | "done";

export interface GoalplanCriterion {
  id: string;
  scenario: string;
  expectedEvidence: string;
  capturedEvidence: string | null;
  status: CriterionStatus;
}

export interface GoalplanTask {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface GoalplanWorkPhase {
  id: string;
  title: string;
  status: WorkPhaseStatus;
  tasks: GoalplanTask[];
  criteriaIds: string[];
}

export interface GoalplanHostLink {
  /** true only after a freeze-boundary arm (the MAIN session created a goal). */
  armed: boolean;
  armedAt: string | null;
  source: "freeze" | "none";
}

export interface Goalplan {
  objective: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  /** the durable work-phase cursor the FSM does NOT hold across a D-close. */
  activeWorkPhaseId: string | null;
  workPhases: GoalplanWorkPhase[];
  criteria: GoalplanCriterion[];
  host: GoalplanHostLink;
}

export type GoalplanLedgerEvent =
  | "created"
  | "workphase_started"
  | "workphase_done"
  | "task_done"
  | "criterion_met"
  | "host_armed";

export interface GoalplanLedgerEntry {
  ts: string;
  slug: string;
  event: GoalplanLedgerEvent;
  detail: string;
}

export function goalplanDir(cwd: string, slug: string): string {
  return join(cwd, STATE_DIR, GOALPLANS_SUBDIR, slug);
}

function goalplanPath(cwd: string, slug: string): string {
  return join(goalplanDir(cwd, slug), GOALPLAN_FILE);
}

function goalplanLedgerPath(cwd: string, slug: string): string {
  return join(goalplanDir(cwd, slug), GOALPLAN_LEDGER_FILE);
}

/** Best-effort structural validation; a malformed object reads as absent (null). */
function reviveGoalplan(parsed: unknown): Goalplan | null {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  if (typeof o.objective !== "string" || typeof o.slug !== "string") return null;
  if (!Array.isArray(o.workPhases) || !Array.isArray(o.criteria)) return null;

  const workPhases: GoalplanWorkPhase[] = [];
  for (const wp of o.workPhases as unknown[]) {
    if (typeof wp !== "object" || wp === null) return null;
    const w = wp as Record<string, unknown>;
    if (typeof w.id !== "string" || typeof w.title !== "string") return null;
    const status = w.status === "in_progress" || w.status === "done" ? w.status : "pending";
    const tasks: GoalplanTask[] = [];
    for (const t of Array.isArray(w.tasks) ? (w.tasks as unknown[]) : []) {
      if (typeof t !== "object" || t === null) continue;
      const tt = t as Record<string, unknown>;
      if (typeof tt.id !== "string" || typeof tt.title !== "string") continue;
      tasks.push({ id: tt.id, title: tt.title, status: tt.status === "done" ? "done" : "pending" });
    }
    const criteriaIds = Array.isArray(w.criteriaIds)
      ? (w.criteriaIds as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    workPhases.push({ id: w.id, title: w.title, status, tasks, criteriaIds });
  }

  const criteria: GoalplanCriterion[] = [];
  for (const c of o.criteria as unknown[]) {
    if (typeof c !== "object" || c === null) return null;
    const cc = c as Record<string, unknown>;
    if (typeof cc.id !== "string" || typeof cc.scenario !== "string") return null;
    criteria.push({
      id: cc.id,
      scenario: cc.scenario,
      expectedEvidence: typeof cc.expectedEvidence === "string" ? cc.expectedEvidence : "",
      capturedEvidence: typeof cc.capturedEvidence === "string" ? cc.capturedEvidence : null,
      status: cc.status === "met" ? "met" : "open",
    });
  }

  const hostRaw = (typeof o.host === "object" && o.host !== null ? o.host : {}) as Record<string, unknown>;
  const host: GoalplanHostLink = {
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
export function readGoalplan(cwd: string, slug: string): Goalplan | null {
  try {
    const raw = readFileSync(goalplanPath(cwd, slug), "utf8");
    return reviveGoalplan(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Write a goalplan atomically (tmp + rename), refreshing updatedAt. */
export function writeGoalplan(cwd: string, plan: Goalplan): void {
  const dir = goalplanDir(cwd, plan.slug);
  mkdirSync(dir, { recursive: true });
  const finalPath = goalplanPath(cwd, plan.slug);
  const tmp = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  const normalized: Goalplan = { ...plan, updatedAt: new Date().toISOString() };
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
export function appendGoalplanLedger(cwd: string, slug: string, entry: GoalplanLedgerEntry): void {
  const dir = goalplanDir(cwd, slug);
  mkdirSync(dir, { recursive: true });
  appendFileSync(goalplanLedgerPath(cwd, slug), `${JSON.stringify(entry)}\n`);
}

export interface NewGoalplanInput {
  objective: string;
  /** seeded acceptance criteria (e.g. from the freeze EvidenceBundle). */
  criteria?: Array<{ scenario: string; expectedEvidence?: string }>;
  host?: Partial<GoalplanHostLink>;
  now?: () => string;
}

/** Build a fresh goalplan (no IO). Slug is derived from the objective. */
export function buildGoalplan(input: NewGoalplanInput): Goalplan {
  const now = input.now ?? (() => new Date().toISOString());
  const ts = now();
  const criteria: GoalplanCriterion[] = (input.criteria ?? []).map((c, i) => ({
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
export function remainingWorkPhases(plan: Goalplan): GoalplanWorkPhase[] {
  return plan.workPhases.filter((wp) => wp.status !== "done");
}

/** The next pending task in the first non-done work phase, or null when none remain. */
export function nextOpenTask(plan: Goalplan): { wp: GoalplanWorkPhase; task: GoalplanTask } | null {
  for (const wp of plan.workPhases) {
    if (wp.status === "done") continue;
    for (const task of wp.tasks) {
      if (task.status !== "done") return { wp, task };
    }
  }
  return null;
}

/** Criteria still open. */
export function unmetCriteria(plan: Goalplan): GoalplanCriterion[] {
  return plan.criteria.filter((c) => c.status === "open");
}

/** Complete = no remaining work phases AND no unmet criteria. */
export function isGoalplanComplete(plan: Goalplan): boolean {
  return remainingWorkPhases(plan).length === 0 && unmetCriteria(plan).length === 0;
}

export interface GoalplanValidation {
  ok: boolean;
  reasons: string[];
}

/**
 * Quality gate (E8): a goalplan is valid for a final D-close only when it is complete
 * AND every criterion marked `met` carries non-empty captured evidence (no rubber-stamp).
 */
export function validateGoalplan(plan: Goalplan): GoalplanValidation {
  const reasons: string[] = [];
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
