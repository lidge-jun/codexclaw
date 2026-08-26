/**
 * subagent-evidence.ts — SubagentStop evidence-receipt gate (lazygap_impl 010).
 *
 * A dispatched WRITE/verify subagent (agent_type "worker") cannot "finish" without a
 * non-empty evidence receipt under `.codexclaw/evidence/`. Missing/invalid receipt ->
 * `decision:"block"` with a verifier directive that re-prompts the CHILD (codex-rs
 * turn.rs:323). After MAX_ATTEMPTS the directive escalates but remains fail-closed;
 * untrusted child transcript text can never exempt itself from verification.
 *
 * EVIDENCE-TERMINAL-01 (260826): "fail-closed" used to mean the escalation branch
 * returned a block FOREVER. That trapped exactly the population it could not help — a
 * child dispatched read-only cannot create a file under the parent's
 * `.codexclaw/evidence/`, so it could never satisfy the demand and never stop being
 * asked. A real transcript shows 15+ identical escalation blocks.
 *
 * The budget is now terminal: at the cap the gate records an unresolved TOMBSTONE in
 * session state and releases the child. Verification is not waived — it moves to the
 * only actor that can act on it: GOAL-COMPLETE-GATE-01 denies `update_goal
 * {status:"complete"}` while a tombstone is unresolved. Fail-closed on the VERDICT,
 * bounded on the CONTROL FLOW.
 *
 * Translates omo's `lazycodex-executor-verify` pattern into codexclaw's no-server model,
 * using direct node:fs (matching interview-ledger.ts / state.ts — no fs-injection seam).
 *
 * Ground truth (codex-rs):
 *  - SubagentStop fires only for thread-spawned children: hook_runtime.rs:300
 *  - stdin carries agent_type/agent_id/last_assistant_message + BOTH transcript paths
 *    (transcript_path = parent, agent_transcript_path = child): schema.rs:576, hook_runtime.rs:302
 *  - decision:"block" + reason re-prompts the child's own turn: stop.rs:263,351 + turn.rs:323
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { renameWithRetry } from "./atomic-write.ts";
import {
  MAX_RECEIPT_CLAIM_LEN,
  STATE_DIR,
  readState,
  readStateStrict,
  sanitizeKey,
  withSessionLock,
  writeState,
  type UnverifiedSubagent,
} from "./state.ts";
import type { SubagentStopPayload } from "./hook.ts";

/**
 * agent_type values this gate refuses to release without a receipt.
 * DISPATCH-AGENT-TYPE-01: only "worker" is gated. Read-only audit/research
 * dispatches MUST use agent_type:"explorer" so they bypass both the hook
 * manifest matcher (^worker$) and this runtime gate. See
 * structure/20_pabcd_dispatch_doctrine.md §3.
 */
export const GATED_AGENT_TYPES = new Set<string>(["worker"]);

/** Blocks allowed per agent before the gate terminates and releases. */
export const MAX_ATTEMPTS = 3;

export const EVIDENCE_SUBDIR = "evidence";
export const EVIDENCE_ATTEMPTS_SUBDIR = "evidence-attempts";

/** Context-pressure markers (omo parity): never pile on during compaction recovery. */
const CONTEXT_PRESSURE_MARKERS = [
  "context compacted",
  "context_length_exceeded",
  "skill descriptions were shortened",
  "context_too_large",
  "codex ran out of room in the model's context window",
  "your input exceeds the context window",
  "long threads and multiple compactions",
] as const;

function evidenceRoot(cwd: string): string {
  return resolve(cwd, STATE_DIR, EVIDENCE_SUBDIR);
}

/**
 * Attempt state is keyed by (session, agent, turn) — the SAME identity as a tombstone.
 *
 * Keying on the agent alone would let two turns of one agent share a counter: turn 2
 * would inherit turn 1's spent budget, and resolving turn 1 would clear the fallback
 * verdict signal for turn 2. `turnId` is optional in the payload, so an absent turn
 * collapses to the legacy key and behaves exactly as before.
 */
