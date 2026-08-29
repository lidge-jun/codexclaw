/**
 * steering.ts — transactional steering batches (WP14 / plan 090).
 *
 * `$cxc-loop` promises that steering decisions are recorded with rationale and
 * evidence, and that steering weakening completion criteria is refused. A batch
 * either applies whole or not at all, and the fact of it is durable.
 *
 * Issue #29 adds the two ADDITIVE mutating kinds - `add-criterion` and
 * `add-work-phase` - so a plan is no longer frozen at birth. Weakening kinds
 * stay unimplemented: every op here can only raise the completion bar, which is
 * how the refusal rule is satisfied by construction rather than by a check.
 *
 * "annotate does not change state" would be wrong: it appends to steeringLog and
 * therefore changes idempotency. What it does not change is anything completion
 * is judged on.
 */
// 060 wp6: applyOps()가 두 integrity helper를 부르므로 두 이름을 함께 import한다. 뒤 이름을
// 빼면 TS2304 두 건이고, 타입을 지운 런타임에서는 steering.test.ts 두 건이 ReferenceError로
// 죽는다. 감사 라운드 2에서 감사관 두 기가 각자 사본에서 22개 중 2 fail을 재현했다.
import {
  appendGoalplanLedger,
  goalplanDefinitionIntegrityReasons,
  goalplanDependencyCompletionReasons,
  withGoalplanWriteLock,
  writeGoalplan,
  type Goalplan,
  type GoalplanCriterion,
  type GoalplanWorkPhase,
  type GoalplanWriteLockOptions,
  type SteeringEntry,
} from "./goalplan.ts";

/**
 * The op grammar. Both mutating kinds are strictly ADDITIVE (issue #29): adding a
 * criterion or a work phase raises the completion bar, never lowers it, which is
 * why they are safe to admit while removal ops are not.
 */
export type SteerOp =
  | { kind: "annotate"; note: string }
  | {
      kind: "add-criterion";
      scenario: string;
      /** schemaVersion 2 requires this. Defaulted to "logic" at parse time. */
      surface?: "logic" | "web" | "tui";
      expectedEvidence?: string;
    }
  | { kind: "add-work-phase"; id: string; title: string; dependsOn?: string[] };

export interface SteerBatch {
  idempotencyKey: string;
  rationale: string;
  evidence: string;
  ops: SteerOp[];
}

export type SteerResult =
  | { kind: "applied"; plan: Goalplan; entry: SteeringEntry; warning?: string }
  /** the key was already in steeringLog — nothing was written. */
  | { kind: "duplicate"; entry: SteeringEntry }
  | { kind: "rejected"; reason: string }
  | { kind: "locked"; reason: string };

/**
 * Mutating kinds land here (issue #29). An unknown kind is still a rejection.
 *
 * Steering must never weaken a plan, and there is deliberately no
 * `remove-criterion` / `supersede-work-phase` here: those are weakening ops and
 * need the refusal rule designed first.
 */
const SUPPORTED_OPS: ReadonlySet<string> = new Set(["annotate", "add-criterion", "add-work-phase"]);

