#!/usr/bin/env node
/**
 * check-lane-packet.mjs — validate the packet a coordinator hands a dispatched lane.
 *
 * A lane cannot read the coordinator's goalplan. The create_thread prompt is the entire
 * channel, so a missing field is not a formatting slip: it is a lane guessing. This
 * decides the cases that actually go wrong — a lane told to loop with no objective, a
 * lane claiming merge it was never granted, two lanes writing the same paths, and a
 * provisional clientThreadId used as an address.
 *
 * What this is not: authority. A packet that validates has not been approved by anyone,
 * and recording merge authority here does not grant it.
 *
 * A packet has two lives. Before dispatch it has no address, because creation has not
 * happened yet; after creation it is bound to a canonical threadId and hostId. Both are
 * validated, and the mode is explicit rather than inferred from what happens to be
 * missing.
 *
 * Usage:
 *   node check-lane-packet.mjs <packet.json|packet-set.json> [--mode dispatch|bound] [--json]
 * A packet set is { "lanes": [ <packet>, ... ] } and is additionally checked for
 * overlapping write scopes. Exit 0 = valid, 1 = invalid or unreadable.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const text = (v) => typeof v === "string" && v.trim().length > 0;
const list = (v) => Array.isArray(v) && v.length > 0 && v.every(text);
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Canonical thread ids are what every thread tool accepts; a provisional id is not one. */
const THREAD_ID = /^[A-Za-z0-9_-]+$/;
const HOST_ID = /^[A-Za-z0-9._:-]+$/;

/**
 * Normalize a scope so "src", "src/" and "a/../src" compare as the same path. Lexical
 * comparison alone lets an aliased path hide an overlap, which is the collision this is
 * supposed to catch.
 */
function scopeKey(p) {
  const raw = String(p).trim().replace(/\\/g, "/");
  const absolute = raw.startsWith("/");
  const out = [];
  for (const part of raw.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") { if (out.length) out.pop(); else out.push(".."); continue; }
    out.push(part);
  }
  return (absolute ? "/" : "") + out.join("/");
}

function overlaps(a, b) {
  const x = scopeKey(a), y = scopeKey(b);
  if (x === y) return true;
  return x.startsWith(y + "/") || y.startsWith(x + "/");
}

