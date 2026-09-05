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




























/**
 * Whether tracing is enabled. Checks CODEXCLAW_TRACE_ACTIVATIONS env var.
 */
export function isTracingEnabled(
  env                                     = process.env                                      ,
)          {
  return env.CODEXCLAW_TRACE_ACTIVATIONS === "1";
}

/**
 * In-memory trace builder. Create one per turn, record events, then emit.
 */
export class TraceBuilder {
           sessionId        ;
           turnId        ;
          workClassExpected = "unknown";
          workClassObserved = "unknown";
          events                    = [];
          metadataBytes = 0;
          routerBytes = 0;
          referenceBytes = 0;
          subagentBytes = 0;

  constructor(sessionId        , turnId        ) {
    this.sessionId = sessionId;
    this.turnId = turnId;
  }

  setWorkClass(expected        , observed        )       {
    this.workClassExpected = expected;
    this.workClassObserved = observed;
  }

  recordInstalled(skill        , bytes        )       {
    this.events.push({ layer: "installed", skill, bytes, timestamp: new Date().toISOString() });
    this.metadataBytes += bytes;
  }

  recordVisible(skill        , bytes        )       {
    this.events.push({ layer: "visible", skill, bytes, timestamp: new Date().toISOString() });
    this.metadataBytes += bytes;
  }

  recordActivated(skill        , bytes        )       {
    this.events.push({ layer: "activated", skill, bytes, timestamp: new Date().toISOString() });
    this.routerBytes += bytes;
  }

  recordReferenced(skill        , reference        , bytes        , subagentTask         )       {
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

  build()                  {
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
  trace                 ,
  outputDir        ,
  env                                     = process.env                                      ,
)                {
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
export function readTraces(outputDir        )                    {
  const path = join(outputDir, ".codexclaw", "traces", "activations.jsonl");
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.trim().length > 0);
  return lines.map((l) => JSON.parse(l)                   );
}