function validateBatch(batch: unknown): SteerBatch | { error: string } {
  if (typeof batch !== "object" || batch === null || Array.isArray(batch)) {
    return { error: "batch must be a JSON object" };
  }
  const b = batch as Record<string, unknown>;
  for (const key of ["idempotencyKey", "rationale", "evidence"]) {
    if (typeof b[key] !== "string" || (b[key] as string).trim().length === 0) {
      return { error: `${key} is required and must be a non-empty string` };
    }
  }
  if (!Array.isArray(b.ops) || b.ops.length === 0) {
    return { error: "ops must be a non-empty array — a batch with nothing to do has nothing to record" };
  }
  const ops: SteerOp[] = [];
  const SURFACES: ReadonlySet<string> = new Set(["logic", "web", "tui"]);
  for (const [i, raw] of (b.ops as unknown[]).entries()) {
    if (typeof raw !== "object" || raw === null) return { error: `ops[${i}] must be an object` };
    const op = raw as Record<string, unknown>;
    if (typeof op.kind !== "string") return { error: `ops[${i}].kind must be a string` };
    if (!SUPPORTED_OPS.has(op.kind)) {
      return {
        error: `ops[${i}].kind "${op.kind}" is not supported - use "annotate", "add-criterion", or "add-work-phase"`,
      };
    }
    if (op.kind === "annotate") {
      if (typeof op.note !== "string" || op.note.trim().length === 0) {
        return { error: `ops[${i}] is an annotate without a note` };
      }
      ops.push({ kind: "annotate", note: op.note });
      continue;
    }
    if (op.kind === "add-criterion") {
      if (typeof op.scenario !== "string" || op.scenario.trim().length === 0) {
        return { error: `ops[${i}] is an add-criterion without a scenario` };
      }
      if (op.surface !== undefined && (typeof op.surface !== "string" || !SURFACES.has(op.surface))) {
        return { error: `ops[${i}].surface must be "logic", "web", or "tui"` };
      }
      ops.push({
        kind: "add-criterion",
        scenario: op.scenario.trim(),
        surface: (op.surface as "logic" | "web" | "tui" | undefined) ?? "logic",
        expectedEvidence: typeof op.expectedEvidence === "string" ? op.expectedEvidence.trim() : "",
      });
      continue;
    }
    // add-work-phase
    if (typeof op.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(op.id)) {
      return { error: `ops[${i}].id must be a short lowercase work-phase id, e.g. "wp04-loop-criteria"` };
    }
    if (typeof op.title !== "string" || op.title.trim().length === 0) {
      return { error: `ops[${i}] is an add-work-phase without a title` };
    }
    const rawDependsOn = op.dependsOn ?? [];
if (!Array.isArray(rawDependsOn)) {
  return { error: `ops[${i}].dependsOn must be an array of non-empty work-phase ids` };
}
const dependsOn = rawDependsOn.map((id) => typeof id === "string" ? id.trim() : "");
if (dependsOn.some((id) => id.length === 0)) {
  return { error: `ops[${i}].dependsOn must be an array of non-empty work-phase ids` };
}
if (new Set(dependsOn).size !== dependsOn.length) {
  return { error: `ops[${i}].dependsOn must not contain duplicate ids` };
}
ops.push({ kind: "add-work-phase", id: op.id, title: op.title.trim(), dependsOn });
  }
  return {
    idempotencyKey: b.idempotencyKey as string,
    rationale: b.rationale as string,
    evidence: b.evidence as string,
    ops,
  };
}

export interface ApplyOptions {
  now?: () => string;
  /**
   * 050 wp5: the shared goalplan write lock replaces the dedicated steering lock, so
   * steering and D-close serialize against each other instead of only against their
   * own kind. Retry timing and the clock are injected for the contention tests.
   */
  lock?: GoalplanWriteLockOptions;
}

/**
 * Fold the ops into a plan. Pure: the caller owns the lock and the write.
 *
 * Ids are assigned here rather than accepted from the batch so two concurrent
 * batches cannot both claim `c-3`. Duplicate detection is on the scenario text
 * for criteria and on the id for work phases, and a duplicate is a rejection
 * rather than a silent no-op - a steering batch that did nothing should say so.
 */
/**
 * 060 wp6: both mutating branches run the SAME two integrity checks in the SAME order.
 *
 * `ready` and the lifecycle verbs gate on both helpers, and steering used to gate on the
 * definition one alone. A plan whose leaf task is done while its dependency base is still
 * pending yields zero definition reasons and one completion reason, so `add-task` refused it
 * while `add-work-phase` wrote a new phase into it. Sharing one function is what keeps the
 * two surfaces from drifting apart again.
 */
function integrityReasons(candidate: Goalplan): string[] {
  return [
    ...goalplanDefinitionIntegrityReasons(candidate),
    ...goalplanDependencyCompletionReasons(candidate),
  ];
}

function applyOps(plan: Goalplan, ops: SteerOp[]): { plan: Goalplan } | { error: string } {
  let criteria = [...plan.criteria];
  let workPhases = [...plan.workPhases];
  for (const op of ops) {
    if (op.kind === "annotate") continue; // ledger-only, by design
    if (op.kind === "add-criterion") {
      const scenario = op.scenario;
      if (criteria.some((c) => c.scenario === scenario)) {
        return { error: `a criterion with scenario "${scenario}" is already registered` };
      }
      // Ids are dense and monotonic: max existing c-N + 1, never criteria.length,
      // so a hand-edited plan with a gap cannot produce a collision.
      const maxId = criteria.reduce((m, c) => {
        const n = Number(/^c-(\d+)$/.exec(c.id)?.[1] ?? 0);
        return Number.isFinite(n) && n > m ? n : m;
      }, 0);
      const candidateCriteria: GoalplanCriterion[] = [
        ...criteria,
        {
          id: `c-${maxId + 1}`,
          scenario,
          surface: op.surface ?? "logic",
          expectedEvidence: op.expectedEvidence ?? "",
          capturedEvidence: null,
          status: "open",
        },
      ];
      const criterionReasons = integrityReasons({ ...plan, criteria: candidateCriteria, workPhases });
      if (criterionReasons.length > 0) return { error: criterionReasons.join("; ") };
      criteria = candidateCriteria;
      continue;
    }
    if (workPhases.some((w) => w.id === op.id)) {
      return { error: `work phase '${op.id}' is already in this plan` };
    }
    const dependsOn = op.dependsOn ?? [];
    const candidateWorkPhases: GoalplanWorkPhase[] = [...workPhases, {
      id: op.id,
      title: op.title,
      status: "pending",
      tasks: [],
      criteriaIds: [],
      ...(dependsOn.length > 0 ? { dependsOn } : {}),
    }];
    const phaseReasons = integrityReasons({ ...plan, criteria, workPhases: candidateWorkPhases });
    if (phaseReasons.length > 0) return { error: phaseReasons.join("; ") };
    workPhases = candidateWorkPhases;
  }
  return { plan: { ...plan, criteria, workPhases } };
}

