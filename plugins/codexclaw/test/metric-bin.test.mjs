import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(pluginRoot));
const bin = join(repoRoot, "bin", "codexclaw.mjs");
const pabcdCliDist = join(pluginRoot, "components", "pabcd-state", "dist", "cli.js");

function runMetric(cwd, args, stdin = "") {
  return spawnSync(process.execPath, [bin, "metric", ...args], {
    cwd,
    input: stdin,
    encoding: "utf8",
  });
}

test("root cxc metric delegates to pabcd-state dist and records metrics", () => {
  if (!existsSync(pabcdCliDist)) return;
  const cwd = mkdtempSync(join(tmpdir(), "codexclaw-metric-bin-"));
  try {
    const record = runMetric(cwd, ["record", "--session", "cli", "--name", "score", "--value", "7", "--json"]);
    assert.equal(record.status, 0, record.stderr || record.stdout);
    assert.equal(JSON.parse(record.stdout).value, 7);

    const ingest = runMetric(cwd, ["ingest", "--session", "cli"], "METRIC score=8\n");
    assert.equal(ingest.status, 0, ingest.stderr || ingest.stdout);
    assert.match(ingest.stdout, /recorded 1/);

    const show = runMetric(cwd, ["show", "--session", "cli", "--json"]);
    assert.equal(show.status, 0, show.stderr || show.stdout);
    assert.equal(JSON.parse(show.stdout).records.length, 2);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("root cxc divergence delegates to pabcd-state dist and records candidate provenance", () => {
  if (!existsSync(pabcdCliDist)) return;
  const cwd = mkdtempSync(join(tmpdir(), "codexclaw-divergence-bin-"));
  try {
    const mode = spawnSync(
      process.execPath,
      [bin, "divergence", "mode", "on", "--session", "cli", "--collapse", "D", "--reason", "plateau", "--json"],
      { cwd, encoding: "utf8" },
    );
    assert.equal(mode.status, 0, mode.stderr || mode.stdout);
    assert.equal(JSON.parse(mode.stdout).active, true);

    const add = spawnSync(
      process.execPath,
      [
        bin,
        "divergence",
        "candidate",
        "add",
        "--session",
        "cli",
        "--kind",
        "add-1",
        "--title",
        "Alternative",
        "--rationale",
        "grounded contrast",
        "--source",
        "https://example.com/alt",
        "--json",
      ],
      { cwd, encoding: "utf8" },
    );
    assert.equal(add.status, 0, add.stderr || add.stdout);
    assert.deepEqual(JSON.parse(add.stdout).sourceUrls, ["https://example.com/alt"]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
