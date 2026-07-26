#!/usr/bin/env node
// validate-evidence — check QA verdict files and emit the aggregate receipt (WP13 / plan 070).
//
// Zero dependencies, no image decoding. PNG dimensions come from the IHDR chunk,
// which sits at a fixed offset, so no decoder is needed and none is vendored.
//
// The checks are surface-aware on purpose: verdict.json is shared by http, cli,
// tui, web and gui, and only the last two produce raster captures. Demanding PNG
// integrity from a curl transcript would fail three surfaces that are working
// correctly.
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const VISUAL_SURFACES = new Set(["web", "gui"]);
const CAPTURE_CHECK_KEYS = ["signature", "nonEmpty", "dimensionsMatch", "composited"];

/**
 * `new Date("2026")` parses fine, so the shape is checked too — a bare year is
 * not a capture time.
 */
function isRfc3339(value) {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function identityErrors(id, label) {
  const out = [];
  if (typeof id !== "object" || id === null || Array.isArray(id)) {
    return [`${label} must be an object`];
  }
  if (id.kind !== "resolved" && id.kind !== "unavailable") out.push(`${label}.kind must be "resolved" or "unavailable"`);
  if (typeof id.commitSha !== "string") out.push(`${label}.commitSha must be a string`);
  if (typeof id.dirty !== "boolean") out.push(`${label}.dirty must be a boolean`);
  if (!isRfc3339(id.capturedAt)) out.push(`${label}.capturedAt must be an RFC3339 timestamp`);
  if (id.treeHash !== undefined && typeof id.treeHash !== "string") out.push(`${label}.treeHash must be a string when present`);
  return out;
}

/**
 * Same fields, same order, as compareSource in
 * pabcd-state/src/source-identity.ts. capturedAt is deliberately excluded:
 * capturing the identity once per scenario is normal, and each call stamps a
 * fresh time, so comparing it would reject QA runs that never left the tree.
 */
function sameTree(a, b) {
  if (a.kind !== b.kind) return false;
  if (a.commitSha !== b.commitSha) return false;
  if (a.dirty !== b.dirty) return false;
  return (a.treeHash ?? "") === (b.treeHash ?? "");
}

function captureCheckErrors(checks) {
  if (typeof checks !== "object" || checks === null || Array.isArray(checks)) {
    return ["captureChecks must be an object on a web/gui verdict"];
  }
  const out = [];
  for (const key of CAPTURE_CHECK_KEYS) {
    if (!(key in checks)) {
      out.push(`captureChecks.${key} is missing — an absent check is not a passed check`);
    } else if (typeof checks[key] !== "boolean") {
      out.push(`captureChecks.${key} must be a boolean, found ${typeof checks[key]}`);
    } else if (checks[key] !== true) {
      out.push(`captureChecks.${key} is false — that is a failed capture, not evidence`);
    }
  }
  return out;
}

/** Width and height from the IHDR chunk; no decoding involved. */
function pngDimensions(buf) {
  if (buf.length < 24) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function artifactErrors(baseDir, verdict, notes) {
  const out = [];
  const refs = Array.isArray(verdict.artifactRefs) ? verdict.artifactRefs : [];
  const visual = VISUAL_SURFACES.has(verdict.surface);
  for (const ref of refs) {
    if (typeof ref !== "string" || ref.length === 0) {
      out.push("artifactRefs contains a non-string entry");
      continue;
    }
    const abs = resolve(baseDir, ref);
    if (!existsSync(abs)) {
      out.push(`artifact is missing: ${ref}`);
      continue;
    }
    let st;
    try {
      st = statSync(abs);
    } catch (err) {
      out.push(`artifact could not be read: ${ref} (${err.message})`);
      continue;
    }
    if (!st.isFile() || st.size === 0) {
      out.push(`artifact is empty or not a regular file: ${ref}`);
      continue;
    }
    // PNG integrity applies to raster captures only, and only to files that
    // claim to be PNGs — a web run may also attach a HAR or a console log.
    if (!visual || !ref.toLowerCase().endsWith(".png")) continue;
    const head = readFileSync(abs);
    if (!head.subarray(0, 8).equals(PNG_MAGIC)) {
      out.push(`artifact is named .png but does not carry the PNG signature: ${ref}`);
      continue;
    }
    const dims = pngDimensions(head);
    if (dims) {
      // Reported, not judged: the requested viewport is not in the schema, so
      // this script cannot decide whether the size is the intended one.
      notes.push(`${ref}: ${dims.width}x${dims.height}`);
    }
  }
  return out;
}

function checkVerdictFile(path) {
  const errors = [];
  const notes = [];
  let verdict;
  try {
    verdict = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    return { errors: [`${path}: not valid JSON (${err.message})`], notes, identity: null };
  }
  if (typeof verdict !== "object" || verdict === null || Array.isArray(verdict)) {
    return { errors: [`${path}: must be a JSON object`], notes, identity: null };
  }

  if (!isRfc3339(verdict.capturedAt)) errors.push("capturedAt must be an RFC3339 timestamp");
  errors.push(...identityErrors(verdict.sourceSnapshotAt, "sourceSnapshotAt"));
  if (VISUAL_SURFACES.has(verdict.surface)) errors.push(...captureCheckErrors(verdict.captureChecks));
  errors.push(...artifactErrors(dirname(path), verdict, notes));

  return {
    errors: errors.map((e) => `${path}: ${e}`),
    notes: notes.map((n) => `${path}: ${n}`),
    identity: errors.length === 0 ? verdict.sourceSnapshotAt : null,
  };
}

function findVerdictFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name === "verdict.json") out.push(full);
    }
  };
  walk(root);
  return out.sort();
}

