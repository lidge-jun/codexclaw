// report-export.test.mjs — issue #181. The exporter used to hand a destination inside a
// missing directory straight to Chromium, whose failure surfaced as a generic
// "chrome print failed" naming the wrong thing. These cases pin the directory preflight.
//
// No fake browser: a stub script is not portably spawnable (Windows cannot exec a .mjs
// shebang, and Node will not exec a .cmd without a shell), and the exporter's own
// `which` only treats a string as a path when it contains a forward slash. Using the
// real `process.execPath` with forward slashes satisfies both, and it is enough —
// the preflight runs BEFORE the print, so what happens to the print afterwards is not
// what these assertions are about.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, "..", "skills", "dev-visualizer", "scripts", "export-paged-report.mjs");
const slash = (p) => p.replace(/\\/g, "/");

function runExport(dir, outputPath) {
  const input = join(dir, "in.html");
  writeFileSync(input, "<html><body><h1>t</h1></body></html>");
  return spawnSync(
    process.execPath,
    [SCRIPT, input, outputPath, "--chrome", slash(process.execPath), "--json"],
    { encoding: "utf8" },
  );
}

test("#181: a missing nested output directory is created before the browser is invoked", () => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-export-"));
  try {
    const out = join(dir, "deeply", "nested", "report.pdf");
    runExport(dir, out);
    assert.ok(existsSync(dirname(out)), "the output directory should have been created");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("#181: an existing output directory is left alone", () => {
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

test("#181: a regular file at the parent path fails naming the directory, not the browser", () => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-export-"));
  try {
    const blocker = join(dir, "blocked");
    writeFileSync(blocker, "i am a file, not a directory");
    const r = runExport(dir, join(blocker, "report.pdf"));
    assert.equal(r.status, 1);
    assert.match(r.stderr ?? "", /cannot create output directory/);
    // The whole point: this must not be reported as a print failure.
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
    const before = readdirSync(dir).sort();
    spawnSync(process.execPath, [SCRIPT, "--qa-only", pdf, "--json"], { encoding: "utf8" });
    assert.deepEqual(readdirSync(dir).sort(), before, "qa-only must not create anything");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
