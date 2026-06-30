#!/usr/bin/env node
// codexclaw build: compile each component's src/*.ts -> dist/*.js using Node's built-in
// type-stripping (node:module stripTypeScriptTypes), then validate the aggregated single-plugin
// layout. Zero external toolchain (no tsc/esbuild/bun) and no network — reproducible + idempotent.
//
// Sound only because every component has zero third-party runtime deps and imports only node:*
// + relative ./x.ts (A-audit Confucius). If a component later adds a third-party import, switch to
// a real bundler so the bare specifier resolves at the shipped dist path.

import { stripTypeScriptTypes } from "node:module";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");
export const componentsRoot = join(pluginRoot, "components");

export const COMPONENTS = ["pabcd-state", "config-guard", "provider-bridge", "subagent-config", "cxc-ops"];

// Markers that must NOT appear in shipped runtime sources or compiled output or the manifest.
const PLACEHOLDER_RE = /\[TODO\]|TODO\(|FIXME|\bTBD\b/;

export function listTsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTsFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

// Rewrite relative import/export specifiers ending in .ts -> .js. Line-oriented so multi-line
// `import { ... } from "./x.ts"` (where the `from "..."` lands on its own line post-strip) is caught.
// node:/package specifiers never end in .ts, so this only touches ./ and ../ paths.
function rewriteSpecifiers(js) {
  return js
    .split("\n")
    .map((line) =>
      line.replace(/(from\s*["'])(\.\.?\/[^"']+?)\.ts(["'])/g, "$1$2.js$3")
        .replace(/(import\(\s*["'])(\.\.?\/[^"']+?)\.ts(["']\s*\))/g, "$1$2.js$3"),
    )
    .join("\n");
}

function normalizeGeneratedJs(js) {
  return rewriteSpecifiers(js)
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
}

// Pure source->dist transform (no filesystem). Single source of truth for what a
// committed dist file's bytes MUST be, so a freshness test can recompute + diff
// in-memory without a real rebuild (avoids the C10 shared-dist race).
export function compileSource(src) {
  return normalizeGeneratedJs(stripTypeScriptTypes(src, { mode: "strip" }));
}

function compileComponent(name) {
  const srcDir = join(componentsRoot, name, "src");
  const distDir = join(componentsRoot, name, "dist");
  if (!existsSync(srcDir)) throw new Error(`component ${name} has no src/`);
  // Clean dist for a reproducible build (no stale files linger).
  if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });
  const files = listTsFiles(srcDir).sort();
  const emitted = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const js = compileSource(src);
    const rel = relative(srcDir, file).replace(/\.ts$/, ".js");
    const outPath = join(distDir, rel);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, js, "utf8");
    emitted.push(outPath);
  }
  return emitted;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// ---- validation ----
function validate() {
  const errors = [];
  const manifestPath = join(pluginRoot, ".codex-plugin", "plugin.json");
  const manifestText = readFileSync(manifestPath, "utf8");
  if (PLACEHOLDER_RE.test(manifestText)) errors.push(`placeholder marker in ${manifestPath}`);
  const manifest = JSON.parse(manifestText);

  // hooks: each referenced command path must exist on disk.
  const hookEntries = Array.isArray(manifest.hooks) ? manifest.hooks : [];
  for (const hookRel of hookEntries) {
    const hookFile = join(pluginRoot, hookRel.replace(/^\.\//, ""));
    if (!existsSync(hookFile)) {
      errors.push(`manifest hook file missing: ${hookRel}`);
      continue;
    }
    const hookJson = readJson(hookFile);
    // walk every command string and check the referenced dist file exists.
    for (const evt of Object.values(hookJson.hooks ?? {})) {
      for (const group of evt) {
        for (const h of group.hooks ?? []) {
          const m = /\$\{PLUGIN_ROOT\}\/([^"]+\.js)/.exec(h.command ?? "");
          if (m) {
            const distFile = join(pluginRoot, m[1]);
            if (!existsSync(distFile)) errors.push(`hook references missing dist: ${m[1]}`);
          }
        }
      }
    }
  }

  // mcp: referenced args path must exist.
  if (typeof manifest.mcpServers === "string") {
    const mcpFile = join(pluginRoot, manifest.mcpServers.replace(/^\.\//, ""));
    if (!existsSync(mcpFile)) errors.push(`manifest mcpServers file missing: ${manifest.mcpServers}`);
    else {
      const mcp = readJson(mcpFile);
      for (const [srv, cfg] of Object.entries(mcp.mcpServers ?? {})) {
        for (const arg of cfg.args ?? []) {
          if (typeof arg === "string" && arg.endsWith(".js")) {
            const distFile = join(pluginRoot, arg.replace(/^\.\//, ""));
            if (!existsSync(distFile)) errors.push(`mcp server ${srv} references missing dist: ${arg}`);
          }
        }
      }
    }
  }

  // skills: dir exists + every skill dir has a SKILL.md.
  const skillsDir = join(pluginRoot, (manifest.skills ?? "./skills/").replace(/^\.\//, ""));
  if (!existsSync(skillsDir)) errors.push(`skills dir missing: ${skillsDir}`);
  else {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory() && !existsSync(join(skillsDir, entry.name, "SKILL.md"))) {
        errors.push(`skill ${entry.name} missing SKILL.md`);
      }
    }
  }

  // placeholder scan across compiled dist + component src.
  for (const name of COMPONENTS) {
    for (const sub of ["src", "dist"]) {
      const dir = join(componentsRoot, name, sub);
      if (!existsSync(dir)) continue;
      for (const file of listTsFilesOrJs(dir)) {
        if (PLACEHOLDER_RE.test(readFileSync(file, "utf8"))) {
          errors.push(`placeholder marker in ${relative(pluginRoot, file)}`);
        }
      }
    }
  }

  return errors;
}

function listTsFilesOrJs(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTsFilesOrJs(full));
    else if (entry.isFile() && /\.(ts|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

export function build() {
  const emitted = {};
  for (const name of COMPONENTS) emitted[name] = compileComponent(name);
  const errors = validate();
  return { emitted, errors };
}

const isDirect =
  process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isDirect) {
  const { emitted, errors } = build();
  const total = Object.values(emitted).reduce((n, a) => n + a.length, 0);
  for (const [name, files] of Object.entries(emitted)) {
    console.log(`[codexclaw] compiled ${name}: ${files.length} file(s) -> dist/`);
  }
  if (errors.length) {
    console.error(`[codexclaw] BUILD VALIDATION FAILED (${errors.length}):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`[codexclaw] build OK — ${total} files compiled, layout validated.`);
}
