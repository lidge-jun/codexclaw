#!/usr/bin/env node
/**
 * inventory.mjs — the single source of truth for codexclaw shipped inventory.
 *
 * Why this exists: gate.mjs compared CARDINALITY only, so an equal-count manifest
 * substitution, a duplicated manifest path, or one undeclared file cancelling one
 * missing declaration all passed a green gate. Meanwhile the published docs drifted
 * to 18 hooks / 25-27 skills / 1,213 tests while the payload shipped 21 / 28 / 1,631,
 * and the docs site advertised a cxc-ultraresearch skill that does not exist.
 *
 * Design rules:
 *  - Store IDENTITIES, never standalone counts. Every rendered count is array.length
 *    at generation time, so a number cannot be edited independently of its list.
 *  - No commit SHA and no test count in the committed artifact. Binding a committed
 *    file to its own commit never converges; test provenance belongs to the release
 *    candidate manifest.
 *  - Compare SETS in both directions and report the symmetric difference by name.
 *
 * Usage:
 *   node plugins/codexclaw/scripts/inventory.mjs --check
 *   node plugins/codexclaw/scripts/inventory.mjs --write [--tests <n>]
 *   node plugins/codexclaw/scripts/inventory.mjs --hash
 *   node plugins/codexclaw/scripts/inventory.mjs --published
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const PLUGIN_ROOT = resolve(HERE, "..");
export const REPO_ROOT = resolve(PLUGIN_ROOT, "..", "..");
export const INVENTORY_PATH = join(PLUGIN_ROOT, "inventory.json");
export const SCHEMA_VERSION = 1;

function readManifest(pluginRoot = PLUGIN_ROOT) {
  return JSON.parse(readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
}

export function collectSkills(pluginRoot = PLUGIN_ROOT) {
  const dir = join(pluginRoot, "skills");
  return readdirSync(dir)
    .filter((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() && existsSync(join(p, "SKILL.md"));
    })
    .sort()
    .map((folder) => {
      const body = readFileSync(join(dir, folder, "SKILL.md"), "utf8");
      const name = /^name:\s*(\S+)/m.exec(body)?.[1] ?? folder;
      return { folder, name };
    });
}

export function collectHooks(pluginRoot = PLUGIN_ROOT) {
  const manifest = readManifest(pluginRoot);
  return manifest.hooks
    .map((ref) => {
      const file = ref.replace(/^\.\/hooks\//, "");
      const full = join(pluginRoot, "hooks", file);
      if (!existsSync(full)) return { file, event: null, component: null, matcher: null };
      const json = JSON.parse(readFileSync(full, "utf8"));
      const event = Object.keys(json.hooks ?? {})[0] ?? null;
      const group = event ? json.hooks[event]?.[0] : null;
      const command = group?.hooks?.[0]?.command ?? "";
      const component = /components\/([a-z0-9-]+)\//.exec(command)?.[1] ?? null;
      return { file, event, component, matcher: group?.matcher ?? null };
    })
    .sort((a, b) => a.file.localeCompare(b.file));
}

export function collectComponents(pluginRoot = PLUGIN_ROOT) {
  const dir = join(pluginRoot, "components");
  return readdirSync(dir)
    .filter((name) => existsSync(join(dir, name, "package.json")))
    .sort()
    .map((folder) => {
      const pkg = JSON.parse(readFileSync(join(dir, folder, "package.json"), "utf8"));
      return {
        folder,
        packageName: pkg.name ?? folder,
        version: pkg.version ?? null,
        hasTests: existsSync(join(dir, folder, "test")),
      };
    });
}

export function collectInventory(pluginRoot = PLUGIN_ROOT, repoRoot = REPO_ROOT) {
  const manifest = readManifest(pluginRoot);
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  return {
    schemaVersion: SCHEMA_VERSION,
    plugin: {
      name: manifest.name,
      manifestVersion: manifest.version,
      packageVersion: pkg.version,
    },
    skills: collectSkills(pluginRoot),
    hooks: collectHooks(pluginRoot),
    components: collectComponents(pluginRoot),
  };
}

function symmetricDifference(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  return {
    onlyInA: [...setA].filter((x) => !setB.has(x)).sort(),
    onlyInB: [...setB].filter((x) => !setA.has(x)).sort(),
  };
}

function duplicates(list) {
  const seen = new Set();
  const dupes = new Set();
  for (const x of list) (seen.has(x) ? dupes : seen).add(x);
  return [...dupes].sort();
}

function readCatalogSkills(pluginRoot = PLUGIN_ROOT) {
  const p = join(pluginRoot, "skills", "README.md");
  if (!existsSync(p)) return null;
  const m = /<!-- skill-catalog:start -->\n([\s\S]*?)\n<!-- skill-catalog:end -->/.exec(
    readFileSync(p, "utf8"),
  );
  if (!m) return null;
  return m[1]
    .split("\n")
    .map((l) => /^- `([a-z0-9][a-z0-9-]*)\/`$/.exec(l.trim())?.[1] ?? null)
    .filter(Boolean)
    .sort();
}

function readTestedComponents(repoRoot = REPO_ROOT) {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const script = pkg.scripts?.test ?? "";
  return [...script.matchAll(/components\/([a-z0-9-]+)\/test/g)].map((m) => m[1]).sort();
}

/**
 * The check the old cardinality comparison could not make: manifest and filesystem
 * hook SETS must be equal in both directions, with no duplicates.
 */
