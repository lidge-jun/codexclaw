#!/usr/bin/env node
/**
 * Print an HTML report with an isolated Chromium profile, fill contents-page
 * numbers in a second pass, and emit bounded automated PDF evidence.
 * Exit 0 PASS, 1 FAIL, 2 REVIEW, 3 BLOCKED.
 * Each tool has a 30s deadline; --timeout-ms accepts 100..300000 milliseconds.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  accessSync, constants, existsSync, mkdirSync, mkdtempSync, readFileSync,
  realpathSync, rmSync, statSync, renameSync, writeFileSync, openSync, closeSync,
} from "node:fs";
import { basename, delimiter, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

import { evaluateReport } from "./quality-gate.mjs";

const PAPER_SIZES = Object.freeze({
  A4: Object.freeze({ width: 595.28, height: 841.89 }),
  Letter: Object.freeze({ width: 612, height: 792 }),
});
const CHECK_IDS = ["artifact-created", "pdf-parse", "text-integrity", "pagination"];
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 300_000;
const usage = "usage: export-paged-report.mjs <input.html> <output.pdf> [--chrome <path>] [--pdfinfo <path>] [--pdftotext <path>] [--paper-size A4|Letter] [--timeout-ms <100..300000>] [--keep-html] [--json]\n       export-paged-report.mjs --qa-only <existing.pdf> [--pdfinfo <path>] [--pdftotext <path>] [--paper-size A4|Letter] [--timeout-ms <100..300000>] [--json]";

function fail(message) { throw new Error(message); }

function parseArgs(argv) {
  const flags = {
    chrome: process.env.CHROME_PATH || "", pdfinfo: "", pdftotext: "",
    paperSize: "A4", keepHtml: false, json: false, qaOnly: false, timeoutMs: DEFAULT_TIMEOUT_MS,
  };
  const positional = [];
  const valueFlags = new Map([
    ["--chrome", "chrome"], ["--pdfinfo", "pdfinfo"],
    ["--pdftotext", "pdftotext"], ["--paper-size", "paperSize"],
    ["--timeout-ms", "timeoutMs"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (valueFlags.has(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`${arg} needs a value`);
      flags[valueFlags.get(arg)] = value;
      index += 1;
    } else if (arg === "--keep-html") flags.keepHtml = true;
    else if (arg === "--json") flags.json = true;
    else if (arg === "--qa-only") flags.qaOnly = true;
    else if (arg.startsWith("--")) fail(`unknown option: ${arg}`);
    else positional.push(arg);
  }
  if (!Object.hasOwn(PAPER_SIZES, flags.paperSize)) fail("--paper-size must be A4|Letter");
  flags.timeoutMs = Number(flags.timeoutMs);
  if (!Number.isInteger(flags.timeoutMs) || flags.timeoutMs < 100 || flags.timeoutMs > MAX_TIMEOUT_MS) {
    fail("--timeout-ms must be an integer from 100 to 300000 milliseconds (default 30000)");
  }
  if (positional.length !== (flags.qaOnly ? 1 : 2)) fail(usage);
  return { flags, positional };
}

function executableFile(path) {
  try {
    if (!statSync(path).isFile()) return false;
    if (process.platform !== "win32" && !/[.](?:[cm]?js)$/i.test(path)) accessSync(path, constants.X_OK);
    return true;
  } catch { return false; }
}

function discover(command) {
  if (!command) return null;
  if (command.includes("/") || command.includes("\\") || isAbsolute(command)) {
    const candidate = resolve(command);
    return executableFile(candidate) ? candidate : null;
  }
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";") : [""];
  for (const directory of (process.env.PATH || "").split(delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = join(directory, command + extension);
      if (executableFile(candidate)) return candidate;
    }
  }
  return null;
}

function killToolTree(child) {
  if (process.platform === "win32") {
    // Kill descendants while their parent still exists; no shell/PATH lookup or
    // image-name matching. taskkill's /F is the Windows hard-kill equivalent.
    const taskkill = join(process.env.SystemRoot || process.env.WINDIR || "C:\\Windows", "System32", "taskkill.exe");
    const result = spawnSync(taskkill, ["/PID", String(child.pid), "/T", "/F"], {
      timeout: 5000, killSignal: "SIGKILL", windowsHide: true, encoding: "utf8",
    });
    if (result.error || result.status !== 0) {
      child.kill("SIGKILL");
      return `tree cleanup failed: ${result.error?.message || result.stderr || result.status}`;
    }
  } else {
    try { process.kill(-child.pid, "SIGKILL"); }
    catch (error) { if (error.code !== "ESRCH") { child.kill("SIGKILL"); return `tree cleanup failed: ${error.message}`; } }
  }
  return null;
}

async function runTool(tool, args, timeoutMs) {
  const nodeModule = /[.](?:[cm]?js)$/i.test(tool);
  // Regular files avoid waiting for pipe EOF when an exited tool's descendants
  // retain stdout/stderr. A dedicated group owns the POSIX process tree.
  const captureDir = mkdtempSync(join(tmpdir(), "cxc-report-tool-"));
  const descriptors = [];
  let result;
  try {
    for (const name of ["stdout", "stderr"]) descriptors.push(openSync(join(captureDir, name), "w+"));
    result = await new Promise((resolveResult) => {
      const child = spawn(nodeModule ? process.execPath : tool, nodeModule ? [tool, ...args] : args, {
        stdio: ["ignore", ...descriptors], detached: process.platform !== "win32", windowsHide: true,
      });
      let timedOut = false, cleanupError = null;
      const timer = setTimeout(() => {
        timedOut = true;
        if (child.pid) cleanupError = killToolTree(child);
      }, timeoutMs);
      child.once("error", (error) => { clearTimeout(timer); resolveResult({ error }); });
      child.once("exit", (status, signal) => {
        clearTimeout(timer);
        resolveResult({ status, signal, timedOut, cleanupError });
      });
    });
    result.stdout = readFileSync(join(captureDir, "stdout"), "utf8");
    result.stderr = readFileSync(join(captureDir, "stderr"), "utf8");
  } finally {
    for (const descriptor of descriptors) closeSync(descriptor);
    rmSync(captureDir, { recursive: true, force: true });
  }
  if (result.timedOut) return { ok: false, reason: `timed out after ${timeoutMs} ms; killSignal SIGKILL (owned process tree)${result.cleanupError ? `; ${result.cleanupError}` : ""}` };
  if (result.error) return { ok: false, reason: `could not start: ${result.error.code || result.error.message}` };
  if (result.signal) return { ok: false, reason: `terminated by signal ${result.signal}` };
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim().slice(-400);
    return { ok: false, reason: `exited with status ${String(result.status)}${detail ? `: ${detail}` : ""}` };
  }
  return { ok: true, stdout: result.stdout || "" };
}

function check(id, status, reason, evidence = null) {
  const item = { id, required: true, status, reason };
  if (evidence) item.evidence = evidence;
  return item;
}

function setCheck(report, id, status, reason, evidence = null) {
  report.checks[CHECK_IDS.indexOf(id)] = check(id, status, reason, evidence);
}

function sameFile(input, output) {
  if (resolve(input) === resolve(output)) return true;
  if (!existsSync(output)) return false;
  try { return realpathSync(input) === realpathSync(output); } catch { return false; }
}

function ensureOutputDirectory(output) {
  const outDir = dirname(output);
  try { if (statSync(outDir).isDirectory()) return; } catch { /* create below */ }
  try { mkdirSync(outDir, { recursive: true }); }
  catch (error) { fail(`cannot create output directory ${outDir}: ${error?.code || error}`); }
}

