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
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, basename, dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const VISUAL_SURFACES = new Set(["web", "gui"]);
const CAPTURE_CHECK_KEYS = ["signature", "nonEmpty", "dimensionsMatch", "composited"];
const ARTIFACT_IDENTITY_FILE = "artifact-identity.json";
const SHA256 = /^[0-9a-f]{64}$/;
const SIGNING_MODES = new Set(["ad-hoc", "Developer ID"]);
const COMPONENT_KINDS = new Set(["app", "executable", "sidecar", "extension", "archive", "dmg", "updater"]);
const REQUIRED_COMPONENT_KINDS = new Set(["app", "executable", "archive", "dmg", "updater"]);
const ARCHITECTURE_KINDS = new Set(["executable", "sidecar", "extension"]);
const DIGEST_KINDS = COMPONENT_KINDS;

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function sha256Tree(root) {
  const rootReal = realpathSync(root);
  const hash = createHash("sha256");
  const walk = (dir, rel) => {
    const names = readdirSync(dir).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const name of names) {
      const abs = join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) {
        const target = readlinkSync(abs);
        const resolved = realpathSync(abs);
        if (resolved !== rootReal && !resolved.startsWith(rootReal + sep)) {
          throw new Error(`bundle symlink escapes the bundle: ${relPath}`);
        }
        hash.update(`L\0${relPath}\0${target}\n`);
      } else if (st.isDirectory()) {
        hash.update(`D\0${relPath}\n`);
        walk(abs, relPath);
      } else if (st.isFile()) {
        hash.update(`F\0${relPath}\0${sha256File(abs)}\n`);
      } else {
        hash.update(`O\0${relPath}\n`);
      }
    }
  };
  walk(root, "");
  return hash.digest("hex");
}

function validCriterionIds(ids) {
  return Array.isArray(ids) && ids.length > 0
    && ids.every((id) => typeof id === "string" && /^c-[1-9]\d*$/.test(id))
    && new Set(ids).size === ids.length;
}