export function checkSets(pluginRoot = PLUGIN_ROOT, repoRoot = REPO_ROOT) {
  const violations = [];
  const manifest = readManifest(pluginRoot);

  const manifestHooks = manifest.hooks.map((h) => h.replace(/^\.\/hooks\//, ""));
  const dupeHooks = duplicates(manifestHooks);
  if (dupeHooks.length) {
    violations.push("duplicate manifest hook entries: " + dupeHooks.join(", "));
  }

  const hooksDir = join(pluginRoot, "hooks");
  const fsHooks = readdirSync(hooksDir).filter((f) => f.endsWith(".json"));
  const hookDiff = symmetricDifference(manifestHooks, fsHooks);
  for (const f of hookDiff.onlyInA) {
    violations.push("hook declared in manifest but missing on disk: " + f);
  }
  for (const f of hookDiff.onlyInB) {
    violations.push("hook file on disk but not declared in manifest: " + f);
  }

  const fsSkills = collectSkills(pluginRoot).map((s) => s.folder);
  const catalog = readCatalogSkills(pluginRoot);
  if (catalog) {
    const skillDiff = symmetricDifference(fsSkills, catalog);
    for (const f of skillDiff.onlyInA) {
      violations.push("skill ships but is absent from the skills/README.md catalog: " + f);
    }
    for (const f of skillDiff.onlyInB) {
      violations.push("skills/README.md catalog lists a skill that does not ship: " + f);
    }
  }

  const withTests = collectComponents(pluginRoot)
    .filter((c) => c.hasTests)
    .map((c) => c.folder);
  const compDiff = symmetricDifference(withTests, readTestedComponents(repoRoot));
  for (const f of compDiff.onlyInA) {
    violations.push("component has tests but the root test script does not run them: " + f);
  }
  for (const f of compDiff.onlyInB) {
    violations.push("root test script names a component without a test directory: " + f);
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Registered surfaces that publish an inventory number. The release gate compares
 * these MEASURED values against the candidate testSuite, so the comparison is never
 * tautological.
 */
export const PUBLISHED_SURFACES = [
  { file: "README.md", kind: "tests", re: /badge\/tests-([\d%C,]+)_passing/ },
  { file: "README.ko.md", kind: "tests", re: /badge\/tests-([\d%C,]+)_passing/ },
  { file: "README.zh.md", kind: "tests", re: /badge\/tests-([\d%C,]+)_passing/ },
  { file: "README.md", kind: "skills", re: /badge\/skills-(\d+)-/ },
  { file: "README.ko.md", kind: "skills", re: /badge\/skills-(\d+)-/ },
  { file: "README.zh.md", kind: "skills", re: /badge\/skills-(\d+)-/ },
  { file: "README.md", kind: "hooks", re: /badge\/hooks-(\d+)-/ },
  { file: "README.ko.md", kind: "hooks", re: /badge\/hooks-(\d+)-/ },
  { file: "README.zh.md", kind: "hooks", re: /badge\/hooks-(\d+)-/ },
];

function parseCount(raw) {
  return Number(String(raw).replace(/%2C/g, "").replace(/,/g, ""));
}

/** Measure what the docs currently claim. Disagreement between surfaces is an error. */
export function readPublished(repoRoot = REPO_ROOT) {
  const byKind = new Map();
  const violations = [];
  for (const s of PUBLISHED_SURFACES) {
    const p = join(repoRoot, s.file);
    if (!existsSync(p)) continue;
    const m = s.re.exec(readFileSync(p, "utf8"));
    if (!m) {
      violations.push(s.file + ": no " + s.kind + " value found");
      continue;
    }
    if (!byKind.has(s.kind)) byKind.set(s.kind, []);
    byKind.get(s.kind).push({ file: s.file, value: parseCount(m[1]) });
  }
  const counts = {};
  for (const [kind, rows] of byKind) {
    const distinct = [...new Set(rows.map((r) => r.value))];
    if (distinct.length > 1) {
      violations.push(
        kind + " disagrees across surfaces: " +
          rows.map((r) => r.file + "=" + r.value).join(", "),
      );
    }
    counts[kind] = rows[0]?.value ?? null;
  }
  return { counts, violations };
}

export function canonicalJson(inventory) {
  return JSON.stringify(inventory, null, 2) + "\n";
}

export function inventoryHash(inventory) {
  return "sha256:" + createHash("sha256").update(canonicalJson(inventory)).digest("hex");
}

function replaceBadges(body, values) {
  const { skills, hooks, tests } = values;
  let out = body;
  out = out.replace(/(badge\/skills-)(\d+)(-)/g, (_m, a, _b, c) => a + skills + c);
  out = out.replace(/(badge\/hooks-)(\d+)(-)/g, (_m, a, _b, c) => a + hooks + c);
  out = out.replace(/(alt=")(\d[\d,]*)( skills)/g, (_m, a, _b, c) => a + skills + c);
  out = out.replace(/(alt=")(\d[\d,]*)( hooks)/g, (_m, a, _b, c) => a + hooks + c);
  if (tests != null) {
    const pretty = tests.toLocaleString("en-US");
    out = out.replace(
      /(badge\/tests-)([\d%C,]+)(_passing)/g,
      (_m, a, _b, c) => a + pretty.replace(/,/g, "%2C") + c,
    );
    out = out.replace(/(alt=")(\d[\d,]*)( tests passing)/g, (_m, a, _b, c) => a + pretty + c);
  }
  return out;
}

/** Apply generated values to the README family. Returns the drifted file list. */
export function applyBlocks(inventory, options = {}) {
  const { tests = null, write = false, repoRoot = REPO_ROOT } = options;
  const values = {
    skills: inventory.skills.length,
    hooks: inventory.hooks.length,
    tests,
  };
  const drifted = [];
  for (const file of ["README.md", "README.ko.md", "README.zh.md"]) {
    const p = join(repoRoot, file);
    if (!existsSync(p)) continue;
    const body = readFileSync(p, "utf8");
    const next = replaceBadges(body, values);
    if (next !== body) {
      drifted.push(file);
      if (write) writeFileSync(p, next);
    }
  }
  return drifted;
}

export function check(options = {}) {
  const { pluginRoot = PLUGIN_ROOT, repoRoot = REPO_ROOT } = options;
  const violations = [];
  const inventory = collectInventory(pluginRoot, repoRoot);

  violations.push(...checkSets(pluginRoot, repoRoot).violations);

  const invPath = join(pluginRoot, "inventory.json");
  if (!existsSync(invPath)) {
    violations.push("inventory.json is missing — run inventory.mjs --write");
  } else if (readFileSync(invPath, "utf8") !== canonicalJson(inventory)) {
    violations.push("inventory.json is stale — run inventory.mjs --write");
  }

  for (const f of applyBlocks(inventory, { write: false, repoRoot })) {
    violations.push("generated inventory value is stale in " + f);
  }

  const published = readPublished(repoRoot);
  violations.push(...published.violations);
  if (published.counts.skills != null && published.counts.skills !== inventory.skills.length) {
    violations.push(
      "published skills=" + published.counts.skills + " but " + inventory.skills.length + " ship",
    );
  }
  if (published.counts.hooks != null && published.counts.hooks !== inventory.hooks.length) {
    violations.push(
      "published hooks=" + published.counts.hooks + " but " + inventory.hooks.length + " ship",
    );
  }

  return { ok: violations.length === 0, violations, inventory };
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const argv = process.argv.slice(2);
  const inventory = collectInventory();

  if (argv.includes("--hash")) {
    console.log(inventoryHash(inventory));
    process.exit(0);
  }

  if (argv.includes("--published")) {
    const { counts, violations } = readPublished();
    if (violations.length) {
      console.error("[codexclaw inventory] published-count problems:");
      for (const v of violations) console.error("  - " + v);
      process.exit(1);
    }
    console.log(JSON.stringify(counts));
    process.exit(0);
  }

  if (argv.includes("--write")) {
    const testsArg = argValue("--tests");
    const tests = testsArg == null ? null : Number(testsArg);
    if (testsArg != null && !Number.isInteger(tests)) {
      console.error("[codexclaw inventory] --tests must be an integer");
      process.exit(1);
    }
    writeFileSync(INVENTORY_PATH, canonicalJson(inventory));
    const changed = applyBlocks(inventory, { tests, write: true });
    console.log(
      "[codexclaw inventory] wrote inventory.json (" +
        inventory.skills.length + " skills, " +
        inventory.hooks.length + " hooks, " +
        inventory.components.length + " components)" +
        (changed.length ? "; updated " + changed.join(", ") : ""),
    );
    process.exit(0);
  }

  const result = check();
  if (result.ok) {
    console.log(
      "[codexclaw inventory] OK — " +
        result.inventory.skills.length + " skills, " +
        result.inventory.hooks.length + " hooks, " +
        result.inventory.components.length + " components; sets and published counts agree.",
    );
    process.exit(0);
  }
  console.error("[codexclaw inventory] FAIL — " + result.violations.length + " violation(s):");
  for (const v of result.violations) console.error("  - " + v);
  process.exit(1);
}
