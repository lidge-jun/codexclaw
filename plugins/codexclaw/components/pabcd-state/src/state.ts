import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, linkSync, rmSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { renameWithRetry } from "./atomic-write.ts";
import { type InterviewTracker, reconstructInterview, normalizeInterview, isInterviewReady } from "./interview.ts";
import type { SourceIdentity } from "./source-identity.ts";
import { splitLines } from "./text-lines.ts";

export type Phase = "IDLE" | "I" | "P" | "A" | "B" | "C" | "D";
// Work phases run the IPABCD cycle; IDLE is the closed/rest state a cycle returns to.
export const WORK_PHASES: readonly Phase[] = ["I", "P", "A", "B", "C", "D"];
export const ALL_PHASES: readonly Phase[] = ["IDLE", ...WORK_PHASES];
// PHASES kept as the work-phase list for back-compat (hook directive lookups iterate I..D).
export const PHASES: readonly Phase[] = WORK_PHASES;

export interface Flags {
  interview: boolean;
  auditPassed: boolean;
  checkPassed: boolean;
}

/**
 * EVIDENCE-TERMINAL-01: one subagent whose evidence verification ran out of retries.
 *
 * Identity is `(agentId, turnId)`. `agent_id` is OPTIONAL in the SubagentStop payload,
 * and sanitizeKey maps every empty value to the same literal, so records without a
 * canonical agent id would all collide into one entry — resolving one would erase the
 * verdict for several distinct workers. Those records are stored `resolvable: false`
 * and cannot be cleared by id.
 */
export interface UnverifiedSubagent {
  agentId: string;
  turnId: string;
  agentType: string;
  attempts: number;
  /** the path the child claimed, length-capped; never the child's prose. */
  receiptClaimed: string;
  recordedAt: string;
  /** false when the payload carried no canonical agent id (collision-prone). */
  resolvable: boolean;
}

/** Retention cap for the tombstone list. Overflow sets `unverifiedCorrupt`. */
export const MAX_UNVERIFIED_SUBAGENTS = 64;
/** Longest claimed-receipt path retained. */
export const MAX_RECEIPT_CLAIM_LEN = 256;

/**
 * Rebuild the tombstone list defensively.
 *
 * ABSENT is the old-schema case and is clean (`[]`). PRESENT-but-malformed is
 * corruption: reconstructing corrupt verdict data to a clean `[]` would silently
 * resolve every tombstone, which is the exact fail-open this record exists to prevent.
 * Overflow is also flagged rather than dropping an unresolved verdict.
 */
export function reconstructUnverified(raw: unknown): { entries: UnverifiedSubagent[]; corrupt: boolean } {
  if (raw === undefined || raw === null) return { entries: [], corrupt: false };
  if (!Array.isArray(raw)) return { entries: [], corrupt: true };
  const entries: UnverifiedSubagent[] = [];
  let corrupt = false;
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      corrupt = true;
      continue;
    }
    const o = item as Record<string, unknown>;
    if (typeof o.agentId !== "string" || typeof o.recordedAt !== "string") {
      corrupt = true;
      continue;
    }
    if (entries.length >= MAX_UNVERIFIED_SUBAGENTS) {
      corrupt = true;
      break;
    }
    entries.push({
      agentId: o.agentId,
      turnId: typeof o.turnId === "string" ? o.turnId : "",
      agentType: typeof o.agentType === "string" ? o.agentType : "worker",
      attempts: Number.isInteger(o.attempts) ? (o.attempts as number) : 0,
      receiptClaimed:
        typeof o.receiptClaimed === "string" ? o.receiptClaimed.slice(0, MAX_RECEIPT_CLAIM_LEN) : "",
      recordedAt: o.recordedAt,
      resolvable: o.resolvable !== false,
    });
  }
  return { entries, corrupt };
}

/**
 * 050 wp5 §48: what a D-close recorded about itself before it started writing.
 * A retry replays the SAME decision instead of recomputing one from a plan file that
 * cannot say whether the earlier commit landed.
 */