function artifactIdentityErrors(identity, label, scenario) {
  const out = [];
  const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;
  if (!record(identity)) return [`${label} must be an object`];
  if (identity.version !== 1) out.push(`${label}.version must be 1`);
  if (identity.bundleIdentifier !== undefined && !nonEmpty(identity.bundleIdentifier)) out.push(`${label}.bundleIdentifier must be a non-empty string when present`);
  if (!nonEmpty(identity.bundlePath)) out.push(`${label}.bundlePath must be a non-empty path`);
  if (!nonEmpty(identity.bundleExecutable)) out.push(`${label}.bundleExecutable must be the CFBundleExecutable value`);
  if (!Array.isArray(identity.coveredRowIds) || identity.coveredRowIds.length === 0) {
    out.push(`${label}.coveredRowIds must be a non-empty array`);
  } else {
    if (!/^D-[A-Z0-9-]+$/.test(scenario)) out.push(`${label}: scenario must be a desktop row id`);
    if (!identity.coveredRowIds.includes(scenario)) out.push(`${label}.coveredRowIds must include scenario ${scenario}`);
    if (identity.coveredRowIds.some((id) => typeof id !== "string" || !/^D-[A-Z0-9-]+$/.test(id))) out.push(`${label}.coveredRowIds contains an invalid desktop row id`);
  }
  if (!Array.isArray(identity.components) || identity.components.length === 0) {
    out.push(`${label}.components must be a non-empty array`);
  } else {
    const seenKinds = new Set();
    const seenIds = new Set();
    for (const [i, component] of identity.components.entries()) {
      const p = `${label}.components[${i}]`;
      if (!record(component)) { out.push(`${p} must be an object`); continue; }
      if (!nonEmpty(component.id)) out.push(`${p}.id is required`);
      else if (seenIds.has(component.id)) out.push(`${p}.id is duplicated`);
      else seenIds.add(component.id);
      if (!COMPONENT_KINDS.has(component.kind)) out.push(`${p}.kind is invalid`);
      else {
        if (REQUIRED_COMPONENT_KINDS.has(component.kind) && seenKinds.has(component.kind)) out.push(`${label}.components must contain exactly one ${component.kind} record`);
        seenKinds.add(component.kind);
      }
      if (component.applicable === false) {
        if (!nonEmpty(component.reason)) out.push(`${p}.reason is required when applicable is false`);
        continue;
      }
      if (component.applicable !== undefined && component.applicable !== true) out.push(`${p}.applicable must be true or false`);
      if (!nonEmpty(component.path)) out.push(`${p}.path is required`);
      if (ARCHITECTURE_KINDS.has(component.kind)
        && (!Array.isArray(component.architectures) || component.architectures.length === 0 || component.architectures.some((arch) => !nonEmpty(arch)))) {
        out.push(`${p}.architectures must be a non-empty string array`);
      }
      if (DIGEST_KINDS.has(component.kind) && (typeof component.sha256 !== "string" || !SHA256.test(component.sha256))) {
        out.push(`${p}.sha256 must be a lowercase SHA-256 digest`);
      }
    }
    for (const kind of REQUIRED_COMPONENT_KINDS) if (!seenKinds.has(kind)) out.push(`${label}.components must include ${kind}`);
    const app = identity.components.find((component) => component?.kind === "app");
    if (app?.applicable !== false) {
      for (const kind of ["archive", "executable"]) {
        if (!identity.components.some((component) => component?.kind === kind && component.applicable !== false)) out.push(`${label}.components requires an applicable ${kind} to bind the app`);
      }
    }
  }
  if (!record(identity.signing) || !SIGNING_MODES.has(identity.signing.mode)) out.push(`${label}.signing.mode must be ad-hoc or Developer ID`);
  else if (identity.signing.mode === "Developer ID") {
    if (!nonEmpty(identity.signing.teamId)) out.push(`${label}.signing.teamId is required for Developer ID`);
  } else if (identity.signing.teamId !== undefined && identity.signing.teamId !== null) out.push(`${label}.signing.teamId must be absent or null for ad-hoc signing`);
  if (!record(identity.signing?.entitlements)) out.push(`${label}.signing.entitlements must be an object`);
  else for (const [key, value] of Object.entries(identity.signing.entitlements)) {
    const valid = typeof value === "boolean" || typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) || (Array.isArray(value) && value.every((item) => typeof item === "string"));
    if (!nonEmpty(key) || !valid) out.push(`${label}.signing.entitlements has an invalid value for ${key}`);
  }
  if (!record(identity.toolchain)) out.push(`${label}.toolchain is required`);
  else {
    for (const key of ["xcodeSelectPath", "sdk", "swiftcVersion"]) if (!nonEmpty(identity.toolchain[key])) out.push(`${label}.toolchain.${key} is required`);
    for (const key of ["rustVersion", "bunVersion"]) if (identity.toolchain[key] !== undefined && !nonEmpty(identity.toolchain[key])) out.push(`${label}.toolchain.${key} must be a non-empty string when present`);
  }
  return out;
}

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
  if (id.sourceRoot !== undefined && (typeof id.sourceRoot !== "string" || !isAbsolute(id.sourceRoot))) out.push(`${label}.sourceRoot must be an absolute path when present`);
  return out;
}

/**
 * Same fields, same order, as compareSource in
 * pabcd-state/src/source-identity.ts. capturedAt is deliberately excluded:
 * capturing the identity once per scenario is normal, and each call stamps a
 * fresh time, so comparing it would reject QA runs that never left the tree.
 */