export function validateLanePacket(packet, { mode } = {}) {
  const errors = [];
  if (!object(packet)) return { ok: false, errors: ["packet must be a JSON object"], resolved: null };

  if (!text(packet.lane)) errors.push("lane is required: a packet with no lane id cannot be matched to a manifest entry");

  // Mode is declared, never inferred: "the address is missing" and "this packet has not
  // been dispatched yet" are different facts and must not be confused.
  const declared = text(packet.mode) ? packet.mode.trim() : null;
  const effective = mode ?? declared ?? (object(packet.address) ? "bound" : "dispatch");
  if (effective !== "dispatch" && effective !== "bound")
    errors.push('mode must be "dispatch" (pre-creation) or "bound" (after creation returned a canonical id)');

  const address = packet.address;
  if (effective === "dispatch") {
    if (object(address) && (text(address.threadId) || text(address.hostId)))
      errors.push("a dispatch packet carries no address: creation has not returned one yet");
  } else if (!object(address)) {
    errors.push("a bound packet requires address: {threadId, hostId}");
  } else {
    if ("clientThreadId" in address)
      errors.push("address.clientThreadId is not an address: no tool accepts a provisional id");
    if (!text(address.threadId) || !THREAD_ID.test(address.threadId.trim()))
      errors.push("address.threadId must be a canonical thread id matching [A-Za-z0-9_-]");
    if (!text(address.hostId) || !HOST_ID.test(address.hostId.trim()))
      errors.push("address.hostId must match [A-Za-z0-9._:-]");
    // A provisional id has no distinguishing shape, so the only reliable signal is the
    // one the caller recorded. If it was kept, it must not also be the address.
    if (text(address.provisionalId) && text(address.threadId) &&
        address.provisionalId.trim() === address.threadId.trim())
      errors.push("address.threadId repeats the recorded provisionalId: a queued id never becomes the canonical one by being copied");
  }

  const work = packet.work;
  if (!object(work)) {
    errors.push("work is required");
  } else {
    if (!list(work.writeScope)) errors.push("work.writeScope must list what this lane may write");
    if (!text(work.base)) errors.push("work.base is required: a lane that does not know its base ref cannot be rebased or compared");
    if (!text(work.branch)) errors.push("work.branch is required: the branch this lane owns");
  }

  const authority = object(packet.authority) ? packet.authority : {};
  const loop = authority.loop === true;
  const merge = authority.merge === true;
  if (authority.loop !== undefined && typeof authority.loop !== "boolean")
    errors.push("authority.loop must be a boolean when present");
  if (authority.merge !== undefined && typeof authority.merge !== "boolean")
    errors.push("authority.merge must be a boolean when present");

  if (loop && object(work)) {
    if (!text(work.objective)) errors.push("authority.loop requires work.objective: a loop without one is an instruction to invent a goal");
    if (!list(work.criteria)) errors.push("authority.loop requires work.criteria: without them the lane decides its own completion");
  }
  if (merge) {
    if (!text(authority.mergeTarget)) errors.push("authority.merge requires authority.mergeTarget naming the branch to land");
    else if (object(work) && text(work.branch) && authority.mergeTarget.trim() !== work.branch.trim())
      errors.push("authority.mergeTarget must be this lane's own branch; landing another lane's branch is never this lane's call");
  } else if (text(authority.mergeTarget)) {
    errors.push("authority.mergeTarget without authority.merge: a target is not a grant");
  }
  // Push and PR are described in the contract, so they are fields rather than folklore.
  for (const key of ["push", "openPr"])
    if (authority[key] !== undefined && typeof authority[key] !== "boolean")
      errors.push("authority." + key + " must be a boolean when present");
  const push = authority.push === true;
  const openPr = authority.openPr === true;
  if (openPr && !push) errors.push("authority.openPr without authority.push: a pull request needs a pushed branch");
  if (merge && !push) errors.push("authority.merge without authority.push: a lane that cannot push cannot land its branch");

  const reporting = packet.reporting;
  if (!object(reporting)) {
    errors.push("reporting is required: {evidence, onBlocked}");
  } else {
    if (!list(reporting.evidence)) errors.push("reporting.evidence must name what comes back; an empty list claims nothing needs to");
    if (!text(reporting.onBlocked)) errors.push("reporting.onBlocked is required: a blocked lane must know what to do instead of guessing");
  }

  return {
    ok: errors.length === 0,
    errors,
    // Defaults are made explicit so a reader never has to infer them from absence.
    resolved: errors.length === 0
      ? { lane: packet.lane.trim(), mode: effective, loop, push, openPr, merge, mergeTarget: merge ? authority.mergeTarget.trim() : null }
      : null,
  };
}

export function validateLanePacketSet(set, options = {}) {
  if (!object(set) || !Array.isArray(set.lanes))
    return { ok: false, errors: ["packet set must be { lanes: [...] }"], lanes: 0 };
  const errors = [];
  const seen = new Map();
  set.lanes.forEach((packet, index) => {
    const result = validateLanePacket(packet, options);
    for (const error of result.errors) errors.push("lanes[" + index + "]: " + error);
    if (!result.ok) return;
    const lane = packet.lane.trim();
    if (seen.has(lane)) errors.push("duplicate lane id: " + lane);
    const branch = packet.work.branch.trim();
    for (const [otherLane, other] of seen) {
      if (other.branch === branch) errors.push("lanes " + otherLane + " and " + lane + " claim the same branch: " + branch);
      for (const mine of packet.work.writeScope)
        for (const theirs of other.writeScope)
          if (overlaps(mine, theirs))
            errors.push("write scopes overlap between " + otherLane + " and " + lane + ": " + scopeKey(theirs) + " vs " + scopeKey(mine));
    }
    seen.set(lane, { branch, writeScope: packet.work.writeScope });
  });
  return { ok: errors.length === 0, errors, lanes: set.lanes.length };
}

// Windows argv carries backslashes, so comparing basenames split on "/" silently decides
// the CLI was never invoked and the process exits 0 with no output. Compare URLs instead.
const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const file = args.find((a) => !a.startsWith("--"));
  try {
    if (!file) throw new Error("usage: node check-lane-packet.mjs <packet.json> [--mode dispatch|bound] [--json]");
    const modeIndex = args.indexOf("--mode");
    const mode = modeIndex === -1 ? undefined : args[modeIndex + 1];
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    const result = Array.isArray(parsed?.lanes) ? validateLanePacketSet(parsed, { mode }) : validateLanePacket(parsed, { mode });
    if (json) console.log(JSON.stringify(result, null, 2));
    else if (result.ok) console.log("[codexclaw lane-packet] OK");
    else console.error("[codexclaw lane-packet] FAIL\n" + result.errors.map((e) => "  - " + e).join("\n"));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error("[codexclaw lane-packet] " + error.message);
    process.exitCode = 1;
  }
}
