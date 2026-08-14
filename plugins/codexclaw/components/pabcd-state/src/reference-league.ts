/**
 * reference-league.ts — benchmark manifest and comparative framework (issue #19).
 *
 * Pins representative repository snapshots and defines controlled comparison
 * across bare Codex, codexclaw, LazyCodex, and OMX.
 */

/** Schema version for benchmark manifests. */
export const MANIFEST_SCHEMA_VERSION = 1;

/** A pinned repository snapshot for benchmarking. */
export interface RepositorySnapshot {
  /** Short identifier for this snapshot. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Category of repository. */
  category: "typescript-cli" | "monorepo" | "react-frontend" | "api-backend" |
    "python-pipeline" | "rust-workspace" | "mixed-language" | "windows-paths" |
    "legacy" | "visual-qa";
  /** How to obtain the snapshot: local fixture, pinned commit, or setup script. */
  source: { type: "fixture"; path: string } |
    { type: "pinned-commit"; repo: string; commit: string } |
    { type: "setup-script"; script: string };
}

/** A benchmark task to run against a repository. */
export interface BenchmarkTask {
  /** Unique task id. */
  id: string;
  /** Task prompt or objective. */
  prompt: string;
  /** Verifier command to check success. */
  verifier: string;
  /** Expected work class (C0-C5). */
  expectedClass: string;
  /** Target repositories by id. */
  targetRepos: string[];
}

/** Harness configuration for a competitor. */
export interface HarnessConfig {
  /** Harness name. */
  name: "bare-codex" | "codexclaw" | "lazycodex" | "omx";
  /** How to invoke this harness (command template). */
  invocation: string;
  /** Whether this harness is available for comparison. */
  available: boolean;
}

/** A single run result. */
export interface RunResult {
  /** Task id. */
  taskId: string;
  /** Repository snapshot id. */
  repoId: string;
  /** Harness name. */
  harness: string;
  /** Run number (for stochastic comparison). */
  runNumber: number;
  /** Whether the verifier passed. */
  verifierPassed: boolean;
  /** Whether user intervention was needed. */
  userIntervention: boolean;
  /** Total tokens used (when exposed). */
  totalTokens?: number;
  /** Wall time in seconds. */
  wallTimeSeconds?: number;
  /** Model and reasoning effort used. */
  modelConfig: { model: string; effort?: string };
  /** Timestamp. */
  timestamp: string;
}

/** A benchmark manifest tying together repos, tasks, harnesses, and results. */
export interface BenchmarkManifest {
  schemaVersion: number;
  /** Manifest creation date. */
  createdAt: string;
  /** Repository snapshots. */
  repositories: RepositorySnapshot[];
  /** Benchmark tasks. */
  tasks: BenchmarkTask[];
  /** Harness configurations. */
  harnesses: HarnessConfig[];
  /** Run results. */
  results: RunResult[];
}

/** Validate a benchmark manifest. Returns error messages or empty array. */
export function validateManifest(manifest: unknown): string[] {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== "object") return ["manifest must be a non-null object"];
  const m = manifest as Record<string, unknown>;
  if (m.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    errors.push("schemaVersion must be " + MANIFEST_SCHEMA_VERSION);
  }
  if (!Array.isArray(m.repositories)) errors.push("repositories must be an array");
  if (!Array.isArray(m.tasks)) errors.push("tasks must be an array");
  if (!Array.isArray(m.harnesses)) errors.push("harnesses must be an array");
  if (!Array.isArray(m.results)) errors.push("results must be an array");
  // Validate repo categories
  if (Array.isArray(m.repositories)) {
    for (let i = 0; i < m.repositories.length; i++) {
      const r = m.repositories[i] as Record<string, unknown>;
      if (typeof r.id !== "string" || !r.id) errors.push("repositories[" + i + "].id required");
      if (typeof r.name !== "string" || !r.name) errors.push("repositories[" + i + "].name required");
    }
  }
  return errors;
}

/** Compute a summary report from manifest results. */
export function computeLeagueReport(manifest: BenchmarkManifest): {
  harnessScores: Record<string, { passed: number; total: number; rate: number }>;
  taskSummary: Record<string, { bestHarness: string; bestRate: number }>;
} {
  const harnessScores: Record<string, { passed: number; total: number; rate: number }> = {};
  const taskResults: Record<string, Record<string, { passed: number; total: number }>> = {};

  for (const r of manifest.results) {
    if (!harnessScores[r.harness]) harnessScores[r.harness] = { passed: 0, total: 0, rate: 0 };
    harnessScores[r.harness].total++;
    if (r.verifierPassed) harnessScores[r.harness].passed++;

    if (!taskResults[r.taskId]) taskResults[r.taskId] = {};
    if (!taskResults[r.taskId][r.harness]) taskResults[r.taskId][r.harness] = { passed: 0, total: 0 };
    taskResults[r.taskId][r.harness].total++;
    if (r.verifierPassed) taskResults[r.taskId][r.harness].passed++;
  }

  for (const h of Object.keys(harnessScores)) {
    const s = harnessScores[h];
    s.rate = s.total > 0 ? s.passed / s.total : 0;
  }

  const taskSummary: Record<string, { bestHarness: string; bestRate: number }> = {};
  for (const [taskId, harnesses] of Object.entries(taskResults)) {
    let bestHarness = "";
    let bestRate = 0;
    for (const [h, counts] of Object.entries(harnesses)) {
      const rate = counts.total > 0 ? counts.passed / counts.total : 0;
      if (rate > bestRate) { bestRate = rate; bestHarness = h; }
    }
    taskSummary[taskId] = { bestHarness, bestRate };
  }

  return { harnessScores, taskSummary };
}

