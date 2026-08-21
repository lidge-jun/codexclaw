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
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendGoalplanLedger,
  goalplanDir,
  readGoalplanDetailed,
  writeGoalplan,


} from "./goalplan.js";

/**
 * The op grammar. Both mutating kinds are strictly ADDITIVE (issue #29): adding a
 * criterion or a work phase raises the completion bar, never lowers it, which is
 * why they are safe to admit while removal ops are not.
 */

























/**
 * Mutating kinds land here (issue #29). An unknown kind is still a rejection.
 *
 * Steering must never weaken a plan, and there is deliberately no
 * `remove-criterion` / `supersede-work-phase` here: those are weakening ops and
 * need the refusal rule designed first.
 */
const SUPPORTED_OPS                      = new Set(["annotate", "add-criterion", "add-work-phase"]);

function lockDir(cwd        , slug        )         {
  return join(goalplanDir(cwd, slug), ".steer.lock");
}

function ownerPath(dir        )         {
  return join(dir, "owner.json");
}

/**
 * Acquire by creating a directory: mkdir is atomic on POSIX and Windows alike,
 * and needs no dependency. A held lock surfaces as EEXIST.
 *
 * No stale reclamation. Deciding a lock is dead from a pid or a timestamp means
 * trusting clocks and pid reuse, and being wrong means two writers. The failure
 * message shows the path and owner instead, so a human can clear it.
 *
 * Advisory only: D-close calls writeGoalplan directly without consulting this,
 * so it guards steering against steering, nothing more.
 */
function acquireLock(cwd        , slug        )                                                            {
  const dir = lockDir(cwd, slug);
  try {
    mkdirSync(dir, { recursive: false });
  } catch (err) {
    let owner = "(no owner file)";
    try {
      owner = readFileSync(ownerPath(dir), "utf8").trim();
    } catch {
      // the holder may not have written it yet; the path is the useful part
    }
    return {
      ok: false,
      reason: `another steering batch holds the lock at ${dir} — owner: ${owner}. If no such process is running, remove that directory by hand (it is never reclaimed automatically, since guessing wrong means two concurrent writers). Underlying error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  try {
    writeFileSync(ownerPath(dir), `${JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() })}\n`);
  } catch {
    // best effort: the lock itself is the directory, not this file
  }
  return { ok: true, dir };
}

function releaseLock(dir        )       {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // nothing useful to do; the next acquire reports the stale lock
  }
}

function validateBatch(batch         )                                 {
  if (typeof batch !== "object" || batch === null || Array.isArray(batch)) {
    return { error: "batch must be a JSON object" };
  }
  const b = batch                           ;
  for (const key of ["idempotencyKey", "rationale", "evidence"]) {
    if (typeof b[key] !== "string" || (b[key]          ).trim().length === 0) {
      return { error: `${key} is required and must be a non-empty string` };
    }
  }
  if (!Array.isArray(b.ops) || b.ops.length === 0) {
    return { error: "ops must be a non-empty array — a batch with nothing to do has nothing to record" };
  }
  const ops            = [];
  const SURFACES                      = new Set(["logic", "web", "tui"]);
  for (const [i, raw] of (b.ops             ).entries()) {
    if (typeof raw !== "object" || raw === null) return { error: `ops[${i}] must be an object` };
    const op = raw                           ;
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
        surface: (op.surface                                       ) ?? "logic",
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
    ops.push({ kind: "add-work-phase", id: op.id, title: op.title.trim() });
  }
  return {
    idempotencyKey: b.idempotencyKey          ,
    rationale: b.rationale          ,
    evidence: b.evidence          ,
    ops,
  };
}





/**
 * Fold the ops into a plan. Pure: the caller owns the lock and the write.
 *
 * Ids are assigned here rather than accepted from the batch so two concurrent
 * batches cannot both claim `c-3`. Duplicate detection is on the scenario text
 * for criteria and on the id for work phases, and a duplicate is a rejection
 * rather than a silent no-op - a steering batch that did nothing should say so.
 */
function applyOps(plan          , ops           )                                         {
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
      criteria = [
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
      continue;
    }
    if (workPhases.some((w) => w.id === op.id)) {
      return { error: `work phase '${op.id}' is already in this plan` };
    }
    workPhases = [...workPhases, { id: op.id, title: op.title, status: "pending", tasks: [], criteriaIds: [] }];
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
  cwd        ,
  slug        ,
  rawBatch         ,
  options               = {},
)              {
  const validated = validateBatch(rawBatch);
  if ("error" in validated) return { kind: "rejected", reason: validated.error };
  const batch = validated;
  const now = options.now ?? (() => new Date().toISOString());

  if (!existsSync(join(goalplanDir(cwd, slug), "goalplan.json"))) {
    return { kind: "rejected", reason: `no goalplan found at slug '${slug}'` };
  }

  const lock = acquireLock(cwd, slug);
  if (lock.ok === false) return { kind: "locked", reason: lock.reason };
  const heldDir = lock.dir;

  try {
    const read = readGoalplanDetailed(cwd, slug);
    const plan = read.plan;
    if (!plan) {
      // Naming the failing field beats "missing or unreadable" for both halves:
      // a truncated write and an absent plan used to read identically (issue #29).
      const d = read.diagnostic;
      const why =
        d?.kind === "invalid-json"
          ? `its JSON is invalid: ${d.detail}`
          : d?.kind === "invalid-shape"
            ? `field '${d.field}' did not satisfy the schema`
            : d?.kind === "unreadable"
              ? `it could not be read: ${d.detail}`
              : "it does not exist";
      return { kind: "rejected", reason: `goalplan at slug '${slug}' is unusable - ${why}` };
    }

    const existing = (plan.steeringLog ?? []).find((e) => e.idempotencyKey === batch.idempotencyKey);
    if (existing) return { kind: "duplicate", entry: existing };

    const entry                = {
      idempotencyKey: batch.idempotencyKey,
      rationale: batch.rationale,
      evidence: batch.evidence,
      appliedAt: now(),
      summary: `${batch.ops.length} op(s): ${batch.ops.map((o) => o.kind).join(", ")}`,
    };

    // Build the whole next plan first: a batch applies entirely or not at all,
    // so nothing touches disk until every op has been accepted.
    const applied = applyOps(plan, batch.ops);
    if ("error" in applied) return { kind: "rejected", reason: applied.error };
    const next           = { ...applied.plan, steeringLog: [...(plan.steeringLog ?? []), entry] };

    writeGoalplan(cwd, next); // commit point

    try {
      appendGoalplanLedger(cwd, slug, {
        ts: entry.appliedAt,
        slug,
        event: "steered",
        detail: `${entry.idempotencyKey}: ${entry.summary} — ${entry.rationale}`,
      });
    } catch (err) {
      return {
        kind: "applied",
        plan: next,
        entry,
        warning: `the batch was applied but its ledger entry could not be written to .codexclaw/goalplans/${slug}/ledger.jsonl (${err instanceof Error ? err.message : String(err)}). Re-running is a no-op because the key is now recorded, so add the audit line by hand if you need it.`,
      };
    }

    return { kind: "applied", plan: next, entry };
  } finally {
    releaseLock(heldDir);
  }
}
