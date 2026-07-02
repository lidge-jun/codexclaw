import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeKey, STATE_DIR } from "./state.ts";

export type CollapsePoint = "P" | "D";
export type CandidateKind = "strong-1" | "add-1" | "alternative";
export type CandidateStatus = "proposed" | "built" | "checked" | "kept" | "discarded";
export type CandidateChangeClass = "parameter-tweak" | "branch-toggle" | "state-space-redesign" | "evaluator-change";
export type CandidateKilledAtPhase = "P" | "A" | "B" | "C" | "D";

export interface DivergenceMode {
  sessionId: string;
  active: boolean;
  objectiveKind: "maximize";
  collapsePoint: CollapsePoint;
  reason: string;
  updatedAt: string;
}

export interface DivergenceCandidate {
  ts: string;
  sessionId: string;
  id: string;
  kind: CandidateKind;
  title: string;
  rationale: string;
  sourceUrls: string[];
  status: CandidateStatus;
  worktree?: string;
  metricName?: string;
  metricValue?: number;
  note?: string;
  changeClass?: CandidateChangeClass;
  killedAtPhase?: CandidateKilledAtPhase;
}

export interface RecordDivergenceCandidateInput {
  sessionId: string;
  id?: string;
  kind: CandidateKind;
  title: string;
  rationale: string;
  sourceUrls: string[];
  status?: CandidateStatus;
  worktree?: string;
  metricName?: string;
  metricValue?: number;
  note?: string;
  changeClass?: CandidateChangeClass;
  killedAtPhase?: CandidateKilledAtPhase;
  now?: () => string;
}

export interface DiscardStreak {
  changeClass: CandidateChangeClass | null;
  length: number;
}

const DIVERGENCE_DIR = "divergence";
const CANDIDATES_FILE = "candidates.jsonl";

function divergenceDir(cwd: string): string {
  return join(cwd, STATE_DIR, DIVERGENCE_DIR);
}

function modePath(cwd: string, sessionId: string): string {
  return join(divergenceDir(cwd), `${sanitizeKey(sessionId)}.mode.json`);
}

function candidatesPath(cwd: string): string {
  return join(divergenceDir(cwd), CANDIDATES_FILE);
}

function isCollapsePoint(value: unknown): value is CollapsePoint {
  return value === "P" || value === "D";
}

function isCandidateKind(value: unknown): value is CandidateKind {
  return value === "strong-1" || value === "add-1" || value === "alternative";
}

function isCandidateStatus(value: unknown): value is CandidateStatus {
  return value === "proposed" || value === "built" || value === "checked" || value === "kept" || value === "discarded";
}

function isCandidateChangeClass(value: unknown): value is CandidateChangeClass {
  return value === "parameter-tweak" || value === "branch-toggle" || value === "state-space-redesign" || value === "evaluator-change";
}

function isCandidateKilledAtPhase(value: unknown): value is CandidateKilledAtPhase {
  return value === "P" || value === "A" || value === "B" || value === "C" || value === "D";
}

function slug(value: string): string {
  return sanitizeKey(value.toLowerCase()).slice(0, 64) || "candidate";
}

function normalizeSources(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls.map((u) => u.trim()).filter(Boolean)) {
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function writeDivergenceMode(
  cwd: string,
  input: { sessionId: string; active: boolean; collapsePoint: CollapsePoint; reason: string; now?: () => string },
): DivergenceMode {
  const mode: DivergenceMode = {
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

export function readDivergenceMode(cwd: string, sessionId: string): DivergenceMode | null {
  try {
    const parsed = JSON.parse(readFileSync(modePath(cwd, sessionId), "utf8")) as Partial<DivergenceMode> | null;
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

export function recordDivergenceCandidate(cwd: string, input: RecordDivergenceCandidateInput): DivergenceCandidate {
  const sourceUrls = normalizeSources(input.sourceUrls);
  if (sourceUrls.length === 0) {
    throw new Error("divergence candidate requires at least one grounding source URL");
  }
  if (input.changeClass !== undefined && !isCandidateChangeClass(input.changeClass)) {
    throw new Error("divergence candidate changeClass must be parameter-tweak, branch-toggle, state-space-redesign, or evaluator-change");
  }
  if (input.killedAtPhase !== undefined && !isCandidateKilledAtPhase(input.killedAtPhase)) {
    throw new Error("divergence candidate killedAtPhase must be P, A, B, C, or D");
  }
  const candidate: DivergenceCandidate = {
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
    ...(input.changeClass ? { changeClass: input.changeClass } : {}),
    ...(input.killedAtPhase ? { killedAtPhase: input.killedAtPhase } : {}),
  };
  mkdirSync(divergenceDir(cwd), { recursive: true });
  appendFileSync(candidatesPath(cwd), `${JSON.stringify(candidate)}\n`);
  return candidate;
}

export function readDivergenceCandidates(cwd: string, sessionId?: string): DivergenceCandidate[] {
  let raw: string;
  try {
    raw = readFileSync(candidatesPath(cwd), "utf8");
  } catch {
    return [];
  }
  const out: DivergenceCandidate[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as Partial<DivergenceCandidate> | null;
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
          ...(isCandidateChangeClass(parsed.changeClass) ? { changeClass: parsed.changeClass } : {}),
          ...(isCandidateKilledAtPhase(parsed.killedAtPhase) ? { killedAtPhase: parsed.killedAtPhase } : {}),
        });
      }
    } catch {
      // malformed candidate rows are ignored, matching metric ledger robustness.
    }
  }
  return out;
}

export function discardStreak(candidates: DivergenceCandidate[]): DiscardStreak {
  const sorted = [...candidates].sort((a, b) => a.ts.localeCompare(b.ts));
  const latest = sorted[sorted.length - 1];
  if (!latest || latest.status !== "discarded" || !latest.changeClass) return { changeClass: null, length: 0 };
  let length = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const candidate = sorted[i];
    if (candidate.status !== "discarded" || candidate.changeClass !== latest.changeClass) break;
    length++;
  }
  return { changeClass: latest.changeClass, length };
}
