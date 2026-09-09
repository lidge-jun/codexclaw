/** Main-owned native spawn protocol. This module selects attempts; it never calls a provider. */
import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { EFFORTS, readConfig, ROLES,                                } from "./store.js";
import { renameWithRetry } from "./atomic-write.js";
import { decodeDispatchFailure } from "./fallback-errors.js";

































const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/;
const MAX_INPUT = 64 * 1024;
function dispatchRoot(cwd        )         {
  const git = spawnSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8", timeout: 1500 });
  return realpathSync(git.status === 0 ? git.stdout.trim() : cwd);
}
function record(value         )                          {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("expected a JSON object");
  return value                           ;
}
function id(value         , field        )         {
  if (typeof value !== "string" || !ID.test(value)) throw new Error(`invalid ${field}`);
  return value;
}
function smallText(value         , field        )         {
  if (typeof value !== "string" || !value.trim() || value.length > 2000) throw new Error(`invalid ${field}`);
  return value.trim();
}
function directory(cwd        , sessionId        )         {
  let dir = cwd;
  for (const part of [".codexclaw", "dispatches", sessionId]) {
    dir = join(dir, part);
    if (existsSync(dir)) {
      if (!lstatSync(dir).isDirectory() || lstatSync(dir).isSymbolicLink()) throw new Error("dispatch directory must not be a symlink");
    } else mkdirSync(dir, { mode: 0o700 });
  }
  return dir;
}
function candidate(raw         )            {
  const c = record(raw);
  if (c.model !== null && (typeof c.model !== "string" || !c.model.trim())) throw new Error("invalid stored model");
  if (c.effort !== null && !(EFFORTS                      ).includes(c.effort)) throw new Error("invalid stored effort");
  return { model: c.model                 , effort: c.effort                      };
}
function readState(path        , sessionId        , dispatchId        )           {
  if (lstatSync(path).isSymbolicLink()) throw new Error("dispatch state must not be a symlink");
  const d = record(JSON.parse(readFileSync(path, "utf8")));
  if (d.version !== 1 || d.sessionId !== sessionId || d.id !== dispatchId || !ROLES.includes(d.role            )) throw new Error("invalid dispatch identity");
  if (!Array.isArray(d.candidates) || d.candidates.length < 1 || d.candidates.length > 2) throw new Error("invalid candidates");
  d.candidates.forEach(candidate);
  if (!Array.isArray(d.attempts) || d.attempts.length < 1 || d.attempts.length > d.candidates.length) throw new Error("invalid attempts");
  if (!["active", "stopped", "complete", "main-direct"].includes(String(d.status))) throw new Error("invalid dispatch status");
  for (const [i, raw] of d.attempts.entries()) {
    const a = record(raw); id(a.id, "attemptId"); candidate(a.candidate);
    if (candidate(a.candidate).model !== candidate(d.candidates[i]).model || candidate(a.candidate).effort !== candidate(d.candidates[i]).effort || typeof a.claimed !== "boolean") throw new Error("invalid attempt candidate");
    if (typeof a.spawnIssued !== "boolean") throw new Error("invalid spawn issuance");
    if (!["ready", "claimed", "running", "reconcile", "failed", "complete"].includes(String(a.status))) throw new Error("invalid attempt status");
    for (const field of ["agentId", "observedModel", "code", "reconciliation", "toolUseId"]) {
      if (a[field] !== null && typeof a[field] !== "string") throw new Error(`invalid attempt ${field}`);
    }
  }
  return d                       ;
}
function saveState(path        , state          )       {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, JSON.stringify(state, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    renameWithRetry(temp, path);
  } finally { rmSync(temp, { force: true }); }
}
function attempt(c           )          {
  return { id: randomUUID(), candidate: c, claimed: false, agentId: null, observedModel: null, code: null, status: "ready", reconciliation: null, spawnIssued: false, toolUseId: null };
}
function result(d          , action                           , reason         )                 {
  const a = d.attempts.at(-1) ;
  const inferred = d.status === "active" ? (a.status === "ready" ? "ready" : a.status === "running" ? "wait" : "reconcile") : d.status === "stopped" ? "stop" : d.status;
  return { action: action ?? inferred, dispatchId: d.id, attemptId: a.id,
    independentReviewRequired: d.role === "reviewer", attempts: d.attempts,
    ...(reason ? { reason } : {}) };
}

