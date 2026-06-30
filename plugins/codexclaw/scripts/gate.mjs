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
 *    trailing `<!-- gate-ok: <reason> -->` when the claim is genuinely hook-backed.
 *  - checkCounts reads the real manifest at `.codex-plugin/plugin.json`.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..", "..");
const MVP_HARD = join("devlog", "_plan", "mvp_hard");

/** LOCKED status vocabulary (decision axis). No new tokens without updating the legend. */
export const STATUS_TOKENS = new Set([
  "DONE", "FROZEN", "PLANNED", "ANALYZED", "DEFERRED", "BLOCKED", "PROPOSED", "PARTIAL",
]);

/**
 * INDEX rows whose decade has NO own loop doc because the work is decomposed inside
 * another doc. Maps `Ln` -> the doc that actually carries its status narrative.
 * (L14-L19 decomposed in 141; L20 is a backlog row analyzed in mvp_res.)
 */
export const NO_OWN_DOC = new Map([
  ["L15", "141_L14_L19_contradiction_patch_plan.md"],
  ["L16", "141_L14_L19_contradiction_patch_plan.md"],
  ["L17", "141_L14_L19_contradiction_patch_plan.md"],
  ["L19", "141_L14_L19_contradiction_patch_plan.md"],
  ["L20", "141_L14_L19_contradiction_patch_plan.md"],
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
  const dir = join(repoRoot, MVP_HARD);
  if (!existsSync(dir)) return null;
  // a "top-level" loop doc starts with exactly the decade then `_` (e.g. 090_...); a
  // sub-loop (091_...) shares the decade prefix only when decade is itself 09x. Match
  // files whose numeric prefix EQUALS the decade.
  const hits = readdirSync(dir).filter((f) => /^([0-9]+)_/.test(f) && /^([0-9]+)_/.exec(f)[1] === decade);
  return hits.length === 1 ? join(dir, hits[0]) : null;
}

export function checkStatusSync(repoRoot = REPO_ROOT) {
  const violations = [];
  const indexPath = join(repoRoot, MVP_HARD, "000_INDEX.md");
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
    const docPath = docName ? join(repoRoot, MVP_HARD, docName) : resolveLoopDoc(repoRoot, row.decade);
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

function walkSkillMds(dir, out) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkSkillMds(p, out);
    else if (e.name === "SKILL.md") out.push(p);
  }
}

export function checkForbiddenClaims(repoRoot = REPO_ROOT) {
  const violations = [];
  const skillsDir = join(repoRoot, "plugins", "codexclaw", "skills");
  if (!existsSync(skillsDir)) return { ok: true, violations };
  const files = [];
  walkSkillMds(skillsDir, files);
  for (const f of files) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (GATE_OK.test(line)) return;
      if (FORBIDDEN_PATTERNS.some((re) => re.test(line))) {
        violations.push(`${f.replace(repoRoot + "/", "")}:${i + 1}: false-enforcement claim without gate-ok escape: "${line.trim().slice(0, 80)}"`);
      }
    });
  }
  return { ok: violations.length === 0, violations };
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
  };
  const violations = [
    ...checks.statusSync.violations,
    ...checks.forbiddenClaims.violations,
    ...checks.counts.violations,
  ];
  return { ok: violations.length === 0, checks, violations };
}

// CLI entry: print violations and exit 1 on any.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = runGate();
  if (result.ok) {
    console.log("[codexclaw gate] OK — no status drift, false-enforcement prose, or count mismatch.");
    process.exit(0);
  }
  console.error("[codexclaw gate] FAIL — drift detected:");
  for (const v of result.violations) console.error(`  - ${v}`);
  process.exit(1);
}