export interface DcloseRecoveryMarker {
  sessionId: string;
  checkEpoch: string;
  closedWorkPhaseId: string;
  /**
   * §48: the successor the first attempt picked. A retry reads this instead of guessing
   * from the plan file, which is consistent with two different histories.
   * §50: `null` means that attempt found none, and it is enforced — not merged with
   * "no decision recorded".
   */
  nextWorkPhaseId: string | null;
  /**
   * §50/§51: set when the persisted marker predates `nextWorkPhaseId` or carries a
   * malformed one. Such a marker cannot say whether the plan commit landed, so recovery
   * refuses instead of guessing.
   */
  legacy?: true;
}
export interface State {
  phase: Phase;
  sessionId: string;
  slug: string;
  updatedAt: string;
  flags: Flags;
  supersededBy: string | null;
  injectedTurns: string[];
  lastInjectedPhase: Phase | null;
  orchestrationActive: boolean;
  interview: InterviewTracker | null;
  // L6 Stop-continuation stagnation guard: the phase the Stop hook last blocked on and
  // how many consecutive blocks have happened there. A real transition resets these;
  // the Stop loop releases once the count would exceed MAX_STOP_BLOCKS (no infinite loop).
  stopBlockPhase: Phase | null;
  stopBlockCount: number;
  /** the work phase the last Stop block was counted against. */
  stopBlockWorkPhaseId: string | null;
  /**
   * High-water mark of objective-metric rows seen at a Stop. Tells a new
   * observation from an old one: the plateau check answers "is this better",
   * but only a cursor answers "is this new".
   */
  stopMetricCursor: number;
  /** Stop blocks this session, never reset — the loop's absolute bound. */
  stopBlockTotal: number;
  // 260714 wp3 (IDLE-EDIT-ADVISORY-01): true once this session saw a loop-arm request
  // (detectLoopArmRequest). Retained across D-close (multi-cycle re-arm nudge is the
  // feature); cleared only by explicit reset (operator stand-down).
  loopArmSeen: boolean;
  // 260714 wp3: gated-edit counter for the IDLE-edit advisory frequency guard
  // (inject on count % 5 === 0). Reset at every cycle close (clearedIdle).
  idleEditNudges: number;
  /**
   * EVIDENCE-TERMINAL-01 (260826): SubagentStop verifications that exhausted their
   * retry budget without a valid receipt. The child is RELEASED — a gate that keeps
   * re-prompting a child which provably cannot write the receipt is an infinite loop,
   * not a safeguard — but the verdict is not dropped: GOAL-COMPLETE-GATE-01 denies
   * `update_goal {status:"complete"}` while any entry is unresolved.
   */
  unverifiedSubagents: UnverifiedSubagent[];
  /** true when the tombstone record could not be trusted (malformed or overflowed). */
  unverifiedCorrupt: boolean;
  /**
   * SOURCE-DELTA-01 (050): the source identity captured on entry to B, and null
   * everywhere else. B is the implementation phase, so if this still matches the
   * tree at B>C then nothing was built during B — the work was done in an earlier
   * phase and B is being used as a rubber stamp.
   *
   * Captured only on entry to B: git is cheap here (~20ms) but not free, and no
   * other edge has a question to ask of it.
   */
  phaseEntrySource: SourceIdentity | null;
  /**
   * REVIEW-BINDING-01 (060): the plan unit P>A validated for this cycle, stored
   * relative to cwd, plus a nonce minted on the same edge.
   *
   * A round records both; A>B requires them to match. Without the epoch,
   * re-planning through A>P and back to P>A over the same unit would leave the
   * earlier approval looking valid — same session, same work-phase, same files.
   *
   * Both belong to one A and are read back as null on any other phase, the same
   * discipline as phaseEntrySource: a value must not outlive the span it describes.
   */
  planUnit: string | null;
  planEpoch: string | null;
  /**
   * CHECK-BINDING-01 (075): a nonce minted on entry to C. A test receipt records
   * the epoch it was produced under, and C>D requires a match, so a receipt from
   * an earlier check — or from another session — cannot be spent twice.
   *
   * Lives only in C, like planEpoch lives only in A.
   */
  checkEpoch: string | null;
  /**
   * 050 wp5 §48/§50: durable D-close recovery marker. Written inside the goalplan
   * write lock BEFORE the plan commit and cleared after both ledgers are paid, so a
   * crash between those writes is recoverable. This is authoritative recovery state,
   * not a hint derived from plan statuses or ledger prose — one plan byte pattern fits
   * two different histories, and only this marker distinguishes them.
   */
  dcloseRecovery: DcloseRecoveryMarker | null;
}

