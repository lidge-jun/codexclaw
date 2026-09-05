import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const unit = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = process.cwd();
const prefix = "/Users/jun/.codex/worktrees/105d/codexclaw/";
const base = "0445e50a49d5b150f335e2949a22f1661e02dded";
const patchDoc = readFileSync(join(unit, "020_peer_guidance.md"), "utf8");
const targets = [...patchDoc.matchAll(/^\*\*\* (Add|Update) File: (.+)$/gm)]
  .map((m) => ({ kind: m[1], path: resolve(root, m[2].replace(prefix, "")) }));
assert.ok(targets.length > 0, "no patch targets");
const intended = [
  "plugins/codexclaw/skills/dev/references/peer-collaboration.md",
  "plugins/codexclaw/skills/dev/SKILL.md",
  "plugins/codexclaw/skills/search/SKILL.md",
  "plugins/codexclaw/skills/pabcd/SKILL.md",
  "plugins/codexclaw/skills/loop/SKILL.md",
  "plugins/codexclaw/skills/dev/references/skill-ownership.md",
  "structure/20_pabcd_dispatch_doctrine.md",
  "structure/60_native_capabilities.md",
].map((p) => resolve(root, p));

function checkBody(file, body, projected = new Map()) {
  assert.ok(body.endsWith("\n"), file + ": missing final newline");
  assert.ok(!/[\t ]+$/m.test(body), file + ": trailing whitespace");
  let fence = false;
  for (const line of body.split("\n")) {
    if (/^\x60{3}/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    for (const match of line.matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1].split("#")[0];
      if (!target || /^[a-z]+:/i.test(target)) continue;
      const linked = resolve(dirname(file), target);
      assert.ok(projected.has(linked) || existsSync(linked), file + ": missing link " + target);
    }
  }
  assert.equal(fence, false, file + ": unclosed fence");
}

function checkFile(file) { checkBody(file, readFileSync(file, "utf8")); }

function project(doc) {
  const blocks = [...doc.matchAll(/^\*\*\* (Add|Update) File: (.+)\n([\s\S]*?)(?=^\*\*\* (?:Add|Update) File:|^\*\*\* End Patch)/gm)];
  assert.deepEqual(blocks.map((b) => resolve(root, b[2].replace(prefix, ""))).sort(), [...intended].sort(), "patch target inventory");
  const projected = new Map();
  for (const [, kind, absolute, source] of blocks) {
    const file = resolve(root, absolute.replace(prefix, ""));
    assert.ok(file.startsWith(root + "/"), "patch escapes root");
    const relative = file.slice(root.length + 1);
    let body = kind === "Add" ? "" : execFileSync("git", ["show", base + ":" + relative], { encoding: "utf8" });
    if (kind === "Add") {
      const lines = source.trimEnd().split("\n");
      assert.ok(lines.every((l) => l.startsWith("+")), "invalid add line");
      body = lines.map((l) => l.slice(1)).join("\n") + "\n";
    } else {
      assert.ok(source.startsWith("@@\n"), "missing update hunk");
      for (const hunk of source.split(/^@@\n/m).filter(Boolean)) {
        const lines = hunk.trimEnd().split("\n");
        assert.ok(lines.every((l) => /^[ +\-]/.test(l)), "invalid hunk line");
        const before = lines.filter((l) => l[0] !== "+").map((l) => l.slice(1)).join("\n") + "\n";
        const after = lines.filter((l) => l[0] !== "-").map((l) => l.slice(1)).join("\n") + "\n";
        assert.ok(before.trim(), "empty anchor");
        assert.equal(body.split(before).length, 2, "missing/ambiguous anchor " + file);
        body = body.replace(before, after);
      }
    }
    projected.set(file, body);
  }
  for (const [file, body] of projected) checkBody(file, body, projected);
  return projected;
}

if (process.argv.includes("--self-test")) {
  const dir = mkdtempSync(join(tmpdir(), "peer-doc-check-"));
  try {
    const file = join(dir, "probe.md");
    assert.throws(() => checkFile(file), /ENOENT/);
    writeFileSync(file, "# Probe\n\n[absent](missing.md)\n");
    assert.throws(() => checkFile(file), /missing link/);
    writeFileSync(file, "# Probe\n");
    checkFile(file);
    project(patchDoc);
    assert.throws(() => project(patchDoc.replace(" ### Capability Routing Hub", " ### Missing unique anchor")), /anchor/);
    assert.throws(() => project(patchDoc.replace("(references/peer-collaboration.md)", "(references/nonexistent-peer.md)")), /missing link/);
    assert.throws(() => project(patchDoc.replace("skills/dev/references/peer-collaboration.md\n", "skills/dev/references/other.md\n")), /inventory/);
    console.log("PASS checker missing-file/broken-link/patch-anchor/projected-link/inventory probes");
  } finally { rmSync(dir, { recursive: true, force: true }); }
} else {
  assert.ok(process.argv.includes("--roadmap") || process.argv.includes("--payload"), "choose --roadmap or --payload");
  for (const name of readdirSync(unit).filter((n) => /^\d.*\.md$/.test(n))) {
    checkFile(join(unit, name));
  }
  const projected = project(patchDoc);
  for (const target of targets) {
    assert.ok(target.path.startsWith(root + "/"), "target escapes root");
    if (target.kind === "Update") assert.ok(existsSync(target.path), "missing update target " + target.path);
    if (!process.argv.includes("--payload")) {
      if (target.kind === "Update") {
        const relative = target.path.slice(root.length + 1);
        assert.equal(readFileSync(target.path, "utf8"), execFileSync("git", ["show", base + ":" + relative], { encoding: "utf8" }), "stale target " + relative);
      }
      continue;
    }
    checkFile(target.path);
    assert.equal(readFileSync(target.path, "utf8"), projected.get(target.path), "payload differs from audited patch " + target.path);
    if (target.path.endsWith("/SKILL.md")) {
      const relative = target.path.slice(root.length + 1);
      const before = execFileSync("git", ["show", base + ":" + relative], { encoding: "utf8" });
      const current = readFileSync(target.path, "utf8");
      const frontmatter = (s) => s.match(/^---\n[\s\S]*?\n---/)?.[0];
      assert.ok(frontmatter(current), relative + ": frontmatter absent");
      assert.equal(frontmatter(current), frontmatter(before), relative + ": frontmatter changed");
    }
  }
  console.log("PASS " + (process.argv.includes("--payload") ? "payload" : "roadmap") + ": numbered docs, links, fences; " + targets.length + " patch targets");
}
