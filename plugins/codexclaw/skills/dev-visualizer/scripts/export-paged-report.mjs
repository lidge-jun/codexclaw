#!/usr/bin/env node
/**
 * export-paged-report.mjs — print an HTML report to PDF with a headless Chromium,
 * fill contents-page page numbers in a second pass, and run a layout QA over the
 * rendered pages.
 *
 * Why two passes: HeadlessChrome (measured on 152) honours @page margin boxes and
 * counter(page)/counter(pages) but ignores string-set and target-counter(), so a
 * table of contents cannot reference page numbers in CSS. This script prints once,
 * finds each [data-toc] heading in the PDF text, writes the page number into the
 * matching [data-toc-for] element, and prints again. A third text extraction
 * verifies the numbers still hold.
 *
 * Usage:
 *   node export-paged-report.mjs <input.html> <output.pdf> [--chrome <path>] [--keep-html] [--json]
 *   node export-paged-report.mjs --qa-only <existing.pdf> [--json]      (layout QA on a PDF from any engine)
 * Exit: 0 = automated checks passed; 1 = failure; 2 = review; 3 = required check not run.
 * This is automated PDF QA, not a human/editorial delivery certificate.
 * Requires pdftotext/pdfinfo (poppler) for TOC numbers and QA; without them the
 * PDF is still written and those steps report NOT RUN.
 */
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync, renameSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const flags = { chrome: process.env.CHROME_PATH || "", keepHtml: false, json: false, qaOnly: false };
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--chrome") {
    if (!args[i + 1] || args[i + 1].startsWith("--")) fail("--chrome requires a path");
    flags.chrome = args[++i];
  }
  else if (args[i] === "--keep-html") flags.keepHtml = true;
  else if (args[i] === "--json") flags.json = true;
  else if (args[i] === "--qa-only") flags.qaOnly = true;
  else if (args[i].startsWith("--")) fail("unknown option: " + args[i]);
  else positional.push(args[i]);
}
if (positional.length !== (flags.qaOnly ? 1 : 2)) {
  console.error("usage: export-paged-report.mjs <input.html> <output.pdf> [--chrome <path>] [--keep-html] [--json]\n       export-paged-report.mjs --qa-only <existing.pdf> [--json]");
  process.exit(1);
}
const input = resolve(positional[0]);
const output = flags.qaOnly ? input : resolve(positional[1]);
if (!existsSync(input) || !statSync(input).isFile()) fail("input file not found: " + input);
if (!flags.qaOnly && input === output) fail("input and output paths must differ");

const CHROME_CANDIDATES = [
  flags.chrome,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome",
].filter(Boolean);

function which(cmd) {
  if (cmd.includes("/")) return existsSync(cmd) ? cmd : null;
  const r = spawnSync("which", [cmd], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}
const chrome = flags.qaOnly ? null : CHROME_CANDIDATES.map(which).find(Boolean);
if (!chrome && !flags.qaOnly) fail("no Chromium binary found; pass --chrome <path> or set CHROME_PATH");
const pdftotext = which("pdftotext");
const pdfinfo = which("pdfinfo");

function fail(msg) { console.error("export-paged-report: " + msg); process.exit(1); }

function checked(cmd, argv) {
  const r = spawnSync(cmd, argv, { encoding: "utf8", timeout: 30000, maxBuffer: 32 * 1024 * 1024 });
  if (r.error || r.status !== 0) fail(basename(cmd) + " failed: " + (r.error?.message || r.stderr || "exit " + r.status).slice(-600));
  return r.stdout;
}

function printPdf(htmlPath, pdfPath) {
  const temporary = join(dirname(pdfPath), "." + basename(pdfPath) + "." + randomUUID() + ".pdf");
  const r = spawnSync(chrome, [
    "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
    "--run-all-compositor-stages-before-draw", "--virtual-time-budget=10000",
    "--print-to-pdf=" + temporary, pathToFileURL(htmlPath).href,
  ], { encoding: "utf8", timeout: 45000, maxBuffer: 4 * 1024 * 1024 });
  const valid = existsSync(temporary) && readFileSync(temporary).subarray(0, 5).toString() === "%PDF-";
  if (r.error || r.status !== 0 || !valid) {
    if (existsSync(temporary)) unlinkSync(temporary);
    fail("chrome print failed: " + (r.error?.message || r.stderr || "no fresh PDF").slice(-600));
  }
  renameSync(temporary, pdfPath);
}

function pageCount(pdfPath) {
  if (!pdfinfo) return null;
  const r = { stdout: checked(pdfinfo, [pdfPath]) };
  const m = /Pages:\s+(\d+)/.exec(r.stdout || "");
  const s = /Page size:\s+([\d.]+) x ([\d.]+) pts(?: \(([^)]+)\))?/.exec(r.stdout || "");
  if (!m || Number(m[1]) < 1 || !s) fail("pdfinfo returned invalid page metadata");
  return { pages: Number(m[1]), size: s ? { w: Number(s[1]), h: Number(s[2]), name: s[3] || null } : null };
}