/** Explicit caller reports are evidence from the main agent, not authenticated provider receipts. */
export function runDispatch(cwd        , input         , env                    = process.env)                 {
  cwd = dispatchRoot(cwd);
  const b = record(input);
  if (JSON.stringify(b).length > MAX_INPUT) throw new Error("dispatch input exceeds 64 KiB");
  const sessionId = id(b.sessionId, "sessionId");
  if (env.CODEX_THREAD_ID && env.CODEX_THREAD_ID !== sessionId) throw new Error("sessionId must match the native main session");
  const dispatchId = id(b.dispatchId, "dispatchId");
  const dir = directory(cwd, sessionId);
  const path = join(dir, `${dispatchId}.json`);
  const lock = `${path}.lock`;
  // Never steal a stale lock: an interrupted writer requires inspection, not a second spawn.
  mkdirSync(lock, { mode: 0o700 });
  try {
    if (b.action === "start") {
      if (existsSync(path)) throw new Error("dispatch already exists; use status, never replay start");
      if (!ROLES.includes(b.role            )) throw new Error("invalid role");
      const role = b.role            ;
      const cfg = readConfig(cwd, "project", env).roles[role];
      const candidates              = [{ model: cfg.mode === "model" ? cfg.model : null, effort: cfg.effort }];
      if (cfg.fallback && cfg.fallback.model !== candidates[0].model) candidates.push({ ...cfg.fallback });
      const d           = { version: 1, sessionId, id: dispatchId, role, candidates, attempts: [attempt(candidates[0])], status: "active" };
      saveState(path, d);
      return result(d);
    }
    const d = readState(path, sessionId, dispatchId);
    if (b.action === "status") return result(d);
    const a = d.attempts.at(-1) ;
    if (b.attemptId !== a.id) throw new Error("stale or missing attemptId; inspect status");
    if (d.status !== "active") return result(d);
    if (b.action === "claim") {
      if (a.claimed || a.status !== "ready") return result(d, "reconcile", "attempt already claimed; do not spawn again");
      a.claimed = true; a.status = "claimed"; saveState(path, d);
      return { ...result(d, "spawn"), candidate: a.candidate, marker: `[CXC-DISPATCH:${dispatchId}:${a.id}]` };
    }
    if (b.action !== "report") throw new Error("action must be start, claim, report or status");
    if (!a.claimed) throw new Error("claim the attempt before reporting an outcome");
    const response = report(d, b);
    saveState(path, d);
    return response;
  } finally { rmSync(lock, { recursive: true }); }
}
function report(d          , b                         )                 {
  const a = d.attempts.at(-1) ;
  if (b.outcome === "created") {
    const agentId = id(b.agentId, "agentId");
    if (a.agentId !== null && a.agentId !== agentId) throw new Error("agentId changed");
    a.agentId = agentId; a.status = "running";
    if (b.observedModel !== undefined) a.observedModel = smallText(b.observedModel, "observedModel");
    return result(d, "wait");
  }
  if (b.outcome === "complete") {
    if (!a.agentId || b.agentId !== a.agentId) throw new Error("complete requires the recorded agentId");
    a.status = "complete"; d.status = "complete"; return result(d);
  }
  if (b.outcome !== "failed" && b.outcome !== "unavailable") throw new Error("invalid report outcome");
  const failure = b.outcome === "unavailable" ? null : decodeDispatchFailure(b.error);
  a.code = failure?.code ?? null;
  // Never turn denial/cancellation/unknown prose into either another model or main execution.
  if (failure?.action === "stop") { d.status = "stopped"; return result(d, "stop", "failure does not permit model fallback"); }
  if (failure?.action === "unknown") { a.status = "reconcile"; return result(d, "reconcile", "error is unclassified; obtain structured OCX evidence, do not guess a code"); }
  if (b.executionState !== "not_created" && b.executionState !== "stopped") {
    a.status = "reconcile"; return result(d, "reconcile", "confirm whether a child exists and stop it before handoff");
  }
  if (a.agentId && (b.executionState !== "stopped" || b.agentId !== a.agentId)) throw new Error("recorded child must be stopped and identified");
  // Even pre-spawn failure needs a concrete observation, not timeout-as-proof.
  a.reconciliation = smallText(b.reconciliation, "reconciliation evidence");
  if (b.outcome === "unavailable") {
    if (a.agentId || b.executionState !== "not_created") throw new Error("unavailable requires confirmed no child");
    a.status = "failed"; d.status = "main-direct"; return result(d);
  }
  if (b.executionState === "stopped" && !a.agentId) throw new Error("record created agent before stopped handoff");
  a.status = "failed";
  if (d.attempts.length === d.candidates.length) { d.status = "main-direct"; return result(d); }
  d.attempts.push(attempt(d.candidates[d.attempts.length]));
  return result(d);
}

/** Marker resolution never creates a dispatch. The hook uses it to avoid primary effort reinjection. */
export function managedSpawn(cwd        , sessionId        , message        )                                                  {
  cwd = dispatchRoot(cwd);
  const match = /^\[CXC-DISPATCH:([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)\](?:\r?\n|$)/m.exec(message);
  if (!match) return null;
  id(sessionId, "sessionId"); id(match[1], "dispatchId"); id(match[2], "attemptId");
  const path = join(cwd, ".codexclaw", "dispatches", sessionId, `${match[1]}.json`);
  const d = readState(path, sessionId, match[1]);
  const a = d.attempts.at(-1) ;
  if (a.id !== match[2] || !a.claimed || a.status !== "claimed" || d.status !== "active") throw new Error("managed spawn attempt is not claimed or no longer current");
  return { candidate: a.candidate, role: d.role };
}

/** Consume native issuance under the same dispatch lock; repeated hook delivery needs the same host tool id. */
export function issueManagedSpawn(cwd        , sessionId        , message        , toolUseId               )                                                  {
  cwd = dispatchRoot(cwd);
  const match = /^\[CXC-DISPATCH:([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)\](?:\r?\n|$)/m.exec(message);
  if (!match) return null;
  const resolved = managedSpawn(cwd, sessionId, message);
  const dir = directory(cwd, sessionId);
  const path = join(dir, `${match[1]}.json`);
  const lock = `${path}.lock`;
  mkdirSync(lock, { mode: 0o700 });
  try {
    const d = readState(path, sessionId, match[1]);
    const a = d.attempts.at(-1) ;
    if (a.id !== match[2] || a.status !== "claimed" || !a.claimed || d.status !== "active") throw new Error("managed attempt changed before issuance");
    if (a.spawnIssued && (!toolUseId || a.toolUseId !== toolUseId)) throw new Error("attempt already issued to another native call; reconcile before retry");
    a.spawnIssued = true; a.toolUseId = toolUseId; saveState(path, d);
    return resolved;
  } finally { rmSync(lock, { recursive: true }); }
}