function sameTree(a, b) {
  if (a.sourceRoot !== b.sourceRoot) return false;
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
  const errors = [];
  const identityPaths = [];
  const refs = Array.isArray(verdict.artifactRefs) ? verdict.artifactRefs : [];
  const visual = VISUAL_SURFACES.has(verdict.surface);
  let identityCount = 0;
  for (const ref of refs) {
    if (typeof ref !== "string" || ref.length === 0) {
      errors.push("artifactRefs contains a non-string entry");
      continue;
    }
    const abs = resolve(baseDir, ref);
    if (!existsSync(abs)) {
      errors.push(`artifact is missing: ${ref}`);
      continue;
    }
    let st;
    try {
      st = statSync(abs);
    } catch (err) {
      errors.push(`artifact could not be read: ${ref} (${err.message})`);
      continue;
    }
    if (!st.isFile() || st.size === 0) {
      errors.push(`artifact is empty or not a regular file: ${ref}`);
      continue;
    }
    if (visual && ref.toLowerCase().endsWith(".png")) {
      let head;
      try { head = readFileSync(abs); }
      catch (err) { errors.push(`artifact could not be read: ${ref} (${err.message})`); continue; }
      if (!head.subarray(0, 8).equals(PNG_MAGIC)) errors.push(`artifact is named .png but does not carry the PNG signature: ${ref}`);
      else {
        const dims = pngDimensions(head);
        if (dims) notes.push(`${ref}: ${dims.width}x${dims.height}`);
      }
    }
    if (basename(ref) !== ARTIFACT_IDENTITY_FILE) continue;
    identityCount++;
    identityPaths.push({ path: abs, criterionIds: verdict.desktopArtifact === true ? verdict.criterionIds : undefined });
    let identity;
    try { identity = JSON.parse(readFileSync(abs, "utf8")); }
    catch (err) { errors.push(`${ref}: artifact identity is not valid JSON (${err.message})`); continue; }
    errors.push(...artifactIdentityErrors(identity, ref, verdict.scenario));
    const components = Array.isArray(identity?.components) ? identity.components : [];
    const app = components.find((component) => component?.kind === "app" && component.applicable !== false);
    const executable = components.find((component) => component?.kind === "executable" && component.applicable !== false);
    if (app && app.path !== identity.bundlePath) errors.push(`${ref}: app path must equal bundlePath`);
    if (app && executable && typeof app.path === "string" && typeof executable.path === "string"
      && typeof identity.bundleExecutable === "string"
      && resolve(baseDir, executable.path) !== resolve(baseDir, app.path, "Contents/MacOS", identity.bundleExecutable)) {
      errors.push(`${ref}: executable path must be derived from bundlePath and bundleExecutable`);
    }
    for (const component of components) {
      if (component?.applicable === false || typeof component?.path !== "string") continue;
      const componentPath = resolve(baseDir, component.path);
      if (!existsSync(componentPath)) { errors.push(`${ref}: component is missing: ${component.path}`); continue; }
      let componentStat;
      try { componentStat = statSync(componentPath); }
      catch (err) { errors.push(`${ref}: component could not be read: ${component.path} (${err.message})`); continue; }
      if (component.kind === "app") {
        const plist = resolve(componentPath, "Contents/Info.plist");
        let plistIsFile = false;
        let appIsLink = true;
        try { plistIsFile = statSync(plist).isFile(); } catch { /* reported below */ }
        try { appIsLink = lstatSync(componentPath).isSymbolicLink(); } catch { /* reported below */ }
        if (!component.path.endsWith(".app") || !componentStat.isDirectory() || appIsLink || !plistIsFile) {
          errors.push(`${ref}: app must be a directory containing Contents/Info.plist: ${component.path}`);
        } else {
          try {
            if (sha256Tree(componentPath) !== component.sha256) errors.push(`${ref}: app bundle tree digest does not match: ${component.path}`);
          } catch (err) { errors.push(`${ref}: app bundle could not be digested: ${err.message}`); }
        }
        continue;
      }
      if (!componentStat.isFile() || componentStat.size === 0) {
        errors.push(`${ref}: component is empty or not a regular file: ${component.path}`);
        continue;
      }
      try {
        if (DIGEST_KINDS.has(component.kind) && sha256File(componentPath) !== component.sha256) errors.push(`${ref}: component digest does not match: ${component.path}`);
      } catch (err) { errors.push(`${ref}: component could not be digested: ${component.path} (${err.message})`); }
    }
  }
  const desktopArtifact = verdict.desktopArtifact === true;
  if (desktopArtifact && (!/^D-[A-Z0-9-]+$/.test(verdict.scenario) || identityCount !== 1)) {
    errors.push(`${verdict.scenario}: desktop artifact verdict requires exactly one artifact-identity.json reference and a desktop row id`);
  }
  if (desktopArtifact && !validCriterionIds(verdict.criterionIds)) errors.push(`${verdict.scenario}: desktop artifact verdict requires unique criterionIds such as c-3`);
  return { errors, notes, identityPaths, desktopArtifact };
}

