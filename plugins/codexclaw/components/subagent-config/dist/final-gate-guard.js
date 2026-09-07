/**
 * final-gate-guard.ts — early warning before a final-gate reviewer spawn (WP12 / plan 040).
 *
 * The C phase asks for tests and an independent review, but PreToolUse never
 * checked whether either had happened, so a final reviewer could be dispatched
 * against a tree nobody had tested.
 *
 * This is NOT the enforcement layer. It only fires when the packet carries the
 * [CXC-FINAL-GATE] marker, so omitting the marker skips it entirely. Missing
 * goal metadata retains the legacy fail-open behavior; an explicit source
 * resolution failure refuses the marked spawn. The layer that actually refuses is
 * validateGoalplan's v2 checks, which deny `update_goal complete` when the gate
 * is not approved. This one just says it earlier.
 *
 * Reads the goalplan projection locally. Source identity is loaded from the
 * sibling pabcd-state dist module so this guard and the enforcing final gate
 * use identical worktree resolution and dirty-content hashing in installed payloads.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { createRequire } from "node:module";
const nodeRequire = createRequire(import.meta.url);

export const FINAL_GATE_MARKER = "[CXC-FINAL-GATE]";






/** The subset of SourceIdentity this guard needs. */








/**
 * Same identity fields, in the same order, as compareSource in
 * pabcd-state/src/source-identity.ts. "unavailable" is checked first and is
 * never treated as an empty sha, so the two implementations cannot disagree.
 */
function compareIdentity(a                    , b                    )                                       {
  if (a.kind === "unavailable" || b.kind === "unavailable") return "unavailable";
  if (a.sourceRoot !== b.sourceRoot) return "different";
  if (a.commitSha !== b.commitSha) return "different";
  if (a.dirty !== b.dirty) return "different";
  if ((a.treeHash ?? "") !== (b.treeHash ?? "")) return "different";
  return "same";
}

/** Mirrors sanitizeKey in pabcd-state/src/state.ts:65. */
function sanitizeKey(value        )         {
  const sanitized = (value ?? "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized.length > 0 ? sanitized : "missing";
}

function readJson(path        )                                 {
  try {
    if (!existsSync(path)) return null;
    const parsed          = JSON.parse(readFileSync(path, "utf8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed                           )
      : null;
  } catch {
    return null;
  }
}

function readIdentity(raw         )                            {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw                           ;
  if (s.kind !== "resolved" && s.kind !== "unavailable") return null;
  if (typeof s.commitSha !== "string" || typeof s.dirty !== "boolean") return null;
  const id                     = { kind: s.kind, commitSha: s.commitSha, dirty: s.dirty };
  if (typeof s.treeHash === "string") id.treeHash = s.treeHash;
  if (s.sourceRoot !== undefined) {
    if (typeof s.sourceRoot !== "string" || !isAbsolute(s.sourceRoot)) return null;
    id.sourceRoot = s.sourceRoot;
  }
  return id;
}






function receiptIdentity(cwd        , rel        )                            {
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
  packetText        ,
  sessionId        ,
  cwd        ,
  captureIdentity                                      ,
)                 {
  try {
    if (!packetText.includes(FINAL_GATE_MARKER)) return { ok: true };
    if (!sessionId) return { ok: true };

    const state = readJson(join(cwd, ".codexclaw", "sessions", `${sanitizeKey(sessionId)}.json`));
    const slug = typeof state?.slug === "string" ? state.slug : "";
    if (!slug) return { ok: true };

    const plan = readJson(join(cwd, ".codexclaw", "goalplans", slug, "goalplan.json"));
    if (!plan) return { ok: true };
    const gate = typeof plan.finalGate === "object" && plan.finalGate !== null
      ? (plan.finalGate                           )
      : null;
    if (!gate) return { ok: true };

    // Whole plan, not the active work phase: the last D-close nulls the cursor
    // right when the gate matters, which would dissolve the QA requirement.
    const criteria = Array.isArray(plan.criteria) ? (plan.criteria                             ) : [];
    const qaRequired = criteria.some((c) => c?.surface === "web" || c?.surface === "tui");

    const slots                = [{ label: "test", path: gate.testReceiptPath }];
    if (qaRequired) slots.push({ label: "QA", path: gate.qaReceiptPath });

    const missing           = [];
    const stale           = [];
    let current                    ;
    try {
      // Both src/ and dist/ sit one level below the component root. Load shipped
      // dist explicitly: build's .ts -> .js rewrite cannot translate cross-src paths.
      const source = nodeRequire("../../pabcd-state/dist/session-source-identity.js")

       ;
      if (captureIdentity) {
        const binding = nodeRequire("../../pabcd-state/dist/session-source.js")

         ;
        const sourceCwd = binding.resolveSessionSource(cwd, sessionId);
        const captured = captureIdentity(sourceCwd);
        current = sourceCwd === cwd ? captured : { ...captured, sourceRoot: sourceCwd };
      } else current = source.captureSessionSourceIdentity(cwd, sessionId);
    } catch {
      return { ok: false, reason: "[codexclaw — final gate] SOURCE-ROOT: source identity is unavailable; inspect the binding and installed modules before review." };
    }

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
