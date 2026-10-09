#!/usr/bin/env node
/**
 * check-prompt-architecture.mjs — repository gate for the prompt layering standard
 * (structure/70_prompt_architecture.md). Offline and dependency-free.
 *
 * Checks (violations fail gate.mjs):
 *  1. L2 catalog: SKILL.md "description" <= 320 chars, agents/openai.yaml short_description <= 100.
 *  2. L3 routers: whole SKILL.md bytes <= dev 12288, loop/pabcd 8192, others 10240.
 *     Files over budget are recorded in prompt-architecture-baseline.json at their EXACT
 *     size: a recorded file that grows or shrinks must have its record changed in the same
 *     diff, and only skills in the frozen ELIGIBLE sets below may be recorded at all.
 *  3. Every relative Markdown link under skills/** resolves, including a #fragment.
 *  4. A rule ID is defined (heading containing it, or "ID (CLASS" / "ID, CLASS)") in at
 *     most one file; legacy multi-file definitions are frozen in the baseline and may only
 *     lose files.
 * --report adds advice: references over 24 KiB and >=80-char sentences repeated verbatim
 * across files. Bypass: editing the baseline or the ELIGIBLE sets in the same PR. Both are
 * visible diffs, so this is early warning for reviewers, not enforcement.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PLUGIN_ROOT = resolve(HERE, "..");
export const BUDGET = { description: 320, shortDescription: 100, router: { dev: 12288, loop: 8192, pabcd: 8192, default: 10240 }, referenceReport: 24576 };
const CLASSES = "STRICT|DEFAULT|HEURISTIC|ESCALATE|STYLE_SAMPLE";
const ID_RE = /\b([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d{2})\b/g;

// Frozen when the gate was introduced (2026-10-09). Shrinking these sets is fine;
// growing them is a reviewable policy change.
export const ELIGIBLE = {
  descriptions: new Set(["ast-grep", "dev-architecture", "dev-backend", "dev-code-reviewer", "dev-data", "dev-debugging", "dev-devops", "dev-frontend", "dev-scaffolding", "dev-testing", "dev-uiux-design", "dev-visualizer", "interview", "kwrite", "lunasearch", "qa", "recall", "remote", "search", "worktree-guardian"]),
  routers: new Set(["dev-architecture", "dev-backend", "dev-code-reviewer", "dev-data", "dev-debugging", "dev-devops", "dev-frontend", "dev-scaffolding", "dev-security", "dev-testing", "dev-uiux-design", "dev-visualizer", "interview", "qa", "recall", "search"]),
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== "node_modules") walk(p, out); }
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

export function frontmatterDescription(text) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!fm) return null;
  const line = fm[1].split("\n").find((l) => l.startsWith("description:"));
  if (!line) return null;
  let v = line.slice("description:".length).trim();
  if (v.startsWith('"')) { try { v = JSON.parse(v); } catch { v = v.slice(1, -1); } }
  else if (v.startsWith("'")) v = v.slice(1, -1).replace(/''/g, "'");
  return v;
}

function shortDescription(yamlText) {
  const m = /^\s*short_description:\s*(.*)$/m.exec(yamlText);
  if (!m) return null;
  let v = m[1].trim();
  if (v.startsWith('"')) { try { v = JSON.parse(v); } catch { v = v.slice(1, -1); } }
  else if (v.startsWith("'")) v = v.slice(1, -1).replace(/''/g, "'");
  return v;
}

/** GitHub-style heading slug. */
export function slug(heading) {
  return heading.trim().toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
}