function pageTexts(pdfPath, n) {
  const out = [];
  for (let p = 1; p <= n; p++) {
    const r = { stdout: checked(pdftotext, ["-f", String(p), "-l", String(p), "-layout", pdfPath, "-"]) };
    out.push(r.stdout || "");
  }
  return out;
}

const norm = (s) => s.replace(/\s+/g, "").replace(/[–—-]/g, "-");
const escapeRe = (s) => s.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");

// ---- collect TOC targets from the HTML ----
const html = flags.qaOnly ? "" : readFileSync(input, "utf8");
const targets = [];
for (const m of html.matchAll(/<(section|h[1-6]|div)[^>]*\bid="([^"]+)"[^>]*\bdata-toc="([^"]+)"/g)) targets.push({ id: m[2], text: m[3] });
for (const m of html.matchAll(/<(section|h[1-6]|div)[^>]*\bdata-toc="([^"]+)"[^>]*\bid="([^"]+)"/g)) if (!targets.some(t => t.id === m[3])) targets.push({ id: m[3], text: m[2] });

// ---- pass 1 ----
if (!flags.qaOnly) printPdf(input, output);
const report = { scope: "automated-pdf-checks", input, output, chrome, passes: flags.qaOnly ? 0 : 1, toc: [], qa: [], notRun: [] };
if (!pdftotext || !pdfinfo) {
  report.notRun.push("pdftotext/pdfinfo missing: contents page numbers and layout QA NOT RUN");
  finish(report);
}
let info = pageCount(output);
let texts = pageTexts(output, info.pages);

function locate(texts, text, fromPage = 1) {
  const key = norm(text);
  for (let i = fromPage - 1; i < texts.length; i++) if (norm(texts[i]).includes(key)) return i + 1;
  return null;
}

// ---- fill contents page numbers (search after the contents page itself) ----
if (targets.length) {
  const tocPage = locate(texts, "목차") || locate(texts, "Contents") || 2;
  let filled = html;
  for (const t of targets) {
    const page = locate(texts, t.text, tocPage + 1);
    report.toc.push({ id: t.id, text: t.text, page });
    if (!page) report.qa.push({ level: "P0", page: null, msg: "unresolved contents target: " + t.id });
    if (page) {
      const re = new RegExp('(<[^>]*\\bdata-toc-for="' + escapeRe(t.id) + '"[^>]*>)([^<]*)(</)', "g");
      if (!re.test(filled)) report.qa.push({ level: "P0", page, msg: "missing contents slot: " + t.id });
      re.lastIndex = 0;
      filled = filled.replace(re, (_all, open, _old, close) => open + page + close);
    }
  }
  if (filled !== html) {
    const tmp = join(dirname(input), "." + basename(input, ".html") + ".toc-pass.html");
    writeFileSync(tmp, filled);
    printPdf(tmp, output);
    report.passes = 2;
    info = pageCount(output);
    texts = pageTexts(output, info.pages);
    for (const t of report.toc) {
      const again = locate(texts, t.text, tocPage + 1);
      if (again !== t.page) report.qa.push({ level: "P0", page: again, msg: "contents page number drifted after refill for " + t.id + ": wrote " + t.page + ", now on " + again });
    }
    if (flags.keepHtml) report.filledHtml = tmp; else unlinkSync(tmp);
  }
}