/**
 * Apply a batch under the lock.
 *
 * The lock spans the whole read-modify-write. Taking it just before the write
 * would let two processes read the same snapshot and have the later one clobber
 * the earlier steeringLog.
 *
 * The transaction covers goalplan.json alone. There is no way to commit that
 * file and the ledger together, so goalplan.json is the commit point — it is
 * what idempotency reads — and a failed ledger append returns success with a
 * warning rather than pretending nothing happened.
 */
export function applySteeringBatch(
  cwd: string,
  slug: string,
  rawBatch: unknown,
  options: ApplyOptions = {},
): SteerResult {
  const validated = validateBatch(rawBatch);
  if ("error" in validated) return { kind: "rejected", reason: validated.error };
  const batch = validated;
  const now = options.now ?? (() => new Date().toISOString());

  const locked = withGoalplanWriteLock(cwd, slug, (plan): SteerResult => {
    const existing = (plan.steeringLog ?? []).find(
      (entry) => entry.idempotencyKey === batch.idempotencyKey,
    );
    if (existing) return { kind: "duplicate", entry: existing };

    const entry: SteeringEntry = {
      idempotencyKey: batch.idempotencyKey,
      rationale: batch.rationale,
      evidence: batch.evidence,
      appliedAt: now(),
      summary: `${batch.ops.length} op(s): ${batch.ops.map((op) => op.kind).join(", ")}`,
    };
    const applied = applyOps(plan, batch.ops);
    if ("error" in applied) return { kind: "rejected", reason: applied.error };

    const next: Goalplan = {
      ...applied.plan,
      steeringLog: [...(plan.steeringLog ?? []), entry],
    };
    writeGoalplan(cwd, next);
    try {
      appendGoalplanLedger(cwd, slug, {
        ts: entry.appliedAt,
        slug,
        event: "steered",
        detail: `${entry.idempotencyKey}: ${entry.summary} — ${entry.rationale}`,
      });
      // 060 wp6: one row per phase that actually declared prerequisites. The plan file
      // shows the final graph, so without these rows the ledger cannot say WHEN an edge
      // appeared — a graph that grew mid-loop reads as if it was declared up front.
      // Emitted after `steered` so the batch that carried the edge is the row above it.
      for (const op of batch.ops) {
        if (op.kind !== "add-work-phase") continue;
        const dependsOn = op.dependsOn ?? [];
        if (dependsOn.length === 0) continue;
        appendGoalplanLedger(cwd, slug, {
          ts: entry.appliedAt,
          slug,
          event: "dependency_registered",
          detail: `${op.id} dependsOn=${dependsOn.join(",")}`,
        });
      }
    } catch (err) {
      return {
        kind: "applied",
        plan: next,
        entry,
        warning:
          `the batch was applied but its ledger entry could not be written to `
          + `.codexclaw/goalplans/${slug}/ledger.jsonl `
          + `(${err instanceof Error ? err.message : String(err)}). `
          + `Re-running is a no-op because the key is recorded.`,
      };
    }
    return { kind: "applied", plan: next, entry };
  }, options.lock);

  if (locked.kind === "locked") return { kind: "locked", reason: locked.reason };
  if (locked.kind === "unreadable") {
    // The absent-plan refusal predates the shared lock and is asserted by name
    // (steering.test.ts). The lock reports absence as one `unreadable` reason among
    // several, so it is mapped back rather than folded into the unusable wording.
    if (locked.reason === `goalplan '${slug}' does not exist`) {
      return { kind: "rejected", reason: `no goalplan found at slug '${slug}'` };
    }
    return { kind: "rejected", reason: `goalplan at slug '${slug}' is unusable - ${locked.reason}` };
  }
  return locked.value;
}
