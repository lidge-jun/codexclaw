/**
 * final-gate-guard.ts — early warning before a final-gate reviewer spawn (WP12 / plan 040).
 *
 * The C phase asks for tests and an independent review, but PreToolUse never
 * checked whether either had happened, so a final reviewer could be dispatched
 * against a tree nobody had tested.
 *
 * This is NOT the enforcement layer. It only fires when the packet carries the
 * [CXC-FINAL-GATE] marker, so omitting the marker skips it entirely, and every
 * broken link in the lookup chain fails open. The layer that actually refuses is
 * validateGoalplan's v2 checks, which deny `update_goal complete` when the gate
 * is not approved. This one just says it earlier.
 *
 * Reads the goalplan JSON directly rather than importing pabcd-state: the build
 * compiles each component's src into its own dist and only rewrites relative
 * specifiers (build.mjs:25-27, :42), so a cross-component source import would
 * resolve to a path that does not exist in the shipped dist. The cost is a
 * second copy of schema knowledge, which is why schema drift here fails open.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

export const FINAL_GATE_MARKER = "[CXC-FINAL-GATE]";

export interface FinalGateCheck {
  ok: boolean;
  reason?: string;
}

/** The subset of SourceIdentity this guard needs. */
export interface SourceIdentityLite {
  kind: "resolved" | "unavailable";
  commitSha: string;
  dirty: boolean;
  treeHash?: string;
}

/**
 * Same four branches, in the same order, as compareSource in
 * pabcd-state/src/source-identity.ts. "unavailable" is checked first and is
 * never treated as an empty sha, so the two implementations cannot disagree.
 */
function compareIdentity(a: SourceIdentityLite, b: SourceIdentityLite): "same" | "different" | "unavailable" {
  if (a.kind === "unavailable" || b.kind === "unavailable") return "unavailable";
  if (a.commitSha !== b.commitSha) return "different";
  if (a.dirty !== b.dirty) return "different";
  if ((a.treeHash ?? "") !== (b.treeHash ?? "")) return "different";
  return "same";
}

/** Mirrors sanitizeKey in pabcd-state/src/state.ts:65. */
function sanitizeKey(value: string): string {
  const sanitized = (value ?? "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized.length > 0 ? sanitized : "missing";
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    if (!existsSync(path)) return null;
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readIdentity(raw: unknown): SourceIdentityLite | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Record<string, unknown>;
  if (s.kind !== "resolved" && s.kind !== "unavailable") return null;
  if (typeof s.commitSha !== "string" || typeof s.dirty !== "boolean") return null;
  const id: SourceIdentityLite = { kind: s.kind, commitSha: s.commitSha, dirty: s.dirty };
  if (typeof s.treeHash === "string") id.treeHash = s.treeHash;
  return id;
}

function captureCurrentIdentity(cwd: string): SourceIdentityLite {
  // Deliberately minimal: this guard only needs to notice that the tree moved.
  // The authoritative capture lives in pabcd-state/src/source-identity.ts.
  try {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim();
    const status = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd, encoding: "utf8" });
    return { kind: "resolved", commitSha: sha, dirty: status.length > 0 };
  } catch {
    return { kind: "unavailable", commitSha: "", dirty: false };
  }
}

interface ReceiptSlot {
  label: string;
  path: unknown;
}

function receiptIdentity(cwd: string, rel: string): SourceIdentityLite | null {
  const abs = isAbsolute(rel) ? resolve(rel) : resolve(cwd, rel);
  try {
    if (!existsSync(abs) || !statSync(abs).isFile() || statSync(abs).size === 0) return null;
  } catch {
    return null;
  }
  const body = readJson(abs);
  return body ? readIdentity(body.sourceIdentity) : null;
}

/**
 * Check the prerequisites for a final-gate reviewer spawn.
 *
 * `captureIdentity` exists so tests can state what the current tree looks like.
 * A plain temp directory has no git, which lands on the unavailable branch and
 * allows everything, leaving the stale-receipt path unobservable otherwise.
 */
export function checkFinalGatePrereqs(
  packetText: string,
  sessionId: string,
  cwd: string,
  captureIdentity: (cwd: string) => SourceIdentityLite = captureCurrentIdentity,
): FinalGateCheck {
  try {
    if (!packetText.includes(FINAL_GATE_MARKER)) return { ok: true };
    if (!sessionId) return { ok: true };

    const state = readJson(join(cwd, ".codexclaw", "sessions", `${sanitizeKey(sessionId)}.json`));
    const slug = typeof state?.slug === "string" ? state.slug : "";
    if (!slug) return { ok: true };

    const plan = readJson(join(cwd, ".codexclaw", "goalplans", slug, "goalplan.json"));
    if (!plan) return { ok: true };
    const gate = typeof plan.finalGate === "object" && plan.finalGate !== null
      ? (plan.finalGate as Record<string, unknown>)
      : null;
    if (!gate) return { ok: true };

    // Whole plan, not the active work phase: the last D-close nulls the cursor
    // right when the gate matters, which would dissolve the QA requirement.
    const criteria = Array.isArray(plan.criteria) ? (plan.criteria as Record<string, unknown>[]) : [];
    const qaRequired = criteria.some((c) => c?.surface === "web" || c?.surface === "tui");

    const slots: ReceiptSlot[] = [{ label: "test", path: gate.testReceiptPath }];
    if (qaRequired) slots.push({ label: "QA", path: gate.qaReceiptPath });

    const missing: string[] = [];
    const stale: string[] = [];
    const current = captureIdentity(cwd);

    for (const slot of slots) {
      if (typeof slot.path !== "string" || slot.path.length === 0) {
        missing.push(`${slot.label} receipt path is not recorded in finalGate`);
        continue;
      }
      const identity = receiptIdentity(cwd, slot.path);
      if (!identity) {
        missing.push(`${slot.label} receipt is missing, empty or unreadable: ${slot.path}`);
        continue;
      }
      if (compareIdentity(identity, current) === "different") {
        stale.push(
          `${slot.label} receipt was produced against ${identity.commitSha.slice(0, 7)}${identity.dirty ? "+dirty" : ""}, but the tree is now ${current.commitSha.slice(0, 7)}${current.dirty ? "+dirty" : ""}`,
        );
      }
    }

    if (missing.length === 0 && stale.length === 0) return { ok: true };
    return {
      ok: false,
      reason: [
        "[codexclaw — final gate] This spawn is marked as the final gate, but its prerequisites are not in place:",
        ...missing.map((m) => `  - ${m}`),
        ...stale.map((s) => `  - ${s}`),
        "Run the checks, record their receipts under .codexclaw/evidence/, then dispatch the gate reviewer.",
      ].join("\n"),
    };
  } catch {
    return { ok: true }; // fail-open: an early warning must never trap a spawn
  }
}
