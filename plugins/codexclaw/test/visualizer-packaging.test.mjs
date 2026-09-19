// visualizer-packaging.test.mjs — issues #182 and #183.
//
// dev-visualizer shipped four kinds of reference that a standalone consumer cannot
// resolve: sibling links into ../dev/, a prose dependency on the same file that a
// Markdown link checker would miss, and repository-only devlog pointers. The skill
// looked fine in this repo and broke the moment it was copied on its own.
//
// These tests operate on an ISOLATED COPY of the skill directory, because that is the
// only way to observe the defect: inside the repo, every one of those paths resolves.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SKILL = join(here, "..", "skills", "dev-visualizer");
const CANONICAL = join(here, "..", "skills", "dev", "references", "reader-documents.md");

function markdownFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".md")) out.push(full);
    }
  };
  walk(root);
  return out;
}

/** Local markdown link targets, with anchors and external schemes dropped. */
function localLinks(text) {
  const out = [];
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const raw = m[1];
    if (/^[a-z]+:/i.test(raw) || raw.startsWith("#")) continue;
    out.push(raw.split("#")[0]);
  }
  return out.filter(Boolean);
}

function isolatedCopy() {
  const dir = mkdtempSync(join(tmpdir(), "cxc-viz-standalone-"));
  const dest = join(dir, "dev-visualizer");
  cpSync(SKILL, dest, { recursive: true });
  return { dir, dest };
}

test("#183: every local markdown link resolves inside an isolated single-skill copy", () => {
  const { dir, dest } = isolatedCopy();
  try {
    const broken = [];
    for (const file of markdownFiles(dest)) {
      for (const link of localLinks(readFileSync(file, "utf8"))) {
        const target = resolve(dirname(file), link);
        if (!existsSync(target)) broken.push(relative(dest, file) + " -> " + link);
      }
    }
    assert.deepEqual(broken, [], "links that do not resolve standalone:\n" + broken.join("\n"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("#183: no required reference escapes the skill root", () => {
  const { dir, dest } = isolatedCopy();
  try {
    const escapes = [];
    for (const file of markdownFiles(dest)) {
      for (const link of localLinks(readFileSync(file, "utf8"))) {
        const target = resolve(dirname(file), link);
        const rel = relative(dest, target);
        if (rel.startsWith("..") || rel.startsWith(".." + sep)) escapes.push(relative(dest, file) + " -> " + link);
      }
    }
    assert.deepEqual(escapes, [], "references outside the skill root:\n" + escapes.join("\n"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("#182: no shipped file points at a private devlog path", () => {
  const { dir, dest } = isolatedCopy();
  try {
    const hits = [];
    const walk = (d) => {
      for (const entry of readdirSync(d)) {
        const full = join(d, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (readFileSync(full, "utf8").includes("devlog/_plan")) hits.push(relative(dest, full));
      }
    };
    walk(dest);
    assert.deepEqual(hits, [], "shipped files citing an unshipped ledger:\n" + hits.join("\n"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("#183: the portable reader contract names the same rules as its canonical owner", () => {
  const canonical = readFileSync(CANONICAL, "utf8");
  const portable = readFileSync(join(SKILL, "reference", "reader-documents.md"), "utf8");
  const rules = (text) => [...text.matchAll(/^##\s+(READER-DOC-\d+)/gm)].map((m) => m[1]);
  assert.deepEqual(rules(portable), rules(canonical), "the portable copy has drifted from the canonical rule set");
  // Attribution is the whole reason a restatement is acceptable instead of a symlink.
  assert.match(portable, /Canonical owner/, "the portable copy must name its canonical owner");
});

test("#182: the provenance summaries carry their dates and stay scoped", () => {
  const text = readFileSync(join(SKILL, "reference", "print-provenance.md"), "utf8");
  for (const anchor of ["{#chromium-probe}", "{#cjk-typography}", "{#report-writing}"]) {
    assert.ok(text.includes(anchor), "missing anchor " + anchor);
  }
  assert.match(text, /2026-09-09/, "a measurement without its date is not provenance");
  assert.match(text, /not .*guarantee|Scope:/i, "a dated observation must not read as an ongoing guarantee");
});
