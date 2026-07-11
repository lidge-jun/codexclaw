/**
 * subagent-evidence.ts — SubagentStop evidence-receipt gate (lazygap_impl 010).
 *
 * A dispatched WRITE/verify subagent (agent_type "worker") cannot "finish" without a
 * non-empty evidence receipt under `.codexclaw/evidence/`. Missing/invalid receipt ->
 * `decision:"block"` with a verifier directive that re-prompts the CHILD (codex-rs
 * turn.rs:323). Bounded to MAX_ATTEMPTS, then fail-open release so it can never trap a
 * session. Every IO/parse failure also fails open (release).
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
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { STATE_DIR, sanitizeKey } from "./state.ts";
import { execFileSync } from "node:child_process";
import type { SubagentStopPayload } from "./hook.ts";

/**
 * agent_type values this gate refuses to release without a receipt.
 * DISPATCH-AGENT-TYPE-01: only "worker" is gated. Read-only audit/research
 * dispatches MUST use agent_type:"explorer" so they bypass both the hook
 * manifest matcher (^worker$) and this runtime gate. See
 * structure/20_pabcd_dispatch_doctrine.md §3.
 */
export const GATED_AGENT_TYPES = new Set<string>(["worker"]);

/** Bounded block budget per (session, agent) so the gate can never trap a session. */
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

function attemptsPath(cwd: string, sessionId: string, agentId: string): string {
  return join(
    cwd,
    STATE_DIR,
    EVIDENCE_ATTEMPTS_SUBDIR,
    `${sanitizeKey(sessionId)}-${sanitizeKey(agentId)}.json`,
  );
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

/**
 * DISPATCH-AGENT-TYPE-01 defense-in-depth: detect read-only task markers in
 * the child transcript via grep. The spawn message may sit 20KB+ into the
 * JSONL (system prompt content precedes it), so a fixed-offset head read
 * misses it. grep -qi with a combined ERE pattern exits on first match
 * without loading the file into the JS heap. FAIL-OPEN: any error returns
 * false (grep exit 1 = no match, exit 2 = error — both release the gate).
 */
const READ_ONLY_GREP_PATTERN = "read-only|readonly|chat-only deliverable|no file writes|do not write files|do not edit files|no evidence files|\\ud30c\\uc77c \\uc791\\uc131 \\uae08\\uc9c0|\u30d5\u30a1\u30a4\u30eb \u4f5c\u6210 \u7981\u6b62|\ud30c\uc77c \uc791\uc131 \uae08\uc9c0";

export function transcriptHasReadOnlyMarker(agentTranscriptPath: string | null | undefined): boolean {
  if (typeof agentTranscriptPath !== "string" || agentTranscriptPath === "") return false;
  try {
    execFileSync("grep", ["-qiE", READ_ONLY_GREP_PATTERN, agentTranscriptPath], {
      stdio: "ignore",
      timeout: 5000,
    });
    return true; // exit 0 = match found
  } catch {
    return false; // exit 1 (no match) or exit 2 (error) — fail-open
  }
}

export function readAttempts(cwd: string, sessionId: string, agentId: string): number {
  try {
    const p = attemptsPath(cwd, sessionId, agentId);
    if (!existsSync(p)) return 0;
    const parsed = JSON.parse(readFileSync(p, "utf8")) as unknown;
    if (parsed && typeof parsed === "object" && Number.isInteger((parsed as { attempts?: unknown }).attempts)) {
      return (parsed as { attempts: number }).attempts;
    }
    return 0;
  } catch {
    return 0;
  }
}

export function writeAttempts(cwd: string, sessionId: string, agentId: string, attempts: number): void {
  try {
    const p = attemptsPath(cwd, sessionId, agentId);
    mkdirSync(join(cwd, STATE_DIR, EVIDENCE_ATTEMPTS_SUBDIR), { recursive: true });
    const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, `${JSON.stringify({ attempts })}\n`);
    renameSync(tmp, p);
  } catch {
    /* fail open: a failed write just means the next attempt re-evaluates from disk. */
  }
}

export function clearAttempts(cwd: string, sessionId: string, agentId: string): void {
  try {
    rmSync(attemptsPath(cwd, sessionId, agentId), { force: true });
  } catch {
    /* best-effort */
  }
}

function verifierDirective(attempt: number): string {
  return [
    "Your completion is unverified — no evidence receipt was recorded.",
    `This is attempt ${attempt} of ${MAX_ATTEMPTS}.`,
    "Actually run the relevant checks (build/tests/commands), write the output and your",
    "judgement to a file under `.codexclaw/evidence/`, and make the LAST line of your reply",
    "exactly `EVIDENCE_RECORDED: <path>` pointing at that file. Do not claim done without it.",
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

    // DISPATCH-AGENT-TYPE-01 defense-in-depth: if the spawn message (in the
    // child transcript head) contains read-only markers, release without
    // demanding evidence — the task was never meant to produce files.
    if (transcriptHasReadOnlyMarker(payload.agent_transcript_path)) {
      clearAttempts(cwd, sessionId, agentId);
      return "";
    }

    // Compaction recovery: never pile on (read the CHILD transcript).
    if (transcriptHasContextPressure(payload.agent_transcript_path)) {
      clearAttempts(cwd, sessionId, agentId);
      return "";
    }

    const receipt = extractReceiptPath(payload.last_assistant_message);
    if (receipt !== null && hasValidReceipt(cwd, receipt)) {
      clearAttempts(cwd, sessionId, agentId);
      return "";
    }

    const attempts = readAttempts(cwd, sessionId, agentId);
    if (attempts >= MAX_ATTEMPTS) {
      // Bounded: stop blocking so the gate can never trap a session.
      clearAttempts(cwd, sessionId, agentId);
      return "";
    }

    const next = attempts + 1;
    writeAttempts(cwd, sessionId, agentId, next);
    return JSON.stringify({ decision: "block", reason: verifierDirective(next) });
  } catch {
    return "";
  }
}