function attemptsPath(cwd: string, sessionId: string, agentId: string, turnId = ""): string {
  return join(
    cwd,
    STATE_DIR,
    EVIDENCE_ATTEMPTS_SUBDIR,
    turnId === ""
      // The absent-turn key needs the digest too: sanitizeKey is not injective, so
      // agents "a/b" and "a-b" would otherwise share one counter and a receipt for
      // one would clear the other's spent verdict.
      ? `${sanitizeKey(sessionId)}-${sanitizeKey(agentId)}-${tupleDigest(agentId, "")}.json`
      // Delimiter-joined tuples are ambiguous, and length-prefixing the SANITIZED
      // value does not help: sanitizeKey is not injective, so "b/c" and "b-c" are
      // already the same string before any prefix is applied. Disambiguate with a
      // digest of the RAW pair; the sanitized parts stay in the name only so the file
      // remains recognisable to a human reading the directory.
      : `${sanitizeKey(sessionId)}-${sanitizeKey(agentId)}-${sanitizeKey(turnId)}-${tupleDigest(agentId, turnId)}.json`,
  );
}

/**
 * Digest of the RAW (agent, turn) pair, length-delimited so the PRE-HASH framing is
 * injective over code-unit pairs. The digest itself is collision-RESISTANT rather than
 * mathematically injective, so it is kept at 128 bits.
 */
function tupleDigest(agentId: string, turnId: string): string {
  // Hash the UTF-16 code units, not UTF-8 bytes: Node replaces lone surrogates with
  // U+FFFD when encoding, so "\uD800" and "\uD801" would otherwise digest identically.
  return createHash("sha256")
    .update(Buffer.from(`${agentId.length}:${agentId}:${turnId.length}:${turnId}`, "utf16le"))
    .digest("hex")
    .slice(0, 32);
}

/** Last-line / inline marker `EVIDENCE_RECORDED: <path>` (omo contract). */
export function extractReceiptPath(message: string | null | undefined): string | null {
  if (typeof message !== "string") return null;
  const m = /EVIDENCE_RECORDED:\s*(\S+)/.exec(message);
  return m?.[1] ?? null;
}

