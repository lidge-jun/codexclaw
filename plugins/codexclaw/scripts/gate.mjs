#!/usr/bin/env node
/**
 * gate.mjs — L18 (E8) drift gate. Pure, dependency-free Node. Three checks, each
 * returning { ok, violations: string[] }. `runGate()` aggregates; the CLI entry exits 1
 * on any violation so `npm run gate` and the gate test both fail on drift.
 *
 * Design notes (post-Rawls A-gate, 2026-06-30):
 *  - checkStatusSync compares each INDEX ledger row's DECISION-state to the leading
 *    token of the matching loop doc's `Status:` line. The two-axis legend
 *    (132_L13.2) makes the loop doc's leading token the decision axis; parentheticals
 *    ("DONE (runtime deferred)") express impl and are intentionally NOT parsed. The
 *    impl axis is governed separately (sub-loop docs + the forbidden-claims scan), so
 *    this gate does not phrase-scan impl honesty (that produced false positives on
 *    L9/L12, whose runtime later shipped via 091/092/093 and 121/122).
 *  - Rows decomposed inside another doc (no own decade file) are allowlisted.
 *  - checkForbiddenClaims uses NARROW false-enforcement patterns; a line opts out with a
 *    trailing `<!-- gate-ok: <reason> -->` when the claim is genuinely hook-backed. It
 *    scans both the skills SKILL.md tree and the declared SOT structure markdown; lines
 *    that NEGATE the phrase ("no hook enforces ...") or CITE it as an example/violation
 *    are exempt, since those are the opposite of a false assertion.
 *  - checkCounts reads the real manifest at `.codex-plugin/plugin.json`.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..", "..");
/**
 * Resolve the mvp_hard plan dir. It originally lived under `devlog/_plan/mvp_hard`, but
 * finished tracks may be archived to `devlog/_fin/mvp_hard`. Prefer the live `_plan`
 * location and fall back to the `_fin` archive so the gate keeps validating the canonical
 * INDEX after a reorg, without hardcoding a single path.
 */
function mvpHardDir(repoRoot) {
  const planDir = join("devlog", "_plan", "mvp_hard");
  if (existsSync(join(repoRoot, planDir))) return planDir;
  const finDir = join("devlog", "_fin", "mvp_hard");
  if (existsSync(join(repoRoot, finDir))) return finDir;
  return planDir; // default to the live path for the "missing INDEX" violation message
}

/** LOCKED status vocabulary (decision axis). No new tokens without updating the legend. */
export const STATUS_TOKENS = new Set([
  "DONE", "FROZEN", "PLANNED", "ANALYZED", "DEFERRED", "BLOCKED", "PROPOSED", "PARTIAL",
]);

/**
 * INDEX rows whose decade has NO own loop doc because the work is decomposed inside
 * another doc. Maps `Ln` -> the doc that actually carries its status narrative.
 * (L14-L19 decomposed in 141. L20 is NOT here: it has its own loop doc, 200_L20_gap_register.md,
 * whose leading `Status:` token the gate validates against the INDEX row directly.)
 */
export const NO_OWN_DOC = new Map([
  ["L15", "141_L14_L19_contradiction_patch_plan.md"],
  ["L16", "141_L14_L19_contradiction_patch_plan.md"],
  ["L17", "141_L14_L19_contradiction_patch_plan.md"],
]);

/** Extract the leading status token from a `Status: <TOKEN> ...` line. */
export function leadingStatusToken(statusLine) {
  const m = /^Status:\s*([A-Za-z]+)/m.exec(statusLine);
  return m ? m[1].toUpperCase() : null;
}

/** Parse the INDEX ledger table rows into { ln, decade, decision, impl }. */
export function parseIndexRows(indexText) {
  const rows = [];
  for (const line of indexText.split("\n")) {
    // | L9 | 090 | scope... | DONE | DONE |
    const m = /^\|\s*(L[0-9.]+)\s*\|\s*([0-9]+)\s*\|.*\|\s*([A-Za-z]+)\s*\|\s*([A-Za-z]+)\s*\|\s*$/.exec(line);
    if (m) rows.push({ ln: m[1], decade: m[2], decision: m[3].toUpperCase(), impl: m[4].toUpperCase() });
  }
  return rows;
}