function checkVerdictFile(path) {
  const errors = [];
  const notes = [];
  let verdict;
  try {
    verdict = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    return { errors: [`${path}: not valid JSON (${err.message})`], notes, identity: null, identityPaths: [], criterionIds: undefined };
  }
  if (typeof verdict !== "object" || verdict === null || Array.isArray(verdict)) {
    return { errors: [`${path}: must be a JSON object`], notes, identity: null, identityPaths: [], criterionIds: undefined };
  }

  if (!isRfc3339(verdict.capturedAt)) errors.push("capturedAt must be an RFC3339 timestamp");
  errors.push(...identityErrors(verdict.sourceSnapshotAt, "sourceSnapshotAt"));
  if (VISUAL_SURFACES.has(verdict.surface)) errors.push(...captureCheckErrors(verdict.captureChecks));
  const artifacts = artifactErrors(dirname(path), verdict, notes);
  errors.push(...artifacts.errors);

  return {
    errors: errors.map((e) => `${path}: ${e}`),
    notes: notes.map((n) => `${path}: ${n}`),
    identity: errors.length === 0 ? verdict.sourceSnapshotAt : null,
    identityPaths: errors.length === 0 ? artifacts.identityPaths : [],
    desktopArtifact: artifacts.desktopArtifact,
    criterionIds: errors.length === 0 && artifacts.desktopArtifact ? verdict.criterionIds : undefined,
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
  const manifestFiles = [];
  for (const file of files) {
    const result = checkVerdictFile(file);
    errors.push(...result.errors);
    notes.push(...result.notes);
    if (result.identity) {
      identities.push({ file, identity: result.identity });
      manifestFiles.push({ path: file, kind: "verdict", criterionIds: result.criterionIds });
      for (const entry of result.identityPaths) manifestFiles.push({ ...entry, kind: "artifact-identity" });
    }
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

  let artifactManifest;
  try {
    artifactManifest = manifestFiles.map(({ path, kind, criterionIds }) => ({
      path: relative(dirname(receiptPath), path),
      sha256: sha256File(path),
      kind,
      ...(criterionIds === undefined ? {} : { criterionIds }),
    }));
  } catch (err) {
    return { ok: false, errors: [`could not digest QA manifest: ${err.message}`], notes, receiptPath: null };
  }

  writeFileSync(
    receiptPath,
    `${JSON.stringify(
      {
        kind: "qa",
        sourceIdentity: identities[0].identity,
        command: "validate-evidence.mjs --emit-receipt",
        exitCode: 0,
        createdAt: now(),
        artifactManifest,
      },
      null,
      2,
    )}\n`,
  );
  return { ok: true, errors, notes, receiptPath };
}

// pathToFileURL rather than a "file://" + path concatenation: on Windows the real
// URL is file:///D:/..., so the naive form never matches and the CLI silently does
// nothing when run directly.
const isDirect = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) {
  const args = process.argv.slice(2);
  if (args[0] === "--bundle-digest") {
    if (args.length !== 2) { console.error("usage: validate-evidence.mjs --bundle-digest <path.app>"); process.exit(2); }
    try { console.log(sha256Tree(args[1])); }
    catch (err) { console.error(`[qa evidence] bundle digest failed: ${err.message}`); process.exit(1); }
    process.exit(0);
  }
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