export interface LedgerEntry {
  ts: string;
  sessionId: string;
  from: Phase | null;
  to: Phase;
  reason: string;
  evidence?: string;
  /** 131/D2': who drove this transition (human chat vs agent CLI). */
  actor?: "human" | "agent";
  /** 131/D2': true when a human overrode the I->P soft-gate. */
  override?: boolean;
  /** 131/D2': scan-evidence snapshot captured at an I->P override. */
  scanEvidence?: { scanRounds: number; highContradictionCount: number };
  /**
   * 050 wp5: D-close dedup key. A bound close is unique per
   * (sessionId, checkEpoch, closedWorkPhaseId); a close that is not bound to a
   * goalplan work-phase records null.
   */
  checkEpoch?: string | null;
  closedWorkPhaseId?: string | null;
}

export const STATE_DIR = ".codexclaw";
export const SESSIONS_SUBDIR = "sessions";
export const LEDGER_FILE = "ledger.jsonl";
/** 131/D2': per-session interview scan-evidence ledger (durable source of record). */
export const INTERVIEWS_SUBDIR = "interviews";

export function sanitizeKey(value: string): string {
  const sanitized = (value ?? "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized.length > 0 ? sanitized : "missing";
}

/**
 * SessionStart must bind the exact identity that later `orchestrate --session`
 * looks up. Reject values that state-path sanitization would rewrite so the
 * bootstrap cannot publish a state file under a different or colliding key.
 */
export function isCanonicalSessionId(value: string): boolean {
  return value.length > 0 && sanitizeKey(value) === value;
}

/**
 * SOURCE-DELTA-01 (050): rebuild a persisted SourceIdentity, or null when the shape
 * is not one we wrote. A half-parsed identity is worse than none — it would compare
 * unequal against everything and refuse every B>C.
 */
function reconstructSourceIdentity(raw: unknown): SourceIdentity | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.kind !== "resolved" && o.kind !== "unavailable") return null;
  if (typeof o.commitSha !== "string") return null;
  if (typeof o.capturedAt !== "string") return null;
  // Strict, because a half-parsed identity is actively harmful: coercing dirty:"yes"
  // to false produced a "clean" snapshot that compared equal to a clean tree and
  // refused a B>C that had every right to pass.
  if (typeof o.dirty !== "boolean") return null;
  if (o.treeHash !== undefined && typeof o.treeHash !== "string") return null;
  if (o.dirty === true && typeof o.treeHash !== "string") return null;
  const id: SourceIdentity = {
    kind: o.kind,
    commitSha: o.commitSha,
    dirty: o.dirty,
    capturedAt: o.capturedAt,
  };
  if (typeof o.treeHash === "string") id.treeHash = o.treeHash;
  return id;
}

export function defaultState(sessionId: string, slug = ""): State {
  return {
    phase: "IDLE",
    sessionId,
    slug,
    updatedAt: new Date().toISOString(),
    flags: { interview: false, auditPassed: false, checkPassed: false },
    supersededBy: null,
    injectedTurns: [],
    lastInjectedPhase: null,
    orchestrationActive: false,
    interview: null,
    stopBlockPhase: null,
    stopBlockCount: 0,
    stopBlockWorkPhaseId: null,
    stopMetricCursor: 0,
    stopBlockTotal: 0,
    loopArmSeen: false,
    idleEditNudges: 0,
    unverifiedSubagents: [],
    unverifiedCorrupt: false,
    phaseEntrySource: null,
    planUnit: null,
    planEpoch: null,
    checkEpoch: null,
    dcloseRecovery: null,
  };
}