/** Resolve the single loop doc for a decade, or null if zero / multiple top-level docs. */
function resolveLoopDoc(repoRoot, decade) {
  const dir = join(repoRoot, mvpHardDir(repoRoot));
  if (!existsSync(dir)) return null;
  // a "top-level" loop doc starts with exactly the decade then `_` (e.g. 090_...); a
  // sub-loop (091_...) shares the decade prefix only when decade is itself 09x. Match
  // files whose numeric prefix EQUALS the decade.
  const hits = readdirSync(dir).filter((f) => /^([0-9]+)_/.test(f) && /^([0-9]+)_/.exec(f)[1] === decade);
  return hits.length === 1 ? join(dir, hits[0]) : null;
}

export function checkStatusSync(repoRoot = REPO_ROOT) {
  const violations = [];
  const mvpHard = mvpHardDir(repoRoot);
  const indexPath = join(repoRoot, mvpHard, "000_INDEX.md");
  if (!existsSync(indexPath)) return { ok: false, violations: [`missing INDEX: ${indexPath}`] };
  const rows = parseIndexRows(readFileSync(indexPath, "utf8"));
  for (const row of rows) {
    if (!STATUS_TOKENS.has(row.decision)) {
      violations.push(`${row.ln}: INDEX decision-state '${row.decision}' is not in the LOCKED enum`);
      continue;
    }
    if (!STATUS_TOKENS.has(row.impl)) {
      violations.push(`${row.ln}: INDEX impl-state '${row.impl}' is not in the LOCKED enum`);
    }
    const docName = NO_OWN_DOC.get(row.ln);
    const docPath = docName ? join(repoRoot, mvpHard, docName) : resolveLoopDoc(repoRoot, row.decade);
    if (!docPath || !existsSync(docPath)) {
      violations.push(`${row.ln} (decade ${row.decade}): no single loop doc resolved (add to NO_OWN_DOC or create the decade doc)`);
      continue;
    }
    // Rows whose narrative lives inside a shared decomposition doc carry no own
    // leading Status token; the INDEX row IS their source of truth, so skip the
    // token-equality check for them (their existence in the shared doc is enough).
    if (docName) continue;
    const token = leadingStatusToken(readFileSync(docPath, "utf8"));
    if (!token) {
      violations.push(`${row.ln}: loop doc ${docName ?? row.decade} has no parseable 'Status:' line`);
    } else if (token !== row.decision) {
      violations.push(`${row.ln}: INDEX decision-state '${row.decision}' != loop doc leading status '${token}' (${docPath.replace(repoRoot + "/", "")})`);
    }
  }
  return { ok: violations.length === 0, violations };
}

/** NARROW false-enforcement patterns. A real, hook-backed claim opts out via gate-ok. */
export const FORBIDDEN_PATTERNS = [
  /\bhook\s+(?:(?:automatically|auto-)\s+)?(?:loads|reads|injects)\s+the\b/i,
  /\bautomatically\s+(?:loads|reads|injects)\s+the\s+\S+\s+skill\b/i,
  /\bhook\s+enforces\s+(?:the\s+)?skill\s+(?:load|read)\b/i,
];
const GATE_OK = /<!--\s*gate-ok:[^>]*-->/;

/**
 * NEGATION cue: the matched phrase is denied on the same line (e.g. "No hook enforces
 * skill load", "this is guidance (no hook enforces ...)"). A denied false-claim is the
 * OPPOSITE of a false-enforcement assertion, so it must not be flagged.
 */
const NEGATION_CUE = /\b(?:no|not|never|cannot|can't|can not|don't|do not|doesn't|does not|without|isn't|is not|aren't|are not)\b/i;
/**
 * META cue: the matched phrase is being CITED as an example/violation/pattern (e.g. the
 * gate's own docs that quote "hook automatically loads the X skill" to explain the rule).
 */
const META_CUE = /\b(?:example|violation|violations|forbidden|phrase|claim|claims|sentence|pattern|checkForbiddenClaims|gate-ok)\b/i;

/** A line is exempt when it opts out, negates the claim, or merely cites it as an example. */
function isExemptClaimLine(line) {
  return GATE_OK.test(line) || NEGATION_CUE.test(line) || META_CUE.test(line);
}

function walkSkillMds(dir, out) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkSkillMds(p, out);
    else if (e.name === "SKILL.md") out.push(p);
  }
}

