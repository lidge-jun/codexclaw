/**
 * plan-cli.ts — `cxc plan init <slug> [--phases N] [--cwd <path>]` (260714 wp2).
 *
 * Scaffolds the devlog/_plan/YYMMDD_slug/ implementation unit that the P>A
 * plan-gate (plan-gate.ts) verifies: 000_plan.md plus one decade doc per
 * work-phase. Stubs carry the DIFFLEVEL-ROADMAP-01 header — scaffolding is NOT
 * planning; each doc must be written to diff-level before P -> A.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { deriveSlug } from "./freeze.js";













/** Local YYMMDD (no shared helper exists; recall/rollout.ts uses YYYY-MM-DD). */
export function yymmdd(d       = new Date())         {
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/** Structural argv parse. argv excludes the `plan` kind token. */
export function parsePlanCliArgs(argv          , cwd        )                                  {
  const verb = (argv[0] ?? "").toLowerCase();
  if (verb !== "init") {
    return { error: `unknown plan verb '${argv[0] ?? ""}' (expected init)` };
  }
  let slug = "";
  let phases = 1;
  let outCwd = cwd;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--phases") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1 || n > 9) return { error: "--phases expects an integer 1-9" };
      phases = n;
    } else if (a === "--cwd") outCwd = argv[++i] ?? cwd;
    else if (!a.startsWith("--") && slug === "") slug = a;
  }
  if (slug === "") return { error: "plan init requires a <slug> argument" };
  return { verb: "init", slug: deriveSlug(slug), phases, cwd: outCwd };
}

const HEADER_NOTE =
  "> DIFFLEVEL-ROADMAP-01: write this doc to full diff-level precision (exact paths,\n" +
  "> NEW/MODIFY/DELETE, before/after diffs) BEFORE P -> A. An empty scaffold does not\n" +
  "> satisfy the rule; the A-phase reviewer FAILS outline-only phase docs.\n";

function planDoc(slug        )         {
  return [
    `# 000 — ${slug}: Plan`,
    "",
    HEADER_NOTE,
    "## Objective",
    "",
    "(fill in: the concrete outcome, the observed failure, the evidence base)",
    "",
    "## Loop-spec",
    "",
    "- Loop archetype: (verifier-defined | judged)",
    "- Write scope / out-of-scope:",
    "- Budget / bounds:",
    "",
    "## Work-phase map (one phase = one full PABCD cycle)",
    "",
    "| WP | Doc | Slice | Depends on |",
    "|----|-----|-------|------------|",
    "",
    "## Accept criteria",
    "",
    "- (mirror into the goalplan criteria[])",
    "",
  ].join("\n");
}

function phaseDoc(n        , slug        )         {
  return [
    `# 0${n}0 — Phase ${n} (${slug})`,
    "",
    HEADER_NOTE,
    "## MODIFY / NEW / DELETE map",
    "",
    "(fill in: exact file paths with before/after diffs — a copy-paste-executable PRD)",
    "",
    "## TESTS",
    "",
    "(fill in: test files + cases)",
    "",
    "## Verification (C)",
    "",
    "(fill in: exact commands + expected exit codes)",
    "",
  ].join("\n");
}

export function runPlanCli(args             )                {
  const unitDir = resolve(args.cwd, "devlog", "_plan", `${yymmdd()}_${args.slug}`);
  if (existsSync(unitDir)) {
    return { output: `plan init: ${unitDir} already exists — refusing to overwrite. Write your docs there.`, code: 1 };
  }
  try {
    mkdirSync(unitDir, { recursive: true });
    writeFileSync(join(unitDir, "000_plan.md"), planDoc(args.slug), "utf8");
    for (let n = 1; n <= args.phases; n++) {
      writeFileSync(join(unitDir, `0${n}0_phase${n}.md`), phaseDoc(n, args.slug), "utf8");
    }
  } catch (err) {
    return { output: `plan init failed: ${err instanceof Error ? err.message : String(err)}`, code: 1 };
  }
  const rel = unitDir;
  return {
    output:
      `plan init: scaffolded ${rel} (000_plan.md + ${args.phases} phase doc(s)).\n` +
      `Write every doc to diff-level BEFORE P -> A; the P>A gate requires planUnit to carry numbered docs.`,
    code: 0,
  };
}