function stripCode(text) {
  return text.replace(/^(\x60{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "").replace(/\x60[^\x60\n]*\x60/g, "");
}

function headings(text) {
  const out = new Set();
  const counts = new Map();
  for (const m of stripCode(text).matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const explicit = /\{#([A-Za-z0-9_-]+)\}\s*$/.exec(m[1]);
    if (explicit) out.add(explicit[1].toLowerCase());
    const base = slug(m[1].replace(/\s*\{#[A-Za-z0-9_-]+\}\s*$/, ""));
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    out.add(n === 0 ? base : base + "-" + n);
  }
  return out;
}

export function loadBaseline(pluginRoot) {
  const p = join(pluginRoot, "scripts", "prompt-architecture-baseline.json");
  if (!existsSync(p)) return { descriptions: {}, shortDescriptions: {}, routers: {}, idDefinitions: {} };
  const b = JSON.parse(readFileSync(p, "utf8"));
  return { descriptions: b.descriptions ?? {}, shortDescriptions: b.shortDescriptions ?? {}, routers: b.routers ?? {}, idDefinitions: b.idDefinitions ?? {} };
}

function ratchet(kind, key, actual, budget, baseline, eligible, violations, unit) {
  const recorded = baseline[key];
  if (recorded === undefined) {
    if (actual > budget) violations.push(kind + " " + key + ": " + actual + " " + unit + " exceeds " + budget);
    return;
  }
  if (!eligible.has(key)) violations.push(kind + " " + key + ": baseline entry for a skill outside the frozen eligible set");
  if (actual !== recorded) violations.push(kind + " " + key + ": " + actual + " " + unit + " but the baseline records " + recorded + (actual < recorded ? " (lower the record" + (actual <= budget ? " or delete it" : "") + ")" : " (growth needs a reviewed baseline change)"));
}

export function checkPromptArchitecture({ pluginRoot = DEFAULT_PLUGIN_ROOT, baseline = loadBaseline(pluginRoot), report = false } = {}) {
  const skillsDir = join(pluginRoot, "skills");
  const violations = [];
  const advice = [];
  const sizes = {};
  for (const name of readdirSync(skillsDir).sort()) {
    const skillMd = join(skillsDir, name, "SKILL.md");
    if (!existsSync(skillMd)) continue;
    const text = readFileSync(skillMd, "utf8");
    const desc = frontmatterDescription(text);
    if (desc === null) violations.push("description " + name + ": missing frontmatter description");
    else ratchet("description", name, [...desc].length, BUDGET.description, baseline.descriptions, ELIGIBLE.descriptions, violations, "chars");
    const yaml = join(skillsDir, name, "agents", "openai.yaml");
    if (existsSync(yaml)) {
      const sd = shortDescription(readFileSync(yaml, "utf8"));
      if (sd !== null) ratchet("short_description", name, [...sd].length, BUDGET.shortDescription, baseline.shortDescriptions, ELIGIBLE.descriptions, violations, "chars");
    }
    const bytes = Buffer.byteLength(text);
    sizes[name] = bytes;
    ratchet("router", name, bytes, BUDGET.router[name] ?? BUDGET.router.default, baseline.routers, ELIGIBLE.routers, violations, "bytes");
  }

  const files = walk(skillsDir);
  const headingCache = new Map();
  const headingsOf = (p) => { if (!headingCache.has(p)) headingCache.set(p, headings(readFileSync(p, "utf8"))); return headingCache.get(p); };
  const defs = new Map();
  const sentences = new Map();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const rel = relative(pluginRoot, file).split(sep).join("/");
    const prose = stripCode(text);
    for (const m of prose.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const target = m[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      const [pathPart, frag] = target.split("#");
      const dest = pathPart ? resolve(dirname(file), decodeURIComponent(pathPart)) : file;
      if (!existsSync(dest)) { violations.push("link " + rel + ": " + target + " does not exist"); continue; }
      if (frag && dest.endsWith(".md") && !headingsOf(dest).has(frag.toLowerCase())) violations.push("link " + rel + ": #" + frag + " is not a heading in " + relative(pluginRoot, dest).split(sep).join("/"));
    }
    for (const line of prose.split("\n")) {
      const isHeading = /^#{1,6}\s/.test(line);
      for (const m of line.matchAll(ID_RE)) {
        const id = m[1];
        const after = line.slice(m.index + id.length, m.index + id.length + 24);
        const defined = isHeading || new RegExp("^\\)?\\*{0,2}\\s*[(,]\\s*(?:" + CLASSES + ")\\b").test(after);
        if (!defined) continue;
        if (!defs.has(id)) defs.set(id, new Set());
        defs.get(id).add(rel);
      }
      if (report) for (const s of line.split(/(?<=[.!?])\s+/)) {
        const n = s.replace(/[*_\x60]/g, "").replace(/\s+/g, " ").trim();
        if (n.length < 80) continue;
        if (!sentences.has(n)) sentences.set(n, new Set());
        sentences.get(n).add(rel);
      }
    }
    if (report && !file.endsWith("SKILL.md") && Buffer.byteLength(text) > BUDGET.referenceReport) advice.push("reference " + rel + ": " + Buffer.byteLength(text) + " bytes (> " + BUDGET.referenceReport + ")");
  }
  for (const [id, where] of defs) {
    const frozen = baseline.idDefinitions[id];
    if (frozen) {
      for (const f of where) if (!frozen.includes(f)) violations.push("rule " + id + ": new definition in " + f + " (frozen legacy list: " + frozen.join(", ") + ")");
    } else if (where.size > 1) {
      violations.push("rule " + id + ": defined in " + where.size + " files: " + [...where].sort().join(", "));
    }
  }
  for (const id of Object.keys(baseline.idDefinitions)) if (!defs.has(id) || defs.get(id).size <= 1) violations.push("rule " + id + ": legacy baseline entry no longer needed (now " + (defs.get(id)?.size ?? 0) + " definition); delete it");
  if (report) for (const [s, where] of sentences) if (where.size > 1) advice.push("repeated in " + [...where].sort().join(", ") + ": " + s.slice(0, 120));
  return { ok: violations.length === 0, violations, advice, sizes, definitions: Object.fromEntries([...defs].map(([k, v]) => [k, [...v].sort()])) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--plugin-root");
  const pluginRoot = i >= 0 ? resolve(args[i + 1]) : DEFAULT_PLUGIN_ROOT;
  const result = checkPromptArchitecture({ pluginRoot, report: args.includes("--report") });
  if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else {
    for (const v of result.violations) console.error("  - " + v);
    for (const a of result.advice) console.log("  advice: " + a);
    console.log("[prompt-architecture] " + (result.ok ? "OK" : "FAIL — " + result.violations.length + " violation(s)"));
  }
  process.exit(result.ok ? 0 : 1);
}