function isPathInsideDirectory(filePath: string, directoryPath: string): boolean {
  const rel = relative(directoryPath, filePath);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

function realPathSafe(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

/**
 * The receipt must resolve INSIDE `.codexclaw/evidence/`, be a real (non-symlink) file,
 * and be non-empty. Resolves both the lexical path and the realpath to defeat symlink
 * escape. Any failure fails open by returning false (treated as "no valid receipt").
 */
export function hasValidReceipt(cwd: string, receiptPath: string): boolean {
  try {
    const root = evidenceRoot(cwd);
    const resolved = isAbsolute(receiptPath) ? resolve(receiptPath) : resolve(cwd, receiptPath);
    if (!isPathInsideDirectory(resolved, root)) return false;
    if (!existsSync(resolved)) return false;
    // symlink rejection (lstat the lexical path before following).
    if (lstatSync(resolved).isSymbolicLink()) return false;
    // realpath guard: the real file must still sit inside the real evidence root.
    const realRoot = realPathSafe(root);
    const realFile = realPathSafe(resolved);
    if (!isPathInsideDirectory(realFile, realRoot)) return false;
    const st = statSync(resolved);
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

/** Read the CHILD transcript (agent_transcript_path) for compaction markers. */
export function transcriptHasContextPressure(agentTranscriptPath: string | null | undefined): boolean {
  if (typeof agentTranscriptPath !== "string" || agentTranscriptPath === "") return false;
  try {
    const text = readFileSync(agentTranscriptPath, "utf8").toLowerCase();
    return CONTEXT_PRESSURE_MARKERS.some((marker) => text.includes(marker));
  } catch {
    return false;
  }
}

export function readAttempts(cwd: string, sessionId: string, agentId: string, turnId = ""): number {
  try {
    const p = attemptsPath(cwd, sessionId, agentId, turnId);
    if (!existsSync(p)) return 0;
    const parsed = JSON.parse(readFileSync(p, "utf8")) as unknown;
    if (parsed && typeof parsed === "object") {
      const n = (parsed as { attempts?: unknown }).attempts;
      // Clamp to [0, MAX_ATTEMPTS]. An unbounded integer was a liveness hole: a
      // persisted -9007199254740991 sits below the cap, so every call would
      // increment by one and block — quadrillions of blocks before termination,
      // which is an infinite loop with extra steps. Out-of-range data is corrupt,
      // and corrupt verification data must terminate, not extend the budget.
      if (typeof n === "number" && Number.isSafeInteger(n)) {
        if (n < 0 || n > MAX_ATTEMPTS) return MAX_ATTEMPTS;
        return n;
      }
      return MAX_ATTEMPTS;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Persist the attempt counter. Returns false when nothing durable was written.
 *
 * This used to swallow failure and let the caller block anyway — which meant an
 * unwritable state directory produced an infinite loop: every call re-read 0, blocked,
 * and failed to record that it had. The caller now terminates instead.
 */
export function writeAttempts(cwd: string, sessionId: string, agentId: string, attempts: number, turnId = ""): boolean {
  try {
    const p = attemptsPath(cwd, sessionId, agentId, turnId);
    mkdirSync(join(cwd, STATE_DIR, EVIDENCE_ATTEMPTS_SUBDIR), { recursive: true });
    const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, `${JSON.stringify({ attempts })}\n`);
    renameWithRetry(tmp, p);
    return true;
  } catch {
    return false;
  }
}

export function clearAttempts(cwd: string, sessionId: string, agentId: string, turnId = ""): void {
  try {
    rmSync(attemptsPath(cwd, sessionId, agentId, turnId), { force: true });
  } catch {
    /* best-effort */
  }
}

/** Identity for a tombstone. An empty agent id is NOT resolvable (collision-prone). */
function tombstoneIdentity(payload: SubagentStopPayload): { agentId: string; turnId: string; resolvable: boolean } {
  const agentId = payload.agent_id ?? "";
  const turnId = payload.turn_id ?? "";
  return { agentId, turnId, resolvable: agentId !== "" };
}

function sameAgent(entry: UnverifiedSubagent, agentId: string, turnId: string): boolean {
  return entry.agentId === agentId && entry.turnId === turnId;
}

/**
 * Is there already a terminal record for this agent? This is the latch that makes the
 * release STICK: without it the 5th stop would re-enter the retry budget from zero
 * (readAttempts is untouched at the cap) and start blocking again.
 */
export function hasTombstone(cwd: string, sessionId: string, payload: SubagentStopPayload): boolean {
  try {
    const { agentId, turnId } = tombstoneIdentity(payload);
    const state = readState(cwd, sessionId);
    return state.unverifiedSubagents.some((e) => sameAgent(e, agentId, turnId));
  } catch {
    return false;
  }
}

/**
 * Record the terminal verdict, then release.
 *
 * `writeState` publishes atomically but is a read-modify-write: two subagents stopping
 * at the same moment would each read the same list, add only their own entry, and the
 * second write would erase the first verdict. So the whole transaction runs under the
 * session lock and RE-READS inside it. Returns false when nothing durable was written.
 */
export function recordTombstone(cwd: string, sessionId: string, payload: SubagentStopPayload, attempts: number): boolean {
  const { agentId, turnId, resolvable } = tombstoneIdentity(payload);
  const entry: UnverifiedSubagent = {
    agentId,
    turnId,
    agentType: payload.agent_type,
    attempts,
    // the claimed path only — never the child's prose (no secret-bearing free text).
    receiptClaimed: (extractReceiptPath(payload.last_assistant_message) ?? "").slice(0, MAX_RECEIPT_CLAIM_LEN),
    recordedAt: new Date().toISOString(),
    resolvable,
  };
  const commit = (): boolean => {
    // Strict read: `readState` maps corrupt bytes onto a CLEAN default, so committing
    // on top of it would rewrite a state file that may already hold another
    // unresolved tombstone as if it held none — laundering a verdict through
    // corruption. Refuse to overwrite what we cannot read.
    const { state, unreadable } = readStateStrict(cwd, sessionId);
    if (unreadable) throw new Error("session state is unreadable; refusing to overwrite it");
    const next = state.unverifiedSubagents.filter((e) => !sameAgent(e, agentId, turnId));
    next.push(entry);
    writeState(cwd, { ...state, sessionId, unverifiedSubagents: next });
    return true;
  };
  try {
    return withSessionLock(cwd, sessionId, commit);
  } catch {
    // NO unlocked fallback: an unlocked read-modify-write here is exactly how a
    // concurrent verdict gets erased (last writer wins), and losing a verdict is
    // worse than failing loudly. Try to raise the corruption sentinel instead —
    // it also denies completion, so the parent still cannot certify silently.
    try {
      withSessionLock(cwd, sessionId, () => {
        // Same reasoning, but the sentinel is safe to set even on unreadable state:
        // it only ever DENIES, so writing it over a default is not a downgrade.
        const { state } = readStateStrict(cwd, sessionId);
        writeState(cwd, { ...state, sessionId, unverifiedCorrupt: true });
      });
    } catch {
      // Last resort: an independent marker file, written with exclusive-create so it
      // needs no lock and cannot lose a race. The completion gate treats its presence
      // as "a verdict could not be recorded" and denies, so a storage failure can
      // never silently become a clean bill of health.
      try {
        writeUnrecordableMarker(cwd, sessionId, agentId);
      } catch {
        /* nothing durable is reachable at all; the child is still released. */
      }
    }
    return false;
  }
}

/** Directory of "a verdict existed but could not be persisted" markers. */
export const EVIDENCE_UNRECORDABLE_SUBDIR = "evidence-unrecordable";

function unrecordableDir(cwd: string): string {
  return join(cwd, STATE_DIR, EVIDENCE_UNRECORDABLE_SUBDIR);
}

/**
 * Record that a terminal verdict could NOT be persisted into session state.
 *
 * Written with `wx` (exclusive create) into its own directory, so it needs no lock,
 * cannot be lost to a concurrent writer, and does not depend on the state file being
 * readable — the three ways the primary path can fail.
 */
export function writeUnrecordableMarker(cwd: string, sessionId: string, agentId: string): void {
  const dir = unrecordableDir(cwd);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, `${sanitizeKey(sessionId)}-${sanitizeKey(agentId)}-${Date.now()}.json`);
  writeFileSync(p, `${JSON.stringify({ sessionId, agentId, at: new Date().toISOString() })}\n`, { flag: "wx" });
}

/**
 * Prove the marker directory is WRITABLE, not merely readable.
 *
 * A readable-but-unwritable directory was a silent-allow path: marker creation failed,
 * and the later lookup saw an empty, perfectly readable directory and reported "no
 * verdict". Probing writability turns that into a denial.
 */
function markerDirWritable(cwd: string): boolean {
  const probe = join(unrecordableDir(cwd), `.probe-${process.pid}-${Date.now()}`);
  try {
    mkdirSync(unrecordableDir(cwd), { recursive: true });
    writeFileSync(probe, "", { flag: "wx" });
    rmSync(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Look for unrecordable-verdict markers.
 *
 * Tri-state on purpose: mapping every readdir error to "absent" would make an
 * unreadable marker directory indistinguishable from a session that never delegated,
 * which is the same fail-open in a new place. Only ENOENT is a genuine absence.
 */
export function unrecordableVerdictStatus(cwd: string, sessionId: string): { present: boolean; unreadable: boolean } {
  try {
    const prefix = `${sanitizeKey(sessionId)}-`;
    const present = readdirSync(unrecordableDir(cwd)).some((n) => n.startsWith(prefix));
    // A readable but UNWRITABLE marker directory cannot be trusted to be empty: a
    // marker may have been attempted and silently failed. Treat it as unreadable.
    if (!present && !markerDirWritable(cwd)) return { present: false, unreadable: true };
    return { present, unreadable: false };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    // ENOENT is normally a genuine "nothing was ever recorded" — but it is also what
    // you see when marker creation FAILED because the directory could not be created
    // at all (an unwritable .codexclaw). So an absent directory is only clean if we
    // can prove we could have written a marker into it.
    if (code === "ENOENT") return { present: false, unreadable: !markerDirWritable(cwd) };
    return { present: false, unreadable: true };
  }
}

/**
 * Spent-budget counters are themselves a durable verdict signal.
 *
 * The attempts file reaches MAX_ATTEMPTS during NORMAL operation — written across
 * calls 1..3, long before any storage failure — and `clearAttempts` runs only on a
 * VALID receipt. So a counter still sitting at the cap means "this agent exhausted
 * verification and was never verified", independent of whether the tombstone, the
 * sentinel, or the marker could be written afterwards.
 *
 * This closes the case the tombstone cannot cover: a transient failure at terminal
 * time followed by filesystem recovery, where every later probe looks healthy and the
 * historical verdict would otherwise be lost.
 */
export function hasSpentBudget(cwd: string, sessionId: string): boolean {
  const dir = join(cwd, STATE_DIR, EVIDENCE_ATTEMPTS_SUBDIR);
  const prefix = `${sanitizeKey(sessionId)}-`;
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch (err) {
    // ENOENT here is genuinely "no worker ever blocked in this session".
    return (err as NodeJS.ErrnoException)?.code !== "ENOENT";
  }
  for (const n of names) {
    if (!n.startsWith(prefix) || !n.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(readFileSync(join(dir, n), "utf8")) as { attempts?: unknown };
      const a = parsed.attempts;
      if (typeof a !== "number" || !Number.isSafeInteger(a) || a < 0 || a >= MAX_ATTEMPTS) return true;
    } catch {
      return true; // an unreadable counter cannot be shown to be unspent
    }
  }
  return false;
}

/**
 * Clear the tombstone for this agent — used when a late VALID receipt arrives, so the
 * parent is not left permanently blocked on work that was eventually verified.
 * Returns true when an entry was actually removed.
 */
export function resolveTombstone(cwd: string, sessionId: string, payload: SubagentStopPayload): boolean {
  const { agentId, turnId } = tombstoneIdentity(payload);
  try {
    return withSessionLock(cwd, sessionId, () => {
      const state = readState(cwd, sessionId);
      const next = state.unverifiedSubagents.filter((e) => !sameAgent(e, agentId, turnId));
      if (next.length === state.unverifiedSubagents.length) return false;
      writeState(cwd, { ...state, sessionId, unverifiedSubagents: next });
      return true;
    });
  } catch {
    return false;
  }
}

function verifierDirective(attempt: number): string {
  return [
    "Your completion is unverified — no evidence receipt was recorded.",
    `This is attempt ${attempt} of ${MAX_ATTEMPTS}.`,
    "Actually run the relevant checks (build/tests/commands), write the output and your",
    "judgement to a file under `.codexclaw/evidence/`, and make the LAST line of your reply",
    "exactly `EVIDENCE_RECORDED: <path>` pointing at that file. Do not claim done without it.",
    // The read-only trap, named at attempt 1 instead of after 3 confusing retries.
    "If you were dispatched READ-ONLY and cannot write there, say so plainly in your final",
    "message: your parent must re-dispatch you as an `explorer` (read-only lanes are not",
    "evidence-gated). Do not keep repeating the same answer — this budget is bounded.",
  ].join(" ");
}

export function escalationDirective(): string {
  return [
    `Evidence verification failed ${MAX_ATTEMPTS} times and is now fail-closed.`,
    "Do not claim completion. Record the actual validation under `.codexclaw/evidence/`",
    "and finish with `EVIDENCE_RECORDED: <path>`. If validation cannot run, record",
    "the blocker and diagnostics in that receipt so the parent can decide safely.",
  ].join(" ");
}

/**
 * The SubagentStop decision. Returns the codex hook stdout (a `{decision:"block",reason}`
 * JSON string to force the child to continue, or `""` to release). Total: never throws.
 */
export function runSubagentStopGate(payload: SubagentStopPayload): string {
  try {
    if (!GATED_AGENT_TYPES.has(payload.agent_type)) return "";
    const agentId = payload.agent_id ?? "";
    const { cwd, session_id: sessionId } = payload;
    // Same identity as a tombstone: two turns of one agent must not share a budget.
    const turnId = payload.turn_id ?? "";

    const receipt = extractReceiptPath(payload.last_assistant_message);
    if (receipt !== null && hasValidReceipt(cwd, receipt)) {
      clearAttempts(cwd, sessionId, agentId, turnId);
      // A late valid receipt resolves the verdict too: the work was eventually
      // verified, so the parent must not stay blocked on a stale tombstone.
      resolveTombstone(cwd, sessionId, payload);
      return "";
    }

    // EVIDENCE-TERMINAL-01: already terminal for this agent -> stay released.
    // Without this latch the 5th stop would re-enter the budget from zero, because
    // the cap branch deliberately does NOT clear the attempt counter.
    if (hasTombstone(cwd, sessionId, payload)) return "";

    const attempts = readAttempts(cwd, sessionId, agentId, turnId);
    if (attempts >= MAX_ATTEMPTS) {
      // Terminal: record the unresolved verdict for the parent, then release the
      // child. Even if nothing durable could be written we still release — a gate
      // that cannot record anything cannot honestly keep demanding anything, and an
      // unbounded block adds no safety when the child provably cannot comply.
      recordTombstone(cwd, sessionId, payload, attempts);
      return "";
    }

    const next = attempts + 1;
    if (!writeAttempts(cwd, sessionId, agentId, next, turnId)) {
      // The counter could not be persisted, so every future call would re-read 0 and
      // block forever. Terminate now instead of looping on unwritable state.
      recordTombstone(cwd, sessionId, payload, attempts);
      return "";
    }
    return JSON.stringify({ decision: "block", reason: verifierDirective(next) });
  } catch {
    // An internal error must not become an infinite block: the child cannot fix our
    // IO. Release and let the parent-side gate carry the verdict.
    try {
      recordTombstone(payload.cwd, payload.session_id, payload, MAX_ATTEMPTS);
    } catch {
      /* best-effort */
    }
    return "";
  }
}
