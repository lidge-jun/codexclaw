// report-export.test.mjs — issue #181. The exporter used to hand a destination inside a
// missing directory straight to Chromium, whose failure surfaced as a generic
// "chrome print failed" that named the wrong thing. These cases pin the directory
// preflight without launching a real browser: a fake chrome that only writes the file
// it was told to write is enough to separate "the directory was prepared" from
// "the print failed".
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, "..", "skills", "dev-visualizer", "scripts", "export-paged-report.mjs");

/** A stand-in for Chromium that honours --print-to-pdf and nothing else. */
function fakeChrome(dir) {
  const path = join(dir, "fake-chrome.mjs");
  writeFileSync(
    path,
    [
      "#!/usr/bin/env node",
      "import { writeFileSync } from 'node:fs';",
      "const arg = process.argv.find((a) => a.startsWith('--print-to-pdf='));",
      "if (!arg) { process.exit(3); }",
      "try { writeFileSync(arg.slice('--print-to-pdf='.length), '%PDF-1.4 fake'); }",
      "catch (err) { console.error(String(err && err.code)); process.exit(4); }",
    ].join("\n"),
  );
  chmodSync(path, 0o755);
  return path;
}

function runExport(dir, outputPath) {
  const input = join(dir, "in.html");
  writeFileSync(input, "<html><body><h1>t</h1></body></html>");
  const chrome = fakeChrome(dir);
  return spawnSync(process.execPath, [SCRIPT, input, outputPath, "--chrome", chrome, "--json"], {
    encoding: "utf8",
  });
}

test("#181: a missing nested output directory is created instead of reaching the browser", () => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-export-"));
  try {
    const out = join(dir, "deeply", "nested", "report.pdf");
    const r = runExport(dir, out);
    assert.ok(existsSync(dirname(out)), "the output directory should have been created");
    assert.doesNotMatch(r.stderr ?? "", /chrome print failed/, "a missing directory must not be reported as a print failure");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("#181: an existing output directory still works", () => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-export-"));
  try {
    const outDir = join(dir, "out");
    mkdirSync(outDir);
    const r = runExport(dir, join(outDir, "report.pdf"));
    assert.doesNotMatch(r.stderr ?? "", /cannot create output directory/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("#181: a regular file occupying the parent path fails naming the directory, not Chrome", () => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-export-"));
  try {
    const blocker = join(dir, "blocked");
    writeFileSync(blocker, "i am a file, not a directory");
    const r = runExport(dir, join(blocker, "report.pdf"));
    assert.equal(r.status, 1);
    assert.match(r.stderr ?? "", /cannot create output directory/);
    assert.doesNotMatch(r.stderr ?? "", /chrome print failed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("#181: --qa-only creates nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-export-"));
  try {
    const pdf = join(dir, "existing.pdf");
    writeFileSync(pdf, "%PDF-1.4 fake");
    spawnSync(process.execPath, [SCRIPT, "--qa-only", pdf, "--json"], { encoding: "utf8" });
    assert.ok(!existsSync(join(dir, "existing.pdf", "nested")), "qa-only must not create directories");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
