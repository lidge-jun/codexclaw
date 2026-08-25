/**
 * plan-cli.ts — `cxc plan init <slug> [--phases N] [--cwd <path>]` (260714 wp2).
 *
 * Scaffolds the devlog/_plan/YYMMDD_slug/ implementation unit that the P>A
 * plan-gate (plan-gate.ts) verifies: 000_plan.md plus one decade doc per
 * work-phase. Stubs carry the DIFFLEVEL-ROADMAP-01 header — scaffolding is NOT
 * planning; each doc must be written to diff-level before P -> A.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

















/** Local YYMMDD (no shared helper exists; recall/rollout.ts uses YYYY-MM-DD). */
export function yymmdd(d       = new Date())         {
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/**
 * Split a leading YYMMDD date prefix off a positional slug.
 *
 * Users copy the directory convention (`260821_win-linux-optimization`) straight
 * off disk and pass it back. Prepending today's date to that produced
 * `260821_260821-win-linux-optimization` (issue #30), so the prefix is parsed out
 * and reused rather than stacked.
 *
 * Both separators are accepted because both appear in the wild: `_` is the unit
 * convention and `-` is what `deriveSlug` turns it into on a prior mangled run.
 *
 * A date-only positional (`260821_`) yields an empty `rest`, which the caller
 * rejects - a bare date is not a unit name.
 */
export function splitDatePrefix(raw        )                                        {
  const m = /^(\d{6})[_-](.*)$/.exec(raw.trim());
  if (!m) return { date: null, rest: raw.trim() };
  return { date: m[1], rest: m[2] };
}

/**
 * Slug for a plan unit. Unlike `deriveSlug` (freeze.ts:60), the underscore is a
 * legal slug character here: `my_slug` is a name the user chose, and silently
 * returning `my-slug` creates a directory they did not ask for (issue #30).
 */
export function derivePlanSlug(raw        )         {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Structural argv parse. argv excludes the `plan` kind token. */
export function parsePlanCliArgs(argv          , cwd        )                                  {
  const verb = (argv[0] ?? "").toLowerCase();
  // #47 finished (260825 wp1): --help was an unknown verb, so the top-level help's
  // "run <cmd> --help" pointer led to a rejection.
  if (argv.length === 0 || verb === "help" || verb === "--help" || verb === "-h") {
    return { verb: "help", slug: "", phases: 1, cwd, date: null };
  }
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
  const { date, rest } = splitDatePrefix(slug);
  const derived = derivePlanSlug(rest);
  if (derived === "") {
    return { error: `plan init: '${slug}' has no usable slug once its date prefix is removed` };
  }
  return { verb: "init", slug: derived, phases, cwd: outCwd, date };
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
  if (args.verb === "help") {
    return {
      code: 0,
      output: [
        "cxc plan — scaffold a devlog plan unit (DIFFLEVEL-ROADMAP-01)",
        "",
        "Usage:",
        "  cxc plan init --slug <slug> [--phases <n>] [--date <YYMMDD>] [--cwd <path>]",
        "  cxc plan --help",
        "",
        "Notes:",
        "  Creates devlog/_plan/<YYMMDD>_<slug>/ with 000_plan.md plus one decade doc",
        "  (010, 020, ...) per phase. P>A requires such a unit to exist on disk with",
        "  numbered docs — a chat-message plan does not satisfy Plan.",
        "  --date is for callers that already carry their own prefix; omit it to stamp today.",
        "  init refuses to overwrite an existing unit.",
      ].join("\n"),
    };
  }
  // args.date is the caller's own prefix when they passed one; only stamp today
  // when they did not (issue #30 - the doubled prefix came from stamping always).
  const unitName = `${args.date ?? yymmdd()}_${args.slug}`;
  const unitDir = resolve(args.cwd, "devlog", "_plan", unitName);
  if (existsSync(unitDir)) {
    return { output: `plan init: ${unitDir} already exists — refusing to overwrite. Write your docs there.`, code: 1 };
  }
  try {
    mkdirSync(unitDir, { recursive: true });
    writeFileSync(join(unitDir, "000_plan.md"), planDoc(args.slug), "utf8");
    for (let n = 1; n <= args.phases; n++) {
      // 3-digit decade convention: 010, 020, ... 100. padStart keeps that true
      // past 9 phases even though the parser caps at 9 today.
      const decade = String(n * 10).padStart(3, "0");
      writeFileSync(join(unitDir, `${decade}_phase${n}.md`), phaseDoc(n, args.slug), "utf8");
    }
  } catch (err) {
    return { output: `plan init failed: ${err instanceof Error ? err.message : String(err)}`, code: 1 };
  }
  // 002 B18: the old local was named `rel` while holding an absolute path, which on
  // Windows printed a full C:\Users\... line under a variable promising otherwise.
  const shown = relative(args.cwd, unitDir) || unitDir;
  return {
    output:
      `plan init: scaffolded ${shown} (000_plan.md + ${args.phases} phase doc(s)).\n` +
      `Write every doc to diff-level BEFORE P -> A; the P>A gate requires planUnit to carry numbered docs.`,
    code: 0,
  };
}
