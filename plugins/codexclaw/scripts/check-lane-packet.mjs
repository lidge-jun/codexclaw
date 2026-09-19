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
 * Usage:
 *   node check-lane-packet.mjs <packet.json|packet-set.json> [--json]
 * A packet set is { "lanes": [ <packet>, ... ] } and is additionally checked for
 * overlapping write scopes. Exit 0 = valid, 1 = invalid or unreadable.
 */
import { readFileSync } from "node:fs";

const text = (v) => typeof v === "string" && v.trim().length > 0;
const list = (v) => Array.isArray(v) && v.length > 0 && v.every(text);
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Canonical thread ids are what every thread tool accepts; a provisional id is not one. */
const THREAD_ID = /^[A-Za-z0-9_-]+$/;
const HOST_ID = /^[A-Za-z0-9._:-]+$/;

/** Normalize a path prefix so "src" and "src/" compare as the same scope. */
const scopeKey = (p) => String(p).trim().replace(/^\.\//, "").replace(/\/+$/, "");

function overlaps(a, b) {
  const x = scopeKey(a), y = scopeKey(b);
  if (x === y) return true;
  return x.startsWith(y + "/") || y.startsWith(x + "/");
}

export function validateLanePacket(packet) {
  const errors = [];
  if (!object(packet)) return { ok: false, errors: ["packet must be a JSON object"], resolved: null };

  if (!text(packet.lane)) errors.push("lane is required: a packet with no lane id cannot be matched to a manifest entry");

  const address = packet.address;
  if (!object(address)) {
    errors.push("address is required: {threadId, hostId}");
  } else {
    if ("clientThreadId" in address)
      errors.push("address.clientThreadId is not an address: no tool accepts a provisional id and no API resolves it");
    if (!text(address.threadId) || !THREAD_ID.test(address.threadId.trim()))
      errors.push("address.threadId must be a canonical thread id matching [A-Za-z0-9_-]");
    if (!text(address.hostId) || !HOST_ID.test(address.hostId.trim()))
      errors.push("address.hostId must match [A-Za-z0-9._:-]");
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
    resolved: errors.length === 0 ? { lane: packet.lane.trim(), loop, merge, mergeTarget: merge ? authority.mergeTarget.trim() : null } : null,
  };
}

export function validateLanePacketSet(set) {
  if (!object(set) || !Array.isArray(set.lanes))
    return { ok: false, errors: ["packet set must be { lanes: [...] }"], lanes: 0 };
  const errors = [];
  const seen = new Map();
  set.lanes.forEach((packet, index) => {
    const result = validateLanePacket(packet);
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

const invoked = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (invoked) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const file = args.find((a) => !a.startsWith("--"));
  try {
    if (!file) throw new Error("usage: node check-lane-packet.mjs <packet.json> [--json]");
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    const result = Array.isArray(parsed?.lanes) ? validateLanePacketSet(parsed) : validateLanePacket(parsed);
    if (json) console.log(JSON.stringify(result, null, 2));
    else if (result.ok) console.log("[codexclaw lane-packet] OK");
    else console.error("[codexclaw lane-packet] FAIL\n" + result.errors.map((e) => "  - " + e).join("\n"));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error("[codexclaw lane-packet] " + error.message);
    process.exitCode = 1;
  }
}
