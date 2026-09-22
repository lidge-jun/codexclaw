import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { evaluateReport } from "../skills/dev-visualizer/scripts/quality-gate.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, "..", "skills", "dev-visualizer", "scripts", "export-paged-report.mjs");
const TOOLS = join(here, "fixtures", "visualizer-export-tools.mjs");

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "cxc-export-"));
  const home = join(root, "home");
  const emptyPath = join(root, "empty-path");
  mkdirSync(home);
  mkdirSync(emptyPath);
  return { root, home, emptyPath };
}

function run(root, args, { mode = "happy", path } = {}) {
  const home = join(root, "home");
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    timeout: 10_000,
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      PATH: path ?? join(root, "empty-path"),
      TMPDIR: root,
      TMP: root,
      TEMP: root,
      CXC_VISUALIZER_FIXTURE_MODE: mode,
    },
  });
}

function writeInput(root) {
  const input = join(root, "in.html");
  writeFileSync(input, "<!doctype html><html><head></head><body><h1>Fixture report</h1></body></html>");
  return input;
}

function exportArgs(input, output, paperSize = "A4") {
  return [
    input,
    output,
    "--chrome", TOOLS,
    "--pdfinfo", TOOLS,
    "--pdftotext", TOOLS,
    "--paper-size", paperSize,
    "--json",
  ];
}