export function checkForbiddenClaims(repoRoot = REPO_ROOT) {
  const violations = [];
  const files = [];
  const skillsDir = join(repoRoot, "plugins", "codexclaw", "skills");
  if (existsSync(skillsDir)) walkSkillMds(skillsDir, files);
  // structure/*.md is declared SOT (E7 doctrine) and must be held to the same honesty bar.
  const structureDir = join(repoRoot, "structure");
  if (existsSync(structureDir)) {
    for (const e of readdirSync(structureDir, { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith(".md")) files.push(join(structureDir, e.name));
    }
  }
  for (const f of files) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (isExemptClaimLine(line)) return;
      if (FORBIDDEN_PATTERNS.some((re) => re.test(line))) {
        violations.push(`${relative(repoRoot, f).split(sep).join("/")}:${i + 1}: false-enforcement claim without gate-ok escape: "${line.trim().slice(0, 80)}"`);
      }
    });
  }
  return { ok: violations.length === 0, violations };
}

/**
 * checkVerifierClaims (WP1/100, E8-WARN) — plan documents under `devlog/_plan/` sometimes
 * name a "verifier command" that cannot actually verify anything. The canonical case: a doc
 * declares `npx tsc --noEmit` while the repo has no root `tsconfig.json`, so the command
 * prints help and checks nothing.
 *
 * This check REPORTS and never blocks: it returns `{ ok: true, warnings }` and `runGate`
 * keeps it out of `violations`, so `npm run gate` still exits 0. Rationale: this unit's own
 * plan docs currently carry 7 such claims; failing the gate would wall off all work before
 * those docs can be fixed slice by slice.
 *
 * KNOWN LIMITS (PLAN-BYPASS-NAMED-01, recorded honestly):
 *  - tier E8 (out-of-band), executing surface `npm run gate` / this function.
 *  - bypass: omit the `검증 명령` marker, reword the line, or move the doc out of `_plan/`.
 *  - residual risk: a doc can still name a dead verifier and go unreported.
 *  - final enforcement layer: none. This is an early warning, not enforcement.
 *  - the marketplace payload is only `plugins/codexclaw/`, so `devlog/` does not ship;
 *    in an installed plugin this check finds nothing and stays silent by construction.
 *
 * PARSING (deliberately narrow — free-prose scanning produced self-matches):
 * only lines starting with `검증 명령` are read, in two shapes:
 *   1. inline  — `검증 명령: `npm test`, `npx tsc --noEmit`, `npm run gate`.`
 *   2. bulleted — a `검증 명령` line followed (after a blank line) by `- `cmd` — note` items.
 * A candidate carrying `적지 않는다` is an explicit opt-out; tables, code fences and all
 * other prose are ignored.
 */
const VERIFIER_BLOCK_RE = /^검증 명령/;
const OPT_OUT_RE = /적지 않는다/;
const BACKTICK_CMD_RE = /`([^`]+)`/g;

function collectVerifierClaims(text) {
  const out = [];
  const lines = text.split("\n");
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (!VERIFIER_BLOCK_RE.test(line)) continue;
    // shape 1: commands on the marker line itself.
    if (!OPT_OUT_RE.test(line)) {
      for (const m of line.matchAll(BACKTICK_CMD_RE)) out.push({ line: i + 1, cmd: m[1] });
    }
    // shape 2: a bullet list that follows; stop at the first non-bullet, non-blank line.
    for (let j = i + 1; j < lines.length; j++) {
      const b = lines[j];
      if (b.trim() === "") continue;
      if (!/^\s*-\s/.test(b)) break;
      if (OPT_OUT_RE.test(b)) continue;
      const first = b.match(/`([^`]+)`/);
      if (first) out.push({ line: j + 1, cmd: first[1] });
    }
  }
  return out;
}