function injectPaperSize(html, paperSize) {
  const style = `<style data-cxc-paper-size>@page { size: ${paperSize}; }</style>`;
  return /<\/head\s*>/i.test(html) ? html.replace(/<\/head\s*>/i, `${style}</head>`) : `${style}${html}`;
}

function writeTempHtml(input, html, tempFiles) {
  const path = join(dirname(input), `.${basename(input, extname(input))}.${randomUUID()}.export-pass.html`);
  writeFileSync(path, html);
  tempFiles.add(path);
  return path;
}

async function printPdf(chrome, htmlPath, pdfPath, profilePath, timeoutMs, tempFiles) {
  const stage = join(dirname(pdfPath), `.${basename(pdfPath)}.${randomUUID()}.export-stage.pdf`);
  tempFiles.add(stage);
  const result = await runTool(chrome, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--user-data-dir=${profilePath}`, "--no-pdf-header-footer",
    "--run-all-compositor-stages-before-draw", "--virtual-time-budget=10000",
    `--print-to-pdf=${stage}`, pathToFileURL(htmlPath).href,
  ], timeoutMs);
  if (!result.ok) return result;
  try {
    if (statSync(stage).isFile() && readFileSync(stage).subarray(0, 5).toString() === "%PDF-") return { ok: true, path: stage };
  } catch { /* report below */ }
  return { ok: false, reason: "browser exited successfully but produced no nonempty PDF" };
}

async function parsePdfInfo(tool, pdfPath, timeoutMs) {
  const result = await runTool(tool, [pdfPath], timeoutMs);
  if (!result.ok) return result;
  const pageMatch = /^Pages:\s+(\d+)\s*$/im.exec(result.stdout);
  const pages = pageMatch ? Number(pageMatch[1]) : Number.NaN;
  if (!Number.isSafeInteger(pages) || pages <= 0) return { ok: false, reason: "returned no positive finite page count" };
  const geometry = await runTool(tool, ["-f", "1", "-l", String(pages), pdfPath], timeoutMs);
  if (!geometry.ok) return geometry;
  const pageSizes = [...geometry.stdout.matchAll(/^Page\s+(\d+)\s+size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts(?:\s+\(([^)]+)\))?\s*$/gim)]
    .map((match) => ({ page: Number(match[1]), w: Number(match[2]), h: Number(match[3]), name: match[4] || null }));
  if (pageSizes.length !== pages || pageSizes.some((size, index) => size.page !== index + 1 || !Number.isFinite(size.w) || !Number.isFinite(size.h) || size.w <= 0 || size.h <= 0)) {
    return { ok: false, reason: "returned incomplete or invalid per-page geometry" };
  }
  return { ok: true, pages, size: pageSizes[0], pageSizes };
}

async function extractPageTexts(tool, pdfPath, pageCount, timeoutMs) {
  const texts = [];
  for (let page = 1; page <= pageCount; page += 1) {
    const result = await runTool(tool, ["-f", String(page), "-l", String(page), "-layout", pdfPath, "-"], timeoutMs);
    if (!result.ok) return { ok: false, reason: `pdftotext page ${page} ${result.reason}` };
    if (!result.stdout.trim()) return { ok: false, reason: `pdftotext returned empty text for page ${page}` };
    texts.push(result.stdout);
  }
  return { ok: true, texts };
}

async function extractBlankFraction(tool, pdfPath, page, timeoutMs) {
  const result = await runTool(tool, ["-f", String(page), "-l", String(page), "-bbox", pdfPath, "-"], timeoutMs);
  if (!result.ok) return { ok: false, reason: `pdftotext bbox page ${page} ${result.reason}` };
  if (!result.stdout.trim()) return { ok: false, reason: `pdftotext bbox returned empty output for page ${page}` };
  const pageMatch = /<page width="([\d.]+)" height="([\d.]+)"/.exec(result.stdout);
  const words = [...result.stdout.matchAll(/<word xMin="[\d.]+" yMin="([\d.]+)" xMax="[\d.]+" yMax="([\d.]+)">/g)]
    .map((match) => ({ y0: Number(match[1]), y1: Number(match[2]) }));
  if (!pageMatch || !words.length) return { ok: false, reason: `pdftotext bbox returned invalid geometry for page ${page}` };
  const height = Number(pageMatch[2]);
  const top = Math.min(...words.map((word) => word.y0));
  const body = words.filter((word) => word.y1 < height - 46);
  if (!Number.isFinite(height) || !Number.isFinite(top) || !body.length) {
    return { ok: false, reason: `pdftotext bbox returned invalid text bounds for page ${page}` };
  }
  const areaBottom = height - 62;
  const usable = areaBottom - top;
  if (!(usable > 0)) return { ok: false, reason: `pdftotext bbox returned unusable text area for page ${page}` };
  const bottom = Math.max(...body.map((word) => word.y1));
  return { ok: true, blank: Math.max(0, (areaBottom - bottom) / usable) };
}

const normalize = (value) => value.replace(/\s+/g, "").replace(/[–—-]/g, "-");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function locate(texts, text, fromPage = 1) {
  const key = normalize(text);
  for (let index = fromPage - 1; index < texts.length; index += 1) if (normalize(texts[index]).includes(key)) return index + 1;
  const short = key.slice(0, 24);
  for (let index = fromPage - 1; index < texts.length; index += 1) if (normalize(texts[index]).includes(short)) return index + 1;
  return null;
}

function collectTargets(html) {
  const targets = [];
  for (const match of html.matchAll(/<(section|h[1-6]|div)[^>]*\bid="([^"]+)"[^>]*\bdata-toc="([^"]+)"/g)) {
    targets.push({ id: match[2], text: match[3] });
  }
  for (const match of html.matchAll(/<(section|h[1-6]|div)[^>]*\bdata-toc="([^"]+)"[^>]*\bid="([^"]+)"/g)) {
    if (!targets.some((target) => target.id === match[3])) targets.push({ id: match[3], text: match[2] });
  }
  return targets;
}

function paperMatches(size, paperSize) {
  const expected = PAPER_SIZES[paperSize];
  return Math.abs(size.w - expected.width) < 2 && Math.abs(size.h - expected.height) < 2;
}

async function analyzeLayout(report, texts, pdftotext, pdfPath) {
  const headingLike = (line) => /^\s*(\d+|부록|요약|Appendix|Summary)\b/.test(line) || line.trim().length > 40;
  for (const size of report.pageSizes) {
    if (!paperMatches(size, report.paperSize)) report.qa.push({ level: "P2", page: size.page, msg: `page size is ${size.name || `${size.w}x${size.h}`}, not requested ${report.paperSize}` });
  }
  for (let index = 0; index < texts.length; index += 1) {
    const page = index + 1;
    const nonEmpty = texts[index].split("\n").map((line) => line.replace(/\s+$/, "")).filter((line) => line.trim());
    if (page === 1) continue;
    const last = (nonEmpty.at(-1) || "").trim();
    if (!/^\d+(\s*\/\s*\d+)?$/.test(last) && !/\b\d+\s*\/\s*\d+\s*$/.test(last)) report.qa.push({ level: "P1", page, msg: "no page number detected in the bottom line" });
    const first = (nonEmpty[0] || "").trim();
    if (first && first.length <= 30 && /[.。!?]$/.test(first) && !headingLike(first) && !/^\d/.test(first)) report.qa.push({ level: "P1", page, msg: `page starts with an orphan fragment: "${first}"` });
    const tail = nonEmpty.slice(-3, -1).map((line) => line.trim()).filter(Boolean);
    if (tail.length && /^\d+\s+\S/.test(tail.at(-1)) && tail.at(-1).length < 60 && nonEmpty.length > 3) report.qa.push({ level: "P2", page, msg: `possible heading at page bottom: "${tail.at(-1)}"` });
    if (page > 3 && nonEmpty.length < 10) report.qa.push({ level: "P2", page, msg: `low density (${nonEmpty.length} text lines); check for a stranded figure or excess white space` });
    const isContents = nonEmpty.slice(0, 3).some((line) => /^\s*(목차|contents|table of contents)\s*$/i.test(line));
    if (page >= 2 && page < texts.length && !isContents) {
      const blank = await extractBlankFraction(pdftotext, pdfPath, page, report.timeoutMs);
      if (!blank.ok) return blank;
      if (blank.blank >= 0.3) report.qa.push({ level: "P2", page, msg: `${Math.round(blank.blank * 100)}% of the text area is blank below the content; let the next section flow or move a figure` });
    }
  }
  return { ok: true };
}

function artifactDigest(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }

function finish(report, flags, tempFiles, profilePath, retainedHtml = null) {
  if (report.pendingPdf && report.generationComplete && report.checks[1].status !== "FAIL") {
    // Same-directory rename preserves the old destination until ALL print passes
    // succeed. A failed rename never unlinks the last good PDF.
    renameSync(report.pendingPdf, report.output);
  } else if (report.pendingPdf) {
    for (const item of report.checks) {
      if (item.status === "PASS") Object.assign(item, { status: "NOT_RUN", reason: "Candidate checks do not certify the preserved destination." });
    }
    if (report.checks[0].status !== "FAIL") setCheck(report, "artifact-created", "FAIL", "Generation did not complete; previous destination preserved.");
  }
  delete report.pendingPdf;
  delete report.generationComplete;
  report.artifactExists = !report.artifactInvalid && existsSync(report.output);
  if (report.artifactExists) {
    try { report.artifact_sha256 = artifactDigest(report.output); }
    catch { report.artifactExists = false; report.artifact_sha256 = null; }
  }
  for (const item of report.checks) if (item.status === "PASS") item.artifact_sha256 = report.artifact_sha256;

  if (!report.artifactExists || !report.artifact_sha256) {
    report.verdict = "FAIL";
    report.exitCode = 1;
    report.findings = [{ level: "FAIL", id: "artifact-created", message: "No readable final PDF artifact exists." }];
  } else {
    const gate = evaluateReport(report, { profile: "standard" });
    Object.assign(report, { verdict: gate.verdict, exitCode: gate.exitCode, profile: gate.profile, omitted: gate.omitted, findings: gate.findings });
  }
  report.deliveryReady = false;
  delete report.artifactInvalid;

  const keep = flags.keepHtml && report.exitCode !== 1 ? retainedHtml : null;
  for (const path of tempFiles) if (path !== keep) rmSync(path, { force: true });
  if (keep) report.filledHtml = keep;
  if (profilePath) rmSync(profilePath, { recursive: true, force: true });

  if (flags.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`export-paged-report: ${report.output} (${report.pages ?? "?"} pages, ${report.pageSize?.name || "size ?"}, ${report.passes} pass${report.passes === 1 ? "" : "es"})`);
    for (const target of report.toc) console.log(`  toc  ${String(target.page ?? "?").padStart(3)}  ${target.text}`);
    for (const finding of report.qa) console.log(`  ${finding.level}  p${finding.page ?? "-"}  ${finding.msg}`);
    for (const reason of report.notRun) console.log(`  NOT RUN  ${reason}`);
    console.log(`  verdict: ${report.verdict}; deliveryReady: false`);
  }
  return report.exitCode;
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const input = resolve(positional[0]);
  const output = flags.qaOnly ? input : resolve(positional[1]);
  if (!existsSync(input)) fail(`input not found: ${input}`);
  const report = {
    schemaVersion: 1, input, output, paperSize: flags.paperSize, timeoutMs: flags.timeoutMs,
    artifact_sha256: null, artifactExists: false, deliveryReady: false,
    chrome: null, passes: flags.qaOnly ? 0 : 1, pages: null, pageSize: null,
    toc: [], qa: [], notRun: [],
    checks: CHECK_IDS.map((id) => check(id, "NOT_RUN", "Check has not run.")),
  };
  const tempFiles = new Set();
  let profilePath = null;
  let retainedHtml = null;
  let pdfPath = output;

  try {
  if (!flags.qaOnly && sameFile(input, output)) {
    report.artifactInvalid = true;
    setCheck(report, "artifact-created", "FAIL", "Input and output resolve to the same file; refusing to overwrite input.");
    return finish(report, flags, tempFiles, profilePath);
  }

  const chromeCandidates = flags.chrome ? [flags.chrome] : [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium", "google-chrome",
    "google-chrome-stable", "chromium", "chromium-browser", "chrome",
  ];
  const chrome = flags.qaOnly ? null : chromeCandidates.map(discover).find(Boolean);
  const pdfinfo = discover(flags.pdfinfo || "pdfinfo");
  const pdftotext = discover(flags.pdftotext || "pdftotext");
  report.chrome = chrome;
  if (!flags.qaOnly && !chrome) fail("no Chromium binary found; pass --chrome <path> or set CHROME_PATH");

  let sourceHtml = "";
  const targets = [];
  if (!flags.qaOnly) {
    ensureOutputDirectory(output);
    sourceHtml = readFileSync(input, "utf8");
    targets.push(...collectTargets(sourceHtml));
    profilePath = mkdtempSync(join(tmpdir(), "cxc-report-chrome-"));
    const printHtml = writeTempHtml(input, injectPaperSize(sourceHtml, flags.paperSize), tempFiles);
    retainedHtml = printHtml;
    const printed = await printPdf(chrome, printHtml, output, profilePath, flags.timeoutMs, tempFiles);
    if (!printed.ok) {
      setCheck(report, "artifact-created", "FAIL", `Chromium ${printed.reason}`);
      return finish(report, flags, tempFiles, profilePath);
    }
    pdfPath = printed.path;
    report.pendingPdf = pdfPath;
    report.generationComplete = true;
  }

  if (!existsSync(pdfPath) || statSync(pdfPath).size <= 0) {
    setCheck(report, "artifact-created", "FAIL", "No nonempty PDF artifact exists at the QA boundary.");
    return finish(report, flags, tempFiles, profilePath, retainedHtml);
  }
  setCheck(report, "artifact-created", "PASS",
    flags.qaOnly ? "Existing nonempty PDF found at the QA boundary." : "Chromium produced a fresh staged PDF; all print passes must succeed before atomic promotion.",
    `artifact:${output}`);

  if (!pdfinfo) {
    const reason = "Required executable missing: pdfinfo. Automated PDF checks did not run.";
    report.notRun.push(reason);
    setCheck(report, "pdf-parse", "NOT_RUN", reason);
    setCheck(report, "text-integrity", "NOT_RUN", reason);
    setCheck(report, "pagination", "NOT_RUN", reason);
    return finish(report, flags, tempFiles, profilePath, retainedHtml);
  }

  let info = await parsePdfInfo(pdfinfo, pdfPath, flags.timeoutMs);
  if (!info.ok) {
    setCheck(report, "pdf-parse", "FAIL", `pdfinfo ${info.reason}`);
    return finish(report, flags, tempFiles, profilePath, retainedHtml);
  }
  if (!pdftotext) {
    const reason = "Required executable missing: pdftotext. Text and pagination checks did not run.";
    report.notRun.push(reason);
    setCheck(report, "pdf-parse", "PASS", `pdfinfo parsed ${info.pages} pages with positive geometry.`, `pdfinfo:${output}`);
    setCheck(report, "text-integrity", "NOT_RUN", reason);
    setCheck(report, "pagination", "NOT_RUN", reason);
    return finish(report, flags, tempFiles, profilePath, retainedHtml);
  }
  let extracted = await extractPageTexts(pdftotext, pdfPath, info.pages, flags.timeoutMs);
  if (!extracted.ok) {
    setCheck(report, "pdf-parse", "PASS", `pdfinfo parsed ${info.pages} pages with positive geometry.`, `pdfinfo:${output}`);
    setCheck(report, "text-integrity", "FAIL", extracted.reason);
    return finish(report, flags, tempFiles, profilePath, retainedHtml);
  }

  if (!flags.qaOnly && targets.length) {
    const tocPage = locate(extracted.texts, "목차") || locate(extracted.texts, "Contents") || 2;
    const paperHtml = injectPaperSize(sourceHtml, flags.paperSize);
    let filled = paperHtml;
    for (const target of targets) {
      const page = locate(extracted.texts, target.text, tocPage + 1);
      report.toc.push({ ...target, page });
      if (page) {
        const pattern = new RegExp(`(<[^>]*\\bdata-toc-for="${escapeRegExp(target.id)}"[^>]*>)([^<]*)(</)`, "g");
        filled = filled.replace(pattern, `$1${page}$3`);
      }
    }
    if (filled !== paperHtml) {
      const filledPath = writeTempHtml(input, filled, tempFiles);
      retainedHtml = filledPath;
      const printed = await printPdf(chrome, filledPath, output, profilePath, flags.timeoutMs, tempFiles);
      if (!printed.ok) {
        report.generationComplete = false;
        setCheck(report, "artifact-created", "FAIL", `Chromium second pass ${printed.reason}`);
        return finish(report, flags, tempFiles, profilePath);
      }
      pdfPath = printed.path;
      report.pendingPdf = pdfPath;
      report.generationComplete = true;
      report.passes = 2;
      info = await parsePdfInfo(pdfinfo, pdfPath, flags.timeoutMs);
      if (!info.ok) {
        setCheck(report, "pdf-parse", "FAIL", `pdfinfo after second pass ${info.reason}`);
        return finish(report, flags, tempFiles, profilePath, retainedHtml);
      }
      extracted = await extractPageTexts(pdftotext, pdfPath, info.pages, flags.timeoutMs);
      if (!extracted.ok) {
        setCheck(report, "pdf-parse", "PASS", `pdfinfo parsed ${info.pages} pages with positive geometry.`, `pdfinfo:${output}`);
        setCheck(report, "text-integrity", "FAIL", extracted.reason);
        return finish(report, flags, tempFiles, profilePath, retainedHtml);
      }
      for (const target of report.toc) {
        const actual = locate(extracted.texts, target.text, tocPage + 1);
        if (actual !== target.page) report.qa.push({ level: "P0", page: actual, msg: `contents page number drifted after refill for ${target.id}: wrote ${target.page}, now on ${actual}` });
      }
    }
    report.generationComplete = true;
  }

  report.pages = info.pages;
  report.pageSize = info.size;
  report.pageSizes = info.pageSizes;
  setCheck(report, "pdf-parse", "PASS", `pdfinfo parsed ${info.pages} pages with positive geometry.`, `pdfinfo:${output}`);
  setCheck(report, "text-integrity", "PASS",
    `Nonempty extracted text only was confirmed on ${info.pages} pages; record reconciliation and semantic correctness remain outside this automated check.`,
    `pdftotext:${output}#pages=1-${info.pages}`);

  const layout = await analyzeLayout(report, extracted.texts, pdftotext, pdfPath);
  if (!layout.ok) {
    setCheck(report, "pagination", "FAIL", layout.reason);
    return finish(report, flags, tempFiles, profilePath, retainedHtml);
  }
  const layoutStatus = report.qa.length ? (report.qa.some((item) => item.level === "P0") ? "FAIL" : "REVIEW") : "PASS";
  setCheck(report, "pagination", layoutStatus,
    report.qa.length
      ? `${report.qa.length} automated layout heuristic finding(s) require review; rendered-page inspection remains separate.`
      : "Automated layout heuristics only found no text-level pagination findings; rendered-page inspection remains separate.",
    layoutStatus === "PASS" ? `pagination:${output}#automated-text-layout` : null);
  return finish(report, flags, tempFiles, profilePath, retainedHtml);
  } catch (error) {
    for (const path of tempFiles) rmSync(path, { force: true });
    if (profilePath) rmSync(profilePath, { recursive: true, force: true });
    throw error;
  }
}

try { process.exitCode = await main(); }
catch (error) { console.error(`export-paged-report: ${error.message}`); process.exitCode = 1; }