function parseReport(result) {
  assert.ok(result.stdout.trim(), `expected JSON stdout; stderr=${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.deliveryReady, false);
  return report;
}

function check(report, id) {
  return report.checks.find((item) => item.id === id);
}

for (const paperSize of ["A4", "Letter"]) {
  test(`actual CLI exports and validates a ${paperSize} report`, () => {
    const { root } = sandbox();
    try {
      const input = writeInput(root);
      const output = join(root, "nested", `${paperSize}.pdf`);
      const result = run(root, exportArgs(input, output, paperSize));
      const report = parseReport(result);
      const digest = createHash("sha256").update(readFileSync(output)).digest("hex");

      assert.equal(result.status, 0, result.stderr);
      assert.equal(report.schemaVersion, 1);
      assert.equal(report.timeoutMs, 30_000);
      assert.equal(report.paperSize, paperSize);
      assert.equal(report.artifactExists, true);
      assert.equal(report.artifact_sha256, digest);
      assert.equal(report.deliveryReady, false);
      assert.equal(report.verdict, "PASS");
      assert.equal(report.exitCode, 0);
      assert.equal(report.pageSize.name, paperSize);
      assert.match(readFileSync(output, "utf8"), new RegExp(`fixture-paper=${paperSize}`));
      for (const id of ["artifact-created", "pdf-parse", "text-integrity", "pagination"]) {
        assert.equal(check(report, id).status, "PASS");
        assert.equal(check(report, id).required, true);
        assert.equal(check(report, id).artifact_sha256, digest);
        assert.ok(check(report, id).evidence);
      }
      assert.match(check(report, "text-integrity").reason, /nonempty extracted text only/i);
      assert.match(check(report, "pagination").reason, /automated layout heuristics only/i);

      const gate = evaluateReport(report, { profile: "standard" });
      assert.equal(gate.verdict, "PASS");
      assert.equal(gate.exitCode, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("missing Poppler tools produce required NOT_RUN checks and BLOCKED/3", () => {
  const { root } = sandbox();
  try {
    const input = writeInput(root);
    const output = join(root, "report.pdf");
    const missing = join(root, "missing-tool");
    const args = exportArgs(input, output);
    args[args.indexOf("--pdfinfo") + 1] = missing;
    args[args.indexOf("--pdftotext") + 1] = missing;
    const result = run(root, args);
    const report = parseReport(result);

    assert.equal(result.status, 3);
    assert.equal(report.verdict, "BLOCKED");
    assert.equal(report.exitCode, 3);
    assert.equal(check(report, "artifact-created").status, "PASS");
    assert.equal(check(report, "pdf-parse").status, "NOT_RUN");
    assert.equal(check(report, "text-integrity").status, "NOT_RUN");
    assert.equal(check(report, "pagination").status, "NOT_RUN");
    assert.equal(evaluateReport(report, { profile: "standard" }).verdict, "BLOCKED");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("missing pdftotext preserves completed pdf-parse evidence but remains BLOCKED/3", () => {
  const { root } = sandbox();
  try {
    const input = writeInput(root);
    const args = exportArgs(input, join(root, "report.pdf"));
    args[args.indexOf("--pdftotext") + 1] = join(root, "missing-pdftotext");
    const result = run(root, args);
    const report = parseReport(result);
    assert.equal(result.status, 3);
    assert.equal(check(report, "pdf-parse").status, "PASS");
    assert.equal(check(report, "text-integrity").status, "NOT_RUN");
    assert.equal(check(report, "pagination").status, "NOT_RUN");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a real pdfinfo subprocess failure is FAIL/1", () => {
  const { root } = sandbox();
  try {
    const input = writeInput(root);
    const result = run(root, exportArgs(input, join(root, "report.pdf")), { mode: "pdfinfo-nonzero" });
    const report = parseReport(result);
    assert.equal(result.status, 1);
    assert.equal(report.verdict, "FAIL");
    assert.equal(check(report, "pdf-parse").status, "FAIL");
    assert.match(check(report, "pdf-parse").reason, /status 9/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an invalid page count is FAIL/1 before text analysis", () => {
  const { root } = sandbox();
  try {
    const input = writeInput(root);
    const result = run(root, exportArgs(input, join(root, "report.pdf")), { mode: "invalid-page-count" });
    const report = parseReport(result);
    assert.equal(result.status, 1);
    assert.equal(check(report, "pdf-parse").status, "FAIL");
    assert.equal(check(report, "text-integrity").status, "NOT_RUN");
    assert.equal(check(report, "pagination").status, "NOT_RUN");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("invalid page geometry is FAIL/1 before text analysis", () => {
  const { root } = sandbox();
  try {
    const input = writeInput(root);
    const result = run(root, exportArgs(input, join(root, "report.pdf")), { mode: "invalid-geometry" });
    const report = parseReport(result);
    assert.equal(result.status, 1);
    assert.equal(check(report, "pdf-parse").status, "FAIL");
    assert.match(check(report, "pdf-parse").reason, /geometry/);
    assert.equal(check(report, "text-integrity").status, "NOT_RUN");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("empty extracted page text is FAIL/1", () => {
  const { root } = sandbox();
  try {
    const input = writeInput(root);
    const result = run(root, exportArgs(input, join(root, "report.pdf")), { mode: "empty-text" });
    const report = parseReport(result);
    assert.equal(result.status, 1);
    assert.equal(check(report, "pdf-parse").status, "PASS");
    assert.equal(check(report, "text-integrity").status, "FAIL");
    assert.match(check(report, "text-integrity").reason, /empty text/i);
    assert.equal(check(report, "pagination").status, "NOT_RUN");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a real pdftotext subprocess failure is FAIL/1", () => {
  const { root } = sandbox();
  try {
    const input = writeInput(root);
    const result = run(root, exportArgs(input, join(root, "report.pdf")), { mode: "pdftotext-nonzero" });
    const report = parseReport(result);
    assert.equal(result.status, 1);
    assert.equal(check(report, "pdf-parse").status, "PASS");
    assert.equal(check(report, "text-integrity").status, "FAIL");
    assert.match(check(report, "text-integrity").reason, /status 10/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("layout findings produce REVIEW/2", () => {
  const { root } = sandbox();
  try {
    const input = writeInput(root);
    const result = run(root, exportArgs(input, join(root, "report.pdf")), { mode: "review" });
    const report = parseReport(result);
    assert.equal(result.status, 2);
    assert.equal(report.verdict, "REVIEW");
    assert.equal(check(report, "pagination").status, "REVIEW");
    assert.ok(report.qa.some((finding) => /page number/.test(finding.msg)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stale output cannot satisfy a browser that creates nothing and remains intact", () => {
  const { root } = sandbox();
  try {
    const input = writeInput(root);
    const output = join(root, "report.pdf");
    writeFileSync(output, "%PDF-1.4 stale");
    const result = run(root, exportArgs(input, output), { mode: "chrome-no-output" });
    const report = parseReport(result);
    assert.equal(result.status, 1);
    assert.equal(report.artifactExists, true);
    assert.equal(check(report, "artifact-created").status, "FAIL");
    assert.equal(report.verdict, "FAIL");
    assert.equal(readFileSync(output, "utf8"), "%PDF-1.4 stale");
    assert.equal(report.artifact_sha256, createHash("sha256").update("%PDF-1.4 stale").digest("hex"));
    assert.equal(evaluateReport(report, { profile: "standard" }).verdict, "FAIL");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("input and output cannot name the same file", () => {
  const { root } = sandbox();
  try {
    const input = writeInput(root);
    const before = readFileSync(input, "utf8");
    const result = run(root, exportArgs(input, input));
    const report = parseReport(result);
    assert.equal(result.status, 1);
    assert.equal(report.artifactExists, false);
    assert.match(check(report, "artifact-created").reason, /same file/);
    assert.equal(readFileSync(input, "utf8"), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("failed runs remove temporary HTML", () => {
  const { root } = sandbox();
  try {
    const input = writeInput(root);
    run(root, exportArgs(input, join(root, "report.pdf")), { mode: "pdfinfo-nonzero" });
    assert.deepEqual(readdirSync(root).filter((name) => name.includes("export-pass")), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unknown options and invalid paper sizes fail validation", () => {
  const { root } = sandbox();
  try {
    const input = writeInput(root);
    const unknown = run(root, [input, join(root, "one.pdf"), "--wat", "--json"]);
    const invalidPaper = run(root, [input, join(root, "two.pdf"), "--paper-size", "Legal", "--json"]);
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /unknown option/);
    assert.equal(invalidPaper.status, 1);
    assert.match(invalidPaper.stderr, /A4\|Letter/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an explicitly selected missing Chromium does not fall back to an operator browser", () => {
  const { root } = sandbox();
  try {
    const input = writeInput(root);
    const result = run(root, [input, join(root, "report.pdf"), "--chrome", join(root, "missing-chrome"), "--json"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no Chromium binary found/);
    assert.equal(existsSync(join(root, "report.pdf")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("#181: a missing nested output directory is created before the browser is invoked", () => {
  const { root } = sandbox();
  try {
    const output = join(root, "deeply", "nested", "report.pdf");
    run(root, exportArgs(writeInput(root), output));
    assert.ok(existsSync(dirname(output)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("#181: an existing output directory is left alone", () => {
  const { root } = sandbox();
  try {
    const outDir = join(root, "out");
    mkdirSync(outDir);
    const result = run(root, exportArgs(writeInput(root), join(outDir, "report.pdf")));
    assert.doesNotMatch(result.stderr, /cannot create output directory/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("#181: a regular file at the parent path fails naming the directory, not the browser", () => {
  const { root } = sandbox();
  try {
    const blocker = join(root, "blocked");
    writeFileSync(blocker, "not a directory");
    const result = run(root, exportArgs(writeInput(root), join(blocker, "report.pdf")));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /cannot create output directory/);
    assert.doesNotMatch(result.stderr, /chrome print failed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("#181: --qa-only creates nothing", () => {
  const { root } = sandbox();
  try {
    const pdf = join(root, "existing.pdf");
    writeFileSync(pdf, "%PDF-1.4\nfixture-paper=A4\n");
    const before = readdirSync(root).sort();
    run(root, ["--qa-only", pdf, "--pdfinfo", TOOLS, "--pdftotext", TOOLS, "--json"]);
    assert.deepEqual(readdirSync(root).sort(), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const [mode, id] of [["chrome-hang", "artifact-created"], ["pdfinfo-hang", "pdf-parse"], ["pdftotext-hang", "text-integrity"]]) {
  test(`${mode}: timeout is FAIL even with an artifact, kills the tool and cleans scratch files`, () => {
    const { root, home } = sandbox();
    try {
      const output = join(root, "report.pdf");
      writeFileSync(output, "%PDF-1.4 previous artifact");
      const result = run(root, [...exportArgs(writeInput(root), output), "--timeout-ms", "1000", "--keep-html"], { mode });
      assert.equal(result.error, undefined, "exporter must finish before the outer test watchdog");
      const report = parseReport(result);
      assert.equal(result.status, 1);
      assert.equal(report.timeoutMs, 1000);
      assert.equal(report.verdict, "FAIL");
      assert.equal(report.artifactExists, true);
      assert.equal(report.artifact_sha256, createHash("sha256").update(readFileSync(output)).digest("hex"));
      assert.equal(check(report, id).status, "FAIL");
      assert.match(check(report, id).reason, /timed out after 1000 ms.*SIGKILL/);
      assert.equal(evaluateReport(report, { profile: "standard" }).verdict, "FAIL");
      const tool = JSON.parse(readFileSync(join(home, "hanging-tool.json"), "utf8"));
      assert.throws(() => process.kill(tool.pid, 0), { code: "ESRCH" });
      if (tool.profile) assert.equal(existsSync(tool.profile), false);
      assert.deepEqual(readdirSync(root).filter((name) => /export-pass|cxc-report-/.test(name)), []);
    } finally {
      const metadata = join(home, "hanging-tool.json");
      if (existsSync(metadata)) {
        try { process.kill(JSON.parse(readFileSync(metadata, "utf8")).pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; }
      }
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("an exited tool's inherited output descriptors do not hold the exporter open", () => {
  const { root, home } = sandbox();
  try {
    const result = run(root, [...exportArgs(writeInput(root), join(root, "report.pdf")), "--timeout-ms", "1000"], { mode: "inherited-output" });
    assert.equal(result.error, undefined);
    const report = parseReport(result);
    assert.equal(result.status, 0);
    assert.equal(report.verdict, "PASS");
    const { pid, ready, parentDescriptors } = JSON.parse(readFileSync(join(home, "inherited-output.json"), "utf8"));
    assert.equal(ready?.pid, pid, "fixture parent must receive the child's readiness acknowledgement before exiting");
    assert.deepEqual(ready.descriptors, parentDescriptors, "the child must hold the parent's actual stdout/stderr descriptors");
    assert.equal(ready.stdoutWritten, true, "the child must successfully write to inherited stdout before acknowledging readiness");
    assert.equal(ready.stderrWritten, true, "the child must successfully write to inherited stderr before acknowledging readiness");
    assert.doesNotThrow(() => process.kill(pid, 0), "fixture descendant must still hold the inherited descriptors");
  } finally {
    const metadata = join(home, "inherited-output.json");
    if (existsSync(metadata)) {
      try { process.kill(JSON.parse(readFileSync(metadata, "utf8")).pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; }
    }
    rmSync(root, { recursive: true, force: true });
  }
});

for (const mode of ["mixed-paper", "missing-page-geometry"]) {
  test(`${mode}: every page must have valid requested geometry`, () => {
    const { root } = sandbox();
    try {
      const pdf = join(root, "report.pdf");
      writeFileSync(pdf, "%PDF-1.4\nfixture-paper=A4\n");
      const result = run(root, ["--qa-only", pdf, "--pdfinfo", TOOLS, "--pdftotext", TOOLS, "--json"], { mode });
      const report = parseReport(result);
      assert.notEqual(result.status, 0);
      assert.notEqual(evaluateReport(report, { profile: "standard" }).verdict, "PASS");
      if (mode === "mixed-paper") assert.ok(report.qa.some((finding) => finding.page === 2 && /Letter|612/.test(finding.msg)));
      else assert.equal(check(report, "pdf-parse").status, "FAIL");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

for (const mode of ["chrome-nonzero", "chrome-partial", "chrome-hang", "chrome-partial-zero", "second-pass-nonzero", "second-pass-partial", "second-pass-hang", "second-pass-partial-zero"]) {
  test(`${mode}: failed generation preserves the last good destination bytes`, () => {
    const { root } = sandbox();
    try {
      const output = join(root, "report.pdf");
      const original = "%PDF-1.4 last known good document";
      writeFileSync(output, original);
      const input = writeInput(root);
      if (mode.startsWith("second-pass")) writeFileSync(input, '<html><head></head><body><span data-toc-for="section">?</span><h2 id="section" data-toc="Section heading">Section heading</h2></body></html>');
      const result = run(root, [...exportArgs(input, output), "--timeout-ms", "1000"], { mode });
      const report = parseReport(result);
      assert.equal(result.status, 1);
      assert.equal(check(report, "artifact-created").status, "FAIL");
      assert.equal(readFileSync(output, "utf8"), original);
      assert.equal(report.artifact_sha256, createHash("sha256").update(original).digest("hex"));
      if (mode.startsWith("second-pass")) assert.equal(readFileSync(join(root, "home", "print-count"), "utf8"), "2");
      assert.deepEqual(readdirSync(root).filter((name) => /export-stage|export-pass|cxc-report-/.test(name)), []);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test("timeout kills the owned descendant as well as the browser", () => {
  const { root, home } = sandbox();
  try {
    const result = run(root, [...exportArgs(writeInput(root), join(root, "report.pdf")), "--timeout-ms", "1000"], { mode: "chrome-tree-hang" });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    const report = parseReport(result);
    assert.match(check(report, "artifact-created").reason, /timed out/);
    const { pid } = JSON.parse(readFileSync(join(home, "descendant.json"), "utf8"));
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
    assert.deepEqual(readdirSync(root).filter((name) => /export-stage|export-pass|cxc-report-/.test(name)), []);
  } finally {
    for (const name of ["descendant.json", "hanging-tool.json"]) {
      if (existsSync(join(home, name))) {
        try { process.kill(JSON.parse(readFileSync(join(home, name), "utf8")).pid, "SIGKILL"); }
        catch (error) { if (error.code !== "ESRCH") throw error; }
      }
    }
    rmSync(root, { recursive: true, force: true });
  }
});

test("successful two-pass generation promotes only the final candidate over the old destination", () => {
  const { root, home } = sandbox();
  try {
    const output = join(root, "report.pdf");
    const original = "%PDF-1.4 last known good document";
    writeFileSync(output, original);
    const input = writeInput(root);
    writeFileSync(input, '<html><head></head><body><span data-toc-for="section">?</span><h2 id="section" data-toc="Section heading">Section heading</h2></body></html>');
    const result = run(root, exportArgs(input, output), { mode: "second-pass-success" });
    const report = parseReport(result);
    assert.equal(result.status, 0, result.stdout);
    assert.equal(report.passes, 2);
    assert.equal(readFileSync(join(home, "destination-at-pass-1"), "utf8"), original);
    assert.equal(readFileSync(join(home, "destination-at-pass-2"), "utf8"), original);
    assert.match(readFileSync(output, "utf8"), /fixture-pass=2/);
    assert.equal(report.artifact_sha256, createHash("sha256").update(readFileSync(output)).digest("hex"));
    assert.equal(evaluateReport(report, { profile: "standard" }).verdict, "PASS");
    assert.deepEqual(readdirSync(root).filter((name) => /export-stage|export-pass|cxc-report-/.test(name)), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("no generated file and no previous destination remain FAIL without an artifact", () => {
  const { root } = sandbox();
  try {
    const output = join(root, "report.pdf");
    const result = run(root, exportArgs(writeInput(root), output), { mode: "chrome-no-output" });
    const report = parseReport(result);
    assert.equal(result.status, 1);
    assert.equal(check(report, "artifact-created").status, "FAIL");
    assert.equal(report.artifactExists, false);
    assert.equal(report.artifact_sha256, null);
    assert.equal(existsSync(output), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("--timeout-ms rejects missing, nonfinite, fractional and out-of-bounds values before spawning", () => {
  const { root } = sandbox();
  try {
    for (const value of ["0", "-1", "NaN", "Infinity", "1.5", "99", "300001", ""]) {
      const result = run(root, [...exportArgs(writeInput(root), join(root, "report.pdf")), "--timeout-ms", value]);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /--timeout-ms/);
      assert.equal(existsSync(join(root, "report.pdf")), false);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