// ---- layout QA over rendered text ----
report.pages = info.pages;
report.pageSize = info.size;
if (info.size && info.size.name !== "A4" && !(Math.abs(info.size.w - 595) < 2 && Math.abs(info.size.h - 842) < 2)) {
  report.qa.push({ level: "P2", page: null, msg: "page size is " + (info.size.name || info.size.w + "x" + info.size.h) + ", not A4; confirm the recipient's standard" });
}
const headingLike = (line) => /^\s*(\d+|부록|요약|Appendix|Summary)\b/.test(line) || line.trim().length > 40;
texts.forEach((t, i) => {
  const page = i + 1;
  const lines = t.split("\n").map(l => l.replace(/\s+$/, ""));
  const nonEmpty = lines.filter(l => l.trim());
  if (page === 1) return; // cover
  const last = (nonEmpty[nonEmpty.length - 1] || "").trim();
  if (!/^\d+(\s*\/\s*\d+)?$/.test(last) && !/\b\d+\s*\/\s*\d+\s*$/.test(last)) {
    report.qa.push({ level: "P1", page, msg: "no page number detected in the bottom line" });
  }
  const first = (nonEmpty[0] || "").trim();
  if (first && first.length <= 30 && /[.。!?]$/.test(first) && !headingLike(first) && !/^\d/.test(first)) {
    report.qa.push({ level: "P1", page, msg: 'page starts with an orphan fragment: "' + first + '"' });
  }
  const tail = nonEmpty.slice(-3, -1).map(l => l.trim()).filter(Boolean);
  if (tail.length && /^\d+\s+\S/.test(tail[tail.length - 1]) && tail[tail.length - 1].length < 60 && nonEmpty.length > 3) {
    report.qa.push({ level: "P2", page, msg: 'possible heading at page bottom: "' + tail[tail.length - 1] + '"' });
  }
  if (page > 3 && nonEmpty.length < 10) {
    report.qa.push({ level: "P2", page, msg: "low density (" + nonEmpty.length + " text lines); check for a stranded figure or excess white space" });
  }
  // white space below the content, measured from word boxes (layout text collapses gaps)
  const isContents = nonEmpty.slice(0, 3).some(l => /^\s*(목차|contents|table of contents)\s*$/i.test(l));
  if (page >= 2 && page < texts.length && !isContents) {
    const blank = blankBelowContent(output, page);
    if (blank !== null && blank >= 0.3) {
      report.qa.push({ level: "P2", page, msg: Math.round(blank * 100) + "% of the text area is blank below the content; let the next section flow or move a figure" });
    }
  }
});
finish(report);

/** Fraction of the text area (between the margins) left blank under the last content word. */
function blankBelowContent(pdfPath, page) {
  const r = { stdout: checked(pdftotext, ["-f", String(page), "-l", String(page), "-bbox", pdfPath, "-"]) };
  const pg = /<page width="([\d.]+)" height="([\d.]+)"/.exec(r.stdout || "");
  if (!pg) return null;
  const H = Number(pg[2]);
  const words = [...(r.stdout || "").matchAll(/<word xMin="[\d.]+" yMin="([\d.]+)" xMax="[\d.]+" yMax="([\d.]+)">/g)].map(m => ({ y0: Number(m[1]), y1: Number(m[2]) }));
  if (!words.length) return null;
  const top = Math.min(...words.map(w => w.y0));
  const footer = H - 46; // margin-box footer sits inside the bottom 22mm margin
  const body = words.filter(w => w.y1 < footer);
  if (!body.length) return null;
  const bottom = Math.max(...body.map(w => w.y1));
  const areaBottom = H - 62; // 22mm bottom margin in pt
  const usable = areaBottom - top;
  return usable > 0 ? Math.max(0, (areaBottom - bottom) / usable) : null;
}

function finish(r) {
  const p0 = r.qa.filter(q => q.level === "P0").length, p1 = r.qa.filter(q => q.level === "P1").length;
  r.verdict = p0 ? "FAIL" : r.notRun.length ? "BLOCKED" : (p1 || r.qa.length ? "REVIEW" : "PASS");
  if (flags.json) console.log(JSON.stringify(r, null, 2));
  else {
    console.log("export-paged-report: " + r.output + " (" + (r.pages ?? "?") + " pages, " + (r.pageSize?.name || "size ?") + ", " + r.passes + " pass" + (r.passes > 1 ? "es" : "") + ")");
    for (const t of r.toc) console.log("  toc  " + String(t.page ?? "?").padStart(3) + "  " + t.text);
    for (const q of r.qa) console.log("  " + q.level + "  p" + (q.page ?? "-") + "  " + q.msg);
    for (const n of r.notRun) console.log("  NOT RUN  " + n);
    console.log("  verdict: " + r.verdict);
  }
  process.exit({ PASS: 0, FAIL: 1, REVIEW: 2, BLOCKED: 3 }[r.verdict]);
}
