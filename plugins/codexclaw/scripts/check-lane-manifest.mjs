#!/usr/bin/env node
/**
 * check-lane-manifest.mjs — validate a parallel-lane manifest (issue #184).
 *
 * Parallel worktree lanes are independent Codex tasks. Each owns its own checkout and
 * branch, and nothing in the system knows that two of them were handed the same issue
 * until their pull requests collide. The manifest is the shared record that makes that
 * visible BEFORE the branches diverge.
 *
 * What this is not: a lock. It reads a file. It cannot know whether a lane is still
 * running, whether a recorded head is current, or whether CI evidence is fresh. Recording
 * an owner does not authorize anyone to rewrite that lane's branch or message its task.
 * Treat a pass as "these records are coherent", never as "it is safe to merge".
 *
 * Usage:
 *   node check-lane-manifest.mjs <manifest.json> [--json]
 * Exit 0 = valid, 1 = invalid or unreadable.
 */
import { readFileSync } from "node:fs";

const ACTIVE = new Set(["planned", "running", "review", "blocked"]);

/** An issue reference must name its repository: "42" is ambiguous across lanes. */
function issueKey(issue) {
  if (typeof issue !== "string") return null;
  return /^[^/\s]+\/[^/\s#]+#\d+$/.test(issue.trim()) ? issue.trim() : null;
}

export function validateLaneManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { ok: false, errors: ["manifest must be a JSON object"], lanes: 0 };
  }
  const repo = typeof manifest.repository === "string" ? manifest.repository.trim() : "";
  if (!repo) errors.push("repository is required, so a manifest cannot be read against the wrong checkout");

  const lanes = Array.isArray(manifest.lanes) ? manifest.lanes : null;
  if (!lanes) return { ok: false, errors: errors.concat("lanes must be an array"), lanes: 0 };

  const seenIds = new Set();
  const seenBranches = new Map();
  /** issueKey -> [{ id, scope }] for ACTIVE lanes only; a finished lane cannot collide. */
  const claims = new Map();

  lanes.forEach((lane, i) => {
    const at = "lanes[" + i + "]";
    if (!lane || typeof lane !== "object") {
      errors.push(at + " must be an object");
      return;
    }
    const id = typeof lane.id === "string" ? lane.id.trim() : "";
    if (!id) errors.push(at + ".id is required");
    else if (seenIds.has(id)) errors.push(at + ".id duplicates an earlier lane: " + id);
    else seenIds.add(id);

    // Identity: which task, on which host, in which checkout.
    for (const field of ["taskId", "hostId", "worktree", "branch", "owner"]) {
      if (typeof lane[field] !== "string" || !lane[field].trim()) errors.push(at + "." + field + " is required");
    }
    // Git position: base and head. Without both, a reviewer cannot tell what a lane
    // actually contains, and "rebase onto the integration ref" has no meaning.
    const base = lane.base && typeof lane.base === "object" ? lane.base : null;
    if (!base || typeof base.ref !== "string" || !base.ref.trim()) errors.push(at + ".base.ref is required");
    if (!base || typeof base.sha !== "string" || !/^[0-9a-f]{7,40}$/i.test(String(base.sha ?? ""))) {
      errors.push(at + ".base.sha is required and must be a commit sha");
    }
    if (typeof lane.head !== "string" || !/^[0-9a-f]{7,40}$/i.test(lane.head ?? "")) {
      errors.push(at + ".head is required and must be a commit sha");
    }

    const status = typeof lane.status === "string" ? lane.status.trim() : "";
    if (!status) errors.push(at + ".status is required");

    const branch = typeof lane.branch === "string" ? lane.branch.trim() : "";
    if (branch) {
      const prev = seenBranches.get(branch);
      if (prev !== undefined) errors.push(at + ".branch is already claimed by lane " + prev + ": " + branch);
      else seenBranches.set(branch, id || String(i));
    }

    const issue = issueKey(lane.issue);
    if (lane.issue !== undefined && issue === null) {
      errors.push(at + '.issue must be repository-qualified, for example "owner/repo#42"');
    }
    if (issue && ACTIVE.has(status)) {
      const scope = typeof lane.scope === "string" ? lane.scope.trim() : "";
      const prior = claims.get(issue) ?? [];
      // Two lanes MAY share an issue, but only if each says which part it owns, and
      // the parts differ. Silence means both think they own all of it.
      for (const other of prior) {
        if (!scope || !other.scope) {
          errors.push(
            at + " shares " + issue + " with lane " + other.id +
              " and at least one has no scope; partition it explicitly or give one lane the issue",
          );
        } else if (scope === other.scope) {
          errors.push(at + " shares " + issue + " and scope " + JSON.stringify(scope) + " with lane " + other.id);
        }
      }
      prior.push({ id: id || String(i), scope });
      claims.set(issue, prior);
    }
  });

  return { ok: errors.length === 0, errors, lanes: lanes.length };
}

function main(argv) {
  const args = argv.filter((a) => a !== "--json");
  const asJson = argv.includes("--json");
  const path = args[0];
  if (!path) {
    console.error("usage: check-lane-manifest.mjs <manifest.json> [--json]");
    return 1;
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    const message = "cannot read " + path + ": " + (err instanceof Error ? err.message : String(err));
    if (asJson) console.log(JSON.stringify({ ok: false, errors: [message], lanes: 0 }, null, 2));
    else console.error("lane-manifest: " + message);
    return 1;
  }
  const result = validateLaneManifest(parsed);
  if (asJson) console.log(JSON.stringify(result, null, 2));
  else if (result.ok) console.log("lane-manifest: OK — " + result.lanes + " lane(s) coherent (not a merge-safety claim)");
  else console.error("lane-manifest: " + result.errors.length + " problem(s):\n  " + result.errors.join("\n  "));
  return result.ok ? 0 : 1;
}

if (import.meta.url === "file://" + process.argv[1] || process.argv[1]?.endsWith("check-lane-manifest.mjs")) {
  process.exit(main(process.argv.slice(2)));
}
