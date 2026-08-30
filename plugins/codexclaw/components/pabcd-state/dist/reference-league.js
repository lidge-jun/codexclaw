/**
 * reference-league.ts — benchmark manifest and comparative framework (issue #19).
 *
 * Pins representative repository snapshots and defines controlled comparison
 * across bare Codex, codexclaw, LazyCodex, and OMX.
 */

/** Schema version for benchmark manifests. */
export const MANIFEST_SCHEMA_VERSION = 1;

/** A pinned repository snapshot for benchmarking. */















/** A benchmark task to run against a repository. */













/** Harness configuration for a competitor. */









/** A single run result. */























/** A benchmark manifest tying together repos, tasks, harnesses, and results. */














/** Validate a benchmark manifest. Returns error messages or empty array. */
export function validateManifest(manifest         )           {
  const errors           = [];
  if (!manifest || typeof manifest !== "object") return ["manifest must be a non-null object"];
  const m = manifest                           ;
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
      const r = m.repositories[i]                           ;
      if (typeof r.id !== "string" || !r.id) errors.push("repositories[" + i + "].id required");
      if (typeof r.name !== "string" || !r.name) errors.push("repositories[" + i + "].name required");
    }
  }
  return errors;
}

/** Compute a summary report from manifest results. */
export function computeLeagueReport(manifest                   )


  {
  const harnessScores                                                                  = {};
  const taskResults                                                                    = {};

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

  const taskSummary                                                            = {};
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

