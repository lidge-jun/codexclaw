import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeKey, STATE_DIR } from "./state.ts";

export type ObjectiveMetricSource = "operator-entered" | "evaluate.sh";
export type ObjectiveKind = "satisfy" | "maximize";

export interface ObjectiveMetricRecord {
  ts: string;
  sessionId: string;
  workPhaseId: string;
  metricName: string;
  value: number;
  baseline: number;
  best: number;
  source: ObjectiveMetricSource;
}

export interface RecordObjectiveMetricInput {
  sessionId: string;
  metricName: string;
  value: number;
  source: ObjectiveMetricSource;
  workPhaseId?: string;
  now?: () => string;
}

export interface PlateauCheck {
  flat: boolean;
  metricName: string | null;
  values: number[];
}

const METRICS_FILE = "metrics.jsonl";
const OBJECTIVE_KIND_DIR = "objective-kind";
const DEFAULT_WORK_PHASE_ID = "default";

function codexclawDir(cwd: string): string {
  return join(cwd, STATE_DIR);
}

function metricsPath(cwd: string): string {
  return join(codexclawDir(cwd), METRICS_FILE);
}

function objectiveKindDir(cwd: string): string {
  return join(codexclawDir(cwd), OBJECTIVE_KIND_DIR);
}

function objectiveKindPath(cwd: string, sessionId: string): string {
  return join(objectiveKindDir(cwd), `${sanitizeKey(sessionId)}.json`);
}

function isObjectiveMetricSource(value: unknown): value is ObjectiveMetricSource {
  return value === "operator-entered" || value === "evaluate.sh";
}

function isObjectiveKind(value: unknown): value is ObjectiveKind {
  return value === "satisfy" || value === "maximize";
}

function normalizeMetricName(name: string): string {
  return sanitizeKey(name).replace(/\.+/g, ".").replace(/^\.+|\.+$/g, "") || "metric";
}

function readAllObjectiveMetrics(cwd: string): ObjectiveMetricRecord[] {
  let raw: string;
  try {
    raw = readFileSync(metricsPath(cwd), "utf8");
  } catch {
    return [];
  }
  const out: ObjectiveMetricRecord[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as Partial<ObjectiveMetricRecord> | null;
      if (
        parsed &&
        typeof parsed.ts === "string" &&
        typeof parsed.sessionId === "string" &&
        typeof parsed.workPhaseId === "string" &&
        typeof parsed.metricName === "string" &&
        typeof parsed.value === "number" &&
        Number.isFinite(parsed.value) &&
        typeof parsed.baseline === "number" &&
        Number.isFinite(parsed.baseline) &&
        typeof parsed.best === "number" &&
        Number.isFinite(parsed.best) &&
        isObjectiveMetricSource(parsed.source)
      ) {
        out.push({
          ts: parsed.ts,
          sessionId: parsed.sessionId,
          workPhaseId: parsed.workPhaseId,
          metricName: parsed.metricName,
          value: parsed.value,
          baseline: parsed.baseline,
          best: parsed.best,
          source: parsed.source,
        });
      }
    } catch {
      // malformed rows are ignored so a hand-edited ledger cannot break Stop.
    }
  }
  return out;
}

export function readObjectiveMetrics(cwd: string, sessionId?: string): ObjectiveMetricRecord[] {
  const all = readAllObjectiveMetrics(cwd);
  return sessionId ? all.filter((r) => r.sessionId === sessionId) : all;
}

export function recordObjectiveMetric(cwd: string, input: RecordObjectiveMetricInput): ObjectiveMetricRecord {
  const metricName = normalizeMetricName(input.metricName);
  const prior = readObjectiveMetrics(cwd, input.sessionId).filter((r) => r.metricName === metricName);
  const baseline = prior[0]?.baseline ?? input.value;
  const previousBest = prior.length > 0 ? prior.at(-1)?.best ?? baseline : baseline;
  const next: ObjectiveMetricRecord = {
    ts: input.now?.() ?? new Date().toISOString(),
    sessionId: input.sessionId,
    workPhaseId: input.workPhaseId ?? DEFAULT_WORK_PHASE_ID,
    metricName,
    value: input.value,
    baseline,
    best: Math.max(previousBest, input.value),
    source: input.source,
  };
  mkdirSync(codexclawDir(cwd), { recursive: true });
  appendFileSync(metricsPath(cwd), `${JSON.stringify(next)}\n`);
  return next;
}

export function writeObjectiveKind(cwd: string, sessionId: string, kind: ObjectiveKind): void {
  mkdirSync(objectiveKindDir(cwd), { recursive: true });
  const finalPath = objectiveKindPath(cwd, sessionId);
  const tmp = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify({ sessionId, kind, updatedAt: new Date().toISOString() }, null, 2));
    renameSync(tmp, finalPath);
  } catch (err) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      // best-effort cleanup
    }
    throw err;
  }
}

export function readExplicitObjectiveKind(cwd: string, sessionId: string): ObjectiveKind | null {
  try {
    const parsed = JSON.parse(readFileSync(objectiveKindPath(cwd, sessionId), "utf8")) as { kind?: unknown } | null;
    return parsed && isObjectiveKind(parsed.kind) ? parsed.kind : null;
  } catch {
    return null;
  }
}

export function readObjectiveKind(cwd: string, sessionId: string): ObjectiveKind {
  const explicit = readExplicitObjectiveKind(cwd, sessionId);
  if (explicit) return explicit;
  if (readObjectiveMetrics(cwd, sessionId).length > 0) return "maximize";
  return "satisfy";
}

export function parseMetricLine(line: string): { metricName: string; value: number } | null {
  const match = line.match(/^\s*METRIC\s+([A-Za-z0-9._-]+)\s*=\s*(-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)\s*$/i);
  if (!match) return null;
  const value = Number(match[2]);
  if (!Number.isFinite(value)) return null;
  return { metricName: normalizeMetricName(match[1]), value };
}

export function recordMetricsFromText(
  cwd: string,
  input: { sessionId: string; text: string; source: ObjectiveMetricSource; workPhaseId?: string; now?: () => string },
): ObjectiveMetricRecord[] {
  const records: ObjectiveMetricRecord[] = [];
  for (const line of input.text.split("\n")) {
    const parsed = parseMetricLine(line);
    if (!parsed) continue;
    records.push(
      recordObjectiveMetric(cwd, {
        sessionId: input.sessionId,
        metricName: parsed.metricName,
        value: parsed.value,
        source: input.source,
        workPhaseId: input.workPhaseId,
        now: input.now,
      }),
    );
  }
  return records;
}

export function checkObjectivePlateau(
  cwd: string,
  sessionId: string,
  options: { minRecords?: number; noiseFloor?: number } = {},
): PlateauCheck {
  const minRecords = Math.max(2, Math.floor(options.minRecords ?? 2));
  const noiseFloor = Math.max(0, options.noiseFloor ?? 0);
  const records = readObjectiveMetrics(cwd, sessionId);
  const latest = records.at(-1);
  if (!latest) return { flat: false, metricName: null, values: [] };
  const sameMetric = records.filter((r) => r.metricName === latest.metricName);
  const window = sameMetric.slice(-minRecords);
  const values = window.map((r) => r.value);
  if (window.length < minRecords) return { flat: false, metricName: latest.metricName, values };
  const first = values[0];
  const bestInWindow = Math.max(...values);
  return { flat: bestInWindow <= first + noiseFloor, metricName: latest.metricName, values };
}
