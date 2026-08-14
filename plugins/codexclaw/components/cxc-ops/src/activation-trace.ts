/**
 * activation-trace.ts — opt-in eval trace recorder (issue #11).
 *
 * Records skill activation through four layers:
 *   1. installed   — skill directories that exist
 *   2. visible     — skills with allow_implicit_invocation: true
 *   3. activated   — SKILL.md router bodies actually loaded for a task
 *   4. referenced  — references/subagent attachments actually selected
 *
 * Tracing is enabled ONLY by CODEXCLAW_TRACE_ACTIVATIONS=1 or explicit CLI.
 * Ordinary sessions receive no additional context or artifacts.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const TRACE_SCHEMA_VERSION = 1;

export interface ActivationEvent {
  layer: "installed" | "visible" | "activated" | "referenced";
  skill: string;
  /** Reference path within the skill (only for layer=referenced). */
  reference?: string;
  /** Subagent task name (only for layer=referenced with subagent attachment). */
  subagentTask?: string;
  /** Approximate byte count of the loaded content. */
  bytes: number;
  /** Timestamp of the event. */
  timestamp: string;
}

export interface ActivationTrace {
  schemaVersion: number;
  sessionId: string;
  turnId: string;
  workClass: { expected: string; observed: string };
  events: ActivationEvent[];
  tokenEstimates: {
    metadata: number;
    routerBodies: number;
    references: number;
    subagentAttachments: number;
  };
}

/**
 * Whether tracing is enabled. Checks CODEXCLAW_TRACE_ACTIVATIONS env var.
 */
export function isTracingEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  return env.CODEXCLAW_TRACE_ACTIVATIONS === "1";
}

/**
 * In-memory trace builder. Create one per turn, record events, then emit.
 */
export class TraceBuilder {
  readonly sessionId: string;
  readonly turnId: string;
  private workClassExpected = "unknown";
  private workClassObserved = "unknown";
  private events: ActivationEvent[] = [];
  private metadataBytes = 0;
  private routerBytes = 0;
  private referenceBytes = 0;
  private subagentBytes = 0;

  constructor(sessionId: string, turnId: string) {
    this.sessionId = sessionId;
    this.turnId = turnId;
  }

  setWorkClass(expected: string, observed: string): void {
    this.workClassExpected = expected;
    this.workClassObserved = observed;
  }

  recordInstalled(skill: string, bytes: number): void {
    this.events.push({ layer: "installed", skill, bytes, timestamp: new Date().toISOString() });
    this.metadataBytes += bytes;
  }

  recordVisible(skill: string, bytes: number): void {
    this.events.push({ layer: "visible", skill, bytes, timestamp: new Date().toISOString() });
    this.metadataBytes += bytes;
  }

  recordActivated(skill: string, bytes: number): void {
    this.events.push({ layer: "activated", skill, bytes, timestamp: new Date().toISOString() });
    this.routerBytes += bytes;
  }

  recordReferenced(skill: string, reference: string, bytes: number, subagentTask?: string): void {
    this.events.push({
      layer: "referenced",
      skill,
      reference,
      bytes,
      subagentTask,
      timestamp: new Date().toISOString(),
    });
    if (subagentTask) {
      this.subagentBytes += bytes;
    } else {
      this.referenceBytes += bytes;
    }
  }

  build(): ActivationTrace {
    return {
      schemaVersion: TRACE_SCHEMA_VERSION,
      sessionId: this.sessionId,
      turnId: this.turnId,
      workClass: { expected: this.workClassExpected, observed: this.workClassObserved },
      events: [...this.events],
      tokenEstimates: {
        metadata: Math.ceil(this.metadataBytes / 4),
        routerBodies: Math.ceil(this.routerBytes / 4),
        references: Math.ceil(this.referenceBytes / 4),
        subagentAttachments: Math.ceil(this.subagentBytes / 4),
      },
    };
  }
}

/**
 * Write a trace to the JSONL trace file. Only writes when tracing is enabled.
 * Appends one JSON line per trace.
 */
export function emitTrace(
  trace: ActivationTrace,
  outputDir: string,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string | null {
  if (!isTracingEnabled(env)) return null;
  const dir = join(outputDir, ".codexclaw", "traces");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "activations.jsonl");
  writeFileSync(path, JSON.stringify(trace) + "\n", { flag: "a" });
  return path;
}

/**
 * Read all traces from the JSONL file. Returns empty array when file is missing.
 */
export function readTraces(outputDir: string): ActivationTrace[] {
  const path = join(outputDir, ".codexclaw", "traces", "activations.jsonl");
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.trim().length > 0);
  return lines.map((l) => JSON.parse(l) as ActivationTrace);
}
