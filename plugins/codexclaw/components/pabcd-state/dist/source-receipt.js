/**
 * source-receipt.ts — source-bound evidence receipts (WP11 / plan 030).
 *
 * A final gate that only checks "a receipt file exists and is non-empty" cannot
 * tell whether the tree moved after the tests ran. These receipts carry the
 * SourceIdentity captured when the evidence was produced, so the gate can
 * compare it against the tree at completion time.
 *
 * Fail-closed: every rejection returns { error }, never a partially trusted
 * object and never a throw. Throwing would land in the caller's outer catch,
 * which fails open by design for genuinely unexpected errors.
 *
 * Honest limit: the receipt writer fills in its own sourceIdentity, so this
 * detects "the tree moved since the evidence was produced", not "the evidence
 * was really produced".
 */
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { hasValidReceipt } from "./subagent-evidence.js";






























export function isReceiptError(v                                   )                    {
  return "error" in v;
}

function parseIdentity(raw         )                        {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw                           ;
  if (s.kind !== "resolved" && s.kind !== "unavailable") return null;
  if (typeof s.commitSha !== "string") return null;
  if (typeof s.dirty !== "boolean") return null;
  const id                 = {
    kind: s.kind,
    commitSha: s.commitSha,
    dirty: s.dirty,
    capturedAt: typeof s.capturedAt === "string" ? s.capturedAt : new Date(0).toISOString(),
  };
  if (typeof s.treeHash === "string") id.treeHash = s.treeHash;
  return id;
}

/**
 * Read and validate a receipt.
 *
 * `expectedKind` is required rather than checked later by the caller: without
 * it a test receipt dropped at qaReceiptPath satisfies the QA requirement, and
 * a check that lives at the call site is a check that gets forgotten.
 *
 * The path guards (inside .codexclaw/evidence, not a symlink, realpath still
 * inside, a regular file, non-empty) are delegated to hasValidReceipt, which
 * already implements all five. It returns a bare boolean, so the five reasons
 * collapse into one message here — better than duplicating the guard to get
 * finer wording.
 */
export function parseSourceBoundReceipt(
  path        ,
  cwd        ,
  expectedKind             ,
)                                    {
  if (!path) return { error: "receipt path is empty" };
  if (!hasValidReceipt(cwd, path)) {
    return {
      error: `receipt failed the evidence-root guard (outside .codexclaw/evidence, symlink, not a regular file, or empty): ${path}`,
    };
  }
  const abs = isAbsolute(path) ? resolve(path) : resolve(cwd, path);
  let parsed         ;
  try {
    parsed = JSON.parse(readFileSync(abs, "utf8"));
  } catch (err) {
    return { error: `receipt is not valid JSON: ${path} (${err instanceof Error ? err.message : String(err)})` };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { error: `receipt must be a JSON object: ${path}` };
  }
  const r = parsed                           ;
  if (r.kind !== "test" && r.kind !== "qa") {
    return { error: `receipt kind must be "test" or "qa": ${path}` };
  }
  if (r.kind !== expectedKind) {
    return { error: `receipt kind mismatch: expected "${expectedKind}", found "${r.kind}" at ${path}` };
  }
  const sourceIdentity = parseIdentity(r.sourceIdentity);
  if (!sourceIdentity) {
    return { error: `receipt is missing a well-formed sourceIdentity: ${path}` };
  }
  const createdAtProvided = typeof r.createdAt === "string" && !Number.isNaN(Date.parse(r.createdAt));
  const receipt                     = {
    kind: r.kind,
    sourceIdentity,
    createdAt: createdAtProvided ? (r.createdAt          ) : new Date(0).toISOString(),
    createdAtProvided,
  };
  if (typeof r.command === "string") receipt.command = r.command;
  if (typeof r.exitCode === "number") receipt.exitCode = r.exitCode;
  // Preserved, never required: the C>D gate decides what to do about them.
  if (typeof r.ownerSessionId === "string") receipt.ownerSessionId = r.ownerSessionId;
  if (typeof r.checkEpoch === "string") receipt.checkEpoch = r.checkEpoch;
  return receipt;
}