function sessionsDir(cwd: string): string {
  return join(cwd, STATE_DIR, SESSIONS_SUBDIR);
}

function statePath(cwd: string, sessionId: string): string {
  return join(sessionsDir(cwd), `${sanitizeKey(sessionId)}.json`);
}

/**
 * #48: session files live at `<cwd>/.codexclaw/sessions/<id>.json`, so the SAME
 * `--session` id resolves to different state depending on where the process was
 * started. A Codex thread whose cwd is one tree while its work is in another then
 * interviews one FSM and orchestrates the other, and `status` reports IDLE for a
 * cycle that is genuinely in flight elsewhere.
 *
 * Changing the storage location would break every existing session, so instead we
 * make the split VISIBLE: look for the same id in the nearest plausible sibling
 * roots and report what was found. Detection only — nothing is read from or
 * written to the other tree.
 */
export function findForeignSessionCopies(
  cwd: string,
  sessionId: string,
  candidates: string[],
): string[] {
  const mine = resolve(statePath(cwd, sessionId));
  const seen = new Set<string>([mine]);
  const found: string[] = [];
  for (const root of candidates) {
    if (typeof root !== "string" || root.length === 0) continue;
    let candidate: string;
    try {
      candidate = resolve(statePath(root, sessionId));
    } catch {
      continue;
    }
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (existsSync(candidate)) found.push(candidate);
  }
  return found;
}

/**
 * Materialize a fresh Codex session without resetting a resumed one.
 *
 * The complete default is written beside the final path before an exclusive hard
 * link publishes it. `linkSync` is atomic at the destination: concurrent
 * SessionStart hooks race safely, and an existing valid OR corrupt file is never
 * normalized or overwritten here. Later FSM mutations continue to own recovery
 * through readState/writeState.
 */
