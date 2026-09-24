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
import { fileURLToPath, pathToFileURL } from "node:url";

import { evaluateReport } from "../skills/dev-visualizer/scripts/quality-gate.mjs";
import { runTool } from "../skills/dev-visualizer/scripts/export-paged-report.mjs";

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

function run(root, args, { mode = "happy", path, env = {} } = {}) {
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
      ...env,
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

function scratch(root) {
  return readdirSync(root).filter((name) => /export-stage|export-pass|cxc-report-/.test(name));
}

function killFixture(pid) {
  if (!pid) return;
  try { process.kill(process.platform === "win32" ? pid : -pid, "SIGKILL"); }
  catch (error) { if (error.code !== "ESRCH") throw error; }
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

test("dump-dom crossing becomes a P2 pagination REVIEW", () => {
  const { root } = sandbox();
  try {
    const report = parseReport(run(root, exportArgs(writeInput(root), join(root, "report.pdf")), { mode: "dump-dom-crossing" }));
    assert.equal(report.svgGeometry.status, "REVIEW");
    assert.equal(report.svgGeometry.findings, 1);
    assert.equal(report.verdict, "REVIEW");
    assert.ok(report.qa.some((finding) => finding.level === "P2" && /later-painted line/.test(finding.msg)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("dump-dom failure is named NOT_RUN and does not block the PDF", () => {
  const { root } = sandbox();
  try {
    const report = parseReport(run(root, exportArgs(writeInput(root), join(root, "report.pdf")), { mode: "dump-dom-fail" }));
    assert.equal(report.svgGeometry.status, "NOT_RUN");
    assert.equal(report.verdict, "PASS");
    assert.ok(report.notes.some((note) => note.id === "svg-geometry" && /DOM probe exited with status 11/.test(note.message)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("malformed, invalid-entry, or absent dump-dom results become notes without P2 findings", () => {
  const { root } = sandbox();
  try {
    for (const mode of ["dump-dom-malformed", "dump-dom-no-marker",
      "dump-dom-null-finding", "dump-dom-bad-geometry-type"]) {
      const report = parseReport(run(root, exportArgs(writeInput(root), join(root, "report.pdf")), { mode }));
      assert.equal(report.svgGeometry.status, "NOT_RUN");
      assert.equal(report.verdict, "PASS");
      assert.ok(report.notes.some((note) => note.id === "svg-geometry"
        && /DOM result was not valid JSON|stdout did not contain cxc-svg-geometry-result-v1|DOM result has an invalid schema/.test(note.message)));
      assert.equal(report.qa.filter((finding) => finding.level === "P2").length, 0);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("--qa-only names DOM geometry as NOT_RUN", () => {
  const { root } = sandbox();
  try {
    const pdf = join(root, "existing.pdf");
    writeFileSync(pdf, "%PDF-1.4\nfixture-paper=A4\n");
    const report = parseReport(run(root, ["--qa-only", pdf, "--pdfinfo", TOOLS, "--pdftotext", TOOLS, "--json"]));
    assert.equal(report.svgGeometry.status, "NOT_RUN");
    assert.equal(report.verdict, "PASS");
    assert.ok(report.notes.some((note) => note.id === "svg-geometry" && /--qa-only has no HTML source/.test(note.message)));
  } finally { rmSync(root, { recursive: true, force: true }); }
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

test("complete-then-hang accepts a stable staged PDF on the first print pass", () => {
  const { root } = sandbox();
  try {
    const output = join(root, "report.pdf");
    writeFileSync(output, "previous destination");
    const result = run(root, exportArgs(writeInput(root), output), { mode: "complete-then-hang" });
    const report = parseReport(result);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(report.verdict, "PASS");
    assert.equal(report.passes, 1);
    assert.deepEqual(report.printPasses, [{ pass: 1, completedBy: "stage-stable" }]);
    assert.match(readFileSync(output, "utf8"), /fixture-pass=1/);
    assert.deepEqual(scratch(root), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("complete-then-hang accepts stable staged PDFs on both print passes", () => {
  const { root, home } = sandbox();
  try {
    const output = join(root, "report.pdf");
    const original = "previous destination";
    writeFileSync(output, original);
    const input = writeInput(root);
    writeFileSync(input, '<html><head></head><body><span data-toc-for="section">?</span><h2 id="section" data-toc="Section heading">Section heading</h2></body></html>');
    const result = run(root, exportArgs(input, output), { mode: "complete-then-hang" });
    const report = parseReport(result);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(report.passes, 2);
    assert.deepEqual(report.printPasses, [
      { pass: 1, completedBy: "stage-stable" },
      { pass: 2, completedBy: "stage-stable" },
    ]);
    assert.equal(readFileSync(join(home, "print-count"), "utf8"), "2");
    assert.equal(readFileSync(join(home, "destination-at-pass-1"), "utf8"), original);
    assert.equal(readFileSync(join(home, "destination-at-pass-2"), "utf8"), original);
    assert.match(readFileSync(output, "utf8"), /fixture-pass=2/);
    assert.deepEqual(scratch(root), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("changing-content-same-size cannot satisfy the stability window before the deadline", () => {
  const { root } = sandbox();
  try {
    const output = join(root, "report.pdf");
    const original = "previous destination";
    writeFileSync(output, original);
    const input = writeInput(root);
    const args = [...exportArgs(input, output), "--timeout-ms", "4000"];
    const changing = run(root, args, { mode: "changing-content-same-size" });
    const report = parseReport(changing);
    assert.equal(changing.status, 1, changing.stderr);
    assert.equal(check(report, "artifact-created").status, "FAIL");
    assert.match(check(report, "artifact-created").reason, /timed out after 4000 ms/);
    assert.equal(readFileSync(output, "utf8"), original);
    assert.equal(report.artifact_sha256, createHash("sha256").update(original).digest("hex"));
    assert.deepEqual(scratch(root), []);
    const control = run(root, args, { mode: "complete-then-hang" });
    assert.equal(control.status, 0, control.stderr);
    assert.deepEqual(parseReport(control).printPasses, [{ pass: 1, completedBy: "stage-stable" }]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a complete staged PDF followed by a nonzero exit remains FAIL", () => {
  const { root } = sandbox();
  try {
    const output = join(root, "report.pdf");
    const original = "previous destination";
    writeFileSync(output, original);
    const result = run(root, exportArgs(writeInput(root), output), { mode: "complete-then-nonzero" });
    const report = parseReport(result);
    assert.equal(result.status, 1);
    assert.equal(check(report, "artifact-created").status, "FAIL");
    assert.match(check(report, "artifact-created").reason, /status 8/);
    assert.equal(readFileSync(output, "utf8"), original);
    assert.deepEqual(report.printPasses, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("nonzero exit after stability request is not success", async () => {
  const { root, home } = sandbox();
  let pid;
  try {
    const input = writeInput(root);
    const stage = join(root, "stage.pdf");
    const marker = join(root, "release");
    let calls = 0;
    const result = await runTool(TOOLS, [
      "--user-data-dir=" + root, "--print-to-pdf=" + stage, pathToFileURL(input).href,
    ], 5_000, {
      completionPath: stage,
      env: { ...process.env, HOME: home, CXC_VISUALIZER_FIXTURE_MODE: "complete-then-nonzero-after-stable-request", CXC_VISUALIZER_RACE_RELEASE: marker },
      killTree(child) {
        calls += 1;
        pid = child.pid;
        writeFileSync(marker, "release");
        return { error: null, signalSent: null, taskkillStatus: null };
      },
    });
    assert.equal(calls, 1);
    assert.equal(existsSync(marker), true);
    assert.equal(result.ok, false);
    assert.match(result.reason, /status 3/);
    assert.notEqual(result.completedBy, "stage-stable");
  } finally {
    killFixture(pid);
    rmSync(root, { recursive: true, force: true });
  }
});

test("runTool reports cleanup failure when injected kill cannot produce child exit", async () => {
  let pid;
  try {
    const result = await runTool(process.execPath, ["-e", "setInterval(() => {}, 1000)"], 100, {
      postKillGraceMs: 20,
      killTree(child) {
        pid = child.pid;
        return { error: "tree cleanup failed: injected", signalSent: null, taskkillStatus: null };
      },
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /tree cleanup failed: injected/);
    assert.match(result.reason, /post-kill grace expired before child exit/);
  } finally { killFixture(pid); }
});

test("a child that survives post-kill grace does not keep the exporter process alive", () => {
  const script = [
    `import { runTool } from ${JSON.stringify(pathToFileURL(SCRIPT).href)};`,
    "let pid;",
    "const result = await runTool(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], 100, {",
    "  postKillGraceMs: 50,",
    "  killTree(child) { pid = child.pid; return { error: 'tree cleanup failed: injected', signalSent: null, taskkillStatus: null }; },",
    "});",
    "console.log(JSON.stringify({ pid, ok: result.ok, reason: result.reason }));",
  ].join("\n");
  const probe = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", timeout: 20_000 });
  let reported;
  try {
    assert.equal(probe.error, undefined, "the wrapper must exit on its own before the 20 s watchdog");
    assert.equal(probe.status, 0, probe.stderr);
    reported = JSON.parse(probe.stdout.trim().split("\n").pop());
    assert.equal(reported.ok, false);
    assert.match(reported.reason, /post-kill grace expired before child exit/);
  } finally { killFixture(reported?.pid); }
});

test("a stage that changes after the stability decision is not a stable completion", async () => {
  const { root } = sandbox();
  try {
    const stage = join(root, "stage.pdf");
    const source = `require('node:fs').writeFileSync(process.argv[1], ${JSON.stringify("%PDF-1.4\n%%EOF\n")}); setInterval(() => {}, 1000)`;
    const result = await runTool(process.execPath, ["-e", source, stage], 8_000, {
      completionPath: stage,
      killTree(child) {
        writeFileSync(stage, "%PDF-1.4\n");
        child.kill("SIGKILL");
        return process.platform === "win32"
          ? { error: null, signalSent: null, taskkillStatus: 0 }
          : { error: null, signalSent: "SIGKILL", taskkillStatus: null };
      },
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /stage changed or disappeared after the stability decision/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test("human summaries print each failed check id and reason once", () => {
  const { root } = sandbox();
  try {
    const input = writeInput(root);
    const output = join(root, "report.pdf");
    const timeoutArgs = [...exportArgs(input, output).filter((arg) => arg !== "--json"), "--timeout-ms", "1000"];
    const failed = run(root, timeoutArgs, { mode: "chrome-hang" });
    assert.equal(failed.status, 1);
    assert.equal((failed.stdout.match(/FAIL artifact-created:/g) || []).length, 1);
    assert.match(failed.stdout, /FAIL artifact-created:.*timed out after 1000 ms/);
    const missing = run(root, [input, output, "--chrome", TOOLS], { path: join(root, "empty-path") });
    assert.equal(missing.status, 3);
    for (const id of ["pdf-parse", "text-integrity", "pagination"]) {
      assert.equal((missing.stdout.match(new RegExp(`NOT_RUN ${id}:`, "g")) || []).length, 1);
    }
    assert.equal((missing.stdout.match(/Required executable missing: pdfinfo/g) || []).length, 3);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the stage probe accepts EOF trailer whitespace and rejects incomplete trailers", async () => {
  const { root } = sandbox();
  try {
    for (const [trailer, complete] of [["%%EOF", true], ["%%EOF\n", true], ["%%EOF\r\n", true], ["%%EO", false], ["%%EOF\nxref", false]]) {
      const stage = join(root, "probe.pdf");
      const source = `require('node:fs').writeFileSync(process.argv[1], ${JSON.stringify(`%PDF-1.4\n${trailer}`)}); setInterval(() => {}, 1000)`;
      const result = await runTool(process.execPath, ["-e", source, stage], complete ? 8_000 : 500, { completionPath: stage });
      assert.equal(result.ok, complete, `trailer ${JSON.stringify(trailer)}: ${result.reason}`);
      if (complete) assert.equal(result.completedBy, "stage-stable");
      else assert.match(result.reason, /timed out after 500 ms/);
    }
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

test("locale QA reads only source-owned @page literals", () => {
  const cases = [
    { name: "Korean language", lang: ' lang="ko"', content: '"가온리테일"', body: "한국어", p2: false, note: false },
    { name: "English with Korean furniture", lang: ' lang="en"', content: '"가온리테일"', body: "English", p2: true, note: false },
    { name: "English with dotted date", lang: ' lang="en-US"', content: '"2026. 9. 9."', body: "English", p2: true, note: false },
    { name: "English with page counter", lang: ' lang="en"', content: 'counter(page)', body: "한국어 body only", p2: false, note: false },
    { name: "missing language", lang: "", content: '"가온리테일"', body: "한국어", p2: false, note: true },
    { name: "commented declaration", lang: ' lang="en"', content: 'counter(page); /* content: "가온리테일"; */', body: "English", p2: false, note: false },
    { name: "commented rule", lang: ' lang="en"', style: '/* @page { @top-left { content: "가온리테일"; } } */', body: "English", p2: false, note: false },
    { name: "comment marker inside a string", lang: ' lang="en"', content: '"Acme /* 가온 */"', body: "English", p2: true, note: false },
  ];
  for (const fixture of cases) {
    const { root } = sandbox();
    try {
      const input = writeInput(root);
      writeFileSync(input, `<!doctype html><html${fixture.lang}><head><style>${fixture.style ?? `@page { @top-left { content: ${fixture.content}; } }`}</style></head><body>${fixture.body}</body></html>`);
      const report = parseReport(run(root, exportArgs(input, join(root, "report.pdf"))));
      assert.equal(report.qa.some((finding) => finding.level === "P2" && /@page content/.test(finding.msg)), fixture.p2, fixture.name);
      assert.equal(report.notes.some((note) => note.id === "page-locale"), fixture.note, fixture.name);
      assert.equal(report.verdict, fixture.p2 ? "REVIEW" : "PASS", fixture.name);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test("dump-dom sampling cap is a nonblocking note", () => {
  const { root } = sandbox();
  try {
    const report = parseReport(run(root, exportArgs(writeInput(root), join(root, "report.pdf")), { mode: "dump-dom-cap" }));
    assert.equal(report.svgGeometry.status, "NOT_RUN");
    assert.equal(report.verdict, "PASS");
    assert.equal(report.svgGeometry.findings, 0);
    assert.ok(report.notes.some((note) => note.id === "svg-geometry" && /sampling budget was exhausted/.test(note.message)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the SVG probe reads the final filled HTML after a contents refill", () => {
  const { root } = sandbox();
  try {
    const input = writeInput(root);
    writeFileSync(input, '<html lang="en"><head></head><body><span data-toc-for="section">?</span><h2 id="section" data-toc="Section heading">Section heading</h2></body></html>');
    const capture = join(root, "dom-capture.html");
    const report = parseReport(run(root, exportArgs(input, join(root, "report.pdf")), {
      mode: "second-pass-success", env: { CXC_VISUALIZER_DOM_CAPTURE: capture },
    }));
    assert.equal(report.passes, 2);
    assert.equal(report.svgGeometry.status, "PASS");
    const html = readFileSync(capture, "utf8");
    assert.match(html, /<span data-toc-for="section">2<\/span>/);
    assert.match(html, /out\.id="cxc-svg-geometry-result-v1"/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("real Chrome SVG crossing smoke", { skip: process.env.CXC_REAL_CHROME !== "1" && "set CXC_REAL_CHROME=1 for installed Chrome/Poppler" }, () => {
  const { root } = sandbox();
  try {
    const input = writeInput(root);
    writeFileSync(input, '<!doctype html><html lang="en"><body><h1>Geometry</h1><svg viewBox="0 0 300 100" width="300"><text x="50" y="55" font-size="25">LABEL</text><line x1="0" y1="47" x2="280" y2="47" stroke="black" stroke-width="2"/></svg></body></html>');
    const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    const result = spawnSync(process.execPath, [SCRIPT, input, join(root, "report.pdf"), "--chrome", chrome, "--json"], { encoding: "utf8", timeout: 60_000 });
    const report = parseReport(result);
    assert.equal(report.svgGeometry.status, "REVIEW", result.stderr);
    assert.ok(report.qa.some((finding) => /SVG text box is crossed/.test(finding.msg)));
    const variants = [
      // A connector moved onto the label by a group transform still crosses it.
      { name: "transformed", svg: '<text x="50" y="55" font-size="25">LABEL</text><g transform="translate(0 40)"><line x1="0" y1="7" x2="280" y2="7" stroke="black" stroke-width="2"/></g>', crossed: true },
      // Connectors inside hidden or transparent groups are not painted.
      { name: "display none", svg: '<text x="50" y="55" font-size="25">LABEL</text><g style="display:none"><line x1="0" y1="47" x2="280" y2="47" stroke="black" stroke-width="2"/></g>', crossed: false },
      { name: "opacity zero", svg: '<text x="50" y="55" font-size="25">LABEL</text><g opacity="0"><line x1="0" y1="47" x2="280" y2="47" stroke="black" stroke-width="2"/></g>', crossed: false },
    ];
    for (const variant of variants) {
      writeFileSync(input, `<!doctype html><html lang="en"><body><h1>Geometry</h1><svg viewBox="0 0 300 100" width="300">${variant.svg}</svg></body></html>`);
      const run2 = spawnSync(process.execPath, [SCRIPT, input, join(root, variant.name.replace(/ /g, "-") + ".pdf"), "--chrome", chrome, "--json"], { encoding: "utf8", timeout: 60_000 });
      const found = parseReport(run2).qa.some((finding) => /SVG text box is crossed/.test(finding.msg));
      assert.equal(found, variant.crossed, variant.name);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