/** `.codexclaw/evidence/<sessionId>/qa/` -> `.codexclaw/evidence/<sessionId>/`. */
function receiptPathFor(qaDir) {
  const resolved = resolve(qaDir);
  return join(basename(resolved) === "qa" ? dirname(resolved) : resolved, "qa-receipt.json");
}

export function validateEvidence(qaDir, { emitReceipt = false, now = () => new Date().toISOString() } = {}) {
  const errors = [];
  const notes = [];
  const receiptPath = receiptPathFor(qaDir);

  // Delete first: a receipt from an earlier passing run would otherwise survive
  // this failing one, and the final gate only re-checks the tree, not the QA.
  if (emitReceipt && existsSync(receiptPath)) {
    try {
      rmSync(receiptPath);
    } catch (err) {
      errors.push(`could not clear the previous receipt at ${receiptPath}: ${err.message}`);
    }
  }

  if (!existsSync(qaDir)) {
    return { ok: false, errors: [`evidence directory does not exist: ${qaDir}`], notes, receiptPath: null };
  }

  const files = findVerdictFiles(qaDir);
  if (files.length === 0) {
    return { ok: false, errors: [`no verdict.json found under ${qaDir}`], notes, receiptPath: null };
  }

  const identities = [];
  for (const file of files) {
    const result = checkVerdictFile(file);
    errors.push(...result.errors);
    notes.push(...result.notes);
    if (result.identity) identities.push({ file, identity: result.identity });
  }

  if (identities.length > 1) {
    const [first, ...rest] = identities;
    for (const other of rest) {
      if (!sameTree(first.identity, other.identity)) {
        errors.push(
          `${other.file}: describes a different tree than ${first.file} — these scenarios were not run against the same source`,
        );
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors, notes, receiptPath: null };

  if (!emitReceipt) return { ok: true, errors, notes, receiptPath: null };

  writeFileSync(
    receiptPath,
    `${JSON.stringify(
      {
        kind: "qa",
        sourceIdentity: identities[0].identity,
        command: "validate-evidence.mjs --emit-receipt",
        exitCode: 0,
        createdAt: now(),
      },
      null,
      2,
    )}\n`,
  );
  return { ok: true, errors, notes, receiptPath };
}

const isDirect = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isDirect) {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir) {
    console.error("usage: validate-evidence.mjs <.codexclaw/evidence/<sessionId>/qa/> [--emit-receipt]");
    process.exit(2);
  }
  const result = validateEvidence(dir, { emitReceipt: args.includes("--emit-receipt") });
  for (const note of result.notes) console.log(`  ${note}`);
  if (!result.ok) {
    console.error(`[qa evidence] FAIL (${result.errors.length}):`);
    for (const e of result.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(result.receiptPath ? `[qa evidence] OK — receipt written to ${result.receiptPath}` : "[qa evidence] OK");
}