export function ensureState(
  cwd: string,
  sessionId: string,
  link: (existing: string, created: string) => void = linkSync,
): boolean {
  if (!isCanonicalSessionId(sessionId)) {
    throw new TypeError("sessionId must be a canonical state key");
  }
  const dir = sessionsDir(cwd);
  mkdirSync(dir, { recursive: true });
  const finalPath = statePath(cwd, sessionId);
  const tmp = `${finalPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(defaultState(sessionId), null, 2), { flag: "wx" });
    try {
      link(tmp, finalPath);
      return true;
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (code === "EEXIST") return false;
      // Hard links need NTFS and a single volume. FAT32/exFAT sticks (and some
      // mounted shares) answer EPERM/ENOTSUP/EXDEV instead, and this runs from the
      // SessionStart hook - a throw here kills session bootstrap (defect #13).
      if (code === "EPERM" || code === "ENOTSUP" || code === "EXDEV") {
        try {
          // "wx" gives the same exclusive-create semantics without hard links.
          writeFileSync(finalPath, JSON.stringify(defaultState(sessionId), null, 2), { flag: "wx" });
          return true;
        } catch (fallbackErr) {
          const fallbackCode =
            fallbackErr && typeof fallbackErr === "object" && "code" in fallbackErr
              ? String(fallbackErr.code)
              : "";
          if (fallbackCode === "EEXIST") return false;
          throw fallbackErr;
        }
      }
      throw err;
    }
  } finally {
    rmSync(tmp, { force: true });
  }
}

export function readState(cwd: string, sessionId: string): State {
  return readStateStrict(cwd, sessionId).state;
}

/**
 * readState with the failure reason preserved.
 *
 * `readState` maps EVERY failure — absent file, unreadable file, corrupt JSON — onto a
 * clean default. For advisory fields that is the right, non-throwing behavior and it is
 * relied on everywhere. But a clean default also means "no unresolved verdicts", so a
 * security gate that reads it cannot tell "nothing to report" from "cannot tell".
 * Callers that must fail closed use this and treat `unreadable` as denial.
 */
/**
 * 050 wp5 §50/§51: rebuild the recovery marker with the same strictness as every other
 * persisted field. An absent or malformed `nextWorkPhaseId` is preserved as `legacy`
 * rather than promoted to an explicit null: `null` is an authoritative "this close had
 * no successor", and laundering damage into it would let a corrupt marker skip a real
 * successor.
 */
function reconstructDcloseRecovery(raw: unknown, sessionId: string): DcloseRecoveryMarker | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const marker = raw as Record<string, unknown>;
  if (marker.sessionId !== sessionId) return null;
  if (typeof marker.checkEpoch !== "string" || marker.checkEpoch.length === 0) return null;
  if (typeof marker.closedWorkPhaseId !== "string" || marker.closedWorkPhaseId.length === 0) return null;
  // §50: an ABSENT key is a pre-§48 marker and must not be folded into an explicit
  // null. Measured: reading it as null nulls the cursor on a plan whose commit already
  // landed, and reading it as "no decision" does the same, and the target status cannot
  // tell the two histories apart. So it is preserved as legacy and refused later.
  const recorded = Object.hasOwn(marker, "nextWorkPhaseId") ? marker.nextWorkPhaseId : undefined;
  if (recorded === undefined) {
    return {
      sessionId,
      checkEpoch: marker.checkEpoch,
      closedWorkPhaseId: marker.closedWorkPhaseId,
      nextWorkPhaseId: null,
      legacy: true,
    };
  }
  // §51: a present-but-malformed value must NOT become an explicit null. `null` is an
  // authoritative "this close had no successor", so promoting a number, an object, or an
  // empty string to it would let a corrupt marker skip a real successor. Mark it the same
  // way as a pre-field marker: unreadable intent, hand it to a human.
  if (recorded !== null && (typeof recorded !== "string" || recorded.length === 0)) {
    return {
      sessionId,
      checkEpoch: marker.checkEpoch,
      closedWorkPhaseId: marker.closedWorkPhaseId,
      nextWorkPhaseId: null,
      legacy: true,
    };
  }
  return {
    sessionId,
    checkEpoch: marker.checkEpoch,
    closedWorkPhaseId: marker.closedWorkPhaseId,
    // Every other shape was routed to `legacy` above, so this is a non-empty string or
    // an explicit null. The guard narrows the value rather than asserting it.
    nextWorkPhaseId: typeof recorded === "string" ? recorded : null,
  };
}

export function matchesDcloseRecovery(
  state: State,
  closePhaseId: string,
): state is State & { dcloseRecovery: DcloseRecoveryMarker } {
  const marker = state.dcloseRecovery;
  return marker !== null
    && marker.sessionId === state.sessionId
    && marker.checkEpoch === state.checkEpoch
    && marker.closedWorkPhaseId === closePhaseId;
}

export function readStateStrict(cwd: string, sessionId: string): { state: State; unreadable: boolean } {
  try {
    const p = statePath(cwd, sessionId);
    // No existsSync preflight: it collapses ENOTDIR/EACCES/dangling-parent into
    // "false", which would report a real storage failure as a clean absence — the
    // exact fail-open this function exists to prevent. Read, then classify the errno.
    let raw: string;
    try {
      raw = readFileSync(p, "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      // ENOENT is a genuine "this session never wrote state" and stays clean.
      return { state: defaultState(sessionId), unreadable: code !== "ENOENT" };
    }
    const parsed = JSON.parse(raw) as Partial<State> | null;
    if (!parsed || typeof parsed.phase !== "string" || !ALL_PHASES.includes(parsed.phase as Phase)) {
      return { state: defaultState(sessionId), unreadable: true };
    }
    const base = defaultState(sessionId, typeof parsed.slug === "string" ? parsed.slug : "");
    // strict reconstruction: only known fields survive (omo-style discipline, no unknown-key passthrough)
    const dcloseRecovery = reconstructDcloseRecovery(parsed.dcloseRecovery, sessionId);
    const keepDcloseEpoch = parsed.phase === "IDLE" && dcloseRecovery !== null;
    const rebuilt: State = {
      phase: parsed.phase as Phase,
      sessionId,
      slug: base.slug,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : base.updatedAt,
      flags: {
        // HIGH-1: derive from the tracker (single source of truth); a persisted
        // true flag cannot override a non-ready tracker.
        interview: isInterviewReady(reconstructInterview(parsed.interview)),
        auditPassed: parsed.flags?.auditPassed === true,
        checkPassed: parsed.flags?.checkPassed === true,
      },
      supersededBy: typeof parsed.supersededBy === "string" ? parsed.supersededBy : null,
      injectedTurns:
        Array.isArray(parsed.injectedTurns) && parsed.injectedTurns.every((x) => typeof x === "string")
          ? parsed.injectedTurns
          : [],
      lastInjectedPhase:
        typeof parsed.lastInjectedPhase === "string" && PHASES.includes(parsed.lastInjectedPhase as Phase)
          ? (parsed.lastInjectedPhase as Phase)
          : null,
      orchestrationActive: parsed.phase === "IDLE" ? false : parsed.orchestrationActive === true,
      interview: reconstructInterview(parsed.interview),
      // L6: strict reconstruction of the stagnation-guard fields (default-safe so an
      // old session file without them reads as a fresh counter).
      stopBlockPhase:
        typeof parsed.stopBlockPhase === "string" && ALL_PHASES.includes(parsed.stopBlockPhase as Phase)
          ? (parsed.stopBlockPhase as Phase)
          : null,
      stopBlockCount:
        typeof parsed.stopBlockCount === "number" && Number.isFinite(parsed.stopBlockCount) && parsed.stopBlockCount >= 0
          ? Math.floor(parsed.stopBlockCount)
          : 0,
      // 050: old session files read as null/0 — a fresh cursor and no prior work phase,
      // which makes the first Stop after an upgrade count as 1 rather than skipping ahead.
      stopBlockWorkPhaseId:
        typeof parsed.stopBlockWorkPhaseId === "string" && parsed.stopBlockWorkPhaseId.length > 0
          ? parsed.stopBlockWorkPhaseId
          : null,
      stopMetricCursor:
        typeof parsed.stopMetricCursor === "number" && Number.isFinite(parsed.stopMetricCursor) && parsed.stopMetricCursor >= 0
          ? Math.floor(parsed.stopMetricCursor)
          : 0,
      stopBlockTotal:
        typeof parsed.stopBlockTotal === "number" && Number.isFinite(parsed.stopBlockTotal) && parsed.stopBlockTotal >= 0
          ? Math.floor(parsed.stopBlockTotal)
          : 0,
      // 260714 wp3: strict reconstruction (old files read false/0 — backward-compatible).
      loopArmSeen: parsed.loopArmSeen === true,
      idleEditNudges:
        typeof parsed.idleEditNudges === "number" && Number.isFinite(parsed.idleEditNudges) && parsed.idleEditNudges >= 0
          ? Math.floor(parsed.idleEditNudges)
          : 0,
      // EVIDENCE-TERMINAL-01: an ABSENT field is an old state file and rebuilds
      // clean; a PRESENT but malformed one is corruption and must not be laundered
      // into an empty (= all resolved) list. `unverifiedCorrupt` is sticky: it is
      // set by reconstruction OR by a previously persisted true.
      unverifiedSubagents: reconstructUnverified(parsed.unverifiedSubagents).entries,
      unverifiedCorrupt:
        parsed.unverifiedCorrupt === true || reconstructUnverified(parsed.unverifiedSubagents).corrupt,
      // 050: strict reconstruction. Sessions written before this field existed read
      // as null, which the B>C gate treats as "no snapshot, nothing to compare" —
      // an upgrade must not retroactively refuse a cycle already in flight.
      // Normalized to null outside B: only B has a snapshot to hold, so a value
      // found on any other phase is stale by definition and reading it back would
      // keep the invariant true only by accident.
      phaseEntrySource: parsed.phase === "B" ? reconstructSourceIdentity(parsed.phaseEntrySource) : null,
      // 060: only A can hold a plan binding — minted at P>A, consumed at A>B.
      planUnit: parsed.phase === "A" && typeof parsed.planUnit === "string" && parsed.planUnit.length > 0 ? parsed.planUnit : null,
      planEpoch: parsed.phase === "A" && typeof parsed.planEpoch === "string" && parsed.planEpoch.length > 0 ? parsed.planEpoch : null,
      // 075: only C can hold a check binding — minted at B>C, consumed at C>D.
      // 050 wp5: a D-close marker keeps its check epoch alive into IDLE. The marker is
      // written before the plan commit and cleared after both ledgers are paid, so a
      // retry must still be able to match the epoch the first attempt ran under.
      checkEpoch:
        (parsed.phase === "C" || keepDcloseEpoch)
          && typeof parsed.checkEpoch === "string"
          && parsed.checkEpoch.length > 0
          ? parsed.checkEpoch
          : null,
      dcloseRecovery,
    };
    return { state: rebuilt, unreadable: false };
  } catch {
    // Unreadable bytes: the caller decides whether that is benign.
    return { state: defaultState(sessionId), unreadable: true };
  }
}

export function writeState(cwd: string, next: State): void {
  const dir = sessionsDir(cwd);
  mkdirSync(dir, { recursive: true });
  const finalPath = statePath(cwd, next.sessionId);
  const tmp = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    // T2: cap tracker arrays on the write side so oversized in-memory trackers
    // never reach the hot session JSON.
    const normalized = { ...next, interview: normalizeInterview(next.interview), updatedAt: new Date().toISOString() };
    writeFileSync(tmp, JSON.stringify(normalized, null, 2));
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

/** Bounded wait for the per-session lock: ~10 tries over ~250ms total. */
const LOCK_RETRY_DELAYS_MS = [5, 10, 15, 20, 25, 30, 35, 40, 35, 35] as const;

/**
 * Run `fn` under an exclusive per-session lock.
 *
 * `writeState` is atomic PUBLICATION, not a serialized read-modify-write: concurrent
 * hooks (several subagents stopping at once) each read the same snapshot, mutate their
 * own field, and the last writer silently erases the others. For advisory counters that
 * was tolerable; for a security verdict it is not. Callers that must not lose a
 * concurrent update re-read INSIDE this callback.
 *
 * `wx` gives atomic create-or-fail with no new dependency. There is deliberately NO
 * stale-lock breaker: pathname-based read/rename/unlink recovery is TOCTOU-racy, and
 * two processes that both judge a lock stale can enter concurrently and lose a verdict.
 * Instead acquisition simply EXHAUSTS, and the caller takes its deny-only path — a
 * wedged lock costs a denied completion (recoverable, visible) rather than a silently
 * dropped verdict (undetectable). The critical section is one small JSON write, so a
 * genuinely stuck lock means the process died holding it; the stale `.lock` file is
 * then visible on disk and removable by hand.
 */

function sleepSyncMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function withSessionLock<T>(cwd: string, sessionId: string, fn: () => T): T {
  const dir = sessionsDir(cwd);
  mkdirSync(dir, { recursive: true });
  const lockPath = `${statePath(cwd, sessionId)}.lock`;
  let held = false;
  for (let attempt = 0; !held; attempt++) {
    try {
      writeFileSync(lockPath, `${process.pid}`, { flag: "wx" });
      held = true;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "EEXIST") throw err;
      if (attempt >= LOCK_RETRY_DELAYS_MS.length) throw err;
      sleepSyncMs(LOCK_RETRY_DELAYS_MS[attempt]);
    }
  }
  try {
    return fn();
  } finally {
    try {
      rmSync(lockPath, { force: true });
    } catch {
      /* best-effort release */
    }
  }
}

export function appendLedger(cwd: string, entry: LedgerEntry): void {
  const dir = join(cwd, STATE_DIR);
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, LEDGER_FILE), `${JSON.stringify(entry)}\n`);
}

/** 131/D2': a recorded interview scan event (durable scan-evidence). */
export type InterviewScanEvent = "scan_started" | "scan_completed" | "rescan_completed";

/**
 * The complete set of scan-event kinds. The per-session interview ledger
 * (`.codexclaw/interviews/<id>.jsonl`) is SHARED with Q/A capture events
 * (`question_asked`/`answer_recorded`, written by interview-ledger.ts), so the scan
 * reader must filter to these kinds — a blind parse would misread Q/A rows as scan
 * evidence (L20 / G3).
 */
export const SCAN_EVENT_KINDS: ReadonlySet<string> = new Set<InterviewScanEvent>([
  "scan_started",
  "scan_completed",
  "rescan_completed",
]);

export interface InterviewEvent {
  ts: string;
  sessionId: string;
  event: InterviewScanEvent;
  roundId: number;
  contradictionCount: number;
  highContradictionCount: number;
  /**
   * 260825: the `--map` attributions this scan round used, questionId -> dimension.
   *
   * `deriveFromLedger` takes the map as an argument and then discards it, so a
   * later reader cannot tell which dimension a questionId belonged to. Readiness
   * needs exactly that, to distinguish a level derived from a real answer from
   * one an agent typed with `--known`.
   *
   * It lives here rather than on the tracker because the tracker is rewritten on
   * every `writeState` and is hand-editable; this file is append-only and already
   * holds the answers the map interprets. Evidence and interpretation share one
   * provenance.
   */
  map?: Record<string, string>;
}

function interviewsDir(cwd: string): string {
  return join(cwd, STATE_DIR, INTERVIEWS_SUBDIR);
}

function interviewLedgerPath(cwd: string, sessionId: string): string {
  return join(interviewsDir(cwd), `${sanitizeKey(sessionId)}.jsonl`);
}

/**
 * 131/D2': append a scan event to the per-session interview ledger. This is the durable
 * source of record for "a contradiction scan ran"; the tracker's scanRounds is a cache.
 */
export function appendInterviewEvent(cwd: string, entry: InterviewEvent): void {
  const dir = interviewsDir(cwd);
  mkdirSync(dir, { recursive: true });
  appendFileSync(interviewLedgerPath(cwd, entry.sessionId), `${JSON.stringify(entry)}\n`);
}

/**
 * 131/D2': read recorded interview SCAN events (best-effort; missing file -> []).
 *
 * The ledger file is shared with Q/A capture events (interview-ledger.ts), so this
 * filters to rows whose `event` is a scan kind AND that carry the structural scan
 * fields (mirrors readQaEvents() robustness). Q/A rows and malformed lines are skipped
 * rather than misread as scan evidence (L20 / G3).
 */
export function readInterviewEvents(cwd: string, sessionId: string): InterviewEvent[] {
  let raw: string;
  try {
    raw = readFileSync(interviewLedgerPath(cwd, sessionId), "utf8");
  } catch {
    return [];
  }
  const out: InterviewEvent[] = [];
  for (const line of splitLines(raw)) {
    const t = line.trim();
    if (t.length === 0) continue;
    try {
      const o = JSON.parse(t) as unknown;
      if (
        typeof o === "object" && o !== null && !Array.isArray(o) &&
        SCAN_EVENT_KINDS.has((o as { event?: unknown }).event as string) &&
        typeof (o as { roundId?: unknown }).roundId === "number" &&
        typeof (o as { contradictionCount?: unknown }).contradictionCount === "number"
      ) {
        out.push(o as InterviewEvent);
      }
    } catch {
      // skip malformed line
    }
  }
  return out;
}
