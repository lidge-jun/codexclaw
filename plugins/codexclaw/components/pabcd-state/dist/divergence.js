import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeKey, STATE_DIR } from "./state.js";












































const DIVERGENCE_DIR = "divergence";
const CANDIDATES_FILE = "candidates.jsonl";

function divergenceDir(cwd        )         {
  return join(cwd, STATE_DIR, DIVERGENCE_DIR);
}

function modePath(cwd        , sessionId        )         {
  return join(divergenceDir(cwd), `${sanitizeKey(sessionId)}.mode.json`);
}

function candidatesPath(cwd        )         {
  return join(divergenceDir(cwd), CANDIDATES_FILE);
}

function isCollapsePoint(value         )                         {
  return value === "P" || value === "D";
}

function isCandidateKind(value         )                         {
  return value === "strong-1" || value === "add-1" || value === "alternative";
}

function isCandidateStatus(value         )                           {
  return value === "proposed" || value === "built" || value === "checked" || value === "kept" || value === "discarded";
}

function slug(value        )         {
  return sanitizeKey(value.toLowerCase()).slice(0, 64) || "candidate";
}

function normalizeSources(urls          )           {
  const seen = new Set        ();
  const out           = [];
  for (const url of urls.map((u) => u.trim()).filter(Boolean)) {
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function writeDivergenceMode(
  cwd        ,
  input                                                                                                          ,
)                 {
  const mode                 = {
    sessionId: input.sessionId,
    active: input.active,
    objectiveKind: "maximize",
    collapsePoint: input.collapsePoint,
    reason: input.reason,
    updatedAt: input.now?.() ?? new Date().toISOString(),
  };
  mkdirSync(divergenceDir(cwd), { recursive: true });
  const finalPath = modePath(cwd, input.sessionId);
  const tmp = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(mode, null, 2));
    renameSync(tmp, finalPath);
  } catch (err) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      // best-effort cleanup
    }
    throw err;
  }
  return mode;
}

export function readDivergenceMode(cwd        , sessionId        )                        {
  try {
    const parsed = JSON.parse(readFileSync(modePath(cwd, sessionId), "utf8"))                                  ;
    if (
      parsed &&
      parsed.sessionId === sessionId &&
      typeof parsed.active === "boolean" &&
      parsed.objectiveKind === "maximize" &&
      isCollapsePoint(parsed.collapsePoint) &&
      typeof parsed.reason === "string" &&
      typeof parsed.updatedAt === "string"
    ) {
      return {
        sessionId,
        active: parsed.active,
        objectiveKind: "maximize",
        collapsePoint: parsed.collapsePoint,
        reason: parsed.reason,
        updatedAt: parsed.updatedAt,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function recordDivergenceCandidate(cwd        , input                                )                      {
  const sourceUrls = normalizeSources(input.sourceUrls);
  if (sourceUrls.length === 0) {
    throw new Error("divergence candidate requires at least one grounding source URL");
  }
  const candidate                      = {
    ts: input.now?.() ?? new Date().toISOString(),
    sessionId: input.sessionId,
    id: input.id ? slug(input.id) : `${input.kind}-${slug(input.title)}`,
    kind: input.kind,
    title: input.title,
    rationale: input.rationale,
    sourceUrls,
    status: input.status ?? "proposed",
    ...(input.worktree ? { worktree: input.worktree } : {}),
    ...(input.metricName ? { metricName: input.metricName } : {}),
    ...(typeof input.metricValue === "number" && Number.isFinite(input.metricValue) ? { metricValue: input.metricValue } : {}),
    ...(input.note ? { note: input.note } : {}),
  };
  mkdirSync(divergenceDir(cwd), { recursive: true });
  appendFileSync(candidatesPath(cwd), `${JSON.stringify(candidate)}\n`);
  return candidate;
}

export function readDivergenceCandidates(cwd        , sessionId         )                        {
  let raw        ;
  try {
    raw = readFileSync(candidatesPath(cwd), "utf8");
  } catch {
    return [];
  }
  const out                        = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line)                                       ;
      if (
        parsed &&
        typeof parsed.ts === "string" &&
        typeof parsed.sessionId === "string" &&
        typeof parsed.id === "string" &&
        isCandidateKind(parsed.kind) &&
        typeof parsed.title === "string" &&
        typeof parsed.rationale === "string" &&
        Array.isArray(parsed.sourceUrls) &&
        parsed.sourceUrls.every((url) => typeof url === "string") &&
        isCandidateStatus(parsed.status)
      ) {
        if (sessionId && parsed.sessionId !== sessionId) continue;
        out.push({
          ts: parsed.ts,
          sessionId: parsed.sessionId,
          id: parsed.id,
          kind: parsed.kind,
          title: parsed.title,
          rationale: parsed.rationale,
          sourceUrls: normalizeSources(parsed.sourceUrls),
          status: parsed.status,
          ...(typeof parsed.worktree === "string" ? { worktree: parsed.worktree } : {}),
          ...(typeof parsed.metricName === "string" ? { metricName: parsed.metricName } : {}),
          ...(typeof parsed.metricValue === "number" && Number.isFinite(parsed.metricValue) ? { metricValue: parsed.metricValue } : {}),
          ...(typeof parsed.note === "string" ? { note: parsed.note } : {}),
        });
      }
    } catch {
      // malformed candidate rows are ignored, matching metric ledger robustness.
    }
  }
  return out;
}
