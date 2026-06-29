/**
 * freeze-cli.ts — runtime wiring for the L10.3 freeze/stale path (HIGH-1/HIGH-4).
 *
 * `cli.js freeze --dry-run [--cwd <dir>] [--session <id>]` reads the session
 * interview tracker, hashes the plan files under .codexclaw/plan/<slug>/, builds
 * (or previews) the freeze manifest at .codexclaw/interview/freeze.json, runs a
 * stale check against any existing manifest, and prints a human summary. This
 * makes triage/freeze reachable from production, not just exported definitions.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { STATE_DIR, readState } from "./state.js";
import { isInterviewReady } from "./interview.js";
import {
  PLAN_SUBDIR,
  FREEZE_MANIFEST_DIR,
  FREEZE_MANIFEST_FILE,
  buildFreezeManifest,
  checkStale,
  deriveSlug,
  sha256,
                      
                      
                    
} from "./freeze.js";

function listPlanFiles(planDir        )                 {
  if (!existsSync(planDir)) return [];
  const out                 = [];
  const walk = (dir        )       => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".")) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push({ path: relative(planDir, full), sha256: sha256(readFileSync(full, "utf8")) });
    }
  };
  walk(planDir);
  return out;
}

                                
              
                    
                  
 

export function parseFreezeArgs(argv          )                {
  const get = (flag        )                     => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  return {
    cwd: get("--cwd") ?? process.cwd(),
    sessionId: get("--session") ?? "default",
    dryRun: argv.includes("--dry-run"),
  };
}

export function runFreeze(args               )         {
  const state = readState(args.cwd, args.sessionId);
  const tracker = state.interview;
  const ready = isInterviewReady(tracker);
  const objective = state.slug || args.sessionId;
  const slug = deriveSlug(objective);
  const planDir = join(args.cwd, STATE_DIR, PLAN_SUBDIR, slug);
  const planFiles = listPlanFiles(planDir);

  const evidenceBundle                 = {
    dimensions: tracker?.dimensions ?? null,
    openAssumptions: (tracker?.assumptions ?? []).filter((a) => a.recorded).map((a) => `- ${a.text}`),
    contradictions: tracker?.contradictions ?? [],
    acceptanceCriteria: [],
    researchReportRef: null,
  };

  const manifest = buildFreezeManifest({ objective, planFiles, evidenceBundle });
  const manifestPath = join(args.cwd, STATE_DIR, FREEZE_MANIFEST_DIR, FREEZE_MANIFEST_FILE);

  // stale check against an existing manifest (goal-start integration)
  let staleLine = "stale-check: no prior manifest";
  if (existsSync(manifestPath)) {
    try {
      const prior = JSON.parse(readFileSync(manifestPath, "utf8"))                  ;
      const r = checkStale(prior, planFiles);
      staleLine = `stale-check: ${r.stale ? "STALE" : "fresh"} — ${r.reason}`;
    } catch {
      staleLine = "stale-check: prior manifest unreadable (will re-freeze)";
    }
  }

  if (!args.dryRun) {
    mkdirSync(join(args.cwd, STATE_DIR, FREEZE_MANIFEST_DIR), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  return [
    `[codexclaw freeze${args.dryRun ? " --dry-run" : ""}]`,
    `manifest: ${manifestPath}`,
    `slug: ${slug}`,
    `planFiles: ${planFiles.length}`,
    `planHash: ${manifest.planHash}`,
    `interviewReady: ${ready}`,
    `openAssumptions: ${evidenceBundle.openAssumptions.length}`,
    staleLine,
  ].join("\n");
}
