/**
 * steering.ts — transactional steering batches (WP14 / plan 090).
 *
 * `$cxc-loop` promises that steering decisions are recorded with rationale and
 * evidence, and that steering weakening completion criteria is refused. Neither
 * existed in code. This slice delivers the first half: a batch either applies
 * whole or not at all, and the fact of it is durable. Refusing weakening
 * steering needs mutation kinds, which is 091 — so this ships `annotate` only.
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
  readGoalplan,
  writeGoalplan,


} from "./goalplan.js";




















/** 091 adds the mutating kinds; until then an unknown kind is a rejection. */
const SUPPORTED_OPS                      = new Set(["annotate"]);

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
  for (const [i, raw] of (b.ops             ).entries()) {
    if (typeof raw !== "object" || raw === null) return { error: `ops[${i}] must be an object` };
    const op = raw                           ;
    if (typeof op.kind !== "string") return { error: `ops[${i}].kind must be a string` };
    if (!SUPPORTED_OPS.has(op.kind)) {
      return { error: `ops[${i}].kind "${op.kind}" is not supported yet — this slice implements "annotate" only` };
    }
    if (op.kind === "annotate" && (typeof op.note !== "string" || op.note.trim().length === 0)) {
      return { error: `ops[${i}] is an annotate without a note` };
    }
    ops.push({ kind: op.kind, note: typeof op.note === "string" ? op.note : undefined });
  }
  return {
    idempotencyKey: b.idempotencyKey          ,
    rationale: b.rationale          ,
    evidence: b.evidence          ,
    ops,
  };
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
    const plan = readGoalplan(cwd, slug);
    if (!plan) {
      return { kind: "rejected", reason: `goalplan at slug '${slug}' is missing or unreadable` };
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
    const next           = { ...plan, steeringLog: [...(plan.steeringLog ?? []), entry] };

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