function walkPlanMds(dir, out) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkPlanMds(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
}

export function checkVerifierClaims(repoRoot = REPO_ROOT) {
  const warnings = [];
  const planDir = join(repoRoot, "devlog", "_plan");
  // `devlog/_fin/` is finished work and is deliberately out of scope.
  if (!existsSync(planDir)) return { ok: true, warnings };
  const files = [];
  walkPlanMds(planDir, files);
  const hasTsconfig = existsSync(join(repoRoot, "tsconfig.json"));
  for (const f of files) {
    const rel = relative(repoRoot, f).split(sep).join("/");
    const body = readFileSync(f, "utf8");
    for (const { line, cmd } of collectVerifierClaims(body)) {
      if (/\btsc\b/.test(cmd) && /--noEmit/.test(cmd) && !/-p\s|--project/.test(cmd) && !hasTsconfig) {
        warnings.push(`${rel}:${line}: "${cmd}" cannot verify anything — no root tsconfig.json (it prints help and exits)`);
        continue;
      }
      const nodeTest = cmd.match(/^node\s+--test\s+(\S+)$/);
      if (nodeTest) {
        const target = nodeTest[1];
        if (target.includes("*")) continue; // glob: existence is not decidable here
        if (existsSync(join(repoRoot, target))) continue;
        // exempt only when the SAME doc's file-change map marks that exact path 신규,
        // i.e. a single line holding both `<target>` in backticks and the 신규 marker.
        const marked = body.split("\n").some(
          (l) => l.includes(`\`${target}\``) && l.includes("신규"),
        );
        if (marked) continue;
        warnings.push(`${rel}:${line}: "${cmd}" names a test path that does not exist and is not marked 신규 in this doc's file-change map`);
      }
    }
  }
  return { ok: true, warnings };
}

export function checkCounts(repoRoot = REPO_ROOT) {
  const violations = [];
  const manifestPath = join(repoRoot, "plugins", "codexclaw", ".codex-plugin", "plugin.json");
  const hooksDir = join(repoRoot, "plugins", "codexclaw", "hooks");
  if (!existsSync(manifestPath)) return { ok: false, violations: [`missing manifest: ${manifestPath}`] };
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const declared = Array.isArray(manifest.hooks) ? manifest.hooks.length : 0;
  const onDisk = existsSync(hooksDir) ? readdirSync(hooksDir).filter((f) => f.endsWith(".json")).length : 0;
  if (declared !== onDisk) {
    violations.push(`hook count mismatch: plugin.json declares ${declared}, hooks/ has ${onDisk} JSON file(s)`);
  }
  return { ok: violations.length === 0, violations };
}

export function runGate(repoRoot = REPO_ROOT) {
  const checks = {
    statusSync: checkStatusSync(repoRoot),
    forbiddenClaims: checkForbiddenClaims(repoRoot),
    counts: checkCounts(repoRoot),
    // WP1/100: report-only. Its findings go to `warnings`, never `violations`, so a dead
    // verifier claim is surfaced without walling off work (see checkVerifierClaims).
    verifierClaims: checkVerifierClaims(repoRoot),
  };
  const violations = [
    ...checks.statusSync.violations,
    ...checks.forbiddenClaims.violations,
    ...checks.counts.violations,
  ];
  const warnings = [...checks.verifierClaims.warnings];
  return { ok: violations.length === 0, checks, violations, warnings };
}

// CLI entry: print violations and exit 1 on any.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = runGate();
  // Warnings print on BOTH paths and never change the exit code (WP1/100).
  const printWarnings = () => {
    if (!result.warnings?.length) return;
    console.error(`[codexclaw gate] WARN — ${result.warnings.length} verifier-claim issue(s):`);
    for (const w of result.warnings) console.error(`  - ${w}`);
  };
  if (result.ok) {
    console.log("[codexclaw gate] OK — no status drift, false-enforcement prose, or count mismatch.");
    printWarnings();
    process.exit(0);
  }
  console.error("[codexclaw gate] FAIL — drift detected:");
  for (const v of result.violations) console.error(`  - ${v}`);
  printWarnings();
  process.exit(1);
}
