#!/usr/bin/env node
/**
 * sync-readme-badges.mjs -- derives volatile README badge values from the
 * shipped payload and writes them into all three README variants.
 *
 * Badge sources:
 *   skills  -> count of SKILL.md-containing dirs under plugins/codexclaw/skills/
 *   hooks   -> plugin.json hooks array length
 *
 * Usage:
 *   node plugins/codexclaw/scripts/sync-readme-badges.mjs          # check (exit 1 on drift)
 *   node plugins/codexclaw/scripts/sync-readme-badges.mjs --write  # fix (rewrite files)
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(HERE, "..");
const REPO_ROOT = resolve(PLUGIN_ROOT, "..", "..");

const README_FILES = ["README.md", "README.ko.md", "README.zh.md"];

export function countSkills() {
  const skillsDir = join(PLUGIN_ROOT, "skills");
  return readdirSync(skillsDir).filter((name) => {
    const dir = join(skillsDir, name);
    return statSync(dir).isDirectory() && existsSync(join(dir, "SKILL.md"));
  }).length;
}

export function countHooks() {
  const manifest = JSON.parse(
    readFileSync(join(PLUGIN_ROOT, ".codex-plugin", "plugin.json"), "utf8"),
  );
  return manifest.hooks.length;
}

function replaceBadge(body, kind, newCount) {
  // shields.io/badge/<kind>-<N>-<color>
  const pattern = "(shields\\.io\/badge\/" + kind + "-)(\\d+)(-\\w+)";
  const re = new RegExp(pattern, "g");
  return body.replace(re, (_m, prefix, _old, suffix) => prefix + newCount + suffix);
}

function replaceAlt(body, kind, newCount) {
  // alt="<N> <kind>"
  const pattern = '(alt=")(\\d[\\d,]*)( ' + kind + ')';
  const re = new RegExp(pattern, "g");
  return body.replace(re, (_m, pre, _old, suf) => pre + newCount + suf);
}

export function checkReadmes() {
  const skills = countSkills();
  const hooks = countHooks();
  const results = [];
  for (const file of README_FILES) {
    const path = join(REPO_ROOT, file);
    if (!existsSync(path)) continue;
    const body = readFileSync(path, "utf8");
    let updated = body;
    updated = replaceBadge(updated, "skills", skills);
    updated = replaceBadge(updated, "hooks", hooks);
    updated = replaceAlt(updated, "skills", skills);
    updated = replaceAlt(updated, "hooks", hooks);
    results.push({ file, path, original: body, updated, drifted: updated !== body });
  }
  return { skills, hooks, results };
}

// CLI entry
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const write = process.argv.includes("--write");
  const { results } = checkReadmes();
  let drifted = false;
  for (const r of results) {
    if (r.drifted) {
      drifted = true;
      if (write) {
        writeFileSync(r.path, r.updated);
        console.log("updated: " + r.file);
      } else {
        console.log("drift: " + r.file);
      }
    } else {
      console.log("ok: " + r.file);
    }
  }
  if (!write && drifted) {
    console.error("Run with --write to fix.");
    process.exit(1);
  }
}
